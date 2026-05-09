import mongoose from "mongoose";

export const SCORE_STATUS = ["SCORED", "ABSENT", "DQ", "RETRY", "WITHDRAWN"];

export function normalizeScoreStatus(value = "SCORED") {
  return String(value || "SCORED")
    .trim()
    .toUpperCase();
}

export function normalizeScorePayload(payload = {}) {
  const status = normalizeScoreStatus(payload.status || "SCORED");

  if (!SCORE_STATUS.includes(status)) {
    throw new Error(`Invalid score status: ${status}`);
  }

  let value = payload.value;

  if (status === "SCORED") {
    if (value === null || value === undefined || value === "") {
      throw new Error("value is required when status is SCORED");
    }

    value = Number(value);

    if (!Number.isFinite(value)) {
      throw new Error("value must be a valid number");
    }

    if (value < 0) {
      throw new Error("value must be >= 0");
    }
  } else {
    value = null;
  }

  const comment = String(payload.comment || payload.notes || "").trim();

  const isFinal = Boolean(payload.isFinal);
  const finalizedAt = isFinal ? payload.finalizedAt || new Date() : null;

  const scoredAt =
    status === "SCORED"
      ? payload.scoredAt || new Date()
      : payload.scoredAt || null;

  return {
    value,
    status,
    comment,
    notes: comment,
    isFinal,
    finalizedAt,
    scoredAt,
  };
}

