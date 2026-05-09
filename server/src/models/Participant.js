import mongoose from "mongoose";

const ParticipantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },

    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
      index: true,
    },

    parentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    parentEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },

    age: {
      type: Number,
      default: null,
      min: 0,
    },

    bibNo: {
      type: String,
      default: "",
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    category: {
      type: String,
      default: "",
      trim: true,
    },

    rank: {
      type: Number,
      default: null,
      min: 1,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// one participant profile per user per academy
ParticipantSchema.index({ academyId: 1, userId: 1 }, { unique: true });

// optional: bib number unique inside one academy only,
// but only when bibNo is non-empty
ParticipantSchema.index(
  { academyId: 1, bibNo: 1 },
  {
    unique: true,
    partialFilterExpression: { bibNo: { $type: "string", $ne: "" } },
  },
);

// useful query helpers
ParticipantSchema.index({ academyId: 1, groupId: 1 });
ParticipantSchema.index({ academyId: 1, eventId: 1 });
ParticipantSchema.index({ academyId: 1, parentUserId: 1 });

export default mongoose.models.Participant ||
  mongoose.model("Participant", ParticipantSchema);
