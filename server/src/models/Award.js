import mongoose from "mongoose";

const AwardSchema = new mongoose.Schema(
  {
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

    type: {
      type: String,
      enum: ["MEDAL", "CERTIFICATE"],
      required: true,
      index: true,
    },

    // e.g. GOLD, SILVER, BRONZE, PARTICIPATION
    title: {
      type: String,
      trim: true,
      default: "",
    },

    issuedAt: {
      type: Date,
      default: Date.now,
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

/**
 * Prevent duplicates per academy + event:
 * - one MEDAL per participant per event
 * - one CERTIFICATE per participant per event
 */
AwardSchema.index(
  { academyId: 1, eventId: 1, participantId: 1, type: 1 },
  { unique: true },
);

// helpful for admin lists and leaderboard medal lookup
AwardSchema.index({ academyId: 1, eventId: 1, type: 1 });

// helpful for participant award history
AwardSchema.index({ academyId: 1, participantId: 1, createdAt: -1 });

export default mongoose.model("Award", AwardSchema);
