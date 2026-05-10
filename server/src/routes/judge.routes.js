import express from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { auth, requireRole } from "../middleware/auth.js";

import JudgeAssignment from "../models/JudgeAssignment.js";
import Participant from "../models/Participant.js";
import Event from "../models/Event.js";
import EventEnrollment from "../models/EventEnrollment.js";
import Score from "../models/Score.js";
import Alert from "../models/Alert.js";
import Activity from "../models/Activity.js";

const router = express.Router();
router.use(auth, requireRole("JUDGE"));

/* =========================
 * Async wrapper
 * ========================= */
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* =========================
 * Constants
 * ========================= */
const SCORE_STATUSES = new Set([
  "SCORED",
  "ABSENT",
  "DQ",
  "RETRY",
  "WITHDRAWN",
]);

const SCORING_EVENT_STATUSES = new Set(["LIVE", "SCORING"]);

/* =========================
 * Helpers
 * ========================= */
function getUserId(req) {
  return (
    req.user?.id || req.user?._id || req.user?.userId || req.user?.sub || null
  );
}

function getAcademyId(req) {
  return req.academyId || req.user?.academyId || null;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function toIdString(x) {
  if (!x) return "";
  if (typeof x === "object" && x._id) return String(x._id);
  return String(x);
}

function pickText(...vals) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function normalizeUpper(value, fallback = "") {
  return String(value || fallback)
    .trim()
    .toUpperCase();
}

function normalizePriority(value) {
  const v = normalizeUpper(value);

  if (v === "NORMAL") return "MEDIUM";
  if (v === "LOW" || v === "MEDIUM" || v === "HIGH") return v;

  return "HIGH";
}

function normalizeScoreValue(value) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? Number(value) : value;
}

function emitScoreSaved({
  req,
  academyId,
  eventId,
  judgeUserId,
  participantId,
  activityId,
  status,
  value,
}) {
  const io = req.app.get("io");
  if (!io) return;

  const payload = {
    academyId: String(academyId),
    eventId: String(eventId),
    participantId: String(participantId),
    activityId: String(activityId),
    status,
    value,
    ts: Date.now(),
  };

  io.to(`event:${eventId}`).emit("leaderboard:update", payload);
  io.to(`leaderboard:${eventId}`).emit("leaderboard:update", payload);
  io.to(`academy:${academyId}`).emit("admin:score-updated", payload);

  io.to(`judge:${judgeUserId}`).emit("judge:score.saved", {
    ...payload,
    judgeUserId: String(judgeUserId),
  });
}

function emitActivityFinalized({
  req,
  academyId,
  eventId,
  judgeUserId,
  activityId,
}) {
  const io = req.app.get("io");
  if (!io) return;

  const payload = {
    academyId: String(academyId),
    eventId: String(eventId),
    judgeUserId: String(judgeUserId),
    activityId: String(activityId),
    ts: Date.now(),
  };

  io.to(`judge:${judgeUserId}`).emit("judge:activity.finalized", payload);
  io.to(`event:${eventId}`).emit("leaderboard:update", payload);
  io.to(`leaderboard:${eventId}`).emit("leaderboard:update", payload);
  io.to(`academy:${academyId}`).emit("admin:activity-finalized", payload);
}

async function pickDefaultEventIdForJudge(judgeUserId, academyId) {
  if (!judgeUserId || !academyId) return null;

  const distinct = await JudgeAssignment.distinct("eventId", {
    judgeUserId,
    academyId,
  });

  if (!distinct.length) return null;

  const events = await Event.find({
    _id: { $in: distinct },
    academyId,
  })
    .sort({ createdAt: -1 })
    .lean();

  const scoring = (events || []).find((e) =>
    SCORING_EVENT_STATUSES.has(normalizeUpper(e?.status)),
  );

  if (scoring?._id) return String(scoring._id);
  if (events?.[0]?._id) return String(events[0]._id);

  return null;
}

async function ensureJudgeEventAccess(judgeUserId, academyId, eventId) {
  if (!judgeUserId || !academyId) return false;
  if (!isValidObjectId(eventId)) return false;

  const exists = await JudgeAssignment.exists({
    judgeUserId,
    academyId,
    eventId,
  });

  return Boolean(exists);
}

