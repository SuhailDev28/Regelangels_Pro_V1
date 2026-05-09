import express from "express";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import EmailTemplate from "../models/EmailTemplate.js";

const router = express.Router();

function isValidObjectIdLike(v) {
  return /^[a-f\d]{24}$/i.test(String(v || "").trim());
}

function normalizeCategory(value = "") {
  const v = String(value || "")
    .trim()
    .toUpperCase();

  const allowed = new Set([
    "GENERAL",
    "ANNOUNCEMENT",
    "PAYMENT",
    "EVENT",
    "REGISTRATION",
    "RESULT",
    "CERTIFICATE",
    "REMINDER",
  ]);

  return allowed.has(v) ? v : "GENERAL";
}

function normalizeVariables(value) {
  if (!value) return [];

  const arr = Array.isArray(value) ? value : [value];

  return [
    ...new Set(
      arr
        .flatMap((item) =>
          String(item || "")
            .split(",")
            .map((v) => v.trim()),
        )
        .filter(Boolean),
    ),
  ];
}

function buildTemplateKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function getScopedAcademyId(req) {
  const bodyId = req?.body?.academyId;
  const queryId = req?.query?.academyId;
  const headerId = req?.headers?.["x-academy-id"];

  if (String(req?.user?.role || "").toUpperCase() === "SUPER_ADMIN") {
    const picked = String(bodyId || queryId || headerId || "").trim();
    return picked || null;
  }

  return String(req?.academyId || req?.user?.academyId || "").trim() || null;
}

function buildAccessQuery(req, extra = {}) {
  const role = String(req?.user?.role || "").toUpperCase();
  const academyId = getScopedAcademyId(req);

  if (role === "SUPER_ADMIN") {
    if (academyId && isValidObjectIdLike(academyId)) {
      return {
        ...extra,
        $or: [
          { academyId: new mongoose.Types.ObjectId(academyId) },
          { academyId: null, isSystem: true },
        ],
      };
    }

    return { ...extra };
  }

  if (academyId && isValidObjectIdLike(academyId)) {
    return {
      ...extra,
      $or: [
        { academyId: new mongoose.Types.ObjectId(academyId) },
        { academyId: null, isSystem: true },
      ],
    };
  }

  return {
    ...extra,
    academyId: null,
    isSystem: true,
  };
}

function buildMutationAcademyId(req) {
  const academyId = getScopedAcademyId(req);

  if (!academyId) return null;

  if (!isValidObjectIdLike(academyId)) {
    const err = new Error("Invalid academyId");
    err.status = 400;
    throw err;
  }

  return new mongoose.Types.ObjectId(academyId);
}

async function populateTemplateById(id) {
  return await EmailTemplate.findById(id)
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .lean();
}

/**
 * GET /api/email/templates
 * Query:
 * - q
 * - category
 * - isActive
 * - academyId (super admin optional)
 */
router.get("/", auth, requireRole("SUPER_ADMIN", "ADMIN"), async (req, res) => {
  try {
    const { q = "", category = "", isActive } = req.query || {};
    const baseQuery = buildAccessQuery(req);

    const and = [];

    if (String(q || "").trim()) {
      const rx = new RegExp(String(q).trim(), "i");
      and.push({
        $or: [
          { name: rx },
          { key: rx },
          { subject: rx },
          { description: rx },
          { category: rx },
        ],
      });
    }

    if (String(category || "").trim()) {
      and.push({ category: normalizeCategory(category) });
    }

    if (String(isActive || "").trim() !== "") {
      and.push({
        isActive: ["true", "1", "yes", "on"].includes(
          String(isActive).trim().toLowerCase(),
        ),
      });
    }

    const finalQuery = and.length ? { ...baseQuery, $and: and } : baseQuery;

    const templates = await EmailTemplate.find(finalQuery)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .sort({ isSystem: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    return res.json({
      ok: true,
      items: templates,
    });
  } catch (error) {
    console.error("GET /email/templates error:", error);
    return res.status(error?.status || 500).json({
      ok: false,
      message: error?.message || "Failed to load email templates",
    });
  }
});

/**
 * GET /api/email/templates/:id
 */
router.get(
  "/:id",
  auth,
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectIdLike(id)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid template id",
        });
      }

      const template = await EmailTemplate.findOne({
        $and: [{ _id: id }, buildAccessQuery(req)],
      })
        .populate("createdBy", "name email role")
        .populate("updatedBy", "name email role")
        .lean();

      if (!template) {
        return res.status(404).json({
          ok: false,
          message: "Email template not found",
        });
      }

      return res.json({
        ok: true,
        item: template,
      });
    } catch (error) {
      console.error("GET /email/templates/:id error:", error);
      return res.status(error?.status || 500).json({
        ok: false,
        message: error?.message || "Failed to load email template",
      });
    }
  },
);

