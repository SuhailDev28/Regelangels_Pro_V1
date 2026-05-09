import express from "express";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { z } from "zod";

import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

import EmailLog from "../models/EmailLog.js";
import EmailTemplate from "../models/EmailTemplate.js";
import User from "../models/User.js";
import Participant from "../models/Participant.js";
import EventEnrollment from "../models/EventEnrollment.js";

import { verifyEmailTransport } from "../services/email/emailClient.js";
import { sendTransactionalEmail } from "../services/email/emailService.js";
import { renderTemplate } from "../services/templateRenderer.service.js";
import { triggerAutoEmail } from "../services/autoEmailTrigger.service.js";

const router = express.Router();

router.use(auth, requireRole("ADMIN", "SUPER_ADMIN"));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const EMAIL_SETTINGS_FILE = path.join(UPLOAD_DIR, "email-settings.json");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------
 * BASIC HELPERS
 * ----------------------------------------------------- */

function safeJsonRead(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function safeJsonWrite(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;

  const v = String(value || "")
    .trim()
    .toLowerCase();

  if (["true", "1", "yes", "on"].includes(v)) return true;
  if (["false", "0", "no", "off"].includes(v)) return false;

  return fallback;
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeEmailList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => normalizeEmail(v)).filter(Boolean))];
  }

  return [
    ...new Set(
      String(value || "")
        .split(",")
        .map((v) => normalizeEmail(v))
        .filter(Boolean),
    ),
  ];
}

function isValidObjectIdLike(value) {
  return /^[a-f\d]{24}$/i.test(String(value || "").trim());
}

