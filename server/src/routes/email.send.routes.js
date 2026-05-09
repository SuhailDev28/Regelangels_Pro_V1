import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import User from "../models/User.js";
import Participant from "../models/Participant.js";
import Event from "../models/Event.js";
import EventEnrollment from "../models/EventEnrollment.js";
import EmailLog from "../models/EmailLog.js";
import {
  sendTransactionalEmail,
  renderResolvedEmail,
} from "../services/email/emailService.js";

const router = express.Router();

function isValidObjectIdLike(v) {
  return /^[a-f\d]{24}$/i.test(String(v || "").trim());
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function uniqueEmails(list = []) {
  return [...new Set(normalizeArray(list).map((v) => v.toLowerCase()))];
}

function normalizeRole(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getScopedAcademyId(req) {
  const bodyId = req?.body?.academyId;
  const queryId = req?.query?.academyId;
  const headerId = req?.headers?.["x-academy-id"];

  if (req?.user?.role === "SUPER_ADMIN") {
    const picked = String(bodyId || queryId || headerId || "").trim();
    return picked || null;
  }

  return String(req?.academyId || req?.user?.academyId || "").trim() || null;
}

function normalizeObjectIdArray(values = []) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const raw =
      value && typeof value === "object" && value._id ? value._id : value;
    const str = String(raw || "").trim();

    if (!isValidObjectIdLike(str) || seen.has(str)) continue;
    seen.add(str);
    result.push(new mongoose.Types.ObjectId(str));
  }

  return result;
}

async function getUserEmailsByIds(userIds = [], extraQuery = {}) {
  const ids = normalizeObjectIdArray(userIds);
  if (!ids.length) return [];

  const users = await User.find({
    _id: { $in: ids },
    ...(extraQuery || {}),
  })
    .select("email")
    .lean();

  return uniqueEmails(users.map((u) => u?.email || ""));
}

function collectParticipantDirectEmails(participants = []) {
  return uniqueEmails(
    participants.flatMap((p) => [
      p?.email || "",
      p?.participantEmail || "",
      p?.parentEmail || "",
    ]),
  );
}

async function resolveEventRecipients({ academyId = null, eventId = "" }) {
  if (!eventId || !isValidObjectIdLike(eventId)) {
    throw new Error("eventId is required for event email");
  }

  const eventObjectId = new mongoose.Types.ObjectId(eventId);

  const enrollments = await EventEnrollment.find({
    eventId: eventObjectId,
    ...(academyId && isValidObjectIdLike(academyId)
      ? { academyId: new mongoose.Types.ObjectId(academyId) }
      : {}),
  })
    .select("participantId academyId")
    .lean();

  const participantIds = normalizeObjectIdArray(
    enrollments.map((e) => e?.participantId),
  );

  if (!participantIds.length) return [];

  const participantQuery = {
    _id: { $in: participantIds },
  };

  if (academyId && isValidObjectIdLike(academyId)) {
    participantQuery.academyId = new mongoose.Types.ObjectId(academyId);
  }

  const participants = await Participant.find(participantQuery)
    .select("email participantEmail parentEmail userId")
    .lean();

  const directEmails = collectParticipantDirectEmails(participants);
  const linkedUserEmails = await getUserEmailsByIds(
    participants.map((p) => p?.userId),
  );

  return uniqueEmails([...directEmails, ...linkedUserEmails]);
}

