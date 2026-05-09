import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN", "JUDGE", "PARTICIPANT", "PARENT"],
      required: true,
      index: true,
    },

    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      required: function () {
        return this.role !== "SUPER_ADMIN";
      },
      index: true,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    resetTokenHash: {
      type: String,
      default: "",
    },

    resetTokenExp: {
      type: Date,
      default: null,
    },

    // ---------------------------------
    // FIRST LOGIN / TEMP PASSWORD FLOW
    // ---------------------------------
    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true,
    },

    tempPasswordIssuedAt: {
      type: Date,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

/* =========================
 * UNIQUE EMAIL RULES
 * ========================= */

// academy-scoped unique email for non-super-admin users
UserSchema.index(
  { academyId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: { $ne: "SUPER_ADMIN" },
      academyId: { $type: "objectId" },
      email: { $type: "string" },
    },
  },
);

// globally unique email for super admins
UserSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: "SUPER_ADMIN",
      email: { $type: "string" },
    },
  },
);

UserSchema.index({ role: 1, academyId: 1 });
UserSchema.index({ academyId: 1, isActive: 1 });
UserSchema.index({ academyId: 1, mustChangePassword: 1 });
UserSchema.index({ role: 1, mustChangePassword: 1 });

export default mongoose.models.User || mongoose.model("User", UserSchema);