function toObjectId(value) {
  if (!isValidObjectIdLike(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function isSuperAdmin(req) {
  return (
    String(req.user?.role || "")
      .trim()
      .toUpperCase() === "SUPER_ADMIN"
  );
}

function getScopeAcademyId(req) {
  if (!isSuperAdmin(req)) {
    return req.academyId || req.user?.academyId || null;
  }

  const candidate =
    req.get("x-academy-id") ||
    req.query?.academyId ||
    req.body?.academyId ||
    req.academyId ||
    req.user?.academyId ||
    null;

  return candidate ? String(candidate) : null;
}

function requireScopedAcademy(req, res) {
  const academyId = getScopeAcademyId(req);

  if (!academyId || !isValidObjectIdLike(academyId)) {
    res.status(400).json({ message: "Valid academyId is required" });
    return null;
  }

  return String(academyId);
}

/* -------------------------------------------------------
 * TEMPLATE-SPECIFIC ACADEMY SCOPE
 * SUPER_ADMIN => academyId optional
 * ADMIN       => academyId required
 * ----------------------------------------------------- */

function getOptionalTemplateAcademyId(req) {
  if (!isSuperAdmin(req)) {
    const academyId = req.academyId || req.user?.academyId || null;
    return academyId ? String(academyId) : null;
  }

  const candidate =
    req.get("x-academy-id") ||
    req.query?.academyId ||
    req.body?.academyId ||
    req.academyId ||
    req.user?.academyId ||
    null;

  if (!candidate) return null;
  return String(candidate);
}

function getRequiredTemplateAcademyId(req, res) {
  const academyId = getOptionalTemplateAcademyId(req);

  if (!academyId || !isValidObjectIdLike(academyId)) {
    res.status(400).json({ message: "Valid academyId is required" });
    return null;
  }

  return String(academyId);
}

function normalizeTemplateKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function normalizeTemplateUpper(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeVariablesList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((x) => String(x || "").trim()).filter(Boolean))];
}

function sanitizeTemplateOutput(doc) {
  if (!doc) return null;

  return {
    ...doc,
    _id: String(doc._id || ""),
    id: String(doc._id || ""),
    academyId: doc.academyId ? String(doc.academyId) : null,
    createdBy:
      doc.createdBy && typeof doc.createdBy === "object"
        ? doc.createdBy
        : doc.createdBy
          ? String(doc.createdBy)
          : null,
    updatedBy:
      doc.updatedBy && typeof doc.updatedBy === "object"
        ? doc.updatedBy
        : doc.updatedBy
          ? String(doc.updatedBy)
          : null,
  };
}

/* -------------------------------------------------------
 * EMAIL SETTINGS
 * ----------------------------------------------------- */

function getScopedEmailSettings(academyId = null) {
  const all = safeJsonRead(EMAIL_SETTINGS_FILE, {});
  const scoped =
    academyId &&
    all[String(academyId)] &&
    typeof all[String(academyId)] === "object"
      ? all[String(academyId)]
      : {};

  const provider = String(
    scoped.provider || process.env.EMAIL_PROVIDER || "smtp",
  )
    .trim()
    .toLowerCase();

  const host = String(
    scoped.host || scoped.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com",
  ).trim();

  const port = toInt(
    scoped.port ?? scoped.smtpPort ?? process.env.SMTP_PORT,
    587,
  );

  const secure =
    scoped.secure !== undefined
      ? toBool(scoped.secure, port === 465)
      : scoped.smtpSecure !== undefined
        ? toBool(scoped.smtpSecure, port === 465)
        : process.env.SMTP_SECURE !== undefined
          ? toBool(process.env.SMTP_SECURE, port === 465)
          : port === 465;

  const username = normalizeEmail(
    scoped.username || scoped.smtpUser || process.env.SMTP_USER || "",
  );

  const password = String(
    scoped.password || scoped.smtpPass || process.env.SMTP_PASS || "",
  ).trim();

  const isEnabled =
    scoped.isEnabled !== undefined
      ? toBool(scoped.isEnabled, true)
      : scoped.enabled !== undefined
        ? toBool(scoped.enabled, true)
        : toBool(process.env.EMAIL_ENABLED, false);

  const fromEmail = normalizeEmail(
    scoped.fromEmail ||
      process.env.EMAIL_FROM_ADDRESS ||
      process.env.SMTP_FROM_EMAIL ||
      process.env.SMTP_USER ||
      username ||
      "",
  );

  const fromName = String(
    scoped.fromName ||
      process.env.EMAIL_FROM_NAME ||
      process.env.SMTP_FROM_NAME ||
      process.env.APP_NAME ||
      "Rebel Angels",
  ).trim();

  const replyTo = normalizeEmail(
    scoped.replyTo || process.env.EMAIL_REPLY_TO || "",
  );

  return {
    academyId: academyId ? String(academyId) : null,
    provider,
    host,
    port,
    secure,
    username,
    password,
    hasPassword: !!password,
    fromName,
    fromEmail,
    replyTo,
    isEnabled,
    updatedAt: scoped.updatedAt || null,
    updatedBy: scoped.updatedBy || "",
  };
}

function saveScopedEmailSettings(academyId, input = {}, userId = "") {
  const all = safeJsonRead(EMAIL_SETTINGS_FILE, {});
  const current = getScopedEmailSettings(academyId);
  const nextPassword = String(input.password || "").trim();

  const next = {
    provider: String(input.provider || current.provider || "smtp")
      .trim()
      .toLowerCase(),
    host: String(input.host || current.host || "").trim(),
    port: toInt(input.port, current.port || 587),
    secure:
      typeof input.secure === "boolean"
        ? input.secure
        : toBool(input.secure, current.secure),
    username: normalizeEmail(input.username || current.username || ""),
    password: nextPassword || current.password || "",
    fromName: String(
      input.fromName || current.fromName || "Rebel Angels",
    ).trim(),
    fromEmail: normalizeEmail(input.fromEmail || current.fromEmail || ""),
    replyTo: normalizeEmail(input.replyTo || current.replyTo || ""),
    isEnabled:
      typeof input.isEnabled === "boolean"
        ? input.isEnabled
        : toBool(input.isEnabled, current.isEnabled),
    updatedAt: new Date().toISOString(),
    updatedBy: String(userId || ""),
  };

  all[String(academyId)] = next;
  safeJsonWrite(EMAIL_SETTINGS_FILE, all);

  return getScopedEmailSettings(academyId);
}

/* -------------------------------------------------------
 * TEMPLATE / SEND HELPERS
 * ----------------------------------------------------- */

async function findDbTemplate({ academyId = null, key = "" }) {
  const normalizedKey = normalizeTemplateKey(key);
  if (!normalizedKey) return null;

  if (academyId && isValidObjectIdLike(academyId)) {
    const academyTemplate = await EmailTemplate.findOne({
      academyId,
      key: normalizedKey,
      isActive: true,
    }).lean();

    if (academyTemplate) return academyTemplate;
  }

  const systemTemplate = await EmailTemplate.findOne({
    academyId: null,
    key: normalizedKey,
    isActive: true,
    isSystem: true,
  }).lean();

  return systemTemplate || null;
}

function getDefaultTemplateKey(value) {
  const key = normalizeTemplateKey(value);
  return key || "welcome_parent";
}

function buildDefaultVariables(req, extra = {}) {
  const appUrl = String(process.env.APP_URL || "http://localhost:5173").replace(
    /\/+$/,
    "",
  );

  return {
    name: req.user?.name || "there",
    loginUrl: `${appUrl}/login`,
    resetUrl: `${appUrl}/reset-password?token=test-token`,
    inviteUrl: `${appUrl}/reset-password?token=test-token`,
    resultsUrl: `${appUrl}/parent/results`,
    certificateUrl: `${appUrl}/certificates/demo`,
    parentName: req.user?.name || "Parent",
    childName: "Demo Participant",
    participantName: "Demo Participant",
    eventName: "Demo Event",
    amount: "150.00",
    currency: "QAR",
    paymentRef: "TEST-EMAIL-001",
    paymentStatus: "PAID",
    receiptNo: "TEST-RCPT-001",
    invoiceNumber: "TEST-INV-001",
    serialNo: "RA-TEST-0001",
    score: "9.5",
    rank: "1",
    activityName: "Floor Exercise",
    actionUrl: `${appUrl}/admin`,
    actionLabel: "Open Dashboard",
    academyName: "Rebel Angels Gymnastics",
    ...extra,
  };
}

async function sendOneEmail({
  req,
  academyId,
  to,
  template = "",
  subject = "",
  html = "",
  text = "",
  message = "",
  data = {},
  variables = {},
  meta = {},
}) {
  const templateKey = getDefaultTemplateKey(template);

  const baseVariables = buildDefaultVariables(req, {
    ...(data || {}),
    ...(variables || {}),
    subject: subject || data?.subject || "Email from Rebel Angels",
    message:
      message ||
      text ||
      data?.message ||
      "This is an email from Rebel Angels Gymnastics.",
    html,
    text,
  });

  const dbTemplate = await findDbTemplate({
    academyId,
    key: templateKey,
  });

  if (dbTemplate) {
    return triggerAutoEmail({
      academyId,
      recipientUserId: req.user?._id || null,
      recipientRole: req.user?.role || "ADMIN",
      recipientEmail: to,
      templateKey: dbTemplate.key,
      variables: baseVariables,
      meta: {
        type: "ADMIN_EMAIL",
        academyId: academyId || null,
        userId: String(req.user?._id || ""),
        requestedBy: req.user?.email || "",
        source: "ADMIN_EMAIL_ROUTE",
        ...meta,
      },
      syncNotification: false,
    });
  }

  return sendTransactionalEmail({
    to,
    template: normalizeTemplateUpper(templateKey),
    data: baseVariables,
    meta: {
      type: "ADMIN_EMAIL",
      academyId: academyId || null,
      userId: String(req.user?._id || ""),
      requestedBy: req.user?.email || "",
      source: "ADMIN_EMAIL_ROUTE",
      ...meta,
    },
  });
}

async function getBulkRecipients(req, payload = {}, academyId = "") {
  const mode = String(payload.mode || "manual")
    .trim()
    .toLowerCase();
  const academyObjectId = toObjectId(academyId);

  const scopedQuery = academyObjectId ? { academyId: academyObjectId } : {};
  let recipients = [];

  if (mode === "manual") {
    recipients = normalizeEmailList(payload.emails);
  }

  if (mode === "role") {
    const role = normalizeTemplateUpper(payload.role || "");

    if (!role) {
      throw new Error("Recipient role is required");
    }

    const users = await User.find({
      ...scopedQuery,
      role,
      email: { $exists: true, $ne: "" },
    })
      .select("email")
      .lean();

    recipients = users.map((u) => u.email);
  }

  if (mode === "all-parents") {
    const users = await User.find({
      ...scopedQuery,
      role: "PARENT",
      email: { $exists: true, $ne: "" },
    })
      .select("email")
      .lean();

    recipients = users.map((u) => u.email);
  }
  if (mode === "all-participants") {
    const participants = await Participant.find({
      ...scopedQuery,
      status: "ACTIVE",
    })
      .select("userId parentUserId parentEmail")
      .populate("userId", "email")
      .populate("parentUserId", "email")
      .lean();

    recipients = participants.flatMap((p) => [
      p?.parentEmail,
      p?.parentUserId?.email,
      p?.userId?.email,
    ]);
  }

  if (mode === "event") {
    const eventId = String(payload.eventId || "").trim();

    if (!eventId || !isValidObjectIdLike(eventId)) {
      throw new Error("Valid eventId is required");
    }

    const enrollments = await EventEnrollment.find({
      ...scopedQuery,
      eventId: toObjectId(eventId),
    })
      .populate({
        path: "participantId",
        select: "userId parentUserId parentEmail",
        populate: [
          { path: "userId", select: "email" },
          { path: "parentUserId", select: "email" },
        ],
      })
      .lean();

    recipients = enrollments.flatMap((row) => [
      row?.participantId?.parentEmail,
      row?.participantId?.parentUserId?.email,
      row?.participantId?.userId?.email,
    ]);
  }

  return normalizeEmailList(recipients);
}

function buildMongoQuery(req) {
  const academyId = getScopeAcademyId(req);
  const status = String(req.query.status || "")
    .trim()
    .toUpperCase();
  const template = String(req.query.template || "").trim();
  const q = String(req.query.q || "").trim();
  const to = String(req.query.to || "")
    .trim()
    .toLowerCase();

  const query = {};

  if (academyId && isValidObjectIdLike(academyId)) {
    query.academyId = academyId;
  }

  if (status && ["PENDING", "SENT", "FAILED", "SKIPPED"].includes(status)) {
    query.status = status;
  }

  if (template) {
    query.$or = [
      { template: normalizeTemplateUpper(template) },
      { templateKey: normalizeTemplateKey(template) },
      { "meta.template": normalizeTemplateKey(template) },
      { "meta.templateKey": normalizeTemplateKey(template) },
      { "meta.templateKeyResolved": normalizeTemplateKey(template) },
      { "meta.triggerEvent": normalizeTemplateUpper(template) },
    ];
  }

  if (to) {
    query.$or = [...(query.$or || []), { to }, { to: { $in: [to] } }];
  }

  if (q) {
    const qRegex = { $regex: q, $options: "i" };
    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { subject: qRegex },
          { template: qRegex },
          { templateKey: qRegex },
          { triggerEvent: qRegex },
          { providerMessageId: qRegex },
          { errorMessage: qRegex },
          { "meta.type": qRegex },
          { "meta.template": qRegex },
          { "meta.templateKey": qRegex },
          { "meta.templateKeyResolved": qRegex },
          { "meta.triggerEvent": qRegex },
          { "meta.templateName": qRegex },
          { to: qRegex },
          { to: { $elemMatch: qRegex } },
        ],
      },
    ];
  }

  return query;
}