async function resolveRecipients({
  mode,
  emails = [],
  role = "",
  academyId = null,
  eventId = "",
}) {
  const explicitEmails = uniqueEmails(emails);
  const normalizedMode = String(mode || "")
    .trim()
    .toLowerCase();

  if (normalizedMode === "manual") {
    return explicitEmails;
  }

  if (normalizedMode === "role") {
    const normalizedRole = normalizeRole(role);

    if (!normalizedRole) {
      throw new Error("Recipient role is required");
    }

    const userQuery = { role: normalizedRole };

    if (academyId && isValidObjectIdLike(academyId)) {
      userQuery.academyId = new mongoose.Types.ObjectId(academyId);
    }

    const users = await User.find(userQuery).select("email").lean();
    return uniqueEmails(users.map((u) => u?.email || ""));
  }

  if (normalizedMode === "event") {
    return await resolveEventRecipients({ academyId, eventId });
  }

  if (normalizedMode === "all-parents") {
    const query =
      academyId && isValidObjectIdLike(academyId)
        ? { academyId: new mongoose.Types.ObjectId(academyId) }
        : {};

    const participants = await Participant.find(query)
      .select("parentEmail")
      .lean();

    return uniqueEmails(participants.map((p) => p?.parentEmail || ""));
  }

  if (normalizedMode === "all-participants") {
    const query =
      academyId && isValidObjectIdLike(academyId)
        ? { academyId: new mongoose.Types.ObjectId(academyId) }
        : {};

    const participants = await Participant.find(query)
      .select("email participantEmail userId")
      .lean();

    const directEmails = uniqueEmails(
      participants.flatMap((p) => [p?.email || "", p?.participantEmail || ""]),
    );

    const linkedUserEmails = await getUserEmailsByIds(
      participants.map((p) => p?.userId),
    );

    return uniqueEmails([...directEmails, ...linkedUserEmails]);
  }

  throw new Error("Invalid recipient mode");
}

/**
 * POST /api/email/send
 * Send single or small manual email
 * Roles: SUPER_ADMIN, ADMIN
 */
router.post(
  "/send",
  auth,
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const academyId = getScopedAcademyId(req);

      const {
        to = [],
        cc = [],
        bcc = [],
        subject = "",
        html = "",
        text = "",
        template = "",
        data = {},
      } = req.body || {};

      const toList = uniqueEmails(to);
      const ccList = uniqueEmails(cc);
      const bccList = uniqueEmails(bcc);
      const templateKey = String(template || "")
        .trim()
        .toLowerCase();

      if (!toList.length) {
        return res.status(400).json({
          ok: false,
          message: "At least one recipient is required",
        });
      }

      if (!templateKey && !String(subject || "").trim()) {
        return res.status(400).json({
          ok: false,
          message: "Subject is required",
        });
      }

      const result = await sendTransactionalEmail({
        to: toList,
        cc: ccList,
        bcc: bccList,
        template: templateKey,
        data: data || {},
        subject: String(subject || "").trim(),
        html: String(html || "").trim(),
        text: String(text || "").trim(),
        meta: {
          academyId: academyId || null,
          userId: req.user?._id || null,
          sentByRole: req.user?.role || null,
          mode: "manual",
        },
      });

      if (!result?.ok) {
        return res.status(400).json({
          ok: false,
          message: result?.error || "Email sending failed",
          logId: result?.logId || null,
          result,
        });
      }

      return res.json({
        ok: true,
        message: result?.skipped
          ? "Email skipped because email sending is disabled"
          : "Email sent successfully",
        logId: result?.logId || null,
        messageId: result?.messageId || "",
        skipped: !!result?.skipped,
        result,
      });
    } catch (error) {
      console.error("POST /email/send error:", error);
      return res.status(500).json({
        ok: false,
        message: error?.message || "Failed to send email",
      });
    }
  },
);

/**
 * POST /api/email/send-bulk
 * Send emails by recipient mode:
 * - manual
 * - role
 * - event
 * - all-parents
 * - all-participants
 * Roles: SUPER_ADMIN, ADMIN
 */
