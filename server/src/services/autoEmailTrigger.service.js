import EmailTemplate from "../models/EmailTemplate.js";
import { renderTemplate, stripHtml } from "./templateRenderer.service.js";
import { deliverEmail } from "./emailProviderAdapter.service.js";
import { createNotification } from "./notification.service.js";

const EVENT_TEMPLATE_KEY_MAP = {
  PAYMENT_SUCCESS: "payment_success",
  PAYMENT_PENDING: "payment_pending",
  PAYMENT_FAILED: "payment_failed",
  RESULT_PUBLISHED: "result_published",
  CERTIFICATE_READY: "certificate_ready",
  REGISTRATION_APPROVED: "registration_approved",
  REGISTRATION_REJECTED: "registration_rejected",
  WELCOME_PARENT: "welcome_parent",
  WELCOME_JUDGE: "welcome_judge",
  WELCOME_PARTICIPANT: "welcome_participant",
  ACCOUNT_INVITE: "account_invite",
  EVENT_REMINDER: "event_reminder",
};

function normalizeEvent(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function normalizeKey(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function isValidObjectIdLike(value) {
  return /^[a-f\d]{24}$/i.test(String(value || "").trim());
}

function shortMessageFromText(text = "", max = 180) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
}

async function findTemplate({ academyId = null, templateKey = "" }) {
  const key = normalizeKey(templateKey);
  if (!key) return null;

  if (academyId && isValidObjectIdLike(academyId)) {
    const academyTemplate = await EmailTemplate.findOne({
      academyId,
      key,
      isActive: true,
    }).lean();

    if (academyTemplate) return academyTemplate;
  }

  const globalTemplate = await EmailTemplate.findOne({
    academyId: null,
    key,
    isActive: true,
  }).lean();

  return globalTemplate || null;
}

export async function triggerAutoEmail({
  academyId = null,
  recipientUserId = null,
  recipientRole = "",
  recipientEmail = "",
  templateKey = "",
  triggerEvent = "",
  variables = {},
  meta = {},
  syncNotification = false,
  notification = null,
}) {
  const to = String(recipientEmail || "")
    .trim()
    .toLowerCase();

  const eventKey = normalizeEvent(triggerEvent);
  const mappedTemplateKey = EVENT_TEMPLATE_KEY_MAP[eventKey] || "";
  const finalTemplateKey = normalizeKey(templateKey || mappedTemplateKey || "");

  if (!to) {
    return {
      ok: false,
      skipped: true,
      reason: "Missing recipient email",
      academyId: academyId || null,
      triggerEvent: eventKey,
      templateKey: finalTemplateKey,
    };
  }

  if (!finalTemplateKey) {
    return {
      ok: false,
      skipped: true,
      reason: "Template key not resolved",
      academyId: academyId || null,
      triggerEvent: eventKey,
      templateKey: finalTemplateKey,
    };
  }

  const template = await findTemplate({
    academyId,
    templateKey: finalTemplateKey,
  });

  if (!template) {
    return {
      ok: false,
      skipped: true,
      reason: "No active template found",
      academyId: academyId || null,
      triggerEvent: eventKey,
      templateKey: finalTemplateKey,
    };
  }

  const rendered = renderTemplate({
    subject: template.subject || "",
    html: template.html || "",
    text: template.text || "",
    variables,
  });

  const deliveryMeta = {
    ...meta,
    academyId: academyId || null,
    userId: recipientUserId || null,
    recipientRole: String(recipientRole || "")
      .trim()
      .toUpperCase(),
    template: template.key,
    templateKey: template.key,
    templateKeyResolved: template.key,
    triggerEvent: eventKey,
    templateId: String(template._id || ""),
    templateName: template.name || "",
    isSystemTemplate: !!template.isSystem,
    source: "AUTO_EMAIL_TRIGGER",
    templateData: variables || {},
  };

  const result = await deliverEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text || stripHtml(rendered.html),
    meta: deliveryMeta,
  });

  const emailOk = !!(result?.success || result?.ok);

  if (emailOk && syncNotification && recipientUserId && recipientRole) {
    const title = notification?.title || rendered.subject || "Email sent";
    const message =
      notification?.message ||
      shortMessageFromText(rendered.text || stripHtml(rendered.html));

    await createNotification({
      academyId,
      recipientUserId,
      recipientRole,
      type: notification?.type || "AUTO_EMAIL",
      category: notification?.category || "SYSTEM",
      priority: notification?.priority || "NORMAL",
      title,
      message,
      actionUrl: notification?.actionUrl || "",
      meta: {
        ...meta,
        emailTemplateKey: template.key,
        emailLogId: result?.logId ? String(result.logId) : "",
        triggerEvent: eventKey,
      },
      createdByUserId: notification?.createdByUserId || null,
    });
  }

  return {
    ok: emailOk,
    success: emailOk,
    skipped: !!result?.skipped,
    reason: result?.reason || "",
    error: result?.error || "",
    academyId: academyId || null,
    triggerEvent: eventKey,
    templateKey: finalTemplateKey,
    templateId: String(template._id || ""),
    templateName: template.name || "",
    template,
    rendered,
    logId: result?.logId || null,
    providerMessageId: result?.messageId || "",
    messageId: result?.messageId || "",
  };
}
