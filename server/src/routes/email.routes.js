import express from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import EmailLog from "../models/EmailLog.js";
import { verifyEmailTransport } from "../services/email/emailClient.js";
import { sendTransactionalEmail } from "../services/email/emailService.js";

const router = express.Router();

router.use(auth, requireRole("ADMIN", "SUPER_ADMIN"));

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

/* =========================================================
 * FILE PATHS
 * ======================================================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const EMAIL_SETTINGS_FILE = path.join(UPLOAD_DIR, "email-settings.json");
const EMAIL_TEMPLATES_FILE = path.join(UPLOAD_DIR, "email-templates.json");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/* =========================================================
 * HELPERS
 * ======================================================= */
function isValidObjectIdLike(value) {
  return /^[a-f\d]{24}$/i.test(String(value || "").trim());
}

function getScopeAcademyId(req) {
  if (String(req.user?.role || "").toUpperCase() !== "SUPER_ADMIN") {
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

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return [
      ...new Set(value.map((x) => String(x || "").trim()).filter(Boolean)),
    ];
  }

  const s = String(value || "").trim();
  if (!s) return [];
  return [
    ...new Set(
      s
        .split(",")
        .map((x) => String(x || "").trim())
        .filter(Boolean),
    ),
  ];
}

function safeJsonRead(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeJsonWrite(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function buildMongoQuery(req) {
  const academyId = getScopeAcademyId(req);
  const status = String(req.query.status || "")
    .trim()
    .toUpperCase();
  const template = String(req.query.template || "")
    .trim()
    .toUpperCase();
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
    query.template = template;
  }

  if (to) {
    query.to = { $in: [to] };
  }

  if (q) {
    query.$or = [
      { subject: { $regex: q, $options: "i" } },
      { template: { $regex: q, $options: "i" } },
      { "meta.type": { $regex: q, $options: "i" } },
      { errorMessage: { $regex: q, $options: "i" } },
      { to: { $elemMatch: { $regex: q, $options: "i" } } },
    ];
  }

  return query;
}

function getDefaultSettings() {
  return {
    enabled: true,
    fromEmail: String(
      process.env.EMAIL_FROM || process.env.SMTP_FROM || "",
    ).trim(),
    fromName: String(
      process.env.EMAIL_FROM_NAME || process.env.APP_NAME || "Rebel Angels",
    ).trim(),
    replyTo: "",
    provider: String(process.env.EMAIL_PROVIDER || "smtp")
      .trim()
      .toLowerCase(),
    appUrl: String(process.env.APP_URL || "http://localhost:5173").trim(),
    updatedAt: null,
    updatedBy: "",
  };
}

function readAllEmailSettings() {
  return safeJsonRead(EMAIL_SETTINGS_FILE, {});
}

function writeAllEmailSettings(value) {
  safeJsonWrite(EMAIL_SETTINGS_FILE, value || {});
}

function getEmailSettingsForAcademy(academyId = "") {
  const all = readAllEmailSettings();
  const scoped = academyId ? all[String(academyId)] || {} : {};
  return {
    ...getDefaultSettings(),
    ...scoped,
  };
}

function saveEmailSettingsForAcademy(academyId, patch = {}, userId = "") {
  const all = readAllEmailSettings();
  const current = getEmailSettingsForAcademy(academyId);

  const next = {
    ...current,
    ...patch,
    academyId: academyId ? String(academyId) : null,
    updatedAt: new Date().toISOString(),
    updatedBy: String(userId || ""),
  };

  if (academyId) {
    all[String(academyId)] = next;
    writeAllEmailSettings(all);
  }

  return next;
}

function getDefaultTemplateItems() {
  const now = new Date().toISOString();

  return [
    {
      id: "WELCOME",
      key: "WELCOME",
      name: "WELCOME",
      subject: "Welcome to Rebel Angels",
      body: "Hello {{name}},\n\nWelcome to Rebel Angels.\n\nLogin: {{loginUrl}}\n\nRegards,\n{{academyName}}",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "PAYMENT_RECEIPT",
      key: "PAYMENT_RECEIPT",
      name: "PAYMENT_RECEIPT",
      subject: "Payment Receipt",
      body: "Hello {{name}},\n\nWe received your payment of {{amount}} {{currency}} for {{eventName}}.\n\nRegards,\n{{academyName}}",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "RESULT_PUBLISHED",
      key: "RESULT_PUBLISHED",
      name: "RESULT_PUBLISHED",
      subject: "Results Published",
      body: "Hello {{parentName}},\n\nResults are published for {{childName}}.\nRank: {{rank}}\nScore: {{total}}\n\nView: {{resultsUrl}}",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "CERTIFICATE_READY",
      key: "CERTIFICATE_READY",
      name: "CERTIFICATE_READY",
      subject: "Certificate Ready",
      body: "Hello {{name}},\n\nYour certificate is ready.\n\nOpen: {{certificateUrl}}",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "PASSWORD_RESET",
      key: "PASSWORD_RESET",
      name: "PASSWORD_RESET",
      subject: "Password Reset",
      body: "Hello {{name}},\n\nReset your password here:\n{{resetUrl}}",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "ACCOUNT_INVITE",
      key: "ACCOUNT_INVITE",
      name: "ACCOUNT_INVITE",
      subject: "Account Invitation",
      body: "Hello {{name}},\n\nYou have been invited.\nSet password: {{inviteUrl}}\nLogin: {{loginUrl}}",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function readTemplateStore() {
  const stored = safeJsonRead(EMAIL_TEMPLATES_FILE, null);
  if (Array.isArray(stored) && stored.length) return stored;

  const defaults = getDefaultTemplateItems();
  safeJsonWrite(EMAIL_TEMPLATES_FILE, defaults);
  return defaults;
}

function writeTemplateStore(items) {
  safeJsonWrite(EMAIL_TEMPLATES_FILE, Array.isArray(items) ? items : []);
}

function normalizeTemplateKey(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "_")
    .toUpperCase();
}

function makeTemplateId(value = "") {
  const base = normalizeTemplateKey(value);
  return base || `TPL_${Date.now()}`;
}

function renderTemplateText(text = "", data = {}) {
  return String(text || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const value = data?.[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function buildPreviewPayload(req, payload = {}) {
  return {
    name: payload.name || req.user?.name || "there",
    parentName: payload.name || req.user?.name || "Parent",
    childName: payload.childName || "Demo Participant",
    participantName: payload.participantName || "Demo Participant",
    judgeName: payload.name || req.user?.name || "Judge",
    loginUrl: process.env.APP_URL || "http://localhost:5173",
    resetUrl: `${String(process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, "")}/reset-password?token=test-token`,
    inviteUrl: process.env.APP_URL || "http://localhost:5173",
    resultsUrl: process.env.APP_URL || "http://localhost:5173",
    certificateUrl: process.env.APP_URL || "http://localhost:5173",
    actionUrl: process.env.APP_URL || "http://localhost:5173",
    actionLabel: "Open Dashboard",
    eventName: payload.eventName || "Demo Event",
    amount: payload.amount ?? 150,
    currency: payload.currency || "QAR",
    paymentRef: payload.paymentRef || "TEST-EMAIL-001",
    subject: payload.subject || "Test Email",
    message:
      payload.message ||
      "This is a preview email from Rebel Angels Gymnastics.",
    academyName:
      payload.academyName || process.env.APP_NAME || "Rebel Angels Gymnastics",
    role: payload.role || "USER",
    roleLabel: payload.roleLabel || payload.role || "USER",
    temporaryPassword: payload.temporaryPassword || "123456",
    receiptNo: payload.receiptNo || "RCPT-TEST-001",
    paidAt: payload.paidAt || new Date().toLocaleString(),
    total: payload.total ?? "9.50",
    score: payload.score ?? "9.50",
    rank: payload.rank ?? "#1",
  };
}

function buildTemplateCatalogResponse(items) {
  return (items || []).map((item) => ({
    id: item.id,
    key: item.key,
    name: item.name,
    subject: item.subject || "",
    body: item.body || "",
    isActive: item.isActive !== false,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }));
}

const emailSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  fromEmail: z.string().optional(),
  fromName: z.string().optional(),
  replyTo: z.string().optional(),
  provider: z.string().optional(),
  appUrl: z.string().optional(),
});

const emailTestSchema = z.object({
  to: z.string().email("Valid recipient email is required"),
  template: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  name: z.string().optional(),
});

const sendEmailSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  template: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  name: z.string().optional(),
  data: z.record(z.any()).optional(),
  meta: z.record(z.any()).optional(),
});

const sendBulkEmailSchema = z.object({
  to: z.array(z.string()).min(1),
  template: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  name: z.string().optional(),
  data: z.record(z.any()).optional(),
  meta: z.record(z.any()).optional(),
});

const previewSchema = z.object({
  template: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  name: z.string().optional(),
  data: z.record(z.any()).optional(),
});

const templateCreateSchema = z.object({
  id: z.string().optional(),
  key: z.string().optional(),
  name: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().optional(),
  isActive: z.boolean().optional(),
});

const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  isActive: z.boolean().optional(),
});

