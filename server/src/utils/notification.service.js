import Notification from "../models/Notification.js";

/* =========================================================
 * HELPERS
 * ======================================================= */
function safe(v) {
  return String(v || "").trim();
}

function normalizeRole(role = "") {
  const r = safe(role).toUpperCase();
  if (["SUPER_ADMIN", "ADMIN", "JUDGE", "PARENT"].includes(r)) return r;
  return "";
}

function normalizeType(type = "") {
  const t = safe(type).toUpperCase();
  if (
    ["PAYMENT", "SCORE", "RESULT", "CERTIFICATE", "HELP", "SYSTEM"].includes(t)
  ) {
    return t;
  }
  return "SYSTEM";
}

function normalizePriority(priority = "") {
  const p = safe(priority).toUpperCase();
  if (["LOW", "MEDIUM", "HIGH", "EMERGENCY"].includes(p)) return p;
  return "MEDIUM";
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null || v === "") return [];
  return [v];
}

function uniqueIds(values = []) {
  return [
    ...new Set(
      asArray(values)
        .map((x) => safe(x))
        .filter(Boolean),
    ),
  ];
}

function roomHelpers(appOrIo) {
  const io =
    typeof appOrIo?.to === "function" ? appOrIo : appOrIo?.get?.("io") || null;

  const rooms = appOrIo?.get?.("socketRooms") ||
    appOrIo?.socketRooms || {
      academyRoom: (academyId) => `academy:${safe(academyId)}`,
      roleRoom: (role, academyId = "") => {
        const r = normalizeRole(role);
        const a = safe(academyId);
        return a ? `academy:${a}:role:${r}` : `role:${r}`;
      },
      userRoom: (userId) => `user:${safe(userId)}`,
      judgeRoom: (userId) => `judge:${safe(userId)}`,
      eventRoom: (eventId) => `event:${safe(eventId)}`,
      groupRoom: (groupId) => `group:${safe(groupId)}`,
    };

  return { io, rooms };
}

