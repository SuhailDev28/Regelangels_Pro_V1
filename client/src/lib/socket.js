// client/src/lib/socket.js
import { io } from "socket.io-client";
import { getToken, getUser } from "./auth.js";
import { getAccessToken } from "./tokenStore.js";

function normalizeUrl(value, fallback = "") {
  return String(value || fallback || "")
    .trim()
    .replace(/\/+$/, "");
}

function resolveSocketUrl() {
  const explicit = normalizeUrl(import.meta.env.VITE_SOCKET_URL);
  if (explicit) return explicit;

  const apiBase = normalizeUrl(
    import.meta.env.VITE_API_BASE,
    "http://localhost:8080/api",
  );

  return apiBase.replace(/\/api$/i, "");
}

function normalizeId(v) {
  return String(v || "").trim();
}

function normalizeRole(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function resolveUserIdentity() {
  const user = typeof getUser === "function" ? getUser() : null;

  const userId = normalizeId(user?._id || user?.id || user?.userId || "");

  const academyId = normalizeId(
    user?.academyId?._id ||
      user?.academyId?.id ||
      user?.academy?._id ||
      user?.academy?.id ||
      user?.academyId ||
      user?.academy ||
      "",
  );

  const role = normalizeRole(user?.role || "");

  return {
    userId,
    academyId,
    role,
  };
}

const SOCKET_URL = resolveSocketUrl();

let socketInstance = null;
let wiredCoreListeners = false;
let joinedIdentityKey = "";

function buildSocketAuth() {
  return {
    token: getAccessToken?.() || getToken?.() || "",
  };
}

function buildIdentityKey({ userId = "", academyId = "", role = "" } = {}) {
  return `${normalizeId(userId)}:${normalizeId(academyId)}:${normalizeRole(role)}`;
}

function parseIdentityKey(key = "") {
  const [userId = "", academyId = "", role = ""] = String(key || "").split(":");

  return {
    userId: normalizeId(userId),
    academyId: normalizeId(academyId),
    role: normalizeRole(role),
  };
}

function emitSafe(socket, eventName, payload = {}) {
  if (!socket || !eventName) return false;

  try {
    socket.emit(eventName, payload);
    return true;
  } catch (err) {
    console.error(`socket emit failed: ${eventName}`, err);
    return false;
  }
}

function ensureConnectedSocket() {
  const socket = getSocket();

  if (socket && !socket.connected) {
    socket.connect();
  }

  return socket;
}

function joinRoleSpecificRooms(socket, { userId, academyId, role }) {
  if (!socket || !userId || !role) return;

  emitSafe(socket, "user:join", {
    userId,
    academyId,
    role,
  });

  emitSafe(socket, "notification:join", {
    userId,
    academyId,
    role,
  });

  if (role === "PARENT") {
    emitSafe(socket, "parent:join", {
      parentUserId: userId,
      userId,
      academyId,
      role,
    });
  }

  if (role === "JUDGE") {
    emitSafe(socket, "judge:join", {
      judgeUserId: userId,
      userId,
      academyId,
      role,
    });
  }

  if (role === "PARTICIPANT") {
    emitSafe(socket, "participant:join", {
      participantUserId: userId,
      userId,
      academyId,
      role,
    });
  }

  if (role === "ADMIN") {
    emitSafe(socket, "admin:join", {
      adminUserId: userId,
      userId,
      academyId,
      role,
    });
  }

  if (role === "SUPER_ADMIN") {
    emitSafe(socket, "super-admin:join", {
      superAdminUserId: userId,
      userId,
      academyId,
      role,
    });

    emitSafe(socket, "admin:join", {
      adminUserId: userId,
      userId,
      academyId,
      role,
    });
  }
}

function leaveRoleSpecificRooms(socket, { userId, academyId, role }) {
  if (!socket || !userId || !role) return;

  emitSafe(socket, "user:leave", {
    userId,
    academyId,
    role,
  });

  emitSafe(socket, "notification:leave", {
    userId,
    academyId,
    role,
  });

  if (role === "PARENT") {
    emitSafe(socket, "parent:leave", {
      parentUserId: userId,
      userId,
      academyId,
      role,
    });
  }

  if (role === "JUDGE") {
    emitSafe(socket, "judge:leave", {
      judgeUserId: userId,
      userId,
      academyId,
      role,
    });
  }

  if (role === "PARTICIPANT") {
    emitSafe(socket, "participant:leave", {
      participantUserId: userId,
      userId,
      academyId,
      role,
    });
  }

  if (role === "ADMIN") {
    emitSafe(socket, "admin:leave", {
      adminUserId: userId,
      userId,
      academyId,
      role,
    });
  }

  if (role === "SUPER_ADMIN") {
    emitSafe(socket, "super-admin:leave", {
      superAdminUserId: userId,
      userId,
      academyId,
      role,
    });

    emitSafe(socket, "admin:leave", {
      adminUserId: userId,
      userId,
      academyId,
      role,
    });
  }
}

function ensureCoreListeners(socket) {
  if (!socket || wiredCoreListeners) return;

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
    autoJoinSocketRooms();
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connect error:", err?.message || err);
  });

  socket.on("disconnect", (reason) => {
    console.warn("Socket disconnected:", reason);
  });

  socket.on("socket:ready", () => {
    autoJoinSocketRooms();
  });

  socket.on("room:joined", (payload) => {
    if (import.meta.env.DEV) {
      console.log("Socket room joined:", payload);
    }
  });

  socket.on("room:left", (payload) => {
    if (import.meta.env.DEV) {
      console.log("Socket room left:", payload);
    }
  });

  socket.on("room:denied", (payload) => {
    console.warn("Socket room denied:", payload);
  });

  wiredCoreListeners = true;
}