async function getParticipantScopedAssignment({
  academyId,
  eventId,
  judgeUserId,
  activityId,
  participantGroupId,
  participantLevel,
}) {
  const base = {
    academyId,
    eventId,
    judgeUserId,
    activityId,
  };

  if (participantGroupId) {
    const exact = await JudgeAssignment.findOne({
      ...base,
      groupId: participantGroupId,
    })
      .populate("activityId", "name maxScore allowDecimal decimal")
      .lean();

    if (exact) {
      const asgLevel = String(exact.level || "").trim();
      if (!asgLevel || asgLevel === String(participantLevel || "").trim()) {
        return exact;
      }
    }
  }

  const fallback = await JudgeAssignment.findOne({
    ...base,
    $or: [{ groupId: null }, { groupId: { $exists: false } }],
  })
    .populate("activityId", "name maxScore allowDecimal decimal")
    .lean();

  if (fallback) {
    const asgLevel = String(fallback.level || "").trim();
    if (!asgLevel || asgLevel === String(participantLevel || "").trim()) {
      return fallback;
    }
  }

  return null;
}

async function isActivityFinalizedForJudge({
  academyId,
  eventId,
  judgeUserId,
  activityId,
}) {
  const finalizedDoc = await Score.findOne({
    academyId,
    eventId,
    judgeUserId,
    activityId,
    isFinal: true,
  })
    .select("_id isFinal finalizedAt")
    .lean();

  return Boolean(finalizedDoc);
}

async function getScopedParticipantsForJudgeActivity({
  academyId,
  eventId,
  judgeUserId,
  activityId,
}) {
  const assignmentRows = await JudgeAssignment.find({
    academyId,
    eventId,
    judgeUserId,
    activityId,
  }).lean();

  const groupIds = new Set(
    assignmentRows
      .map((a) => (a.groupId ? String(a.groupId) : ""))
      .filter(Boolean),
  );

  const levels = new Set(
    assignmentRows.map((a) => String(a.level || "").trim()).filter(Boolean),
  );

  return handleFinalizeScopedParticipants({
    academyId,
    eventId,
    groupIds,
    levels,
  });
}

/* =========================
 * Shared handlers
 * ========================= */

