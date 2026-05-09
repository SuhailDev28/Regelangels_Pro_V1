// server/src/routes/superadmin.routes.js
import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import AcademyRegistration from "../models/AcademyRegistration.js";
import User from "../models/User.js";
import Academy from "../models/Academy.js";
import { deleteAcademyCascade } from "../utils/deleteAcademyCascade.js";

const router = express.Router();

router.use(auth, requireRole("SUPER_ADMIN"));

/* =========================================================
   HELPERS
========================================================= */

function normalizeMsg(err, fallback = "Something went wrong") {
  return (
    err?.response?.data?.message ||
    err?.message ||
    (typeof err === "string" ? err : "") ||
    fallback
  );
}

function wrap(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      next(e);
    }
  };
}

function M(name) {
  return mongoose.models?.[name] || null;
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(v, fallback = "") {
  return v == null ? fallback : String(v);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toArray(v) {
  return Array.isArray(v) ? v : [];
}

function now() {
  return new Date();
}

function objectId(value) {
  if (!value) return null;
  try {
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (mongoose.isValidObjectId(value)) {
      return new mongoose.Types.ObjectId(String(value));
    }
    return null;
  } catch {
    return null;
  }
}

function idString(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
}

function pick(obj, keys = [], fallback = undefined) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return fallback;
}

function dateOnly(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  x.setHours(0, 0, 0, 0);
  return x;
}

function normalizeRange(range = "30d") {
  const value = String(range || "30d")
    .trim()
    .toLowerCase();
  const end = now();
  const start = new Date(end);

  if (value === "7d") start.setDate(end.getDate() - 7);
  else if (value === "30d") start.setDate(end.getDate() - 30);
  else if (value === "90d") start.setDate(end.getDate() - 90);
  else if (value === "12m") start.setMonth(end.getMonth() - 12);
  else start.setDate(end.getDate() - 30);

  return { key: value, start, end };
}

function buildDateBuckets(rangeKey, start, end) {
  const buckets = [];

  if (rangeKey === "12m") {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= endCursor) {
      buckets.push({
        key: `${cursor.getFullYear()}-${cursor.getMonth() + 1}`,
        label: cursor.toLocaleString("en", { month: "short", year: "2-digit" }),
        start: new Date(cursor),
        end: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
        value: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return buckets;
  }

  const cursor = dateOnly(start);
  const endCursor = dateOnly(end);

  while (cursor <= endCursor) {
    buckets.push({
      key: cursor.toISOString().slice(0, 10),
      label: cursor.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      start: new Date(cursor),
      end: new Date(cursor.getTime() + 24 * 60 * 60 * 1000),
      value: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function uniqIds(arr = []) {
  return [...new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))];
}

function emitAcademyDeleted(req, academyId) {
  const io = req.app.get("io");
  if (!io) return;
  io.to("admins").emit("academy:deleted", {
    academyId,
    ts: Date.now(),
  });
}

function emitAcademyRegistrationUpdated(req, row, action) {
  const io = req.app.get("io");
  if (!io) return;
  io.to("admins").emit("academy-registration:updated", {
    action,
    row,
    ts: Date.now(),
  });
}

/* =========================================================
   FIELD RESOLUTION
========================================================= */

function resolveIdFromDoc(doc, keys = []) {
  for (const key of keys) {
    const value = doc?.[key];
    if (!value) continue;
    if (typeof value === "object" && value._id) return String(value._id);
    return String(value);
  }
  return "";
}

function resolveNameFromDoc(doc, keys = []) {
  for (const key of keys) {
    const value = doc?.[key];
    if (!value) continue;

    if (typeof value === "object") {
      const nested =
        value.name ||
        value.branchName ||
        value.academyName ||
        value.title ||
        value.label;
      if (nested) return String(nested);
    }

    return String(value);
  }
  return "";
}

function getAcademyIdFromDoc(doc) {
  return resolveIdFromDoc(doc, [
    "academyId",
    "academy",
    "academyRef",
    "academy_id",
  ]);
}

function getBranchIdFromDoc(doc) {
  return resolveIdFromDoc(doc, [
    "branchId",
    "branch",
    "branchRef",
    "branch_id",
  ]);
}

function getUserRole(doc) {
  return safeStr(pick(doc, ["role", "userRole", "type"], ""), "").toUpperCase();
}

function getCreatedAt(doc) {
  const raw = pick(doc, [
    "createdAt",
    "updatedAt",
    "date",
    "issuedAt",
    "verifiedAt",
    "eventDate",
    "startDate",
  ]);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getBooleanApproval(doc) {
  const raw = pick(doc, ["approved", "isApproved", "verified", "active"]);
  if (typeof raw === "boolean") return raw;
  return null;
}

function getStatus(doc) {
  return safeStr(
    pick(doc, ["status", "state", "approvalStatus"], ""),
    "",
  ).toUpperCase();
}

/* =========================================================
   DB HELPERS
========================================================= */

async function findDocs(Model, query = {}, projection = null, options = {}) {
  if (!Model) return [];
  try {
    let q = Model.find(query, projection);
    if (options.sort) q = q.sort(options.sort);
    if (options.limit) q = q.limit(options.limit);
    if (options.populate) {
      for (const pop of options.populate) q = q.populate(pop);
    }
    return await q.lean();
  } catch {
    return [];
  }
}

/* =========================================================
   SCOPE HELPERS
========================================================= */

function withinRange(doc, start, end) {
  const d = getCreatedAt(doc);
  if (!d) return false;
  return d >= start && d <= end;
}

function matchesScope(doc, academyId, branchId) {
  if (branchId && branchId !== "all") {
    return getBranchIdFromDoc(doc) === String(branchId);
  }

  if (academyId && academyId !== "all") {
    return getAcademyIdFromDoc(doc) === String(academyId);
  }

  return true;
}

/* =========================================================
   ACADEMY HELPERS
========================================================= */

function normalizeAcademyPayload(body = {}) {
  const name = safeStr(body.name || body.academyName, "").trim();
  const code = safeStr(body.code || body.academyCode, "")
    .trim()
    .toUpperCase();

  return {
    name,
    academyName: name,
    code,
    academyCode: code,
    email: safeStr(body.email, "").trim(),
    phone: safeStr(body.phone, "").trim(),
    logoUrl: safeStr(body.logoUrl || body.academyLogo, "").trim(),
    academyLogo: safeStr(body.logoUrl || body.academyLogo, "").trim(),
    status: safeStr(body.status || "ACTIVE", "ACTIVE")
      .trim()
      .toUpperCase(),
    primaryColor: safeStr(body.primaryColor, "").trim(),
    secondaryColor: safeStr(body.secondaryColor, "").trim(),
    address: safeStr(body.address, "").trim(),
    notes: safeStr(body.notes, "").trim(),
  };
}

function toAcademyResponse(doc, includeBranches = false) {
  if (!doc) return null;

  return {
    _id: doc._id || doc.id,
    id: idString(doc._id || doc.id),
    academyId: idString(doc._id || doc.id),
    name: doc.name || doc.academyName || "Academy",
    academyName: doc.name || doc.academyName || "Academy",
    code: doc.code || doc.academyCode || "",
    academyCode: doc.code || doc.academyCode || "",
    email: doc.email || "",
    phone: doc.phone || "",
    logoUrl: doc.logoUrl || doc.academyLogo || "",
    academyLogo: doc.logoUrl || doc.academyLogo || "",
    status: doc.status || "ACTIVE",
    primaryColor: doc.primaryColor || "",
    secondaryColor: doc.secondaryColor || "",
    address: doc.address || "",
    notes: doc.notes || "",
    branches: includeBranches ? toArray(doc.branches) : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toAcademyRegistrationResponse(doc) {
  if (!doc) return null;

  return {
    _id: doc._id,
    id: idString(doc._id),
    academyNameEn: doc.academyNameEn || "",
    academyNameAr: doc.academyNameAr || "",
    legalEntityType: doc.legalEntityType || "",
    commercialRegistrationNumber: doc.commercialRegistrationNumber || "",
    tradeLicenseNumber: doc.tradeLicenseNumber || "",
    activityType: doc.activityType || "",
    authorizedSignatoryName: doc.authorizedSignatoryName || "",
    authorizedSignatoryIdNumber: doc.authorizedSignatoryIdNumber || "",
    email: doc.email || "",
    phone: doc.phone || "",
    municipality: doc.municipality || "",
    zone: doc.zone || "",
    streetAddress: doc.streetAddress || "",
    logoUrl: doc.logoUrl || "",
    competentAuthorityApprovalRequired:
      !!doc.competentAuthorityApprovalRequired,
    declarationAccepted: !!doc.declarationAccepted,
    status: doc.status || "PENDING",
    approvedBy: doc.approvedBy || null,
    approvedAt: doc.approvedAt || null,
    rejectedReason: doc.rejectedReason || "",
    academyCode: doc.academyCode || "",
    activationToken: doc.activationToken || "",
    activationTokenExpiresAt: doc.activationTokenExpiresAt || null,
    activatedAt: doc.activatedAt || null,
    academyId: doc.academyId || null,
    adminUserId: doc.adminUserId || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
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

/* =========================================================
   LOADERS
========================================================= */

async function loadAcademiesWithBranches() {
  const Academy = M("Academy");
  const Branch = M("Branch");

  const academies = await findDocs(Academy, {}, null, {
    sort: { createdAt: -1 },
  });
  const branches = await findDocs(Branch, {}, null, {
    sort: { createdAt: -1 },
  });

  const branchMap = new Map();

  for (const b of branches) {
    const academyId = getAcademyIdFromDoc(b);
    if (!academyId) continue;
    if (!branchMap.has(academyId)) branchMap.set(academyId, []);
    branchMap.get(academyId).push(b);
  }

  return academies.map((a) => {
    const id = idString(a?._id || a?.id);
    return {
      ...a,
      _id: a?._id || a?.id,
      id,
      academyId: id,
      name: a?.name || a?.academyName || "Academy",
      code: a?.code || a?.academyCode || "",
      logoUrl: a?.logoUrl || a?.academyLogo || "",
      email: a?.email || "",
      phone: a?.phone || "",
      status: a?.status || "ACTIVE",
      primaryColor: a?.primaryColor || "",
      secondaryColor: a?.secondaryColor || "",
      address: a?.address || "",
      notes: a?.notes || "",
      branches: branchMap.get(id) || [],
    };
  });
}

async function loadBranchRows(academyId, branchId) {
  const Branch = M("Branch");
  const Academy = M("Academy");

  let branches = await findDocs(Branch, {}, null, { sort: { createdAt: -1 } });
  const academies = await findDocs(Academy, {}, null, {
    sort: { createdAt: -1 },
  });

  const academyNameById = new Map(
    academies.map((a) => [
      idString(a?._id || a?.id),
      a?.name || a?.academyName || "Academy",
    ]),
  );

  branches = branches.map((b) => {
    const aId = getAcademyIdFromDoc(b);
    return {
      ...b,
      _id: b?._id || b?.id,
      id: idString(b?._id || b?.id),
      academyId: aId,
      academyName: b?.academyName || academyNameById.get(aId) || "Academy",
      name: b?.name || b?.branchName || "Branch",
    };
  });

  if (academyId && academyId !== "all") {
    branches = branches.filter(
      (b) => String(b.academyId) === String(academyId),
    );
  }

  if (branchId && branchId !== "all") {
    branches = branches.filter((b) => String(b.id) === String(branchId));
  }

  return branches;
}

async function loadParticipantsScoped(academyId, branchId) {
  const Participant = M("Participant");
  const docs = await findDocs(Participant, {}, null, {
    sort: { createdAt: -1 },
  });
  return docs.filter((d) => matchesScope(d, academyId, branchId));
}

async function loadUsersScoped(academyId, branchId) {
  const User = M("User");
  const docs = await findDocs(User, {}, null, { sort: { createdAt: -1 } });
  return docs.filter((d) => matchesScope(d, academyId, branchId));
}

async function loadEventsScoped(academyId, branchId) {
  const Event = M("Event");
  const docs = await findDocs(Event, {}, null, { sort: { createdAt: -1 } });
  return docs.filter((d) => matchesScope(d, academyId, branchId));
}

async function loadCertificatesScoped(academyId, branchId) {
  const Certificate = M("Certificate");
  const docs = await findDocs(Certificate, {}, null, {
    sort: { createdAt: -1 },
  });
  return docs.filter((d) => matchesScope(d, academyId, branchId));
}

async function loadAlertsScoped(academyId, branchId) {
  const Alert = M("Alert");
  const docs = await findDocs(Alert, {}, null, { sort: { createdAt: -1 } });
  return docs.filter((d) => matchesScope(d, academyId, branchId));
}

async function loadAttendanceScoped(academyId, branchId) {
  const Attendance = M("Attendance");
  const docs = await findDocs(Attendance, {}, null, {
    sort: { createdAt: -1 },
  });
  return docs.filter((d) => matchesScope(d, academyId, branchId));
}

async function loadScoresScoped(academyId, branchId) {
  const Score = M("Score");
  const docs = await findDocs(Score, {}, null, { sort: { createdAt: -1 } });
  return docs.filter((d) => matchesScope(d, academyId, branchId));
}

async function loadFinanceScoped(academyId, branchId) {
  const Payment = M("Payment");
  const Invoice = M("Invoice");
  const Fee = M("Fee");

  const payments = (
    await findDocs(Payment, {}, null, { sort: { createdAt: -1 } })
  ).filter((d) => matchesScope(d, academyId, branchId));

  const invoices = (
    await findDocs(Invoice, {}, null, { sort: { createdAt: -1 } })
  ).filter((d) => matchesScope(d, academyId, branchId));

  const fees = (
    await findDocs(Fee, {}, null, { sort: { createdAt: -1 } })
  ).filter((d) => matchesScope(d, academyId, branchId));

  return { payments, invoices, fees };
}

/* =========================================================
   BUSINESS HELPERS
========================================================= */

function extractAmount(doc) {
  return safeNum(
    pick(
      doc,
      [
        "amount",
        "paidAmount",
        "total",
        "totalAmount",
        "feeAmount",
        "value",
        "grandTotal",
        "netAmount",
      ],
      0,
    ),
    0,
  );
}

function isPaidDoc(doc) {
  const status = getStatus(doc);
  if (["PAID", "SUCCESS", "COMPLETED", "SETTLED"].includes(status)) return true;
  return pick(doc, ["paid", "isPaid", "paymentSuccess"], false) === true;
}

function isPendingDoc(doc) {
  const status = getStatus(doc);
  if (["PENDING", "DUE", "UNPAID", "PARTIAL", "OVERDUE"].includes(status))
    return true;
  return pick(doc, ["paid", "isPaid"], null) === false;
}

function isOverdueDoc(doc) {
  const status = getStatus(doc);
  if (status === "OVERDUE") return true;

  const due = pick(doc, ["dueDate", "paymentDueDate"]);
  if (!due) return false;

  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return false;

  return dueDate < new Date() && !isPaidDoc(doc);
}

function createTrendFromDocs(
  docs,
  rangeKey,
  start,
  end,
  amountGetter = () => 1,
) {
  const buckets = buildDateBuckets(rangeKey, start, end);

  for (const doc of docs) {
    const d = getCreatedAt(doc);
    if (!d) continue;

    const bucket = buckets.find((b) => d >= b.start && d < b.end);
    if (!bucket) continue;

    bucket.value += safeNum(amountGetter(doc), 0);
  }

  return buckets.map((b) => ({
    label: b.label,
    value: b.value,
  }));
}

/* =========================================================
   ROUTES
========================================================= */

/* =========================
   Academy registrations
========================= */

router.get(
  "/academy-registrations",
  wrap(async (req, res) => {
    const status = safeStr(req.query.status || "", "")
      .trim()
      .toUpperCase();
    const q = safeStr(req.query.q || "", "").trim();

    const filter = {};

    if (
      status &&
      ["PENDING", "APPROVED", "REJECTED", "ACTIVATED"].includes(status)
    ) {
      filter.status = status;
    }

    if (q) {
      filter.$or = [
        { academyNameEn: { $regex: q, $options: "i" } },
        { academyNameAr: { $regex: q, $options: "i" } },
        { commercialRegistrationNumber: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const rows = await AcademyRegistration.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json(rows.map((r) => toAcademyRegistrationResponse(r)));
  }),
);

router.get(
  "/academy-registrations/:id",
  wrap(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid registration id" });
    }

    const row = await AcademyRegistration.findById(id).lean();
    if (!row) {
      return res
        .status(404)
        .json({ message: "Academy registration not found" });
    }

    return res.json(toAcademyRegistrationResponse(row));
  }),
);

router.post(
  "/academy-registrations/:id/approve",
  wrap(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid registration id" });
    }

    const registration = await AcademyRegistration.findById(id);
    if (!registration) {
      return res
        .status(404)
        .json({ message: "Academy registration not found" });
    }

    const status = String(registration.status || "").toUpperCase();

    if (status === "ACTIVATED") {
      return res.status(400).json({
        message: "Academy registration is already activated",
      });
    }

    const academyCode = await ensureUniqueAcademyCode(
      registration.academyCode ||
        generateAcademyCode(registration.academyNameEn),
    );

    const activationToken = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    registration.status = "APPROVED";
    registration.approvedAt = new Date();
    registration.rejectedReason = "";
    registration.approvedBy = req.user?._id || null;
    registration.academyCode = academyCode;
    registration.activationToken = activationToken;
    registration.activationTokenExpiresAt = expiresAt;

    await registration.save();

    const row = toAcademyRegistrationResponse(registration.toObject());
    emitAcademyRegistrationUpdated(req, row, "approve");

    return res.json({
      ok: true,
      message: "Academy registration approved successfully",
      activationToken,
      academyCode,
      activationLink: `/academy/activate?token=${activationToken}`,
      row,
    });
  }),
);

router.post(
  "/academy-registrations/:id/reject",
  wrap(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid registration id" });
    }

    const reason = safeStr(req.body?.reason || "", "").trim();

    const registration = await AcademyRegistration.findById(id);
    if (!registration) {
      return res
        .status(404)
        .json({ message: "Academy registration not found" });
    }

    registration.status = "REJECTED";
    registration.rejectedReason = reason || "Rejected by super admin";
    registration.approvedAt = null;
    registration.approvedBy = req.user?._id || null;
    registration.activationToken = "";
    registration.activationTokenExpiresAt = null;

    await registration.save();

    const row = toAcademyRegistrationResponse(registration.toObject());
    emitAcademyRegistrationUpdated(req, row, "reject");

    return res.json({
      ok: true,
      message: "Academy registration rejected successfully",
      row,
    });
  }),
);

/* =========================
   Academies
========================= */

router.get(
  "/academies",
  wrap(async (req, res) => {
    const includeBranches =
      String(req.query.includeBranches || "false").toLowerCase() === "true";

    const academies = await loadAcademiesWithBranches();

    res.json(
      academies.map((a) => ({
        _id: a._id,
        id: a.id,
        academyId: a.academyId,
        name: a.name,
        academyName: a.name,
        code: a.code || "",
        academyCode: a.code || "",
        email: a.email || "",
        phone: a.phone || "",
        logoUrl: a.logoUrl || "",
        academyLogo: a.logoUrl || "",
        status: a.status || "ACTIVE",
        primaryColor: a.primaryColor || "",
        secondaryColor: a.secondaryColor || "",
        address: a.address || "",
        notes: a.notes || "",
        branches: includeBranches
          ? toArray(a.branches).map((b) => ({
              _id: b?._id || b?.id,
              id: idString(b?._id || b?.id),
              branchId: idString(b?._id || b?.id),
              name: b?.name || b?.branchName || "Branch",
              branchName: b?.name || b?.branchName || "Branch",
              academyId: getAcademyIdFromDoc(b),
            }))
          : undefined,
      })),
    );
  }),
);

router.get(
  "/academies/:id",
  wrap(async (req, res) => {
    const Academy = M("Academy");
    if (!Academy) {
      return res.status(500).json({ message: "Academy model not found" });
    }

    const id = objectId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid academy id" });
    }

    const academy = await Academy.findById(id)
      .lean()
      .catch(() => null);
    if (!academy) {
      return res.status(404).json({ message: "Academy not found" });
    }

    const Branch = M("Branch");
    const branches = Branch
      ? await Branch.find({
          $or: [{ academyId: id }, { academyId: String(id) }],
        })
          .lean()
          .catch(() => [])
      : [];

    return res.json(
      toAcademyResponse(
        {
          ...academy,
          branches,
        },
        true,
      ),
    );
  }),
);

router.post(
  "/academies",
  wrap(async (req, res) => {
    const Academy = M("Academy");
    if (!Academy) {
      return res.status(500).json({ message: "Academy model not found" });
    }

    const payload = normalizeAcademyPayload(req.body || {});

    if (!payload.name) {
      return res.status(400).json({ message: "Academy name is required" });
    }

    if (!payload.code) {
      return res.status(400).json({ message: "Academy code is required" });
    }

    const existing = await Academy.findOne({
      $or: [{ code: payload.code }, { academyCode: payload.code }],
    })
      .select("_id code academyCode")
      .lean()
      .catch(() => null);

    if (existing) {
      return res.status(409).json({ message: "Academy code already exists" });
    }

    const doc = new Academy(payload);
    await doc.save();

    const saved = await Academy.findById(doc._id)
      .lean()
      .catch(() => doc.toObject?.() || doc);

    return res.status(201).json(toAcademyResponse(saved));
  }),
);

router.put(
  "/academies/:id",
  wrap(async (req, res) => {
    const Academy = M("Academy");
    if (!Academy) {
      return res.status(500).json({ message: "Academy model not found" });
    }

    const id = objectId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid academy id" });
    }

    const payload = normalizeAcademyPayload(req.body || {});
    if (!payload.name) {
      return res.status(400).json({ message: "Academy name is required" });
    }

    if (!payload.code) {
      return res.status(400).json({ message: "Academy code is required" });
    }

    const duplicate = await Academy.findOne({
      _id: { $ne: id },
      $or: [{ code: payload.code }, { academyCode: payload.code }],
    })
      .select("_id code academyCode")
      .lean()
      .catch(() => null);

    if (duplicate) {
      return res.status(409).json({ message: "Academy code already exists" });
    }

    const updated = await Academy.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true, runValidators: true },
    )
      .lean()
      .catch(() => null);

    if (!updated) {
      return res.status(404).json({ message: "Academy not found" });
    }

    return res.json(toAcademyResponse(updated));
  }),
);

router.delete(
  "/academies/:id",
  wrap(async (req, res) => {
    const id = objectId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid academy id" });
    }

    const result = await deleteAcademyCascade(id);

    if (!result.ok) {
      return res.status(result.status || 500).json({
        message: result.message || "Failed to delete academy",
      });
    }

    emitAcademyDeleted(req, result.academyId);

    return res.json(result);
  }),
);

router.patch(
  "/users/:userId/assign-academy",
  wrap(async (req, res) => {
    const userId = objectId(req.params.userId);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const rawAcademyId = req.body?.academyId;

    let academyDoc = null;
    let academyObjectId = null;

    if (
      rawAcademyId !== null &&
      rawAcademyId !== undefined &&
      rawAcademyId !== ""
    ) {
      academyObjectId = objectId(rawAcademyId);
      if (!academyObjectId) {
        return res.status(400).json({ message: "Invalid academy id" });
      }

      academyDoc = await Academy.findById(academyObjectId).lean();
      if (!academyDoc) {
        return res.status(404).json({ message: "Academy not found" });
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (String(user.role || "").toUpperCase() !== "SUPER_ADMIN") {
      return res.status(400).json({
        message:
          "Only SUPER_ADMIN can be assigned to an academy from this route",
      });
    }

    user.academyId = academyObjectId || null;
    await user.save();

    const updated = await User.findById(user._id)
      .populate(
        "academyId",
        "name academyName code academyCode logo logoUrl academyLogo",
      )
      .lean();

    return res.json({
      ok: true,
      message: academyObjectId
        ? "Super admin assigned to academy successfully"
        : "Super admin academy assignment removed successfully",
      item: {
        _id: updated._id,
        id: idString(updated._id),
        name: updated.name || "",
        email: updated.email || "",
        role: updated.role || "",
        academyId: updated.academyId
          ? {
              _id: updated.academyId._id,
              id: idString(updated.academyId._id),
              name:
                updated.academyId.name || updated.academyId.academyName || "",
              academyName:
                updated.academyId.name || updated.academyId.academyName || "",
              code:
                updated.academyId.code || updated.academyId.academyCode || "",
              academyCode:
                updated.academyId.code || updated.academyId.academyCode || "",
              logo:
                updated.academyId.logo ||
                updated.academyId.logoUrl ||
                updated.academyId.academyLogo ||
                "",
              logoUrl:
                updated.academyId.logoUrl ||
                updated.academyId.logo ||
                updated.academyId.academyLogo ||
                "",
              academyLogo:
                updated.academyId.academyLogo ||
                updated.academyId.logoUrl ||
                updated.academyId.logo ||
                "",
            }
          : null,
        updatedAt: updated.updatedAt,
      },
    });
  }),
);

/* =========================
   Dashboard summary
========================= */

router.get(
  "/dashboard/summary",
  wrap(async (req, res) => {
    const academyId = safeStr(req.query.academyId || "all");
    const branchId = safeStr(req.query.branchId || "all");
    const { key: rangeKey, start, end } = normalizeRange(req.query.range);

    const [
      academies,
      branches,
      participants,
      users,
      events,
      certificates,
      alerts,
    ] = await Promise.all([
      loadAcademiesWithBranches(),
      loadBranchRows(academyId, branchId),
      loadParticipantsScoped(academyId, branchId),
      loadUsersScoped(academyId, branchId),
      loadEventsScoped(academyId, branchId),
      loadCertificatesScoped(academyId, branchId),
      loadAlertsScoped(academyId, branchId),
    ]);

    const finance = await loadFinanceScoped(academyId, branchId);

    const paymentsInRange = finance.payments.filter((d) =>
      withinRange(d, start, end),
    );
    const participantsInRange = participants.filter((d) =>
      withinRange(d, start, end),
    );

    const monthlyRevenue = paymentsInRange
      .filter((d) => isPaidDoc(d))
      .reduce((sum, d) => sum + extractAmount(d), 0);

    const pendingFees = [...finance.invoices, ...finance.fees]
      .filter((d) => isPendingDoc(d))
      .reduce((sum, d) => sum + extractAmount(d), 0);

    const activeEvents = events.filter((e) => {
      const s = getStatus(e);
      return e?.isActive === true || ["ACTIVE", "LIVE", "OPEN"].includes(s);
    }).length;

    const openAlerts = alerts.filter((a) => {
      const s = getStatus(a);
      return !s || ["OPEN", "ACTIVE", "PENDING"].includes(s);
    }).length;

    const coachCount = users.filter((u) => getUserRole(u) === "COACH").length;

    const pendingParticipantApprovals = participants.filter((p) => {
      const approved = getBooleanApproval(p);
      const status = getStatus(p);
      return approved === false || ["PENDING", "REVIEW"].includes(status);
    }).length;

    const pendingCoachApprovals = users.filter((u) => {
      if (getUserRole(u) !== "COACH") return false;
      const approved = getBooleanApproval(u);
      const status = getStatus(u);
      return approved === false || ["PENDING", "REVIEW"].includes(status);
    }).length;

    const pendingEventApprovals = events.filter((e) => {
      const approved = getBooleanApproval(e);
      const status = getStatus(e);
      return (
        approved === false || ["DRAFT", "PENDING", "REVIEW"].includes(status)
      );
    }).length;

    const pendingCertificateApprovals = certificates.filter((c) => {
      const approved = getBooleanApproval(c);
      const status = getStatus(c);
      return (
        approved === false || ["PENDING", "DRAFT", "REVIEW"].includes(status)
      );
    }).length;

    const previousStart =
      rangeKey === "12m"
        ? new Date(start.getFullYear() - 1, start.getMonth(), start.getDate())
        : new Date(start.getTime() - (end.getTime() - start.getTime()));

    const prevParticipants = participants.filter((p) => {
      const d = getCreatedAt(p);
      return d && d >= previousStart && d < start;
    }).length;

    const prevBranches = branches.filter((b) => {
      const d = getCreatedAt(b);
      return d && d >= previousStart && d < start;
    }).length;

    const prevPayments = finance.payments.filter((p) => {
      const d = getCreatedAt(p);
      return d && d >= previousStart && d < start && isPaidDoc(p);
    });

    const prevRevenue = prevPayments.reduce(
      (sum, d) => sum + extractAmount(d),
      0,
    );

    const prevCertificatesIssued = certificates.filter((c) => {
      const d = getCreatedAt(c);
      return d && d >= previousStart && d < start;
    }).length;

    function pct(current, prev) {
      if (!prev && !current) return 0;
      if (!prev) return 100;
      return Math.round(((current - prev) / prev) * 100);
    }

    return res.json({
      totalAcademies: academies.length,
      activeAcademies: academies.length,
      totalBranches: branches.length,
      branches: branches.length,
      totalParticipants: participants.length,
      participants: participants.length,
      coachCount,
      activeEvents,
      openAlerts,
      monthlyRevenue,
      pendingFees,
      pendingApprovals:
        pendingParticipantApprovals +
        pendingCoachApprovals +
        pendingEventApprovals +
        pendingCertificateApprovals,
      certificatesIssued: certificates.length,
      pendingParticipantApprovals,
      pendingCoachApprovals,
      pendingEventApprovals,
      pendingCertificateApprovals,
      branchTrend: pct(branches.length, prevBranches),
      participantTrend: pct(participantsInRange.length, prevParticipants),
      revenueTrend: pct(monthlyRevenue, prevRevenue),
      monthlyRevenueTrend: pct(monthlyRevenue, prevRevenue),
      certificatesTrend: pct(certificates.length, prevCertificatesIssued),
    });
  }),
);

/* =========================
   Branch analytics
========================= */

router.get(
  "/branches/analytics",
  wrap(async (req, res) => {
    const academyId = safeStr(req.query.academyId || "all");
    const branchId = safeStr(req.query.branchId || "all");
    const { start, end } = normalizeRange(req.query.range);

    const [branches, participants, events, attendance, alerts] =
      await Promise.all([
        loadBranchRows(academyId, branchId),
        loadParticipantsScoped(academyId, branchId),
        loadEventsScoped(academyId, branchId),
        loadAttendanceScoped(academyId, branchId),
        loadAlertsScoped(academyId, branchId),
      ]);

    const finance = await loadFinanceScoped(academyId, branchId);

    const rows = branches.map((b) => {
      const bId = String(b.id);

      const participantsCount = participants.filter(
        (p) => getBranchIdFromDoc(p) === bId,
      ).length;

      const revenue = finance.payments
        .filter(
          (p) =>
            getBranchIdFromDoc(p) === bId &&
            isPaidDoc(p) &&
            withinRange(p, start, end),
        )
        .reduce((sum, p) => sum + extractAmount(p), 0);

      const pendingFees = [...finance.invoices, ...finance.fees]
        .filter((d) => getBranchIdFromDoc(d) === bId && isPendingDoc(d))
        .reduce((sum, d) => sum + extractAmount(d), 0);

      const branchAttendance = attendance.filter(
        (a) => getBranchIdFromDoc(a) === bId,
      );

      const presentCount = branchAttendance.filter((a) => {
        const s = getStatus(a);
        return (
          ["PRESENT", "ATTENDED", "DONE", "MARKED"].includes(s) ||
          a?.present === true
        );
      }).length;

      const attendanceRate = branchAttendance.length
        ? Math.round((presentCount / branchAttendance.length) * 100)
        : 0;

      const activeEvents = events.filter((e) => {
        if (getBranchIdFromDoc(e) !== bId) return false;
        const s = getStatus(e);
        return e?.isActive === true || ["ACTIVE", "LIVE", "OPEN"].includes(s);
      }).length;

      const approvals = alerts.filter((a) => {
        if (getBranchIdFromDoc(a) !== bId) return false;
        const s = getStatus(a);
        return ["PENDING", "OPEN", "REVIEW"].includes(s);
      }).length;

      return {
        _id: b._id,
        id: b.id,
        branchId: b.id,
        name: b.name,
        branchName: b.name,
        academyId: b.academyId,
        academyName: b.academyName,
        participants: participantsCount,
        participantCount: participantsCount,
        revenue,
        collected: revenue,
        pendingFees,
        pending: pendingFees,
        attendanceRate,
        attendance: attendanceRate,
        activeEvents,
        pendingApprovals: approvals,
        approvals,
      };
    });

    res.json(rows.sort((a, b) => b.participants - a.participants));
  }),
);

/* =========================
   Finance summary
========================= */

router.get(
  "/finance/summary",
  wrap(async (req, res) => {
    const academyId = safeStr(req.query.academyId || "all");
    const branchId = safeStr(req.query.branchId || "all");
    const { key: rangeKey, start, end } = normalizeRange(req.query.range);

    const branches = await loadBranchRows(academyId, branchId);
    const finance = await loadFinanceScoped(academyId, branchId);

    const paymentsInRange = finance.payments.filter((p) =>
      withinRange(p, start, end),
    );
    const paidPayments = paymentsInRange.filter((p) => isPaidDoc(p));
    const collectedThisMonth = paidPayments.reduce(
      (sum, p) => sum + extractAmount(p),
      0,
    );

    const pendingDocs = [...finance.invoices, ...finance.fees].filter((d) =>
      isPendingDoc(d),
    );
    const pendingFees = pendingDocs.reduce(
      (sum, d) => sum + extractAmount(d),
      0,
    );

    const overdueDocs = pendingDocs.filter((d) => isOverdueDoc(d));
    const overdueFees = overdueDocs.reduce(
      (sum, d) => sum + extractAmount(d),
      0,
    );

    const paidRatioBase = collectedThisMonth + pendingFees;
    const paidRatio = paidRatioBase
      ? Math.round((collectedThisMonth / paidRatioBase) * 100)
      : 0;

    const trend = createTrendFromDocs(
      paidPayments,
      rangeKey,
      start,
      end,
      (doc) => extractAmount(doc),
    );

    const topBranches = branches
      .map((b) => {
        const bId = String(b.id);
        const value = paidPayments
          .filter((p) => getBranchIdFromDoc(p) === bId)
          .reduce((sum, p) => sum + extractAmount(p), 0);

        return {
          label: b.name,
          value,
          branchId: bId,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    res.json({
      collectedThisMonth,
      pendingFees,
      overdueFees,
      overdueCount: overdueDocs.length,
      paidRatio,
      collectionTrend:
        trend.length >= 2
          ? Math.round(
              (((trend.at(-1)?.value || 0) - (trend.at(-2)?.value || 0)) /
                Math.max(1, trend.at(-2)?.value || 0)) *
                100,
            )
          : 0,
      pendingTrend: 0,
      trend,
      revenueTrend: trend,
      topBranches,
      branchComparison: topBranches,
    });
  }),
);

/* =========================
   Attendance summary
========================= */

router.get(
  "/attendance/summary",
  wrap(async (req, res) => {
    const academyId = safeStr(req.query.academyId || "all");
    const branchId = safeStr(req.query.branchId || "all");

    const attendance = await loadAttendanceScoped(academyId, branchId);
    const today = dateOnly(new Date());

    const todayRows = attendance.filter((a) => {
      const d = getCreatedAt(a);
      return d && dateOnly(d)?.getTime() === today.getTime();
    });

    const markedSessions = todayRows.filter((a) => {
      const s = getStatus(a);
      return (
        ["PRESENT", "ABSENT", "LATE", "DONE", "MARKED"].includes(s) ||
        a?.marked === true
      );
    }).length;

    const presentOrDone = todayRows.filter((a) => {
      const s = getStatus(a);
      return (
        ["PRESENT", "DONE", "ATTENDED", "MARKED"].includes(s) ||
        a?.present === true
      );
    }).length;

    const lateMarked = todayRows.filter((a) => {
      const s = getStatus(a);
      return s === "LATE" || a?.late === true;
    }).length;

    const pendingSessions = todayRows.filter((a) => {
      const s = getStatus(a);
      return !s || ["PENDING", "OPEN"].includes(s);
    }).length;

    const todayRate = todayRows.length
      ? Math.round((presentOrDone / todayRows.length) * 100)
      : 0;

    res.json({
      todayRate,
      rate: todayRate,
      markedSessions,
      lateMarked,
      pendingSessions,
      totalToday: todayRows.length,
    });
  }),
);

/* =========================
   Pending approvals
========================= */

router.get(
  "/approvals/pending",
  wrap(async (req, res) => {
    const academyId = safeStr(req.query.academyId || "all");
    const branchId = safeStr(req.query.branchId || "all");

    const [participants, users, events, certificates] = await Promise.all([
      loadParticipantsScoped(academyId, branchId),
      loadUsersScoped(academyId, branchId),
      loadEventsScoped(academyId, branchId),
      loadCertificatesScoped(academyId, branchId),
    ]);

    const items = [];

    const participantCount = participants.filter((p) => {
      const approved = getBooleanApproval(p);
      const status = getStatus(p);
      return approved === false || ["PENDING", "REVIEW"].includes(status);
    }).length;
    if (participantCount > 0) {
      items.push({
        type: "participants",
        label: "participants",
        count: participantCount,
      });
    }

    const coachCount = users.filter((u) => {
      if (getUserRole(u) !== "COACH") return false;
      const approved = getBooleanApproval(u);
      const status = getStatus(u);
      return approved === false || ["PENDING", "REVIEW"].includes(status);
    }).length;
    if (coachCount > 0) {
      items.push({ type: "coaches", label: "coaches", count: coachCount });
    }

    const eventCount = events.filter((e) => {
      const approved = getBooleanApproval(e);
      const status = getStatus(e);
      return (
        approved === false || ["PENDING", "REVIEW", "DRAFT"].includes(status)
      );
    }).length;
    if (eventCount > 0) {
      items.push({ type: "events", label: "events", count: eventCount });
    }

    const certCount = certificates.filter((c) => {
      const approved = getBooleanApproval(c);
      const status = getStatus(c);
      return (
        approved === false || ["PENDING", "REVIEW", "DRAFT"].includes(status)
      );
    }).length;
    if (certCount > 0) {
      items.push({
        type: "certificates",
        label: "certificates",
        count: certCount,
      });
    }

    res.json(items);
  }),
);

/* =========================
   Coaches performance
========================= */

router.get(
  "/coaches/performance",
  wrap(async (req, res) => {
    const academyId = safeStr(req.query.academyId || "all");
    const branchId = safeStr(req.query.branchId || "all");

    const [users, attendance, scores] = await Promise.all([
      loadUsersScoped(academyId, branchId),
      loadAttendanceScoped(academyId, branchId),
      loadScoresScoped(academyId, branchId),
    ]);

    const coaches = users.filter((u) => getUserRole(u) === "COACH");

    const rows = coaches.map((coach) => {
      const coachId = idString(coach?._id || coach?.id);

      const coachAttendance = attendance.filter((a) => {
        const linkedCoachId = resolveIdFromDoc(a, [
          "coachId",
          "coach",
          "userId",
          "staffId",
        ]);
        return linkedCoachId === coachId;
      });

      const coachScores = scores.filter((s) => {
        const linkedCoachId = resolveIdFromDoc(s, [
          "coachId",
          "coach",
          "userId",
        ]);
        return linkedCoachId === coachId;
      });

      const markedRate = coachAttendance.length
        ? Math.round(
            (coachAttendance.filter((a) => {
              const st = getStatus(a);
              return (
                ["PRESENT", "ABSENT", "LATE", "DONE", "MARKED"].includes(st) ||
                a?.marked === true
              );
            }).length /
              coachAttendance.length) *
              100,
          )
        : 0;

      const avgScore = coachScores.length
        ? coachScores.reduce(
            (sum, s) =>
              sum + safeNum(pick(s, ["score", "total", "value"], 0), 0),
            0,
          ) / coachScores.length
        : 0;

      const assignedGroups = safeNum(
        pick(coach, ["assignedGroups", "groupCount", "groupsAssigned"], 0),
        0,
      );

      const disciplinePenalty =
        coachAttendance.filter((a) => {
          const st = getStatus(a);
          return st === "LATE" || a?.late === true;
        }).length * 2;

      const performanceScore = clamp(
        Math.round(
          markedRate * 0.55 +
            avgScore * 4 +
            assignedGroups * 3 -
            disciplinePenalty,
        ),
        0,
        100,
      );

      return {
        _id: coach?._id || coach?.id,
        id: coachId,
        name: coach?.name || coach?.fullName || coach?.username || "Coach",
        coachName: coach?.name || coach?.fullName || coach?.username || "Coach",
        branchName: resolveNameFromDoc(coach, ["branchName", "branch"]),
        assignedGroups,
        attendanceQuality: markedRate,
        scoreConsistency: Math.round(avgScore * 10) / 10,
        performanceScore,
      };
    });

    res.json(rows.sort((a, b) => b.performanceScore - a.performanceScore));
  }),
);

/* =========================
   Enrollment trend
========================= */

router.get(
  "/events/enrollment-trend",
  wrap(async (req, res) => {
    const academyId = safeStr(req.query.academyId || "all");
    const branchId = safeStr(req.query.branchId || "all");
    const { key: rangeKey, start, end } = normalizeRange(req.query.range);

    const EventEnrollment = M("EventEnrollment");
    let docs = await findDocs(EventEnrollment, {}, null, {
      sort: { createdAt: 1 },
    });

    if (!docs.length) {
      const participants = await loadParticipantsScoped(academyId, branchId);
      docs = participants;
    } else {
      docs = docs.filter((d) => matchesScope(d, academyId, branchId));
    }

    docs = docs.filter((d) => withinRange(d, start, end));

    const trend = createTrendFromDocs(docs, rangeKey, start, end, () => 1);

    res.json(trend);
  }),
);

/* =========================
   Certificate stats
========================= */

router.get(
  "/certificates/stats",
  wrap(async (req, res) => {
    const academyId = safeStr(req.query.academyId || "all");
    const branchId = safeStr(req.query.branchId || "all");

    const certificates = await loadCertificatesScoped(academyId, branchId);

    const issued = certificates.length;

    const verified = certificates.filter((c) => {
      const checks = safeNum(
        pick(c, ["verifiedCount", "verifyCount", "views"], 0),
        0,
      );
      const status = getStatus(c);
      return checks > 0 || ["VERIFIED", "VALID"].includes(status);
    }).length;

    const invalidAttempts = certificates.reduce(
      (sum, c) =>
        sum + safeNum(pick(c, ["invalidAttempts", "failedChecks"], 0), 0),
      0,
    );

    const today = dateOnly(new Date());

    const todayChecks = certificates.reduce((sum, c) => {
      const verifiedAt = pick(c, ["verifiedAt", "lastVerifiedAt"]);
      if (!verifiedAt) return sum;
      const d = dateOnly(new Date(verifiedAt));
      if (!d || d.getTime() !== today.getTime()) return sum;
      return sum + 1;
    }, 0);

    const failedGenerations = certificates.filter((c) => {
      const st = getStatus(c);
      return ["FAILED", "ERROR"].includes(st);
    }).length;

    const byEvent = new Map();

    for (const c of certificates) {
      const label =
        resolveNameFromDoc(c, ["eventName", "event", "title"]) || "General";
      if (!byEvent.has(label)) byEvent.set(label, 0);
      byEvent.set(label, byEvent.get(label) + 1);
    }

    const topEvents = [...byEvent.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    res.json({
      issued,
      verified,
      invalidAttempts,
      todayChecks,
      failedGenerations,
      issuedTrend: 0,
      topEvents,
    });
  }),
);

/* =========================
   Live leaderboard preview
========================= */

router.get(
  "/leaderboard/live-preview",
  wrap(async (req, res) => {
    const academyId = safeStr(req.query.academyId || "all");
    const branchId = safeStr(req.query.branchId || "all");

    const [events, scores, participants] = await Promise.all([
      loadEventsScoped(academyId, branchId),
      loadScoresScoped(academyId, branchId),
      loadParticipantsScoped(academyId, branchId),
    ]);

    const activeEvent =
      events.find((e) => {
        const s = getStatus(e);
        return e?.isActive === true || ["LIVE", "ACTIVE", "OPEN"].includes(s);
      }) ||
      events[0] ||
      null;

    let filteredScores = scores;

    if (activeEvent?._id) {
      const eventId = idString(activeEvent._id);
      const maybeEventLinked = scores.filter((s) => {
        const sid = resolveIdFromDoc(s, ["eventId", "event", "eventRef"]);
        return sid === eventId;
      });
      if (maybeEventLinked.length) filteredScores = maybeEventLinked;
    }

    const participantMap = new Map(
      participants.map((p) => [idString(p?._id || p?.id), p]),
    );

    const totalsMap = new Map();

    for (const s of filteredScores) {
      const participantId = resolveIdFromDoc(s, [
        "participantId",
        "participant",
        "userId",
      ]);
      if (!participantId) continue;

      const scoreValue = safeNum(pick(s, ["total", "score", "value"], 0), 0);

      if (!totalsMap.has(participantId)) totalsMap.set(participantId, 0);
      totalsMap.set(participantId, totalsMap.get(participantId) + scoreValue);
    }

    const rows = [...totalsMap.entries()]
      .map(([participantId, total]) => {
        const p = participantMap.get(participantId) || {};
        return {
          participantId,
          _id: participantId,
          id: participantId,
          name: p?.name || p?.participantName || "Participant",
          participantName: p?.name || p?.participantName || "Participant",
          branchName: p?.branchName || resolveNameFromDoc(p, ["branch"]) || "",
          total,
          score: total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));

    res.json({
      eventId: activeEvent?._id || null,
      eventName:
        activeEvent?.name || activeEvent?.title || activeEvent?.eventName || "",
      branchName:
        activeEvent?.branchName ||
        resolveNameFromDoc(activeEvent || {}, ["branch"]) ||
        "",
      participantCount: rows.length,
      updatedAt: new Date(),
      rows,
      participants: rows,
    });
  }),
);

/* =========================
   Route-level error handler
========================= */

router.use((err, _req, res, _next) => {
  return res.status(500).json({
    message: normalizeMsg(err, "Server error"),
  });
});

export default router;