/* =========================================================
 * GET /admin/email/settings
 * ======================================================= */
router.get(
  "/settings",
  wrap(async (req, res) => {
    const academyId = getScopeAcademyId(req);
    const settings = getEmailSettingsForAcademy(academyId);

    return res.json({
      ok: true,
      settings,
    });
  }),
);

/* =========================================================
 * PUT /admin/email/settings
 * ======================================================= */
router.put(
  "/settings",
  wrap(async (req, res) => {
    const academyId = getScopeAcademyId(req);

    if (
      !academyId &&
      String(req.user?.role || "").toUpperCase() !== "SUPER_ADMIN"
    ) {
      return res.status(400).json({ message: "academyId is required" });
    }

    const parsed = emailSettingsSchema.parse(req.body || {});
    const next = saveEmailSettingsForAcademy(
      academyId,
      {
        ...(parsed.enabled !== undefined ? { enabled: parsed.enabled } : {}),
        ...(parsed.fromEmail !== undefined
          ? { fromEmail: normalizeEmail(parsed.fromEmail) }
          : {}),
        ...(parsed.fromName !== undefined
          ? { fromName: String(parsed.fromName || "").trim() }
          : {}),
        ...(parsed.replyTo !== undefined
          ? { replyTo: normalizeEmail(parsed.replyTo) }
          : {}),
        ...(parsed.provider !== undefined
          ? {
              provider: String(parsed.provider || "")
                .trim()
                .toLowerCase(),
            }
          : {}),
        ...(parsed.appUrl !== undefined
          ? { appUrl: String(parsed.appUrl || "").trim() }
          : {}),
      },
      req.user?._id || req.user?.id || "",
    );

    return res.json({
      ok: true,
      message: "Email settings saved successfully",
      settings: next,
    });
  }),
);

