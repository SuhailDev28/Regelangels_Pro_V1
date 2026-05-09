import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";

import User from "../models/User.js";
import Notification from "../models/Notification.js";
import {
  createAndEmitNotification,
  createAndEmitBulkNotifications,
  buildNotificationPayload,
} from "../services/notification.service.js";

const router = express.Router();

router.use(auth);

/* =========================
 * HELPERS
 * ========================= */

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

const ALLOWED_RECIPIENT_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "JUDGE",
  "PARENT",
  "PARTICIPANT",
];

const ADMIN_NOTIFICATION_SOURCES = ["ADMIN_SEND", "ADMIN_BROADCAST"];

function normalizeId(v) {
  return String(v || "").trim();
}

function normalizeUpper(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function isValidObjectId(v) {
  return mongoose.Types.ObjectId.isValid(String(v || ""));
}

function toObjectId(id) {
  const safeId = normalizeId(id);
  if (!safeId || !isValidObjectId(safeId)) return null;
  return new mongoose.Types.ObjectId(safeId);
}

function getCurrentUserId(req) {
  return normalizeId(req.user?._id || req.user?.id || req.user?.userId || "");
}

function getCurrentRole(req) {
  return normalizeUpper(req.user?.role || "");
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

function parseString(v, fallback = "") {
  const s = String(v || "").trim();
  return s || fallback;
}

function parseType(v, fallback = "SYSTEM_MESSAGE") {
  const s = normalizeUpper(v);
  return s || fallback;
}

function parseTypeFilter(v) {
  return normalizeUpper(v);
}

function parseOptionalObjectId(v) {
  const id = normalizeId(v);
  if (!id) return "";
  return isValidObjectId(id) ? id : "";
}

function parseOptionalEmail(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function parseBoolean(v, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v === undefined || v === null || v === "") return fallback;

  const s = String(v).trim().toLowerCase();

  if (["true", "1", "yes"].includes(s)) return true;
  if (["false", "0", "no"].includes(s)) return false;

  return fallback;
}

function parsePositiveInt(v, fallback, min = 1, max = 100) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

function normalizeCategory(v) {
  const x = normalizeUpper(v);
  return ALLOWED_CATEGORIES.includes(x) ? x : "SYSTEM";
}

function normalizePriority(v) {
  const x = normalizeUpper(v);
  return ALLOWED_PRIORITIES.includes(x) ? x : "NORMAL";
}

function parseCategoryFilter(v) {
  const x = normalizeUpper(v);
  return ALLOWED_CATEGORIES.includes(x) ? x : "";
}

function parsePriorityFilter(v) {
  const x = normalizeUpper(v);
  return ALLOWED_PRIORITIES.includes(x) ? x : "";
}

function normalizeRecipientRole(v) {
  const x = normalizeUpper(v);
  return ALLOWED_RECIPIENT_ROLES.includes(x) ? x : "";
}

function cleanMeta(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function ensureAdminAccess(req, res) {
  const role = getCurrentRole(req);

  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return true;
  }

  res.status(403).json({
    ok: false,
    success: false,
    message: "Forbidden",
  });

  return false;
}

function sameId(a, b) {
  return normalizeId(a) === normalizeId(b);
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapItem(row) {
  return buildNotificationPayload(row);
}

/* =========================
 * POST /api/admin/notifications/send
 * Send one notification to one specific user
 * Supports recipientUserId OR recipientEmail
 * ========================= */

router.post("/send", async (req, res) => {
  try {
    if (!ensureAdminAccess(req, res)) return;

    const createdByUserId = getCurrentUserId(req);
    const createdByRole = getCurrentRole(req);
    const currentAcademyId = getCurrentAcademyId(req);

    if (!createdByUserId) {
      return res.status(401).json({
        ok: false,
        success: false,
        message: "Unauthorized",
      });
    }

    const requestedRecipientUserId = parseOptionalObjectId(
      req.body?.recipientUserId,
    );

    const recipientEmail = parseOptionalEmail(req.body?.recipientEmail);

    const requestedRecipientRole = normalizeRecipientRole(
      req.body?.recipientRole,
    );

    const requestedAcademyId = parseOptionalObjectId(req.body?.academyId);

    const title = parseString(req.body?.title);
    const message = parseString(req.body?.message);
    const type = parseType(req.body?.type, "ADMIN_MESSAGE");
    const category = normalizeCategory(req.body?.category);
    const priority = normalizePriority(req.body?.priority);
    const actionUrl = parseString(req.body?.actionUrl);
    const meta = cleanMeta(req.body?.meta || req.body?.metadata);

    if (!requestedRecipientUserId && !recipientEmail) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "recipientUserId or recipientEmail is required",
      });
    }

    if (!title) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Title is required",
      });
    }

    if (!message) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Message is required",
      });
    }

    let user = null;

    if (requestedRecipientUserId) {
      user = await User.findById(toObjectId(requestedRecipientUserId))
        .select("_id role academyId isActive email")
        .lean();
    } else if (recipientEmail) {
      user = await User.findOne({ email: recipientEmail })
        .select("_id role academyId isActive email")
        .lean();
    }

    if (!user || user.isActive === false) {
      return res.status(404).json({
        ok: false,
        success: false,
        message: "Recipient user not found",
      });
    }

    const finalRecipientUserId = normalizeId(user?._id);

    const finalRecipientRole =
      requestedRecipientRole || normalizeRecipientRole(user?.role);

    if (!finalRecipientUserId) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Valid recipient user could not be resolved",
      });
    }

    if (!finalRecipientRole) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Valid recipientRole is required",
      });
    }

    const recipientAcademyId = normalizeId(
      user?.academyId?._id || user?.academyId || "",
    );

    let academyId =
      requestedAcademyId || recipientAcademyId || currentAcademyId || "";

    if (createdByRole === "ADMIN") {
      if (
        currentAcademyId &&
        recipientAcademyId &&
        !sameId(currentAcademyId, recipientAcademyId)
      ) {
        return res.status(403).json({
          ok: false,
          success: false,
          message: "You cannot notify users from another academy",
        });
      }

      academyId = currentAcademyId || recipientAcademyId || "";
    }
    const notification = await createAndEmitNotification(req, {
      academyId: academyId || null,
      recipientUserId: finalRecipientUserId,
      recipientRole: finalRecipientRole,
      type,
      category,
      priority,
      title,
      message,
      actionUrl,
      meta: {
        ...meta,
        source: "ADMIN_SEND",
        createdByRole,
        recipientEmail: user?.email || recipientEmail || "",
      },
      createdByUserId,
    });
    const item = mapItem(notification);

    return res.status(201).json({
      ok: true,
      success: true,
      item,
      notification: item,
      message: "Notification sent successfully",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: err?.message || "Failed to send notification",
    });
  }
});