/* =========================================================
   GET /admin/email/settings
========================================================= */

router.get(
  "/settings",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const settings = getScopedEmailSettings(academyId);

    return res.json({
      ok: true,
      settings: {
        provider: settings.provider,
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        username: settings.username,
        hasPassword: !!settings.hasPassword,
        fromName: settings.fromName,
        fromEmail: settings.fromEmail,
        replyTo: settings.replyTo,
        isEnabled: !!settings.isEnabled,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
      },
    });
  }),
);

/* =========================================================
   PUT /admin/email/settings
========================================================= */

router.put(
  "/settings",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const schema = z.object({
      provider: z.string().optional(),
      host: z.string().min(1, "SMTP host is required"),
      port: z.coerce.number().min(1, "Valid SMTP port is required"),
      secure: z.boolean().optional(),
      username: z.string().min(1, "SMTP username is required"),
      password: z.string().optional(),
      fromName: z.string().min(1, "Sender name is required"),
      fromEmail: z.string().email("Valid sender email is required"),
      replyTo: z
        .union([z.string().email("Valid reply-to email"), z.literal("")])
        .optional(),
      isEnabled: z.boolean().optional(),
    });

    const parsed = schema.parse(req.body || {});

    const settings = saveScopedEmailSettings(
      academyId,
      {
        provider: parsed.provider || "smtp",
        host: parsed.host,
        port: parsed.port,
        secure: !!parsed.secure,
        username: parsed.username,
        password: parsed.password || "",
        fromName: parsed.fromName,
        fromEmail: parsed.fromEmail,
        replyTo: parsed.replyTo || "",
        isEnabled:
          typeof parsed.isEnabled === "boolean" ? parsed.isEnabled : true,
      },
      req.user?._id || "",
    );

    return res.json({
      ok: true,
      message: "Email settings saved successfully",
      settings: {
        provider: settings.provider,
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        username: settings.username,
        hasPassword: !!settings.hasPassword,
        fromName: settings.fromName,
        fromEmail: settings.fromEmail,
        replyTo: settings.replyTo,
        isEnabled: !!settings.isEnabled,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
      },
    });
  }),
);