router.post(
  "/send-bulk",
  auth,
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const academyId = getScopedAcademyId(req);

      const {
        mode = "manual",
        emails = [],
        role = "",
        eventId = "",
        subject = "",
        html = "",
        text = "",
        template = "",
        data = {},
        cc = [],
        bcc = [],
        chunkSize = 50,
      } = req.body || {};

      const templateKey = String(template || "")
        .trim()
        .toLowerCase();

      if (!templateKey && !String(subject || "").trim()) {
        return res.status(400).json({
          ok: false,
          message: "Subject is required",
        });
      }

      const normalizedMode = String(mode || "manual")
        .trim()
        .toLowerCase();

      if (
        academyId &&
        normalizedMode === "event" &&
        eventId &&
        isValidObjectIdLike(eventId)
      ) {
        const foundEvent = await Event.findOne({
          _id: new mongoose.Types.ObjectId(eventId),
          ...(req.user?.role === "SUPER_ADMIN" || !academyId
            ? {}
            : { academyId: new mongoose.Types.ObjectId(academyId) }),
        })
          .select("_id academyId")
          .lean();

        if (!foundEvent) {
          return res.status(404).json({
            ok: false,
            message: "Event not found",
          });
        }
      }

      const recipients = await resolveRecipients({
        mode: normalizedMode,
        emails,
        role,
        academyId,
        eventId,
      });

      if (!recipients.length) {
        return res.status(400).json({
          ok: false,
          message: "No valid recipients found",
        });
      }

      const size = Math.min(200, Math.max(1, Number(chunkSize || 50)));
      const ccList = uniqueEmails(cc);
      const bccList = uniqueEmails(bcc);

      const chunks = [];
      for (let i = 0; i < recipients.length; i += size) {
        chunks.push(recipients.slice(i, i + size));
      }

      const results = [];
      for (const chunk of chunks) {
        const result = await sendTransactionalEmail({
          to: chunk,
          cc: ccList,
          bcc: bccList,
          template: templateKey,
          data: data || {},
          subject: String(subject || "").trim(),
          html: String(html || "").trim(),
          text: String(text || "").trim(),
          meta: {
            academyId: academyId || null,
            userId: req.user?._id || null,
            sentByRole: req.user?.role || null,
            mode: normalizedMode,
            role: normalizeRole(role),
            eventId: String(eventId || "").trim() || null,
            recipientCount: chunk.length,
          },
        });

        results.push(result);
      }

      const sentCount = results.filter((r) => r?.ok && !r?.skipped).length;
      const skippedCount = results.filter((r) => r?.skipped).length;
      const failedCount = results.filter((r) => !r?.ok).length;

      return res.status(failedCount > 0 ? 400 : 200).json({
        ok: failedCount === 0,
        message:
          failedCount === 0
            ? "Bulk email processed successfully"
            : results.find((r) => !r?.ok)?.error ||
              "Bulk email processed with some failures",
        summary: {
          totalRecipients: recipients.length,
          totalBatches: results.length,
          sentBatches: sentCount,
          skippedBatches: skippedCount,
          failedBatches: failedCount,
        },
        results,
      });
    } catch (error) {
      console.error("POST /email/send-bulk error:", error);
      return res.status(500).json({
        ok: false,
        message: error?.message || "Failed to send bulk email",
      });
    }
  },
);

/**
 * POST /api/email/preview
 * Preview email payload without sending
 * Roles: SUPER_ADMIN, ADMIN
 */
router.post(
  "/preview",
  auth,
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const academyId = getScopedAcademyId(req);
      const {
        subject = "",
        html = "",
        text = "",
        template = "",
        data = {},
      } = req.body || {};

      const templateKey = String(template || "")
        .trim()
        .toLowerCase();

      if (!templateKey && !String(subject || "").trim()) {
        return res.status(400).json({
          ok: false,
          message: "Subject is required",
        });
      }

      const preview = await renderResolvedEmail({
        template: templateKey,
        data: data || {},
        subject: String(subject || "").trim(),
        html: String(html || "").trim(),
        text: String(text || "").trim(),
        academyId: academyId || null,
      });

      return res.json({
        ok: true,
        preview,
      });
    } catch (error) {
      console.error("POST /email/preview error:", error);
      return res.status(500).json({
        ok: false,
        message: error?.message || "Failed to preview email",
      });
    }
  },
);

/**
 * GET /api/email/history-summary
 * Lightweight dashboard counts from logs
 * Roles: SUPER_ADMIN, ADMIN
 */
router.get(
  "/history-summary",
  auth,
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const academyId = getScopedAcademyId(req);
      const match =
        academyId && isValidObjectIdLike(academyId)
          ? { academyId: new mongoose.Types.ObjectId(academyId) }
          : {};

      const [total, sent, failed, skipped, pending] = await Promise.all([
        EmailLog.countDocuments(match),
        EmailLog.countDocuments({ ...match, status: "SENT" }),
        EmailLog.countDocuments({ ...match, status: "FAILED" }),
        EmailLog.countDocuments({ ...match, status: "SKIPPED" }),
        EmailLog.countDocuments({ ...match, status: "PENDING" }),
      ]);

      return res.json({
        ok: true,
        stats: {
          total,
          sent,
          failed,
          skipped,
          pending,
          queued: pending,
        },
      });
    } catch (error) {
      console.error("GET /email/history-summary error:", error);
      return res.status(500).json({
        ok: false,
        message: error?.message || "Failed to load email summary",
      });
    }
  },
);

export default router;