/* =========================
 * POST /api/admin/notifications/broadcast
 * Broadcast by role or selected users
 * ========================= */

router.post("/broadcast", async (req, res) => {
  try {
    if (!ensureAdminAccess(req, res)) return;

    const createdByUserId = getCurrentUserId(req);
    const createdByRole = getCurrentRole(req);
    const currentAcademyId = getCurrentAcademyId(req);

    if (!createdByUserId) {
      return res.status(401).json({
        ok: false,
        success: false,
        message: "Unauthorized",
      });
    }

    const requestedAcademyId = parseOptionalObjectId(req.body?.academyId);
    const recipientRole = normalizeRecipientRole(req.body?.recipientRole);
    const includeSender = parseBoolean(req.body?.includeSender, false);

    let academyId = requestedAcademyId || currentAcademyId || "";

    if (createdByRole === "ADMIN") {
      academyId = currentAcademyId || "";
    }

    const recipientUserIds = Array.isArray(req.body?.recipientUserIds)
      ? [
          ...new Set(
            req.body.recipientUserIds
              .map(parseOptionalObjectId)
              .filter(Boolean),
          ),
        ]
      : [];

    const title = parseString(req.body?.title);
    const message = parseString(req.body?.message);
    const type = parseType(req.body?.type, "ADMIN_BROADCAST");
    const category = normalizeCategory(req.body?.category);
    const priority = normalizePriority(req.body?.priority);
    const actionUrl = parseString(req.body?.actionUrl);
    const meta = cleanMeta(req.body?.meta || req.body?.metadata);

    if (!title) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Title is required",
      });
    }

    if (!message) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Message is required",
      });
    }

    if (!recipientRole && recipientUserIds.length === 0) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "Provide recipientRole or recipientUserIds for broadcast",
      });
    }

    let recipients = [];

    if (recipientUserIds.length > 0) {
      const filter = {
        _id: {
          $in: recipientUserIds.map(toObjectId).filter(Boolean),
        },
        isActive: true,
      };

      if (academyId) {
        filter.academyId = toObjectId(academyId);
      }

      recipients = await User.find(filter)
        .select("_id role academyId isActive email")
        .lean();
    } else {
      const filter = {
        role: recipientRole,
        isActive: true,
      };

      if (academyId) {
        filter.academyId = toObjectId(academyId);
      }

      recipients = await User.find(filter)
        .select("_id role academyId isActive email")
        .lean();
    }

    if (!includeSender) {
      recipients = recipients.filter((u) => !sameId(u?._id, createdByUserId));
    }

    if (!recipients.length) {
      return res.status(404).json({
        ok: false,
        success: false,
        message: "No recipients found",
      });
    }

    const items = recipients
      .map((user) => {
        const userId = normalizeId(user?._id);
        const userRole = normalizeRecipientRole(user?.role);
        const userAcademyId = normalizeId(
          user?.academyId?._id || user?.academyId || "",
        );

        if (!userId || !userRole) return null;

        return {
          academyId: userAcademyId || academyId || null,
          recipientUserId: userId,
          recipientRole: userRole,
          type,
          category,
          priority,
          title,
          message,
          actionUrl,
          meta: {
            ...meta,
            source: "ADMIN_BROADCAST",
            createdByRole,
            recipientEmail: user?.email || "",
          },
          createdByUserId,
        };
      })
      .filter(Boolean);

    if (!items.length) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: "No valid recipients found for broadcast",
      });
    }

    const notifications = await createAndEmitBulkNotifications(req, items);
    const mapped = notifications.map(mapItem).filter(Boolean);

    return res.status(201).json({
      ok: true,
      success: true,
      count: mapped.length,
      items: mapped,
      notifications: mapped,
      message: "Broadcast sent successfully",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: err?.message || "Failed to broadcast notification",
    });
  }
});