/* =========================================================
   GET /admin/email/logs
========================================================= */

router.get(
  "/logs",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;

    const query = buildMongoQuery(req);

    const [items, total, stats] = await Promise.all([
      EmailLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailLog.countDocuments(query),
      EmailLog.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summary = {
      total,
      sent: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
    };

    for (const row of stats || []) {
      const key = String(row?._id || "").toLowerCase();
      if (key === "sent") summary.sent = Number(row.count || 0);
      if (key === "failed") summary.failed = Number(row.count || 0);
      if (key === "pending") summary.pending = Number(row.count || 0);
      if (key === "skipped") summary.skipped = Number(row.count || 0);
    }

    return res.json({
      ok: true,
      items,
      total,
      page,
      limit,
      pages: Math.max(Math.ceil(total / limit), 1),
      summary,
    });
  }),
);

/* =========================================================
   GET /admin/email/logs/:id
========================================================= */

router.get(
  "/logs/:id",
  wrap(async (req, res) => {
    const row = await EmailLog.findById(req.params.id).lean();

    if (!row) {
      return res.status(404).json({ message: "Email log not found" });
    }

    const academyId = getScopeAcademyId(req);
    const superAdmin = isSuperAdmin(req);

    if (
      academyId &&
      row.academyId &&
      !superAdmin &&
      String(row.academyId) !== String(academyId)
    ) {
      return res.status(403).json({ message: "Not allowed" });
    }

    return res.json({
      ok: true,
      item: row,
    });
  }),
);

/* =========================================================
   POST /admin/email/verify
========================================================= */

