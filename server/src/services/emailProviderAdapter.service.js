import { sendTransactionalEmail } from "./email/emailService.js";

export async function deliverEmail({
  to,
  cc,
  bcc,
  subject,
  html = "",
  text = "",
  meta = {},
}) {
  const safeSubject =
    String(subject || "").trim() || "Rebel Angels Notification";
  const safeHtml = String(html || "");
  const safeText = String(text || "");
  const safeMeta = {
    ...(meta || {}),
    source: meta?.source || "DB_TEMPLATE_RENDER",
  };

  const result = await sendTransactionalEmail({
    to,
    cc,
    bcc,
    subject: safeSubject,
    html: safeHtml,
    text: safeText,
    meta: safeMeta,
  });

  return {
    ok: !!(result?.ok || result?.success),
    success: !!(result?.ok || result?.success),
    skipped: !!result?.skipped,
    reason: result?.reason || "",
    messageId: result?.messageId || "",
    logId: result?.logId || null,
    error: result?.error || "",
    raw: result,
  };
}
