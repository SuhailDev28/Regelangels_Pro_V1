import express from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

import Participant from "../models/Participant.js";
import Score from "../models/Score.js";
import Award from "../models/Award.js";
import Certificate from "../models/Certificate.js";
import Event from "../models/Event.js";
import EventEnrollment from "../models/EventEnrollment.js";

import {
  listUserNotifications,
  getUserUnreadNotificationCount,
  markUserNotificationRead,
  markAllUserNotificationsRead,
  deleteUserNotification,
  emitNotificationRead,
  emitNotificationDeleted,
  emitUserUnreadCount,
} from "../services/notification.service.js";

import {
  buildCertificatePdf,
  buildCertificateOverlayPdf,
  pdfkitToBuffer,
  mergeTemplateWithOverlay,
} from "../utils/certificatePdf.js";

const router = express.Router();

router.use(auth, requireRole("PARTICIPANT"));

function normalizeMsg(err, fallback = "Something went wrong") {
  return (
    err?.response?.data?.message ||
    err?.message ||
    (typeof err === "string" ? err : "") ||
    fallback
  );
}

function toObjectId(v) {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
}

function safeExists(p) {
  try {
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
}

function uniquePaths(list = []) {
  return [
    ...new Set(
      list
        .filter(Boolean)
        .map((x) => String(x).trim())
        .filter(Boolean),
    ),
  ];
}

function expandPathCandidates(rawValue) {
  const s = String(rawValue || "").trim();
  if (!s) return [];

  if (path.isAbsolute(s)) return [s];

  return uniquePaths([
    path.resolve(process.cwd(), s),
    path.resolve(process.cwd(), "uploads", s),
    path.resolve(process.cwd(), "uploads", "certificates", s),
    path.resolve(process.cwd(), "uploads", "cert-template", s),
    path.resolve(process.cwd(), "public", s),
  ]);
}

async function findParticipantForUser(userId) {
  if (!userId) return null;

  return Participant.findOne({ userId })
    .populate("userId", "name email phone createdAt role")
    .populate("groupId", "name level activities")
    .populate(
      "academyId",
      "name certificateTemplate certificateTemplateUrl certificateTemplatePath certificateLayout signatory",
    )
    .populate("eventId", "name date startDate endDate venue academyId")
    .sort({ createdAt: -1 });
}

async function resolveParticipantEvent(participant) {
  if (!participant) return null;

  if (participant?.eventId?._id) {
    return participant.eventId;
  }

  const enrollment = await EventEnrollment.findOne({
    participantId: participant._id,
  })
    .sort({ createdAt: -1 })
    .lean()
    .catch(() => null);

  if (!enrollment?.eventId) return null;

  const event = await Event.findById(enrollment.eventId)
    .select("name date startDate endDate venue academyId")
    .lean()
    .catch(() => null);

  return event || null;
}

async function getParticipantRank(participant, eventId = null) {
  if (!participant?._id || !participant?.groupId?._id) return null;

  const match = {
    "participant.groupId": participant.groupId._id,
  };

  if (eventId && mongoose.Types.ObjectId.isValid(String(eventId))) {
    match.eventId = new mongoose.Types.ObjectId(String(eventId));
  }

  const rows = await Score.aggregate([
    {
      $lookup: {
        from: "participants",
        localField: "participantId",
        foreignField: "_id",
        as: "participant",
      },
    },
    { $unwind: "$participant" },
    {
      $match: match,
    },
    {
      $group: {
        _id: "$participantId",
        total: { $sum: { $toDouble: "$value" } },
      },
    },
    { $sort: { total: -1, _id: 1 } },
  ]);

  const idx = rows.findIndex((r) => String(r._id) === String(participant._id));
  return idx >= 0 ? idx + 1 : null;
}

function resolvePossibleTemplatePaths(participant, certificateDoc) {
  const explicitCandidates = [
    certificateDoc?.templatePath,
    certificateDoc?.pdfTemplatePath,
    certificateDoc?.templateFile,
    certificateDoc?.templateUrl,

    certificateDoc?.meta?.templatePath,
    certificateDoc?.meta?.pdfTemplatePath,
    certificateDoc?.meta?.templateFile,
    certificateDoc?.meta?.templateUrl,

    participant?.academyId?.certificateTemplatePath,
    participant?.academyId?.certificateTemplateUrl,
    participant?.academyId?.certificateTemplate,
  ].filter(Boolean);

  const expandedExplicit = explicitCandidates.flatMap(expandPathCandidates);

  const commonTemplatePaths = [
    path.resolve(process.cwd(), "uploads", "certificate-template.pdf"),
    path.resolve(process.cwd(), "uploads", "template.pdf"),
    path.resolve(
      process.cwd(),
      "uploads",
      "cert-template",
      "certificate-template.pdf",
    ),
    path.resolve(process.cwd(), "uploads", "cert-template", "template.pdf"),
    path.resolve(
      process.cwd(),
      "uploads",
      "certificates",
      "certificate-template.pdf",
    ),
    path.resolve(process.cwd(), "uploads", "certificates", "template.pdf"),
    path.resolve(process.cwd(), "public", "certificate-template.pdf"),
  ];

  return uniquePaths([...expandedExplicit, ...commonTemplatePaths]).filter(
    (p) => p.toLowerCase().endsWith(".pdf"),
  );
}

async function loadExistingCertificateBuffer(certificateDoc) {
  const candidates = [
    certificateDoc?.filePath,
    certificateDoc?.pdfPath,
    certificateDoc?.path,
    certificateDoc?.url,

    certificateDoc?.meta?.filePath,
    certificateDoc?.meta?.pdfPath,
    certificateDoc?.meta?.path,
    certificateDoc?.meta?.url,
  ].filter(Boolean);

  for (const item of candidates) {
    const possible = expandPathCandidates(item);
    for (const p of possible) {
      if (safeExists(p)) {
        return fs.readFileSync(p);
      }
    }
  }

  return null;
}

function buildVerificationUrl(req, tokenOrSerial) {
  const origin =
    `${req.protocol}://${req.get("host")}` || "http://localhost:5000";
  return `${origin}/api/public/verify-certificate?t=${encodeURIComponent(tokenOrSerial)}`;
}

function generateSerialNo(participant) {
  const stamp = new Date().getFullYear();
  const shortId = String(participant?._id || "")
    .slice(-6)
    .toUpperCase();
  return `RA-${stamp}-${shortId}`;
}

function generateVerificationToken() {
  return crypto.randomBytes(16).toString("hex");
}

async function getOrCreateCertificateRecord(
  participant,
  total,
  rank,
  req,
  event,
) {
  const academyId =
    participant?.academyId?._id || participant?.academyId || null;

  let cert = await Certificate.findOne({
    participantId: participant._id,
    academyId,
    isRevoked: false,
    type: "CERTIFICATE",
    title: "Certificate of Participation",
  }).sort({ createdAt: -1 });

  if (cert) return cert;

  const serialNo = generateSerialNo(participant);
  const token = generateVerificationToken();

  cert = await Certificate.create({
    serialNo,
    eventId:
      event?._id || participant?.eventId?._id || participant?.eventId || null,
    participantId: participant._id,
    academyId,
    awardId: null,
    title: "Certificate of Participation",
    type: "CERTIFICATE",
    participantName: participant?.userId?.name || "Participant",
    groupName: participant?.groupId?.name || "",
    level: participant?.groupId?.level || "",
    bibNo: participant?.bibNo || "",
    eventName: event?.name || "General Event",
    issuedAt: new Date(),
    isRevoked: false,
    meta: {
      total: Number(total || 0),
      rank: rank ? `#${rank}` : "",
      token,
      verifyUrl: buildVerificationUrl(req, token),
    },
  });

  return cert;
}

async function buildFinalCertificateBuffer({
  participant,
  total,
  rank,
  certificateDoc,
  req,
  event,
}) {
  const participantName = participant?.userId?.name || "Participant";
  const groupName = participant?.groupId?.name || "Group";
  const level = participant?.groupId?.level || "";
  const academyName = participant?.academyId?.name || "Academy";
  const bibNo = participant?.bibNo || "";
  const totalText = Number(total || 0).toFixed(2);
  const rankText = rank ? `#${rank}` : "—";

  const certRecord =
    certificateDoc ||
    (await getOrCreateCertificateRecord(participant, total, rank, req, event));

  const serialNo = certRecord?.serialNo || "";
  const qrText =
    certRecord?.meta?.verifyUrl ||
    buildVerificationUrl(
      req,
      certRecord?.meta?.token || serialNo || "certificate",
    );

  const templatePaths = resolvePossibleTemplatePaths(participant, certRecord);
  const workingTemplate = templatePaths.find((p) => safeExists(p));

  console.log("Participant template candidates:", templatePaths);
  console.log("Participant selected template:", workingTemplate);

  if (workingTemplate) {
    try {
      const templateBuffer = fs.readFileSync(workingTemplate);

      const overlayDoc = await buildCertificateOverlayPdf({
        participantName,
        groupName,
        level,
        academyName,
        eventName: event?.name || certRecord?.eventName || "General Event",
        total: totalText,
        rank: rankText,
        bibNo,
        dateText: new Date().toLocaleDateString(),
        serialNo,
        qrText,
        showQr: true,
        showSerial: true,
        layout: participant?.academyId?.certificateLayout || {},
      });

      const overlayBuffer = await pdfkitToBuffer(overlayDoc);
      return await mergeTemplateWithOverlay(templateBuffer, overlayBuffer);
    } catch (err) {
      console.error("Template merge failed, fallback will be used:", err);
    }
  }

  const existingPdf = await loadExistingCertificateBuffer(certRecord);
  if (existingPdf) {
    return existingPdf;
  }

  const fallbackDoc = await buildCertificatePdf({
    appName: "Rebel Angels Gymnastics",
    signatory: participant?.academyId?.signatory || "Authorized Signatory",
    participantName,
    groupName,
    level,
    total,
    title: certRecord?.title || "Certificate of Participation",
    eventName: event?.name || certRecord?.eventName || "General Event",
    bibNo,
    serialNo,
    note: "Your dedication, perseverance, and positive sportsmanship are deeply appreciated.",
    qrText,
    showQr: true,
    showSerial: true,
  });

  return await pdfkitToBuffer(fallbackDoc);
}

async function getDashboardPayload(req) {
  const userId = toObjectId(req.user?.id || req.user?._id);
  if (!userId) {
    const err = new Error("Invalid participant session");
    err.statusCode = 401;
    throw err;
  }

  const participant = await findParticipantForUser(userId);

  if (!participant) {
    const err = new Error("Participant profile missing");
    err.statusCode = 404;
    err.code = "PARTICIPANT_PROFILE_MISSING";
    err.debugUserId = String(userId);
    throw err;
  }

  const event = await resolveParticipantEvent(participant);

  const scoreQuery = { participantId: participant._id };
  if (event?._id) {
    scoreQuery.eventId = event._id;
  }

  const awardQuery = { participantId: participant._id };
  if (event?._id) {
    awardQuery.eventId = event._id;
  }

  const scores = await Score.find(scoreQuery)
    .populate("activityId", "name")
    .populate("judgeUserId", "name email")
    .sort({ createdAt: -1 });

  const awards = await Award.find(awardQuery).sort({
    createdAt: -1,
  });

  const total = scores.reduce((sum, s) => sum + Number(s?.value || 0), 0);
  const rank = await getParticipantRank(participant, event?._id || null);

  const certificateDoc = await Certificate.findOne({
    participantId: participant._id,
    academyId: participant?.academyId?._id || participant?.academyId || null,
    isRevoked: false,
    type: "CERTIFICATE",
  })
    .sort({ createdAt: -1 })
    .lean();

  const hasTemplate = resolvePossibleTemplatePaths(
    participant,
    certificateDoc,
  ).some((p) => safeExists(p));

  const expectedActivities = Array.isArray(participant?.groupId?.activities)
    ? participant.groupId.activities.length
    : 0;

  return {
    participant,
    event: event || null,
    academy: participant.academyId || null,
    scores,
    awards,
    total,
    rank,
    expectedActivities,
    certificateAvailable: hasTemplate || !!certificateDoc,
    certificate: certificateDoc || null,
  };
}

/* =========================================================
 * NOTIFICATIONS
 * ========================================================= */

// GET /participant/notifications
router.get("/notifications", async (req, res) => {
  try {
    const userId = String(req.user?.id || req.user?._id || "").trim();
    const academyId = String(req.user?.academyId || req.academyId || "").trim();

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const unreadOnly =
      String(req.query.unreadOnly || "").trim() === "1" ||
      String(req.query.unreadOnly || "")
        .trim()
        .toLowerCase() === "true";

    const data = await listUserNotifications({
      userId,
      role: "PARTICIPANT",
      academyId: academyId || null,
      page,
      limit,
      unreadOnly,
      category: req.query.category || "",
      type: req.query.type || "",
      q: req.query.q || "",
    });

    return res.json(data);
  } catch (err) {
    console.error("participant /notifications error:", err);
    return res.status(500).json({
      message: normalizeMsg(err, "Failed to load notifications"),
    });
  }
});

// GET /participant/notifications/unread-count
router.get("/notifications/unread-count", async (req, res) => {
  try {
    const userId = String(req.user?.id || req.user?._id || "").trim();
    const academyId = String(req.user?.academyId || req.academyId || "").trim();

    const data = await getUserUnreadNotificationCount({
      userId,
      role: "PARTICIPANT",
      academyId: academyId || null,
    });

    return res.json(data);
  } catch (err) {
    console.error("participant /notifications/unread-count error:", err);
    return res.status(500).json({
      message: normalizeMsg(err, "Failed to load unread notification count"),
    });
  }
});

// PUT /participant/notifications/:id/read
router.put("/notifications/:id/read", async (req, res) => {
  try {
    const userId = String(req.user?.id || req.user?._id || "").trim();
    const academyId = String(req.user?.academyId || req.academyId || "").trim();
    const notificationId = String(req.params.id || "").trim();

    const updated = await markUserNotificationRead({
      notificationId,
      userId,
      role: "PARTICIPANT",
      academyId: academyId || null,
    });

    if (!updated) {
      return res.status(404).json({ message: "Notification not found" });
    }

    emitNotificationRead(req.app, updated);

    return res.json(updated);
  } catch (err) {
    console.error("participant mark notification read error:", err);
    return res.status(500).json({
      message: normalizeMsg(err, "Failed to mark notification as read"),
    });
  }
});

// PUT /participant/notifications/read-all
router.put("/notifications/read-all", async (req, res) => {
  try {
    const userId = String(req.user?.id || req.user?._id || "").trim();
    const academyId = String(req.user?.academyId || req.academyId || "").trim();

    const result = await markAllUserNotificationsRead({
      userId,
      role: "PARTICIPANT",
      academyId: academyId || null,
    });

    await emitUserUnreadCount(req.app, {
      userId,
      role: "PARTICIPANT",
      academyId: academyId || null,
    });

    return res.json(result);
  } catch (err) {
    console.error("participant mark all notifications read error:", err);
    return res.status(500).json({
      message: normalizeMsg(err, "Failed to mark all notifications as read"),
    });
  }
});

// DELETE /participant/notifications/:id
router.delete("/notifications/:id", async (req, res) => {
  try {
    const userId = String(req.user?.id || req.user?._id || "").trim();
    const academyId = String(req.user?.academyId || req.academyId || "").trim();
    const notificationId = String(req.params.id || "").trim();

    const deleted = await deleteUserNotification({
      notificationId,
      userId,
      role: "PARTICIPANT",
      academyId: academyId || null,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Notification not found" });
    }

    emitNotificationDeleted(req.app, deleted);

    return res.json({
      ok: true,
      deleted: deleted.id,
      item: deleted,
    });
  } catch (err) {
    console.error("participant delete notification error:", err);
    return res.status(500).json({
      message: normalizeMsg(err, "Failed to delete notification"),
    });
  }
});

// =========================================================
// GET /participant/me
// =========================================================
router.get("/me", async (req, res) => {
  try {
    const payload = await getDashboardPayload(req);
    return res.json(payload);
  } catch (err) {
    if (err?.statusCode === 401) {
      return res.status(401).json({ message: err.message });
    }

    if (err?.statusCode === 404) {
      return res.status(404).json({
        message: err.message,
        code: err.code || "NOT_FOUND",
        debugUserId: err.debugUserId || null,
      });
    }

    console.error("participant /me error:", err);
    return res.status(500).json({
      message: normalizeMsg(err, "Failed to load participant dashboard"),
    });
  }
});

// =========================================================
// GET /participant/me/certificate/open
// =========================================================
router.get("/me/certificate/open", async (req, res) => {
  try {
    const payload = await getDashboardPayload(req);
    const { participant, event, total, rank } = payload;

    const certificateDoc = await getOrCreateCertificateRecord(
      participant,
      total,
      rank,
      req,
      event,
    );

    const finalBuffer = await buildFinalCertificateBuffer({
      participant,
      total,
      rank,
      certificateDoc,
      req,
      event,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="participant-certificate-${participant._id}.pdf"`,
    );
    return res.send(finalBuffer);
  } catch (err) {
    if (err?.statusCode === 401) {
      return res.status(401).json({ message: err.message });
    }

    if (err?.statusCode === 404) {
      return res.status(404).json({
        message: err.message,
        code: err.code || "NOT_FOUND",
        debugUserId: err.debugUserId || null,
      });
    }

    console.error("participant certificate open error FULL:", {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
      errors: err?.errors,
      code: err?.code,
      keyValue: err?.keyValue,
    });

    return res.status(500).json({
      message: normalizeMsg(err, "Failed to open certificate"),
    });
  }
});

export default router;