/* =========================
 * AUTO USER / ROLE ROOMS
 * ========================= */
export function autoJoinSocketRooms() {
  const socket = socketInstance;

  if (!socket || !socket.connected) return;

  const identity = resolveUserIdentity();
  const { userId, role } = identity;

  if (!userId || !role) return;

  const nextIdentityKey = buildIdentityKey(identity);

  if (joinedIdentityKey === nextIdentityKey) return;

  if (joinedIdentityKey) {
    const previousIdentity = parseIdentityKey(joinedIdentityKey);
    leaveRoleSpecificRooms(socket, previousIdentity);
  }

  joinRoleSpecificRooms(socket, identity);
  joinedIdentityKey = nextIdentityKey;
}

export function leaveSocketRooms() {
  const socket = socketInstance;

  if (!socket || !joinedIdentityKey) return;

  const identity = parseIdentityKey(joinedIdentityKey);
  leaveRoleSpecificRooms(socket, identity);
  joinedIdentityKey = "";
}

/* =========================
 * ACADEMY ROOM HELPERS
 * ========================= */
export function joinAcademyRoom(academyId) {
  const socket = ensureConnectedSocket();
  const a = normalizeId(academyId || resolveUserIdentity().academyId);

  if (!socket || !a) return false;

  return emitSafe(socket, "join:academy", {
    academyId: a,
  });
}

export function leaveAcademyRoom(academyId) {
  const socket = socketInstance;
  const a = normalizeId(academyId || resolveUserIdentity().academyId);

  if (!socket || !a) return false;

  return emitSafe(socket, "leave:academy", {
    academyId: a,
  });
}

/* =========================
 * EVENT ROOM HELPERS
 * ========================= */
export function joinEventRoom(eventId, academyId = "") {
  const socket = ensureConnectedSocket();
  const eid = normalizeId(eventId);
  const a = normalizeId(academyId || resolveUserIdentity().academyId);

  if (!socket || !eid) return false;

  return emitSafe(socket, "join:event", {
    eventId: eid,
    academyId: a,
  });
}

export function leaveEventRoom(eventId) {
  const socket = socketInstance;
  const eid = normalizeId(eventId);

  if (!socket || !eid) return false;

  return emitSafe(socket, "leave:event", {
    eventId: eid,
  });
}

/* =========================
 * LEADERBOARD ROOM HELPERS
 * ========================= */
export function joinLeaderboardRoom(eventId, academyId = "", groupId = "") {
  const socket = ensureConnectedSocket();
  const eid = normalizeId(eventId);
  const gid = normalizeId(groupId);
  const a = normalizeId(academyId || resolveUserIdentity().academyId);

  if (!socket || (!eid && !gid)) return false;

  return emitSafe(socket, "join:leaderboard", {
    eventId: eid,
    groupId: gid,
    academyId: a,
  });
}

export function leaveLeaderboardRoom(eventId, groupId = "") {
  const socket = socketInstance;
  const eid = normalizeId(eventId);
  const gid = normalizeId(groupId);

  if (!socket || (!eid && !gid)) return false;

  return emitSafe(socket, "leave:leaderboard", {
    eventId: eid,
    groupId: gid,
  });
}

/* =========================
 * GROUP ROOM HELPERS
 * ========================= */
