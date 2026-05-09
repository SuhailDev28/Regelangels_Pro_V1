import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "../../../uploads");
const EMAIL_SETTINGS_FILE = path.join(UPLOAD_DIR, "email-settings.json");

const transporterCache = new Map();

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

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function readAllEmailSettings() {
  return safeJsonRead(EMAIL_SETTINGS_FILE, {});
}

export function getEmailSettingsForAcademy(academyId = "") {
  const all = readAllEmailSettings();

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

  const smtpHost = String(
    scoped.host || scoped.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com",
  ).trim();

  const smtpPort = toInt(
    scoped.port ?? scoped.smtpPort ?? process.env.SMTP_PORT,
    587,
  );

  const smtpSecure =
    scoped.secure !== undefined
      ? toBool(scoped.secure, smtpPort === 465)
      : scoped.smtpSecure !== undefined
        ? toBool(scoped.smtpSecure, smtpPort === 465)
        : process.env.SMTP_SECURE !== undefined
          ? toBool(process.env.SMTP_SECURE, smtpPort === 465)
          : smtpPort === 465;

  const smtpUser = normalizeEmail(
    scoped.username || scoped.smtpUser || process.env.SMTP_USER || "",
  );

  const smtpPass = String(
    scoped.password || scoped.smtpPass || process.env.SMTP_PASS || "",
  ).trim();

  const enabled =
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
      smtpUser ||
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

  const appUrl = String(
    scoped.appUrl || process.env.APP_URL || "http://localhost:5173",
  ).trim();

  return {
    academyId: academyId ? String(academyId) : null,
    enabled,
    isEnabled: enabled,
    provider,

    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    username: smtpUser,
    password: smtpPass,

    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,

    fromEmail,
    fromName,
    replyTo,
    appUrl,
    updatedAt: scoped.updatedAt || null,
    updatedBy: scoped.updatedBy || "",
  };
}

function buildTransportKey(settings) {
  return JSON.stringify({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    user: settings.smtpUser,
    pass: settings.smtpPass,
  });
}

function validateSmtpSettings(settings) {
  if (!settings.smtpHost) {
    throw new Error("Missing SMTP host");
  }

  if (
    !Number.isFinite(Number(settings.smtpPort)) ||
    Number(settings.smtpPort) <= 0
  ) {
    throw new Error("Invalid SMTP port");
  }

  if (!settings.smtpUser || !settings.smtpPass) {
    throw new Error("Missing SMTP username or password");
  }
}

export function clearEmailTransporterCache() {
  transporterCache.clear();
}

export function getEmailTransporter(options = {}) {
  const academyId =
    options && typeof options === "object" ? options.academyId || "" : "";

  const settings = getEmailSettingsForAcademy(academyId);

  if (settings.provider !== "smtp") {
    throw new Error(`Unsupported email provider: ${settings.provider}`);
  }

  validateSmtpSettings(settings);

  const cacheKey = buildTransportKey(settings);

  if (transporterCache.has(cacheKey)) {
    return transporterCache.get(cacheKey);
  }

  const tx = nodemailer.createTransport({
    host: settings.smtpHost,
    port: Number(settings.smtpPort),
    secure: !!settings.smtpSecure,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
  });

  transporterCache.set(cacheKey, tx);
  return tx;
}

export async function verifyEmailTransport(options = {}) {
  const academyId =
    options && typeof options === "object" ? options.academyId || "" : "";

  const settings = getEmailSettingsForAcademy(academyId);

  if (settings.provider !== "smtp") {
    return {
      ok: false,
      error: `Unsupported email provider: ${settings.provider}`,
      provider: settings.provider,
      academyId: settings.academyId,
    };
  }

  if (!settings.enabled) {
    return {
      ok: false,
      skipped: true,
      error: "Email is disabled for this academy",
      provider: settings.provider,
      academyId: settings.academyId,
      enabled: settings.enabled,
    };
  }

  try {
    validateSmtpSettings(settings);

    const tx = getEmailTransporter({ academyId });
    const result = await tx.verify();

    console.log(
      `✅ SMTP verify success${academyId ? ` [academyId=${academyId}]` : ""}`,
    );

    return {
      ok: true,
      academyId: settings.academyId,
      provider: settings.provider,
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      user: settings.smtpUser,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      replyTo: settings.replyTo,
      appUrl: settings.appUrl,
      enabled: settings.enabled,
      result,
    };
  } catch (err) {
    return {
      ok: false,
      academyId: settings.academyId,
      provider: settings.provider,
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      user: settings.smtpUser,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      replyTo: settings.replyTo,
      appUrl: settings.appUrl,
      enabled: settings.enabled,
      error: err?.message || "SMTP verification failed",
    };
  }
}
