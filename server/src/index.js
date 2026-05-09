import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";

import { connectDB } from "./db.js";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import adminEventsRoutes from "./routes/admin.events.routes.js";
import judgeRoutes from "./routes/judge.routes.js";
import participantRoutes from "./routes/participant.routes.js";
import publicRoutes from "./routes/public.routes.js";
import verifyRoutes from "./routes/verify.routes.js";
import superAdminRoutes from "./routes/superadmin.routes.js";
import judgePwaRoutes from "./routes/judge.pwa.routes.js";
import parentRoutes from "./routes/parent.routes.js";
import adminPaymentsRoutes from "./routes/admin.payments.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import adminNotificationsRoutes from "./routes/admin.notifications.routes.js";
import adminEmailRoutes from "./routes/admin.email.routes.js";
import emailSettingsRoutes from "./routes/email.settings.routes.js";
import emailLogsRoutes from "./routes/email.logs.routes.js";
import emailSendRoutes from "./routes/email.send.routes.js";
import emailTemplatesRoutes from "./routes/email.templates.routes.js";

const app = express();
const server = http.createServer(app);

/* =========================
 * PATHS
 * ========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, "../uploads");
const ACADEMY_LOGOS_DIR = path.join(UPLOADS_DIR, "academy-logos");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(ACADEMY_LOGOS_DIR, { recursive: true });

/* =========================
 * CORE MIDDLEWARE
 * ========================= */
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

/* =========================
 * STATIC FILES
 * ========================= */
app.use("/uploads", express.static(UPLOADS_DIR));

/* =========================
 * SOCKET.IO
 * ========================= */