/**
 * POST /api/email/templates
 */
router.post(
  "/",
  auth,
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const role = String(req?.user?.role || "").toUpperCase();
      const academyObjectId = buildMutationAcademyId(req);

      const {
        name = "",
        key = "",
        category = "GENERAL",
        subject = "",
        html = "",
        text = "",
        variables = [],
        description = "",
        isActive = true,
        isSystem = false,
        meta = {},
      } = req.body || {};

      const cleanName = String(name || "").trim();
      const cleanKey = buildTemplateKey(key || cleanName);
      const cleanSubject = String(subject || "").trim();

      if (!cleanName) {
        return res.status(400).json({
          ok: false,
          message: "Template name is required",
        });
      }

      if (!cleanKey) {
        return res.status(400).json({
          ok: false,
          message: "Template key is required",
        });
      }

      if (!cleanSubject) {
        return res.status(400).json({
          ok: false,
          message: "Template subject is required",
        });
      }

      if (role !== "SUPER_ADMIN" && !academyObjectId) {
        return res.status(400).json({
          ok: false,
          message: "Academy context is required",
        });
      }

      if (role !== "SUPER_ADMIN" && isSystem) {
        return res.status(403).json({
          ok: false,
          message: "Only super admin can create system templates",
        });
      }

      const targetAcademyId =
        role === "SUPER_ADMIN" && isSystem ? null : academyObjectId;

      const duplicate = await EmailTemplate.findOne({
        academyId: targetAcademyId,
        key: cleanKey,
      }).lean();

      if (duplicate) {
        return res.status(409).json({
          ok: false,
          message: "Template key already exists",
        });
      }

      const doc = await EmailTemplate.create({
        academyId: targetAcademyId,
        name: cleanName,
        key: cleanKey,
        category: normalizeCategory(category),
        subject: cleanSubject,
        html: String(html || ""),
        text: String(text || ""),
        variables: normalizeVariables(variables),
        description: String(description || "").trim(),
        isActive: !!isActive,
        isSystem: role === "SUPER_ADMIN" ? !!isSystem : false,
        createdBy: req.user?._id || null,
        updatedBy: req.user?._id || null,
        meta: meta && typeof meta === "object" ? meta : {},
      });

      const saved = await populateTemplateById(doc._id);

      return res.status(201).json({
        ok: true,
        message: "Email template created successfully",
        item: saved,
      });
    } catch (error) {
      console.error("POST /email/templates error:", error);

      if (error?.code === 11000) {
        return res.status(409).json({
          ok: false,
          message: "Template key already exists",
        });
      }

      return res.status(error?.status || 500).json({
        ok: false,
        message: error?.message || "Failed to create email template",
      });
    }
  },
);

/**
 * PUT /api/email/templates/:id
 */
