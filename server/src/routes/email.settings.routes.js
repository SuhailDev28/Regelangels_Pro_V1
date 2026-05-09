import express from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import EmailSetting from "../models/EmailSetting.js";
import {
  sendTestEmail,
  verifyEmailTransport,
} from "../services/email/emailService.js";
import { clearEmailTransporterCache } from "../services/email/emailClient.js";

const router = express.Router();

router.use(auth, requireRole("SUPER_ADMIN", "ADMIN"));

const DEFAULT_SETTINGS = {
  provider: "smtp",
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
  fromName: "Rebel Angels Gymnastics Academy",
  fromEmail: "",
  replyTo: "",
  isEnabled: true,
};

const settingsSchema = z.object({
  provider: z.string().trim().default("smtp"),
  host: z.string().trim().default(""),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.coerce.boolean().default(false),
  username: z.string().trim().default(""),
  password: z.string().optional().default(""),
  fromName: z.string().trim().default("Rebel Angels Gymnastics Academy"),
  fromEmail: z.string().trim().default(""),
  replyTo: z.string().trim().default(""),
  isEnabled: z.coerce.boolean().default(true),
});

const testSchema = z.object({
  to: z.string().email("Valid recipient email is required"),
  academyId: z.string().optional(),
});

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getScopedAcademyId(req) {
  if (req.user?.role === "SUPER_ADMIN") {
    const candidate =
      req.get("x-academy-id") ||
      req.query?.academyId ||
      req.body?.academyId ||
      req.academyId ||
      req.user?.academyId ||
      "";

    return String(candidate || "").trim();
  }

  return String(req.academyId || req.user?.academyId || "").trim();
}

function requireScopedAcademyId(req, res) {
  const academyId = getScopedAcademyId(req);

  if (!academyId || !isValidObjectId(academyId)) {
    res.status(400).json({
      ok: false,
      message: "Valid academyId is required",
    });
    return null;
  }

  return academyId;
}

function maskSettings(doc, academyId = null) {
  if (!doc) {
    return {
      academyId: academyId || null,
      ...DEFAULT_SETTINGS,
      hasPassword: false,
      password: "",
      updatedAt: null,
      updatedBy: null,
    };
  }

  return {
    _id: doc._id,
    academyId: doc.academyId ? String(doc.academyId) : academyId || null,
    provider: String(doc.provider || "smtp").trim(),
    host: String(doc.host || "").trim(),
    port: Number(doc.port || 587),
    secure: !!doc.secure,
    username: String(doc.username || "").trim(),
    password: "",
    hasPassword: !!String(doc.password || "").trim(),
    fromName: String(doc.fromName || "Rebel Angels Gymnastics Academy").trim(),
    fromEmail: String(doc.fromEmail || "").trim(),
    replyTo: String(doc.replyTo || "").trim(),
    isEnabled: doc.isEnabled !== false,
    updatedAt: doc.updatedAt || null,
    updatedBy: doc.updatedBy || null,
  };
}

async function getOrCreateSettings(academyId) {
  let settings = await EmailSetting.findOne({ academyId });

  if (!settings) {
    settings = await EmailSetting.create({
      academyId,
      ...DEFAULT_SETTINGS,
    });
  }

  return settings;
}

router.get("/", async (req, res) => {
  try {
    const academyId = requireScopedAcademyId(req, res);
    if (!academyId) return;

    const settings = await EmailSetting.findOne({ academyId }).lean();

    return res.json({
      ok: true,
      academyId,
      settings: maskSettings(settings, academyId),
    });
  } catch (error) {
    console.error("GET email settings error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to load email settings",
    });
  }
});

router.put("/", async (req, res) => {
  try {
    const academyId = requireScopedAcademyId(req, res);
    if (!academyId) return;

    const parsed = settingsSchema.parse(req.body || {});
    const settings = await getOrCreateSettings(academyId);

    settings.academyId = academyId;
    settings.provider = String(parsed.provider || "smtp")
      .trim()
      .toLowerCase();
    settings.host = String(parsed.host || "").trim();
    settings.port = Number(parsed.port || 587);
    settings.secure = !!parsed.secure;
    settings.username = normalizeEmail(parsed.username || "");

    if (String(parsed.password || "").trim()) {
      settings.password = String(parsed.password).trim();
    }

    settings.fromName = String(
      parsed.fromName || "Rebel Angels Gymnastics Academy",
    ).trim();
    settings.fromEmail = normalizeEmail(parsed.fromEmail || "");
    settings.replyTo = normalizeEmail(parsed.replyTo || "");
    settings.isEnabled = !!parsed.isEnabled;
    settings.updatedBy = req.user?._id || null;

    await settings.save();
    clearEmailTransporterCache();

    return res.json({
      ok: true,
      academyId,
      message: "Email settings saved successfully",
      settings: maskSettings(
        settings.toObject ? settings.toObject() : settings,
        academyId,
      ),
    });
  } catch (error) {
    console.error("PUT email settings error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        ok: false,
        message: "Validation failed",
        issues: error.issues,
      });
    }

    return res.status(500).json({
      ok: false,
      message: error?.message || "Failed to save email settings",
    });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const academyId = requireScopedAcademyId(req, res);
    if (!academyId) return;

    const result = await verifyEmailTransport({ academyId });

    return res.json({
      ok: !!result?.ok,
      academyId,
      message: "Email transport verification completed",
      details: result || null,
    });
  } catch (error) {
    console.error("POST email settings verify error:", error);
    return res.status(500).json({
      ok: false,
      message: error?.message || "Failed to verify email transport",
    });
  }
});

router.post("/test", async (req, res) => {
  try {
    const academyId = requireScopedAcademyId(req, res);
    if (!academyId) return;

    const { to } = testSchema.parse(req.body || {});

    const result = await sendTestEmail({
      to: String(to).trim(),
      academyId,
    });

    return res.json({
      ok: result?.ok !== false,
      academyId,
      message: result?.message || "Test email sent successfully",
      result: result || null,
    });
  } catch (error) {
    console.error("POST email settings test error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        ok: false,
        message: "Validation failed",
        issues: error.issues,
      });
    }

    return res.status(500).json({
      ok: false,
      message: error?.message || "Failed to send test email",
    });
  }
});

export default router;