/* =========================================================
 * POST /admin/email/settings/test
 * ======================================================= */
router.post(
  "/settings/test",
  wrap(async (req, res) => {
    const parsed = emailTestSchema.parse(req.body || {});
    const academyId = getScopeAcademyId(req);

    const template = String(parsed.template || "WELCOME")
      .trim()
      .toUpperCase();

    const result = await sendTransactionalEmail({
      to: parsed.to,
      template,
      data: buildPreviewPayload(req, {
        name: parsed.name,
        subject: parsed.subject,
        message: parsed.message,
      }),
      meta: {
        type: "TEST_EMAIL",
        academyId: academyId || null,
        userId: String(req.user?._id || ""),
        requestedBy: req.user?.email || "",
      },
    });

    if (!result?.ok && !result?.skipped) {
      return res.status(500).json({
        ok: false,
        message: result?.error || "Failed to send test email",
        ...result,
      });
    }

    return res.json({
      ok: true,
      message: result?.skipped
        ? "Test email skipped because email sending is disabled"
        : "Test email sent successfully",
      ...result,
    });
  }),
);

/* =========================================================
 * LEGACY: POST /admin/email/test
 * ======================================================= */
router.post(
  "/test",
  wrap(async (req, res) => {
    const parsed = emailTestSchema.parse(req.body || {});
    const academyId = getScopeAcademyId(req);

    const template = String(parsed.template || "WELCOME")
      .trim()
      .toUpperCase();

    const result = await sendTransactionalEmail({
      to: parsed.to,
      template,
      data: buildPreviewPayload(req, {
        name: parsed.name,
        subject: parsed.subject,
        message: parsed.message,
      }),
      meta: {
        type: "TEST_EMAIL",
        academyId: academyId || null,
        userId: String(req.user?._id || ""),
        requestedBy: req.user?.email || "",
      },
    });

    if (!result?.ok && !result?.skipped) {
      return res.status(500).json({
        ok: false,
        message: result?.error || "Failed to send test email",
        ...result,
      });
    }

    return res.json({
      ok: true,
      message: result?.skipped
        ? "Test email skipped because email sending is disabled"
        : "Test email sent successfully",
      ...result,
    });
  }),
);

