import mongoose from "mongoose";

const AcademyRegistrationSchema = new mongoose.Schema(
  {
    academyNameEn: { type: String, required: true, trim: true },
    academyNameAr: { type: String, trim: true, default: "" },

    legalEntityType: {
      type: String,
      default: "LLC",
      trim: true,
    },

    commercialRegistrationNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    tradeLicenseNumber: {
      type: String,
      trim: true,
      default: "",
    },

    activityType: {
      type: String,
      required: true,
      trim: true,
    },

    authorizedSignatoryName: {
      type: String,
      required: true,
      trim: true,
    },

    authorizedSignatoryIdNumber: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    municipality: {
      type: String,
      trim: true,
      default: "",
    },

    zone: {
      type: String,
      trim: true,
      default: "",
    },

    streetAddress: {
      type: String,
      trim: true,
      default: "",
    },

    logoUrl: {
      type: String,
      default: "",
    },

    competentAuthorityApprovalRequired: {
      type: Boolean,
      default: false,
    },

    declarationAccepted: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "ACTIVATED"],
      default: "PENDING",
      index: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedReason: {
      type: String,
      trim: true,
      default: "",
    },

    academyCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      index: true,
    },

    activationToken: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    activationTokenExpiresAt: {
      type: Date,
      default: null,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      default: null,
    },

    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.models.AcademyRegistration ||
  mongoose.model("AcademyRegistration", AcademyRegistrationSchema);
