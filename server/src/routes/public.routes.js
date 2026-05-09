// server/src/routes/public.routes.js
import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import multer from "multer";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument as PDFLibDocument } from "pdf-lib";

import Group from "../models/Group.js";
import Event from "../models/Event.js";
import EventEnrollment from "../models/EventEnrollment.js";
import Participant from "../models/Participant.js";
import Score from "../models/Score.js";
import Award from "../models/Award.js";
import Certificate from "../models/Certificate.js";
import AcademyRegistration from "../models/AcademyRegistration.js";

import { computeTotalsForGroup } from "../utils/totals.js";
import {
  buildCertificatePdf,
  buildCertificateOverlayPdf,
  pdfkitToBuffer,
} from "../utils/certificatePdf.js";

let AppSetting = null;
try {
  const appSettingModule = await import("../models/AppSetting.js");
  AppSetting = appSettingModule?.default || null;
} catch {
  AppSetting = null;
}

const router = express.Router();

const CERT_VERIFY_SECRET =
  process.env.CERT_VERIFY_SECRET || "change-this-in-env";

/* =========================
 * Upload/template paths
 * ========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const TEMPLATE_PATH = path.join(UPLOAD_DIR, "certificate-template.pdf");
const ACADEMY_LOGO_DIR = path.join(UPLOAD_DIR, "academy-logos");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(ACADEMY_LOGO_DIR, { recursive: true });

/* =========================
 * Multer: academy logo upload
 * ========================= */
const academyLogoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ACADEMY_LOGO_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext)
      ? ext
      : ".png";

    const baseName = path
      .basename(
        file.originalname || "logo",
        path.extname(file.originalname || ""),
      )
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    cb(
      null,
      `${Date.now()}-${baseName || "academy-logo"}-${Math.round(
        Math.random() * 1e9,
      )}${safeExt}`,
    );
  },
});

const academyLogoUpload = multer({
  storage: academyLogoStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/svg+xml",
    ];

    if (!allowed.includes(String(file.mimetype || "").toLowerCase())) {
      return cb(
        new Error("Only PNG, JPG, JPEG, WEBP, and SVG logo files are allowed"),
      );
    }

    cb(null, true);
  },
});

/* =========================
 * Helpers
 * ========================= */
function M(name) {
  return mongoose.models?.[name] || null;
}

function verifyToken(token) {
  try {
    const [base, sig] = String(token || "").split(".");
    if (!base || !sig) return null;

    const expectedSig = crypto
      .createHmac("sha256", CERT_VERIFY_SECRET)
      .update(base)
      .digest("base64url");

    if (sig !== expectedSig) return null;

    const json = Buffer.from(base, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function normalizeBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

function cleanStr(v) {
  return String(v || "").trim();
}

function normalizeEmail(v) {
  return cleanStr(v).toLowerCase();
}

function normalizePhone(v) {
  return cleanStr(v).replace(/\s+/g, "");
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));
}

function isValidQatarPhone(v) {
  const phone = normalizePhone(v);
  return /^(\+974)?[3567]\d{7}$/.test(phone);
}

function academyLogoPublicUrl(req, filename) {
  return `${req.protocol}://${req.get("host")}/uploads/academy-logos/${filename}`;
}

function removeUploadedFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function generateAcademyCode(name = "") {
  const clean = String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .trim();

  const parts = clean.split(/\s+/).filter(Boolean);
  let code = "";

  if (parts.length >= 2) {
    code = (parts[0].slice(0, 2) + parts[1].slice(0, 2)).toUpperCase();
  } else if (parts.length === 1) {
    code = parts[0].slice(0, 4).toUpperCase();
  }

  code = code.replace(/[^A-Z0-9]/g, "");
  if (code.length < 4) {
    code = (code + "ACDM").slice(0, 4);
  }

  return code;
}

async function ensureUniqueAcademyCode(baseCode) {
  const Academy = M("Academy");
  let code = String(baseCode || "ACDM")
    .toUpperCase()
    .slice(0, 8);

  if (!Academy) return code;

  let suffix = 0;
  while (true) {
    const trial = suffix === 0 ? code : `${code}${suffix}`.slice(0, 10);
    const exists = await Academy.findOne({
      $or: [{ code: trial }, { academyCode: trial }],
    })
      .select("_id")
      .lean()
      .catch(() => null);

    if (!exists) return trial;
    suffix += 1;
  }
}

function generateActivationToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function findAcademyByCode(Academy, code) {
  const c = cleanStr(code).toUpperCase();
  if (!Academy || !c) return null;

  return Academy.findOne({
    $or: [{ code: c }, { academyCode: c }],
  })
    .lean()
    .catch(() => null);
}

async function buildParticipantRankMap(participantIds, academyId, eventId) {
  if (!participantIds.length) return new Map();

  const match = {
    participantId: {
      $in: participantIds.map((id) => new mongoose.Types.ObjectId(String(id))),
    },
    status: "SCORED",
    value: { $ne: null },
  };

  if (academyId && isValidObjectId(academyId)) {
    match.academyId = new mongoose.Types.ObjectId(String(academyId));
  }

  if (eventId && isValidObjectId(eventId)) {
    match.eventId = new mongoose.Types.ObjectId(String(eventId));
  }

  const totals = await Score.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$participantId",
        total: { $sum: { $toDouble: "$value" } },
      },
    },
    { $sort: { total: -1, _id: 1 } },
  ]);

  const rankMap = new Map();
  totals.forEach((row, index) => {
    rankMap.set(String(row._id), index + 1);
  });

  return rankMap;
}

