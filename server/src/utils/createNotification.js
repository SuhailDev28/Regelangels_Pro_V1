import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import {
  emitNotificationToAcademyRole,
  emitNotificationToUser,
} from "./notificationSocket.js";

function normalizeRole(role = "") {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function normalizePriority(priority = "") {
  const v = String(priority || "")
    .trim()
    .toUpperCase();

  if (["LOW", "MEDIUM", "HIGH", "EMERGENCY"].includes(v)) return v;
  return "MEDIUM";
}

function toClientDoc(doc) {
  return {
    id: doc._id?.toString?.() || String(doc._id || ""),
    title: doc.title || "",
    message: doc.message || "",
    type: doc.type || "SYSTEM",
    role: doc.role || "",
    userId: doc.userId?._id?.toString?.() || doc.userId?.toString?.() || null,
    academyId:
      doc.academyId?._id?.toString?.() || doc.academyId?.toString?.() || null,
    read: Boolean(doc.read),
    priority: doc.priority || "MEDIUM",
    meta: doc.meta || {},
    readAt: doc.readAt || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

export async function createNotification({
  title,
  message,
  type = "SYSTEM",
  role,
  userId = null,
  academyId,
  priority = "MEDIUM",
  meta = {},
}) {
  if (!title) throw new Error("Notification title is required");
  if (!message) throw new Error("Notification message is required");
  if (!academyId) throw new Error("Notification academyId is required");
  if (!role) throw new Error("Notification role is required");

  const payload = {
    title: String(title).trim(),
    message: String(message).trim(),
    type: String(type || "SYSTEM")
      .trim()
      .toUpperCase(),
    role: normalizeRole(role),
    academyId: new mongoose.Types.ObjectId(String(academyId)),
    priority: normalizePriority(priority),
    meta: meta || {},
  };

  if (userId) {
    payload.userId = new mongoose.Types.ObjectId(String(userId));
  }

  const doc = await Notification.create(payload);
  const populated = await Notification.findById(doc._id).lean();
  const clientDoc = toClientDoc(populated);

  if (userId) {
    emitNotificationToUser(String(userId), clientDoc);
  } else {
    emitNotificationToAcademyRole(
      String(academyId),
      normalizeRole(role),
      clientDoc,
    );
  }

  return clientDoc;
}