const ScoreSchema = new mongoose.Schema(
  {
    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
      index: true,
    },

    judgeUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Activity",
      required: true,
      index: true,
    },

    value: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator(value) {
          if (this.status !== "SCORED") return true;
          return (
            value !== null && value !== undefined && Number.isFinite(value)
          );
        },
        message: "value is required when status is SCORED",
      },
    },

    status: {
      type: String,
      enum: SCORE_STATUS,
      default: "SCORED",
      index: true,
      set: normalizeScoreStatus,
    },

    comment: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    isFinal: {
      type: Boolean,
      default: false,
      index: true,
    },

    finalizedAt: {
      type: Date,
      default: null,
    },

    scoredAt: {
      type: Date,
      default: null,
      index: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

/* =========================================
 * Validation / normalization for .save()
 * ========================================= */
ScoreSchema.pre("validate", function (next) {
  try {
    const normalized = normalizeScorePayload({
      value: this.value,
      status: this.status,
      comment: this.comment,
      notes: this.notes,
      isFinal: this.isFinal,
      finalizedAt: this.finalizedAt,
      scoredAt: this.scoredAt,
    });

    this.value = normalized.value;
    this.status = normalized.status;
    this.comment = normalized.comment;
    this.notes = normalized.notes;
    this.isFinal = normalized.isFinal;
    this.finalizedAt = normalized.finalizedAt;

    if (this.status === "SCORED" && !this.scoredAt) {
      this.scoredAt = normalized.scoredAt || new Date();
    }

    if (this.status !== "SCORED") {
      this.value = null;
    }

    next();
  } catch (err) {
    next(err);
  }
});

/* =========================================
 * Validation / normalization for updates
 * Supports findOneAndUpdate / updateOne / updateMany
 * ========================================= */
function normalizeScoreUpdate(next) {
  try {
    const update = this.getUpdate() || {};

    const $set = update.$set || {};
    const direct = { ...update };

    delete direct.$set;
    delete direct.$setOnInsert;
    delete direct.$unset;
    delete direct.$inc;
    delete direct.$push;
    delete direct.$pull;
    delete direct.$addToSet;

    const merged = {
      ...direct,
      ...$set,
    };

    if (merged.status) {
      merged.status = normalizeScoreStatus(merged.status);
    }

    const hasStatus = Object.prototype.hasOwnProperty.call(merged, "status");
    const hasValue = Object.prototype.hasOwnProperty.call(merged, "value");

    const status = normalizeScoreStatus(merged.status || "SCORED");

    if (hasStatus && !SCORE_STATUS.includes(status)) {
      throw new Error(`Invalid score status: ${status}`);
    }

    if (hasStatus && status !== "SCORED") {
      $set.status = status;
      $set.value = null;
    }

    if (hasStatus && status === "SCORED") {
      if (
        !hasValue ||
        merged.value === null ||
        merged.value === undefined ||
        merged.value === ""
      ) {
        throw new Error("value is required when status is SCORED");
      }

      const value = Number(merged.value);

      if (!Number.isFinite(value)) {
        throw new Error("value must be a valid number");
      }

      if (value < 0) {
        throw new Error("value must be >= 0");
      }

      $set.status = status;
      $set.value = value;

      if (!$set.scoredAt) {
        $set.scoredAt = new Date();
      }
    }

    if (Object.prototype.hasOwnProperty.call(merged, "comment")) {
      $set.comment = String(merged.comment || "").trim();

      if (!Object.prototype.hasOwnProperty.call(merged, "notes")) {
        $set.notes = $set.comment;
      }
    }

    if (Object.prototype.hasOwnProperty.call(merged, "notes")) {
      $set.notes = String(merged.notes || "").trim();

      if (!Object.prototype.hasOwnProperty.call(merged, "comment")) {
        $set.comment = $set.notes;
      }
    }

    if (Object.prototype.hasOwnProperty.call(merged, "isFinal")) {
      $set.isFinal = Boolean(merged.isFinal);

      if ($set.isFinal && !merged.finalizedAt) {
        $set.finalizedAt = new Date();
      }

      if (!$set.isFinal) {
        $set.finalizedAt = null;
      }
    }

    this.setUpdate({
      ...update,
      $set,
    });

    next();
  } catch (err) {
    next(err);
  }
}

ScoreSchema.pre("findOneAndUpdate", normalizeScoreUpdate);
ScoreSchema.pre("updateOne", normalizeScoreUpdate);
ScoreSchema.pre("updateMany", normalizeScoreUpdate);

/* =========================================
 * Indexes
 * ========================================= */

/**
 * One judge can have only one score for:
 * academy + event + participant + judge + activity
 */
ScoreSchema.index(
  {
    academyId: 1,
    eventId: 1,
    participantId: 1,
    judgeUserId: 1,
    activityId: 1,
  },
  {
    unique: true,
    name: "uniq_score_per_judge_activity_participant",
  },
);

/**
 * Leaderboard / participant total calculation
 */
ScoreSchema.index(
  {
    academyId: 1,
    eventId: 1,
    participantId: 1,
  },
  {
    name: "idx_score_participant_totals",
  },
);

/**
 * Judge dashboard loading
 */
ScoreSchema.index(
  {
    academyId: 1,
    eventId: 1,
    judgeUserId: 1,
  },
  {
    name: "idx_score_judge_event",
  },
);

/**
 * Judge dashboard activity loading
 */
ScoreSchema.index(
  {
    academyId: 1,
    eventId: 1,
    judgeUserId: 1,
    activityId: 1,
  },
  {
    name: "idx_score_judge_activity",
  },
);

/**
 * Activity-wise result calculation
 */
ScoreSchema.index(
  {
    academyId: 1,
    eventId: 1,
    activityId: 1,
    status: 1,
  },
  {
    name: "idx_score_activity_status",
  },
);

/**
 * Finalization checks
 */
ScoreSchema.index(
  {
    academyId: 1,
    eventId: 1,
    judgeUserId: 1,
    activityId: 1,
    isFinal: 1,
  },
  {
    name: "idx_score_judge_activity_final",
  },
);

/**
 * Admin audit / latest score updates
 */
ScoreSchema.index(
  {
    academyId: 1,
    eventId: 1,
    updatedAt: -1,
  },
  {
    name: "idx_score_latest_updates",
  },
);

/**
 * Admin audit by updated user
 */
ScoreSchema.index(
  {
    academyId: 1,
    eventId: 1,
    updatedBy: 1,
    updatedAt: -1,
  },
  {
    name: "idx_score_updated_by",
  },
);

/**
 * Status-based reporting
 */
ScoreSchema.index(
  {
    academyId: 1,
    eventId: 1,
    status: 1,
  },
  {
    name: "idx_score_event_status",
  },
);

export default mongoose.models.Score || mongoose.model("Score", ScoreSchema);