async function resolveEventForParticipant(participant) {
  if (!participant) return null;

  if (participant.eventId && isValidObjectId(participant.eventId)) {
    const found = await Event.findById(participant.eventId)
      .select("name code status startDate endDate venue academyId")
      .lean()
      .catch(() => null);
    if (found) return found;
  }

  const enrollment = await EventEnrollment.findOne({
    participantId: participant._id,
  })
    .sort({ createdAt: -1 })
    .lean()
    .catch(() => null);

  if (!enrollment?.eventId || !isValidObjectId(enrollment.eventId)) return null;

  return Event.findById(enrollment.eventId)
    .select("name code status startDate endDate venue academyId")
    .lean()
    .catch(() => null);
}

async function loadPublicSettings(academyId = "") {
  /*
   * 1) Render Disk / file-based admin settings.
   * Your admin settings are saved under:
   * server/uploads/admin-settings.json
   *
   * In this file:
   * __dirname = server/src/routes
   * UPLOAD_DIR = server/uploads
   */
  try {
    const adminSettingsPath = path.join(UPLOAD_DIR, "admin-settings.json");

    if (fs.existsSync(adminSettingsPath)) {
      const raw = fs.readFileSync(adminSettingsPath, "utf8");
      const parsed = JSON.parse(raw || "{}");

      if (parsed && typeof parsed === "object") {
        const aid = cleanStr(academyId);

        if (aid && parsed?.[aid] && typeof parsed[aid] === "object") {
          return parsed[aid];
        }

        const rows = Object.values(parsed).filter(
          (x) => x && typeof x === "object",
        );

        if (rows.length) {
          return (
            rows.sort((a, b) => {
              const da = new Date(a?.updatedAt || 0).getTime();
              const db = new Date(b?.updatedAt || 0).getTime();
              return db - da;
            })[0] || null
          );
        }

        return parsed;
      }
    }
  } catch {
    // continue to DB fallback
  }

  /*
   * 2) DB fallback. This keeps compatibility if settings are later moved
   * to MongoDB.
   */
  const possibleModels = [
    AppSetting,
    M("AppSetting"),
    M("Setting"),
    M("Settings"),
    M("AdminSetting"),
    M("AppSettings"),
  ].filter(Boolean);

  for (const Model of possibleModels) {
    try {
      const query = {};

      if (academyId && isValidObjectId(academyId)) {
        query.$or = [
          { academyId },
          { academyId: new mongoose.Types.ObjectId(academyId) },
        ];
      }

      const row = await Model.findOne(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();

      if (row) return row;
    } catch {
      // try next model
    }
  }

  return null;
}

function apiOrigin(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function toPublicUploadUrl(req, value = "") {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/uploads/")) return `${apiOrigin(req)}${v}`;
  return v;
}

function mapPublicSettings(req, settings = {}) {
  const logoUrl = toPublicUploadUrl(
    req,
    settings?.logoUrl ||
      settings?.logoPath ||
      settings?.logoDataUrl ||
      settings?.logo ||
      settings?.appLogo ||
      settings?.brandLogo ||
      settings?.siteLogo ||
      settings?.headerLogo ||
      settings?.navbarLogo ||
      settings?.academyLogo ||
      settings?.logoImage ||
      "",
  );

  const loginMediaUrl = toPublicUploadUrl(
    req,
    settings?.loginMediaUrl ||
      settings?.loginMediaPath ||
      settings?.loginImage ||
      settings?.loginVideoUrl ||
      "",
  );

  const mediaMime =
    settings?.loginMediaMime || settings?.loginVideoMime || "video/mp4";

  const loginKind =
    settings?.loginKind ||
    (loginMediaUrl
      ? String(mediaMime).toLowerCase().startsWith("video/")
        ? "video_url"
        : "image_url"
      : "default");

  const siteName =
    settings?.siteName ||
    settings?.appName ||
    settings?.academyName ||
    settings?.brandName ||
    settings?.companyName ||
    settings?.name ||
    "Rebel Angels";

  const tagline =
    settings?.tagline ||
    settings?.subtitle ||
    settings?.description ||
    settings?.siteTagline ||
    "Parent Portal";

  const primaryColor =
    settings?.accent ||
    settings?.primaryColor ||
    settings?.accentColor ||
    settings?.brandColor ||
    settings?.themeColor ||
    settings?.mainColor ||
    "#e11d2e";

  return {
    siteName,
    appName: siteName,
    academyName: siteName,
    brandName: siteName,
    companyName: siteName,
    name: siteName,

    tagline,
    subtitle: tagline,
    description: tagline,
    siteTagline: tagline,

    logoUrl,
    logo: logoUrl,
    appLogo: logoUrl,
    brandLogo: logoUrl,
    siteLogo: logoUrl,
    headerLogo: logoUrl,
    navbarLogo: logoUrl,
    academyLogo: logoUrl,
    logoDataUrl: logoUrl,

    loginKind,
    loginMediaUrl,
    loginMediaPath: settings?.loginMediaPath || "",
    loginMediaMime: mediaMime,
    loginVideoMime: mediaMime,
    loginMediaFit: settings?.loginMediaFit || "cover",
    loginVideoAutoplay: settings?.loginVideoAutoplay ?? true,
    loginVideoMuted: settings?.loginVideoMuted ?? true,
    loginVideoLoop: settings?.loginVideoLoop ?? true,
    loginOverlayTitle: settings?.loginOverlayTitle || "",
    loginOverlaySubtitle: settings?.loginOverlaySubtitle || "",
    loginOverlayOpacity: Number(settings?.loginOverlayOpacity ?? 0.3),

    primaryColor,
    accentColor: primaryColor,
    accent: primaryColor,
    brandColor: primaryColor,
    themeColor: primaryColor,
    mainColor: primaryColor,

    updatedAt: settings?.updatedAt || null,
  };
}

/* =========================
 * GET /api/public/health
 * ========================= */
router.get("/health", (_req, res) => res.json({ ok: true }));

/* =========================
 * GET /api/public/settings
 * Public app/branding settings
 * No auth required
 * ========================= */
router.get("/settings", async (req, res) => {
  try {
    const academyId = cleanStr(req.query?.academyId);
    const settings = await loadPublicSettings(academyId);
    const publicSettings = mapPublicSettings(req, settings || {});

    return res.json({
      ok: true,
      success: true,
      settings: publicSettings,
      appSettings: publicSettings,
      publicSettings,
      branding: publicSettings,
      brand: publicSettings,
    });
  } catch (err) {
    const fallbackSettings = mapPublicSettings(req, {});

    return res.status(200).json({
      ok: true,
      success: true,
      warning: err?.message || "Using fallback public settings",
      settings: fallbackSettings,
      appSettings: fallbackSettings,
      publicSettings: fallbackSettings,
      branding: fallbackSettings,
      brand: fallbackSettings,
    });
  }
});

    return res.json({
      ok: true,
      success: true,
      settings: publicSettings,
      appSettings: publicSettings,
      publicSettings,
      branding: publicSettings,
      brand: publicSettings,
    });
  } catch (err) {
    const fallbackSettings = mapPublicSettings({});

    return res.status(200).json({
      ok: true,
      success: true,
      warning: err?.message || "Using fallback public settings",
      settings: fallbackSettings,
      appSettings: fallbackSettings,
      publicSettings: fallbackSettings,
      branding: fallbackSettings,
      brand: fallbackSettings,
    });
  }
});

