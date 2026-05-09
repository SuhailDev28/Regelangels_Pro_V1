import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import archiver from "archiver";
import crypto from "crypto";

import { PDFDocument as PDFLibDocument } from "pdf-lib";

import User from "../models/User.js";
import Group from "../models/Group.js";
import Activity from "../models/Activity.js";
import Participant from "../models/Participant.js";
import JudgeAssignment from "../models/JudgeAssignment.js";
import Score from "../models/Score.js";
import Award from "../models/Award.js";
import Alert from "../models/Alert.js";
import Certificate from "../models/Certificate.js";
import Event from "../models/Event.js";
import EventEnrollment from "../models/EventEnrollment.js";
import Payment from "../models/Payment.js";
import Academy from "../models/Academy.js";
import AcademyRegistration from "../models/AcademyRegistration.js";

import { triggerAutoEmail } from "../services/autoEmailTrigger.service.js";
import { sendTransactionalEmail } from "../services/email/emailService.js";

import { computeTotalsForGroup } from "../utils/totals.js";
import {
  buildCertificatePdf,
  buildCertificateOverlayPdf,
  pdfkitToBuffer,
} from "../utils/certificatePdf.js";
import {
  createNotification,
  emitNotification,
} from "../services/notification.service.js";

const Invoice = mongoose.models?.Invoice || null;
const Fee = mongoose.models?.Fee || null;
const Attendance = mongoose.models?.Attendance || null;
const Branch = mongoose.models?.Branch || null;
const EmailLog = mongoose.models?.EmailLog || null;

const router = express.Router();
router.use(auth, requireRole("ADMIN", "SUPER_ADMIN"));

/* =========================
 * Async wrapper
 * ========================= */
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* =========================
 * Upload paths
 * ========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const TEMPLATE_PATH = path.join(UPLOAD_DIR, "certificate-template.pdf");
const META_PATH = path.join(UPLOAD_DIR, "certificate-template.json");
const SETTINGS_FILE = path.join(UPLOAD_DIR, "admin-settings.json");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* =========================
 * Helpers
 * ========================= */
const CERT_VERIFY_SECRET =
  process.env.CERT_VERIFY_SECRET || "change-this-in-env";

const DEFAULT_ADMIN_SETTINGS = {
  accent: "#e11d2e",
  font: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  logoDataUrl: "",
  loginKind: "default",
  loginImage: "",
  loginVideoMime: "video/mp4",
  loginOverlayTitle: "Welcome Back",
  loginOverlaySubtitle: "Sign in to continue to the admin dashboard.",
  loginOverlayOpacity: 0.3,
  loginMediaFit: "cover",
  loginVideoAutoplay: true,
  loginVideoMuted: true,
  loginVideoLoop: true,
};

function normalizePriority(p) {
  const v = String(p || "")
    .trim()
    .toUpperCase();
  if (v === "NORMAL") return "MEDIUM";
  if (v === "LOW" || v === "MEDIUM" || v === "HIGH") return v;
  return "HIGH";
}

