// server/src/services/notification.service.js
import mongoose from "mongoose";
import Notification from "../models/Notification.js";

const ALLOWED_CATEGORIES = [
  "MESSAGE",
  "PAYMENT",
  "BOOKING",
  "EVENT",
  "RESULT",
  "CERTIFICATE",
  "ASSIGNMENT",
  "REGISTRATION",
  "SYSTEM",
];

const ALLOWED_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

const ROLE_ALIASES = {
  ACADEMY_ADMIN: "ADMIN",
  MANAGER: "ADMIN",
  STAFF: "ADMIN",
};

function normalizeId(v) {
  return String(v || "").trim();
}

function normalizeUpper(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function normalizeRole(v) {
  const role = normalizeUpper(v);
  return ROLE_ALIASES[role] || role;
}

function normalizeType(v) {
  const x = normalizeUpper(v);
  return ALLOWED_CATEGORIES.includes(x) ? x : "SYSTEM";
}

function isValidObjectId(v) {
  return mongoose.Types.ObjectId.isValid(String(v || ""));
}

function toObjectIdOrNull(v) {
  const id = normalizeId(v);
  if (!id || !isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function toObjectIdIfValid(v) {
  const id = normalizeId(v);
  if (!id) return null;
  return isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id;
}

function safePlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function normalizeCategory(v) {
  const x = normalizeUpper(v);
  return ALLOWED_CATEGORIES.includes(x) ? x : "SYSTEM";
}

function normalizePriority(v) {
  const x = normalizeUpper(v);
  return ALLOWED_PRIORITIES.includes(x) ? x : "NORMAL";
}

function escapeRegex(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveApp(source) {
  if (!source) return null;
  if (typeof source.get === "function") return source;

  if (source.app && typeof source.app.get === "function") {
    return source.app;
  }

  if (source.req?.app && typeof source.req.app.get === "function") {
    return source.req.app;
  }

  return null;
}

function getSocketContext(source) {
  const app = resolveApp(source);
  if (!app) return { io: null, rooms: null };

  return {
    io: app.get("io") || null,
    rooms: app.get("socketRooms") || null,
  };
}

/**
 * Important:
 * Inbox ownership should be based on recipientUserId only.
 * Role and academy are stored as metadata and useful for emit routing,
 * but should not block a user's own inbox from loading.
 */
function buildUserScopeFilter({ userId }) {
  const safeUserId = normalizeId(userId);

  if (!safeUserId) {
    throw new Error("userId is required");
  }

  return {
    recipientUserId: toObjectIdIfValid(safeUserId),
    deletedAt: null,
  };
}

function emitToUserRooms(io, rooms, userId, role, eventName, payload) {
  if (!io || !userId || !eventName) return;

  const uid = normalizeId(userId);
  const safeRole = normalizeRole(role);

  if (!uid) return;

  if (rooms?.userRoom) {
    io.to(rooms.userRoom(uid)).emit(eventName, payload);
  } else {
    io.to(`user:${uid}`).emit(eventName, payload);
  }

  if (safeRole === "PARENT") {
    if (rooms?.parentRoom) {
      io.to(rooms.parentRoom(uid)).emit(eventName, payload);
    } else {
      io.to(`parent:${uid}`).emit(eventName, payload);
    }
  }

  if (safeRole === "PARTICIPANT") {
    if (rooms?.participantRoom) {
      io.to(rooms.participantRoom(uid)).emit(eventName, payload);
    } else {
      io.to(`participant:${uid}`).emit(eventName, payload);
    }
  }

  if (safeRole === "ADMIN") {
    if (rooms?.adminRoom) {
      io.to(rooms.adminRoom(uid)).emit(eventName, payload);
    } else {
      io.to(`admin:${uid}`).emit(eventName, payload);
    }
  }

  if (safeRole === "JUDGE") {
    if (rooms?.judgeRoom) {
      io.to(rooms.judgeRoom(uid)).emit(eventName, payload);
    } else {
      io.to(`judge:${uid}`).emit(eventName, payload);
    }
  }

  if (safeRole === "SUPER_ADMIN") {
    if (rooms?.superAdminRoom) {
      io.to(rooms.superAdminRoom(uid)).emit(eventName, payload);
    } else {
      io.to(`super_admin:${uid}`).emit(eventName, payload);
    }
  }
}

export function buildNotificationPayload(notification) {
  if (!notification) return null;

  const academyId =
    notification?.academyId?._id ||
    notification?.academyId?.id ||
    notification?.academyId ||
    null;

  const recipientUserId =
    notification?.recipientUserId?._id ||
    notification?.recipientUserId?.id ||
    notification?.recipientUserId ||
    null;

  const createdByUserId =
    notification?.createdByUserId?._id ||
    notification?.createdByUserId?.id ||
    notification?.createdByUserId ||
    null;

  const entityId =
    notification?.entityId?._id ||
    notification?.entityId?.id ||
    notification?.entityId ||
    null;

  const _id = notification?._id || notification?.id || null;

  return {
    _id: _id ? String(_id) : null,
    id: _id ? String(_id) : null,

    academyId: academyId ? String(academyId) : null,

    recipientUserId: recipientUserId ? String(recipientUserId) : null,
    userId: recipientUserId ? String(recipientUserId) : null,

    recipientRole: normalizeRole(notification?.recipientRole),
    role: normalizeRole(notification?.recipientRole),

    type: normalizeType(notification?.type),
    category: normalizeCategory(notification?.category),
    priority: normalizePriority(notification?.priority),

    title: String(notification?.title || "").trim(),
    message: String(notification?.message || "").trim(),

    isRead: Boolean(notification?.isRead),
    read: Boolean(notification?.isRead),
    readAt: notification?.readAt || null,

    actionUrl: String(notification?.actionUrl || "").trim(),

    entityType: String(notification?.entityType || "").trim(),
    entityId: entityId ? String(entityId) : null,

    meta: safePlainObject(notification?.meta),
    metadata: safePlainObject(notification?.meta),

    createdByUserId: createdByUserId ? String(createdByUserId) : null,

    createdAt: notification?.createdAt || null,
    updatedAt: notification?.updatedAt || null,
  };
}

export async function createNotification(input = {}) {
  const safeRecipientUserId = normalizeId(input.recipientUserId);
  const safeRecipientRole = normalizeRole(input.recipientRole);
  const safeType = normalizeType(input.type);
  const safeTitle = String(input.title || "").trim();
  const safeMessage = String(input.message || "").trim();

  if (!safeRecipientUserId) throw new Error("recipientUserId is required");
  if (!safeRecipientRole) throw new Error("recipientRole is required");
  if (!safeType) throw new Error("type is required");
  if (!safeTitle) throw new Error("title is required");

  return Notification.create({
    academyId: toObjectIdOrNull(input.academyId),

    recipientUserId: toObjectIdIfValid(safeRecipientUserId),
    recipientRole: safeRecipientRole,

    type: safeType,
    category: normalizeCategory(input.category || safeType),
    priority: normalizePriority(input.priority),

    title: safeTitle,
    message: safeMessage,

    actionUrl: String(input.actionUrl || "").trim(),

    entityType: String(input.entityType || "").trim(),
    entityId: toObjectIdOrNull(input.entityId),

    meta: safePlainObject(input.meta),

    createdByUserId: toObjectIdOrNull(input.createdByUserId),

    isRead: false,
    readAt: null,
    deletedAt: null,
  });
}

export async function createAndEmitNotification(source, input) {
  const notification = await createNotification(input);
  emitNotification(source, notification);
  return notification;
}

export async function createBulkNotifications(items = []) {
  if (!Array.isArray(items) || !items.length) return [];

  const docs = items
    .map((item) => {
      const recipientUserId = normalizeId(item?.recipientUserId);
      const recipientRole = normalizeRole(item?.recipientRole);
      const type = normalizeType(item?.type);
      const title = String(item?.title || "").trim();
      const message = String(item?.message || "").trim();

      if (!recipientUserId || !recipientRole || !type || !title) {
        return null;
      }

      return {
        academyId: toObjectIdOrNull(item?.academyId),

        recipientUserId: toObjectIdIfValid(recipientUserId),
        recipientRole,

        type,
        category: normalizeCategory(item?.category || type),
        priority: normalizePriority(item?.priority),

        title,
        message,

        actionUrl: String(item?.actionUrl || "").trim(),

        entityType: String(item?.entityType || "").trim(),
        entityId: toObjectIdOrNull(item?.entityId),

        meta: safePlainObject(item?.meta),

        createdByUserId: toObjectIdOrNull(item?.createdByUserId),

        isRead: false,
        readAt: null,
        deletedAt: null,
      };
    })
    .filter(Boolean);

  if (!docs.length) return [];

  return Notification.insertMany(docs, { ordered: false });
}

export async function createAndEmitBulkNotifications(source, items = []) {
  const notifications = await createBulkNotifications(items);
  emitNotifications(source, notifications);
  return notifications;
}

export async function listUserNotifications({
  userId,
  role,
  academyId = null,
  page = 1,
  limit = 20,
  unreadOnly = false,
  isRead = undefined,
  category = "",
  type = "",
  q = "",
}) {
  const safePage = Math.max(Number(page || 1), 1);
  const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const filter = buildUserScopeFilter({ userId, role, academyId });

  if (typeof isRead === "boolean") {
    filter.isRead = isRead;
  } else if (unreadOnly) {
    filter.isRead = false;
  }

  const safeCategory = normalizeUpper(category);
  if (safeCategory && safeCategory !== "ALL") {
    filter.category = normalizeCategory(safeCategory);
  }

  const safeType = normalizeUpper(type);
  if (safeType && safeType !== "ALL") {
    filter.type = normalizeType(safeType);
  }

  const search = escapeRegex(String(q || "").trim());

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
      { type: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  const unreadFilter = {
    ...buildUserScopeFilter({ userId, role, academyId }),
    isRead: false,
  };

  const [total, unread, rows] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments(unreadFilter),
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
  ]);

  return {
    items: rows.map(buildNotificationPayload),
    total: Number(total || 0),

    unread: Number(unread || 0),
    unreadCount: Number(unread || 0),

    page: safePage,
    limit: safeLimit,

    pages: Math.max(Math.ceil(Number(total || 0) / safeLimit), 1),
    totalPages: Math.max(Math.ceil(Number(total || 0) / safeLimit), 1),
  };
}

export async function getUserUnreadNotificationCount({
  userId,
  role,
  academyId = null,
}) {
  const filter = {
    ...buildUserScopeFilter({ userId, role, academyId }),
    isRead: false,
  };

  const unread = await Notification.countDocuments(filter);

  return {
    unread: Number(unread || 0),
    unreadCount: Number(unread || 0),
    count: Number(unread || 0),
    totalUnread: Number(unread || 0),
  };
}

export async function markUserNotificationRead({
  notificationId,
  userId,
  role,
  academyId = null,
}) {
  const safeNotificationId = normalizeId(notificationId);
  if (!safeNotificationId) throw new Error("notificationId is required");

  const updated = await Notification.findOneAndUpdate(
    {
      _id: toObjectIdIfValid(safeNotificationId),
      ...buildUserScopeFilter({ userId, role, academyId }),
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
    { new: true },
  ).lean();

  return updated ? buildNotificationPayload(updated) : null;
}

export async function markUserNotificationUnread({
  notificationId,
  userId,
  role,
  academyId = null,
}) {
  const safeNotificationId = normalizeId(notificationId);
  if (!safeNotificationId) throw new Error("notificationId is required");

  const updated = await Notification.findOneAndUpdate(
    {
      _id: toObjectIdIfValid(safeNotificationId),
      ...buildUserScopeFilter({ userId, role, academyId }),
    },
    {
      $set: {
        isRead: false,
        readAt: null,
      },
    },
    { new: true },
  ).lean();

  return updated ? buildNotificationPayload(updated) : null;
}

export async function markAllUserNotificationsRead({
  userId,
  role,
  academyId = null,
}) {
  const result = await Notification.updateMany(
    {
      ...buildUserScopeFilter({ userId, role, academyId }),
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
  );

  return {
    ok: true,
    matched: Number(result.matchedCount || 0),
    matchedCount: Number(result.matchedCount || 0),
    modified: Number(result.modifiedCount || 0),
    modifiedCount: Number(result.modifiedCount || 0),
  };
}

export async function bulkReadUserNotifications({
  ids = [],
  userId,
  role,
  academyId = null,
}) {
  const cleanIds = Array.isArray(ids)
    ? [
        ...new Set(
          ids
            .map((id) => normalizeId(id))
            .filter((id) => id && isValidObjectId(id)),
        ),
      ]
    : [];

  if (!cleanIds.length) {
    return {
      ok: true,
      matched: 0,
      matchedCount: 0,
      modified: 0,
      modifiedCount: 0,
    };
  }

  const result = await Notification.updateMany(
    {
      _id: {
        $in: cleanIds.map((id) => toObjectIdIfValid(id)),
      },
      ...buildUserScopeFilter({ userId, role, academyId }),
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    },
  );

  return {
    ok: true,
    matched: Number(result.matchedCount || 0),
    matchedCount: Number(result.matchedCount || 0),
    modified: Number(result.modifiedCount || 0),
    modifiedCount: Number(result.modifiedCount || 0),
  };
}

export async function deleteUserNotification({
  notificationId,
  userId,
  role,
  academyId = null,
}) {
  const safeNotificationId = normalizeId(notificationId);
  if (!safeNotificationId) throw new Error("notificationId is required");

  const deleted = await Notification.findOneAndUpdate(
    {
      _id: toObjectIdIfValid(safeNotificationId),
      ...buildUserScopeFilter({ userId, role, academyId }),
    },
    {
      $set: {
        deletedAt: new Date(),
      },
    },
    { new: true },
  ).lean();

  return deleted ? buildNotificationPayload(deleted) : null;
}

async function emitUnreadCount(source, { userId, role, academyId = null }) {
  const { io, rooms } = getSocketContext(source);
  if (!io) return;

  const uid = normalizeId(userId);
  const safeRole = normalizeRole(role);
  const aid = normalizeId(academyId);

  if (!uid) return;

  let unread = 0;

  try {
    const count = await getUserUnreadNotificationCount({
      userId: uid,
      role: safeRole,
      academyId: aid || null,
    });

    unread = Number(count?.unread || count?.unreadCount || 0);
  } catch {
    unread = 0;
  }

  const payload = {
    userId: uid,
    role: safeRole,
    academyId: aid || null,

    unread,
    unreadCount: unread,
    count: unread,
    totalUnread: unread,
  };

  emitToUserRooms(
    io,
    rooms,
    uid,
    safeRole,
    "notification:unread-count",
    payload,
  );

  emitToUserRooms(
    io,
    rooms,
    uid,
    safeRole,
    "notification:badge:update",
    payload,
  );

  emitToUserRooms(io, rooms, uid, safeRole, "notification:badge", payload);
}

export async function emitUserUnreadCount(source, args) {
  await emitUnreadCount(source, args);
}

export function emitNotification(source, notification) {
  const { io, rooms } = getSocketContext(source);
  if (!io || !notification) return;

  const payload = buildNotificationPayload(notification);
  const uid = normalizeId(payload?.recipientUserId);
  const role = normalizeRole(payload?.recipientRole);
  const academyId = normalizeId(payload?.academyId);

  if (!uid) return;

  emitToUserRooms(io, rooms, uid, role, "notification:new", payload);
  emitToUserRooms(io, rooms, uid, role, "notification:created", payload);

  void emitUnreadCount(source, {
    userId: uid,
    role,
    academyId,
  });
}

export function emitNotifications(source, notifications = []) {
  if (!Array.isArray(notifications) || !notifications.length) return;

  for (const item of notifications) {
    emitNotification(source, item);
  }
}

export function emitNotificationUpdated(source, notification) {
  const { io, rooms } = getSocketContext(source);
  if (!io || !notification) return;

  const payload = buildNotificationPayload(notification);
  const uid = normalizeId(payload?.recipientUserId);
  const role = normalizeRole(payload?.recipientRole);
  const academyId = normalizeId(payload?.academyId);

  if (!uid) return;

  emitToUserRooms(io, rooms, uid, role, "notification:updated", payload);
  emitToUserRooms(io, rooms, uid, role, "notification:update", payload);

  void emitUnreadCount(source, {
    userId: uid,
    role,
    academyId,
  });
}

export function emitNotificationRead(source, notification) {
  const { io, rooms } = getSocketContext(source);
  if (!io || !notification) return;

  const payload = buildNotificationPayload(notification);
  const uid = normalizeId(payload?.recipientUserId);
  const role = normalizeRole(payload?.recipientRole);
  const academyId = normalizeId(payload?.academyId);

  if (!uid) return;

  emitToUserRooms(io, rooms, uid, role, "notification:read", payload);
  emitToUserRooms(io, rooms, uid, role, "notification:updated", payload);

  void emitUnreadCount(source, {
    userId: uid,
    role,
    academyId,
  });
}

export function emitNotificationDeleted(source, notification) {
  const { io, rooms } = getSocketContext(source);
  if (!io || !notification) return;

  const payload = buildNotificationPayload(notification);
  const uid = normalizeId(payload?.recipientUserId);
  const role = normalizeRole(payload?.recipientRole);
  const academyId = normalizeId(payload?.academyId);

  if (!uid) return;

  const deletePayload = {
    id: payload.id,
    _id: payload.id,
    notificationId: payload.id,

    userId: uid,
    role,
    academyId: academyId || null,
  };

  emitToUserRooms(io, rooms, uid, role, "notification:deleted", deletePayload);
  emitToUserRooms(io, rooms, uid, role, "notification:delete", deletePayload);

  void emitUnreadCount(source, {
    userId: uid,
    role,
    academyId,
  });
}

/* =========================
 * COMPATIBILITY ALIASES
 * ========================= */

export const notifyUser = createAndEmitNotification;
export const notifyUsers = createAndEmitBulkNotifications;
