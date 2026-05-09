import mongoose from "mongoose";

const EventEnrollmentSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    // Participant PROFILE _id
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
      index: true,
    },

    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },

    // snapshot fields (useful if participant changes later)
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },

    bibNo: {
      type: String,
      trim: true,
      default: "",
    },

    // email integration ready for later use
    emailStatus: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED", "SKIPPED"],
      default: "PENDING",
      index: true,
    },

    emailSentAt: {
      type: Date,
      default: null,
    },

    emailError: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

// prevent duplicate enrollments inside same academy event
EventEnrollmentSchema.index(
  { academyId: 1, eventId: 1, participantId: 1 },
  { unique: true },
);

// optional: prevent duplicate bib numbers per event
EventEnrollmentSchema.index(
  { eventId: 1, bibNo: 1 },
  {
    unique: true,
    partialFilterExpression: { bibNo: { $type: "string", $ne: "" } },
  },
);

export default mongoose.model("EventEnrollment", EventEnrollmentSchema);