function toDateOrNull(s) {
  const v = String(s || "").trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function asObjectId(id) {
  return new mongoose.Types.ObjectId(String(id));
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function uniqIds(ids = []) {
  return [...new Set(ids.map((x) => String(x || "").trim()).filter(Boolean))];
}

function safeName(value, fallback = "file") {
  return String(value || fallback)
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function idString(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
}

function objectId(value) {
  if (!value) return null;
  try {
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (mongoose.Types.ObjectId.isValid(String(value))) {
      return new mongoose.Types.ObjectId(String(value));
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeOptionalAge(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return undefined;
  return num;
}

function buildReceiptNo(payment) {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const shortId = String(payment?._id || "")
    .slice(-6)
    .toUpperCase();
  return `RCPT-${y}${m}${d}-${shortId}`;
}

function readAdminSettingsFile() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAdminSettingsFile(data) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf8");
}

function sanitizeAdminSettings(input = {}) {
  const src = input && typeof input === "object" ? input : {};

  const safeAccent = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(
    String(src.accent || "").trim(),
  )
    ? String(src.accent).trim()
    : DEFAULT_ADMIN_SETTINGS.accent;

  const safeLoginKind = ["default", "image_ls", "video_idb"].includes(
    String(src.loginKind || "").trim(),
  )
    ? String(src.loginKind).trim()
    : DEFAULT_ADMIN_SETTINGS.loginKind;

  const safeMediaFit = ["cover", "contain"].includes(
    String(src.loginMediaFit || "").trim(),
  )
    ? String(src.loginMediaFit).trim()
    : DEFAULT_ADMIN_SETTINGS.loginMediaFit;

  const opacityNum = Number(src.loginOverlayOpacity);
  const safeOpacity = Number.isFinite(opacityNum)
    ? Math.max(0, Math.min(0.85, opacityNum))
    : DEFAULT_ADMIN_SETTINGS.loginOverlayOpacity;

  return {
    accent: safeAccent,
    font: String(src.font || DEFAULT_ADMIN_SETTINGS.font),
    logoDataUrl: typeof src.logoDataUrl === "string" ? src.logoDataUrl : "",
    loginKind: safeLoginKind,
    loginImage: typeof src.loginImage === "string" ? src.loginImage : "",
    loginVideoMime:
      typeof src.loginVideoMime === "string" && src.loginVideoMime
        ? src.loginVideoMime
        : DEFAULT_ADMIN_SETTINGS.loginVideoMime,
    loginOverlayTitle:
      typeof src.loginOverlayTitle === "string"
        ? src.loginOverlayTitle
        : DEFAULT_ADMIN_SETTINGS.loginOverlayTitle,
    loginOverlaySubtitle:
      typeof src.loginOverlaySubtitle === "string"
        ? src.loginOverlaySubtitle
        : DEFAULT_ADMIN_SETTINGS.loginOverlaySubtitle,
    loginOverlayOpacity: safeOpacity,
    loginMediaFit: safeMediaFit,
    loginVideoAutoplay:
      typeof src.loginVideoAutoplay === "boolean"
        ? src.loginVideoAutoplay
        : DEFAULT_ADMIN_SETTINGS.loginVideoAutoplay,
    loginVideoMuted:
      typeof src.loginVideoMuted === "boolean"
        ? src.loginVideoMuted
        : DEFAULT_ADMIN_SETTINGS.loginVideoMuted,
    loginVideoLoop:
      typeof src.loginVideoLoop === "boolean"
        ? src.loginVideoLoop
        : DEFAULT_ADMIN_SETTINGS.loginVideoLoop,
  };
}

function getScopeAcademyId(req) {
  if (req.user?.role !== "SUPER_ADMIN") {
    return req.academyId || req.user?.academyId || null;
  }

  const fromHeader = req.get("x-academy-id");
  const fromQuery = req.query?.academyId;
  const fromBody = req.body?.academyId;

  const candidate =
    fromHeader ||
    fromQuery ||
    fromBody ||
    req.academyId ||
    req.user?.academyId ||
    null;

  if (!candidate) return null;
  return String(candidate);
}

function requireScopedAcademy(req, res) {
  const academyId = getScopeAcademyId(req);
  if (!academyId || !isValidObjectId(academyId)) {
    res.status(400).json({ message: "Valid academyId is required" });
    return null;
  }
  return academyId;
}

function buildGroupResultsMessage({
  participantName,
  groupName,
  academyName,
  total,
  rank,
}) {
  const safeParticipant = String(participantName || "Participant").trim();
  const safeGroup = String(groupName || "Group").trim();
  const safeAcademy = String(academyName || "Academy").trim();
  const safeRank = Number(rank || 0);
  const safeTotal = Number(total || 0);

  return {
    title: "Results Published",
    message: `${safeParticipant}'s results are now published for ${safeGroup} at ${safeAcademy}. Rank: ${safeRank || "—"}, Score: ${safeTotal.toFixed(2)}.`,
    type: "RESULT_PUBLISHED",
    category: "RESULT",
    priority: "HIGH",
  };
}

async function getAcademyNameById(academyId) {
  if (!academyId) return "Academy";
  const academy = await Academy.findById(academyId).select("name").lean();
  return academy?.name || "Academy";
}

async function computeGroupLeaderboardRows({ academyId, groupId }) {
  const participants = await Participant.find({ academyId, groupId })
    .populate("userId", "name email role")
    .populate("groupId", "name level")
    .populate("parentUserId", "name email role")
    .lean();

  if (!participants.length) {
    return [];
  }

  const participantIds = participants.map((p) => p._id);

  const totals = await Score.aggregate([
    {
      $match: {
        academyId: asObjectId(academyId),
        participantId: { $in: participantIds },
        status: "SCORED",
        value: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$participantId",
        total: { $sum: "$value" },
      },
    },
  ]);

  const totalMap = new Map(
    totals.map((x) => [String(x._id), Number(x.total || 0)]),
  );

  const rows = participants
    .map((p) => ({
      participantId: String(p._id),
      participant: p,
      participantName: p?.userId?.name || "Participant",
      participantEmail: p?.userId?.email || "",
      parentUserId: p?.parentUserId?._id ? String(p.parentUserId._id) : "",
      parentName: p?.parentUserId?.name || "",
      parentEmail: p?.parentUserId?.email || p?.parentEmail || "",
      groupName: p?.groupId?.name || "Group",
      level: p?.groupId?.level || "",
      total: Number(totalMap.get(String(p._id)) || 0),
    }))
    .sort((a, b) => b.total - a.total)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

  return rows;
}

async function sendGroupResultNotificationAndEmail({
  req,
  academyId,
  academyName,
  row,
}) {
  const content = buildGroupResultsMessage({
    participantName: row.participantName,
    groupName: row.groupName,
    academyName,
    total: row.total,
    rank: row.rank,
  });

  const sentNotificationKeys = new Set();
  const notificationTargets = [];

  if (row.parentUserId && isValidObjectId(row.parentUserId)) {
    notificationTargets.push({
      recipientUserId: row.parentUserId,
      recipientRole: "PARENT",
      actionUrl: "/parent/results",
    });
  }

  if (
    row.participant?.userId?._id &&
    isValidObjectId(String(row.participant.userId._id))
  ) {
    notificationTargets.push({
      recipientUserId: String(row.participant.userId._id),
      recipientRole: "PARTICIPANT",
      actionUrl: "/participant",
    });
  }

  for (const target of notificationTargets) {
    const dedupeKey = `${target.recipientRole}:${target.recipientUserId}`;
    if (sentNotificationKeys.has(dedupeKey)) continue;
    sentNotificationKeys.add(dedupeKey);

    const notification = await createNotification({
      academyId,
      recipientUserId: target.recipientUserId,
      recipientRole: target.recipientRole,
      title: content.title,
      message: content.message,
      type: content.type,
      category: content.category,
      priority: content.priority,
      actionUrl: target.actionUrl,
      meta: {
        participantId: row.participantId,
        participantName: row.participantName,
        groupName: row.groupName,
        level: row.level,
        total: row.total,
        rank: row.rank,
        academyName,
      },
      createdByUserId: req?.user?._id || null,
    });

    emitNotification(req.app, notification);
  }

  const emailTargets = [];
  if (row.parentEmail) {
    emailTargets.push({
      email: row.parentEmail,
      name: row.parentName || "Parent",
      target: "PARENT",
      recipientUserId: row.parentUserId || null,
      recipientRole: "PARENT",
      resultsPath: "/parent/results",
    });
  }

  if (row.participantEmail) {
    emailTargets.push({
      email: row.participantEmail,
      name: row.participantName || "Participant",
      target: "PARTICIPANT",
      recipientUserId: row.participant?.userId?._id
        ? String(row.participant.userId._id)
        : null,
      recipientRole: "PARTICIPANT",
      resultsPath: "/participant",
    });
  }

  const sentEmailKeys = new Set();

  for (const target of emailTargets) {
    const email = normalizeEmail(target.email);
    if (!email) continue;
    if (sentEmailKeys.has(email)) continue;
    sentEmailKeys.add(email);

    await triggerAutoEmail({
      academyId: String(academyId),
      recipientUserId: target.recipientUserId || null,
      recipientRole: target.recipientRole || "PARTICIPANT",
      recipientEmail: email,
      triggerEvent: "RESULT_PUBLISHED",
      variables: {
        name: target.name,
        parentName: target.name,
        participantName: row.participantName,
        childName: row.participantName,
        eventName: row.groupName || "Group Results",
        groupName: row.groupName,
        level: row.level,
        score: Number(row.total || 0).toFixed(2),
        total: Number(row.total || 0).toFixed(2),
        rank: String(row.rank || ""),
        academyName,
        resultsUrl: buildAppUrl(target.resultsPath),
        actionUrl: buildAppUrl(target.resultsPath),
        actionLabel: "View Results",
      },
      meta: {
        type: "RESULT_PUBLISHED",
        academyId: String(academyId),
        participantId: row.participantId,
        publishTarget: target.target,
        rank: row.rank,
        total: row.total,
        groupName: row.groupName,
        level: row.level,
      },
      syncNotification: false,
    });
  }
}

async function sendCertificateReadyEmail({
  academyId,
  participant,
  eventDoc,
  cert,
  verifyUrl,
  certificateUrl,
}) {
  if (!participant?._id)
    return { ok: false, skipped: true, reason: "Missing participant" };

  const targets = await getParticipantEmailTargets({
    academyId,
    participantId: participant._id,
  });

  if (!targets.length) {
    return { ok: false, skipped: true, reason: "No valid email targets" };
  }

  let sent = 0;
  const errors = [];

  for (const target of targets) {
    const result = await triggerAutoEmail({
      academyId: String(academyId),
      recipientUserId:
        target.role === "PARENT"
          ? participant?.parentUserId?._id
            ? String(participant.parentUserId._id)
            : null
          : participant?.userId?._id
            ? String(participant.userId._id)
            : null,
      recipientRole: target.role || "PARTICIPANT",
      recipientEmail: target.email,
      triggerEvent: "CERTIFICATE_READY",
      variables: {
        name: target.name || "there",
        parentName: target.name || "there",
        participantName:
          participant?.userId?.name || cert?.participantName || "Participant",
        childName:
          participant?.userId?.name || cert?.participantName || "Participant",
        eventName: eventDoc?.name || cert?.eventName || "Event",
        certificateTitle: cert?.title || "Certificate",
        serialNo: cert?.serialNo || "",
        verifyUrl,
        certificateUrl,
        actionUrl: certificateUrl,
        actionLabel: "Open Certificate",
      },
      meta: {
        type: "CERTIFICATE_READY",
        academyId: String(academyId),
        participantId: String(participant._id || ""),
        eventId: String(eventDoc?._id || cert?.eventId || ""),
        certificateId: String(cert?._id || ""),
        serialNo: cert?.serialNo || "",
        emailTargetRole: target.role,
      },
      syncNotification: false,
    });

    if (result?.ok) sent += 1;
    else if (result?.error) errors.push(result.error);
  }

  return {
    ok: sent > 0,
    sent,
    attempted: targets.length,
    errors,
  };
}

async function createInviteTokenForUser(user, expiresMinutes = 60 * 24) {
  if (!user) throw new Error("User is required");

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  user.resetTokenHash = hashedToken;
  user.resetTokenExp = new Date(Date.now() + expiresMinutes * 60 * 1000);
  await user.save();

  return rawToken;
}

function buildAppUrl(pathname = "") {
  const base = String(process.env.APP_URL || "http://localhost:5173").replace(
    /\/+$/,
    "",
  );

  const p = String(pathname || "");
  if (!p) return base;
  if (p.startsWith("/")) return `${base}${p}`;
  return `${base}/${p}`;
}

function shouldSendInviteEmail(email = "") {
  const v = normalizeEmail(email);
  if (!v) return false;
  if (v.endsWith("@noemail.local")) return false;
  return true;
}

async function getParticipantEmailTargets({ academyId, participantId }) {
  if (!academyId || !participantId) return [];

  const participant = await Participant.findOne({
    _id: participantId,
    academyId,
  })
    .populate("userId", "name email")
    .populate("parentUserId", "name email")
    .lean();

  if (!participant) return [];

  const targets = [];

  const parentEmail = normalizeEmail(
    participant?.parentUserId?.email || participant?.parentEmail || "",
  );
  const participantEmail = normalizeEmail(participant?.userId?.email || "");

  if (shouldSendInviteEmail(parentEmail)) {
    targets.push({
      email: parentEmail,
      name: participant?.parentUserId?.name || "Parent",
      role: "PARENT",
      participant,
    });
  }

  if (
    shouldSendInviteEmail(participantEmail) &&
    participantEmail !== parentEmail
  ) {
    targets.push({
      email: participantEmail,
      name: participant?.userId?.name || "Participant",
      role: "PARTICIPANT",
      participant,
    });
  }

  return targets;
}

async function sendPaymentStatusEmails({
  academyId,
  payment,
  eventDoc = null,
  statusOverride = "",
}) {
  const participantId =
    payment?.participantId?._id ||
    payment?.participantId?.id ||
    payment?.participantId ||
    null;

  if (!participantId || !isValidObjectId(String(participantId))) {
    return { ok: false, skipped: true, reason: "Missing participantId" };
  }

  const academyName = await getAcademyNameById(academyId);

  const targets = await getParticipantEmailTargets({
    academyId,
    participantId: String(participantId),
  });

  if (!targets.length) {
    return { ok: false, skipped: true, reason: "No valid email targets" };
  }

  let event = eventDoc || null;
  const eventId =
    payment?.eventId?._id || payment?.eventId?.id || payment?.eventId || null;

  if (!event && eventId && isValidObjectId(String(eventId))) {
    event = await Event.findOne({
      _id: String(eventId),
      academyId,
    })
      .select("name")
      .lean();
  }

  const status = String(
    statusOverride || payment?.paymentStatus || "PENDING",
  ).toUpperCase();

  const triggerEvent =
    status === "PAID"
      ? "PAYMENT_SUCCESS"
      : status === "FAILED"
        ? "PAYMENT_FAILED"
        : "PAYMENT_PENDING";

  const amountValue = Number(payment?.amount || 0);
  const formattedAmount = Number.isFinite(amountValue)
    ? amountValue.toFixed(2)
    : "0.00";

  const resolvedEventName =
    event?.name || payment?.eventId?.name || payment?.eventName || "Event";

  const resolvedPaymentMethod = payment?.paymentMethod || "CASH";
  const resolvedCurrency = payment?.currency || "QAR";
  const resolvedReceiptNo = payment?.receiptNo || "";
  const resolvedInvoiceNo = payment?.invoiceNo || payment?.invoiceNumber || "";
  const resolvedReference =
    resolvedReceiptNo ||
    resolvedInvoiceNo ||
    payment?.paymentRef ||
    payment?.referenceNo ||
    payment?.transactionId ||
    "";

  const paymentsUrl = buildAppUrl("/parent/dashboard?tab=payments");

  let sent = 0;
  const errors = [];

  for (const target of targets) {
    const participantName =
      target?.participant?.userId?.name ||
      payment?.participantId?.userId?.name ||
      payment?.participantName ||
      "Participant";

    const recipientUserId =
      target.role === "PARENT"
        ? target?.participant?.parentUserId?._id
          ? String(target.participant.parentUserId._id)
          : null
        : target?.participant?.userId?._id
          ? String(target.participant.userId._id)
          : null;

    const result = await triggerAutoEmail({
      academyId: String(academyId),
      recipientUserId,
      recipientRole: target.role,
      recipientEmail: target.email,
      triggerEvent,
      variables: {
        name:
          target.name ||
          (target.role === "PARENT" ? "Parent" : participantName),
        parentName: target.role === "PARENT" ? target.name || "Parent" : "",
        participantName,
        childName: participantName,
        eventName: resolvedEventName,
        amount: formattedAmount,
        currency: resolvedCurrency,
        paymentMethod: resolvedPaymentMethod,
        paymentStatus: status,
        receiptNo: resolvedReceiptNo,
        paymentRef: resolvedReference,
        referenceNo: resolvedReference,
        invoiceNo: resolvedInvoiceNo,
        invoiceNumber: resolvedInvoiceNo,
        transactionId: payment?.transactionId || "",
        receiptUrl: paymentsUrl,
        paymentUrl: paymentsUrl,
        paidAt: payment?.paidAt
          ? new Date(payment.paidAt).toLocaleString()
          : "",
        academyName,
        actionUrl: paymentsUrl,
        actionLabel: "View Payments",
      },
      meta: {
        type: "PAYMENT_STATUS",
        academyId: String(academyId),
        participantId: String(participantId),
        paymentId: String(payment?._id || ""),
        eventId: eventId ? String(eventId) : "",
        status,
        emailTargetRole: target.role,
      },
      syncNotification: false,
    });

    if (result?.ok) sent += 1;
    else if (result?.error) errors.push(result.error);
  }

  return {
    ok: sent > 0,
    sent,
    attempted: targets.length,
    errors,
  };
}

async function sendAccountInviteEmail({
  user,
  invitedBy = "Rebel Angels",
  academyId = null,
  roleLabel = "",
}) {
  try {
    if (!user?.email) {
      return { ok: false, skipped: true, reason: "Missing email" };
    }

    if (!shouldSendInviteEmail(user.email)) {
      return { ok: false, skipped: true, reason: "Non-real email address" };
    }

    const rawToken = await createInviteTokenForUser(user, 60 * 24);
    const inviteUrl = buildAppUrl(`/reset-password?token=${rawToken}`);

    const effectiveRole = String(roleLabel || user.role || "USER")
      .trim()
      .toUpperCase();

    const triggerEvent = "ACCOUNT_INVITE";

    const result = await triggerAutoEmail({
      academyId: academyId ? String(academyId) : null,
      recipientUserId: String(user._id || ""),
      recipientRole: effectiveRole,
      recipientEmail: normalizeEmail(user.email),
      triggerEvent,
      variables: {
        name: user.name || "there",
        parentName: user.name || "there",
        judgeName: user.name || "there",
        participantName: user.name || "there",
        childName: user.name || "there",
        role: effectiveRole,
        roleLabel: effectiveRole,
        inviteUrl,
        loginUrl: buildAppUrl("/login"),
        resetUrl: inviteUrl,
        invitedBy,
        academyName: await getAcademyNameById(academyId),
        actionUrl: inviteUrl,
        actionLabel: "Set Password",
      },
      meta: {
        type: "ACCOUNT_INVITE",
        academyId: academyId ? String(academyId) : null,
        userId: String(user._id || ""),
        invitedRole: effectiveRole,
        inviteUrl,
      },
      syncNotification: false,
    });

    return {
      ok: !!result?.ok,
      sent: !!result?.ok,
      triggerEvent,
      email: normalizeEmail(user.email),
      result,
    };
  } catch (err) {
    console.error("Account invite email failed:", err?.message || err);
    return {
      ok: false,
      error: err?.message || "Invite send failed",
    };
  }
}

async function sendTempPasswordWelcomeEmail({
  user,
  tempPassword = "",
  academyId = null,
  invitedBy = "Rebel Angels",
  roleLabel = "",
  participantName = "",
}) {
  try {
    if (!user?.email) {
      return { ok: false, skipped: true, reason: "Missing email" };
    }

    if (!shouldSendInviteEmail(user.email)) {
      return { ok: false, skipped: true, reason: "Non-real email address" };
    }

    const effectiveRole = String(roleLabel || user.role || "USER")
      .trim()
      .toUpperCase();

    const loginUrl = buildAppUrl("/login");

    const triggerEvent =
      effectiveRole === "PARENT"
        ? "WELCOME_PARENT"
        : effectiveRole === "JUDGE"
          ? "WELCOME_JUDGE"
          : effectiveRole === "PARTICIPANT"
            ? "WELCOME_PARTICIPANT"
            : "ACCOUNT_INVITE";

    const result = await triggerAutoEmail({
      academyId: academyId ? String(academyId) : null,
      recipientUserId: String(user._id || ""),
      recipientRole: effectiveRole,
      recipientEmail: normalizeEmail(user.email),
      triggerEvent,
      variables: {
        name: user.name || "there",
        parentName: user.name || "there",
        judgeName: user.name || "there",
        participantName: participantName || user.name || "there",
        childName: participantName || user.name || "there",
        role: effectiveRole,
        roleLabel: effectiveRole,
        loginUrl,
        invitedBy,
        academyName: await getAcademyNameById(academyId),
        temporaryPassword: String(tempPassword || "").trim(),
        actionUrl: loginUrl,
        actionLabel: "Login",
      },
      meta: {
        type: "WELCOME_TEMP_PASSWORD",
        academyId: academyId ? String(academyId) : null,
        userId: String(user._id || ""),
        invitedRole: effectiveRole,
      },
      syncNotification: false,
    });

    return {
      ok: !!result?.ok,
      sent: !!result?.ok,
      triggerEvent,
      email: normalizeEmail(user.email),
      result,
    };
  } catch (err) {
    console.error("Temp password welcome email failed:", err?.message || err);
    return {
      ok: false,
      error: err?.message || "Welcome email send failed",
    };
  }
}

async function resolveParentLink({
  academyId,
  parentUserId,
  parentEmail,
  tempPassword = "Parent@12345",
  invitedBy = "Rebel Angels",
  participantName = "",
  sendWelcomeEmail = true,
}) {
  const cleanParentEmail = normalizeEmail(parentEmail);

  if (parentUserId) {
    if (!isValidObjectId(parentUserId)) {
      throw new Error("Invalid parentUserId");
    }

    const parentUser = await User.findOne({
      _id: parentUserId,
      academyId,
      role: "PARENT",
    });

    if (!parentUser) {
      throw new Error("Parent user not found in academy scope");
    }

    return {
      parentUserId: String(parentUser._id),
      parentEmail: normalizeEmail(parentUser.email),
      parentUser,
      createdParentUser: false,
    };
  }

  if (cleanParentEmail) {
    let parentUser = await User.findOne({
      email: cleanParentEmail,
      academyId,
      role: "PARENT",
    });

    let createdParentUser = false;

    if (!parentUser) {
      parentUser = await User.create({
        academyId,
        name: cleanParentEmail.split("@")[0] || "Parent",
        email: cleanParentEmail,
        passwordHash: await bcrypt.hash(tempPassword || "Parent@12345", 10),
        role: "PARENT",
        mustChangePassword: true,
        tempPasswordIssuedAt: new Date(),
      });

      createdParentUser = true;

      if (sendWelcomeEmail) {
        await sendTempPasswordWelcomeEmail({
          user: parentUser,
          tempPassword,
          academyId,
          invitedBy,
          roleLabel: "PARENT",
          participantName,
        });
      }
    }

    return {
      parentUserId: String(parentUser._id),
      parentEmail: cleanParentEmail,
      parentUser,
      createdParentUser,
    };
  }

  return {
    parentUserId: null,
    parentEmail: "",
    parentUser: null,
    createdParentUser: false,
  };
}

async function ensureSameAcademyRefs({
  academyId,
  groupId,
  activityId,
  participantId,
  judgeUserId,
  eventId,
}) {
  if (groupId) {
    const g = await Group.findOne({ _id: groupId, academyId }).lean();
    if (!g) throw new Error("Group not found in academy scope");
  }

  if (activityId) {
    const a = await Activity.findOne({ _id: activityId, academyId }).lean();
    if (!a) throw new Error("Activity not found in academy scope");
  }

  if (participantId) {
    const p = await Participant.findOne({
      _id: participantId,
      academyId,
    }).lean();
    if (!p) throw new Error("Participant not found in academy scope");
  }

  if (judgeUserId) {
    const u = await User.findOne({
      _id: judgeUserId,
      academyId,
      role: "JUDGE",
    }).lean();
    if (!u) throw new Error("Judge not found in academy scope");
  }

  if (eventId) {
    const e = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!e) throw new Error("Event not found in academy scope");
  }
}

function generateCertificateSerial({
  eventId,
  participantId,
  date = new Date(),
}) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  const ev =
    String(eventId || "")
      .slice(-4)
      .toUpperCase() || "EVNT";
  const pt =
    String(participantId || "")
      .slice(-6)
      .toUpperCase() || "PARTIC";

  return `RA-${y}${m}${d}-${ev}-${pt}`;
}

function signCertificatePayload(payload) {
  const json = JSON.stringify(payload);
  const base = Buffer.from(json).toString("base64url");

  const sig = crypto
    .createHmac("sha256", CERT_VERIFY_SECRET)
    .update(base)
    .digest("base64url");

  return `${base}.${sig}`;
}

function buildVerifyUrl(req, token) {
  return `${req.protocol}://${req.get(
    "host",
  )}/api/public/verify-certificate?t=${encodeURIComponent(token)}`;
}

function emitLeaderboardUpdate(req, { academyId, eventId, groupId } = {}) {
  const io = req?.app?.get?.("io");
  if (!io) return;

  const payload = {
    academyId: academyId ? String(academyId) : null,
    eventId: eventId ? String(eventId) : null,
    groupId: groupId ? String(groupId) : null,
    ts: Date.now(),
  };

  io.to("admins").emit("leaderboard:update", payload);
  io.to("admins").emit("admin:score-updated", payload);

  if (payload.academyId) {
    io.to(`academy:${payload.academyId}`).emit("leaderboard:update", payload);
    io.to(`academy:${payload.academyId}`).emit("admin:score-updated", payload);
  }

  if (payload.eventId) {
    io.to(`event:${payload.eventId}`).emit("leaderboard:update", payload);
    io.to(`event:${payload.eventId}`).emit("admin:score-updated", payload);
    io.to(`leaderboard:${payload.eventId}`).emit("leaderboard:update", payload);
    io.to(`leaderboard:${payload.eventId}`).emit(
      "admin:score-updated",
      payload,
    );
  }

  if (payload.groupId) {
    io.to(`group:${payload.groupId}`).emit("leaderboard:update", payload);
    io.to(`group:${payload.groupId}`).emit("admin:score-updated", payload);
  }
}

async function ensureCertificateRecord({
  academyId,
  eventId,
  participant,
  awardId = null,
  title,
  type = "CERTIFICATE",
  eventName,
}) {
  const existing = await Certificate.findOne({
    academyId,
    eventId,
    participantId: participant._id,
    title,
    type,
    isRevoked: false,
  });

  if (existing) return existing;

  let serialNo = generateCertificateSerial({
    eventId,
    participantId: participant._id,
  });

  let counter = 1;
  while (await Certificate.findOne({ academyId, serialNo })) {
    serialNo = `${generateCertificateSerial({
      eventId,
      participantId: participant._id,
    })}-${counter}`;
    counter += 1;
  }

  return await Certificate.create({
    academyId,
    serialNo,
    eventId,
    participantId: participant._id,
    awardId,
    title,
    type,
    participantName:
      participant.userId?.name || participant.user?.name || "Participant",
    groupName: participant.groupId?.name || "",
    level: participant.groupId?.level || "",
    bibNo: participant.bibNo || "",
    eventName: eventName || "",
    meta: {},
  });
}

async function buildFinalCertificateBuffer({
  participant,
  enrolled,
  eventDoc,
  cert,
  total = 0,
  verifyUrl = "",
}) {
  const dateText = cert?.issuedAt
    ? new Date(cert.issuedAt).toLocaleDateString()
    : eventDoc?.startDate
      ? new Date(eventDoc.startDate).toLocaleDateString()
      : new Date().toLocaleDateString();

  if (fs.existsSync(TEMPLATE_PATH)) {
    try {
      const templateBytes = fs.readFileSync(TEMPLATE_PATH);

      const overlayDoc = await buildCertificateOverlayPdf({
        participantName:
          participant.userId?.name ||
          participant.user?.name ||
          cert.participantName,
        dateText,
        serialNo: cert.serialNo,
        qrText: verifyUrl,
        showQr: !!verifyUrl,
        showSerial: true,
      });

      const overlayBytes = await pdfkitToBuffer(overlayDoc);

      const tpl = await PDFLibDocument.load(templateBytes);
      const ovl = await PDFLibDocument.load(overlayBytes);

      const out = await PDFLibDocument.create();
      const [outPage] = await out.copyPages(tpl, [0]);
      out.addPage(outPage);

      const [embeddedOverlay] = await out.embedPages([ovl.getPage(0)]);
      const { width: W, height: H } = outPage.getSize();

      outPage.drawPage(embeddedOverlay, {
        x: 0,
        y: 0,
        width: W,
        height: H,
      });

      const merged = await out.save();
      return {
        buffer: Buffer.from(merged),
        mode: "template",
      };
    } catch (e) {
      console.error("Template merge failed. Falling back:", e);
    }
  }

  const pdfDoc = await buildCertificatePdf({
    appName: process.env.APP_NAME,
    signatory: process.env.CERT_SIGNATORY,
    participantName:
      participant.userId?.name ||
      participant.user?.name ||
      cert.participantName,
    groupName: participant.groupId?.name || cert.groupName || "",
    level: participant.groupId?.level || cert.level || "",
    total,
    title: cert.title || "PARTICIPATION AWARD",
    eventName: eventDoc?.name || cert.eventName || "",
    bibNo: participant.bibNo || enrolled?.bibNo || cert.bibNo || "",
    serialNo: cert.serialNo,
    note: "Awarded for outstanding performance and dedication.",
    qrText: verifyUrl,
    showQr: !!verifyUrl,
    showSerial: true,
  });

  const fallbackBuffer = await pdfkitToBuffer(pdfDoc);

  return {
    buffer: fallbackBuffer,
    mode: "fallback",
  };
}

async function bulkDeleteParticipantsAndUsers({
  academyId,
  participantIds,
  deleteUsers = false,
  session = null,
}) {
  const participants = await Participant.find({
    _id: { $in: participantIds },
    academyId,
  })
    .select("_id userId")
    .lean();

  const foundIds = participants.map((p) => String(p._id));
  const userIds = participants
    .map((p) => p.userId)
    .filter(Boolean)
    .map((id) => String(id));

  const queryOpts = session ? { session } : undefined;

  const participantDelete = await Participant.deleteMany(
    { _id: { $in: foundIds }, academyId },
    queryOpts,
  );

  await EventEnrollment.deleteMany(
    { participantId: { $in: foundIds }, academyId },
    queryOpts,
  );
  await Score.deleteMany(
    { participantId: { $in: foundIds }, academyId },
    queryOpts,
  );
  await Award.deleteMany(
    { participantId: { $in: foundIds }, academyId },
    queryOpts,
  );
  await Certificate.deleteMany(
    { participantId: { $in: foundIds }, academyId },
    queryOpts,
  );
  await Payment.deleteMany(
    { participantId: { $in: foundIds }, academyId },
    queryOpts,
  );

  let userDelete = { deletedCount: 0 };
  if (deleteUsers && userIds.length) {
    userDelete = await User.deleteMany(
      {
        _id: { $in: userIds },
        academyId,
        role: "PARTICIPANT",
      },
      queryOpts,
    );
  }

  return {
    foundParticipants: foundIds.length,
    deletedParticipants: participantDelete?.deletedCount ?? 0,
    deletedUsers: userDelete?.deletedCount ?? 0,
  };
}

async function eventSummary(academyId, eventId) {
  const eventObjId = asObjectId(eventId);

  const [event, enrollments, assignments, scoredAgg, awardAgg, certAgg] =
    await Promise.all([
      Event.findOne({ _id: eventId, academyId }).lean(),
      EventEnrollment.find({ academyId, eventId }).lean(),
      JudgeAssignment.find({ academyId, eventId }).lean(),
      Score.aggregate([
        {
          $match: {
            academyId: asObjectId(academyId),
            eventId: eventObjId,
            status: "SCORED",
            value: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$participantId",
            total: { $sum: "$value" },
          },
        },
      ]),
      Award.aggregate([
        {
          $match: {
            academyId: asObjectId(academyId),
            eventId: eventObjId,
          },
        },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
          },
        },
      ]),
      Certificate.aggregate([
        {
          $match: {
            academyId: asObjectId(academyId),
            eventId: eventObjId,
          },
        },
        {
          $group: {
            _id: "$isRevoked",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  if (!event) return null;

  const participantIds = uniqIds(enrollments.map((e) => e.participantId));
  const groupIds = uniqIds(enrollments.map((e) => e.groupId));
  const judgeIds = uniqIds(assignments.map((a) => a.judgeUserId));
  const activityIds = uniqIds(assignments.map((a) => a.activityId));

  const scoredCount = scoredAgg.length;
  const medals = awardAgg.find((x) => x._id === "MEDAL")?.count || 0;
  const certAwards = awardAgg.find((x) => x._id === "CERTIFICATE")?.count || 0;
  const activeCerts = certAgg.find((x) => x._id === false)?.count || 0;
  const revokedCerts = certAgg.find((x) => x._id === true)?.count || 0;

  return {
    event,
    kpis: {
      enrolledParticipants: participantIds.length,
      enrolledGroups: groupIds.length,
      assignedJudges: judgeIds.length,
      assignedActivities: activityIds.length,
      scoredParticipants: scoredCount,
      medals,
      certificateAwards: certAwards,
      activeCertificates: activeCerts,
      revokedCertificates: revokedCerts,
    },
  };
}

/* =========================
 * Certificate template
 * ========================= */
const tplUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF allowed"));
    }
    cb(null, true);
  },
});

router.get(
  "/cert-template/info",
  wrap(async (_req, res) => {
    if (!fs.existsSync(TEMPLATE_PATH)) return res.json({ exists: false });

    let meta = {
      exists: true,
      filename: "certificate-template.pdf",
      updatedAt: null,
    };

    try {
      if (fs.existsSync(META_PATH)) {
        meta = { ...meta, ...JSON.parse(fs.readFileSync(META_PATH, "utf8")) };
      } else {
        const st = fs.statSync(TEMPLATE_PATH);
        meta.updatedAt = st.mtime?.toISOString?.() || null;
      }
    } catch {
      // ignore
    }

    res.json(meta);
  }),
);

router.post(
  "/cert-template/upload",
  tplUpload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "Missing file" });

    fs.writeFileSync(TEMPLATE_PATH, req.file.buffer);

    const meta = {
      exists: true,
      filename: req.file.originalname || "certificate-template.pdf",
      updatedAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
    } catch {
      // ignore
    }

    res.json({ ok: true, ...meta });
  }),
);

