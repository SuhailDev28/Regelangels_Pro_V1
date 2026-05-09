import mongoose from "mongoose";

const PAYMENT_METHODS = ["CASH", "ONLINE"];
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"];

function safeMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Number(n) : 0;
}

function normalizeStatus(value) {
  const v = String(value || "")
    .trim()
    .toUpperCase();

  if (PAYMENT_STATUSES.includes(v)) return v;
  return "PENDING";
}

const paymentSchema = new mongoose.Schema(
  {
    academyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Academy",
      default: null,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    parentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    parentEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },

    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      default: null,
      index: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
      index: true,
    },

    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventEnrollment",
      default: null,
      index: true,
    },

    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    amountDue: {
      type: Number,
      default: 0,
      min: 0,
    },

    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: "QAR",
      trim: true,
      uppercase: true,
    },

    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "CASH",
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "PENDING",
      index: true,
    },

    // UI compatibility mirror
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "PENDING",
      index: true,
    },

    gateway: {
      type: String,
      default: "",
      trim: true,
    },

    transactionId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    referenceNo: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    invoiceNo: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    receiptNo: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    receiptUrl: {
      type: String,
      default: "",
      trim: true,
    },

    dueDate: {
      type: Date,
      default: null,
      index: true,
    },

    paidAt: {
      type: Date,
      default: null,
      index: true,
    },

    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

/* =========================================================
   NORMALIZE / SYNC HELPERS
========================================================= */

paymentSchema.pre("validate", function paymentPreValidate(next) {
  this.amount = safeMoney(this.amount);
  this.totalAmount = safeMoney(this.totalAmount || this.amount);
  this.paidAmount = safeMoney(this.paidAmount);
  this.amountDue = safeMoney(this.amountDue);
  this.dueAmount = safeMoney(this.dueAmount);
  this.balance = safeMoney(this.balance);

  const normalizedStatus = normalizeStatus(this.paymentStatus || this.status);
  this.paymentStatus = normalizedStatus;
  this.status = normalizedStatus;

  if (!this.referenceNo && this.transactionId) {
    this.referenceNo = String(this.transactionId || "").trim();
  }

  if (!this.description && this.title) {
    this.description = this.title;
  }

  if (!this.title && this.description) {
    this.title = this.description;
  }

  // Prefer totalAmount, fallback to amount
  const baseTotal = safeMoney(this.totalAmount || this.amount);
  this.totalAmount = baseTotal;
  this.amount = safeMoney(this.amount || baseTotal);

  if (normalizedStatus === "PAID") {
    if (!this.paidAt) this.paidAt = new Date();

    if (this.paidAmount <= 0) {
      this.paidAmount = baseTotal;
    }

    this.amountDue = 0;
    this.dueAmount = 0;
    this.balance = 0;
  } else {
    const explicitDue =
      this.amountDue > 0 || this.dueAmount > 0 || this.balance > 0;

    if (!explicitDue) {
      const computedDue = Math.max(baseTotal - safeMoney(this.paidAmount), 0);
      this.amountDue = computedDue;
      this.dueAmount = computedDue;
      this.balance = computedDue;
    } else {
      const mergedDue = Math.max(
        this.amountDue || this.dueAmount || this.balance || 0,
        0,
      );
      this.amountDue = mergedDue;
      this.dueAmount = mergedDue;
      this.balance = mergedDue;
    }

    if (
      normalizedStatus !== "PAID" &&
      this.paidAmount > 0 &&
      this.amountDue <= 0
    ) {
      this.amountDue = 0;
      this.dueAmount = 0;
      this.balance = 0;
    }
  }

  next();
});

/* =========================================================
   INDEXES
========================================================= */

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ academyId: 1, createdAt: -1 });
paymentSchema.index({ academyId: 1, paymentStatus: 1, createdAt: -1 });
paymentSchema.index({ eventId: 1, paymentStatus: 1 });
paymentSchema.index({ userId: 1, paymentStatus: 1 });
paymentSchema.index({ parentUserId: 1, paymentStatus: 1 });
paymentSchema.index({ parentEmail: 1, paymentStatus: 1 });
paymentSchema.index({ participantId: 1, paymentStatus: 1 });
paymentSchema.index({ invoiceNo: 1, academyId: 1 });
paymentSchema.index({ receiptNo: 1, academyId: 1 });
paymentSchema.index({ referenceNo: 1, academyId: 1 });
paymentSchema.index({ transactionId: 1, academyId: 1 });

// one payment per enrollment
paymentSchema.index({ enrollmentId: 1 }, { unique: true, sparse: true });

export default mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);