/* =========================
 * POST /api/public/academy-register
 * ========================= */
router.post(
  "/academy-register",
  academyLogoUpload.single("logo"),
  async (req, res, next) => {
    try {
      const payload = {
        academyNameEn: cleanStr(req.body?.academyNameEn),
        academyNameAr: cleanStr(req.body?.academyNameAr),
        legalEntityType: cleanStr(req.body?.legalEntityType) || "LLC",
        commercialRegistrationNumber: cleanStr(
          req.body?.commercialRegistrationNumber,
        ),
        tradeLicenseNumber: cleanStr(req.body?.tradeLicenseNumber),
        activityType: cleanStr(req.body?.activityType),
        authorizedSignatoryName: cleanStr(req.body?.authorizedSignatoryName),
        authorizedSignatoryIdNumber: cleanStr(
          req.body?.authorizedSignatoryIdNumber,
        ),
        email: normalizeEmail(req.body?.email),
        phone: normalizePhone(req.body?.phone),
        municipality: cleanStr(req.body?.municipality),
        zone: cleanStr(req.body?.zone),
        streetAddress: cleanStr(req.body?.streetAddress),
        competentAuthorityApprovalRequired: normalizeBool(
          req.body?.competentAuthorityApprovalRequired,
        ),
        declarationAccepted: normalizeBool(req.body?.declarationAccepted),
      };

      if (!payload.academyNameEn) {
        removeUploadedFile(req.file?.path);
        return res
          .status(400)
          .json({ message: "Academy Name (English) is required" });
      }

      if (!payload.commercialRegistrationNumber) {
        removeUploadedFile(req.file?.path);
        return res
          .status(400)
          .json({ message: "Commercial Registration Number is required" });
      }

      if (!payload.activityType) {
        removeUploadedFile(req.file?.path);
        return res
          .status(400)
          .json({ message: "Business Activity is required" });
      }

      if (!payload.authorizedSignatoryName) {
        removeUploadedFile(req.file?.path);
        return res
          .status(400)
          .json({ message: "Authorized Signatory Name is required" });
      }

      if (!payload.authorizedSignatoryIdNumber) {
        removeUploadedFile(req.file?.path);
        return res.status(400).json({
          message: "Authorized Signatory ID / QID / Passport is required",
        });
      }

      if (!payload.email) {
        removeUploadedFile(req.file?.path);
        return res.status(400).json({ message: "Email is required" });
      }

      if (!isValidEmail(payload.email)) {
        removeUploadedFile(req.file?.path);
        return res.status(400).json({ message: "Enter a valid email address" });
      }

      if (!payload.phone) {
        removeUploadedFile(req.file?.path);
        return res.status(400).json({ message: "Phone is required" });
      }

      if (!isValidQatarPhone(payload.phone)) {
        removeUploadedFile(req.file?.path);
        return res.status(400).json({
          message: "Enter a valid Qatar mobile number in local or +974 format",
        });
      }

      if (!payload.streetAddress) {
        removeUploadedFile(req.file?.path);
        return res.status(400).json({ message: "Street Address is required" });
      }

      if (!payload.declarationAccepted) {
        removeUploadedFile(req.file?.path);
        return res.status(400).json({
          message: "You must accept the declaration before submitting",
        });
      }

      const duplicate = await AcademyRegistration.findOne({
        $or: [
          {
            commercialRegistrationNumber: payload.commercialRegistrationNumber,
          },
          { email: payload.email },
        ],
      }).lean();

      if (duplicate) {
        removeUploadedFile(req.file?.path);
        return res.status(409).json({
          message:
            "An academy registration already exists with this Commercial Registration Number or Email",
        });
      }

      const logoUrl = req.file
        ? academyLogoPublicUrl(req, req.file.filename)
        : "";

      const academy = await AcademyRegistration.create({
        ...payload,
        logoUrl,
        status: "PENDING",
      });

      return res.status(201).json({
        message:
          "Academy registration submitted successfully. Waiting for super admin approval.",
        id: academy._id,
        status: academy.status,
      });
    } catch (e) {
      if (req.file?.path) removeUploadedFile(req.file.path);
      next(e);
    }
  },
);