router.get(
  "/cert-template/pdf",
  wrap(async (_req, res) => {
    if (!fs.existsSync(TEMPLATE_PATH)) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="certificate-template.pdf"',
    );
    fs.createReadStream(TEMPLATE_PATH).pipe(res);
  }),
);

router.delete(
  "/cert-template/delete",
  wrap(async (_req, res) => {
    let removed = false;

    if (fs.existsSync(TEMPLATE_PATH)) {
      fs.unlinkSync(TEMPLATE_PATH);
      removed = true;
    }
    if (fs.existsSync(META_PATH)) {
      fs.unlinkSync(META_PATH);
      removed = true;
    }

    res.json({ ok: true, removed });
  }),
);

/* =========================
 * Change password
 * ========================= */

router.post(
  "/change-password",
  wrap(async (req, res) => {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    });

    const { currentPassword, newPassword } = schema.parse(req.body || {});

    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash || "");
    if (!ok) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ ok: true, message: "Password changed successfully" });
  }),
);

/* =========================
 * Admin settings
 * ========================= */
router.get(
  "/settings",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const all = readAdminSettingsFile();
    const academySettings = all[String(academyId)] || {};

    return res.json(
      sanitizeAdminSettings({
        ...DEFAULT_ADMIN_SETTINGS,
        ...academySettings,
      }),
    );
  }),
);

router.put(
  "/settings",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const safe = sanitizeAdminSettings(req.body || {});
    const all = readAdminSettingsFile();

    all[String(academyId)] = {
      ...safe,
      academyId: String(academyId),
      updatedAt: new Date().toISOString(),
      updatedBy: String(req.user?._id || ""),
    };

    writeAdminSettingsFile(all);

    return res.json({
      ok: true,
      message: "Settings saved successfully",
      settings: sanitizeAdminSettings(all[String(academyId)]),
    });
  }),
);

/* =========================
 * Groups
 * ========================= */
router.get(
  "/groups",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const rows = await Group.find({ academyId })
      .sort({ name: 1, level: 1 })
      .lean();
    res.json(rows);
  }),
);

router.post(
  "/groups",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { name, level } = z
      .object({ name: z.string().min(1), level: z.string().optional() })
      .parse(req.body);

    const doc = await Group.create({
      academyId,
      name,
      level: level || "",
    });

    res.json(doc);
  }),
);

router.put(
  "/groups/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { name, level } = z
      .object({ name: z.string().min(1), level: z.string().optional() })
      .parse(req.body);

    const doc = await Group.findOneAndUpdate(
      { _id: req.params.id, academyId },
      { name, level: level || "" },
      { new: true },
    );

    if (!doc) return res.status(404).json({ message: "Group not found" });
    res.json(doc);
  }),
);

router.delete(
  "/groups/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const del = await Group.deleteOne({ _id: req.params.id, academyId });
    if (!del.deletedCount) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json({ ok: true });
  }),
);

router.post(
  "/groups/:groupId/publish-results",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { groupId } = req.params;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid groupId" });
    }

    const group = await Group.findOne({ _id: groupId, academyId }).lean();
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const academyName = await getAcademyNameById(academyId);
    const rows = await computeGroupLeaderboardRows({ academyId, groupId });

    if (!rows.length) {
      return res.status(400).json({
        message: "No participants found in this group",
      });
    }

    let notificationsCreated = 0;
    let emailsAttempted = 0;

    for (const row of rows) {
      try {
        const beforeParentEmail = normalizeEmail(row.parentEmail);
        const beforeParticipantEmail = normalizeEmail(row.participantEmail);

        await sendGroupResultNotificationAndEmail({
          req,
          academyId,
          academyName,
          row,
        });

        if (row.parentUserId) notificationsCreated += 1;
        if (row.participant?.userId?._id) notificationsCreated += 1;
        if (beforeParentEmail) emailsAttempted += 1;
        if (
          beforeParticipantEmail &&
          beforeParticipantEmail !== beforeParentEmail
        ) {
          emailsAttempted += 1;
        }
      } catch (err) {
        console.error(
          `Publish result failed for participant ${row.participantId}:`,
          err?.message || err,
        );
      }
    }

    emitLeaderboardUpdate(req, { academyId, groupId });

    return res.json({
      ok: true,
      message: "Group results published successfully",
      academyId,
      groupId,
      groupName: group.name || "",
      totalParticipants: rows.length,
      notificationsCreated,
      emailsAttempted,
      publishedAt: new Date().toISOString(),
    });
  }),
);

/* =========================
 * Reset scores
 * ========================= */
router.post(
  "/groups/:groupId/reset-scores",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { groupId } = req.params;
    const { eventId } = z
      .object({ eventId: z.string().optional() })
      .parse(req.body || {});

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid groupId" });
    }
    if (eventId && !isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const group = await Group.findOne({ _id: groupId, academyId }).lean();
    if (!group) return res.status(404).json({ message: "Group not found" });

    if (eventId) {
      const ev = await Event.findOne({ _id: eventId, academyId }).lean();
      if (!ev) return res.status(404).json({ message: "Event not found" });
    }

    const participants = await Participant.find({ groupId, academyId })
      .select("_id")
      .lean();
    const participantIds = participants.map((p) => p._id);

    if (!participantIds.length) {
      return res.json({
        ok: true,
        groupId,
        groupName: group.name,
        eventId: eventId || null,
        deletedScores: 0,
        deletedAwards: 0,
        deletedCertificates: 0,
        participants: 0,
        note: "No participants in this group.",
      });
    }

    const scoreQ = { academyId, participantId: { $in: participantIds } };
    const awardQ = { academyId, participantId: { $in: participantIds } };
    const certQ = { academyId, participantId: { $in: participantIds } };

    if (eventId) {
      scoreQ.eventId = eventId;
      awardQ.eventId = eventId;
      certQ.eventId = eventId;
    }

    const session = await mongoose.startSession();
    try {
      let deletedScores = 0;
      let deletedAwards = 0;
      let deletedCertificates = 0;

      await session.withTransaction(async () => {
        const s1 = await Score.deleteMany(scoreQ).session(session);
        deletedScores = s1?.deletedCount ?? 0;

        const s2 = await Award.deleteMany(awardQ).session(session);
        deletedAwards = s2?.deletedCount ?? 0;

        const s3 = await Certificate.deleteMany(certQ).session(session);
        deletedCertificates = s3?.deletedCount ?? 0;
      });

      emitLeaderboardUpdate(req, { academyId, eventId, groupId });

      return res.json({
        ok: true,
        mode: "transaction",
        groupId,
        groupName: group.name,
        eventId: eventId || null,
        deletedScores,
        deletedAwards,
        deletedCertificates,
        participants: participantIds.length,
      });
    } catch (_e) {
      const s1 = await Score.deleteMany(scoreQ);
      const s2 = await Award.deleteMany(awardQ);
      const s3 = await Certificate.deleteMany(certQ);

      emitLeaderboardUpdate(req, { academyId, eventId, groupId });

      return res.json({
        ok: true,
        mode: "no-transaction-fallback",
        warn: "Mongo transactions not enabled (standalone).",
        groupId,
        groupName: group.name,
        eventId: eventId || null,
        deletedScores: s1?.deletedCount ?? 0,
        deletedAwards: s2?.deletedCount ?? 0,
        deletedCertificates: s3?.deletedCount ?? 0,
        participants: participantIds.length,
      });
    } finally {
      session.endSession();
    }
  }),
);

/* =========================
 * Activities
 * ========================= */
router.get(
  "/activities",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const rows = await Activity.find({ academyId }).sort({ name: 1 }).lean();
    res.json(rows);
  }),
);

router.post(
  "/activities",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { name, maxScore } = z
      .object({ name: z.string().min(1), maxScore: z.number().optional() })
      .parse(req.body);

    const doc = await Activity.create({
      academyId,
      name,
      maxScore: maxScore ?? 10,
    });

    res.json(doc);
  }),
);

router.put(
  "/activities/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { name, maxScore } = z
      .object({ name: z.string().min(1), maxScore: z.number().optional() })
      .parse(req.body);

    const doc = await Activity.findOneAndUpdate(
      { _id: req.params.id, academyId },
      { name, maxScore: maxScore ?? 10 },
      { new: true },
    );

    if (!doc) return res.status(404).json({ message: "Activity not found" });
    res.json(doc);
  }),
);

router.delete(
  "/activities/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const del = await Activity.deleteOne({ _id: req.params.id, academyId });
    if (!del.deletedCount) {
      return res.status(404).json({ message: "Activity not found" });
    }

    res.json({ ok: true });
  }),
); /* =========================
 * Events
 * ========================= */
const EventBaseSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  code: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  status: z
    .enum(["DRAFT", "OPEN", "LIVE", "SCORING", "LOCKED", "CLOSED", "COMPLETED"])
    .optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
  venue: z.string().optional(),
  registrationFee: z.coerce.number().min(0).optional(),
  paymentMethod: z.enum(["CASH"]).optional(),
});

const EventCreateSchema = EventBaseSchema.refine((x) => !!(x.name || x.title), {
  message: "name is required",
  path: ["name"],
});

const EventUpdateSchema = EventBaseSchema;

function deriveStatus(input) {
  const status = String(input.status || "")
    .trim()
    .toUpperCase();

  if (
    [
      "DRAFT",
      "OPEN",
      "LIVE",
      "SCORING",
      "LOCKED",
      "CLOSED",
      "COMPLETED",
    ].includes(status)
  ) {
    return status;
  }

  if (input.isActive === true) return "SCORING";
  if (input.isActive === false) return "CLOSED";

  return "DRAFT";
}

function normalizeEventCode(value = "", fallback = "") {
  return String(value || fallback)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toUpperCase();
}

router.get(
  "/events",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const rows = await Event.find({ academyId }).sort({ createdAt: -1 }).lean();
    res.json(rows);
  }),
);

router.get(
  "/events/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const row = await Event.findOne({ _id: req.params.id, academyId }).lean();
    if (!row) return res.status(404).json({ message: "Event not found" });
    res.json(row);
  }),
);

router.get(
  "/events/:eventId/summary",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { eventId } = req.params;
    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const summary = await eventSummary(academyId, eventId);
    if (!summary) return res.status(404).json({ message: "Event not found" });

    res.json(summary);
  }),
);

router.post(
  "/events",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const input = EventCreateSchema.parse(req.body || {});
    const name = String(input.name || input.title || "").trim();
    const code = normalizeEventCode(input.code, name);

    const startRaw = input.startDate ?? input.startsAt;
    const endRaw = input.endDate ?? input.endsAt;

    const startDate = toDateOrNull(startRaw);
    const endDate = toDateOrNull(endRaw);

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      return res
        .status(400)
        .json({ message: "End date cannot be earlier than start date" });
    }

    const doc = await Event.create({
      academyId,
      name,
      code,
      startDate,
      endDate,
      status: deriveStatus(input),
      notes: String(input.notes || "").trim(),
      venue: String(input.venue || "").trim(),
      registrationFee: input.registrationFee ?? 0,
      paymentMethod: "CASH",
    });

    res.json(doc);
  }),
);

router.put(
  "/events/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const input = EventUpdateSchema.parse(req.body || {});
    const patch = {};

    if (input.name !== undefined || input.title !== undefined) {
      const nm = String(input.name || input.title || "").trim();
      if (!nm) return res.status(400).json({ message: "name is required" });
      patch.name = nm;
    }

    if (input.code !== undefined) {
      patch.code = normalizeEventCode(input.code);
    }

    if (input.notes !== undefined) {
      patch.notes = String(input.notes || "").trim();
    }

    if (input.venue !== undefined) {
      patch.venue = String(input.venue || "").trim();
    }

    if (input.startDate !== undefined || input.startsAt !== undefined) {
      patch.startDate = toDateOrNull(input.startDate ?? input.startsAt);
    }

    if (input.endDate !== undefined || input.endsAt !== undefined) {
      patch.endDate = toDateOrNull(input.endDate ?? input.endsAt);
    }

    const nextStart =
      patch.startDate !== undefined ? patch.startDate : undefined;
    const nextEnd = patch.endDate !== undefined ? patch.endDate : undefined;

    if (nextStart && nextEnd && nextEnd.getTime() < nextStart.getTime()) {
      return res
        .status(400)
        .json({ message: "End date cannot be earlier than start date" });
    }

    if (input.status !== undefined || input.isActive !== undefined) {
      patch.status = deriveStatus(input);
    }

    if (input.registrationFee !== undefined) {
      patch.registrationFee = input.registrationFee;
    }

    patch.paymentMethod = "CASH";

    const doc = await Event.findOneAndUpdate(
      { _id: req.params.id, academyId },
      patch,
      { new: true },
    );

    if (!doc) return res.status(404).json({ message: "Event not found" });
    res.json(doc);
  }),
);

router.delete(
  "/events/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const eventId = req.params.id;
    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const event = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await EventEnrollment.deleteMany({ eventId, academyId }).session(
          session,
        );
        await JudgeAssignment.deleteMany({ eventId, academyId }).session(
          session,
        );
        await Score.deleteMany({ eventId, academyId }).session(session);
        await Award.deleteMany({ eventId, academyId }).session(session);
        await Certificate.deleteMany({ eventId, academyId }).session(session);
        await Payment.deleteMany({ eventId, academyId }).session(session);
        await Event.deleteOne({ _id: eventId, academyId }).session(session);
      });

      emitLeaderboardUpdate(req, { academyId, eventId });
      return res.json({ ok: true, mode: "transaction" });
    } catch (_e) {
      await EventEnrollment.deleteMany({ eventId, academyId });
      await JudgeAssignment.deleteMany({ eventId, academyId });
      await Score.deleteMany({ eventId, academyId });
      await Award.deleteMany({ eventId, academyId });
      await Certificate.deleteMany({ eventId, academyId });
      await Payment.deleteMany({ eventId, academyId });
      await Event.deleteOne({ _id: eventId, academyId });

      emitLeaderboardUpdate(req, { academyId, eventId });
      return res.json({
        ok: true,
        mode: "no-transaction-fallback",
        warn: "Mongo transactions not enabled (standalone).",
      });
    } finally {
      session.endSession();
    }
  }),
);

/* =========================
 * Event enrollments
 * ========================= */
router.get(
  "/events/:eventId/enrollments",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { eventId } = req.params;
    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const event = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });

    const rows = await EventEnrollment.find({ eventId, academyId })
      .populate({
        path: "participantId",
        populate: [
          { path: "userId", select: "name email isActive" },
          { path: "groupId", select: "name level" },
        ],
      })
      .populate("groupId", "name level")
      .lean();

    res.json(rows);
  }),
);

router.post(
  "/events/:eventId/enrollments",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { eventId } = req.params;
    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const event = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });

    const schema = z.object({
      participantId: z.string().min(1).optional(),
      participantIds: z.array(z.string().min(1)).optional(),
      overrides: z
        .record(
          z.object({
            groupId: z.string().optional(),
            bibNo: z.string().optional(),
          }),
        )
        .optional(),
    });

    const body = schema.parse(req.body || {});
    const ids = body.participantIds?.length
      ? body.participantIds
      : body.participantId
        ? [body.participantId]
        : [];

    if (!ids.length) {
      return res.status(400).json({
        message: "participantId or participantIds[] required",
      });
    }

    const uniqueIds = uniqIds(ids);

    const participants = await Participant.find({
      _id: { $in: uniqueIds },
      academyId,
    })
      .select("_id groupId")
      .lean();

    const participantMap = new Map(participants.map((p) => [String(p._id), p]));

    for (const pid of uniqueIds) {
      if (!participantMap.has(String(pid))) {
        return res.status(400).json({
          message: `Participant not found in academy scope: ${pid}`,
        });
      }
    }

    const docs = [];
    for (const pid of uniqueIds) {
      const p = participantMap.get(String(pid));
      const o = (body.overrides && body.overrides[pid]) || {};
      const overrideGroupId = o.groupId || p.groupId || null;

      if (overrideGroupId) {
        const g = await Group.findOne({
          _id: overrideGroupId,
          academyId,
        }).lean();
        if (!g) {
          return res.status(400).json({
            message: `Override group not found in academy scope for participant ${pid}`,
          });
        }
      }

      docs.push({
        academyId,
        eventId,
        participantId: pid,
        groupId: overrideGroupId,
        bibNo: String(o.bibNo || "").trim(),
      });
    }

    let inserted = 0;
    let insertedDocs = [];

    try {
      insertedDocs = await EventEnrollment.insertMany(docs, { ordered: false });
      inserted = insertedDocs?.length ?? 0;
    } catch (e) {
      insertedDocs = e?.insertedDocs || [];
      inserted = insertedDocs?.length ?? 0;
    }

    if (insertedDocs.length && Number(event.registrationFee || 0) > 0) {
      const paymentDocs = insertedDocs.map((row) => ({
        academyId,
        eventId,
        participantId: row.participantId,
        enrollmentId: row._id,
        amount: Number(event.registrationFee || 0),
        currency: "QAR",
        paymentMethod: "CASH",
        paymentStatus: "PENDING",
        notes: "Auto-created from event registration",
      }));

      try {
        await Payment.insertMany(paymentDocs, { ordered: false });
      } catch (_e) {
        // ignore
      }
    }

    emitLeaderboardUpdate(req, { academyId, eventId });

    res.json({
      ok: true,
      requested: docs.length,
      inserted,
    });
  }),
);
router.post(
  "/events/:eventId/enrollments/bulk-remove",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { eventId } = req.params;
    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const body = z
      .object({
        enrollmentIds: z.array(z.string().min(1)).optional(),
        participantIds: z.array(z.string().min(1)).optional(),
      })
      .parse(req.body || {});

    const enrollmentIds = uniqIds(body.enrollmentIds || []);
    const participantIds = uniqIds(body.participantIds || []);

    if (!enrollmentIds.length && !participantIds.length) {
      return res.status(400).json({
        message: "enrollmentIds[] or participantIds[] required",
      });
    }

    const q = { academyId, eventId };
    if (enrollmentIds.length && participantIds.length) {
      q.$or = [
        { _id: { $in: enrollmentIds } },
        { participantId: { $in: participantIds } },
      ];
    } else if (enrollmentIds.length) {
      q._id = { $in: enrollmentIds };
    } else {
      q.participantId = { $in: participantIds };
    }

    const rows = await EventEnrollment.find(q)
      .select("_id participantId")
      .lean();

    const participantIdsToDelete = uniqIds(rows.map((x) => x.participantId));
    const enrollmentIdsToDelete = uniqIds(rows.map((x) => x._id));

    const del = await EventEnrollment.deleteMany(q);

    let deletedPayments = 0;
    if (enrollmentIdsToDelete.length) {
      const paymentDel = await Payment.deleteMany({
        academyId,
        eventId,
        $or: [
          { enrollmentId: { $in: enrollmentIdsToDelete } },
          { participantId: { $in: participantIdsToDelete } },
        ],
      });
      deletedPayments = paymentDel?.deletedCount || 0;
    }

    emitLeaderboardUpdate(req, { academyId, eventId });

    return res.json({
      ok: true,
      deletedEnrollments: del?.deletedCount || 0,
      deletedPayments,
      affectedParticipants: participantIdsToDelete.length,
    });
  }),
);

