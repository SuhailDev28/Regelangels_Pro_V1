import mongoose from "mongoose";

const JudgeAssignmentSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
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

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },

    level: {
      type: String,
      trim: true,
      default: "",
      index: true,
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

// Prevent duplicate assignment per academy/event/judge/activity/scope
JudgeAssignmentSchema.index(
  {
    academyId: 1,
    eventId: 1,
    judgeUserId: 1,
    activityId: 1,
    groupId: 1,
    level: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      eventId: { $exists: true },
      judgeUserId: { $exists: true },
      activityId: { $exists: true },
      academyId: { $exists: true },
    },
  },
);

// useful for judge dashboard queries
JudgeAssignmentSchema.index({
  academyId: 1,
  judgeUserId: 1,
  eventId: 1,
});

JudgeAssignmentSchema.index({
  academyId: 1,
  eventId: 1,
  groupId: 1,
});

export default mongoose.model("JudgeAssignment", JudgeAssignmentSchema);
