import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import {
  listUserNotifications,
  getUserUnreadNotificationCount,
  markUserNotificationRead,
  markUserNotificationUnread,
  markAllUserNotificationsRead,
  bulkReadUserNotifications,
  deleteUserNotification,
  emitNotificationRead,
  emitNotificationUpdated,
  emitNotificationDeleted,
  emitUserUnreadCount,
} from "../services/notification.service.js";

const router = express.Router();

router.use(auth);

/* =========================
 * HELPERS
 * ========================= */

function normalizeId(v) {
  return String(v || "").trim();
}

function normalizeRole(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function isValidObjectId(v) {
  return mongoose.Types.ObjectId.isValid(String(v || ""));
}

function getCurrentUserId(req) {
  return normalizeId(req.user?._id || req.user?.id || req.user?.userId || "");
}

function getCurrentRole(req) {
  return normalizeRole(req.user?.role || "");
}

function getCurrentAcademyId(req) {
  return normalizeId(
    req.academyId ||
      req.headers?.["x-academy-id"] ||
      req.user?.academyId?._id ||
      req.user?.academyId?.id ||
      req.user?.academy?._id ||
      req.user?.academy?.id ||
      req.user?.academyId ||
      req.user?.academy ||
      "",
  );
}

function parseBooleanQuery(v) {
  if (v === undefined || v === null || v === "") return undefined;

  const s = String(v).trim().toLowerCase();

  if (["true", "1", "yes"].includes(s)) return true;
  if (["false", "0", "no"].includes(s)) return false;

  return undefined;
}

function mapNotificationItem(row) {
  if (!row) return null;

  const id = row?.id || row?._id || null;

  const academyId =
    row?.academyId?._id || row?.academyId?.id || row?.academyId || null;

  const recipientUserId =
    row?.recipientUserId?._id ||
    row?.recipientUserId?.id ||
    row?.recipientUserId ||
    row?.userId ||
    null;

  const createdByUserId =
    row?.createdByUserId?._id ||
    row?.createdByUserId?.id ||
    row?.createdByUserId ||
    null;

  return {
    _id: id ? String(id) : null,
    id: id ? String(id) : null,

    academyId: academyId ? String(academyId) : null,

    userId: recipientUserId ? String(recipientUserId) : null,
    recipientUserId: recipientUserId ? String(recipientUserId) : null,

    role: normalizeRole(row?.recipientRole || row?.role || ""),
    recipientRole: normalizeRole(row?.recipientRole || row?.role || ""),

    title: String(row?.title || "").trim(),
    message: String(row?.message || "").trim(),

    type: String(row?.type || "SYSTEM")
      .trim()
      .toUpperCase(),
    category: String(row?.category || "SYSTEM")
      .trim()
      .toUpperCase(),
    priority: String(row?.priority || "NORMAL")
      .trim()
      .toUpperCase(),
    isRead: Boolean(row?.isRead),
    read: Boolean(row?.isRead),
    readAt: row?.readAt || null,

    actionUrl: String(row?.actionUrl || "").trim(),

    meta: row?.meta && typeof row.meta === "object" ? row.meta : {},
    metadata: row?.meta && typeof row.meta === "object" ? row.meta : {},

    createdByUserId: createdByUserId ? String(createdByUserId) : null,

    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || null,
  };
}

function getRequestScope(req) {
  const userId = getCurrentUserId(req);
  const role = getCurrentRole(req);
  const academyId = getCurrentAcademyId(req);

  return {
    userId,
    role,
    academyId: academyId || null,
  };
}

function ensureAuthorized(req, res) {
  const scope = getRequestScope(req);

  if (!scope.userId || !scope.role) {
    res.status(401).json({
      ok: false,
      success: false,
      message: "Unauthorized",
    });
    return null;
  }

  return scope;
}

async function handleMarkAllRead(req, res) {
  try {
    const scope = ensureAuthorized(req, res);
    if (!scope) return;

    const result = await markAllUserNotificationsRead(scope);

    await emitUserUnreadCount(req, scope);

    return res.json({
      ok: true,
      success: true,
      message: "All notifications marked as read",
      matched: Number(result?.matched || result?.matchedCount || 0),
      modified: Number(result?.modified || result?.modifiedCount || 0),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: err?.message || "Failed to mark all notifications as read",
    });
  }
}

/* =========================
 * GET /api/notifications
 * ========================= */

router.get("/", async (req, res) => {
  try {
    const scope = ensureAuthorized(req, res);
    if (!scope) return;

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);

    const isRead = parseBooleanQuery(req.query.isRead);
    const unreadOnly =
      isRead === false ||
      String(req.query.unreadOnly || "")
        .trim()
        .toLowerCase() === "true" ||
      String(req.query.unreadOnly || "").trim() === "1";

    const result = await listUserNotifications({
      ...scope,
      page,
      limit,
      unreadOnly,
      isRead,
      category: String(req.query.category || "").trim(),
      type: String(req.query.type || "").trim(),
      q: String(req.query.q || req.query.search || "").trim(),
    });

    const items = Array.isArray(result?.items)
      ? result.items.map(mapNotificationItem).filter(Boolean)
      : [];

    const total = Number(result?.total || 0);
    const unread = Number(result?.unread || result?.unreadCount || 0);
    const pages = Number(result?.pages || result?.totalPages || 1);

    return res.json({
      ok: true,
      success: true,

      notifications: items,
      items,

      total,
      unread,
      unreadCount: unread,

      page: Number(result?.page || page),
      limit: Number(result?.limit || limit),
      pages,
      totalPages: pages,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: err?.message || "Failed to load notifications",
    });
  }
});

