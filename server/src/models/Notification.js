// server/src/models/Notification.js
import mongoose from "mongoose";

export const NOTIFICATION_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "ACADEMY_ADMIN",
  "MANAGER",
  "STAFF",
  "JUDGE",
  "PARENT",
  "PARTICIPANT",
];

export const NOTIFICATION_CATEGORIES = [
  "MESSAGE",
  "PAYMENT",
  "BOOKING",
  "EVENT",
  "RESULT",
  "CERTIFICATE",
  "ASSIGNMENT",
  "REGISTRATION",
  "SYSTEM",
];

export const NOTIFICATION_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

function isValidActionUrl(value) {
  const v = String(value || "").trim();
  if (!v) return true;
  if (v.startsWith("/")) return true;
  return /^https?:\/\//i.test(v);
}

const notificationSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },

    recipientRole: {
      type: String,
      required: true,
      enum: NOTIFICATION_ROLES,
      uppercase: true,
      trim: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_CATEGORIES,
      trim: true,
      uppercase: true,
      index: true,
    },

    category: {
      type: String,
      enum: NOTIFICATION_CATEGORIES,
      default: "SYSTEM",
      uppercase: true,
      trim: true,
      index: true,
    },

    priority: {
      type: String,
      enum: NOTIFICATION_PRIORITIES,
      default: "NORMAL",
      uppercase: true,
      trim: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },

    message: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    actionUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
      validate: {
        validator: isValidActionUrl,
        message:
          "actionUrl must be an internal path or absolute http/https URL",
      },
    },

    entityType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  },
);

notificationSchema.pre("validate", function normalizeNotification(next) {
  if (this.recipientRole) {
    this.recipientRole = String(this.recipientRole).toUpperCase();
  }

  if (this.type) {
    this.type = String(this.type).toUpperCase();
  }

  if (this.category) {
    this.category = String(this.category).toUpperCase();
  }

  if (this.priority) {
    this.priority = String(this.priority).toUpperCase();
  }

  if (!this.category && this.type) {
    this.category = this.type;
  }

  if (!this.isRead) {
    this.readAt = null;
  } else if (this.isRead && !this.readAt) {
    this.readAt = new Date();
  }

  next();
});

notificationSchema.index({
  recipientUserId: 1,
  deletedAt: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipientUserId: 1,
  deletedAt: 1,
  isRead: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipientUserId: 1,
  recipientRole: 1,
  deletedAt: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipientUserId: 1,
  recipientRole: 1,
  deletedAt: 1,
  isRead: 1,
});

notificationSchema.index({
  recipientUserId: 1,
  recipientRole: 1,
  academyId: 1,
  deletedAt: 1,
  isRead: 1,
  createdAt: -1,
});

notificationSchema.index({
  academyId: 1,
  recipientRole: 1,
  deletedAt: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipientUserId: 1,
  academyId: 1,
  deletedAt: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipientUserId: 1,
  category: 1,
  deletedAt: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipientUserId: 1,
  type: 1,
  deletedAt: 1,
  createdAt: -1,
});

notificationSchema.index({
  entityType: 1,
  entityId: 1,
  createdAt: -1,
});

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
