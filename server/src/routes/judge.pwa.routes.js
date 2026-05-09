import express from "express";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import ScoreDraft from "../models/ScoreDraft.js";
import Score from "../models/Score.js";
import JudgeAssignment from "../models/JudgeAssignment.js";
import Participant from "../models/Participant.js";

const router = express.Router();

router.use(auth, requireRole("JUDGE", "ADMIN", "SUPER_ADMIN"));

router.get("/assignments", async (req, res) => {
  try {
    const rows = await JudgeAssignment.find({ judgeId: req.user.id })
      .populate("eventId", "title name")
      .populate("activityId", "name title")
      .populate("groupId", "name")
      .populate("academyId", "name")
      .lean();

    const enriched = [];

    for (const row of rows) {
      const participants = row.groupId?._id
        ? await Participant.find({ groupId: row.groupId._id })
            .select("name fullName participantName")
            .lean()
        : [];

      enriched.push({
        ...row,
        participants,
      });
    }

    return res.json({ assignments: enriched });
  } catch (err) {
    return res.status(500).json({
      message: err?.message || "Failed to load assignments",
    });
  }
});

router.post("/draft", async (req, res) => {
  try {
    const {
      localId,
      eventId,
      activityId,
      participantId,
      academyId,
      participantName,
      scores,
      notes,
      submitted,
      updatedAt,
    } = req.body || {};

    if (!eventId || !activityId || !participantId) {
      return res.status(400).json({
        message: "eventId, activityId and participantId are required",
      });
    }

    const key =
      localId || `${req.user.id}_${eventId}_${activityId}_${participantId}`;

    const doc = await ScoreDraft.findOneAndUpdate(
      { localId: key },
      {
        localId: key,
        judgeId: req.user.id,
        eventId,
        activityId,
        participantId,
        academyId: academyId || null,
        participantName: participantName || "",
        scores: scores || {},
        notes: notes || "",
        submitted: !!submitted,
        lastClientUpdatedAt: updatedAt ? new Date(updatedAt) : new Date(),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.json({ ok: true, draft: doc });
  } catch (err) {
    return res.status(500).json({
      message: err?.message || "Failed to save draft",
    });
  }
});

router.post("/sync", async (req, res) => {
  try {
    const drafts = Array.isArray(req.body?.drafts) ? req.body.drafts : [];
    const syncedIds = [];
    const failed = [];

    for (const item of drafts) {
      try {
        if (!item?.eventId || !item?.activityId || !item?.participantId) {
          failed.push({
            localId: item?.localId || null,
            reason: "Missing required fields",
          });
          continue;
        }

        await ScoreDraft.findOneAndUpdate(
          { localId: item.localId },
          {
            localId: item.localId,
            judgeId: req.user.id,
            academyId: item.academyId || null,
            eventId: item.eventId,
            activityId: item.activityId,
            participantId: item.participantId,
            participantName: item.participantName || "",
            scores: item.scores || {},
            notes: item.notes || "",
            submitted: !!item.submitted,
            lastClientUpdatedAt: item.updatedAt
              ? new Date(item.updatedAt)
              : new Date(),
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          },
        );

        if (item.submitted) {
          const total = Number(item?.scores?.total || 0);

          await Score.findOneAndUpdate(
            {
              judgeId: req.user.id,
              eventId: item.eventId,
              activityId: item.activityId,
              participantId: item.participantId,
            },
            {
              judgeId: req.user.id,
              eventId: item.eventId,
              activityId: item.activityId,
              participantId: item.participantId,
              academyId: item.academyId || null,
              total,
              breakdown: item.scores || {},
              notes: item.notes || "",
              status: "SCORED",
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true,
            },
          );
        }

        syncedIds.push(item.localId);
      } catch (err) {
        failed.push({
          localId: item?.localId || null,
          reason: err?.message || "Sync item failed",
        });
      }
    }

    return res.json({
      ok: true,
      syncedIds,
      failed,
    });
  } catch (err) {
    return res.status(500).json({
      message: err?.message || "Sync failed",
    });
  }
});

export default router;
