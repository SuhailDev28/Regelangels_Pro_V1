import mongoose from "mongoose";

const scoreDraftSchema = new mongoose.Schema(
  {
    localId: { type: String, required: true, index: true, unique: true },
    judgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      default: null,
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
      required: true,
      index: true,
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
      index: true,
    },
    participantName: { type: String, default: "" },
    scores: { type: Object, default: {} },
    notes: { type: String, default: "" },
    submitted: { type: Boolean, default: false },
    lastClientUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.models.ScoreDraft ||
  mongoose.model("ScoreDraft", scoreDraftSchema);