router.post(
  "/verify",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const startedAt = Date.now();
    const result = await verifyEmailTransport({ academyId });

    if (!result?.ok) {
      return res.status(result?.skipped ? 400 : 500).json({
        ok: false,
        message: result?.error || result?.message || "SMTP verification failed",
        tookMs: Date.now() - startedAt,
        result,
      });
    }

    return res.json({
      ok: true,
      message: "SMTP verified successfully",
      tookMs: Date.now() - startedAt,
      result,
    });
  }),
);

/* =========================================================
   POST /admin/email/test
========================================================= */

router.post(
  "/test",
  wrap(async (req, res) => {
    const schema = z.object({
      to: z.union([
        z.string().email("Valid recipient email is required"),
        z.array(z.string().email("Valid recipient email is required")),
      ]),
      cc: z.array(z.string()).optional(),
      bcc: z.array(z.string()).optional(),
      template: z.string().optional(),
      subject: z.string().optional(),
      html: z.string().optional(),
      text: z.string().optional(),
      message: z.string().optional(),
      name: z.string().optional(),
      data: z.record(z.any()).optional(),
      variables: z.record(z.any()).optional(),
      useDbTemplate: z.boolean().optional(),
    });

    const parsed = schema.parse(req.body || {});
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const recipients = normalizeEmailList(parsed.to);

    if (!recipients.length) {
      return res.status(400).json({
        ok: false,
        message: "Valid recipient email is required",
      });
    }

    const subject = String(parsed.subject || "").trim();
    const html = String(parsed.html || "").trim();
    const text = String(parsed.text || "").trim();
    const message = String(parsed.message || text || "").trim();
    const template = String(parsed.template || "welcome_parent").trim();

    if (!template && !subject) {
      return res.status(400).json({
        ok: false,
        message: "Subject is required",
      });
    }

    if (!template && !html && !text && !message) {
      return res.status(400).json({
        ok: false,
        message: "Email body is required",
      });
    }

    const results = [];

    for (const to of recipients) {
      const result = await sendOneEmail({
        req,
        academyId,
        to,
        subject,
        html,
        text,
        message,
        template,
        data: {
          ...(parsed.data || {}),
          name: parsed.name || req.user?.name || "there",
        },
        variables: parsed.variables || {},
        meta: {
          type: "TEST_EMAIL",
          source: "ADMIN_TEST_ROUTE",
        },
      });

      results.push({
        to,
        ok: !!result?.ok || !!result?.skipped,
        skipped: !!result?.skipped,
        message: result?.message || result?.error || "",
      });
    }

    const failed = results.filter((x) => !x.ok);

    if (failed.length) {
      return res.status(500).json({
        ok: false,
        message: "Some test emails failed",
        results,
      });
    }

    return res.json({
      ok: true,
      message:
        recipients.length > 1
          ? "Test emails processed successfully"
          : "Test email sent successfully",
      results,
    });
  }),
);

/* =========================================================
   POST /admin/email/bulk
========================================================= */

router.post(
  "/bulk",
  wrap(async (req, res) => {
    const schema = z.object({
      mode: z
        .enum(["manual", "role", "event", "all-parents", "all-participants"])
        .default("manual"),
      emails: z.array(z.string()).optional(),
      role: z.string().optional(),
      eventId: z.string().optional(),
      subject: z.string().optional(),
      html: z.string().optional(),
      text: z.string().optional(),
      template: z.string().optional(),
      data: z.record(z.any()).optional(),
      cc: z.array(z.string()).optional(),
      bcc: z.array(z.string()).optional(),
      chunkSize: z.coerce.number().optional(),
    });

    const parsed = schema.parse(req.body || {});
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const subject = String(parsed.subject || "").trim();
    const html = String(parsed.html || "").trim();
    const text = String(parsed.text || "").trim();
    const template = String(parsed.template || "welcome_parent").trim();

    if (!template && !subject) {
      return res.status(400).json({
        ok: false,
        message: "Subject is required",
      });
    }

    if (!template && !html && !text) {
      return res.status(400).json({
        ok: false,
        message: "Email body is required",
      });
    }

    const recipients = await getBulkRecipients(req, parsed, academyId);

    if (!recipients.length) {
      return res.status(400).json({
        ok: false,
        message: "No valid recipient emails found",
      });
    }

    const size = Math.min(200, Math.max(1, Number(parsed.chunkSize || 50)));
    const batches = [];

    for (let i = 0; i < recipients.length; i += size) {
      batches.push(recipients.slice(i, i + size));
    }

    let sentBatches = 0;
    let failedBatches = 0;
    let skippedBatches = 0;

    const errors = [];

    for (const batch of batches) {
      let batchFailed = false;
      let batchSkipped = false;

      for (const to of batch) {
        try {
          const result = await sendOneEmail({
            req,
            academyId,
            to,
            subject,
            html,
            text,
            message: text || subject,
            template,
            data: parsed.data || {},
            variables: {},
            meta: {
              type: "BULK_EMAIL",
              bulk: true,
              mode: parsed.mode,
              recipientCount: recipients.length,
            },
          });

          if (result?.skipped) {
            batchSkipped = true;
          }

          if (!result?.ok && !result?.skipped) {
            batchFailed = true;
            errors.push({
              to,
              message: result?.error || "Failed to send email",
            });
          }
        } catch (error) {
          batchFailed = true;
          errors.push({
            to,
            message: error?.message || "Failed to send email",
          });
        }
      }

      if (batchFailed) {
        failedBatches += 1;
      } else if (batchSkipped) {
        skippedBatches += 1;
      } else {
        sentBatches += 1;
      }
    }

    return res.json({
      ok: true,
      message: "Bulk email processed",
      summary: {
        totalRecipients: recipients.length,
        totalBatches: batches.length,
        sentBatches,
        skippedBatches,
        failedBatches,
      },
      errors,
    });
  }),
);