router.delete(
  "/events/:eventId/enrollments/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { eventId, id } = req.params;

    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const event = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });

    const enrollment = await EventEnrollment.findOne({
      _id: id,
      eventId,
      academyId,
    }).lean();

    if (enrollment) {
      await EventEnrollment.deleteOne({
        _id: id,
        eventId,
        academyId,
      });

      await Payment.deleteMany({
        academyId,
        eventId,
        enrollmentId: enrollment._id,
      });

      emitLeaderboardUpdate(req, { academyId, eventId });
      return res.json({ ok: true, mode: "by-enrollment-id" });
    }

    await EventEnrollment.deleteOne({ participantId: id, eventId, academyId });
    await Payment.deleteMany({
      academyId,
      eventId,
      participantId: id,
    });

    emitLeaderboardUpdate(req, { academyId, eventId });
    return res.json({ ok: true, mode: "by-participant-id" });
  }),
);

/* =========================
 * Users
 * ========================= */
router.post(
  "/users",
  wrap(async (req, res) => {
    const scopedAcademyId = requireScopedAcademy(req, res);
    if (!scopedAcademyId) return;

    const schema = z.object({
      academyId: z.string().optional(),
      name: z.string().min(1),
      email: z.string().email().optional(),
      password: z.string().min(6),
      role: z.enum(["JUDGE", "PARTICIPANT", "PARENT"]),
      mustChangePassword: z.boolean().optional(),
      sendWelcomeEmail: z.boolean().optional(),
      welcomeMeta: z
        .object({
          loginEmail: z.string().optional(),
          temporaryPassword: z.string().optional(),
          parentEmail: z.string().optional(),
          linkedParticipant: z.string().optional(),
        })
        .optional(),
    });

    const {
      academyId: bodyAcademyId,
      name,
      email,
      password,
      role,
      mustChangePassword,
      sendWelcomeEmail,
      welcomeMeta,
    } = schema.parse(req.body || {});

    const academyId =
      req.user?.role === "SUPER_ADMIN" &&
      bodyAcademyId &&
      isValidObjectId(bodyAcademyId)
        ? bodyAcademyId
        : scopedAcademyId;

    if ((role === "JUDGE" || role === "PARENT") && !email) {
      return res.status(400).json({ message: `Email is required for ${role}` });
    }

    const safeEmail =
      (email && email.toLowerCase()) ||
      `participant_${Date.now()}_${Math.floor(Math.random() * 1000)}@noemail.local`;

    const exists = await User.findOne({ academyId, email: safeEmail }).lean();
    if (exists) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      academyId,
      name,
      email: safeEmail,
      passwordHash,
      role,
      mustChangePassword: !!mustChangePassword,
      tempPasswordIssuedAt: mustChangePassword ? new Date() : null,
    });

    if (sendWelcomeEmail) {
      await sendTempPasswordWelcomeEmail({
        user,
        tempPassword: welcomeMeta?.temporaryPassword || password,
        academyId,
        invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
        roleLabel: role,
        participantName: welcomeMeta?.linkedParticipant || name,
      });
    } else {
      await sendAccountInviteEmail({
        user,
        invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
        academyId,
        roleLabel: role,
      });
    }

    res.json({
      id: user._id,
      _id: user._id,
      academyId: user.academyId,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: !!user.mustChangePassword,
      tempPasswordIssuedAt: user.tempPasswordIssuedAt || null,
    });
  }),
);

router.post(
  "/users/:id/send-invite",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const user = await User.findOne({
      _id: req.params.id,
      academyId,
      role: { $in: ["JUDGE", "PARENT", "PARTICIPANT"] },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const result = await sendAccountInviteEmail({
      user,
      invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
      academyId,
      roleLabel: user.role,
    });

    res.json({
      ok: !!result?.ok,
      result,
    });
  }),
);

router.get(
  "/users",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const role = String(req.query?.role || "")
      .trim()
      .toUpperCase();
    const q = { academyId };

    if (role) q.role = role;

    const rows = await User.find(q)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();

    res.json(rows);
  }),
);

router.get(
  "/users/find-by-email",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const email = normalizeEmail(req.query?.email || "");
    const role = String(req.query?.role || "")
      .trim()
      .toUpperCase();

    if (!email) {
      return res.status(400).json({ message: "email query is required" });
    }

    const q = { academyId, email };
    if (role) q.role = role;

    const user = await User.findOne(q).select("-passwordHash").lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  }),
);

router.put(
  "/users/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const schema = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      isActive: z.boolean().optional(),
    });

    const payload = schema.parse(req.body);
    if (payload.email) payload.email = payload.email.toLowerCase();

    const u = await User.findOne({ _id: req.params.id, academyId });
    if (!u) return res.status(404).json({ message: "User not found" });
    if (u.role === "ADMIN" || u.role === "SUPER_ADMIN") {
      return res.status(400).json({ message: "Cannot modify admin user" });
    }

    if (payload.email && payload.email !== u.email) {
      const exists = await User.findOne({
        academyId,
        email: payload.email,
        _id: { $ne: u._id },
      }).lean();

      if (exists) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    const updated = await User.findOneAndUpdate(
      { _id: req.params.id, academyId },
      payload,
      { new: true },
    ).select("-passwordHash");

    res.json(updated);
  }),
);

router.delete(
  "/users/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const u = await User.findOne({ _id: req.params.id, academyId });
    if (!u) return res.status(404).json({ message: "User not found" });
    if (u.role === "ADMIN" || u.role === "SUPER_ADMIN") {
      return res.status(400).json({ message: "Cannot delete admin user" });
    }

    u.isActive = false;
    await u.save();
    res.json({ ok: true });
  }),
);

router.get(
  "/judges",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const rows = await User.find({ academyId, role: "JUDGE" })
      .select("-passwordHash")
      .lean();

    res.json(rows);
  }),
);
/* =========================
 * Participants
 * ========================= */
const participantCsvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function parseSimpleCsv(text = "") {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const lines = src.split(/\r?\n/).filter((x) => x.trim() !== "");
  if (!lines.length) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur);
    return out.map((x) => String(x || "").trim());
  };

  const headers = parseLine(lines[0]).map((h) => String(h || "").trim());
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}
router.get(
  "/participants/sample-csv",
  wrap(async (_req, res) => {
    const csv = [
      [
        "name",
        "email",
        "password",
        "groupName",
        "groupLevel",
        "age",
        "bibNo",
      ].join(","),
      [
        '"Jane Doe"',
        '"jane@example.com"',
        '"123456"',
        '"Intermediate A"',
        '"Level 2"',
        "9",
        '"BIB-001"',
      ].join(","),
      [
        '"Sara Ali"',
        '"sara@example.com"',
        '"123456"',
        '"Intermediate B"',
        '"Level 1"',
        "8",
        '"BIB-002"',
      ].join(","),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="participants_sample.csv"',
    );
    res.end(csv);
  }),
);
router.post(
  "/participants/import-csv",
  participantCsvUpload.single("file"),
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    if (!req.file?.buffer) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const { headers, rows } = parseSimpleCsv(req.file.buffer.toString("utf8"));
    if (!headers.length) {
      return res.status(400).json({ message: "CSV is empty" });
    }

    const idx = (name) =>
      headers.findIndex(
        (h) =>
          String(h || "")
            .trim()
            .toLowerCase() === name,
      );

    const iName = idx("name");
    const iEmail = idx("email");
    const iPassword = idx("password");
    const iParentEmail = idx("parentemail");
    const iParentPassword = idx("parentpassword");
    const iGroupName = idx("group");
    const fallbackGroupName = idx("groupname");
    const iGroupLevel = idx("level");
    const fallbackGroupLevel = idx("grouplevel");
    const iAge = idx("age");
    const iBibNo = idx("bibno");

    const finalGroupNameIndex =
      iGroupName >= 0 ? iGroupName : fallbackGroupName;
    const finalGroupLevelIndex =
      iGroupLevel >= 0 ? iGroupLevel : fallbackGroupLevel;

    if (iName === -1 || finalGroupNameIndex === -1) {
      return res.status(400).json({
        message: "CSV must include at least name and group/groupName columns",
      });
    }

    const results = [];
    let createdUsers = 0;
    let createdParticipants = 0;

    for (let r = 0; r < rows.length; r += 1) {
      const rowNo = r + 2;
      const row = rows[r];

      const name = String(row[iName] || "").trim();
      const email =
        iEmail >= 0
          ? String(row[iEmail] || "")
              .trim()
              .toLowerCase()
          : "";
      const password =
        iPassword >= 0 ? String(row[iPassword] || "").trim() : "123456";
      const parentEmail =
        iParentEmail >= 0
          ? String(row[iParentEmail] || "")
              .trim()
              .toLowerCase()
          : "";
      const parentPassword =
        iParentPassword >= 0
          ? String(row[iParentPassword] || "").trim()
          : "Parent@12345";
      const groupName = String(row[finalGroupNameIndex] || "").trim();
      const groupLevel =
        finalGroupLevelIndex >= 0
          ? String(row[finalGroupLevelIndex] || "").trim()
          : "";
      const ageRaw = iAge >= 0 ? String(row[iAge] || "").trim() : "";
      const bibNo = iBibNo >= 0 ? String(row[iBibNo] || "").trim() : "";

      if (!name || !groupName) {
        results.push({
          row: rowNo,
          ok: false,
          message: "Missing required fields: name/group",
        });
        continue;
      }

      let group = await Group.findOne({
        academyId,
        name: groupName,
        ...(groupLevel ? { level: groupLevel } : {}),
      }).lean();

      if (!group) {
        group = await Group.create({
          academyId,
          name: groupName,
          level: groupLevel || "",
        });
      }

      let finalEmail =
        email ||
        `participant_${Date.now()}_${r}_${Math.floor(Math.random() * 1000)}@noemail.local`;

      const existingEmailUser = await User.findOne({
        academyId,
        email: finalEmail,
      }).lean();

      if (existingEmailUser && email) {
        results.push({
          row: rowNo,
          ok: false,
          message: `Email already exists: ${email}`,
        });
        continue;
      }

      if (existingEmailUser && !email) {
        finalEmail = `participant_${Date.now()}_${r}_${Math.floor(Math.random() * 100000)}@noemail.local`;
      }

      const parsedAge =
        ageRaw === ""
          ? null
          : Number.isFinite(Number(ageRaw))
            ? Number(ageRaw)
            : null;

      const user = await User.create({
        academyId,
        name,
        email: finalEmail,
        passwordHash: await bcrypt.hash(password || "123456", 10),
        role: "PARTICIPANT",
        mustChangePassword: true,
        tempPasswordIssuedAt: new Date(),
      });
      createdUsers += 1;

      await sendTempPasswordWelcomeEmail({
        user,
        tempPassword: password || "123456",
        academyId,
        invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
        roleLabel: "PARTICIPANT",
        participantName: name,
      });

      const parentLink = await resolveParentLink({
        academyId,
        parentEmail,
        tempPassword: parentPassword || "Parent@12345",
        invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
        participantName: name,
        sendWelcomeEmail: true,
      });

      await Participant.create({
        academyId,
        userId: user._id,
        groupId: group._id,
        age: parsedAge,
        bibNo,
        parentUserId: parentLink.parentUserId || null,
        parentEmail: parentLink.parentEmail || "",
      });
      createdParticipants += 1;

      results.push({
        row: rowNo,
        ok: true,
        name,
        email: finalEmail,
        parentEmail: parentLink.parentEmail || "",
        groupName,
      });
    }

    res.json({
      ok: true,
      totalRows: rows.length,
      createdUsers,
      createdParticipants,
      failed: results.filter((x) => !x.ok).length,
      results,
    });
  }),
);

router.post(
  "/participants",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const body = req.body || {};
    const hasProfileMode = !!body.userId;

    if (hasProfileMode) {
      const schema = z.object({
        userId: z.string().min(1),
        groupId: z.string().min(1),
        age: z.number().nullable().optional(),
        bibNo: z.string().optional(),
        parentUserId: z.string().nullable().optional(),
        parentEmail: z.string().email().optional().or(z.literal("")),
      });

      const { userId, groupId, age, bibNo, parentUserId, parentEmail } =
        schema.parse(body);

      const user = await User.findOne({
        _id: userId,
        academyId,
        role: "PARTICIPANT",
      }).lean();
      if (!user) {
        return res.status(404).json({ message: "Participant user not found" });
      }

      const group = await Group.findOne({ _id: groupId, academyId }).lean();
      if (!group) return res.status(404).json({ message: "Group not found" });

      if (parentUserId) {
        const parentUser = await User.findOne({
          _id: parentUserId,
          academyId,
          role: "PARENT",
        }).lean();

        if (!parentUser) {
          return res.status(404).json({ message: "Parent user not found" });
        }
      }

      const existing = await Participant.findOne({ userId, academyId }).lean();
      if (existing) {
        return res
          .status(400)
          .json({ message: "Participant profile already exists" });
      }

      const participantUser = await User.findById(userId).lean();

      const parentLink = await resolveParentLink({
        academyId,
        parentUserId,
        parentEmail,
        tempPassword: "Parent@12345",
        invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
        participantName: participantUser?.name || "",
        sendWelcomeEmail: true,
      });

      const doc = await Participant.create({
        academyId,
        userId,
        groupId,
        age: age ?? null,
        bibNo: (bibNo || "").trim(),
        parentUserId: parentLink.parentUserId || null,
        parentEmail: parentLink.parentEmail || "",
      });

      const populated = await Participant.findById(doc._id)
        .populate("userId", "name email isActive")
        .populate("groupId", "name level")
        .populate("parentUserId", "name email isActive")
        .lean();

      return res.json(populated);
    }

    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      groupId: z.string().min(1),
      age: z.number().nullable().optional(),
      bibNo: z.string().optional(),
      parentUserId: z.string().nullable().optional(),
      parentEmail: z.string().email().optional().or(z.literal("")),
      parentPassword: z.string().min(6).optional(),
    });

    const {
      name,
      email,
      password,
      groupId,
      age,
      bibNo,
      parentUserId,
      parentEmail,
      parentPassword,
    } = schema.parse(body);

    const group = await Group.findOne({ _id: groupId, academyId }).lean();
    if (!group) return res.status(404).json({ message: "Group not found" });

    const finalEmail =
      (email && email.toLowerCase()) ||
      `participant_${Date.now()}_${Math.floor(Math.random() * 1000)}@noemail.local`;

    const exists = await User.findOne({ academyId, email: finalEmail }).lean();
    if (exists) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const user = await User.create({
      academyId,
      name,
      email: finalEmail,
      passwordHash: await bcrypt.hash(password || "123456", 10),
      role: "PARTICIPANT",
      mustChangePassword: true,
      tempPasswordIssuedAt: new Date(),
    });

    await sendTempPasswordWelcomeEmail({
      user,
      tempPassword: password || "123456",
      academyId,
      invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
      roleLabel: "PARTICIPANT",
      participantName: name,
    });

    const parentLink = await resolveParentLink({
      academyId,
      parentUserId,
      parentEmail,
      tempPassword: parentPassword || "Parent@12345",
      invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
      participantName: name,
      sendWelcomeEmail: true,
    });

    const participant = await Participant.create({
      academyId,
      userId: user._id,
      groupId,
      age: age ?? null,
      bibNo: (bibNo || "").trim(),
      parentUserId: parentLink.parentUserId || null,
      parentEmail: parentLink.parentEmail || "",
    });

    const populated = await Participant.findById(participant._id)
      .populate("userId", "name email isActive")
      .populate("groupId", "name level")
      .populate("parentUserId", "name email isActive")
      .lean();

    res.json(populated);
  }),
);

