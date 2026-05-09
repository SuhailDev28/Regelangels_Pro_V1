import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    maxScore: {
      type: Number,
      default: 10,
      min: 0,
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

// prevent duplicate activity names inside the same academy
ActivitySchema.index({ academyId: 1, name: 1 }, { unique: true });

export default mongoose.model("Activity", ActivitySchema);
