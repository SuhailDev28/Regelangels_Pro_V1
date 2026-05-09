// ✅ FULL CODE — server/src/services/totals.service.js
// Goal: ONE source of truth for totals
//
// IMPORTANT:
// You MUST paste/port the SAME logic you currently use in your admin totals controller.
// I cannot safely invent your scoring rules without seeing that file.
//
// For now this provides a clear skeleton that matches your frontend expectations.

import mongoose from "mongoose";

// import your models used in totals calculations:
import Group from "../models/Group.js";
import Participant from "../models/Participant.js";
import Activity from "../models/Activity.js";
import Score from "../models/Score.js";

/**
 * Must return:
 * {
 *   activities: [{ _id, name }],
 *   rows: [{
 *     participantId, name, rank, total,
 *     byActivity: { [activityId]: number },
 *     medals?: { G,S,B } (optional if you compute)
 *   }],
 *   medalsByActivity?: { [activityId]: { [participantId]: "G"|"S"|"B" } } (optional)
 * }
 */
export async function buildTotalsForGroup(groupId) {
  if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
    return { activities: [], rows: [], medalsByActivity: {} };
  }

  // ✅ Load group (optional)
  const group = await Group.findById(groupId).lean();

  // ✅ Activities for group (depends on your schema)
  // If activities are global, load all.
  // If activities are filtered by group/level, apply that filter here.
  const activities = await Activity.find({}).select({ name: 1 }).lean();

  // ✅ Participants in this group
  // Adjust field names to match your schema:
  const participants = await Participant.find({ groupId }).select({ name: 1 }).lean();

  // ✅ Scores for participants in group
  // Adjust field names to match your schema:
  const participantIds = participants.map((p) => String(p._id));
  const scores = await Score.find({ groupId }).lean();

  // Build score map: by participantId -> by activityId -> score
  const byPid = {};
  for (const p of participants) byPid[String(p._id)] = {};

  for (const s of scores) {
    const pid = String(s.participantId || "");
    const aid = String(s.activityId || "");
    const val = Number(s.score ?? s.value ?? 0);

    if (!pid || !aid) continue;
    if (!byPid[pid]) byPid[pid] = {};
    // If multiple judges exist, your real logic may aggregate.
    // Replace this with your admin totals aggregation.
    byPid[pid][aid] = val;
  }

  const rows = participants.map((p) => {
    const pid = String(p._id);
    const byActivity = byPid[pid] || {};
    const total = activities.reduce((sum, a) => sum + Number(byActivity[String(a._id)] ?? 0), 0);

    return {
      participantId: pid,
      name: p.name || "—",
      byActivity,
      total,
    };
  });

  // rank
  const sorted = [...rows].sort((a, b) => Number(b.total) - Number(a.total));
  sorted.forEach((r, i) => (r.rank = i + 1));

  return {
    group: group ? { _id: String(group._id), name: group.name, level: group.level } : null,
    activities: activities.map((a) => ({ _id: String(a._id), name: a.name })),
    rows: sorted,
    medalsByActivity: {}, // optional (your admin logic may fill this)
  };
}