router.get(
  "/participants",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const eventId = String(req.query?.eventId || "").trim();

    const rows = await Participant.find({ academyId })
      .populate("userId", "name email isActive")
      .populate("groupId", "name level")
      .populate("parentUserId", "name email isActive")
      .lean();

    let payments = [];
    if (eventId && isValidObjectId(eventId)) {
      payments = await Payment.find({
        academyId,
        eventId,
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    const paymentMap = new Map();
    for (const p of payments) {
      const key = String(p.participantId || "");
      if (key && !paymentMap.has(key)) {
        paymentMap.set(key, p);
      }
    }

    const enriched = rows.map((row) => ({
      ...row,
      payment: paymentMap.get(String(row._id)) || null,
    }));

    res.json(enriched);
  }),
);

router.get(
  "/participants/export",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const eventId = String(req.query?.eventId || "").trim();

    const rows = await Participant.find({ academyId })
      .populate("userId", "name email isActive")
      .populate("groupId", "name level")
      .populate("parentUserId", "name email isActive")
      .lean();

    let payments = [];
    if (eventId && isValidObjectId(eventId)) {
      payments = await Payment.find({
        academyId,
        eventId,
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    const paymentMap = new Map();
    for (const p of payments) {
      const key = String(p.participantId || "");
      if (key && !paymentMap.has(key)) {
        paymentMap.set(key, p);
      }
    }

    const csv = [
      [
        "participantId",
        "userId",
        "name",
        "email",
        "isActive",
        "parentUserId",
        "parentEmail",
        "groupId",
        "groupName",
        "level",
        "age",
        "bibNo",
        "paymentStatus",
        "paymentAmount",
        "paymentMethod",
        "currency",
      ].join(","),
      ...rows.map((row) => {
        const payment = paymentMap.get(String(row._id)) || null;

        return [
          `"${String(row._id)}"`,
          `"${String(row.userId?._id || "")}"`,
          `"${String(row.userId?.name || "").replace(/"/g, '""')}"`,
          `"${String(row.userId?.email || "").replace(/"/g, '""')}"`,
          `"${row.userId?.isActive === false ? "false" : "true"}"`,
          `"${String(row.parentUserId?._id || "")}"`,
          `"${String(row.parentEmail || row.parentUserId?.email || "").replace(
            /"/g,
            '""',
          )}"`,
          `"${String(row.groupId?._id || "")}"`,
          `"${String(row.groupId?.name || "").replace(/"/g, '""')}"`,
          `"${String(row.groupId?.level || "").replace(/"/g, '""')}"`,
          `"${row.age ?? ""}"`,
          `"${String(row.bibNo || "").replace(/"/g, '""')}"`,
          `"${String(payment?.paymentStatus || "").replace(/"/g, '""')}"`,
          `"${payment?.amount ?? ""}"`,
          `"${String(payment?.paymentMethod || "").replace(/"/g, '""')}"`,
          `"${String(payment?.currency || "").replace(/"/g, '""')}"`,
        ].join(",");
      }),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="participants_export.csv"',
    );
    res.end(csv);
  }),
);

router.put(
  "/participants/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const schema = z.object({
      groupId: z.string().min(1),
      age: z.number().nullable().optional(),
      bibNo: z.string().optional(),
      parentUserId: z.string().nullable().optional(),
      parentEmail: z.string().email().optional().or(z.literal("")),
    });

    const { groupId, age, bibNo, parentUserId, parentEmail } = schema.parse(
      req.body || {},
    );

    const group = await Group.findOne({ _id: groupId, academyId }).lean();
    if (!group) return res.status(404).json({ message: "Group not found" });

    const participant = await Participant.findOne({
      _id: req.params.id,
      academyId,
    }).lean();

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    const parentLink = await resolveParentLink({
      academyId,
      parentUserId,
      parentEmail,
    });

    const doc = await Participant.findOneAndUpdate(
      { _id: req.params.id, academyId },
      {
        groupId,
        age: age ?? null,
        bibNo: (bibNo || "").trim(),
        parentUserId: parentLink.parentUserId || null,
        parentEmail: parentLink.parentEmail || "",
      },
      { new: true },
    )
      .populate("userId", "name email isActive")
      .populate("groupId", "name level")
      .populate("parentUserId", "name email isActive");

    if (parentLink?.createdParentUser && parentLink?.parentUser) {
      await sendAccountInviteEmail({
        user: parentLink.parentUser,
        invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
        academyId,
        roleLabel: "PARENT",
      });
    }

    res.json(doc);
  }),
);

router.post(
  "/participants/bulk-archive",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { participantIds } = z
      .object({
        participantIds: z.array(z.string().min(1)).min(1),
      })
      .parse(req.body || {});

    const ids = uniqIds(participantIds);

    const participants = await Participant.find({
      _id: { $in: ids },
      academyId,
    })
      .select("userId")
      .lean();

    const userIds = participants
      .map((p) => p.userId)
      .filter(Boolean)
      .map((id) => String(id));

    const result = userIds.length
      ? await User.updateMany(
          {
            _id: { $in: userIds },
            academyId,
            role: "PARTICIPANT",
          },
          { $set: { isActive: false } },
        )
      : { modifiedCount: 0 };

    res.json({
      ok: true,
      matchedParticipants: participants.length,
      affectedUsers: result?.modifiedCount ?? 0,
    });
  }),
);

router.post(
  "/participants/bulk-unarchive",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { participantIds } = z
      .object({
        participantIds: z.array(z.string().min(1)).min(1),
      })
      .parse(req.body || {});

    const ids = uniqIds(participantIds);

    const participants = await Participant.find({
      _id: { $in: ids },
      academyId,
    })
      .select("userId")
      .lean();

    const userIds = participants
      .map((p) => p.userId)
      .filter(Boolean)
      .map((id) => String(id));

    const result = userIds.length
      ? await User.updateMany(
          {
            _id: { $in: userIds },
            academyId,
            role: "PARTICIPANT",
          },
          { $set: { isActive: true } },
        )
      : { modifiedCount: 0 };

    res.json({
      ok: true,
      matchedParticipants: participants.length,
      affectedUsers: result?.modifiedCount ?? 0,
    });
  }),
);
router.post(
  "/participants/bulk-delete",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { participantIds } = z
      .object({
        participantIds: z.array(z.string().min(1)).min(1),
      })
      .parse(req.body || {});

    const ids = uniqIds(participantIds);

    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await bulkDeleteParticipantsAndUsers({
          academyId,
          participantIds: ids,
          deleteUsers: false,
          session,
        });
      });

      emitLeaderboardUpdate(req, { academyId });
      res.json({
        ok: true,
        mode: "transaction",
        ...result,
      });
    } catch (_e) {
      const result = await bulkDeleteParticipantsAndUsers({
        academyId,
        participantIds: ids,
        deleteUsers: false,
      });

      emitLeaderboardUpdate(req, { academyId });
      res.json({
        ok: true,
        mode: "no-transaction-fallback",
        warn: "Mongo transactions not enabled (standalone).",
        ...result,
      });
    } finally {
      session.endSession();
    }
  }),
);

router.post(
  "/participants/bulk-full-delete",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { participantIds } = z
      .object({
        participantIds: z.array(z.string().min(1)).min(1),
      })
      .parse(req.body || {});

    const ids = uniqIds(participantIds);

    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await bulkDeleteParticipantsAndUsers({
          academyId,
          participantIds: ids,
          deleteUsers: true,
          session,
        });
      });

      emitLeaderboardUpdate(req, { academyId });
      res.json({
        ok: true,
        mode: "transaction",
        ...result,
      });
    } catch (_e) {
      const result = await bulkDeleteParticipantsAndUsers({
        academyId,
        participantIds: ids,
        deleteUsers: true,
      });

      emitLeaderboardUpdate(req, { academyId });
      res.json({
        ok: true,
        mode: "no-transaction-fallback",
        warn: "Mongo transactions not enabled (standalone).",
        ...result,
      });
    } finally {
      session.endSession();
    }
  }),
);

router.delete(
  "/participants/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const del = await Participant.deleteOne({ _id: req.params.id, academyId });
    if (!del.deletedCount) {
      return res.status(404).json({ message: "Participant not found" });
    }

    await EventEnrollment.deleteMany({
      participantId: req.params.id,
      academyId,
    });
    await Score.deleteMany({ participantId: req.params.id, academyId });
    await Award.deleteMany({ participantId: req.params.id, academyId });
    await Certificate.deleteMany({ participantId: req.params.id, academyId });
    await Payment.deleteMany({ participantId: req.params.id, academyId });

    emitLeaderboardUpdate(req, { academyId });
    res.json({ ok: true });
  }),
);

router.delete(
  "/participants/:id/full",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const participantId = req.params.id;

    const p = await Participant.findOne({
      _id: participantId,
      academyId,
    }).lean();
    if (!p) return res.status(404).json({ message: "Participant not found" });

    const userId = p.userId;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Participant.deleteOne({ _id: participantId, academyId }).session(
          session,
        );
        await EventEnrollment.deleteMany({ participantId, academyId }).session(
          session,
        );
        await Score.deleteMany({ participantId, academyId }).session(session);
        await Award.deleteMany({ participantId, academyId }).session(session);
        await Certificate.deleteMany({ participantId, academyId }).session(
          session,
        );
        await Payment.deleteMany({ participantId, academyId }).session(session);
        if (userId) {
          await User.deleteOne({ _id: userId, academyId }).session(session);
        }
      });

      emitLeaderboardUpdate(req, { academyId });
      return res.json({
        ok: true,
        mode: "transaction",
        deletedUserId: String(userId || ""),
      });
    } catch (_e) {
      await Participant.deleteOne({ _id: participantId, academyId });
      await EventEnrollment.deleteMany({ participantId, academyId });
      await Score.deleteMany({ participantId, academyId });
      await Award.deleteMany({ participantId, academyId });
      await Certificate.deleteMany({ participantId, academyId });
      await Payment.deleteMany({ participantId, academyId });
      if (userId) await User.deleteOne({ _id: userId, academyId });

      emitLeaderboardUpdate(req, { academyId });
      return res.json({
        ok: true,
        mode: "no-transaction-fallback",
        deletedUserId: String(userId || ""),
        warn: "Mongo transactions not enabled (standalone).",
      });
    } finally {
      session.endSession();
    }
  }),
);

router.post(
  "/participants/profile",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const schema = z.object({
      userId: z.string().min(1),
      groupId: z.string().min(1),
      age: z.any().optional(),
      bibNo: z.string().optional(),
      parentUserId: z.string().nullable().optional(),
      parentEmail: z.string().optional(),
    });

    const { userId, groupId, age, bibNo, parentUserId, parentEmail } =
      schema.parse(req.body || {});

    const parsedAge = normalizeOptionalAge(age);
    if (
      age !== "" &&
      age !== null &&
      age !== undefined &&
      parsedAge === undefined
    ) {
      return res
        .status(400)
        .json({ message: "Age must be a valid non-negative number" });
    }

    const user = await User.findOne({
      _id: userId,
      academyId,
      role: "PARTICIPANT",
    }).lean();
    if (!user) {
      return res.status(404).json({ message: "Participant user not found" });
    }

    const group = await Group.findOne({ _id: groupId, academyId }).lean();
    if (!group) return res.status(404).json({ message: "Group not found" });

    const existing = await Participant.findOne({ userId, academyId }).lean();
    if (existing) {
      return res
        .status(400)
        .json({ message: "Participant profile already exists" });
    }

    const parentLink = await resolveParentLink({
      academyId,
      parentUserId,
      parentEmail,
      tempPassword: "Parent@12345",
      invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
      participantName: user?.name || "",
      sendWelcomeEmail: true,
    });

    const doc = await Participant.create({
      academyId,
      userId,
      groupId,
      age: parsedAge,
      bibNo: bibNo ?? "",
      parentUserId: parentLink.parentUserId || null,
      parentEmail: parentLink.parentEmail || "",
    });

    const populated = await Participant.findById(doc._id)
      .populate("userId", "name email isActive")
      .populate("groupId", "name level")
      .populate("parentUserId", "name email role isActive")
      .lean();

    res.json(populated);
  }),
);

router.patch(
  "/participants/profile/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const schema = z.object({
      groupId: z.string().min(1),
      age: z.any().optional(),
      bibNo: z.string().optional(),
      parentUserId: z.string().nullable().optional(),
      parentEmail: z.string().optional(),
    });

    const { groupId, age, bibNo, parentUserId, parentEmail } = schema.parse(
      req.body || {},
    );

    const parsedAge = normalizeOptionalAge(age);
    if (
      age !== "" &&
      age !== null &&
      age !== undefined &&
      parsedAge === undefined
    ) {
      return res
        .status(400)
        .json({ message: "Age must be a valid non-negative number" });
    }

    const group = await Group.findOne({ _id: groupId, academyId }).lean();
    if (!group) return res.status(404).json({ message: "Group not found" });

    const participant = await Participant.findOne({
      _id: req.params.id,
      academyId,
    })
      .populate("userId", "name email")
      .lean();

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    const parentLink = await resolveParentLink({
      academyId,
      parentUserId,
      parentEmail,
      tempPassword: "Parent@12345",
      invitedBy: req.user?.name || req.user?.email || "Rebel Angels",
      participantName: participant?.userId?.name || "",
      sendWelcomeEmail: true,
    });

    const doc = await Participant.findOneAndUpdate(
      { _id: req.params.id, academyId },
      {
        groupId,
        age: parsedAge,
        bibNo: bibNo ?? "",
        parentUserId: parentLink.parentUserId || null,
        parentEmail: parentLink.parentEmail || "",
      },
      { new: true },
    )
      .populate("userId", "name email isActive")
      .populate("groupId", "name level")
      .populate("parentUserId", "name email role isActive");

    res.json(doc);
  }),
);

/* =========================
 * Assignments
 * ========================= */
router.get(
  "/judge-assignments",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const eventId = String(req.query.eventId || "").trim();
    const q = { academyId };
    if (eventId) q.eventId = eventId;

    const rows = await JudgeAssignment.find(q)
      .populate("eventId", "name status startDate endDate")
      .populate("judgeUserId", "name email")
      .populate("activityId", "name maxScore")
      .populate("groupId", "name level")
      .lean();

    res.json(rows);
  }),
);

