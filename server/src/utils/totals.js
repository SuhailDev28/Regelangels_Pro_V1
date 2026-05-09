import mongoose from "mongoose";

import Score from "../models/Score.js";
import Participant from "../models/Participant.js";
import Activity from "../models/Activity.js";
import EventEnrollment from "../models/EventEnrollment.js";

/**
 * ✅ Threshold medal rule:
 * < 8       => Bronze
 * 8 - 9.99  => Silver
 * >= 10     => Gold
 */
function medalByScore(score) {
  const s = Number(score ?? 0);

  if (!Number.isFinite(s)) return null;
  if (s >= 10) return "G";
  if (s >= 8) return "S";
  return "B";
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function toObjectId(value) {
  if (!value) return null;
  if (!isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function normalizeOptions(eventIdOrOptions = null, maybeOptions = {}) {
  if (
    eventIdOrOptions &&
    typeof eventIdOrOptions === "object" &&
    !Array.isArray(eventIdOrOptions)
  ) {
    return {
      eventId: eventIdOrOptions.eventId || null,
      academyId: eventIdOrOptions.academyId || null,
      includeAllActivities: Boolean(eventIdOrOptions.includeAllActivities),
    };
  }

  return {
    eventId: eventIdOrOptions || maybeOptions.eventId || null,
    academyId: maybeOptions.academyId || null,
    includeAllActivities: Boolean(maybeOptions.includeAllActivities),
  };
}

/**
 * Only real scored entries should count in totals.
 * Ignore ABSENT / DQ / RETRY / WITHDRAWN and null values.
 */
function getScoredMatch(extra = {}) {
  return {
    ...extra,
    status: "SCORED",
    value: {
      $ne: null,
    },
  };
}

function getParticipantName(participant) {
  return (
    participant?.userId?.name ||
    participant?.name ||
    participant?.fullName ||
    "—"
  );
}

function normalizeActivity(activity) {
  return {
    _id: String(activity._id),
    name: activity.name || "Activity",
    maxScore: Number(activity.maxScore ?? 10),
  };
}

async function getEventParticipantIds({ groupId, eventId, academyId }) {
  const enrollmentFind = {
    eventId,
  };

  if (academyId) {
    enrollmentFind.academyId = academyId;
  }

  const enrollments = await EventEnrollment.find(enrollmentFind)
    .select("participantId groupId")
    .lean();

  if (!enrollments.length) return [];

  const enrolledIds = enrollments
    .map((e) => e.participantId)
    .filter(Boolean)
    .map((id) => String(id));

  if (!enrolledIds.length) return [];

  const participantFind = {
    _id: {
      $in: enrolledIds,
    },
    groupId,
  };

  if (academyId) {
    participantFind.academyId = academyId;
  }

  const participants = await Participant.find(participantFind)
    .select("_id")
    .lean();

  return participants.map((p) => p._id);
}

async function getParticipantsForGroup({ groupId, eventId, academyId }) {
  let participantIds = [];

  if (eventId) {
    participantIds = await getEventParticipantIds({
      groupId,
      eventId,
      academyId,
    });

    if (!participantIds.length) return [];
  }

  const participantFind = {
    groupId,
    ...(participantIds.length
      ? {
          _id: {
            $in: participantIds,
          },
        }
      : {}),
  };

  if (academyId) {
    participantFind.academyId = academyId;
  }

  return Participant.find(participantFind)
    .populate("userId", "name email")
    .populate("groupId", "name level")
    .lean();
}

async function getActivitiesForTotals({
  activityIds,
  academyId,
  includeAllActivities,
}) {
  const find = {};

  if (academyId) {
    find.academyId = academyId;
  }

  if (!includeAllActivities) {
    const ids = Array.from(activityIds || [])
      .map((id) => toObjectId(id))
      .filter(Boolean);

    if (ids.length) {
      find._id = {
        $in: ids,
      };
    }
  }

  const activities = await Activity.find(find)
    .select("name maxScore academyId")
    .sort({ name: 1 })
    .lean();

  return activities.map(normalizeActivity);
}

/**
 * ✅ Supports old and new signatures:
 *
 * computeTotalsForGroup(groupId)
 * computeTotalsForGroup(groupId, eventId)
 * computeTotalsForGroup(groupId, { eventId, academyId })
 * computeTotalsForGroup(groupId, eventId, { academyId })
 */
export async function computeTotalsForGroup(
  groupId,
  eventIdOrOptions = null,
  maybeOptions = {},
) {
  const options = normalizeOptions(eventIdOrOptions, maybeOptions);

  const groupObjectId = toObjectId(groupId);
  const eventObjectId = toObjectId(options.eventId);
  const academyObjectId = toObjectId(options.academyId);

  if (!groupObjectId) {
    return {
      groupId: String(groupId || ""),
      eventId: options.eventId ? String(options.eventId) : null,
      academyId: options.academyId ? String(options.academyId) : null,
      activities: [],
      rows: [],
      medalsByActivity: {},
    };
  }

  const participants = await getParticipantsForGroup({
    groupId: groupObjectId,
    eventId: eventObjectId,
    academyId: academyObjectId,
  });

  const participantIds = participants.map((p) => p._id);

  if (!participantIds.length) {
    const emptyActivities = await getActivitiesForTotals({
      activityIds: new Set(),
      academyId: academyObjectId,
      includeAllActivities: options.includeAllActivities,
    });

    return {
      groupId: String(groupId),
      eventId: eventObjectId ? String(eventObjectId) : null,
      academyId: academyObjectId ? String(academyObjectId) : null,
      activities: emptyActivities,
      rows: [],
      medalsByActivity: {},
    };
  }

  const match = getScoredMatch({
    participantId: {
      $in: participantIds,
    },
    ...(eventObjectId
      ? {
          eventId: eventObjectId,
        }
      : {}),
    ...(academyObjectId
      ? {
          academyId: academyObjectId,
        }
      : {}),
  });

  /**
   * total per participant + activity
   *
   * This sums scores from judges for the same participant/activity.
   * That is correct when multiple judges score different parts/activities.
   */
  const agg = await Score.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: {
          participantId: "$participantId",
          activityId: "$activityId",
        },
        total: {
          $sum: "$value",
        },
        scoredCount: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        "_id.activityId": 1,
        "_id.participantId": 1,
      },
    },
  ]);

  const activityIds = new Set();

  for (const row of agg) {
    if (row?._id?.activityId) {
      activityIds.add(String(row._id.activityId));
    }
  }

  const activities = await getActivitiesForTotals({
    activityIds,
    academyId: academyObjectId,
    includeAllActivities: options.includeAllActivities,
  });

  const activityIdSet = new Set(activities.map((a) => String(a._id)));

  /**
   * map:
   * participantId -> byActivity[activityId] = score
   */
  const byParticipant = new Map();

  for (const row of agg) {
    const pid = String(row._id.participantId);
    const aid = String(row._id.activityId);

    if (!activityIdSet.has(aid)) continue;

    if (!byParticipant.has(pid)) {
      byParticipant.set(pid, {});
    }

    byParticipant.get(pid)[aid] = Number(row.total || 0);
  }

  /**
   * Base rows
   */
  const rows = participants.map((p) => {
    const pid = String(p._id);
    const byActivity = byParticipant.get(pid) || {};

    const total = Object.values(byActivity).reduce(
      (sum, value) => sum + Number(value || 0),
      0,
    );

    return {
      participantId: pid,
      name: getParticipantName(p),
      groupId: p.groupId?._id ? String(p.groupId._id) : String(groupId),
      groupName: p.groupId?.name || "",
      level: p.groupId?.level || "",
      bibNo: p.bibNo || "",
      byActivity,
      total,
    };
  });

  /**
   * Medals per activity by threshold.
   * Only award medal if that participant actually has a scored value for that activity.
   */
  const medalsByActivity = {};

  for (const a of activities) {
    const aid = String(a._id);
    medalsByActivity[aid] = {};

    for (const r of rows) {
      const pid = String(r.participantId);

      const hasScore = Object.prototype.hasOwnProperty.call(
        r.byActivity || {},
        aid,
      );

      if (!hasScore) continue;

      const score = Number(r.byActivity?.[aid] ?? 0);
      const medal = medalByScore(score);

      if (medal) {
        medalsByActivity[aid][pid] = medal;
      }
    }
  }

  /**
   * Medal tally per participant
   */
  const medalTally = {};

  for (const r of rows) {
    const pid = String(r.participantId);
    medalTally[pid] = {
      G: 0,
      S: 0,
      B: 0,
      total: 0,
    };
  }

  for (const aid of Object.keys(medalsByActivity)) {
    const medalMap = medalsByActivity[aid] || {};

    for (const pid of Object.keys(medalMap)) {
      const medal = medalMap[pid];

      if (!medalTally[pid]) {
        medalTally[pid] = {
          G: 0,
          S: 0,
          B: 0,
          total: 0,
        };
      }

      if (medal === "G" || medal === "S" || medal === "B") {
        medalTally[pid][medal] += 1;
        medalTally[pid].total += 1;
      }
    }
  }

  /**
   * Sort leaderboard by:
   * 1. Total points
   * 2. Gold medals
   * 3. Silver medals
   * 4. Bronze medals
   * 5. Name
   */
  rows.sort((a, b) => {
    if (Number(b.total) !== Number(a.total)) {
      return Number(b.total) - Number(a.total);
    }

    const mb = medalTally[String(b.participantId)] || {
      G: 0,
      S: 0,
      B: 0,
    };

    const ma = medalTally[String(a.participantId)] || {
      G: 0,
      S: 0,
      B: 0,
    };

    if (mb.G !== ma.G) return mb.G - ma.G;
    if (mb.S !== ma.S) return mb.S - ma.S;
    if (mb.B !== ma.B) return mb.B - ma.B;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  return {
    groupId: String(groupId),
    eventId: eventObjectId ? String(eventObjectId) : null,
    academyId: academyObjectId ? String(academyObjectId) : null,
    activities,
    rows: rows.map((r, idx) => ({
      ...r,
      rank: idx + 1,
      total: Math.round(Number(r.total || 0) * 100) / 100,
      medals: medalTally[String(r.participantId)] || {
        G: 0,
        S: 0,
        B: 0,
        total: 0,
      },
    })),
    medalsByActivity,
  };
}

export default computeTotalsForGroup;