export function joinGroupRoom(groupId) {
  const socket = ensureConnectedSocket();
  const gid = normalizeId(groupId);

  if (!socket || !gid) return false;

  return emitSafe(socket, "join:group", {
    groupId: gid,
  });
}

export function leaveGroupRoom(groupId) {
  const socket = socketInstance;
  const gid = normalizeId(groupId);

  if (!socket || !gid) return false;

  return emitSafe(socket, "leave:group", {
    groupId: gid,
  });
}

/* =========================
 * JUDGE LIVE SCORING HELPERS
 * ========================= */
export function joinJudgeScoringRooms({
  eventId,
  academyId = "",
  includeLeaderboard = true,
} = {}) {
  const identity = resolveUserIdentity();
  const socket = ensureConnectedSocket();

  const eid = normalizeId(eventId);
  const a = normalizeId(academyId || identity.academyId);
  const userId = normalizeId(identity.userId);
  const role = normalizeRole(identity.role);

  if (!socket || !eid) return false;

  if (userId && role === "JUDGE") {
    emitSafe(socket, "judge:join", {
      judgeUserId: userId,
      userId,
      academyId: a,
      role,
    });
  }

  joinEventRoom(eid, a);

  if (includeLeaderboard) {
    joinLeaderboardRoom(eid, a);
  }

  if (a) {
    joinAcademyRoom(a);
  }

  return true;
}

export function leaveJudgeScoringRooms({
  eventId,
  groupId = "",
  includeLeaderboard = true,
} = {}) {
  const eid = normalizeId(eventId);
  const gid = normalizeId(groupId);

  if (!eid && !gid) return false;

  if (eid) {
    leaveEventRoom(eid);
  }

  if (includeLeaderboard) {
    leaveLeaderboardRoom(eid, gid);
  }

  return true;
}

/* =========================
 * ADMIN LIVE LEADERBOARD HELPERS
 * ========================= */
export function joinAdminLiveRooms({
  eventId,
  academyId = "",
  groupId = "",
} = {}) {
  const identity = resolveUserIdentity();
  const socket = ensureConnectedSocket();

  const eid = normalizeId(eventId);
  const gid = normalizeId(groupId);
  const a = normalizeId(academyId || identity.academyId);
  const userId = normalizeId(identity.userId);
  const role = normalizeRole(identity.role);

  if (!socket) return false;

  if (userId && (role === "ADMIN" || role === "SUPER_ADMIN")) {
    if (role === "SUPER_ADMIN") {
      emitSafe(socket, "super-admin:join", {
        superAdminUserId: userId,
        userId,
        academyId: a,
        role,
      });
    }

    emitSafe(socket, "admin:join", {
      adminUserId: userId,
      userId,
      academyId: a,
      role,
    });
  }

  if (a) {
    joinAcademyRoom(a);
  }

  if (eid) {
    joinEventRoom(eid, a);
    joinLeaderboardRoom(eid, a, gid);
  } else if (gid) {
    joinLeaderboardRoom("", a, gid);
  }

  return true;
}

export function leaveAdminLiveRooms({ eventId, groupId = "" } = {}) {
  const eid = normalizeId(eventId);
  const gid = normalizeId(groupId);

  if (eid) {
    leaveEventRoom(eid);
  }

  if (eid || gid) {
    leaveLeaderboardRoom(eid, gid);
  }

  return true;
}

/* =========================
 * SOCKET INSTANCE
 * ========================= */
export function getSocket() {
  if (socketInstance) {
    socketInstance.auth = buildSocketAuth();

    if (!socketInstance.connected) {
      socketInstance.connect();
    }

    return socketInstance;
  }

  socketInstance = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
    auth: buildSocketAuth(),
  });

  ensureCoreListeners(socketInstance);

  return socketInstance;
}

export function refreshSocketAuth() {
  const socket = getSocket();

  try {
    leaveSocketRooms();

    socket.auth = {
      ...(socket.auth || {}),
      ...buildSocketAuth(),
    };

    if (socket.connected) {
      socket.disconnect();
    }

    socket.connect();
  } catch (err) {
    console.error("refreshSocketAuth failed:", err);
  }

  return socket;
}

export function reconnectSocketAndRejoin() {
  return refreshSocketAuth();
}

export function disconnectSocket() {
  if (!socketInstance) return;

  try {
    leaveSocketRooms();
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
  } catch (err) {
    console.error("disconnectSocket failed:", err);
  } finally {
    socketInstance = null;
    wiredCoreListeners = false;
    joinedIdentityKey = "";
  }
}

export { SOCKET_URL };
export default getSocket;