router.put(
  "/:id",
  auth,
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const role = String(req?.user?.role || "").toUpperCase();
      const { id } = req.params;

      if (!isValidObjectIdLike(id)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid template id",
        });
      }

      const existing = await EmailTemplate.findOne({
        $and: [{ _id: id }, buildAccessQuery(req)],
      });

      if (!existing) {
        return res.status(404).json({
          ok: false,
          message: "Email template not found",
        });
      }

      if (existing.isSystem && role !== "SUPER_ADMIN") {
        return res.status(403).json({
          ok: false,
          message: "Only super admin can modify system templates",
        });
      }

      const {
        name,
        key,
        category,
        subject,
        html,
        text,
        variables,
        description,
        isActive,
        isSystem,
        meta,
      } = req.body || {};

      const nextName =
        name !== undefined ? String(name || "").trim() : existing.name;
      const nextKey =
        key !== undefined ? buildTemplateKey(key || nextName) : existing.key;
      const nextSubject =
        subject !== undefined ? String(subject || "").trim() : existing.subject;

      if (!nextName) {
        return res.status(400).json({
          ok: false,
          message: "Template name is required",
        });
      }

      if (!nextKey) {
        return res.status(400).json({
          ok: false,
          message: "Template key is required",
        });
      }

      if (!nextSubject) {
        return res.status(400).json({
          ok: false,
          message: "Template subject is required",
        });
      }

      let nextAcademyId = existing.academyId || null;
      let nextIsSystem = existing.isSystem;

      if (role === "SUPER_ADMIN" && isSystem !== undefined) {
        nextIsSystem = !!isSystem;
        if (nextIsSystem) {
          nextAcademyId = null;
        }
      }

      const duplicate = await EmailTemplate.findOne({
        _id: { $ne: existing._id },
        academyId: nextAcademyId,
        key: nextKey,
      }).lean();

      if (duplicate) {
        return res.status(409).json({
          ok: false,
          message: "Template key already exists",
        });
      }

      existing.name = nextName;
      existing.key = nextKey;
      existing.category =
        category !== undefined
          ? normalizeCategory(category)
          : existing.category;
      existing.subject = nextSubject;

      if (html !== undefined) existing.html = String(html || "");
      if (text !== undefined) existing.text = String(text || "");
      if (variables !== undefined) {
        existing.variables = normalizeVariables(variables);
      }
      if (description !== undefined) {
        existing.description = String(description || "").trim();
      }
      if (isActive !== undefined) {
        existing.isActive = !!isActive;
      }
      if (meta !== undefined) {
        existing.meta = meta && typeof meta === "object" ? meta : {};
      }

      if (role === "SUPER_ADMIN" && isSystem !== undefined) {
        existing.isSystem = nextIsSystem;
        if (nextIsSystem) {
          existing.academyId = null;
        }
      }

      existing.updatedBy = req.user?._id || null;

      await existing.save();

      const saved = await populateTemplateById(existing._id);

      return res.json({
        ok: true,
        message: "Email template updated successfully",
        item: saved,
      });
    } catch (error) {
      console.error("PUT /email/templates/:id error:", error);

      if (error?.code === 11000) {
        return res.status(409).json({
          ok: false,
          message: "Template key already exists",
        });
      }

      return res.status(error?.status || 500).json({
        ok: false,
        message: error?.message || "Failed to update email template",
      });
    }
  },
);

/**
 * PATCH /api/email/templates/:id/toggle
 */
router.patch(
  "/:id/toggle",
  auth,
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const role = String(req?.user?.role || "").toUpperCase();
      const { id } = req.params;

      if (!isValidObjectIdLike(id)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid template id",
        });
      }

      const template = await EmailTemplate.findOne({
        $and: [{ _id: id }, buildAccessQuery(req)],
      });

      if (!template) {
        return res.status(404).json({
          ok: false,
          message: "Email template not found",
        });
      }

      if (template.isSystem && role !== "SUPER_ADMIN") {
        return res.status(403).json({
          ok: false,
          message: "Only super admin can modify system templates",
        });
      }

      template.isActive = !template.isActive;
      template.updatedBy = req.user?._id || null;

      await template.save();

      const saved = await populateTemplateById(template._id);

      return res.json({
        ok: true,
        message: `Email template ${
          template.isActive ? "activated" : "deactivated"
        } successfully`,
        item: saved,
      });
    } catch (error) {
      console.error("PATCH /email/templates/:id/toggle error:", error);
      return res.status(error?.status || 500).json({
        ok: false,
        message: error?.message || "Failed to toggle email template",
      });
    }
  },
);

/**
 * DELETE /api/email/templates/:id
 */
router.delete(
  "/:id",
  auth,
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const role = String(req?.user?.role || "").toUpperCase();
      const { id } = req.params;

      if (!isValidObjectIdLike(id)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid template id",
        });
      }

      const template = await EmailTemplate.findOne({
        $and: [{ _id: id }, buildAccessQuery(req)],
      });

      if (!template) {
        return res.status(404).json({
          ok: false,
          message: "Email template not found",
        });
      }

      if (template.isSystem && role !== "SUPER_ADMIN") {
        return res.status(403).json({
          ok: false,
          message: "Only super admin can delete system templates",
        });
      }

      await EmailTemplate.deleteOne({ _id: template._id });

      return res.json({
        ok: true,
        message: "Email template deleted successfully",
      });
    } catch (error) {
      console.error("DELETE /email/templates/:id error:", error);
      return res.status(error?.status || 500).json({
        ok: false,
        message: error?.message || "Failed to delete email template",
      });
    }
  },
);

export default router;
