import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    level: {
      type: String,
      default: "",
      trim: true,
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

// prevent duplicate same group+level inside the same academy
GroupSchema.index({ academyId: 1, name: 1, level: 1 }, { unique: true });

export default mongoose.model("Group", GroupSchema);