async function handleParticipants(req, res, eventIdOverride) {
  const judgeUserId = getUserId(req);
  const academyId = getAcademyId(req);

  if (!judgeUserId || !academyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const qEventId = req.query?.eventId ? String(req.query.eventId).trim() : "";
  const qActivityId = req.query?.activityId
    ? String(req.query.activityId).trim()
    : "";

  const eventId =
    (qEventId && isValidObjectId(qEventId) ? qEventId : "") ||
    (eventIdOverride && isValidObjectId(eventIdOverride)
      ? eventIdOverride
      : "") ||
    (await pickDefaultEventIdForJudge(judgeUserId, academyId));

  if (!eventId) return res.json([]);

  if (!isValidObjectId(eventId)) {
    return res.status(400).json({ message: "Invalid eventId" });
  }

  const find = { academyId, eventId, judgeUserId };

  if (qActivityId) {
    if (!isValidObjectId(qActivityId)) {
      return res.status(400).json({ message: "Invalid activityId" });
    }

    find.activityId = qActivityId;
  }

  const assignments = await JudgeAssignment.find(find).lean();
  if (!assignments.length) return res.json([]);

  const groupIds = new Set(
    assignments
      .map((a) => (a.groupId ? String(a.groupId) : ""))
      .filter(Boolean),
  );

  const levels = new Set(
    assignments
      .map((a) => (a.level ? String(a.level).trim() : ""))
      .filter(Boolean),
  );

  let enrollments = await EventEnrollment.find({ academyId, eventId }).lean();

  if (groupIds.size) {
    enrollments = enrollments.filter((e) => {
      if (!e.groupId) return true;
      return groupIds.has(String(e.groupId));
    });
  }

  const participantIds = enrollments
    .map((e) => e.participantId)
    .filter(Boolean);

  if (!participantIds.length) return res.json([]);

  let rows = await Participant.find({
    academyId,
    _id: { $in: participantIds },
  })
    .populate("userId", "name email isActive")
    .populate("groupId", "name level")
    .lean();

  if (groupIds.size) {
    rows = rows.filter(
      (p) => p.groupId?._id && groupIds.has(String(p.groupId._id)),
    );
  }

  if (levels.size) {
    rows = rows.filter((p) =>
      levels.has(String(p.groupId?.level || "").trim()),
    );
  }

  return res.json(rows);
}

async function handleScore(req, res, eventIdOverride) {
  const judgeUserId = getUserId(req);
  const academyId = getAcademyId(req);

  if (!judgeUserId || !academyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const eventId =
    (req.params?.eventId && isValidObjectId(req.params.eventId)
      ? req.params.eventId
      : "") ||
    (eventIdOverride && isValidObjectId(eventIdOverride)
      ? eventIdOverride
      : "");

  if (!eventId) return res.status(400).json({ message: "Missing eventId" });

  if (!isValidObjectId(eventId)) {
    return res.status(400).json({ message: "Invalid eventId" });
  }

  const schema = z.object({
    participantId: z.string().min(1),
    activityId: z.string().min(1),
    value: z.union([z.number(), z.string(), z.null()]).optional(),
    status: z.string().optional().default("SCORED"),
    comment: z.string().optional(),
    notes: z.string().optional(),
  });

  const parsed = schema.parse(req.body);

  const participantId = String(parsed.participantId);
  const activityId = String(parsed.activityId);
  const status = normalizeUpper(parsed.status, "SCORED");
  const comment = pickText(parsed.comment, parsed.notes);
  const valueNum = normalizeScoreValue(parsed.value);

  if (!isValidObjectId(participantId)) {
    return res.status(400).json({ message: "Invalid participantId" });
  }

  if (!isValidObjectId(activityId)) {
    return res.status(400).json({ message: "Invalid activityId" });
  }

  if (!SCORE_STATUSES.has(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const event = await Event.findOne({ _id: eventId, academyId }).lean();

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  const eventStatus = normalizeUpper(event.status);

  if (!SCORING_EVENT_STATUSES.has(eventStatus)) {
    return res.status(403).json({
      message: "Event is not open for scoring",
      status: eventStatus,
    });
  }

  const finalized = await isActivityFinalizedForJudge({
    academyId,
    eventId,
    judgeUserId,
    activityId,
  });

  if (finalized) {
    return res.status(403).json({
      message: "This activity has already been finalized",
    });
  }

  const enrolled = await EventEnrollment.findOne({
    academyId,
    eventId,
    participantId,
  }).lean();

  if (!enrolled) {
    return res.status(400).json({
      message: "Participant not enrolled in this event",
    });
  }

  const participant = await Participant.findOne({
    _id: participantId,
    academyId,
  })
    .populate("groupId", "name level")
    .lean();

  if (!participant) {
    return res.status(404).json({ message: "Participant not found" });
  }

  const participantGroupId = toIdString(participant.groupId);
  const participantLevel = String(participant.groupId?.level || "").trim();

  const assignment = await getParticipantScopedAssignment({
    academyId,
    eventId,
    judgeUserId,
    activityId,
    participantGroupId,
    participantLevel,
  });

  if (!assignment) {
    return res.status(403).json({
      message: "Not assigned to this group",
    });
  }

  let maxScore = assignment?.activityId?.maxScore;

  // Rebel Angels scoring supports decimal scores globally.
  // Example valid scores: 8.6, 8.25, 9.75, 10

  if (maxScore === undefined || maxScore === null) {
    const activity = await Activity.findOne({
      _id: activityId,
      academyId,
    })
      .select("maxScore allowDecimal decimal")
      .lean();

    maxScore = activity?.maxScore;
  }

  const max = Number(maxScore ?? 10);

  if (!Number.isFinite(max) || max <= 0) {
    return res.status(400).json({
      message: "Invalid activity max score configuration",
    });
  }

  let finalValue = null;

  if (status === "SCORED") {
    if (valueNum === null || Number.isNaN(Number(valueNum))) {
      return res.status(400).json({
        message: "value must be a number",
      });
    }

    finalValue = Number(valueNum);

    if (finalValue < 0) {
      return res.status(400).json({ message: "Minimum 0" });
    }

    if (finalValue > max) {
      return res.status(400).json({ message: `Max ${max}` });
    }
  }

  const now = new Date();

  const doc = await Score.findOneAndUpdate(
    {
      academyId,
      eventId,
      participantId,
      judgeUserId,
      activityId,
    },
    {
      $set: {
        status,
        comment,
        notes: comment,
        value: status === "SCORED" ? finalValue : null,
        isFinal: false,
        finalizedAt: null,
        updatedBy: judgeUserId,
        scoredAt: status === "SCORED" ? now : null,
      },
      $setOnInsert: {
        academyId,
        eventId,
        participantId,
        judgeUserId,
        activityId,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )
    .populate("participantId", "bibNo")
    .populate("activityId", "name maxScore")
    .lean();

  emitScoreSaved({
    req,
    academyId,
    eventId,
    judgeUserId,
    participantId,
    activityId,
    status,
    value: status === "SCORED" ? finalValue : null,
  });

  return res.json(doc);
}

async function handleAlert(req, res, eventIdOverride) {
  const judgeUserId = getUserId(req);
  const academyId = getAcademyId(req);

  if (!judgeUserId || !academyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const eventId =
    (req.params?.eventId && isValidObjectId(req.params.eventId)
      ? req.params.eventId
      : "") ||
    (eventIdOverride && isValidObjectId(eventIdOverride)
      ? eventIdOverride
      : "");

  if (!eventId) return res.status(400).json({ message: "Missing eventId" });

  if (!isValidObjectId(eventId)) {
    return res.status(400).json({ message: "Invalid eventId" });
  }

  const schema = z.object({
    activityId: z.string().optional().nullable(),
    message: z.string().trim().min(1).max(500).default("Need assistance"),
    priority: z.string().optional().default("HIGH"),
    meta: z.record(z.any()).optional().default({}),
  });

  const payload = schema.parse(req.body || {});

  if (payload.activityId && !isValidObjectId(payload.activityId)) {
    return res.status(400).json({ message: "Invalid activityId" });
  }

  const anyAssignment = await JudgeAssignment.findOne({
    academyId,
    eventId,
    judgeUserId,
  }).lean();

  if (!anyAssignment) {
    return res.status(403).json({
      message: "No assignments in this event",
    });
  }

  if (payload.activityId) {
    const activityAssignment = await JudgeAssignment.findOne({
      academyId,
      eventId,
      judgeUserId,
      activityId: payload.activityId,
    }).lean();

    if (!activityAssignment) {
      return res.status(403).json({
        message: "You are not assigned to this activity in the selected event",
      });
    }
  }

  const created = await Alert.create({
    academyId,
    eventId,
    judgeId: judgeUserId,
    activityId: payload.activityId || null,
    message: payload.message,
    priority: normalizePriority(payload.priority),
    status: "OPEN",
    meta: {
      ...(payload.meta || {}),
      source: "JUDGE_ALERT",
      createdByRole: "JUDGE",
      createdByUserId: String(judgeUserId),
    },
  });

  const populated = await Alert.findById(created._id)
    .populate("judgeId", "name email academyId")
    .populate("activityId", "name maxScore")
    .populate("eventId", "name status")
    .populate("academyId", "name code")
    .lean();

  const io = req.app.get("io");

  if (io) {
    io.to("admins").emit("alert:new", populated);
    io.to(`academy:${academyId}`).emit("alert:new", populated);

    io.to(`user:${String(judgeUserId)}`).emit("alert:created", {
      id: String(populated?._id || ""),
      alert: populated,
      academyId: String(academyId),
      eventId: String(eventId),
      ts: Date.now(),
    });
  }

  return res.json(populated);
}

async function handleSavedScores(req, res) {
  const judgeUserId = getUserId(req);
  const academyId = getAcademyId(req);

  if (!judgeUserId || !academyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { eventId } = req.params;

  const activityId = req.query?.activityId
    ? String(req.query.activityId).trim()
    : "";

  if (!isValidObjectId(eventId)) {
    return res.status(400).json({ message: "Invalid eventId" });
  }

  if (!activityId || !isValidObjectId(activityId)) {
    return res.status(400).json({ message: "Invalid activityId" });
  }

  const hasAccess = await ensureJudgeEventAccess(
    judgeUserId,
    academyId,
    eventId,
  );

  if (!hasAccess) {
    return res.status(403).json({
      message: "No access to this event",
    });
  }

  const rows = await Score.find({
    academyId,
    eventId,
    judgeUserId,
    activityId,
  })
    .populate({
      path: "participantId",
      select: "bibNo groupId userId",
      populate: [
        { path: "groupId", select: "name level" },
        { path: "userId", select: "name email" },
      ],
    })
    .populate("activityId", "name maxScore")
    .sort({ updatedAt: -1 })
    .lean();

  const finalized = rows.some((r) => Boolean(r?.isFinal));

  return res.json({
    rows,
    finalized,
    activityId,
    eventId,
  });
}

async function handleFinalize(req, res) {
  const judgeUserId = getUserId(req);
  const academyId = getAcademyId(req);

  if (!judgeUserId || !academyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { eventId, activityId } = req.params;

  if (!isValidObjectId(eventId)) {
    return res.status(400).json({ message: "Invalid eventId" });
  }

  if (!isValidObjectId(activityId)) {
    return res.status(400).json({ message: "Invalid activityId" });
  }

  const event = await Event.findOne({
    _id: eventId,
    academyId,
  }).lean();

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  const eventStatus = normalizeUpper(event.status);

  if (!SCORING_EVENT_STATUSES.has(eventStatus)) {
    return res.status(403).json({
      message: "Event is not open for finalization",
      status: eventStatus,
    });
  }

  const hasAssignment = await JudgeAssignment.findOne({
    academyId,
    eventId,
    judgeUserId,
    activityId,
  }).lean();

  if (!hasAssignment) {
    return res.status(403).json({
      message: "No assignment found for this activity",
    });
  }

  const alreadyFinalized = await isActivityFinalizedForJudge({
    academyId,
    eventId,
    judgeUserId,
    activityId,
  });

  if (alreadyFinalized) {
    return res.json({
      ok: true,
      alreadyFinalized: true,
      eventId,
      activityId,
    });
  }

  const participants = await getScopedParticipantsForJudgeActivity({
    academyId,
    eventId,
    judgeUserId,
    activityId,
  });

  const participantIds = participants.map((p) => String(p._id));

  if (!participantIds.length) {
    return res.status(400).json({
      message: "No participants found for this activity assignment",
    });
  }

  const scoreRows = await Score.find({
    academyId,
    eventId,
    judgeUserId,
    activityId,
    participantId: { $in: participantIds },
  }).lean();

  const scoreMap = new Map(scoreRows.map((s) => [String(s.participantId), s]));

  const missing = participants.filter((p) => {
    const row = scoreMap.get(String(p._id));

    if (!row) return true;

    const st = normalizeUpper(row.status, "SCORED");

    if (["ABSENT", "DQ", "RETRY", "WITHDRAWN"].includes(st)) {
      return false;
    }

    return row.value === undefined || row.value === null || row.value === "";
  });

  if (missing.length) {
    return res.status(400).json({
      message: "There are pending participants",
      missing: missing.map((p) => ({
        _id: p._id,
        name: p.userId?.name || "Participant",
        bibNo: p.bibNo || "",
      })),
    });
  }

  if (scoreRows.length !== participantIds.length) {
    return res.status(400).json({
      message: "Some participant scores are missing",
    });
  }

  const now = new Date();

  const result = await Score.updateMany(
    {
      academyId,
      eventId,
      judgeUserId,
      activityId,
      participantId: { $in: participantIds },
    },
    {
      $set: {
        isFinal: true,
        finalizedAt: now,
      },
    },
    {
      runValidators: true,
    },
  );

  emitActivityFinalized({
    req,
    academyId,
    eventId,
    judgeUserId,
    activityId,
  });

  return res.json({
    ok: true,
    eventId,
    activityId,
    finalizedAt: now,
    matchedCount: result?.matchedCount ?? result?.n ?? 0,
    modifiedCount: result?.modifiedCount ?? result?.nModified ?? 0,
  });
}

async function handleFinalizeScopedParticipants({
  academyId,
  eventId,
  groupIds,
  levels,
}) {
  const enrollments = await EventEnrollment.find({
    academyId,
    eventId,
  }).lean();

  const participantIds = enrollments
    .map((e) => e.participantId)
    .filter(Boolean);

  if (!participantIds.length) return [];

  let rows = await Participant.find({
    academyId,
    _id: { $in: participantIds },
  })
    .populate("userId", "name email")
    .populate("groupId", "name level")
    .lean();

  if (groupIds?.size) {
    rows = rows.filter((p) => {
      const gid = p.groupId?._id ? String(p.groupId._id) : "";
      return gid && groupIds.has(gid);
    });
  }

  if (levels?.size) {
    rows = rows.filter((p) =>
      levels.has(String(p.groupId?.level || "").trim()),
    );
  }

  return rows;
}

/* =========================
 * LEGACY: GET /api/judge/participants
 * ========================= */
router.get(
  "/participants",
  wrap(async (req, res) => handleParticipants(req, res)),
);

/* =========================
 * LEGACY: GET /api/judge/me/assignments
 * ========================= */
router.get(
  "/me/assignments",
  wrap(async (req, res) => {
    const judgeUserId = getUserId(req);
    const academyId = getAcademyId(req);

    if (!judgeUserId || !academyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const qEventId = req.query?.eventId ? String(req.query.eventId).trim() : "";

    if (qEventId && !isValidObjectId(qEventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const activeEventId =
      (qEventId && isValidObjectId(qEventId) ? qEventId : "") ||
      (await pickDefaultEventIdForJudge(judgeUserId, academyId));

    const findQuery = { academyId, judgeUserId };

    if (activeEventId) {
      findQuery.eventId = activeEventId;
    }

    const assigns = await JudgeAssignment.find(findQuery)
      .populate("eventId", "name status startDate endDate")
      .populate("activityId", "name maxScore allowDecimal decimal")
      .populate("groupId", "name level")
      .lean();

    const eventsMap = new Map();
    const groupsMap = new Map();
    const actsMap = new Map();

    for (const a of assigns) {
      if (a.eventId) eventsMap.set(String(a.eventId._id), a.eventId);
      if (a.groupId) groupsMap.set(String(a.groupId._id), a.groupId);
      if (a.activityId) actsMap.set(String(a.activityId._id), a.activityId);
    }

    if (!eventsMap.size) {
      const distinct = await JudgeAssignment.distinct("eventId", {
        academyId,
        judgeUserId,
      });

      if (distinct.length) {
        const evs = await Event.find({
          academyId,
          _id: { $in: distinct },
        })
          .sort({ createdAt: -1 })
          .lean();

        for (const e of evs) {
          eventsMap.set(String(e._id), e);
        }
      }
    }

    return res.json({
      eventId: activeEventId || "",
      events: Array.from(eventsMap.values()),
      assignments: assigns,
      groups: Array.from(groupsMap.values()),
      activities: Array.from(actsMap.values()),
    });
  }),
);

/* =========================
 * GET /api/judge/me/events
 * ========================= */
router.get(
  "/me/events",
  wrap(async (req, res) => {
    const judgeUserId = getUserId(req);
    const academyId = getAcademyId(req);

    if (!judgeUserId || !academyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const distinct = await JudgeAssignment.distinct("eventId", {
      academyId,
      judgeUserId,
    });

    if (!distinct.length) return res.json([]);

    const events = await Event.find({
      academyId,
      _id: { $in: distinct },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(events || []);
  }),
);

/* =========================
 * GET /api/judge/events/:eventId/assignments
 * ========================= */
router.get(
  "/events/:eventId/assignments",
  wrap(async (req, res) => {
    const judgeUserId = getUserId(req);
    const academyId = getAcademyId(req);

    if (!judgeUserId || !academyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const rows = await JudgeAssignment.find({
      academyId,
      eventId,
      judgeUserId,
    })
      .populate("activityId", "name maxScore allowDecimal decimal")
      .populate("groupId", "name level")
      .lean();

    res.json(rows);
  }),
);

/* =========================
 * GET /api/judge/events/:eventId/participants
 * Optional: ?activityId=xxxx
 * ========================= */
router.get(
  "/events/:eventId/participants",
  wrap(async (req, res) => {
    const judgeUserId = getUserId(req);
    const academyId = getAcademyId(req);

    if (!judgeUserId || !academyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { eventId } = req.params;

    const qActivityId = req.query?.activityId
      ? String(req.query.activityId).trim()
      : "";

    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }

    const find = { academyId, eventId, judgeUserId };

    if (qActivityId) {
      if (!isValidObjectId(qActivityId)) {
        return res.status(400).json({ message: "Invalid activityId" });
      }

      find.activityId = qActivityId;
    }

    const assignments = await JudgeAssignment.find(find).lean();

    if (!assignments.length) return res.json([]);

    const groupIds = new Set(
      assignments.filter((a) => a.groupId).map((a) => String(a.groupId)),
    );

    const levels = new Set(
      assignments.map((a) => String(a.level || "").trim()).filter(Boolean),
    );

    const enrollments = await EventEnrollment.find({
      academyId,
      eventId,
    }).lean();

    const participantIds = enrollments
      .filter((e) => {
        if (!groupIds.size) return true;
        if (!e.groupId) return true;
        return groupIds.has(String(e.groupId));
      })
      .map((e) => e.participantId)
      .filter(Boolean);

    if (!participantIds.length) return res.json([]);

    let rows = await Participant.find({
      academyId,
      _id: { $in: participantIds },
    })
      .populate("userId", "name email isActive")
      .populate("groupId", "name level")
      .lean();

    if (groupIds.size) {
      rows = rows.filter(
        (p) => p.groupId?._id && groupIds.has(String(p.groupId._id)),
      );
    }

    if (levels.size) {
      rows = rows.filter((p) =>
        levels.has(String(p.groupId?.level || "").trim()),
      );
    }

    res.json(rows);
  }),
);

/* =========================
 * GET /api/judge/events/:eventId/scores?activityId=...
 * ========================= */
router.get(
  "/events/:eventId/scores",
  wrap(async (req, res) => handleSavedScores(req, res)),
);

/* =========================
 * POST /api/judge/events/:eventId/score
 * ========================= */
router.post(
  "/events/:eventId/score",
  wrap(async (req, res) => handleScore(req, res)),
);

/* =========================
 * POST /api/judge/events/:eventId/alerts
 * ========================= */
router.post(
  "/events/:eventId/alerts",
  wrap(async (req, res) => handleAlert(req, res)),
);

/* =========================
 * POST /api/judge/events/:eventId/activities/:activityId/finalize
 * ========================= */
router.post(
  "/events/:eventId/activities/:activityId/finalize",
  wrap(async (req, res) => handleFinalize(req, res)),
);

/* =========================
 * LEGACY ALIASES
 * ========================= */
router.post(
  "/score",
  wrap(async (req, res) => {
    const judgeUserId = getUserId(req);
    const academyId = getAcademyId(req);

    const eventId = await pickDefaultEventIdForJudge(judgeUserId, academyId);

    if (!eventId) {
      return res.status(400).json({
        message: "No assigned events found for this judge",
      });
    }

    req.params.eventId = eventId;
    return handleScore(req, res, eventId);
  }),
);

router.post(
  "/alerts",
  wrap(async (req, res) => {
    const judgeUserId = getUserId(req);
    const academyId = getAcademyId(req);

    const eventId = await pickDefaultEventIdForJudge(judgeUserId, academyId);

    if (!eventId) {
      return res.status(400).json({
        message: "No assigned events found for this judge",
      });
    }

    req.params.eventId = eventId;
    return handleAlert(req, res, eventId);
  }),
);

/* =========================
 * Error handler
 * ========================= */
router.use((err, _req, res, _next) => {
  if (err?.name === "ZodError") {
    return res.status(400).json({
      message: "Validation error",
      issues: err.issues || [],
    });
  }

  if (err?.code === 11000) {
    return res.status(409).json({
      message: "Score was saved at the same time. Please retry.",
      code: "DUPLICATE_SCORE_UPSERT",
    });
  }

  const msg = err?.message || "Server error";

  return res.status(500).json({
    message: msg,
  });
});

export default router;