/* =========================================================
 * POST /admin/email/verify
 * ======================================================= */
router.post(
  "/verify",
  wrap(async (_req, res) => {
    const startedAt = Date.now();
    await verifyEmailTransport();

    return res.json({
      ok: true,
      message: "SMTP verified successfully",
      tookMs: Date.now() - startedAt,
    });
  }),
);

/* =========================================================
 * POST /admin/email/send
 * ======================================================= */
router.post(
  "/send",
  wrap(async (req, res) => {
    const parsed = sendEmailSchema.parse(req.body || {});
    const academyId = getScopeAcademyId(req);

    const recipients = normalizeStringArray(parsed.to);
    if (!recipients.length) {
      return res.status(400).json({ message: "Recipient email is required" });
    }

    const template = String(parsed.template || "WELCOME")
      .trim()
      .toUpperCase();

    const data = {
      ...buildPreviewPayload(req, {
        name: parsed.name,
        subject: parsed.subject,
        message: parsed.message,
      }),
      ...(parsed.data || {}),
    };

    const result = await sendTransactionalEmail({
      to: recipients.length === 1 ? recipients[0] : recipients,
      template,
      data,
      meta: {
        type: "MANUAL_EMAIL",
        academyId: academyId || null,
        userId: String(req.user?._id || ""),
        requestedBy: req.user?.email || "",
        ...(parsed.meta || {}),
      },
    });

    if (!result?.ok && !result?.skipped) {
      return res.status(500).json({
        ok: false,
        message: result?.error || "Failed to send email",
        ...result,
      });
    }

    return res.json({
      ok: true,
      message: result?.skipped
        ? "Email skipped because email sending is disabled"
        : "Email sent successfully",
      ...result,
    });
  }),
);

/* =========================================================
 * POST /admin/email/send-bulk
 * ======================================================= */
router.post(
  "/send-bulk",
  wrap(async (req, res) => {
    const parsed = sendBulkEmailSchema.parse(req.body || {});
    const academyId = getScopeAcademyId(req);

    const recipients = normalizeStringArray(parsed.to);
    if (!recipients.length) {
      return res
        .status(400)
        .json({ message: "At least one recipient is required" });
    }

    const template = String(parsed.template || "WELCOME")
      .trim()
      .toUpperCase();

    let sent = 0;
    const errors = [];

    for (const to of recipients) {
      const result = await sendTransactionalEmail({
        to,
        template,
        data: {
          ...buildPreviewPayload(req, {
            name: parsed.name,
            subject: parsed.subject,
            message: parsed.message,
          }),
          ...(parsed.data || {}),
        },
        meta: {
          type: "BULK_EMAIL",
          academyId: academyId || null,
          userId: String(req.user?._id || ""),
          requestedBy: req.user?.email || "",
          ...(parsed.meta || {}),
        },
      });

      if (result?.ok || result?.skipped) {
        sent += 1;
      } else if (result?.error) {
        errors.push({ to, error: result.error });
      }
    }

    return res.json({
      ok: errors.length === 0,
      requested: recipients.length,
      sent,
      failed: errors.length,
      errors,
    });
  }),
);