const io = new SocketIOServer(server, {
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

app.set("io", io);

/* =========================
 * SOCKET ROOM HELPERS
 * ========================= */
function safe(v) {
  return String(v || "").trim();
}

function upper(v) {
  return safe(v).toUpperCase();
}

function academyRoom(academyId) {
  return `academy:${safe(academyId)}`;
}

function roleRoom(role, academyId = "") {
  const r = upper(role);
  const a = safe(academyId);

  return a ? `academy:${a}:role:${r}` : `role:${r}`;
}

function userRoom(userId) {
  return `user:${safe(userId)}`;
}

function parentRoom(parentUserId) {
  return `parent:${safe(parentUserId)}`;
}

function judgeRoom(userId) {
  return `judge:${safe(userId)}`;
}

function participantRoom(userId) {
  return `participant:${safe(userId)}`;
}

function adminRoom(userId) {
  return `admin:${safe(userId)}`;
}

function superAdminRoom(userId) {
  return `super_admin:${safe(userId)}`;
}

function eventRoom(eventId) {
  return `event:${safe(eventId)}`;
}

function leaderboardRoom(eventId) {
  return `leaderboard:${safe(eventId)}`;
}

function groupRoom(groupId) {
  return `group:${safe(groupId)}`;
}

app.set("socketRooms", {
  academyRoom,
  roleRoom,
  userRoom,
  parentRoom,
  judgeRoom,
  participantRoom,
  adminRoom,
  superAdminRoom,
  eventRoom,
  leaderboardRoom,
  groupRoom,
});

function joinIfValue(socket, roomName) {
  const room = safe(roomName);
  if (room) socket.join(room);
}

function leaveIfValue(socket, roomName) {
  const room = safe(roomName);
  if (room) socket.leave(room);
}

function normalizeTokenPayload(decoded = {}) {
  const userId = safe(decoded._id || decoded.id || decoded.userId || "");

  const academyId = safe(
    decoded.academyId?._id ||
      decoded.academyId?.id ||
      decoded.academy?._id ||
      decoded.academy?.id ||
      decoded.academyId ||
      decoded.academy ||
      "",
  );

  const role = upper(decoded.role || "");

  return {
    userId,
    academyId,
    role,
  };
}

function getSocketToken(socket) {
  const bearer = String(socket.handshake.headers?.authorization || "").replace(
    /^Bearer\s+/i,
    "",
  );

  return safe(socket.handshake.auth?.token || bearer);
}

function attachSocketUser(socket) {
  const token = getSocketToken(socket);

  if (!token || !process.env.JWT_SECRET) {
    socket.user = null;
    socket.identity = {
      userId: "",
      academyId: "",
      role: "",
      authenticated: false,
    };
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const identity = normalizeTokenPayload(decoded);

    socket.user = decoded;
    socket.identity = {
      ...identity,
      authenticated: Boolean(identity.userId),
    };
  } catch {
    socket.user = null;
    socket.identity = {
      userId: "",
      academyId: "",
      role: "",
      authenticated: false,
    };
  }
}

function isSameAuthenticatedUser(socket, userId) {
  const requestedUserId = safe(userId);
  const socketUserId = safe(socket.identity?.userId);

  return Boolean(
    socket.identity?.authenticated && requestedUserId === socketUserId,
  );
}

function isAdminLikeRole(role) {
  const r = upper(role);
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function canJoinAcademyRoom(socket, academyId) {
  const requestedAcademyId = safe(academyId);
  const socketAcademyId = safe(socket.identity?.academyId);
  const role = upper(socket.identity?.role);

  if (!socket.identity?.authenticated) return false;

  if (role === "SUPER_ADMIN") return true;

  return Boolean(requestedAcademyId && requestedAcademyId === socketAcademyId);
}

function canJoinEventRooms(socket, academyId = "") {
  const role = upper(socket.identity?.role);

  if (!socket.identity?.authenticated) return false;

  if (role === "SUPER_ADMIN") return true;

  if (academyId) {
    return canJoinAcademyRoom(socket, academyId);
  }

  return Boolean(socket.identity?.userId);
}

function resolveAllowedUserPayload(socket, payload = {}, fallbackRole = "") {
  const requestedUserId = safe(
    payload.userId ||
      payload.adminUserId ||
      payload.superAdminUserId ||
      payload.judgeUserId ||
      payload.parentUserId ||
      payload.participantUserId ||
      "",
  );

  if (!isSameAuthenticatedUser(socket, requestedUserId)) {
    return null;
  }

  return {
    userId: socket.identity.userId,
    academyId: safe(payload.academyId || socket.identity.academyId || ""),
    role: upper(payload.role || socket.identity.role || fallbackRole || ""),
  };
}

function joinCommonUserRooms(
  socket,
  { userId = "", academyId = "", role = "" },
) {
  const uid = safe(userId);
  const a = safe(academyId);
  const r = upper(role);

  if (uid) joinIfValue(socket, userRoom(uid));
  if (a) joinIfValue(socket, academyRoom(a));
  if (r) joinIfValue(socket, roleRoom(r, a));

  if (r === "PARENT" && uid) {
    joinIfValue(socket, parentRoom(uid));
  }

  if (r === "JUDGE" && uid) {
    joinIfValue(socket, "judges");
    joinIfValue(socket, judgeRoom(uid));
  }

  if (r === "PARTICIPANT" && uid) {
    joinIfValue(socket, participantRoom(uid));
  }

  if (r === "ADMIN" && uid) {
    joinIfValue(socket, "admins");
    joinIfValue(socket, adminRoom(uid));
  }

  if (r === "SUPER_ADMIN" && uid) {
    joinIfValue(socket, "admins");
    joinIfValue(socket, adminRoom(uid));
    joinIfValue(socket, superAdminRoom(uid));
  }
}

function leaveCommonUserRooms(
  socket,
  { userId = "", academyId = "", role = "" },
) {
  const uid = safe(userId);
  const a = safe(academyId);
  const r = upper(role);

  if (uid) leaveIfValue(socket, userRoom(uid));
  if (a) leaveIfValue(socket, academyRoom(a));
  if (r) leaveIfValue(socket, roleRoom(r, a));

  if (r === "PARENT" && uid) {
    leaveIfValue(socket, parentRoom(uid));
  }

  if (r === "JUDGE" && uid) {
    leaveIfValue(socket, "judges");
    leaveIfValue(socket, judgeRoom(uid));
  }

  if (r === "PARTICIPANT" && uid) {
    leaveIfValue(socket, participantRoom(uid));
  }

  if (r === "ADMIN" && uid) {
    leaveIfValue(socket, "admins");
    leaveIfValue(socket, adminRoom(uid));
  }

  if (r === "SUPER_ADMIN" && uid) {
    leaveIfValue(socket, "admins");
    leaveIfValue(socket, adminRoom(uid));
    leaveIfValue(socket, superAdminRoom(uid));
  }
}

function joinAutoRoomsFromToken(socket) {
  const identity = socket.identity || {};

  if (!identity.authenticated || !identity.userId) return;

  joinCommonUserRooms(socket, {
    userId: identity.userId,
    academyId: identity.academyId,
    role: identity.role,
  });
}

function emitJoinAck(socket, eventName, payload = {}) {
  socket.emit("room:joined", {
    event: eventName,
    ...payload,
    ts: Date.now(),
  });
}

function emitLeaveAck(socket, eventName, payload = {}) {
  socket.emit("room:left", {
    event: eventName,
    ...payload,
    ts: Date.now(),
  });
}

function emitJoinDenied(socket, eventName, reason = "Not allowed") {
  socket.emit("room:denied", {
    event: eventName,
    reason,
    ts: Date.now(),
  });
}

/* =========================
 * SOCKET.IO CONNECTIONS
 * ========================= */
io.on("connection", (socket) => {
  attachSocketUser(socket);

  console.log("🔌 Socket connected:", socket.id, {
    authenticated: Boolean(socket.identity?.authenticated),
    userId: socket.identity?.userId || null,
    role: socket.identity?.role || null,
    academyId: socket.identity?.academyId || null,
  });

  joinAutoRoomsFromToken(socket);

  socket.emit("socket:ready", {
    ok: true,
    authenticated: Boolean(socket.identity?.authenticated),
    userId: socket.identity?.userId || null,
    academyId: socket.identity?.academyId || null,
    role: socket.identity?.role || null,
  });

  /* -------- authenticated user joins -------- */
  socket.on("user:join", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload);

    if (!identity) {
      console.warn("Blocked user:join without matching auth", {
        socketId: socket.id,
      });
      emitJoinDenied(socket, "user:join", "User mismatch or unauthenticated");
      return;
    }

    joinCommonUserRooms(socket, identity);
    emitJoinAck(socket, "user:join", identity);

    console.log("user:join", {
      socketId: socket.id,
      userId: identity.userId,
      academyId: identity.academyId,
      role: identity.role,
    });
  });

  socket.on("user:leave", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload);

    if (!identity) return;

    leaveCommonUserRooms(socket, identity);
    emitLeaveAck(socket, "user:leave", identity);

    console.log("user:leave", {
      socketId: socket.id,
      userId: identity.userId,
      academyId: identity.academyId,
      role: identity.role,
    });
  });

  socket.on("notification:join", (payload = {}) => {
    const body =
      typeof payload === "string" ? { userId: payload } : payload || {};

    const identity = resolveAllowedUserPayload(socket, body);

    if (!identity) {
      console.warn("Blocked notification:join without matching auth", {
        socketId: socket.id,
      });
      emitJoinDenied(
        socket,
        "notification:join",
        "User mismatch or unauthenticated",
      );
      return;
    }

    joinCommonUserRooms(socket, identity);
    emitJoinAck(socket, "notification:join", identity);

    console.log("notification:join", {
      socketId: socket.id,
      userId: identity.userId,
      academyId: identity.academyId,
      role: identity.role,
    });
  });

  socket.on("notification:leave", (payload = {}) => {
    const body =
      typeof payload === "string" ? { userId: payload } : payload || {};

    const identity = resolveAllowedUserPayload(socket, body);

    if (!identity) return;

    leaveCommonUserRooms(socket, identity);
    emitLeaveAck(socket, "notification:leave", identity);

    console.log("notification:leave", {
      socketId: socket.id,
      userId: identity.userId,
      academyId: identity.academyId,
      role: identity.role,
    });
  });

  /* -------- role-specific authenticated joins -------- */
  socket.on("admin:join", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload, "ADMIN");

    if (!identity || !isAdminLikeRole(identity.role || "ADMIN")) {
      emitJoinDenied(socket, "admin:join", "Admin access required");
      return;
    }

    joinIfValue(socket, "admins");
    joinCommonUserRooms(socket, {
      ...identity,
      role: identity.role || "ADMIN",
    });

    emitJoinAck(socket, "admin:join", {
      userId: identity.userId,
      academyId: identity.academyId,
      role: identity.role || "ADMIN",
    });

    console.log("admin:join", {
      socketId: socket.id,
      adminUserId: identity.userId,
      academyId: identity.academyId,
      role: identity.role || "ADMIN",
    });
  });

  socket.on("admin:leave", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload, "ADMIN");
    if (!identity) return;

    leaveIfValue(socket, "admins");
    leaveCommonUserRooms(socket, {
      ...identity,
      role: identity.role || "ADMIN",
    });

    emitLeaveAck(socket, "admin:leave", {
      userId: identity.userId,
      academyId: identity.academyId,
      role: identity.role || "ADMIN",
    });

    console.log("admin:leave", {
      socketId: socket.id,
      adminUserId: identity.userId,
      academyId: identity.academyId,
      role: identity.role || "ADMIN",
    });
  });

  socket.on("super-admin:join", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload, "SUPER_ADMIN");

    if (!identity || identity.role !== "SUPER_ADMIN") {
      emitJoinDenied(socket, "super-admin:join", "Super admin access required");
      return;
    }

    joinIfValue(socket, "admins");
    joinCommonUserRooms(socket, {
      ...identity,
      role: "SUPER_ADMIN",
    });

    emitJoinAck(socket, "super-admin:join", {
      userId: identity.userId,
      academyId: identity.academyId,
      role: "SUPER_ADMIN",
    });

    console.log("super-admin:join", {
      socketId: socket.id,
      superAdminUserId: identity.userId,
      academyId: identity.academyId,
      role: "SUPER_ADMIN",
    });
  });

  socket.on("super-admin:leave", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload, "SUPER_ADMIN");
    if (!identity) return;

    leaveIfValue(socket, "admins");
    leaveCommonUserRooms(socket, {
      ...identity,
      role: "SUPER_ADMIN",
    });

    emitLeaveAck(socket, "super-admin:leave", {
      userId: identity.userId,
      academyId: identity.academyId,
      role: "SUPER_ADMIN",
    });

    console.log("super-admin:leave", {
      socketId: socket.id,
      superAdminUserId: identity.userId,
      academyId: identity.academyId,
      role: "SUPER_ADMIN",
    });
  });

  socket.on("judge:join", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload, "JUDGE");

    if (!identity || identity.role !== "JUDGE") {
      emitJoinDenied(socket, "judge:join", "Judge access required");
      return;
    }

    joinIfValue(socket, "judges");
    joinCommonUserRooms(socket, {
      ...identity,
      role: "JUDGE",
    });

    emitJoinAck(socket, "judge:join", {
      userId: identity.userId,
      academyId: identity.academyId,
      role: "JUDGE",
    });

    console.log("judge:join", {
      socketId: socket.id,
      judgeUserId: identity.userId,
      academyId: identity.academyId,
      role: "JUDGE",
    });
  });

  socket.on("judge:leave", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload, "JUDGE");
    if (!identity) return;

    leaveIfValue(socket, "judges");
    leaveCommonUserRooms(socket, {
      ...identity,
      role: "JUDGE",
    });

    emitLeaveAck(socket, "judge:leave", {
      userId: identity.userId,
      academyId: identity.academyId,
      role: "JUDGE",
    });

    console.log("judge:leave", {
      socketId: socket.id,
      judgeUserId: identity.userId,
      academyId: identity.academyId,
      role: "JUDGE",
    });
  });

  socket.on("parent:join", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload, "PARENT");

    if (!identity || identity.role !== "PARENT") {
      emitJoinDenied(socket, "parent:join", "Parent access required");
      return;
    }

    joinCommonUserRooms(socket, {
      ...identity,
      role: "PARENT",
    });

    emitJoinAck(socket, "parent:join", {
      userId: identity.userId,
      academyId: identity.academyId,
      role: "PARENT",
    });

    console.log("parent:join", {
      socketId: socket.id,
      parentUserId: identity.userId,
      academyId: identity.academyId,
      role: "PARENT",
    });
  });

  socket.on("parent:leave", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload, "PARENT");
    if (!identity) return;

    leaveCommonUserRooms(socket, {
      ...identity,
      role: "PARENT",
    });

    emitLeaveAck(socket, "parent:leave", {
      userId: identity.userId,
      academyId: identity.academyId,
      role: "PARENT",
    });

    console.log("parent:leave", {
      socketId: socket.id,
      parentUserId: identity.userId,
      academyId: identity.academyId,
      role: "PARENT",
    });
  });

  socket.on("participant:join", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload, "PARTICIPANT");

    if (!identity || identity.role !== "PARTICIPANT") {
      emitJoinDenied(socket, "participant:join", "Participant access required");
      return;
    }

    joinCommonUserRooms(socket, {
      ...identity,
      role: "PARTICIPANT",
    });

    emitJoinAck(socket, "participant:join", {
      userId: identity.userId,
      academyId: identity.academyId,
      role: "PARTICIPANT",
    });

    console.log("participant:join", {
      socketId: socket.id,
      participantUserId: identity.userId,
      academyId: identity.academyId,
      role: "PARTICIPANT",
    });
  });

  socket.on("participant:leave", (payload = {}) => {
    const identity = resolveAllowedUserPayload(socket, payload, "PARTICIPANT");
    if (!identity) return;

    leaveCommonUserRooms(socket, {
      ...identity,
      role: "PARTICIPANT",
    });

    emitLeaveAck(socket, "participant:leave", {
      userId: identity.userId,
      academyId: identity.academyId,
      role: "PARTICIPANT",
    });

    console.log("participant:leave", {
      socketId: socket.id,
      participantUserId: identity.userId,
      academyId: identity.academyId,
      role: "PARTICIPANT",
    });
  });

  /* -------- academy / role rooms -------- */
  socket.on("academy:join", ({ academyId } = {}) => {
    const a = safe(academyId);

    if (!a) return;

    if (!canJoinAcademyRoom(socket, a)) {
      emitJoinDenied(socket, "academy:join", "Academy access denied");
      return;
    }

    joinIfValue(socket, academyRoom(a));
    emitJoinAck(socket, "academy:join", { academyId: a });

    console.log("academy:join", {
      socketId: socket.id,
      academyId: a,
    });
  });

  socket.on("academy:leave", ({ academyId } = {}) => {
    const a = safe(academyId);

    if (!a) return;

    leaveIfValue(socket, academyRoom(a));
    emitLeaveAck(socket, "academy:leave", { academyId: a });

    console.log("academy:leave", {
      socketId: socket.id,
      academyId: a,
    });
  });

  socket.on("role:join", ({ academyId, role } = {}) => {
    const a = safe(academyId);
    const r = upper(role);

    if (!r) return;

    if (!socket.identity?.authenticated) {
      console.warn("Blocked role:join without auth", {
        socketId: socket.id,
        role: r,
        academyId: a,
      });

      emitJoinDenied(socket, "role:join", "Authentication required");
      return;
    }

    if (a && !canJoinAcademyRoom(socket, a)) {
      emitJoinDenied(socket, "role:join", "Academy access denied");
      return;
    }

    joinIfValue(socket, roleRoom(r, a));
    emitJoinAck(socket, "role:join", { academyId: a, role: r });

    console.log("role:join", {
      socketId: socket.id,
      academyId: a,
      role: r,
    });
  });

  socket.on("role:leave", ({ academyId, role } = {}) => {
    const a = safe(academyId);
    const r = upper(role);

    if (!r) return;

    leaveIfValue(socket, roleRoom(r, a));
    emitLeaveAck(socket, "role:leave", { academyId: a, role: r });

    console.log("role:leave", {
      socketId: socket.id,
      academyId: a,
      role: r,
    });
  });

  /* -------- event / leaderboard rooms -------- */
  socket.on("event:join", ({ eventId, academyId } = {}) => {
    const eid = safe(eventId);
    const a = safe(academyId);

    if (!eid) return;

    if (!canJoinEventRooms(socket, a)) {
      emitJoinDenied(socket, "event:join", "Event room access denied");
      return;
    }

    joinIfValue(socket, eventRoom(eid));
    emitJoinAck(socket, "event:join", { eventId: eid, academyId: a });

    console.log("event:join", {
      socketId: socket.id,
      eventId: eid,
      academyId: a || null,
    });
  });

  socket.on("event:leave", ({ eventId } = {}) => {
    const eid = safe(eventId);

    if (!eid) return;

    leaveIfValue(socket, eventRoom(eid));
    emitLeaveAck(socket, "event:leave", { eventId: eid });

    console.log("event:leave", {
      socketId: socket.id,
      eventId: eid,
    });
  });

  socket.on("leaderboard:join", ({ eventId, groupId, academyId } = {}) => {
    const eid = safe(eventId);
    const gid = safe(groupId);
    const a = safe(academyId);

    if (!eid && !gid) return;

    if (!canJoinEventRooms(socket, a)) {
      emitJoinDenied(
        socket,
        "leaderboard:join",
        "Leaderboard room access denied",
      );
      return;
    }

    if (eid) joinIfValue(socket, leaderboardRoom(eid));
    if (gid) joinIfValue(socket, groupRoom(gid));

    emitJoinAck(socket, "leaderboard:join", {
      eventId: eid,
      groupId: gid,
      academyId: a,
    });

    console.log("leaderboard:join", {
      socketId: socket.id,
      eventId: eid || null,
      groupId: gid || null,
      academyId: a || null,
    });
  });

  socket.on("leaderboard:leave", ({ eventId, groupId } = {}) => {
    const eid = safe(eventId);
    const gid = safe(groupId);

    if (!eid && !gid) return;

    if (eid) leaveIfValue(socket, leaderboardRoom(eid));
    if (gid) leaveIfValue(socket, groupRoom(gid));

    emitLeaveAck(socket, "leaderboard:leave", {
      eventId: eid,
      groupId: gid,
    });

    console.log("leaderboard:leave", {
      socketId: socket.id,
      eventId: eid || null,
      groupId: gid || null,
    });
  });

  /* -------- frontend alias joins -------- */
  socket.on("join:user", (payload = {}) => {
    const body =
      typeof payload === "string" ? { userId: payload } : payload || {};

    const identity = resolveAllowedUserPayload(socket, body);

    if (!identity) {
      console.warn("Blocked join:user without matching auth", {
        socketId: socket.id,
      });

      emitJoinDenied(socket, "join:user", "User mismatch or unauthenticated");
      return;
    }

    joinCommonUserRooms(socket, identity);
    emitJoinAck(socket, "join:user", identity);

    console.log("join:user", {
      socketId: socket.id,
      userId: identity.userId,
      academyId: identity.academyId,
      role: identity.role,
    });
  });

  socket.on("leave:user", (payload = {}) => {
    const body =
      typeof payload === "string" ? { userId: payload } : payload || {};

    const identity = resolveAllowedUserPayload(socket, body);

    if (!identity) return;

    leaveCommonUserRooms(socket, identity);
    emitLeaveAck(socket, "leave:user", identity);

    console.log("leave:user", {
      socketId: socket.id,
      userId: identity.userId,
      academyId: identity.academyId,
      role: identity.role,
    });
  });

  socket.on("join:academy", (payload = {}) => {
    const a =
      typeof payload === "string" ? safe(payload) : safe(payload.academyId);

    if (!a) return;

    if (!canJoinAcademyRoom(socket, a)) {
      emitJoinDenied(socket, "join:academy", "Academy access denied");
      return;
    }

    joinIfValue(socket, academyRoom(a));
    emitJoinAck(socket, "join:academy", { academyId: a });

    console.log("join:academy", {
      socketId: socket.id,
      academyId: a,
    });
  });

  socket.on("leave:academy", (payload = {}) => {
    const a =
      typeof payload === "string" ? safe(payload) : safe(payload.academyId);

    if (!a) return;

    leaveIfValue(socket, academyRoom(a));
    emitLeaveAck(socket, "leave:academy", { academyId: a });

    console.log("leave:academy", {
      socketId: socket.id,
      academyId: a,
    });
  });

  socket.on("join:event", (payload = {}) => {
    const eid =
      typeof payload === "string" ? safe(payload) : safe(payload.eventId);

    const a = typeof payload === "string" ? "" : safe(payload.academyId);

    if (!eid) return;

    if (!canJoinEventRooms(socket, a)) {
      emitJoinDenied(socket, "join:event", "Event room access denied");
      return;
    }

    joinIfValue(socket, eventRoom(eid));
    emitJoinAck(socket, "join:event", {
      eventId: eid,
      academyId: a,
    });

    console.log("join:event", {
      socketId: socket.id,
      eventId: eid,
      academyId: a || null,
    });
  });

  socket.on("leave:event", (payload = {}) => {
    const eid =
      typeof payload === "string" ? safe(payload) : safe(payload.eventId);

    if (!eid) return;

    leaveIfValue(socket, eventRoom(eid));
    emitLeaveAck(socket, "leave:event", { eventId: eid });

    console.log("leave:event", {
      socketId: socket.id,
      eventId: eid,
    });
  });

  socket.on("join:leaderboard", (payload = {}) => {
    const eid =
      typeof payload === "string" ? safe(payload) : safe(payload.eventId);

    const gid = typeof payload === "string" ? "" : safe(payload.groupId);
    const a = typeof payload === "string" ? "" : safe(payload.academyId);

    if (!eid && !gid) return;

    if (!canJoinEventRooms(socket, a)) {
      emitJoinDenied(
        socket,
        "join:leaderboard",
        "Leaderboard room access denied",
      );
      return;
    }

    if (eid) joinIfValue(socket, leaderboardRoom(eid));
    if (gid) joinIfValue(socket, groupRoom(gid));

    emitJoinAck(socket, "join:leaderboard", {
      eventId: eid,
      groupId: gid,
      academyId: a,
    });

    console.log("join:leaderboard", {
      socketId: socket.id,
      eventId: eid || null,
      groupId: gid || null,
      academyId: a || null,
    });
  });

  socket.on("leave:leaderboard", (payload = {}) => {
    const eid =
      typeof payload === "string" ? safe(payload) : safe(payload.eventId);

    const gid = typeof payload === "string" ? "" : safe(payload.groupId);

    if (!eid && !gid) return;

    if (eid) leaveIfValue(socket, leaderboardRoom(eid));
    if (gid) leaveIfValue(socket, groupRoom(gid));

    emitLeaveAck(socket, "leave:leaderboard", {
      eventId: eid,
      groupId: gid,
    });

    console.log("leave:leaderboard", {
      socketId: socket.id,
      eventId: eid || null,
      groupId: gid || null,
    });
  });

  socket.on("join:group", (payload = {}) => {
    const gid =
      typeof payload === "string" ? safe(payload) : safe(payload.groupId);

    if (!gid) return;

    joinIfValue(socket, groupRoom(gid));
    emitJoinAck(socket, "join:group", { groupId: gid });

    console.log("join:group", {
      socketId: socket.id,
      groupId: gid,
    });
  });

  socket.on("leave:group", (payload = {}) => {
    const gid =
      typeof payload === "string" ? safe(payload) : safe(payload.groupId);

    if (!gid) return;

    leaveIfValue(socket, groupRoom(gid));
    emitLeaveAck(socket, "leave:group", { groupId: gid });

    console.log("leave:group", {
      socketId: socket.id,
      groupId: gid,
    });
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 Socket disconnected:", socket.id, reason);
  });
});

