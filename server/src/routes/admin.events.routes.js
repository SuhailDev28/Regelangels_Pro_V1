import express from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import Event from "../models/Event.js";

const router = express.Router();

router.use(auth, requireRole("ADMIN", "SUPER_ADMIN"));

/* =========================================================
   VALIDATION
========================================================= */

const EventInSchema = z.object({
  name: z.string().trim().min(1, "Event name is required"),
  code: z.string().trim().optional().default(""),
  venue: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
  status: z.enum(["DRAFT", "LIVE", "CLOSED"]).optional().default("DRAFT"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  registrationFee: z.coerce.number().min(0).optional().default(0),
  paymentMethod: z.enum(["CASH"]).optional().default("CASH"),
});

const EventUpdateSchema = EventInSchema.partial();

/* =========================================================
   HELPERS
========================================================= */

function normalizeCode(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toUpperCase();
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function getAcademyScope(req) {
  return (
    req.headers["x-academy-id"] ||
    req.user?.academyId ||
    req.user?.academy ||
    req.academyId ||
    null
  );
}

function requireAcademyScope(req, res) {
  const academyId = getAcademyScope(req);

  if (!academyId) {
    res.status(400).json({ message: "Academy scope is required" });
    return null;
  }

  if (!isValidObjectId(academyId)) {
    res.status(400).json({ message: "Invalid academyId" });
    return null;
  }

  return String(academyId);
}

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return null;

  const s = new Date(startDate).getTime();
  const e = new Date(endDate).getTime();

  if (!Number.isNaN(s) && !Number.isNaN(e) && e < s) {
    return "End date cannot be earlier than start date";
  }

  return null;
}

/* =========================================================
   LIST EVENTS
========================================================= */

router.get("/", async (req, res) => {
  try {
    const academyId = requireAcademyScope(req, res);
    if (!academyId) return;

    const rows = await Event.find({ academyId }).sort({ createdAt: -1 }).lean();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load events" });
  }
});

/* =========================================================
   GET ONE EVENT
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const academyId = requireAcademyScope(req, res);
    if (!academyId) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid event id" });
    }

    const row = await Event.findOne({
      _id: req.params.id,
      academyId,
    }).lean();

    if (!row) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load event" });
  }
});

/* =========================================================
   CREATE EVENT
========================================================= */

router.post("/", async (req, res) => {
  try {
    const academyId = requireAcademyScope(req, res);
    if (!academyId) return;

    const parsed = EventInSchema.parse(req.body || {});
    const rangeError = validateDateRange(parsed.startDate, parsed.endDate);

    if (rangeError) {
      return res.status(400).json({ message: rangeError });
    }

    const doc = await Event.create({
      academyId,
      name: parsed.name,
      code: normalizeCode(parsed.code || parsed.name),
      venue: parsed.venue,
      notes: parsed.notes,
      status: parsed.status,
      startDate: parseDateOrNull(parsed.startDate),
      endDate: parseDateOrNull(parsed.endDate),
      registrationFee: parsed.registrationFee ?? 0,
      paymentMethod: "CASH",
    });

    res.status(201).json(doc);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.issues?.[0]?.message || "Invalid event data",
      });
    }

    res.status(500).json({ message: err.message || "Failed to create event" });
  }
});

/* =========================================================
   UPDATE EVENT
========================================================= */

router.put("/:id", async (req, res) => {
  try {
    const academyId = requireAcademyScope(req, res);
    if (!academyId) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid event id" });
    }

    const parsed = EventUpdateSchema.parse(req.body || {});
    const event = await Event.findOne({ _id: req.params.id, academyId });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const nextName = parsed.name !== undefined ? parsed.name : event.name;

    const nextStartDate =
      parsed.startDate !== undefined
        ? parseDateOrNull(parsed.startDate)
        : event.startDate;

    const nextEndDate =
      parsed.endDate !== undefined
        ? parseDateOrNull(parsed.endDate)
        : event.endDate;

    const rangeError = validateDateRange(nextStartDate, nextEndDate);
    if (rangeError) {
      return res.status(400).json({ message: rangeError });
    }

    if (parsed.name !== undefined) {
      event.name = parsed.name;
    }

    if (parsed.code !== undefined) {
      event.code = normalizeCode(parsed.code || nextName);
    }

    if (parsed.venue !== undefined) {
      event.venue = parsed.venue;
    }

    if (parsed.notes !== undefined) {
      event.notes = parsed.notes;
    }

    if (parsed.status !== undefined) {
      event.status = parsed.status;
    }

    if (parsed.startDate !== undefined) {
      event.startDate = nextStartDate;
    }

    if (parsed.endDate !== undefined) {
      event.endDate = nextEndDate;
    }

    if (parsed.registrationFee !== undefined) {
      event.registrationFee = parsed.registrationFee;
    }

    event.paymentMethod = "CASH";

    await event.save();

    res.json(event);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.issues?.[0]?.message || "Invalid event update data",
      });
    }

    res.status(500).json({ message: err.message || "Failed to update event" });
  }
});

/* =========================================================
   DELETE EVENT
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    const academyId = requireAcademyScope(req, res);
    if (!academyId) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid event id" });
    }

    const deleted = await Event.findOneAndDelete({
      _id: req.params.id,
      academyId,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete event" });
  }
});

export default router;