/* =========================
 * GET /api/public/academy-activate-info?token=...
 * ========================= */
router.get("/academy-activate-info", async (req, res, next) => {
  try {
    const token = cleanStr(req.query?.token);

    if (!token) {
      return res.status(400).json({ message: "Missing activation token" });
    }

    const registration = await AcademyRegistration.findOne({
      activationToken: token,
    }).lean();

    if (!registration) {
      return res.status(404).json({ message: "Invalid activation token" });
    }

    if (!registration.activationTokenExpiresAt) {
      return res.status(400).json({ message: "Activation token is invalid" });
    }

    if (new Date(registration.activationTokenExpiresAt) < new Date()) {
      return res.status(400).json({ message: "Activation token has expired" });
    }

    if (
      !["APPROVED"].includes(String(registration.status || "").toUpperCase())
    ) {
      return res.status(400).json({
        message: "This registration is not ready for activation",
      });
    }

    return res.json({
      ok: true,
      academyNameEn: registration.academyNameEn || "",
      academyNameAr: registration.academyNameAr || "",
      academyCode: registration.academyCode || "",
      email: registration.email || "",
      phone: registration.phone || "",
      municipality: registration.municipality || "",
      status: registration.status || "APPROVED",
    });
  } catch (e) {
    next(e);
  }
});