/* =========================
 * HEALTH
 * ========================= */
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "gymnastics-scoring-api",
  });
});

/* =========================
 * ROUTES
 * ========================= */
app.use("/api/auth", authRoutes);

app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminEventsRoutes);
app.use("/api/admin", adminPaymentsRoutes);

app.use("/api/judge", judgeRoutes);
app.use("/api/judge", judgePwaRoutes);

app.use("/api/participant", participantRoutes);
app.use("/api/parent", parentRoutes);

app.use("/api/public", publicRoutes);
app.use("/api", verifyRoutes);
app.use("/api/super-admin", superAdminRoutes);

/* notifications */
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin/notifications", adminNotificationsRoutes);

/* email */
app.use("/api/admin/email", adminEmailRoutes);
app.use("/api/email/settings", emailSettingsRoutes);
app.use("/api/email/logs", emailLogsRoutes);

/* mount templates before generic /api/email */
app.use("/api/email/templates", emailTemplatesRoutes);
app.use("/api/email", emailSendRoutes);

/* =========================
 * 404
 * ========================= */
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

/* =========================
 * ERROR HANDLER
 * ========================= */
app.use((err, _req, res, _next) => {
  console.error("UNHANDLED SERVER ERROR:", err);

  return res.status(Number(err?.status || 500)).json({
    message: err?.message || "Internal server error",
  });
});

/* =========================
 * START
 * ========================= */
const port = Number(process.env.PORT || 8080);

await connectDB(process.env.MONGODB_URI || process.env.MONGO_URI);

server.listen(port, () => {
  console.log(`🚀 Server running on :${port}`);
});
