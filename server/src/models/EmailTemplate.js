import mongoose from "mongoose";

const emailTemplateSchema = new mongoose.Schema(
  {
    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      default: null,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
      index: true,
    },

    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
    },

    category: {
      type: String,
      trim: true,
      uppercase: true,
      enum: [
        "GENERAL",
        "ANNOUNCEMENT",
        "PAYMENT",
        "EVENT",
        "REGISTRATION",
        "RESULT",
        "CERTIFICATE",
        "REMINDER",
      ],
      default: "GENERAL",
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },

    html: {
      type: String,
      default: "",
    },

    text: {
      type: String,
      default: "",
    },

    variables: {
      type: [String],
      default: [],
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

emailTemplateSchema.index(
  { academyId: 1, key: 1 },
  { unique: true, partialFilterExpression: { key: { $type: "string" } } },
);

emailTemplateSchema.index({ academyId: 1, category: 1, isActive: 1 });
emailTemplateSchema.index({ academyId: 1, createdAt: -1 });
emailTemplateSchema.index({ isSystem: 1, isActive: 1 });

emailTemplateSchema.pre("validate", function (next) {
  this.name = String(this.name || "").trim();
  this.key = String(this.key || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");

  if (Array.isArray(this.variables)) {
    this.variables = [
      ...new Set(
        this.variables.map((v) => String(v || "").trim()).filter(Boolean),
      ),
    ];
  } else {
    this.variables = [];
  }

  next();
});

export default mongoose.models.EmailTemplate ||
  mongoose.model("EmailTemplate", emailTemplateSchema);