/* =========================================================
   GET /admin/email/templates
========================================================= */

router.get(
  "/templates",
  wrap(async (req, res) => {
    const academyId = getOptionalTemplateAcademyId(req);
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "")
      .trim()
      .toUpperCase();
    const isActiveRaw = req.query.isActive;

    const mongoQuery = {};

    if (isSuperAdmin(req)) {
      if (academyId && isValidObjectIdLike(academyId)) {
        mongoQuery.$or = [
          { academyId: String(academyId) },
          { academyId: null, isSystem: true },
        ];
      } else {
        mongoQuery.academyId = null;
      }
    } else {
      const requiredAcademyId = getRequiredTemplateAcademyId(req, res);
      if (!requiredAcademyId) return;

      mongoQuery.$or = [
        { academyId: String(requiredAcademyId) },
        { academyId: null, isSystem: true },
      ];
    }

    if (category && category !== "ALL") {
      mongoQuery.category = category;
    }

    if (isActiveRaw !== undefined) {
      mongoQuery.isActive = String(isActiveRaw) === "true";
    }

    if (q) {
      const qRegex = { $regex: q, $options: "i" };
      mongoQuery.$and = [
        ...(mongoQuery.$and || []),
        {
          $or: [
            { name: qRegex },
            { key: qRegex },
            { subject: qRegex },
            { description: qRegex },
            { variables: { $elemMatch: qRegex } },
          ],
        },
      ];
    }

    const items = await EmailTemplate.find(mongoQuery)
      .sort({ isSystem: -1, updatedAt: -1, createdAt: -1 })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    return res.json({
      ok: true,
      items: items.map(sanitizeTemplateOutput),
      total: items.length,
    });
  }),
);

/* =========================================================
   GET /admin/email/templates/:id
========================================================= */

router.get(
  "/templates/:id",
  wrap(async (req, res) => {
    const id = String(req.params.id || "").trim();

    if (!isValidObjectIdLike(id)) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const academyId = getOptionalTemplateAcademyId(req);
    const query = { _id: id };

    if (isSuperAdmin(req)) {
      if (academyId && isValidObjectIdLike(academyId)) {
        query.$or = [
          { academyId: String(academyId) },
          { academyId: null, isSystem: true },
        ];
      } else {
        query.academyId = null;
      }
    } else {
      const requiredAcademyId = getRequiredTemplateAcademyId(req, res);
      if (!requiredAcademyId) return;

      query.$or = [
        { academyId: String(requiredAcademyId) },
        { academyId: null, isSystem: true },
      ];
    }

    const item = await EmailTemplate.findOne(query)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    if (!item) {
      return res.status(404).json({ message: "Email template not found" });
    }

    return res.json({
      ok: true,
      item: sanitizeTemplateOutput(item),
    });
  }),
);

/* =========================================================
   POST /admin/email/templates
========================================================= */

router.post(
  "/templates",
  wrap(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1, "Template name is required"),
      key: z.string().min(1, "Template key is required"),
      category: z.string().optional(),
      subject: z.string().min(1, "Template subject is required"),
      html: z.string().optional(),
      text: z.string().optional(),
      description: z.string().optional(),
      variables: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
      isSystem: z.boolean().optional(),
      academyId: z.string().optional(),
    });

    const parsed = schema.parse(req.body || {});

    let academyId = null;

    if (isSuperAdmin(req)) {
      const optionalAcademyId = getOptionalTemplateAcademyId(req);
      academyId =
        optionalAcademyId && isValidObjectIdLike(optionalAcademyId)
          ? String(optionalAcademyId)
          : parsed.academyId && isValidObjectIdLike(parsed.academyId)
            ? String(parsed.academyId)
            : null;
    } else {
      academyId = getRequiredTemplateAcademyId(req, res);
      if (!academyId) return;
    }

    const key = normalizeTemplateKey(parsed.key);

    const exists = await EmailTemplate.findOne({
      academyId: academyId || null,
      key,
    }).lean();

    if (exists) {
      return res.status(400).json({
        message: "Template key already exists in this scope",
      });
    }

    const doc = await EmailTemplate.create({
      academyId: academyId || null,
      name: String(parsed.name || "").trim(),
      key,
      category: normalizeTemplateUpper(parsed.category || "GENERAL"),
      subject: String(parsed.subject || "").trim(),
      html: String(parsed.html || ""),
      text: String(parsed.text || ""),
      description: String(parsed.description || "").trim(),
      variables: normalizeVariablesList(parsed.variables || []),
      isActive: parsed.isActive !== false,
      isSystem: !!parsed.isSystem,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
      meta: {},
    });

    const item = await EmailTemplate.findById(doc._id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    return res.json({
      ok: true,
      message: "Email template created successfully",
      item: sanitizeTemplateOutput(item),
    });
  }),
);