router.get(
  "/judge-assignments/grouped",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const eventId = String(req.query.eventId || "").trim();
    const q = { academyId };
    if (eventId) q.eventId = eventId;

    const rows = await JudgeAssignment.find(q)
      .populate("eventId", "name status startDate endDate")
      .populate("judgeUserId", "name email")
      .populate("activityId", "name maxScore")
      .populate("groupId", "name level")
      .lean();

    const groupedMap = new Map();

    for (const row of rows) {
      const key = `${row.eventId?._id || row.eventId}::${row.judgeUserId?._id || row.judgeUserId}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          eventId: row.eventId?._id || row.eventId || null,
          event: row.eventId || null,
          judgeUserId: row.judgeUserId?._id || row.judgeUserId || null,
          judge: row.judgeUserId || null,
          groups: [],
          activities: [],
          rows: [],
        });
      }

      const item = groupedMap.get(key);
      item.rows.push(row);

      if (row.groupId) {
        const gid = String(row.groupId._id || row.groupId);
        if (!item.groups.some((g) => String(g._id || g) === gid)) {
          item.groups.push(row.groupId);
        }
      }

      if (row.activityId) {
        const aid = String(row.activityId._id || row.activityId);
        if (!item.activities.some((a) => String(a._id || a) === aid)) {
          item.activities.push(row.activityId);
        }
      }
    }

    res.json([...groupedMap.values()]);
  }),
);

router.put(
  "/judge-assignments/replace",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const schema = z.object({
      eventId: z.string().min(1),
      judgeUserId: z.string().min(1),
      groupIds: z.array(z.string().min(1)).min(1),
      activityIds: z.array(z.string().min(1)).min(1),
      level: z.string().optional(),
    });

    const { eventId, judgeUserId, groupIds, activityIds, level } = schema.parse(
      req.body || {},
    );

    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }
    if (!isValidObjectId(judgeUserId)) {
      return res.status(400).json({ message: "Invalid judgeUserId" });
    }

    for (const gid of groupIds) {
      if (!isValidObjectId(gid)) {
        return res.status(400).json({ message: `Invalid groupId: ${gid}` });
      }
    }
    for (const aid of activityIds) {
      if (!isValidObjectId(aid)) {
        return res.status(400).json({ message: `Invalid activityId: ${aid}` });
      }
    }

    await ensureSameAcademyRefs({ academyId, eventId, judgeUserId });

    const groups = await Group.find({
      _id: { $in: groupIds },
      academyId,
    })
      .select("_id")
      .lean();
    if (groups.length !== groupIds.length) {
      return res
        .status(400)
        .json({ message: "One or more groups are outside academy scope" });
    }

    const acts = await Activity.find({
      _id: { $in: activityIds },
      academyId,
    })
      .select("_id")
      .lean();
    if (acts.length !== activityIds.length) {
      return res
        .status(400)
        .json({ message: "One or more activities are outside academy scope" });
    }

    const docs = [];
    for (const a of activityIds) {
      for (const g of groupIds) {
        docs.push({
          academyId,
          eventId,
          judgeUserId,
          activityId: a,
          groupId: g,
          level: level || "",
        });
      }
    }

    const session = await mongoose.startSession();
    try {
      let deleted = 0;
      let inserted = 0;

      await session.withTransaction(async () => {
        const del = await JudgeAssignment.deleteMany({
          academyId,
          eventId,
          judgeUserId,
        }).session(session);
        deleted = del?.deletedCount ?? 0;

        if (docs.length) {
          const ins = await JudgeAssignment.insertMany(docs, {
            ordered: false,
            session,
          });
          inserted = ins?.length ?? 0;
        }
      });

      return res.json({
        ok: true,
        mode: "replace-transaction",
        academyId,
        eventId,
        judgeUserId,
        deleted,
        inserted,
        expectedRows: docs.length,
      });
    } catch (_e) {
      const del = await JudgeAssignment.deleteMany({
        academyId,
        eventId,
        judgeUserId,
      });

      let inserted = 0;
      if (docs.length) {
        try {
          const ins = await JudgeAssignment.insertMany(docs, {
            ordered: false,
          });
          inserted = ins?.length ?? 0;
        } catch (_e2) {
          // ignore
        }
      }

      return res.json({
        ok: true,
        mode: "replace-no-transaction-fallback",
        warn: "Mongo transactions not enabled (standalone).",
        academyId,
        eventId,
        judgeUserId,
        deleted: del?.deletedCount ?? 0,
        inserted,
        expectedRows: docs.length,
      });
    } finally {
      session.endSession();
    }
  }),
);
router.post(
  "/judge-assignments",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const schema = z.object({
      eventId: z.string().min(1),
      judgeUserId: z.string().min(1),
      activityId: z.string().min(1).optional(),
      groupId: z.string().optional(),
      activityIds: z.array(z.string().min(1)).optional(),
      groupIds: z.array(z.string().min(1)).optional(),
      level: z.string().optional(),
    });

    const payload = schema.parse(req.body);

    if (!isValidObjectId(payload.eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const eventId = payload.eventId;
    const judgeUserId = payload.judgeUserId;
    const level = payload.level || "";

    await ensureSameAcademyRefs({ academyId, eventId, judgeUserId });

    const groups = payload.groupIds?.length
      ? payload.groupIds
      : payload.groupId
        ? [payload.groupId]
        : [];

    const acts = payload.activityIds?.length
      ? payload.activityIds
      : payload.activityId
        ? [payload.activityId]
        : [];

    if (groups.length) {
      const foundGroups = await Group.find({
        _id: { $in: groups },
        academyId,
      })
        .select("_id")
        .lean();

      if (foundGroups.length !== groups.length) {
        return res
          .status(400)
          .json({ message: "One or more groups are outside academy scope" });
      }
    }

    if (acts.length) {
      const foundActivities = await Activity.find({
        _id: { $in: acts },
        academyId,
      })
        .select("_id")
        .lean();

      if (foundActivities.length !== acts.length) {
        return res.status(400).json({
          message: "One or more activities are outside academy scope",
        });
      }
    }

    if (groups.length && acts.length) {
      const docs = [];
      for (const g of groups) {
        for (const a of acts) {
          docs.push({
            academyId,
            eventId,
            judgeUserId,
            groupId: g || null,
            activityId: a,
            level,
          });
        }
      }

      let inserted = 0;
      try {
        const result = await JudgeAssignment.insertMany(docs, {
          ordered: false,
        });
        inserted = result?.length ?? 0;
      } catch (_e) {
        // ignore
      }

      return res.json({
        ok: true,
        mode: "multi-cross",
        requested: docs.length,
        inserted,
      });
    }

    if (!groups.length && acts.length) {
      const docs = acts.map((a) => ({
        academyId,
        eventId,
        judgeUserId,
        activityId: a,
        groupId: null,
        level,
      }));

      let inserted = 0;
      try {
        const result = await JudgeAssignment.insertMany(docs, {
          ordered: false,
        });
        inserted = result?.length ?? 0;
      } catch (_e) {
        // ignore
      }

      return res.json({
        ok: true,
        mode: "multi-activities-only",
        requested: docs.length,
        inserted,
      });
    }

    if (groups.length && !acts.length) {
      return res.status(400).json({
        message: "Select at least 1 activity",
      });
    }

    return res.status(400).json({
      message: "Provide activityId/activityIds and optionally groupId/groupIds",
    });
  }),
);

router.delete(
  "/judge-assignments/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const doc = await JudgeAssignment.findOne({
      _id: req.params.id,
      academyId,
    });
    if (!doc) return res.status(404).json({ message: "Assignment not found" });

    await JudgeAssignment.deleteOne({ _id: req.params.id, academyId });
    res.json({ ok: true });
  }),
);

/* =========================
 * Totals legacy
 * ========================= */
router.get(
  "/totals/group/:groupId",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { groupId } = req.params;
    const eventId = String(req.query?.eventId || "").trim();

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid groupId" });
    }

    if (eventId && !isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const group = await Group.findOne({
      _id: groupId,
      academyId,
    }).lean();

    if (!group) return res.status(404).json({ message: "Group not found" });

    if (eventId) {
      const event = await Event.findOne({
        _id: eventId,
        academyId,
      })
        .select("_id name status")
        .lean();

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
    }

    const result = await computeTotalsForGroup(groupId, {
      academyId,
      eventId: eventId || null,
    });

    return res.json(result);
  }),
);

router.get(
  "/events/:eventId/leaderboard",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { eventId } = req.params;
    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const eventObjId = asObjectId(eventId);

    const event = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });

    const enrollments = await EventEnrollment.find({
      eventId: eventObjId,
      academyId,
    }).lean();
    const participantIds = enrollments.map((e) => e.participantId);
    if (!participantIds.length) return res.json([]);

    const participants = await Participant.find({
      _id: { $in: participantIds },
      academyId,
    })
      .populate("userId", "name")
      .populate("groupId", "name level")
      .lean();

    const totals = await Score.aggregate([
      {
        $match: {
          academyId: asObjectId(academyId),
          eventId: eventObjId,
          participantId: { $in: participantIds },
          status: "SCORED",
          value: { $ne: null },
        },
      },
      { $group: { _id: "$participantId", total: { $sum: "$value" } } },
    ]);

    const totalMap = new Map(
      totals.map((t) => [String(t._id), Number(t.total || 0)]),
    );

    const medals = await Award.find({
      academyId,
      eventId,
      type: "MEDAL",
    }).lean();

    const medalMap = new Map(
      medals.map((a) => [String(a.participantId), a.title || ""]),
    );

    const enrMap = new Map(
      enrollments.map((e) => [String(e.participantId), e]),
    );

    const out = participants
      .map((p) => {
        const enr = enrMap.get(String(p._id));
        const bibNo = String(enr?.bibNo || p.bibNo || "").trim();
        const medal = medalMap.get(String(p._id)) || "";

        return {
          participantId: p._id,
          academyId,
          name: p.userId?.name || "",
          groupName: p.groupId?.name || "",
          level: p.groupId?.level || "",
          bibNo,
          total: totalMap.get(String(p._id)) || 0,
          medal,
        };
      })
      .sort((a, b) => (b.total || 0) - (a.total || 0));

    res.json(out);
  }),
);

/* =========================
 * Awards
 * ========================= */
router.post(
  "/awards",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { eventId, participantId, type, title } = z
      .object({
        eventId: z.string().min(1),
        participantId: z.string().min(1),
        type: z.enum(["MEDAL", "CERTIFICATE"]),
        title: z.string().optional(),
      })
      .parse(req.body);

    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const eventDoc = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!eventDoc) return res.status(404).json({ message: "Event not found" });

    const participant = await Participant.findOne({
      _id: participantId,
      academyId,
    })
      .populate("userId", "name email")
      .populate("groupId", "name level")
      .populate("parentUserId", "name email");

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    const award = await Award.create({
      academyId,
      eventId,
      participantId,
      type,
      title: title ?? "",
    });

    if (type === "CERTIFICATE") {
      const cert = await ensureCertificateRecord({
        academyId,
        eventId,
        participant,
        awardId: award._id,
        title: title ?? "PARTICIPATION AWARD",
        type: "CERTIFICATE",
        eventName: eventDoc.name,
      });

      const token = signCertificatePayload({
        serialNo: cert.serialNo,
        academyId: String(academyId),
        eventId: String(eventId),
        participantId: String(participant._id),
        issuedAt: cert.issuedAt.toISOString(),
      });

      await Certificate.updateOne(
        { _id: cert._id, academyId },
        { $set: { meta: { ...(cert.meta || {}), token } } },
      );

      const verifyUrl = buildVerifyUrl(req, token);
      const certificateUrl = buildAppUrl(
        `/api/admin/events/${eventId}/certificate/${participantId}.pdf`,
      );

      await sendCertificateReadyEmail({
        academyId,
        participant,
        eventDoc,
        cert: {
          ...cert.toObject(),
          meta: { ...(cert.meta || {}), token },
        },
        verifyUrl,
        certificateUrl,
      }).catch((err) => {
        console.error(
          "Certificate ready email send failed after award create:",
          err?.message || err,
        );
      });
    }

    emitLeaderboardUpdate(req, {
      academyId,
      eventId,
      groupId: participant.groupId?._id || participant.groupId || null,
    });

    res.json(award);
  }),
);

router.get(
  "/awards",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const limit = Math.min(Number(req.query.limit || 50), 500);
    const eventId = String(req.query.eventId || "").trim();

    const q = { academyId };
    if (eventId) q.eventId = eventId;

    const rows = await Award.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: "participantId",
        populate: [
          { path: "userId", select: "name email isActive" },
          { path: "groupId", select: "name level" },
        ],
      })
      .populate("eventId", "name status")
      .lean();

    res.json(rows);
  }),
);

router.delete(
  "/awards/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const award = await Award.findOne({ _id: req.params.id, academyId }).lean();
    if (!award) return res.status(404).json({ message: "Award not found" });

    await Award.deleteOne({ _id: req.params.id, academyId });
    emitLeaderboardUpdate(req, { academyId, eventId: award.eventId });

    res.json({ ok: true });
  }),
);

/* =========================
 * Certificate registry
 * ========================= */
router.get(
  "/certificates",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const limit = Math.min(Number(req.query.limit || 200), 500);
    const eventId = String(req.query.eventId || "").trim();
    const participantId = String(req.query.participantId || "").trim();
    const serialNo = String(req.query.serialNo || "").trim();

    const q = { academyId };
    if (eventId) q.eventId = eventId;
    if (participantId) q.participantId = participantId;
    if (serialNo) q.serialNo = serialNo;

    const rows = await Certificate.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: "participantId",
        populate: [
          { path: "userId", select: "name email isActive" },
          { path: "groupId", select: "name level" },
        ],
      })
      .populate("eventId", "name status")
      .lean();

    res.json(rows);
  }),
);

router.get(
  "/certificates/:serialNo",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const serialNo = String(req.params.serialNo || "").trim();

    const row = await Certificate.findOne({ academyId, serialNo })
      .populate({
        path: "participantId",
        populate: [
          { path: "userId", select: "name email isActive" },
          { path: "groupId", select: "name level" },
        ],
      })
      .populate("eventId", "name status")
      .lean();

    if (!row) return res.status(404).json({ message: "Certificate not found" });
    res.json(row);
  }),
);

router.post(
  "/certificates/:serialNo/revoke",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const serialNo = String(req.params.serialNo || "").trim();
    const reason = String(req.body?.reason || "").trim();

    const cert = await Certificate.findOne({ academyId, serialNo });
    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    cert.isRevoked = true;
    cert.revokedAt = new Date();
    cert.revokeReason = reason;
    await cert.save();

    res.json({ ok: true, serialNo: cert.serialNo });
  }),
);

router.post(
  "/certificates/:serialNo/restore",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const serialNo = String(req.params.serialNo || "").trim();

    const cert = await Certificate.findOne({ academyId, serialNo });
    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    cert.isRevoked = false;
    cert.revokedAt = null;
    cert.revokeReason = "";
    await cert.save();

    res.json({
      ok: true,
      serialNo: cert.serialNo,
      status: "ACTIVE",
    });
  }),
);

router.delete(
  "/certificates/:serialNo",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const serialNo = String(req.params.serialNo || "").trim();

    const cert = await Certificate.findOne({ academyId, serialNo });
    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    await Certificate.deleteOne({ _id: cert._id, academyId });

    res.json({
      ok: true,
      deleted: serialNo,
    });
  }),
);
/* =========================
 * Certificate PDF event-based
 * ========================= */
router.get(
  "/events/:eventId/certificate/:participantId.pdf",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { eventId, participantId } = req.params;

    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const enrolled = await EventEnrollment.findOne({
      academyId,
      eventId,
      participantId,
    }).lean();

    if (!enrolled) {
      return res
        .status(400)
        .json({ message: "Participant not enrolled in this event" });
    }

    const participant = await Participant.findOne({
      _id: participantId,
      academyId,
    })
      .populate("userId", "name")
      .populate("groupId", "name level")
      .populate("parentUserId", "name email");

    if (!participant) return res.status(404).json({ message: "Not found" });

    const eventDoc = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!eventDoc) return res.status(404).json({ message: "Event not found" });

    const totals = await Score.aggregate([
      {
        $match: {
          academyId: asObjectId(academyId),
          eventId: asObjectId(eventId),
          participantId: participant._id,
          status: "SCORED",
          value: { $ne: null },
        },
      },
      { $group: { _id: "$participantId", total: { $sum: "$value" } } },
    ]);
    const total = totals?.[0]?.total ?? 0;

    const medal = await Award.findOne({
      academyId,
      eventId,
      participantId,
      type: "MEDAL",
    }).lean();

    const certTitle = medal?.title
      ? `${medal.title} AWARD`
      : "PARTICIPATION AWARD";

    const cert = await ensureCertificateRecord({
      academyId,
      eventId,
      participant,
      title: certTitle,
      type: "CERTIFICATE",
      eventName: eventDoc.name,
    });

    const token = signCertificatePayload({
      serialNo: cert.serialNo,
      academyId: String(academyId),
      eventId: String(eventId),
      participantId: String(participant._id),
      issuedAt: cert.issuedAt.toISOString(),
    });

    if (!cert.meta?.token) {
      cert.meta = { ...(cert.meta || {}), token };
      await Certificate.updateOne(
        { _id: cert._id, academyId },
        { $set: { meta: cert.meta } },
      );
    }

    const verifyUrl = buildVerifyUrl(req, token);
    const certificateUrl = buildAppUrl(
      `/api/admin/events/${eventId}/certificate/${participantId}.pdf`,
    );

    const result = await buildFinalCertificateBuffer({
      participant,
      enrolled,
      eventDoc,
      cert,
      total,
      verifyUrl,
    });

    await sendCertificateReadyEmail({
      academyId,
      participant,
      eventDoc,
      cert,
      verifyUrl,
      certificateUrl,
    }).catch((err) => {
      console.error(
        "Certificate ready email send failed:",
        err?.message || err,
      );
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeName(
        `${participant.userId?.name || "participant"}_${eventDoc.name || "event"}_${cert.serialNo}`,
        "certificate",
      )}.pdf"`,
    );
    res.setHeader("X-Cert-Mode", result.mode);
    return res.end(result.buffer);
  }),
);

/* =========================
 * Event certificate ZIP
 * ========================= */
router.get(
  "/events/:eventId/certificates.zip",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { eventId } = req.params;
    const { title = "Participation Award" } = req.query;

    if (!eventId || !isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const event = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const enrollments = await EventEnrollment.find({
      eventId,
      academyId,
    }).lean();

    const participantIds = uniqIds(
      enrollments.map((e) => e.participantId).filter(Boolean),
    );

    if (!participantIds.length) {
      return res
        .status(404)
        .json({ message: "No enrolled participants found for this event" });
    }

    const participants = await Participant.find({
      _id: { $in: participantIds },
      academyId,
    })
      .populate("userId", "name email")
      .populate("groupId", "name level")
      .populate("parentUserId", "name email")
      .lean();

    const totals = await Score.aggregate([
      {
        $match: {
          academyId: asObjectId(academyId),
          eventId: asObjectId(eventId),
          participantId: { $in: participantIds.map((id) => asObjectId(id)) },
          status: "SCORED",
          value: { $ne: null },
        },
      },
      { $group: { _id: "$participantId", total: { $sum: "$value" } } },
    ]);

    const totalMap = new Map(
      totals.map((x) => [String(x._id), Number(x.total || 0)]),
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificates_${safeName(event.name || eventId, "event")}.zip"`,
    );

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(res);

    for (const participant of participants) {
      const cert = await ensureCertificateRecord({
        academyId,
        eventId,
        participant,
        title: String(title || "Participation Award"),
        type: "CERTIFICATE",
        eventName: event.name,
      });

      const token = cert.meta?.token
        ? cert.meta.token
        : signCertificatePayload({
            serialNo: cert.serialNo,
            academyId: String(academyId),
            eventId: String(eventId),
            participantId: String(participant._id),
            issuedAt: cert.issuedAt.toISOString(),
          });

      if (!cert.meta?.token) {
        cert.meta = { ...(cert.meta || {}), token };
        await Certificate.updateOne(
          { _id: cert._id, academyId },
          { $set: { meta: cert.meta } },
        );
      }

      const verifyUrl = buildVerifyUrl(req, token);

      const enrolled = enrollments.find(
        (e) => String(e.participantId) === String(participant._id),
      );

      const { buffer: pdfBuffer } = await buildFinalCertificateBuffer({
        participant,
        enrolled,
        eventDoc: event,
        cert,
        total: totalMap.get(String(participant._id)) || 0,
        verifyUrl,
      });

      const safeParticipantName = safeName(
        participant.userId?.name || participant._id,
        "participant",
      );

      archive.append(pdfBuffer, {
        name: `certificate_${safeParticipantName}_${cert.serialNo}.pdf`,
      });
    }

    await archive.finalize();
  }),
);
/* =========================
 * Group certificate ZIP event-scoped
 * ========================= */
router.get(
  "/groups/:groupId/certificates.zip",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const { groupId } = req.params;
    const { eventId, title = "Participation Award" } = req.query;

    if (!groupId || !isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid groupId" });
    }
    if (!eventId || !isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const event = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const group = await Group.findOne({ _id: groupId, academyId }).lean();
    if (!group) return res.status(404).json({ message: "Group not found" });

    const enrollments = await EventEnrollment.find({
      eventId,
      academyId,
    }).lean();

    const enrolledParticipantIds = new Set(
      enrollments.map((e) => String(e.participantId)).filter(Boolean),
    );

    const participants = await Participant.find({ groupId, academyId })
      .populate("userId", "name email")
      .populate("groupId", "name level")
      .populate("parentUserId", "name email")
      .lean();

    const filteredParticipants = participants.filter((p) =>
      enrolledParticipantIds.has(String(p._id)),
    );

    if (!filteredParticipants.length) {
      return res.status(404).json({
        message:
          "No enrolled participants found in this group for the selected event",
      });
    }

    const totals = await Score.aggregate([
      {
        $match: {
          academyId: asObjectId(academyId),
          eventId: asObjectId(eventId),
          participantId: {
            $in: filteredParticipants.map((p) => asObjectId(p._id)),
          },
          status: "SCORED",
          value: { $ne: null },
        },
      },
      { $group: { _id: "$participantId", total: { $sum: "$value" } } },
    ]);

    const totalMap = new Map(
      totals.map((x) => [String(x._id), Number(x.total || 0)]),
    );

    const safeGroupName = safeName(group.name || groupId, "group");
    const safeEventName = safeName(event.name || eventId, "event");

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificates_${safeEventName}_${safeGroupName}.zip"`,
    );

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(res);

    for (const participant of filteredParticipants) {
      const cert = await ensureCertificateRecord({
        academyId,
        eventId,
        participant,
        title: String(title || "Participation Award"),
        type: "CERTIFICATE",
        eventName: event.name,
      });

      const token = cert.meta?.token
        ? cert.meta.token
        : signCertificatePayload({
            serialNo: cert.serialNo,
            academyId: String(academyId),
            eventId: String(eventId),
            participantId: String(participant._id),
            issuedAt: cert.issuedAt.toISOString(),
          });

      if (!cert.meta?.token) {
        cert.meta = { ...(cert.meta || {}), token };
        await Certificate.updateOne(
          { _id: cert._id, academyId },
          { $set: { meta: cert.meta } },
        );
      }

      const verifyUrl = buildVerifyUrl(req, token);

      const enrolled = enrollments.find(
        (e) => String(e.participantId) === String(participant._id),
      );

      const { buffer: pdfBuffer } = await buildFinalCertificateBuffer({
        participant,
        enrolled,
        eventDoc: event,
        cert,
        total: totalMap.get(String(participant._id)) || 0,
        verifyUrl,
      });

      const safeParticipantName = safeName(
        participant.userId?.name || participant._id,
        "participant",
      );

      archive.append(pdfBuffer, {
        name: `certificate_${safeParticipantName}_${cert.serialNo}.pdf`,
      });
    }

    await archive.finalize();
  }),
);

/* =========================
 * Certificate PDF legacy
 * ========================= */