function toPlain(doc) {
  if (!doc) return null;

  return {
    id: String(doc._id || ""),
    academyId: safe(doc.academyId),
    userId: safe(doc.userId),
    parentUserId: safe(doc.parentUserId),
    role: safe(doc.role),
    title: doc.title || "",
    message: doc.message || "",
    type: doc.type || "SYSTEM",
    priority: doc.priority || "MEDIUM",
    isRead: Boolean(doc.isRead),
    readAt: doc.readAt || null,
    actionUrl: doc.actionUrl || "",
    meta: doc.meta || {},
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

function buildBaseDoc(payload = {}) {
  const role = normalizeRole(payload.role);
  const userId = safe(payload.userId);
  const parentUserId = safe(payload.parentUserId);

  return {
    academyId: safe(payload.academyId) || null,
    userId: userId || null,
    parentUserId: parentUserId || null,
    role: role || undefined,
    title: safe(payload.title),
    message: safe(payload.message),
    type: normalizeType(payload.type),
    priority: normalizePriority(payload.priority),
    isRead: false,
    readAt: null,
    actionUrl: safe(payload.actionUrl),
    meta:
      payload.meta &&
      typeof payload.meta === "object" &&
      !Array.isArray(payload.meta)
        ? payload.meta
        : {},
  };
}

function buildUnreadFilter(userId, role, academyId) {
  const uid = safe(userId);
  const normalizedRole = normalizeRole(role);
  const aid = safe(academyId);

  const or = [];

  if (uid) {
    or.push({ userId: uid });
    or.push({ parentUserId: uid });
  }

  if (normalizedRole && aid) {
    or.push({ academyId: aid, role: normalizedRole });
  }

  if (!or.length) return null;

  return {
    isRead: false,
    $or: or,
  };
}

/* =========================================================
 * CREATE NOTIFICATIONS
 * ======================================================= */
export async function createNotification(appOrIo, payload = {}) {
  const { io, rooms } = roomHelpers(appOrIo);
  const docData = buildBaseDoc(payload);

  if (!docData.academyId) {
    throw new Error("academyId is required");
  }

  if (!docData.userId && !docData.parentUserId && !docData.role) {
    throw new Error(
      "Notification target is required (userId, parentUserId, or role)",
    );
  }

  const doc = await Notification.create(docData);
  const plain = toPlain(doc);

  if (io) {
    if (docData.userId) {
      io.to(rooms.userRoom(docData.userId)).emit("notification:new", plain);
      io.to(rooms.userRoom(docData.userId)).emit(
        "user:notification:new",
        plain,
      );
    }

    if (docData.parentUserId) {
      io.to(rooms.userRoom(docData.parentUserId)).emit(
        "notification:new",
        plain,
      );
      io.to(rooms.userRoom(docData.parentUserId)).emit(
        "parent:notification:new",
        plain,
      );
    }

    if (docData.role) {
      io.to(rooms.roleRoom(docData.role, docData.academyId)).emit(
        "role:notification:new",
        plain,
      );
    }
  }

  if (docData.userId) {
    await emitUnreadCount(appOrIo, {
      userId: docData.userId,
      role: docData.role,
      academyId: docData.academyId,
    });
  }

  if (docData.parentUserId && docData.parentUserId !== docData.userId) {
    await emitUnreadCount(appOrIo, {
      userId: docData.parentUserId,
      role: "PARENT",
      academyId: docData.academyId,
    });
  }

  return doc;
}

export async function createManyNotifications(appOrIo, payload = {}) {
  const userIds = uniqueIds(payload.userIds || payload.userId);
  const parentUserIds = uniqueIds(
    payload.parentUserIds || payload.parentUserId,
  );

  const created = [];

  for (const uid of userIds) {
    created.push(
      await createNotification(appOrIo, {
        ...payload,
        userId: uid,
        parentUserId: null,
        role: payload.role || undefined,
      }),
    );
  }

  for (const pid of parentUserIds) {
    created.push(
      await createNotification(appOrIo, {
        ...payload,
        userId: null,
        parentUserId: pid,
        role: payload.role || "PARENT",
      }),
    );
  }

  return {
    ok: true,
    count: created.length,
    items: created,
  };
}

export async function createRoleNotification(appOrIo, payload = {}) {
  return createNotification(appOrIo, {
    ...payload,
    userId: null,
    parentUserId: null,
    role: normalizeRole(payload.role),
  });
}

/* =========================================================
 * SPECIALIZED HELPERS
 * ======================================================= */
export async function createPaymentNotification(appOrIo, args = {}) {
  const {
    academyId = "",
    userId = "",
    parentUserId = "",
    participantName = "Participant",
    eventName = "Event",
    amount = 0,
    currency = "QAR",
    paymentStatus = "PENDING",
    receiptNo = "",
    invoiceNo = "",
    paymentId = "",
  } = args;

  const status = safe(paymentStatus).toUpperCase();
  const formattedAmount = `${String(currency || "QAR").toUpperCase()} ${Number(amount || 0).toFixed(2)}`;

  let title = "Payment Update";
  let message = `${participantName} payment for ${eventName} has been updated.`;
  let priority = "MEDIUM";

  if (status === "PAID") {
    title = "Payment Confirmed";
    message = `${participantName} payment for ${eventName} is confirmed. Amount: ${formattedAmount}.`;
  } else if (status === "FAILED") {
    title = "Payment Failed";
    message = `${participantName} payment for ${eventName} failed. Please retry or contact support.`;
    priority = "HIGH";
  } else if (status === "REFUNDED") {
    title = "Payment Refunded";
    message = `${participantName} payment for ${eventName} has been refunded.`;
  } else if (status === "CANCELLED") {
    title = "Payment Cancelled";
    message = `${participantName} payment for ${eventName} was cancelled.`;
  }

  const targetUserId = safe(userId);
  const targetParentId = safe(parentUserId);

  if (!targetUserId && !targetParentId) {
    throw new Error(
      "userId or parentUserId is required for payment notification",
    );
  }

  return createNotification(appOrIo, {
    academyId,
    userId: targetUserId || null,
    parentUserId: targetParentId || null,
    role: targetParentId ? "PARENT" : undefined,
    title,
    message,
    type: "PAYMENT",
    priority,
    actionUrl: "/parent/payments",
    meta: {
      paymentId: safe(paymentId),
      participantName,
      eventName,
      amount: Number(amount || 0),
      currency: String(currency || "QAR").toUpperCase(),
      paymentStatus: status,
      receiptNo: safe(receiptNo),
      invoiceNo: safe(invoiceNo),
    },
  });
}

export async function createResultNotification(appOrIo, args = {}) {
  const {
    academyId = "",
    userId = "",
    parentUserId = "",
    participantName = "Participant",
    eventName = "Event",
    rank = "",
    medal = "",
    score = "",
    eventId = "",
  } = args;

  return createNotification(appOrIo, {
    academyId,
    userId: safe(userId) || null,
    parentUserId: safe(parentUserId) || null,
    role: parentUserId ? "PARENT" : undefined,
    title: "Result Published",
    message: `${participantName} result for ${eventName} is available now.`,
    type: "RESULT",
    priority: "MEDIUM",
    actionUrl: eventId
      ? `/parent/results?eventId=${safe(eventId)}`
      : "/parent/results",
    meta: {
      participantName,
      eventName,
      eventId: safe(eventId),
      rank,
      medal,
      score,
    },
  });
}

export async function createCertificateNotification(appOrIo, args = {}) {
  const {
    academyId = "",
    userId = "",
    parentUserId = "",
    participantName = "Participant",
    eventName = "Event",
    eventId = "",
    certificateId = "",
  } = args;

  return createNotification(appOrIo, {
    academyId,
    userId: safe(userId) || null,
    parentUserId: safe(parentUserId) || null,
    role: parentUserId ? "PARENT" : undefined,
    title: "Certificate Ready",
    message: `${participantName} certificate for ${eventName} is ready.`,
    type: "CERTIFICATE",
    priority: "MEDIUM",
    actionUrl: eventId
      ? `/parent/certificates?eventId=${safe(eventId)}`
      : "/parent/certificates",
    meta: {
      participantName,
      eventName,
      eventId: safe(eventId),
      certificateId: safe(certificateId),
    },
  });
}

export async function createHelpNotification(appOrIo, args = {}) {
  const {
    academyId = "",
    role = "ADMIN",
    title = "Help Request",
    message = "A judge has requested assistance.",
    actionUrl = "/admin/alerts",
    meta = {},
  } = args;

  return createRoleNotification(appOrIo, {
    academyId,
    role,
    title,
    message,
    type: "HELP",
    priority: "HIGH",
    actionUrl,
    meta,
  });
}

export async function createSystemNotification(appOrIo, args = {}) {
  return createNotification(appOrIo, {
    academyId: args.academyId,
    userId: args.userId || null,
    parentUserId: args.parentUserId || null,
    role: args.role || undefined,
    title: args.title || "System Notification",
    message: args.message || "",
    type: "SYSTEM",
    priority: args.priority || "MEDIUM",
    actionUrl: args.actionUrl || "",
    meta: args.meta || {},
  });
}

/* =========================================================
 * READ / UNREAD
 * ======================================================= */
export async function emitUnreadCount(appOrIo, args = {}) {
  const { io, rooms } = roomHelpers(appOrIo);

  const userId = safe(args.userId);
  const role = normalizeRole(args.role);
  const academyId = safe(args.academyId);

  if (!userId) return 0;

  const filter = buildUnreadFilter(userId, role, academyId);
  if (!filter) return 0;

  const unreadCount = await Notification.countDocuments(filter);

  if (io) {
    io.to(rooms.userRoom(userId)).emit("notification:unread_count", {
      unreadCount,
    });

    io.to(rooms.userRoom(userId)).emit("user:notification:unread_count", {
      unreadCount,
    });

    if (role === "PARENT") {
      io.to(rooms.userRoom(userId)).emit("parent:notification:unread_count", {
        unreadCount,
      });
    }
  }

  return unreadCount;
}

export async function markNotificationRead(appOrIo, args = {}) {
  const notificationId = safe(args.notificationId);
  const userId = safe(args.userId);
  const academyId = safe(args.academyId);
  const role = normalizeRole(args.role);

  if (!notificationId) throw new Error("notificationId is required");
  if (!userId) throw new Error("userId is required");
  if (!academyId) throw new Error("academyId is required");

  const doc = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      academyId,
      $or: [
        { userId },
        { parentUserId: userId },
        ...(role ? [{ role, academyId }] : []),
      ],
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
    { new: true },
  );

  if (!doc) throw new Error("Notification not found");

  await emitUnreadCount(appOrIo, { userId, role, academyId });
  return doc;
}

export async function markAllNotificationsRead(appOrIo, args = {}) {
  const userId = safe(args.userId);
  const academyId = safe(args.academyId);
  const role = normalizeRole(args.role);

  if (!userId) throw new Error("userId is required");
  if (!academyId) throw new Error("academyId is required");

  await Notification.updateMany(
    {
      academyId,
      isRead: false,
      $or: [
        { userId },
        { parentUserId: userId },
        ...(role ? [{ role, academyId }] : []),
      ],
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
  );

  await emitUnreadCount(appOrIo, { userId, role, academyId });

  return { ok: true };
}

/* =========================================================
 * LIST HELPERS
 * ======================================================= */
export async function getUserNotifications(args = {}) {
  const userId = safe(args.userId);
  const academyId = safe(args.academyId);
  const role = normalizeRole(args.role);
  const page = Math.max(Number(args.page || 1), 1);
  const limit = Math.min(Math.max(Number(args.limit || 20), 1), 200);
  const skip = (page - 1) * limit;
  const unreadOnly = Boolean(args.unreadOnly);

  if (!userId) throw new Error("userId is required");
  if (!academyId) throw new Error("academyId is required");

  const filter = {
    academyId,
    $or: [
      { userId },
      { parentUserId: userId },
      ...(role ? [{ role, academyId }] : []),
    ],
  };

  if (unreadOnly) filter.isRead = false;

  const [total, items] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: items.map(toPlain),
    total,
    page,
    limit,
    pages: Math.max(Math.ceil(total / limit), 1),
  };
}

const notificationService = {
  createNotification,
  createManyNotifications,
  createRoleNotification,
  createPaymentNotification,
  createResultNotification,
  createCertificateNotification,
  createHelpNotification,
  createSystemNotification,
  emitUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getUserNotifications,
};

export default notificationService;
