import mongoose from "mongoose";

const emailSettingSchema = new mongoose.Schema(
  {
    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      default: null,
      index: true,
    },

    provider: {
      type: String,
      default: "smtp",
      trim: true,
      lowercase: true,
    },

    host: {
      type: String,
      default: "",
      trim: true,
    },

    port: {
      type: Number,
      default: 587,
    },

    secure: {
      type: Boolean,
      default: false,
    },

    username: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      default: "",
      trim: true,
    },

    fromName: {
      type: String,
      default: "Rebel Angels Gymnastics Academy",
      trim: true,
    },

    fromEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    replyTo: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    isEnabled: {
      type: Boolean,
      default: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

emailSettingSchema.index(
  { academyId: 1 },
  {
    unique: true,
    partialFilterExpression: { academyId: { $type: "objectId" } },
  },
);

const EmailSetting =
  mongoose.models.EmailSetting ||
  mongoose.model("EmailSetting", emailSettingSchema);

export default EmailSetting;
