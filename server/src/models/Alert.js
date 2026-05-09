import mongoose from "mongoose";

function normalizePriority(v) {
  const p = String(v || "")
    .trim()
    .toUpperCase();

  if (p === "NORMAL") return "MEDIUM";
  if (p === "LOW" || p === "MEDIUM" || p === "HIGH") return p;

  return "HIGH";
}

const AlertSchema = new mongoose.Schema(
  {
    judgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Activity",
      default: null,
      index: true,
    },

    message: {
      type: String,
      default: "",
      trim: true,
    },

    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "HIGH",
      set: normalizePriority,
      index: true,
    },

    status: {
      type: String,
      enum: ["OPEN", "RESOLVED"],
      default: "OPEN",
      index: true,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    meta: {
      type: Object,
      default: {},
    },

    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

/* =========================================
 * Indexes for fast admin dashboard queries
 * ========================================= */
AlertSchema.index({ academyId: 1, status: 1, createdAt: -1 });
AlertSchema.index({ academyId: 1, judgeId: 1, createdAt: -1 });
AlertSchema.index({ academyId: 1, eventId: 1, createdAt: -1 });
AlertSchema.index({ academyId: 1, activityId: 1, status: 1 });
AlertSchema.index({ academyId: 1, eventId: 1, activityId: 1, status: 1 });

export default mongoose.model("Alert", AlertSchema);