router.get(
  "/certificate/:participantId.pdf",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    res.setHeader(
      "X-Deprecated",
      "Use /events/:eventId/certificate/:participantId.pdf",
    );

    const participant = await Participant.findOne({
      _id: req.params.participantId,
      academyId,
    })
      .populate("userId", "name")
      .populate("groupId", "name level");

    if (!participant) return res.status(404).json({ message: "Not found" });

    const participantName = participant.userId?.name || "Participant";
    const groupName = participant.groupId?.name || "";
    const level = participant.groupId?.level || "";

    const totals = await Score.aggregate([
      {
        $match: {
          academyId: asObjectId(academyId),
          participantId: participant._id,
          status: "SCORED",
          value: { $ne: null },
        },
      },
      { $group: { _id: "$participantId", total: { $sum: "$value" } } },
    ]);
    const total = totals?.[0]?.total ?? 0;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="certificate-${participant._id}.pdf"`,
    );

    if (fs.existsSync(TEMPLATE_PATH)) {
      try {
        const templateBytes = fs.readFileSync(TEMPLATE_PATH);

        const overlayDoc = await buildCertificateOverlayPdf({
          participantName,
          dateText: new Date().toLocaleDateString(),
        });

        const overlayBytes = await pdfkitToBuffer(overlayDoc);

        const tpl = await PDFLibDocument.load(templateBytes);
        const ovl = await PDFLibDocument.load(overlayBytes);

        const out = await PDFLibDocument.create();
        const [outPage] = await out.copyPages(tpl, [0]);
        out.addPage(outPage);

        const [embeddedOverlay] = await out.embedPages([ovl.getPage(0)]);
        const { width: W, height: H } = outPage.getSize();

        outPage.drawPage(embeddedOverlay, { x: 0, y: 0, width: W, height: H });

        const merged = await out.save();
        res.setHeader("X-Cert-Mode", "template");
        return res.end(Buffer.from(merged));
      } catch (e) {
        console.error("Template merge failed. Falling back:", e);
        res.setHeader("X-Cert-Mode", "fallback-merge-failed");
      }
    } else {
      res.setHeader("X-Cert-Mode", "fallback-template-missing");
    }

    const doc = await buildCertificatePdf({
      appName: process.env.APP_NAME,
      signatory: process.env.CERT_SIGNATORY,
      participantName,
      groupName,
      level,
      total,
      title: "PARTICIPATION AWARD",
    });

    doc.pipe(res);
    doc.end();
  }),
);

/* =========================
 * Payments
 * ========================= */
router.get(
  "/payments",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const eventId = String(req.query?.eventId || "").trim();
    const participantId = String(req.query?.participantId || "").trim();
    const paymentStatus = String(req.query?.paymentStatus || "").trim();
    const q = { academyId };

    if (eventId) q.eventId = eventId;
    if (participantId) q.participantId = participantId;
    if (paymentStatus) q.paymentStatus = paymentStatus;

    const rows = await Payment.find(q)
      .sort({ createdAt: -1 })
      .populate({
        path: "participantId",
        populate: [
          { path: "userId", select: "name email isActive" },
          { path: "groupId", select: "name level" },
        ],
      })
      .populate("eventId", "name status registrationFee")
      .lean();

    res.json(rows);
  }),
);

router.post(
  "/payments",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const schema = z.object({
      participantId: z.string().min(1),
      eventId: z.string().min(1),
      amount: z.coerce.number().min(0),
      currency: z.string().optional(),
      paymentMethod: z.enum(["CASH"]).optional(),
      paymentStatus: z
        .enum(["PENDING", "PAID", "FAILED", "REFUNDED"])
        .optional(),
      notes: z.string().optional(),
      paidAt: z.string().optional(),
    });

    const input = schema.parse(req.body || {});

    await ensureSameAcademyRefs({
      academyId,
      participantId: input.participantId,
      eventId: input.eventId,
    });

    const enrollment = await EventEnrollment.findOne({
      academyId,
      eventId: input.eventId,
      participantId: input.participantId,
    }).lean();

    const initialStatus = String(
      input.paymentStatus || "PENDING",
    ).toUpperCase();

    const payment = await Payment.create({
      academyId,
      participantId: input.participantId,
      eventId: input.eventId,
      enrollmentId: enrollment?._id || null,
      amount: Number(input.amount || 0),
      currency: String(input.currency || "QAR").trim() || "QAR",
      paymentMethod: "CASH",
      paymentStatus: initialStatus,
      notes: String(input.notes || "").trim(),
      paidAt:
        initialStatus === "PAID"
          ? toDateOrNull(input.paidAt) || new Date()
          : toDateOrNull(input.paidAt),
      receiptNo: initialStatus === "PAID" ? buildReceiptNo({ _id: null }) : "",
      confirmedBy: initialStatus === "PAID" ? req.user?._id || null : null,
    });

    if (initialStatus === "PAID" && !payment.receiptNo) {
      payment.receiptNo = buildReceiptNo(payment);
      await payment.save();
    }

    const populated = await Payment.findById(payment._id)
      .populate({
        path: "participantId",
        populate: [
          { path: "userId", select: "name email isActive" },
          { path: "groupId", select: "name level" },
        ],
      })
      .populate("eventId", "name status registrationFee")
      .lean();

    if (["PAID", "PENDING"].includes(initialStatus)) {
      await sendPaymentStatusEmails({
        academyId,
        payment: populated || payment,
        eventDoc: populated?.eventId || null,
        statusOverride: initialStatus,
      }).catch((err) => {
        console.error("Payment email send failed:", err?.message || err);
      });
    }

    res.json(populated);
  }),
);

router.put(
  "/payments/bulk-status",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const body = z
      .object({
        paymentIds: z.array(z.string().min(1)).min(1),
        paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]),
      })
      .parse(req.body || {});

    const ids = uniqIds(body.paymentIds);

    const rows = await Payment.find({
      _id: { $in: ids },
      academyId,
    });

    let emailed = 0;

    for (const row of rows) {
      const prevStatus = String(row.paymentStatus || "").toUpperCase();
      row.paymentStatus = body.paymentStatus;

      if (body.paymentStatus === "PAID") {
        row.paidAt = row.paidAt || new Date();
        row.receiptNo = row.receiptNo || buildReceiptNo(row);
        row.confirmedBy = req.user?._id || null;
      }

      await row.save();

      const nextStatus = String(row.paymentStatus || "").toUpperCase();
      if (
        nextStatus &&
        nextStatus !== prevStatus &&
        ["PENDING", "PAID"].includes(nextStatus)
      ) {
        await sendPaymentStatusEmails({
          academyId,
          payment: row,
          statusOverride: nextStatus,
        }).catch((err) => {
          console.error("Bulk payment email send failed:", err?.message || err);
        });
        emailed += 1;
      }
    }

    res.json({
      ok: true,
      updated: rows.length,
      emailed,
    });
  }),
);

router.put(
  "/payments/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const schema = z.object({
      amount: z.coerce.number().min(0).optional(),
      currency: z.string().optional(),
      paymentMethod: z.enum(["CASH"]).optional(),
      paymentStatus: z
        .enum(["PENDING", "PAID", "FAILED", "REFUNDED"])
        .optional(),
      notes: z.string().optional(),
      paidAt: z.string().optional().or(z.literal("")),
    });

    const input = schema.parse(req.body || {});
    const patch = {};

    if (input.amount !== undefined) patch.amount = Number(input.amount || 0);
    if (input.currency !== undefined) {
      patch.currency = String(input.currency || "QAR").trim() || "QAR";
    }
    if (input.paymentMethod !== undefined) patch.paymentMethod = "CASH";
    if (input.paymentStatus !== undefined) {
      patch.paymentStatus = input.paymentStatus;
    }
    if (input.notes !== undefined) {
      patch.notes = String(input.notes || "").trim();
    }
    if (input.paidAt !== undefined) {
      patch.paidAt = toDateOrNull(input.paidAt);
    }

    const previous = await Payment.findOne({
      _id: req.params.id,
      academyId,
    }).lean();
    const payment = await Payment.findOneAndUpdate(
      { _id: req.params.id, academyId },
      patch,
      { new: true },
    )
      .populate({
        path: "participantId",
        populate: [
          { path: "userId", select: "name email isActive" },
          { path: "groupId", select: "name level" },
        ],
      })
      .populate("eventId", "name status registrationFee");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const prevStatus = String(previous?.paymentStatus || "").toUpperCase();
    const nextStatus = String(payment?.paymentStatus || "").toUpperCase();

    if (
      nextStatus &&
      nextStatus !== prevStatus &&
      ["PENDING", "PAID"].includes(nextStatus)
    ) {
      await sendPaymentStatusEmails({
        academyId,
        payment,
        eventDoc: payment?.eventId || null,
      }).catch((err) => {
        console.error("Payment update email send failed:", err?.message || err);
      });
    }

    res.json(payment);
  }),
);

router.post(
  "/payments/:id/mark-paid",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const payment = await Payment.findOne({ _id: req.params.id, academyId })
      .populate({
        path: "participantId",
        populate: [
          { path: "userId", select: "name email isActive" },
          { path: "groupId", select: "name level" },
        ],
      })
      .populate("eventId", "name status registrationFee");

    if (!payment) return res.status(404).json({ message: "Payment not found" });

    payment.paymentStatus = "PAID";
    payment.paymentMethod = "CASH";
    payment.paidAt = new Date();
    if (!payment.receiptNo) payment.receiptNo = buildReceiptNo(payment);
    payment.confirmedBy = req.user?._id || null;
    await payment.save();

    await sendPaymentStatusEmails({
      academyId,
      payment,
      eventDoc: payment?.eventId || null,
      statusOverride: "PAID",
    }).catch((err) => {
      console.error(
        "Payment mark-paid email send failed:",
        err?.message || err,
      );
    });

    res.json({
      ok: true,
      id: String(payment._id),
      paymentStatus: payment.paymentStatus,
      paidAt: payment.paidAt,
      receiptNo: payment.receiptNo,
    });
  }),
);

router.delete(
  "/payments/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const del = await Payment.deleteOne({ _id: req.params.id, academyId });
    if (!del.deletedCount) {
      return res.status(404).json({ message: "Payment not found" });
    }
    res.json({ ok: true });
  }),
);

router.get(
  "/payments/summary",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const eventId = String(req.query?.eventId || "").trim();
    const q = { academyId };
    if (eventId && isValidObjectId(eventId)) q.eventId = eventId;

    const rows = await Payment.find(q).lean();

    const totalCollected = rows
      .filter((x) => x.paymentStatus === "PAID")
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    const totalPending = rows
      .filter((x) => x.paymentStatus === "PENDING")
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    const totalRefunded = rows
      .filter((x) => x.paymentStatus === "REFUNDED")
      .reduce((s, x) => s + Number(x.amount || 0), 0);

    const cashCount = rows.filter((x) => x.paymentMethod === "CASH").length;

    res.json({
      totalPayments: rows.length,
      totalCollected,
      totalPending,
      totalRefunded,
      cashCount,
    });
  }),
);

router.get(
  "/payments/export",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const eventId = String(req.query?.eventId || "").trim();
    const q = { academyId };
    if (eventId && isValidObjectId(eventId)) q.eventId = eventId;

    const rows = await Payment.find(q)
      .sort({ createdAt: -1 })
      .populate({
        path: "participantId",
        populate: [{ path: "userId", select: "name email" }],
      })
      .populate("eventId", "name code")
      .lean();

    const csv = [
      [
        "paymentId",
        "participantId",
        "participantName",
        "userEmail",
        "eventId",
        "eventName",
        "amount",
        "currency",
        "paymentMethod",
        "paymentStatus",
        "receiptNo",
        "invoiceNo",
        "paidAt",
        "createdAt",
      ].join(","),
      ...rows.map((r) =>
        [
          `"${String(r._id)}"`,
          `"${String(r.participantId?._id || r.participantId || "")}"`,
          `"${String(r.participantId?.userId?.name || "").replace(/"/g, '""')}"`,
          `"${String(r.participantId?.userId?.email || "").replace(/"/g, '""')}"`,
          `"${String(r.eventId?._id || r.eventId || "")}"`,
          `"${String(r.eventId?.name || "").replace(/"/g, '""')}"`,
          `"${Number(r.amount || 0)}"`,
          `"${String(r.currency || "QAR").replace(/"/g, '""')}"`,
          `"${String(r.paymentMethod || "").replace(/"/g, '""')}"`,
          `"${String(r.paymentStatus || "").replace(/"/g, '""')}"`,
          `"${String(r.receiptNo || "").replace(/"/g, '""')}"`,
          `"${String(r.invoiceNo || "").replace(/"/g, '""')}"`,
          `"${r.paidAt ? new Date(r.paidAt).toISOString() : ""}"`,
          `"${r.createdAt ? new Date(r.createdAt).toISOString() : ""}"`,
        ].join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="payments_export.csv"',
    );
    res.end(csv);
  }),
);

router.get(
  "/finance/summary",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const eventId = String(req.query?.eventId || "").trim();
    const match = { academyId: asObjectId(academyId) };
    if (eventId && isValidObjectId(eventId)) {
      match.eventId = asObjectId(eventId);
    }

    const [paymentsAgg, pendingCount] = await Promise.all([
      Payment.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$paymentStatus",
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Payment.countDocuments({
        academyId,
        ...(eventId && isValidObjectId(eventId) ? { eventId } : {}),
        paymentStatus: "PENDING",
      }),
    ]);

    const out = {
      totalPaid: 0,
      totalPending: 0,
      totalRefunded: 0,
      totalFailed: 0,
      countPaid: 0,
      countPending: pendingCount || 0,
      countRefunded: 0,
      countFailed: 0,
    };

    for (const row of paymentsAgg) {
      if (row._id === "PAID") {
        out.totalPaid = Number(row.amount || 0);
        out.countPaid = Number(row.count || 0);
      }
      if (row._id === "PENDING") {
        out.totalPending = Number(row.amount || 0);
        out.countPending = Number(row.count || 0);
      }
      if (row._id === "REFUNDED") {
        out.totalRefunded = Number(row.amount || 0);
        out.countRefunded = Number(row.count || 0);
      }
      if (row._id === "FAILED") {
        out.totalFailed = Number(row.amount || 0);
        out.countFailed = Number(row.count || 0);
      }
    }

    res.json(out);
  }),
);