/* =========================
 * POST /api/public/academy-activate
 * ========================= */
router.post("/academy-activate", async (req, res, next) => {
  try {
    const token = cleanStr(req.body?.token);
    const adminName = cleanStr(req.body?.adminName);
    const adminEmail = normalizeEmail(req.body?.adminEmail);
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!token) {
      return res.status(400).json({ message: "Missing activation token" });
    }

    if (!adminName) {
      return res.status(400).json({ message: "Admin name is required" });
    }

    if (!adminEmail) {
      return res.status(400).json({ message: "Admin email is required" });
    }

    if (!isValidEmail(adminEmail)) {
      return res.status(400).json({ message: "Enter a valid admin email" });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const registration = await AcademyRegistration.findOne({
      activationToken: token,
    });

    if (!registration) {
      return res.status(404).json({ message: "Invalid activation token" });
    }

    if (!registration.activationTokenExpiresAt) {
      return res.status(400).json({ message: "Activation token is invalid" });
    }

    if (new Date(registration.activationTokenExpiresAt) < new Date()) {
      return res.status(400).json({ message: "Activation token has expired" });
    }

    const status = String(registration.status || "").toUpperCase();

    if (status === "ACTIVATED") {
      return res.status(400).json({
        message: "This academy has already been activated",
      });
    }

    if (status !== "APPROVED") {
      return res.status(400).json({
        message: "This registration is not approved for activation",
      });
    }

    const Academy = M("Academy");
    const User = M("User");

    if (!Academy) {
      return res.status(500).json({ message: "Academy model not found" });
    }

    if (!User) {
      return res.status(500).json({ message: "User model not found" });
    }

    const existingUser = await User.findOne({ email: adminEmail })
      .select("_id email")
      .lean()
      .catch(() => null);

    if (existingUser) {
      return res.status(409).json({
        message: "An account already exists with this admin email",
      });
    }

    let academyCode = cleanStr(registration.academyCode).toUpperCase();
    if (!academyCode) {
      academyCode = generateAcademyCode(registration.academyNameEn);
    }

    let academyDoc = null;

    if (registration.academyId && isValidObjectId(registration.academyId)) {
      academyDoc = await Academy.findById(registration.academyId).catch(
        () => null,
      );
    }

    if (!academyDoc) {
      const existingByCode = await findAcademyByCode(Academy, academyCode);
      if (existingByCode) {
        academyDoc = await Academy.findById(existingByCode._id).catch(
          () => null,
        );
      }
    }

    if (!academyDoc) {
      const uniqueCode = await ensureUniqueAcademyCode(academyCode);

      const academyPayload = {
        name: registration.academyNameEn || "Academy",
        academyName: registration.academyNameEn || "Academy",
        code: uniqueCode,
        academyCode: uniqueCode,
        email: registration.email || adminEmail,
        phone: registration.phone || "",
        logoUrl: registration.logoUrl || "",
        academyLogo: registration.logoUrl || "",
        status: "ACTIVE",
        address: registration.streetAddress || "",
        municipality: registration.municipality || "",
        zone: registration.zone || "",
        notes: `Activated from public registration ${registration._id}`,
      };

      academyDoc = await Academy.create(academyPayload);
      academyCode = uniqueCode;
    } else {
      academyCode = cleanStr(
        academyDoc.code || academyDoc.academyCode || academyCode,
      ).toUpperCase();
    }

    const hashed = await bcrypt.hash(password, 10);

    const userPayload = {
      name: adminName,
      email: adminEmail,
      passwordHash: hashed,
      role: "ADMIN",
      academyId: academyDoc._id,
      academyCode,
      isApproved: true,
      approved: true,
      active: true,
      status: "ACTIVE",
    };

    const userDoc = await User.create(userPayload);

    registration.status = "ACTIVATED";
    registration.activatedAt = new Date();
    registration.academyId = academyDoc._id;
    registration.adminUserId = userDoc._id;
    registration.academyCode = academyCode;
    registration.activationToken = "";
    registration.activationTokenExpiresAt = null;
    await registration.save();

    return res.json({
      ok: true,
      message:
        "Academy activated successfully. You can now log in using your admin email, password, and academy code.",
      academyCode,
      loginEmail: adminEmail,
      loginRole: "ADMIN",
    });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({
        message:
          "Duplicate data found while activating academy. Please retry or check existing academy/admin records.",
      });
    }

    next(e);
  }
});