/* =========================================================
   PUT /admin/email/templates/:id
========================================================= */

router.put(
  "/templates/:id",
  wrap(async (req, res) => {
    const id = String(req.params.id || "").trim();

    if (!isValidObjectIdLike(id)) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      key: z.string().min(1).optional(),
      category: z.string().optional(),
      subject: z.string().min(1).optional(),
      html: z.string().optional(),
      text: z.string().optional(),
      description: z.string().optional(),
      variables: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
      isSystem: z.boolean().optional(),
    });

    const parsed = schema.parse(req.body || {});
    const academyId = getOptionalTemplateAcademyId(req);

    const findQuery = { _id: id };

    if (isSuperAdmin(req)) {
      if (academyId && isValidObjectIdLike(academyId)) {
        findQuery.$or = [{ academyId: String(academyId) }, { academyId: null }];
      } else {
        findQuery.academyId = null;
      }
    } else {
      const requiredAcademyId = getRequiredTemplateAcademyId(req, res);
      if (!requiredAcademyId) return;

      findQuery.$or = [
        { academyId: String(requiredAcademyId) },
        { academyId: null, isSystem: true },
      ];
    }

    const existing = await EmailTemplate.findOne(findQuery);

    if (!existing) {
      return res.status(404).json({ message: "Email template not found" });
    }

    if (
      !isSuperAdmin(req) &&
      existing.academyId === null &&
      existing.isSystem
    ) {
      return res.status(403).json({
        message: "System templates cannot be edited by admin",
      });
    }

    if (parsed.key !== undefined) {
      const nextKey = normalizeTemplateKey(parsed.key);

      const duplicate = await EmailTemplate.findOne({
        _id: { $ne: existing._id },
        academyId: existing.academyId || null,
        key: nextKey,
      }).lean();

      if (duplicate) {
        return res.status(400).json({
          message: "Template key already exists in this scope",
        });
      }

      existing.key = nextKey;
    }

    if (parsed.name !== undefined) {
      existing.name = String(parsed.name || "").trim();
    }

    if (parsed.category !== undefined) {
      existing.category = normalizeTemplateUpper(parsed.category || "GENERAL");
    }

    if (parsed.subject !== undefined) {
      existing.subject = String(parsed.subject || "").trim();
    }

    if (parsed.html !== undefined) {
      existing.html = String(parsed.html || "");
    }

    if (parsed.text !== undefined) {
      existing.text = String(parsed.text || "");
    }

    if (parsed.description !== undefined) {
      existing.description = String(parsed.description || "").trim();
    }

    if (parsed.variables !== undefined) {
      existing.variables = normalizeVariablesList(parsed.variables || []);
    }

    if (parsed.isActive !== undefined) {
      existing.isActive = !!parsed.isActive;
    }

    if (parsed.isSystem !== undefined && isSuperAdmin(req)) {
      existing.isSystem = !!parsed.isSystem;
    }

    existing.updatedBy = req.user?._id || null;
    await existing.save();

    const item = await EmailTemplate.findById(existing._id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    return res.json({
      ok: true,
      message: "Email template updated successfully",
      item: sanitizeTemplateOutput(item),
    });
  }),
);

/* =========================================================
   PATCH /admin/email/templates/:id/toggle
========================================================= */