/* =========================
 * GET /api/notifications/unread-count
 * ========================= */

router.get("/unread-count", async (req, res) => {
  try {
    const scope = ensureAuthorized(req, res);
    if (!scope) return;

    const result = await getUserUnreadNotificationCount(scope);
    const unread = Number(result?.unread || result?.unreadCount || 0);

    return res.json({
      ok: true,
      success: true,
      unread,
      unreadCount: unread,
      count: unread,
      totalUnread: unread,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: err?.message || "Failed to load unread count",
    });
  }
});

/* =========================
 * PATCH /api/notifications/read-all
 * ========================= */

router.patch("/read-all", handleMarkAllRead);

/* =========================
 * PATCH /api/notifications/mark-all-read
 * Alias for frontend compatibility
 * ========================= */

router.patch("/mark-all-read", handleMarkAllRead);

/* =========================
 * PATCH /api/notifications/bulk-read
 * ========================= */

router.patch("/bulk-read", async (req, res) => {
  try {
    const scope = ensureAuthorized(req, res);
    if (!scope) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];

    const validIds = [
      ...new Set(
        ids
          .map((id) => normalizeId(id))
          .filter((id) => id && isValidObjectId(id)),
      ),
    ];

    if (!validIds.length) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "No valid notification ids provided",
      });
    }

    const result = await bulkReadUserNotifications({
      ids: validIds,
      ...scope,
    });

    await emitUserUnreadCount(req, scope);

    return res.json({
      ok: true,
      success: true,
      message: "Selected notifications marked as read",
      matched: Number(result?.matched || result?.matchedCount || 0),
      modified: Number(result?.modified || result?.modifiedCount || 0),
      ids: validIds,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: err?.message || "Failed to bulk mark notifications as read",
    });
  }
});

/* =========================
 * PATCH /api/notifications/:id/read
 * ========================= */

router.patch("/:id/read", async (req, res) => {
  try {
    const scope = ensureAuthorized(req, res);
    if (!scope) return;

    const notificationId = normalizeId(req.params.id);

    if (!isValidObjectId(notificationId)) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Invalid notification id",
      });
    }

    const updated = await markUserNotificationRead({
      notificationId,
      ...scope,
    });

    if (!updated) {
      return res.status(404).json({
        ok: false,
        success: false,
        message: "Notification not found",
      });
    }

    emitNotificationRead(req, updated);

    const item = mapNotificationItem(updated);

    return res.json({
      ok: true,
      success: true,
      message: "Notification marked as read",
      item,
      notification: item,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: err?.message || "Failed to mark notification as read",
    });
  }
});

/* =========================
 * PATCH /api/notifications/:id/unread
 * ========================= */

router.patch("/:id/unread", async (req, res) => {
  try {
    const scope = ensureAuthorized(req, res);
    if (!scope) return;

    const notificationId = normalizeId(req.params.id);

    if (!isValidObjectId(notificationId)) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Invalid notification id",
      });
    }

    const updated = await markUserNotificationUnread({
      notificationId,
      ...scope,
    });

    if (!updated) {
      return res.status(404).json({
        ok: false,
        success: false,
        message: "Notification not found",
      });
    }

    emitNotificationUpdated(req, updated);

    const item = mapNotificationItem(updated);

    return res.json({
      ok: true,
      success: true,
      message: "Notification marked as unread",
      item,
      notification: item,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: err?.message || "Failed to mark notification as unread",
    });
  }
});

/* =========================
 * DELETE /api/notifications/:id
 * ========================= */

router.delete("/:id", async (req, res) => {
  try {
    const scope = ensureAuthorized(req, res);
    if (!scope) return;

    const notificationId = normalizeId(req.params.id);

    if (!isValidObjectId(notificationId)) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Invalid notification id",
      });
    }

    const deleted = await deleteUserNotification({
      notificationId,
      ...scope,
    });

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        success: false,
        message: "Notification not found",
      });
    }

    emitNotificationDeleted(req, deleted);

    const item = mapNotificationItem(deleted);

    return res.json({
      ok: true,
      success: true,
      message: "Notification deleted",
      deleted: item?.id || notificationId,
      notificationId: item?.id || notificationId,
      item,
      notification: item,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: err?.message || "Failed to delete notification",
    });
  }
});

export default router;