/* =========================================================
 * POST /admin/email/preview
 * ======================================================= */
router.post(
  "/preview",
  wrap(async (req, res) => {
    const parsed = previewSchema.parse(req.body || {});
    const templateKey = String(parsed.template || "WELCOME")
      .trim()
      .toUpperCase();

    const templates = readTemplateStore();
    const tpl =
      templates.find(
        (x) =>
          String(x.id || "").toUpperCase() === templateKey ||
          String(x.key || "").toUpperCase() === templateKey ||
          String(x.name || "").toUpperCase() === templateKey,
      ) || null;

    const data = {
      ...buildPreviewPayload(req, {
        name: parsed.name,
        subject: parsed.subject,
        message: parsed.message,
      }),
      ...(parsed.data || {}),
    };

    const subject = renderTemplateText(
      tpl?.subject || parsed.subject || "Email Preview",
      data,
    );

    const body = renderTemplateText(
      tpl?.body || parsed.message || "Preview content",
      data,
    );

    return res.json({
      ok: true,
      preview: {
        template: templateKey,
        subject,
        body,
        html: body.replace(/\n/g, "<br/>"),
        data,
      },
    });
  }),
);

/* =========================================================
 * GET /admin/email/history-summary
 * ======================================================= */
router.get(
  "/history-summary",
  wrap(async (req, res) => {
    const academyId = getScopeAcademyId(req);
    const query = {};

    if (academyId && isValidObjectIdLike(academyId)) {
      query.academyId = academyId;
    }

    const [stats, latest] = await Promise.all([
      EmailLog.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      EmailLog.find(query).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const out = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
      latest,
    };

    for (const row of stats || []) {
      const key = String(row?._id || "").toLowerCase();
      const count = Number(row?.count || 0);
      out.total += count;
      if (key === "sent") out.sent = count;
      if (key === "failed") out.failed = count;
      if (key === "pending") out.pending = count;
      if (key === "skipped") out.skipped = count;
    }

    return res.json({
      ok: true,
      ...out,
    });
  }),
);

/* =========================================================
 * GET /admin/email/logs
 * ======================================================= */
router.get(
  "/logs",
  wrap(async (req, res) => {
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
      total: 0,
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

    summary.total = total;

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
 * GET /admin/email/logs/:id
 * ======================================================= */
router.get(
  "/logs/:id",
  wrap(async (req, res) => {
    const row = await EmailLog.findById(req.params.id).lean();
    if (!row) {
      return res.status(404).json({ message: "Email log not found" });
    }

    const academyId = getScopeAcademyId(req);
    if (
      academyId &&
      row.academyId &&
      String(req.user?.role || "").toUpperCase() !== "SUPER_ADMIN" &&
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
 * GET /admin/email/templates
 * ======================================================= */
router.get(
  "/templates",
  wrap(async (_req, res) => {
    const items = readTemplateStore();

    return res.json({
      ok: true,
      items: buildTemplateCatalogResponse(items),
    });
  }),
);

/* =========================================================
 * GET /admin/email/templates/:id
 * ======================================================= */
router.get(
  "/templates/:id",
  wrap(async (req, res) => {
    const id = String(req.params.id || "")
      .trim()
      .toUpperCase();
    const items = readTemplateStore();

    const item =
      items.find(
        (x) =>
          String(x.id || "").toUpperCase() === id ||
          String(x.key || "").toUpperCase() === id,
      ) || null;

    if (!item) {
      return res.status(404).json({ message: "Email template not found" });
    }

    return res.json({
      ok: true,
      item: {
        id: item.id,
        key: item.key,
        name: item.name,
        subject: item.subject || "",
        body: item.body || "",
        isActive: item.isActive !== false,
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
      },
    });
  }),
);

/* =========================================================
 * POST /admin/email/templates
 * ======================================================= */
router.post(
  "/templates",
  wrap(async (req, res) => {
    const parsed = templateCreateSchema.parse(req.body || {});
    const items = readTemplateStore();

    const id = makeTemplateId(parsed.id || parsed.key || parsed.name);

    if (
      items.some(
        (x) =>
          String(x.id || "").toUpperCase() === id ||
          String(x.key || "").toUpperCase() === id,
      )
    ) {
      return res.status(400).json({ message: "Template already exists" });
    }

    const now = new Date().toISOString();
    const next = {
      id,
      key: id,
      name: String(parsed.name || "").trim(),
      subject: String(parsed.subject || "").trim(),
      body: String(parsed.body || "").trim(),
      isActive: parsed.isActive !== false,
      createdAt: now,
      updatedAt: now,
      createdBy: String(req.user?._id || ""),
      updatedBy: String(req.user?._id || ""),
    };

    items.push(next);
    writeTemplateStore(items);

    return res.json({
      ok: true,
      item: next,
    });
  }),
);

/* =========================================================
 * PUT /admin/email/templates/:id
 * ======================================================= */
router.put(
  "/templates/:id",
  wrap(async (req, res) => {
    const parsed = templateUpdateSchema.parse(req.body || {});
    const id = String(req.params.id || "")
      .trim()
      .toUpperCase();
    const items = readTemplateStore();

    const idx = items.findIndex(
      (x) =>
        String(x.id || "").toUpperCase() === id ||
        String(x.key || "").toUpperCase() === id,
    );

    if (idx === -1) {
      return res.status(404).json({ message: "Email template not found" });
    }

    items[idx] = {
      ...items[idx],
      ...(parsed.name !== undefined
        ? { name: String(parsed.name || "").trim() }
        : {}),
      ...(parsed.subject !== undefined
        ? { subject: String(parsed.subject || "").trim() }
        : {}),
      ...(parsed.body !== undefined ? { body: String(parsed.body || "") } : {}),
      ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: String(req.user?._id || ""),
    };

    writeTemplateStore(items);

    return res.json({
      ok: true,
      item: items[idx],
    });
  }),
);

/* =========================================================
 * DELETE /admin/email/templates/:id
 * ======================================================= */
router.delete(
  "/templates/:id",
  wrap(async (req, res) => {
    const id = String(req.params.id || "")
      .trim()
      .toUpperCase();
    const items = readTemplateStore();

    const next = items.filter(
      (x) =>
        String(x.id || "").toUpperCase() !== id &&
        String(x.key || "").toUpperCase() !== id,
    );

    if (next.length === items.length) {
      return res.status(404).json({ message: "Email template not found" });
    }

    writeTemplateStore(next);

    return res.json({
      ok: true,
      deleted: id,
    });
  }),
);

/* =========================================================
 * PATCH /admin/email/templates/:id/toggle
 * ======================================================= */
router.patch(
  "/templates/:id/toggle",
  wrap(async (req, res) => {
    const id = String(req.params.id || "")
      .trim()
      .toUpperCase();
    const items = readTemplateStore();

    const idx = items.findIndex(
      (x) =>
        String(x.id || "").toUpperCase() === id ||
        String(x.key || "").toUpperCase() === id,
    );

    if (idx === -1) {
      return res.status(404).json({ message: "Email template not found" });
    }

    items[idx] = {
      ...items[idx],
      isActive: !(items[idx].isActive !== false),
      updatedAt: new Date().toISOString(),
      updatedBy: String(req.user?._id || ""),
    };

    writeTemplateStore(items);

    return res.json({
      ok: true,
      item: items[idx],
    });
  }),
);

/* =========================================================
 * ERROR HANDLER
 * ======================================================= */
router.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: "Validation error",
      issues: err.issues,
    });
  }

  return res.status(500).json({
    message: err?.message || "Email route error",
  });
});

export default router;
