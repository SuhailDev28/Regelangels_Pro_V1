import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import EmailLog from "../models/EmailLog.js";

const router = express.Router();

router.use(auth, requireRole("SUPER_ADMIN", "ADMIN"));

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function getScopedAcademyId(req) {
  if (req.user?.role === "SUPER_ADMIN") {
    const fromHeader = req.get("x-academy-id");
    const fromQuery = req.query?.academyId;
    const fromBody = req.body?.academyId;
    const candidate =
      fromHeader ||
      fromQuery ||
      fromBody ||
      req.academyId ||
      req.user?.academyId ||
      "";
    return isValidObjectId(candidate) ? String(candidate) : null;
  }

  const candidate = req.academyId || req.user?.academyId || "";
  return isValidObjectId(candidate) ? String(candidate) : null;
}

function buildBaseQuery(req) {
  const query = {};
  const scopedAcademyId = getScopedAcademyId(req);

  if (req.user?.role !== "SUPER_ADMIN") {
    if (scopedAcademyId) query.academyId = scopedAcademyId;
  } else if (scopedAcademyId) {
    query.academyId = scopedAcademyId;
  }

  return query;
}

function buildSearchClause(searchValue) {
  const value = String(searchValue || "").trim();
  if (!value) return null;

  return {
    $or: [
      { subject: { $regex: value, $options: "i" } },
      { template: { $regex: value, $options: "i" } },
      { templateName: { $regex: value, $options: "i" } },
      { templateKey: { $regex: value, $options: "i" } },
      { to: { $regex: value, $options: "i" } },
      { cc: { $regex: value, $options: "i" } },
      { bcc: { $regex: value, $options: "i" } },
      { errorMessage: { $regex: value, $options: "i" } },
      { provider: { $regex: value, $options: "i" } },
    ],
  };
}

router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = "",
      template = "",
      search = "",
      q = "",
    } = req.query || {};

    const query = buildBaseQuery(req);
    const searchValue = String(search || q || "").trim();

    if (status) {
      query.status = String(status).trim().toUpperCase();
    }

    if (template) {
      query.template = String(template).trim();
    }

    const searchClause = buildSearchClause(searchValue);
    if (searchClause) {
      Object.assign(query, searchClause);
    }

    const pageNum = Math.max(1, Number(page || 1));
    const limitNum = Math.min(100, Math.max(1, Number(limit || 20)));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      EmailLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      EmailLog.countDocuments(query),
    ]);

    return res.json({
      ok: true,
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("GET email logs error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to load email logs",
    });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const baseQuery = buildBaseQuery(req);

    const [total, grouped] = await Promise.all([
      EmailLog.countDocuments(baseQuery),
      EmailLog.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: { $toUpper: { $ifNull: ["$status", "UNKNOWN"] } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats = {
      total,
      sent: 0,
      failed: 0,
      queued: 0,
      pending: 0,
      skipped: 0,
    };

    for (const row of grouped || []) {
      const key = String(row?._id || "").toUpperCase();
      const count = Number(row?.count || 0);

      if (key === "SENT" || key === "SUCCESS" || key === "DELIVERED") {
        stats.sent += count;
      } else if (key === "FAILED" || key === "ERROR") {
        stats.failed += count;
      } else if (key === "QUEUED") {
        stats.queued += count;
      } else if (key === "PENDING") {
        stats.pending += count;
      } else if (key === "SKIPPED") {
        stats.skipped += count;
      }
    }

    return res.json({
      ok: true,
      stats,
    });
  } catch (error) {
    console.error("GET email logs summary error:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to load email log summary",
    });
  }
});

export default router;