router.patch(
  "/templates/:id/toggle",
  wrap(async (req, res) => {
    const id = String(req.params.id || "").trim();

    if (!isValidObjectIdLike(id)) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const academyId = getOptionalTemplateAcademyId(req);
    const findQuery = { _id: id };

    if (isSuperAdmin(req)) {
      if (academyId && isValidObjectIdLike(academyId)) {
        findQuery.$or = [{ academyId: String(academyId) }, { academyId: null }];
      } else {
        findQuery.academyId = null;
      }
    } else {
      const requiredAcademyId = getRequiredTemplateAcademyId(req, res);
      if (!requiredAcademyId) return;

      findQuery.$or = [
        { academyId: String(requiredAcademyId) },
        { academyId: null, isSystem: true },
      ];
    }

    const doc = await EmailTemplate.findOne(findQuery);

    if (!doc) {
      return res.status(404).json({ message: "Email template not found" });
    }

    if (!isSuperAdmin(req) && doc.academyId === null && doc.isSystem) {
      return res.status(403).json({
        message: "System templates cannot be toggled by admin",
      });
    }

    doc.isActive = !doc.isActive;
    doc.updatedBy = req.user?._id || null;
    await doc.save();

    const item = await EmailTemplate.findById(doc._id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    return res.json({
      ok: true,
      message: doc.isActive
        ? "Template activated successfully"
        : "Template deactivated successfully",
      item: sanitizeTemplateOutput(item),
    });
  }),
);

/* =========================================================
   DELETE /admin/email/templates/:id
========================================================= */

router.delete(
  "/templates/:id",
  wrap(async (req, res) => {
    const id = String(req.params.id || "").trim();

    if (!isValidObjectIdLike(id)) {
      return res.status(400).json({ message: "Invalid template id" });
    }

    const academyId = getOptionalTemplateAcademyId(req);
    const findQuery = { _id: id };

    if (isSuperAdmin(req)) {
      if (academyId && isValidObjectIdLike(academyId)) {
        findQuery.$or = [{ academyId: String(academyId) }, { academyId: null }];
      } else {
        findQuery.academyId = null;
      }
    } else {
      const requiredAcademyId = getRequiredTemplateAcademyId(req, res);
      if (!requiredAcademyId) return;

      findQuery.academyId = String(requiredAcademyId);
    }

    const doc = await EmailTemplate.findOne(findQuery);

    if (!doc) {
      return res.status(404).json({ message: "Email template not found" });
    }

    if (!isSuperAdmin(req) && doc.isSystem) {
      return res.status(403).json({
        message: "System templates cannot be deleted by admin",
      });
    }

    await EmailTemplate.deleteOne({ _id: doc._id });

    return res.json({
      ok: true,
      message: "Email template deleted successfully",
    });
  }),
);

/* =========================================================
   POST /admin/email/templates/preview
========================================================= */

router.post(
  "/templates/preview",
  wrap(async (req, res) => {
    const schema = z.object({
      templateId: z.string().optional(),
      key: z.string().optional(),
      template: z.string().optional(),
      subject: z.string().optional(),
      html: z.string().optional(),
      text: z.string().optional(),
      data: z.record(z.any()).optional(),
      variables: z.record(z.any()).optional(),
    });

    const parsed = schema.parse(req.body || {});
    const academyId = getOptionalTemplateAcademyId(req);
    let source = null;

    const requestedKey = parsed.key || parsed.template || "";

    if (parsed.templateId && isValidObjectIdLike(parsed.templateId)) {
      const query = { _id: parsed.templateId };

      if (isSuperAdmin(req)) {
        if (academyId && isValidObjectIdLike(academyId)) {
          query.$or = [
            { academyId: String(academyId) },
            { academyId: null, isSystem: true },
          ];
        } else {
          query.academyId = null;
        }
      } else {
        const requiredAcademyId = getRequiredTemplateAcademyId(req, res);
        if (!requiredAcademyId) return;

        query.$or = [
          { academyId: String(requiredAcademyId) },
          { academyId: null, isSystem: true },
        ];
      }

      source = await EmailTemplate.findOne(query).lean();
    } else if (requestedKey) {
      source = await findDbTemplate({
        academyId,
        key: requestedKey,
      });
    }

    const variables = {
      ...(parsed.data || {}),
      ...(parsed.variables || {}),
    };

    const subject = parsed.subject ?? source?.subject ?? "";
    const html = parsed.html ?? source?.html ?? "";
    const text = parsed.text ?? source?.text ?? "";

    const rendered = renderTemplate({
      subject,
      html,
      text,
      variables,
    });

    return res.json({
      ok: true,
      preview: {
        subject: rendered.subject || subject || "",
        html: rendered.html || html || "",
        text: rendered.text || text || "",
        templateKey: source?.key || normalizeTemplateKey(requestedKey) || "",
        templateName: source?.name || "",
        variables: source?.variables || Object.keys(variables || {}),
        source: source ? "template" : "manual",
      },
      rendered,
      sourceTemplate: source
        ? {
            _id: String(source._id || ""),
            key: source.key,
            name: source.name,
            category: source.category,
            isSystem: !!source.isSystem,
            academyId: source.academyId ? String(source.academyId) : null,
          }
        : null,
    });
  }),
);

/* =========================================================
   ERROR HANDLER
========================================================= */

router.use((err, _req, res, _next) => {
  console.error("admin.email.routes error:", err);

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: "Validation error",
      issues: err.issues,
    });
  }

  if (err?.name === "CastError") {
    return res.status(400).json({
      message: `Invalid ${err.path || "id"}`,
    });
  }

  return res.status(500).json({
    message: err?.message || "Server error",
    stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
  });
});

export default router;
