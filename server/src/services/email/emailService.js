import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import EmailLog from "../../models/EmailLog.js";
import EmailTemplate from "../../models/EmailTemplate.js";
import {
  getEmailTransporter,
  getEmailSettingsForAcademy,
} from "./emailClient.js";
import { renderEmailTemplate } from "./emailTemplates.js";
import { stripHtml } from "../templateRenderer.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, "../../../uploads");
const EMAIL_SETTINGS_FILE = path.join(UPLOAD_DIR, "email-settings.json");

function normalizeList(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeSingleEmail(value) {
  const list = normalizeList(value).map(normalizeEmail).filter(Boolean);
  return list[0] || "";
}

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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceTemplateVars(input, data = {}) {
  const src = String(input || "");
  return src.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key) => {
    const raw = data?.[key];
    return raw === undefined || raw === null ? "" : String(raw);
  });
}

async function findDbTemplate(templateKey, academyId = null) {
  const key = String(templateKey || "")
    .trim()
    .toLowerCase();
  if (!key) return null;

  const or = [{ key }];
  const rx = new RegExp(`^${escapeRegExp(key)}$`, "i");
  or.push({ name: rx });

  if (academyId) {
    const scoped = await EmailTemplate.findOne({
      academyId,
      isActive: true,
      $or: or,
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    if (scoped) return scoped;
  }

  const system = await EmailTemplate.findOne({
    academyId: null,
    isSystem: true,
    isActive: true,
    $or: or,
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  return system || null;
}

async function buildRenderedTemplate({
  template,
  data = {},
  subject,
  html,
  text,
  academyId = null,
}) {
  const templateKey = String(template || "").trim();

  if (templateKey) {
    const dbTemplate = await findDbTemplate(templateKey, academyId);

    if (dbTemplate) {
      const subjectOut = replaceTemplateVars(
        dbTemplate.subject || subject || "Rebel Angels Notification",
        data || {},
      );

      const htmlOut = replaceTemplateVars(
        dbTemplate.html || html || "",
        data || {},
      );

      const textOut = replaceTemplateVars(
        dbTemplate.text || text || stripHtml(htmlOut),
        data || {},
      );

      return {
        source: "database",
        templateDoc: dbTemplate,
        subject: String(subjectOut || "Rebel Angels Notification"),
        html: String(htmlOut || ""),
        text: String(textOut || stripHtml(htmlOut)),
      };
    }

    const rendered = renderEmailTemplate(templateKey, data || {});
    const builtinHtml = String(rendered?.html || html || "");
    const builtinText = String(
      rendered?.text || text || stripHtml(builtinHtml),
    );

    return {
      source: "builtin",
      templateDoc: null,
      subject: String(
        rendered?.subject || subject || "Rebel Angels Notification",
      ),
      html: builtinHtml,
      text: builtinText,
    };
  }

  const inlineHtml = String(html || "");
  const inlineText = String(text || stripHtml(inlineHtml));

  return {
    source: "inline",
    templateDoc: null,
    subject: String(subject || "Rebel Angels Notification"),
    html: inlineHtml,
    text: inlineText,
  };
}

function getScopedEmailSettings(academyId = null) {
  try {
    return getEmailSettingsForAcademy(academyId || "");
  } catch {
    const enabled = ["true", "1", "yes", "on"].includes(
      String(process.env.EMAIL_ENABLED || "false")
        .trim()
        .toLowerCase(),
    );

    const defaults = {
      enabled,
      isEnabled: enabled,
      fromEmail: String(
        process.env.EMAIL_FROM_ADDRESS ||
          process.env.SMTP_FROM_EMAIL ||
          process.env.SMTP_USER ||
          "",
      ).trim(),
      fromName: String(
        process.env.EMAIL_FROM_NAME ||
          process.env.SMTP_FROM_NAME ||
          "Rebel Angels",
      ).trim(),
      replyTo: String(process.env.EMAIL_REPLY_TO || "").trim(),
      provider: String(process.env.EMAIL_PROVIDER || "smtp")
        .trim()
        .toLowerCase(),
      appUrl: String(process.env.APP_URL || "http://localhost:5173").trim(),
    };

    if (!academyId) return defaults;

    const all = safeJsonRead(EMAIL_SETTINGS_FILE, {});
    const scoped = all[String(academyId)] || {};

    return {
      ...defaults,
      ...scoped,
    };
  }
}

function fromAddress(settings = null) {
  const scoped = settings || getScopedEmailSettings();

  const name = String(scoped.fromName || "Rebel Angels").trim();
  const email = String(scoped.fromEmail || "").trim();

  if (!email) {
    throw new Error(
      "EMAIL_FROM_ADDRESS or SMTP_FROM_EMAIL or SMTP_USER is required",
    );
  }

  return `"${name}" <${email}>`;
}

function isEmailEnabled(academyId = null) {
  const scoped = getScopedEmailSettings(academyId);
  return scoped.enabled === true || scoped.isEnabled === true;
}

function shouldSkipRealSend(email) {
  const v = normalizeEmail(email);
  if (!v) return true;
  if (v.endsWith("@noemail.local")) return true;
  return false;
}

function buildMeta(meta = {}, data = {}) {
  const safeMeta = meta && typeof meta === "object" ? { ...meta } : {};
  if (!safeMeta.templateData) safeMeta.templateData = data || {};
  return safeMeta;
}

async function createEmailLogEntry({
  academyId = null,
  userId = null,
  participantId = null,
  to = [],
  cc = [],
  bcc = [],
  subject = "",
  template = "",
  html = "",
  text = "",
  status = "PENDING",
  provider = "smtp",
  providerMessageId = "",
  errorMessage = "",
  meta = {},
  sentAt = null,
}) {
  const toValue = Array.isArray(to) ? to.join(", ") : String(to || "").trim();
  const ccValue = Array.isArray(cc) ? cc.join(", ") : String(cc || "").trim();
  const bccValue = Array.isArray(bcc)
    ? bcc.join(", ")
    : String(bcc || "").trim();

  return await EmailLog.create({
    academyId: meta.academyId || academyId || null,
    recipientUserId: meta.userId || userId || null,
    recipientRole: String(meta.recipientRole || "")
      .trim()
      .toUpperCase(),
    to: toValue,
    cc: ccValue,
    bcc: bccValue,
    subject,
    html,
    text,
    template: String(template || "")
      .trim()
      .toUpperCase(),
    templateKey: String(
      meta.templateKeyResolved || meta.templateKey || meta.template || "",
    )
      .trim()
      .toLowerCase(),
    triggerEvent: String(meta.triggerEvent || "")
      .trim()
      .toUpperCase(),
    status,
    provider,
    providerMessageId,
    errorMessage,
    variables: meta.templateData || {},
    meta,
    sentAt,
  });
}

export async function verifyEmailTransport({ academyId = null } = {}) {
  const settings = getScopedEmailSettings(academyId);

  if (!isEmailEnabled(academyId)) {
    return {
      ok: false,
      skipped: true,
      provider: String(
        settings.provider || process.env.EMAIL_PROVIDER || "smtp",
      ),
      message: "Email is disabled",
    };
  }

  try {
    const transporter = getEmailTransporter({ academyId });
    await transporter.verify();

    return {
      ok: true,
      provider: String(
        settings.provider || process.env.EMAIL_PROVIDER || "smtp",
      ),
      message: "SMTP connection verified successfully",
    };
  } catch (err) {
    return {
      ok: false,
      provider: String(
        settings.provider || process.env.EMAIL_PROVIDER || "smtp",
      ),
      message: err?.message || "SMTP verification failed",
      error: err?.message || "SMTP verification failed",
    };
  }
}

export async function renderResolvedEmail({
  template,
  data = {},
  subject,
  html,
  text,
  academyId = null,
}) {
  const rendered = await buildRenderedTemplate({
    template,
    data,
    subject,
    html,
    text,
    academyId,
  });

  return {
    ok: true,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    source: rendered.source,
    templateKey: String(template || "").trim(),
    templateId: rendered.templateDoc?._id || null,
    templateName: rendered.templateDoc?.name || "",
    variables: Array.isArray(rendered.templateDoc?.variables)
      ? rendered.templateDoc.variables
      : [],
  };
}

export async function sendTransactionalEmail({
  to,
  cc,
  bcc,
  template,
  data = {},
  subject,
  html,
  text,
  meta = {},
}) {
  const toList = normalizeList(to).map(normalizeEmail).filter(Boolean);
  const ccList = normalizeList(cc).map(normalizeEmail).filter(Boolean);
  const bccList = normalizeList(bcc).map(normalizeEmail).filter(Boolean);

  if (!toList.length) {
    throw new Error("Email recipient is required");
  }

  const safeMeta = buildMeta(meta, data);
  const academyId = safeMeta.academyId || null;
  const settings = getScopedEmailSettings(academyId);

  const rendered = await buildRenderedTemplate({
    template,
    data,
    subject,
    html,
    text,
    academyId,
  });

  const primaryRecipient = normalizeSingleEmail(toList[0]);
  const nonRealRecipient = toList.every((email) => shouldSkipRealSend(email));

  let initialStatus = "PENDING";
  let skipReason = "";

  if (!isEmailEnabled(academyId)) {
    initialStatus = "SKIPPED";
    skipReason = "EMAIL_ENABLED is false";
  } else if (nonRealRecipient) {
    initialStatus = "SKIPPED";
    skipReason = "Non-real email address";
  }

  const log = await createEmailLogEntry({
    academyId: academyId || null,
    userId: safeMeta.userId || null,
    participantId: safeMeta.participantId || null,
    to: toList,
    cc: ccList,
    bcc: bccList,
    subject: rendered.subject,
    template: String(template || "").trim(),
    html: rendered.html,
    text: rendered.text || stripHtml(rendered.html),
    status: initialStatus,
    provider: String(settings.provider || process.env.EMAIL_PROVIDER || "smtp"),
    errorMessage: skipReason,
    meta: {
      ...safeMeta,
      templateRenderSource: rendered.source,
      templateId: rendered.templateDoc?._id || null,
      templateName: rendered.templateDoc?.name || "",
      templateKeyResolved:
        rendered.templateDoc?.key || String(template || "").trim() || "",
      templateVariables: Array.isArray(rendered.templateDoc?.variables)
        ? rendered.templateDoc.variables
        : [],
    },
  });

  if (!isEmailEnabled(academyId)) {
    return {
      ok: false,
      skipped: true,
      provider: String(
        settings.provider || process.env.EMAIL_PROVIDER || "smtp",
      ),
      logId: log._id,
      error: "EMAIL_ENABLED is false",
    };
  }

  if (nonRealRecipient) {
    return {
      ok: false,
      skipped: true,
      provider: String(
        settings.provider || process.env.EMAIL_PROVIDER || "smtp",
      ),
      logId: log._id,
      error: "Non-real email address",
    };
  }

  try {
    const transporter = getEmailTransporter({ academyId });

    const info = await transporter.sendMail({
      from: fromAddress(settings),
      replyTo: settings.replyTo || undefined,
      to: toList.join(", "),
      cc: ccList.length ? ccList.join(", ") : undefined,
      bcc: bccList.length ? bccList.join(", ") : undefined,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text || stripHtml(rendered.html),
    });

    log.status = "SENT";
    log.sentAt = new Date();
    log.providerMessageId = String(info?.messageId || "");
    log.errorMessage = "";
    await log.save();

    return {
      ok: true,
      provider: String(
        settings.provider || process.env.EMAIL_PROVIDER || "smtp",
      ),
      logId: log._id,
      messageId: info?.messageId || "",
      accepted: info?.accepted || [],
      rejected: info?.rejected || [],
      to: primaryRecipient,
      templateSource: rendered.source,
      templateId: rendered.templateDoc?._id || null,
      templateName: rendered.templateDoc?.name || "",
    };
  } catch (err) {
    log.status = "FAILED";
    log.errorMessage = err?.message || "Unknown email send error";
    await log.save();

    return {
      ok: false,
      provider: String(
        settings.provider || process.env.EMAIL_PROVIDER || "smtp",
      ),
      logId: log._id,
      error: err?.message || "Unknown email send error",
      to: primaryRecipient,
      templateSource: rendered.source,
      templateId: rendered.templateDoc?._id || null,
      templateName: rendered.templateDoc?.name || "",
    };
  }
}

export async function sendTestEmail({ to, academyId = null }) {
  const toList = normalizeList(to).map(normalizeEmail).filter(Boolean);
  const settings = getScopedEmailSettings(academyId);

  if (!toList.length) {
    throw new Error("Recipient email is required");
  }

  if (toList.every((email) => shouldSkipRealSend(email))) {
    throw new Error("Recipient email must be a real email address");
  }

  if (!isEmailEnabled(academyId)) {
    throw new Error("EMAIL_ENABLED is false");
  }

  const transporter = getEmailTransporter({ academyId });

  const testHtml = `
    <div style="font-family:Arial,sans-serif;padding:24px;">
      <h2 style="margin:0 0 12px;">Email Test Successful</h2>
      <p style="margin:0 0 10px;">
        Your email configuration is working correctly.
      </p>
      <p style="margin:0;color:#475569;">
        This message was sent from the Rebel Angels Gymnastics app.
      </p>
    </div>
  `;

  const testText =
    "Email Test Successful. Your email configuration is working correctly.";

  const info = await transporter.sendMail({
    from: fromAddress(settings),
    replyTo: settings.replyTo || undefined,
    to: toList.join(", "),
    subject: "Test Email - Rebel Angels",
    html: testHtml,
    text: testText,
  });

  await createEmailLogEntry({
    academyId: academyId || null,
    userId: null,
    participantId: null,
    to: toList,
    cc: [],
    bcc: [],
    subject: "Test Email - Rebel Angels",
    template: "TEST_EMAIL",
    html: testHtml,
    text: testText,
    status: "SENT",
    provider: String(settings.provider || process.env.EMAIL_PROVIDER || "smtp"),
    providerMessageId: String(info?.messageId || ""),
    meta: {
      type: "TEST_EMAIL",
      templateData: {},
      academyId: academyId || null,
      templateRenderSource: "inline",
    },
    sentAt: new Date(),
  });

  return {
    ok: true,
    provider: String(settings.provider || process.env.EMAIL_PROVIDER || "smtp"),
    messageId: info?.messageId || "",
  };
}

export async function listEmailLogs({
  academyId = null,
  status = "",
  template = "",
  limit = 100,
} = {}) {
  const query = {};

  if (academyId) query.academyId = academyId;
  if (status) query.status = String(status).trim().toUpperCase();
  if (template) query.template = String(template).trim();

  return await EmailLog.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit || 100), 500))
    .lean();
}

export async function resendEmailLog(logId) {
  const log = await EmailLog.findById(logId).lean();

  if (!log) {
    return { ok: false, error: "Email log not found" };
  }

  return await sendTransactionalEmail({
    to: log.to || [],
    cc: log.cc || [],
    bcc: log.bcc || [],
    template: log.template || "",
    subject: log.subject || "",
    html: log.html || "",
    text: log.text || "",
    data: log.meta?.templateData || {},
    meta: {
      ...(log.meta || {}),
      academyId: log.academyId ? String(log.academyId) : null,
      userId: log.userId ? String(log.userId) : null,
      participantId: log.participantId ? String(log.participantId) : null,
      resentFromLogId: String(log._id),
    },
  });
}
