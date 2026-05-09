import mongoose from "mongoose";
import Notification from "../models/Notification.js";

function normalizeId(value) {
  return String(value || "").trim();
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function toObjectId(id) {
  return new mongoose.Types.ObjectId(String(id));
}

function normalizeRole(role) {
  const x = String(role || "")
    .trim()
    .toUpperCase();

  if (["SUPER_ADMIN", "ADMIN", "JUDGE", "PARENT"].includes(x)) return x;
  return "PARENT";
}

function buildPayload(notificationDoc = {}) {
  const academyId =
    notificationDoc.academyId?._id?.toString?.() ||
    notificationDoc.academyId?.toString?.() ||
    "";

  const userId =
    notificationDoc.userId?._id?.toString?.() ||
    notificationDoc.userId?.toString?.() ||
    "";

  const parentUserId =
    notificationDoc.parentUserId?._id?.toString?.() ||
    notificationDoc.parentUserId?.toString?.() ||
    "";

  const role = normalizeRole(notificationDoc.role || "PARENT");

  return {
    _id: notificationDoc._id?.toString?.() || null,
    id: notificationDoc._id?.toString?.() || null,
    academyId: academyId || null,
    userId: userId || null,
    parentUserId: parentUserId || null,
    role,
    title: notificationDoc.title || "",
    message: notificationDoc.message || "",
    type: notificationDoc.type || "SYSTEM",
    priority: notificationDoc.priority || "MEDIUM",
    isRead: !!notificationDoc.isRead,
    readAt: notificationDoc.readAt || null,
    actionUrl: notificationDoc.actionUrl || "",
    meta: notificationDoc.meta || {},
    createdAt: notificationDoc.createdAt || null,
    updatedAt: notificationDoc.updatedAt || null,
  };
}

export function buildNotificationRoom({ role, academyId, userId }) {
  const r = normalizeRole(role);
  const a = normalizeId(academyId);
  const u = normalizeId(userId);

  if (!a) return "";
  if (u) return `notifications:${r}:${a}:${u}`;
  return `notifications:${r}:${a}`;
}

export function emitNotificationToUser(io, notificationDoc = {}) {
  if (!io || !notificationDoc) return;

  const payload = buildPayload(notificationDoc);
  const academyId = normalizeId(payload.academyId);
  const role = normalizeRole(payload.role);

  const targetUserIds = [
    normalizeId(payload.userId),
    normalizeId(payload.parentUserId),
  ].filter(Boolean);

  const uniqueUserIds = [...new Set(targetUserIds)];

  if (!academyId) return;

  if (!uniqueUserIds.length) {
    const roleRoom = buildNotificationRoom({ role, academyId });
    if (roleRoom) {
      io.to(roleRoom).emit("notification:new", payload);
    }
    return;
  }

  for (const uid of uniqueUserIds) {
    const room = buildNotificationRoom({
      role,
      academyId,
      userId: uid,
    });

    if (!room) continue;

    io.to(room).emit("notification:new", payload);
    io.to(room).emit("notification:badge", {
      academyId,
      role,
      userId: uid,
      unreadDelta: 1,
    });
  }
}

export async function emitUnreadCount(io, { academyId, role, userId }) {
  if (!io) return;

  const safeAcademyId = normalizeId(academyId);
  const safeUserId = normalizeId(userId);
  const safeRole = normalizeRole(role);

  if (!safeAcademyId || !safeUserId) return;
  if (!isValidObjectId(safeAcademyId) || !isValidObjectId(safeUserId)) return;

  const unreadCount = await Notification.countDocuments({
    academyId: toObjectId(safeAcademyId),
    role: safeRole,
    isRead: false,
    $or: [
      { userId: toObjectId(safeUserId) },
      { parentUserId: toObjectId(safeUserId) },
    ],
  });

  const room = buildNotificationRoom({
    role: safeRole,
    academyId: safeAcademyId,
    userId: safeUserId,
  });

  if (!room) return;

  io.to(room).emit("notification:unread-count", {
    academyId: safeAcademyId,
    role: safeRole,
    userId: safeUserId,
    unreadCount: Number(unreadCount || 0),
  });
}

export async function emitUnreadCountForNotification(io, notificationDoc = {}) {
  if (!io || !notificationDoc) return;

  const academyId =
    notificationDoc.academyId?._id?.toString?.() ||
    notificationDoc.academyId?.toString?.() ||
    "";

  const role = normalizeRole(notificationDoc.role);

  const targetUserIds = [
    notificationDoc.userId?._id?.toString?.() ||
      notificationDoc.userId?.toString?.() ||
      "",
    notificationDoc.parentUserId?._id?.toString?.() ||
      notificationDoc.parentUserId?.toString?.() ||
      "",
  ].filter(Boolean);

  const uniqueUserIds = [...new Set(targetUserIds)];

  for (const uid of uniqueUserIds) {
    await emitUnreadCount(io, {
      academyId,
      role,
      userId: uid,
    });
  }
}
