import mongoose from "mongoose";

const emailAddressField = {
  type: String,
  trim: true,
  lowercase: true,
};

const emailLogSchema = new mongoose.Schema(
  {
    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      default: null,
      index: true,
    },

    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    recipientRole: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
    },

    to: {
      type: [emailAddressField],
      required: true,
      default: [],
      index: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one recipient is required",
      },
    },

    cc: {
      type: [emailAddressField],
      default: [],
    },

    bcc: {
      type: [emailAddressField],
      default: [],
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    html: {
      type: String,
      default: "",
    },

    text: {
      type: String,
      default: "",
    },

    template: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
    },

    templateKey: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },

    triggerEvent: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED", "SKIPPED"],
      default: "PENDING",
      index: true,
    },

    provider: {
      type: String,
      default: "smtp",
      trim: true,
      lowercase: true,
    },

    providerMessageId: {
      type: String,
      default: "",
      trim: true,
    },

    errorMessage: {
      type: String,
      default: "",
    },

    sentAt: {
      type: Date,
      default: null,
    },

    variables: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

emailLogSchema.index({ academyId: 1, createdAt: -1 });
emailLogSchema.index({ academyId: 1, status: 1, createdAt: -1 });
emailLogSchema.index({ academyId: 1, templateKey: 1, createdAt: -1 });
emailLogSchema.index({ academyId: 1, recipientUserId: 1, createdAt: -1 });
emailLogSchema.index({ academyId: 1, triggerEvent: 1, createdAt: -1 });

export default mongoose.models.EmailLog ||
  mongoose.model("EmailLog", emailLogSchema);
