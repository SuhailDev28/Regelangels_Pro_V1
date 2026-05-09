// server/src/models/Certificate.js
import mongoose from "mongoose";

const CertificateSchema = new mongoose.Schema(
  {
    serialNo: {
      type: String,
      required: true,
      trim: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
      index: true,
    },

    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
      index: true,
    },

    awardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Award",
      default: null,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["CERTIFICATE", "MEDAL"],
      default: "CERTIFICATE",
      index: true,
    },

    participantName: {
      type: String,
      required: true,
      trim: true,
    },

    groupName: {
      type: String,
      default: "",
      trim: true,
    },

    level: {
      type: String,
      default: "",
      trim: true,
    },

    bibNo: {
      type: String,
      default: "",
      trim: true,
    },

    eventName: {
      type: String,
      default: "",
      trim: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokeReason: {
      type: String,
      default: "",
      trim: true,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

CertificateSchema.index({ academyId: 1, serialNo: 1 }, { unique: true });

CertificateSchema.index(
  {
    academyId: 1,
    eventId: 1,
    participantId: 1,
    title: 1,
    type: 1,
    isRevoked: 1,
  },
  { unique: false },
);

CertificateSchema.index({ academyId: 1, eventId: 1, createdAt: -1 });
CertificateSchema.index({ academyId: 1, participantId: 1, createdAt: -1 });
CertificateSchema.index({ academyId: 1, eventId: 1, serialNo: 1 });
CertificateSchema.index({ academyId: 1, isRevoked: 1, createdAt: -1 });

export default mongoose.model("Certificate", CertificateSchema);
