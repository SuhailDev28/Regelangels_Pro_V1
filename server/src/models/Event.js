import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    venue: {
      type: String,
      trim: true,
      default: "",
    },

    // main stored field
    notes: {
      type: String,
      trim: true,
      default: "",
      alias: "note", // backward-compatible alias
    },

    // optional legacy single date
    date: {
      type: Date,
      default: null,
    },

    // main stored fields
    startDate: {
      type: Date,
      default: null,
      alias: "startsAt", // backward-compatible alias
    },

    endDate: {
      type: Date,
      default: null,
      alias: "endsAt", // backward-compatible alias
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["DRAFT", "LIVE", "CLOSED"],
      default: "DRAFT",
      index: true,
    },

    registrationFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["CASH"],
      default: "CASH",
    },

    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// event code unique only inside the same academy when code is non-empty
EventSchema.index(
  { academyId: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: {
      code: { $type: "string", $ne: "" },
    },
  },
);

// optional duplicate protection for same academy + same event name
EventSchema.index({ academyId: 1, name: 1 }, { unique: false });

export default mongoose.model("Event", EventSchema);