/* =========================
 * GET /api/admin/notifications/history
 * History of admin-created notifications
 * ========================= */

router.get("/history", async (req, res) => {
  try {
    if (!ensureAdminAccess(req, res)) return;

    const currentUserId = getCurrentUserId(req);
    const currentRole = getCurrentRole(req);
    const currentAcademyId = getCurrentAcademyId(req);

    const page = parsePositiveInt(req.query.page, 1, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, 20, 1, 100);
    const skip = (page - 1) * limit;

    const category = parseCategoryFilter(req.query.category);
    const priority = parsePriorityFilter(req.query.priority);
    const recipientRole = normalizeRecipientRole(req.query.recipientRole);
    const type = parseTypeFilter(req.query.type);
    const onlyMine = parseBoolean(req.query.onlyMine, false);

    const filter = {
      "meta.source": { $in: ADMIN_NOTIFICATION_SOURCES },
    };

    if (currentRole === "ADMIN") {
      if (currentAcademyId) {
        filter.academyId = toObjectId(currentAcademyId);
      }
    } else {
      const requestedAcademyId = parseOptionalObjectId(req.query.academyId);

      if (requestedAcademyId) {
        filter.academyId = toObjectId(requestedAcademyId);
      }
    }

    if (category) {
      filter.category = category;
    }

    if (priority) {
      filter.priority = priority;
    }

    if (recipientRole) {
      filter.recipientRole = recipientRole;
    }

    if (type) {
      filter.type = type;
    }

    if (onlyMine && currentUserId) {
      filter.createdByUserId = toObjectId(currentUserId);
    }

    const q = String(req.query.q || req.query.search || "").trim();

    if (q) {
      const safeQ = escapeRegex(q);

      filter.$or = [
        {
          title: {
            $regex: safeQ,
            $options: "i",
          },
        },
        {
          message: {
            $regex: safeQ,
            $options: "i",
          },
        },
        {
          type: {
            $regex: safeQ,
            $options: "i",
          },
        },
      ];
    }

    const [total, rows] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const items = rows.map(mapItem).filter(Boolean);
    const pages = Math.max(Math.ceil(Number(total || 0) / limit), 1);

    return res.json({
      ok: true,
      success: true,
      items,
      notifications: items,
      total: Number(total || 0),
      page,
      limit,
      pages,
      totalPages: pages,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      message: err?.message || "Failed to load notification history",
    });
  }
});

export default router;