router.post(
  "/payments/:id/send-document-email",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const paymentId = String(req.params.id || "").trim();
    if (!isValidObjectId(paymentId)) {
      return res.status(400).json({ message: "Invalid payment id" });
    }

    const schema = z.object({
      to: z.string().email().optional(),
      subject: z.string().optional(),
      message: z.string().optional(),
      sendReceipt: z.boolean().optional(),
    });

    const body = schema.parse(req.body || {});

    const payment = await Payment.findOne({ _id: paymentId, academyId })
      .populate({
        path: "participantId",
        populate: [
          { path: "userId", select: "name email" },
          { path: "parentUserId", select: "name email" },
          { path: "groupId", select: "name level" },
        ],
      })
      .populate("eventId", "name")
      .lean();

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const participant = payment.participantId || null;
    const participantUser = participant?.userId || null;
    const parentUser = participant?.parentUserId || null;
    const eventDoc = payment.eventId || null;

    const fallbackTo =
      String(body.to || "").trim() ||
      String(parentUser?.email || "").trim() ||
      String(participantUser?.email || "").trim();

    if (!fallbackTo) {
      return res.status(400).json({
        message: "No recipient email found for this payment",
      });
    }

    const appUrl = String(
      process.env.APP_URL || "http://localhost:5173",
    ).replace(/\/+$/, "");

    const result = await sendTransactionalEmail({
      to: fallbackTo,
      subject:
        String(body.subject || "").trim() ||
        `Payment Receipt - ${eventDoc?.name || "Event"}`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;">
          <h2 style="margin:0 0 12px;">Payment Receipt</h2>
          <p><strong>Participant:</strong> ${participantUser?.name || "Participant"}</p>
          <p><strong>Event:</strong> ${eventDoc?.name || "Event"}</p>
          <p><strong>Amount:</strong> ${Number(payment.amount || 0).toFixed(2)} ${payment.currency || "QAR"}</p>
          <p><strong>Status:</strong> ${payment.paymentStatus || "PENDING"}</p>
          <p><strong>Method:</strong> ${payment.paymentMethod || "CASH"}</p>
          <p><strong>Receipt No:</strong> ${payment.receiptNo || "-"}</p>
          ${
            body.message
              ? `<p style="margin-top:16px;">${String(body.message)}</p>`
              : ""
          }
          <p style="margin-top:16px;">
            You can log in here:
            <a href="${appUrl}/parent/dashboard?tab=payments">${appUrl}/parent/dashboard?tab=payments</a>
          </p>
        </div>
      `,
      text: `
Payment Receipt

Participant: ${participantUser?.name || "Participant"}
Event: ${eventDoc?.name || "Event"}
Amount: ${Number(payment.amount || 0).toFixed(2)} ${payment.currency || "QAR"}
Status: ${payment.paymentStatus || "PENDING"}
Method: ${payment.paymentMethod || "CASH"}
Receipt No: ${payment.receiptNo || "-"}

${String(body.message || "").trim()}
      `.trim(),
      meta: {
        type: "PAYMENT_DOCUMENT_EMAIL",
        academyId: String(academyId),
        paymentId: String(payment._id),
        participantId: participant?._id ? String(participant._id) : "",
        eventId: eventDoc?._id ? String(eventDoc._id) : "",
        requestedBy: req.user?.email || "",
        source: "ADMIN_PAYMENT_DOCUMENT_EMAIL",
      },
    });

    if (!result?.ok && !result?.skipped) {
      return res.status(500).json({
        ok: false,
        message: result?.error || "Failed to send payment document email",
        result,
      });
    }

    return res.json({
      ok: true,
      message: result?.skipped
        ? "Payment document email skipped"
        : "Payment document email sent successfully",
      result,
    });
  }),
);

/* =========================
 * Email logs
 * ========================= */
router.get(
  "/email-logs",
  wrap(async (req, res) => {
    if (!EmailLog) return res.json([]);

    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const limit = Math.min(Number(req.query.limit || 200), 500);
    const status = String(req.query.status || "")
      .trim()
      .toUpperCase();
    const template = String(req.query.template || "").trim();
    const q = {
      $or: [{ academyId }, { academyId: asObjectId(academyId) }],
    };

    if (status) q.status = status;
    if (template) q.template = template;

    const rows = await EmailLog.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(rows);
  }),
);

router.get(
  "/email-logs/:id",
  wrap(async (req, res) => {
    if (!EmailLog)
      return res.status(404).json({ message: "EmailLog model not available" });

    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const row = await EmailLog.findOne({
      _id: req.params.id,
      $or: [{ academyId }, { academyId: asObjectId(academyId) }],
    }).lean();

    if (!row) {
      return res.status(404).json({ message: "Email log not found" });
    }

    res.json(row);
  }),
);

/* =========================
 * Alerts
 * ========================= */
router.get(
  "/alerts",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const status = String(req.query.status || "")
      .trim()
      .toUpperCase();
    const limit = Math.min(Number(req.query.limit || 200), 500);

    const q = { academyId };
    if (status === "OPEN" || status === "RESOLVED") q.status = status;

    const rows = await Alert.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("judgeId", "name email academyId")
      .populate("activityId", "name maxScore")
      .populate("eventId", "name status")
      .populate("academyId", "name code")
      .lean();

    res.json(
      (rows || []).map((a) => ({
        id: a?._id ? String(a._id) : "",
        _id: a?._id ? String(a._id) : "",
        academyId: a?.academyId?._id
          ? String(a.academyId._id)
          : String(a?.academyId || academyId),
        academy: a?.academyId?._id
          ? {
              _id: String(a.academyId._id),
              name: a.academyId.name || "",
              code: a.academyId.code || "",
            }
          : null,
        status: a?.status || "OPEN",
        priority: normalizePriority(a?.priority),
        message: a?.message || "",
        eventId: a?.eventId?._id ? String(a.eventId._id) : "",
        event: a?.eventId?._id
          ? {
              _id: String(a.eventId._id),
              name: a.eventId.name || "",
              status: a.eventId.status || "",
            }
          : null,
        judge: a?.judgeId?._id
          ? {
              id: String(a.judgeId._id),
              _id: String(a.judgeId._id),
              name: a.judgeId.name || "",
              email: a.judgeId.email || "",
              academyId: a.judgeId.academyId || null,
            }
          : null,
        activity: a?.activityId?._id
          ? {
              id: String(a.activityId._id),
              _id: String(a.activityId._id),
              name: a.activityId.name || "",
              maxScore: a.activityId.maxScore,
            }
          : null,
        createdAt: a?.createdAt || null,
        resolvedAt: a?.resolvedAt || null,
        meta: a?.meta || {},
      })),
    );
  }),
);

router.post(
  "/alerts",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const schema = z.object({
      judgeId: z.string().min(1),
      eventId: z.string().min(1),
      activityId: z.string().optional().nullable(),
      message: z.string().min(1),
      priority: z.string().optional(),
      meta: z.record(z.any()).optional(),
      createNotification: z.boolean().optional(),
    });

    const input = schema.parse(req.body || {});

    if (!isValidObjectId(input.judgeId)) {
      return res.status(400).json({ message: "Invalid judgeId" });
    }

    if (!isValidObjectId(input.eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    if (input.activityId && !isValidObjectId(input.activityId)) {
      return res.status(400).json({ message: "Invalid activityId" });
    }

    await ensureSameAcademyRefs({
      academyId,
      judgeUserId: input.judgeId,
      eventId: input.eventId,
      activityId: input.activityId || null,
    });

    const [judgeDoc, eventDoc, activityDoc, academyDoc] = await Promise.all([
      User.findOne({
        _id: input.judgeId,
        academyId,
        role: "JUDGE",
      })
        .select("name email academyId")
        .lean(),
      Event.findOne({ _id: input.eventId, academyId })
        .select("name status")
        .lean(),
      input.activityId
        ? Activity.findOne({ _id: input.activityId, academyId })
            .select("name maxScore")
            .lean()
        : null,
      Academy.findById(academyId).select("name code").lean(),
    ]);

    if (!judgeDoc) {
      return res.status(404).json({ message: "Judge not found" });
    }
    if (!eventDoc) {
      return res.status(404).json({ message: "Event not found" });
    }

    const doc = await Alert.create({
      academyId,
      judgeId: input.judgeId,
      eventId: input.eventId,
      activityId: input.activityId || null,
      message: String(input.message || "").trim(),
      priority: normalizePriority(input.priority),
      status: "OPEN",
      meta: {
        ...(input.meta || {}),
        createdByUserId: String(req.user?._id || ""),
        createdByRole: String(req.user?.role || "").toUpperCase(),
        source: "JUDGE_HELP",
      },
    });

    const out = {
      id: String(doc._id),
      _id: String(doc._id),
      academyId: String(academyId),
      academy: academyDoc
        ? {
            _id: String(academyDoc._id),
            name: academyDoc.name || "",
            code: academyDoc.code || "",
          }
        : null,
      status: doc.status || "OPEN",
      priority: normalizePriority(doc.priority),
      message: doc.message || "",
      eventId: eventDoc?._id ? String(eventDoc._id) : "",
      event: eventDoc
        ? {
            _id: String(eventDoc._id),
            name: eventDoc.name || "",
            status: eventDoc.status || "",
          }
        : null,
      judge: judgeDoc
        ? {
            id: String(judgeDoc._id),
            _id: String(judgeDoc._id),
            name: judgeDoc.name || "",
            email: judgeDoc.email || "",
            academyId: judgeDoc.academyId || null,
          }
        : null,
      activity: activityDoc
        ? {
            id: String(activityDoc._id),
            _id: String(activityDoc._id),
            name: activityDoc.name || "",
            maxScore: activityDoc.maxScore,
          }
        : null,
      createdAt: doc.createdAt || null,
      resolvedAt: doc.resolvedAt || null,
      meta: doc.meta || {},
    };

    let createdNotifications = 0;

    const shouldCreateNotification = input.createNotification !== false;

    if (shouldCreateNotification) {
      const admins = await User.find({
        academyId,
        role: { $in: ["ADMIN", "SUPER_ADMIN"] },
        isActive: { $ne: false },
      })
        .select("_id role")
        .lean();

      for (const admin of admins) {
        try {
          const notification = await createNotification({
            academyId,
            recipientUserId: String(admin._id),
            recipientRole: String(admin.role || "ADMIN").toUpperCase(),
            title: "Judge needs help",
            message: `${judgeDoc.name || "Judge"} requested help${
              activityDoc?.name ? ` for ${activityDoc.name}` : ""
            }${eventDoc?.name ? ` in ${eventDoc.name}` : ""}.`,
            type: "ALERT_CREATED",
            category: "EVENT",
            priority: out.priority === "HIGH" ? "HIGH" : "NORMAL",
            actionUrl: "/admin/alerts",
            meta: {
              alertId: out.id,
              judgeId: out.judge?._id || "",
              judgeName: out.judge?.name || "",
              eventId: out.event?._id || "",
              eventName: out.event?.name || "",
              activityId: out.activity?._id || "",
              activityName: out.activity?.name || "",
              academyId: out.academyId,
              academyName: out.academy?.name || "",
              source: "ALERTS_CENTER",
            },
            createdByUserId: req?.user?._id || null,
          });

          emitNotification(req.app, notification);
          createdNotifications += 1;
        } catch (notifyErr) {
          console.error(
            "Alert notification create failed:",
            notifyErr?.message || notifyErr,
          );
        }
      }
    }

    try {
      const io = req.app?.get?.("io");
      if (io) {
        io.to("admins").emit("alert:created", {
          alert: out,
          academyId: out.academyId,
        });

        io.to(`academy:${out.academyId}`).emit("alert:created", {
          alert: out,
          academyId: out.academyId,
        });

        if (out.judge?.id) {
          io.to(`user:${out.judge.id}`).emit("alert:acknowledged", {
            id: out.id,
            academyId: out.academyId,
            status: out.status,
          });
        }
      }
    } catch (socketErr) {
      console.error("alert:created socket emit failed:", socketErr);
    }

    res.json({
      ...out,
      createdNotifications,
    });
  }),
);

router.post(
  "/alerts/:id/resolve",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid alert id" });
    }

    const doc = await Alert.findOne({ _id: id, academyId });
    if (!doc) {
      return res.status(404).json({ message: "Alert not found" });
    }

    if (String(doc.status || "").toUpperCase() !== "RESOLVED") {
      doc.status = "RESOLVED";
      doc.resolvedAt = new Date();
      doc.meta = {
        ...(doc.meta || {}),
        resolvedByUserId: String(req.user?._id || ""),
        resolvedByRole: String(req.user?.role || "").toUpperCase(),
      };
      await doc.save();
    }

    const populated = await Alert.findById(id)
      .populate("judgeId", "name email academyId")
      .populate("activityId", "name maxScore")
      .populate("eventId", "name status")
      .populate("academyId", "name code")
      .lean();

    if (!populated) {
      return res.status(404).json({ message: "Alert not found after update" });
    }

    const out = {
      id: populated?._id ? String(populated._id) : "",
      _id: populated?._id ? String(populated._id) : "",
      academyId: populated?.academyId?._id
        ? String(populated.academyId._id)
        : String(populated?.academyId || academyId),
      academy: populated?.academyId?._id
        ? {
            _id: String(populated.academyId._id),
            name: populated.academyId.name || "",
            code: populated.academyId.code || "",
          }
        : null,
      status: populated?.status || "OPEN",
      priority: normalizePriority(populated?.priority),
      message: populated?.message || "",
      eventId: populated?.eventId?._id ? String(populated.eventId._id) : "",
      event: populated?.eventId?._id
        ? {
            _id: String(populated.eventId._id),
            name: populated.eventId.name || "",
            status: populated.eventId.status || "",
          }
        : null,
      judge: populated?.judgeId?._id
        ? {
            id: String(populated.judgeId._id),
            _id: String(populated.judgeId._id),
            name: populated.judgeId.name || "",
            email: populated.judgeId.email || "",
            academyId: populated.judgeId.academyId || null,
          }
        : null,
      activity: populated?.activityId?._id
        ? {
            id: String(populated.activityId._id),
            _id: String(populated.activityId._id),
            name: populated.activityId.name || "",
            maxScore: populated.activityId.maxScore,
          }
        : null,
      createdAt: populated?.createdAt || null,
      resolvedAt: populated?.resolvedAt || null,
      meta: populated?.meta || {},
    };

    try {
      const admins = await User.find({
        academyId,
        role: { $in: ["ADMIN", "SUPER_ADMIN"] },
        isActive: { $ne: false },
      })
        .select("_id role")
        .lean();

      for (const admin of admins) {
        try {
          const notification = await createNotification({
            academyId,
            recipientUserId: String(admin._id),
            recipientRole: String(admin.role || "ADMIN").toUpperCase(),
            title: "Alert resolved",
            message: `${out.judge?.name || "Judge"} help request has been resolved.`,
            type: "ALERT_RESOLVED",
            category: "EVENT",
            priority: "NORMAL",
            actionUrl: "/admin/alerts",
            meta: {
              alertId: out.id,
              judgeId: out.judge?._id || "",
              judgeName: out.judge?.name || "",
              eventId: out.event?._id || "",
              eventName: out.event?.name || "",
              activityId: out.activity?._id || "",
              activityName: out.activity?.name || "",
              academyId: out.academyId,
              academyName: out.academy?.name || "",
              resolvedAt: out.resolvedAt,
              source: "ALERTS_CENTER",
            },
            createdByUserId: req?.user?._id || null,
          });

          emitNotification(req.app, notification);
        } catch (notifyErr) {
          console.error(
            "Alert resolved notification failed:",
            notifyErr?.message || notifyErr,
          );
        }
      }
    } catch (e) {
      console.error("Resolve admin notification flow failed:", e?.message || e);
    }

    try {
      const io = req.app?.get?.("io");
      if (io) {
        io.to("admins").emit("alert:resolved", {
          alert: out,
          id: out.id,
          academyId: out.academyId,
          resolvedAt: out.resolvedAt,
          status: out.status,
        });

        io.to(`academy:${out.academyId}`).emit("alert:resolved", {
          alert: out,
          id: out.id,
          academyId: out.academyId,
          resolvedAt: out.resolvedAt,
          status: out.status,
        });

        if (out.judge?.id) {
          io.to(`user:${out.judge.id}`).emit("alert:resolved", {
            alert: out,
            id: out.id,
            academyId: out.academyId,
            resolvedAt: out.resolvedAt,
            status: out.status,
          });
        }
      }
    } catch (socketErr) {
      console.error("alert:resolved socket emit failed:", socketErr);
    }

    res.json(out);
  }),
);

router.delete(
  "/alerts/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const del = await Alert.deleteOne({ _id: req.params.id, academyId });
    if (!del.deletedCount) {
      return res.status(404).json({ message: "Alert not found" });
    }

    res.json({ ok: true });
  }),
);
/* =========================
 * Academies
 * ========================= */
router.get(
  "/academies",
  wrap(async (req, res) => {
    if (req.user?.role === "SUPER_ADMIN") {
      const rows = await Academy.find().lean();
      return res.json(rows);
    }

    if (!req.academyId && !req.user?.academyId) {
      return res.json([]);
    }

    const academy = await Academy.findById(
      req.academyId || req.user?.academyId,
    ).lean();
    if (!academy) return res.json([]);

    return res.json([academy]);
  }),
);

router.get(
  "/academy/me",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const academy = await Academy.findById(academyId).lean();
    if (!academy) return res.status(404).json({ message: "Academy not found" });

    res.json(academy);
  }),
);

router.get(
  "/academy-registration/me",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const row = await AcademyRegistration.findOne({ academyId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(row || null);
  }),
);

router.delete(
  "/academies/:id",
  wrap(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid academy id" });
    }

    const academyId = String(id);

    if (req.user?.role === "ADMIN") {
      const scopedAcademyId = String(
        req.user?.academyId || req.academyId || "",
      );
      if (!scopedAcademyId || scopedAcademyId !== academyId) {
        return res.status(403).json({
          message: "You can only delete your own academy",
        });
      }
    }

    const session = await mongoose.startSession();

    try {
      let removed = null;
      const deleted = {};

      const deleteSet = async (Model, query, key, txSession = null) => {
        if (!Model) return;
        const q = Model.deleteMany(query);
        if (txSession) q.session(txSession);
        const r = await q;
        deleted[key] = r?.deletedCount || 0;
      };

      try {
        await session.withTransaction(async () => {
          removed = await Academy.findById(id).session(session);
          if (!removed) return;

          await deleteSet(User, { academyId: id }, "users", session);
          await deleteSet(Group, { academyId: id }, "groups", session);
          await deleteSet(Activity, { academyId: id }, "activities", session);
          await deleteSet(
            Participant,
            { academyId: id },
            "participants",
            session,
          );
          await deleteSet(
            JudgeAssignment,
            { academyId: id },
            "judgeAssignments",
            session,
          );
          await deleteSet(Score, { academyId: id }, "scores", session);
          await deleteSet(Award, { academyId: id }, "awards", session);
          await deleteSet(Alert, { academyId: id }, "alerts", session);
          await deleteSet(
            Certificate,
            { academyId: id },
            "certificates",
            session,
          );
          await deleteSet(Event, { academyId: id }, "events", session);
          await deleteSet(
            EventEnrollment,
            { academyId: id },
            "eventEnrollments",
            session,
          );
          await deleteSet(Payment, { academyId: id }, "payments", session);
          await deleteSet(Invoice, { academyId: id }, "invoices", session);
          await deleteSet(Fee, { academyId: id }, "fees", session);
          await deleteSet(Attendance, { academyId: id }, "attendance", session);
          await deleteSet(Branch, { academyId: id }, "branches", session);
          await deleteSet(EmailLog, { academyId: id }, "emailLogs", session);

          if (AcademyRegistration) {
            const r = await AcademyRegistration.deleteMany({
              $or: [{ academyId: id }, { academyId }],
            }).session(session);
            deleted.academyRegistrations = r?.deletedCount || 0;
          }

          await Academy.deleteOne({ _id: id }).session(session);
          deleted.academies = 1;
        });

        if (!removed) {
          return res.status(404).json({ message: "Academy not found" });
        }

        return res.json({
          ok: true,
          mode: "transaction",
          message:
            "Academy and all related MongoDB records deleted successfully",
          academyId: idString(removed?._id || id),
          deleted,
        });
      } catch (_txErr) {
        removed = await Academy.findById(id)
          .lean()
          .catch(() => null);

        if (!removed) {
          return res.status(404).json({ message: "Academy not found" });
        }

        const deleteDirect = async (Model, query, key) => {
          if (!Model) return;
          const r = await Model.deleteMany(query).catch(() => ({
            deletedCount: 0,
          }));
          deleted[key] = r?.deletedCount || 0;
        };

        await deleteDirect(User, { academyId: id }, "users");
        await deleteDirect(Group, { academyId: id }, "groups");
        await deleteDirect(Activity, { academyId: id }, "activities");
        await deleteDirect(Participant, { academyId: id }, "participants");
        await deleteDirect(
          JudgeAssignment,
          { academyId: id },
          "judgeAssignments",
        );
        await deleteDirect(Score, { academyId: id }, "scores");
        await deleteDirect(Award, { academyId: id }, "awards");
        await deleteDirect(Alert, { academyId: id }, "alerts");
        await deleteDirect(Certificate, { academyId: id }, "certificates");
        await deleteDirect(Event, { academyId: id }, "events");
        await deleteDirect(
          EventEnrollment,
          { academyId: id },
          "eventEnrollments",
        );
        await deleteDirect(Payment, { academyId: id }, "payments");
        await deleteDirect(Invoice, { academyId: id }, "invoices");
        await deleteDirect(Fee, { academyId: id }, "fees");
        await deleteDirect(Attendance, { academyId: id }, "attendance");
        await deleteDirect(Branch, { academyId: id }, "branches");
        await deleteDirect(EmailLog, { academyId: id }, "emailLogs");

        if (AcademyRegistration) {
          const r = await AcademyRegistration.deleteMany({
            $or: [{ academyId: id }, { academyId }],
          }).catch(() => ({ deletedCount: 0 }));
          deleted.academyRegistrations = r?.deletedCount || 0;
        }

        await Academy.deleteOne({ _id: id }).catch(() => null);
        deleted.academies = 1;

        return res.json({
          ok: true,
          mode: "no-transaction-fallback",
          warn: "Mongo transactions not enabled (standalone).",
          message:
            "Academy and all related MongoDB records deleted successfully",
          academyId: idString(removed?._id || id),
          deleted,
        });
      }
    } finally {
      session.endSession();
    }
  }),
);

/* =========================
 * Optional enterprise models
 * ========================= */
router.get(
  "/invoices",
  wrap(async (req, res) => {
    if (!Invoice) return res.json([]);
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const rows = await Invoice.find({ academyId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(rows);
  }),
);

router.get(
  "/fees",
  wrap(async (req, res) => {
    if (!Fee) return res.json([]);
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const rows = await Fee.find({ academyId }).sort({ createdAt: -1 }).lean();
    res.json(rows);
  }),
);

router.get(
  "/attendance",
  wrap(async (req, res) => {
    if (!Attendance) return res.json([]);
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const rows = await Attendance.find({ academyId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(rows);
  }),
);

/* =========================
 * Route-level error handler
 * ========================= */
router.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: "Validation error",
      issues: err.issues,
    });
  }

  const msg = err?.message || "Server error";
  return res.status(500).json({ message: msg });
});

export default router;