/* =========================
 * GET /api/public/groups
 * ========================= */
router.get("/groups", async (req, res, next) => {
  try {
    const academyId = String(req.query.academyId || "").trim();
    const q = {};

    if (academyId) {
      if (!isValidObjectId(academyId)) {
        return res.status(400).json({ message: "Invalid academyId" });
      }

      q.academyId = academyId;
    }

    const groups = await Group.find(q, { name: 1, level: 1 })
      .sort({ name: 1, level: 1 })
      .lean();

    res.json(groups);
  } catch (e) {
    next(e);
  }
});

/* =========================
 * GET /api/public/totals/group/:groupId
 * ========================= */
router.get("/totals/group/:groupId", async (req, res, next) => {
  try {
    const { groupId } = req.params;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ message: "Invalid groupId" });
    }

    const group = await Group.findById(groupId).lean();
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json(await computeTotalsForGroup(groupId));
  } catch (e) {
    next(e);
  }
});

/* =========================
 * GET /api/public/events
 * ========================= */
router.get("/events", async (req, res, next) => {
  try {
    const academyId = String(req.query.academyId || "").trim();
    const q = {};

    if (academyId) {
      if (!isValidObjectId(academyId)) {
        return res.status(400).json({ message: "Invalid academyId" });
      }

      q.academyId = academyId;
    }

    const rows = await Event.find(q, {
      name: 1,
      code: 1,
      status: 1,
      startDate: 1,
      endDate: 1,
      venue: 1,
      academyId: 1,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/* =========================
 * GET /api/public/events/:eventId/leaderboard
 * ========================= */
router.get("/events/:eventId/leaderboard", async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const event = await Event.findById(eventId).lean();
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const academyId = event.academyId;
    const eventObjId = new mongoose.Types.ObjectId(eventId);

    const enrollments = await EventEnrollment.find({
      academyId,
      eventId: eventObjId,
    }).lean();

    const participantIds = enrollments
      .map((e) => e.participantId)
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    if (!participantIds.length) return res.json([]);

    const participants = await Participant.find({
      academyId,
      _id: { $in: participantIds },
    })
      .populate("userId", "name")
      .populate("groupId", "name level")
      .lean();

    const totals = await Score.aggregate([
      {
        $match: {
          academyId: new mongoose.Types.ObjectId(String(academyId)),
          eventId: eventObjId,
          participantId: { $in: participantIds },
          status: "SCORED",
          value: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$participantId",
          total: { $sum: { $toDouble: "$value" } },
        },
      },
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

    const rankMap = new Map(
      [...totals]
        .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
        .map((row, index) => [String(row._id), index + 1]),
    );

    const out = participants
      .map((p) => {
        const enr = enrMap.get(String(p._id));
        const bibNo = cleanStr(enr?.bibNo || p.bibNo || "");
        const medal = medalMap.get(String(p._id)) || "";

        return {
          participantId: p._id,
          academyId: String(academyId),
          name: p.userId?.name || "",
          groupName: p.groupId?.name || "",
          level: p.groupId?.level || "",
          bibNo,
          total: totalMap.get(String(p._id)) || 0,
          medal,
          rank: rankMap.get(String(p._id)) || null,
        };
      })
      .sort((a, b) => {
        const diff = Number(b.total || 0) - Number(a.total || 0);
        if (diff !== 0) return diff;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

    res.json(out);
  } catch (e) {
    next(e);
  }
});

/* =========================
 * GET /api/public/events/:eventId/participant/:participantId
 * Optional public participant snapshot
 * ========================= */
router.get(
  "/events/:eventId/participant/:participantId",
  async (req, res, next) => {
    try {
      const { eventId, participantId } = req.params;

      if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: "Invalid eventId" });
      }

      if (!isValidObjectId(participantId)) {
        return res.status(400).json({ message: "Invalid participantId" });
      }

      const event = await Event.findById(eventId).lean();
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const participant = await Participant.findOne({
        _id: participantId,
        academyId: event.academyId,
      })
        .populate("userId", "name email phone")
        .populate("groupId", "name level")
        .populate("academyId", "name")
        .lean();

      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      const enrollment = await EventEnrollment.findOne({
        participantId,
        eventId,
        academyId: event.academyId,
      }).lean();

      if (!enrollment) {
        return res
          .status(404)
          .json({ message: "Participant not enrolled in this event" });
      }

      const scores = await Score.find({
        participantId,
        eventId,
        academyId: event.academyId,
        value: { $ne: null },
      })
        .populate("activityId", "name")
        .populate("judgeUserId", "name email")
        .sort({ createdAt: -1 })
        .lean();

      const awards = await Award.find({
        participantId,
        eventId,
        academyId: event.academyId,
      })
        .sort({ createdAt: -1 })
        .lean();

      const total = scores.reduce((sum, s) => sum + Number(s?.value || 0), 0);

      const rankMap = await buildParticipantRankMap(
        [participantId],
        event.academyId,
        eventId,
      );

      return res.json({
        participant,
        event,
        enrollment,
        scores,
        awards,
        total,
        rank: rankMap.get(String(participantId)) || null,
      });
    } catch (e) {
      next(e);
    }
  },
);

/* =========================
 * GET /api/public/events/:eventId/certificate/:participantId.pdf
 * ========================= */
router.get(
  "/events/:eventId/certificate/:participantId.pdf",
  async (req, res, next) => {
    try {
      const { eventId, participantId } = req.params;

      if (!isValidObjectId(eventId)) {
        return res.status(400).json({ message: "Invalid eventId" });
      }

      if (!isValidObjectId(participantId)) {
        return res.status(400).json({ message: "Invalid participantId" });
      }

      const eventDoc = await Event.findById(eventId).lean();
      if (!eventDoc) {
        return res.status(404).json({ message: "Event not found" });
      }

      const academyId = eventDoc.academyId;

      const cert = await Certificate.findOne({
        academyId,
        eventId,
        participantId,
        isRevoked: false,
      }).lean();

      if (!cert) {
        return res.status(404).json({ message: "Certificate not found" });
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
        .lean();

      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }

      const totals = await Score.aggregate([
        {
          $match: {
            academyId: new mongoose.Types.ObjectId(String(academyId)),
            eventId: new mongoose.Types.ObjectId(eventId),
            participantId: new mongoose.Types.ObjectId(participantId),
            status: "SCORED",
            value: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$participantId",
            total: { $sum: { $toDouble: "$value" } },
          },
        },
      ]);

      const total = Number(totals?.[0]?.total || 0);

      const token = cert?.meta?.token || "";
      const verifyUrl = token
        ? `${req.protocol}://${req.get(
            "host",
          )}/api/public/verify-certificate?t=${encodeURIComponent(token)}`
        : "";

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="certificate-${participant._id}.pdf"`,
      );

      const dateText = cert?.issuedAt
        ? new Date(cert.issuedAt).toLocaleDateString()
        : eventDoc?.startDate
          ? new Date(eventDoc.startDate).toLocaleDateString()
          : new Date().toLocaleDateString();

      if (fs.existsSync(TEMPLATE_PATH)) {
        try {
          const templateBytes = fs.readFileSync(TEMPLATE_PATH);

          const overlayDoc = await buildCertificateOverlayPdf({
            participantName: participant.userId?.name || cert.participantName,
            groupName: participant.groupId?.name || cert.groupName || "",
            level: participant.groupId?.level || cert.level || "",
            total,
            eventName: eventDoc?.name || cert.eventName || "",
            bibNo: participant.bibNo || enrolled.bibNo || cert.bibNo || "",
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
          res.setHeader("X-Cert-Mode", "template");
          return res.end(Buffer.from(merged));
        } catch (e) {
          console.error("Public template merge failed. Falling back:", e);
          res.setHeader("X-Cert-Mode", "fallback-merge-failed");
        }
      } else {
        res.setHeader("X-Cert-Mode", "fallback-template-missing");
      }

      const doc = await buildCertificatePdf({
        appName: process.env.APP_NAME,
        signatory: process.env.CERT_SIGNATORY,
        participantName: participant.userId?.name || cert.participantName,
        groupName: participant.groupId?.name || cert.groupName || "",
        level: participant.groupId?.level || cert.level || "",
        total,
        title: cert.title || "PARTICIPATION AWARD",
        eventName: eventDoc.name,
        bibNo: participant.bibNo || enrolled.bibNo || cert.bibNo || "",
        serialNo: cert.serialNo,
        note: "Awarded for outstanding performance and dedication.",
        qrText: verifyUrl,
        showQr: !!verifyUrl,
        showSerial: true,
      });

      doc.pipe(res);
      doc.end();
    } catch (e) {
      next(e);
    }
  },
);

/* =========================
 * Alias:
 * GET /api/public/events/:eventId/certificates/:participantId.pdf
 * Supports frontend plural certificate URL
 * ========================= */
router.get("/events/:eventId/certificates/:participantId.pdf", (req, res) => {
  const { eventId, participantId } = req.params;

  if (!isValidObjectId(eventId)) {
    return res.status(400).json({ message: "Invalid eventId" });
  }

  if (!isValidObjectId(participantId)) {
    return res.status(400).json({ message: "Invalid participantId" });
  }

  return res.redirect(
    302,
    `/api/public/events/${encodeURIComponent(
      eventId,
    )}/certificate/${encodeURIComponent(participantId)}.pdf`,
  );
});

/* =========================
 * GET /api/public/verify-certificate?t=...
 * ========================= */
router.get("/verify-certificate", async (req, res, next) => {
  try {
    const token = String(req.query.t || "").trim();

    if (!token) {
      return res.status(400).json({
        valid: false,
        message: "Missing verification token",
      });
    }

    const payload = verifyToken(token);

    if (!payload) {
      return res.status(400).json({
        valid: false,
        message: "Invalid certificate token",
      });
    }

    const q = {
      serialNo: payload.serialNo,
      eventId: payload.eventId,
      participantId: payload.participantId,
    };

    if (payload.academyId && isValidObjectId(payload.academyId)) {
      q.academyId = payload.academyId;
    }

    const cert = await Certificate.findOne(q)
      .populate("eventId", "name academyId")
      .populate({
        path: "participantId",
        populate: [{ path: "userId", select: "name email" }],
      })
      .lean();

    if (!cert) {
      return res.status(404).json({
        valid: false,
        message: "Certificate not found",
      });
    }

    return res.json({
      valid: !cert.isRevoked,
      revoked: !!cert.isRevoked,
      serialNo: cert.serialNo,
      participant: cert.participantName,
      event: cert.eventName || cert.eventId?.name || "",
      title: cert.title,
      issuedAt: cert.issuedAt,
      groupName: cert.groupName || "",
      level: cert.level || "",
      bibNo: cert.bibNo || "",
      revokeReason: cert.revokeReason || "",
    });
  } catch (e) {
    next(e);
  }
});

/* =========================
 * GET /api/public/participant-profile-check/:userId
 * Debug helper for linkage check
 * Remove later if not needed
 * ========================= */
router.get("/participant-profile-check/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const participant = await Participant.findOne({ userId })
      .populate("userId", "name email role")
      .populate("groupId", "name level")
      .populate("academyId", "name code academyCode")
      .lean();

    return res.json({
      found: !!participant,
      participant: participant || null,
    });
  } catch (e) {
    next(e);
  }
});

/* =========================
 * Basic public error handler
 * ========================= */
router.use((err, _req, res, _next) => {
  console.error("Public route error:", err);

  if (
    err?.message &&
    String(err.message).includes("Only PNG, JPG, JPEG, WEBP, and SVG")
  ) {
    return res.status(400).json({
      message: err.message,
    });
  }

  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      message: "Logo file is too large. Maximum allowed size is 3MB",
    });
  }

  return res.status(500).json({
    message: err?.message || "Public API error",
  });
});

export default router;
