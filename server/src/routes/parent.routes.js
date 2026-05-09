import express from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

import Payment from "../models/Payment.js";
import User from "../models/User.js";
import Participant from "../models/Participant.js";
import Event from "../models/Event.js";
import EventEnrollment from "../models/EventEnrollment.js";
import {
  createNotification,
  emitNotification,
} from "../services/notification.service.js";
import { triggerAutoEmail } from "../services/autoEmailTrigger.service.js";

const router = express.Router();
router.use(auth, requireRole("ADMIN", "SUPER_ADMIN"));

/* =========================
 * Async wrapper
 * ========================= */
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* =========================
 * Helpers
 * ========================= */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function normalizeId(value) {
  return String(value || "").trim();
}

function uniqIds(ids = []) {
  return [...new Set(ids.map((x) => normalizeId(x)).filter(Boolean))];
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDateYmd(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getScopeAcademyId(req) {
  if (req.user?.role !== "SUPER_ADMIN") return req.academyId || null;

  const fromHeader = req.get("x-academy-id");
  const fromQuery = req.query?.academyId;
  const fromBody = req.body?.academyId;

  const candidate = [fromHeader, fromQuery, fromBody]
    .map((v) => String(v || "").trim())
    .find(Boolean);

  return candidate || null;
}

function requireScopedAcademy(req, res) {
  const academyId = getScopeAcademyId(req);
  if (!academyId) {
    res.status(400).json({ message: "Academy scope is required" });
    return null;
  }
  if (!isValidObjectId(academyId)) {
    res.status(400).json({ message: "Invalid academyId" });
    return null;
  }
  return academyId;
}

function normalizePaymentMethod(v) {
  const x = String(v || "")
    .trim()
    .toUpperCase();
  return x === "ONLINE" ? "ONLINE" : "CASH";
}

function normalizePaymentStatus(v, fallback = "PENDING") {
  const x = String(v || "")
    .trim()
    .toUpperCase();

  if (["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"].includes(x)) {
    return x;
  }

  return fallback;
}

function pickDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getParticipantDisplayName(payment) {
  return (
    payment?.participantId?.userId?.name ||
    payment?.participantId?.name ||
    payment?.userId?.name ||
    payment?.parentUserId?.name ||
    ""
  );
}

function getParticipantDisplayEmail(payment) {
  return (
    payment?.participantId?.userId?.email ||
    payment?.userId?.email ||
    payment?.parentEmail ||
    payment?.parentUserId?.email ||
    ""
  );
}

function computeDueAmounts({
  amount = 0,
  totalAmount = 0,
  paidAmount = 0,
  amountDue = 0,
  dueAmount = 0,
  balance = 0,
  paymentStatus = "PENDING",
}) {
  const safeAmount = safeMoney(amount);
  const safeTotalAmount = safeMoney(totalAmount || safeAmount);
  const safePaidAmount = safeMoney(paidAmount);
  const status = normalizePaymentStatus(paymentStatus, "PENDING");

  if (status === "PAID") {
    return {
      amount: safeAmount || safeTotalAmount,
      totalAmount: safeTotalAmount || safeAmount,
      paidAmount:
        safePaidAmount > 0 ? safePaidAmount : safeTotalAmount || safeAmount,
      amountDue: 0,
      dueAmount: 0,
      balance: 0,
    };
  }

  const explicitDue = [amountDue, dueAmount, balance].some(
    (v) => Number(v || 0) > 0,
  );

  const computedDue = explicitDue
    ? Math.max(safeMoney(amountDue || dueAmount || balance), 0)
    : Math.max(safeTotalAmount - safePaidAmount, 0);

  return {
    amount: safeAmount || safeTotalAmount,
    totalAmount: safeTotalAmount || safeAmount,
    paidAmount: safePaidAmount,
    amountDue: computedDue,
    dueAmount: computedDue,
    balance: computedDue,
  };
}

function buildPaymentTitle({ participantName, eventName }) {
  const safeParticipant = String(participantName || "Participant").trim();
  const safeEvent = String(eventName || "Event").trim();
  return `${safeParticipant} - ${safeEvent} Payment`;
}

function buildPaymentDescription({
  participantName,
  eventName,
  paymentMethod,
}) {
  const safeParticipant = String(participantName || "Participant").trim();
  const safeEvent = String(eventName || "Event").trim();
  const safeMethod = String(paymentMethod || "CASH")
    .trim()
    .toUpperCase();
  return `Payment for ${safeParticipant} for ${safeEvent} via ${safeMethod}`;
}

function buildPaymentDoc(payment, academyId) {
  return {
    id: payment._id.toString(),
    academyId:
      payment.academyId?._id?.toString?.() ||
      payment.academyId?.toString?.() ||
      academyId ||
      null,

    userId: payment.userId
      ? {
          id: payment.userId._id?.toString?.() || payment.userId.toString?.(),
          name: payment.userId.name || "",
          email: payment.userId.email || "",
          role: payment.userId.role || "",
        }
      : null,

    parentUserId: payment.parentUserId
      ? {
          id:
            payment.parentUserId._id?.toString?.() ||
            payment.parentUserId.toString?.(),
          name: payment.parentUserId.name || "",
          email: payment.parentUserId.email || "",
          role: payment.parentUserId.role || "",
        }
      : null,

    parentEmail: payment.parentEmail || "",

    participantId: payment.participantId
      ? {
          id:
            payment.participantId._id?.toString?.() ||
            payment.participantId.toString?.(),
          name: getParticipantDisplayName(payment),
          email: getParticipantDisplayEmail(payment),
          bibNo: payment.participantId.bibNo || "",
          age: payment.participantId.age ?? null,
          parentUserId:
            payment.participantId.parentUserId?._id?.toString?.() ||
            payment.participantId.parentUserId?.toString?.() ||
            null,
          parentEmail: payment.participantId.parentEmail || "",
        }
      : null,

    eventId: payment.eventId
      ? {
          id: payment.eventId._id?.toString?.() || payment.eventId.toString?.(),
          name: payment.eventId.name || payment.eventId.title || "",
          code: payment.eventId.code || "",
          status: payment.eventId.status || "",
        }
      : null,

    enrollmentId:
      payment.enrollmentId?._id?.toString?.() ||
      payment.enrollmentId?.toString?.() ||
      null,

    title: payment.title || "",
    description: payment.description || "",

    amount: Number(payment.amount || 0),
    totalAmount: Number(payment.totalAmount || payment.amount || 0),
    paidAmount: Number(payment.paidAmount || 0),
    amountDue: Number(payment.amountDue || 0),
    dueAmount: Number(payment.dueAmount || 0),
    balance: Number(payment.balance || 0),

    currency: String(payment.currency || "QAR").toUpperCase(),
    paymentMethod: payment.paymentMethod || "CASH",
    paymentStatus: payment.paymentStatus || "PENDING",
    status: payment.status || payment.paymentStatus || "PENDING",

    gateway: payment.gateway || "",
    transactionId: payment.transactionId || "",
    referenceNo: payment.referenceNo || "",
    invoiceNo: payment.invoiceNo || "",
    receiptNo: payment.receiptNo || "",
    receiptUrl: payment.receiptUrl || "",
    paidAt: payment.paidAt || null,
    dueDate: payment.dueDate || null,

    confirmedBy: payment.confirmedBy
      ? {
          id:
            payment.confirmedBy._id?.toString?.() ||
            payment.confirmedBy.toString?.(),
          name: payment.confirmedBy.name || "",
          email: payment.confirmedBy.email || "",
        }
      : null,

    notes: payment.notes || "",
    meta: payment.meta || {},
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

async function ensureScopedRefs({
  academyId,
  userId,
  participantId,
  eventId,
  enrollmentId,
}) {
  if (userId) {
    const user = await User.findOne({ _id: userId, academyId }).lean();
    if (!user) throw new Error("User not found in academy scope");
  }

  if (participantId) {
    const participant = await Participant.findOne({
      _id: participantId,
      academyId,
    }).lean();
    if (!participant) throw new Error("Participant not found in academy scope");
  }

  if (eventId) {
    const event = await Event.findOne({ _id: eventId, academyId }).lean();
    if (!event) throw new Error("Event not found in academy scope");
  }

  if (enrollmentId) {
    const enrollment = await EventEnrollment.findOne({
      _id: enrollmentId,
      academyId,
    }).lean();

    if (!enrollment) {
      throw new Error("Enrollment not found in academy scope");
    }
  }
}

async function autoFillRefsFromEnrollment({
  academyId,
  enrollmentId,
  participantId,
  eventId,
  userId,
}) {
  if (!enrollmentId) {
    return { participantId, eventId, userId };
  }

  const enrollment = await EventEnrollment.findOne({
    _id: enrollmentId,
    academyId,
  }).lean();

  if (!enrollment) {
    throw new Error("Enrollment not found in academy scope");
  }

  const nextParticipantId =
    participantId || normalizeId(enrollment.participantId);
  const nextEventId = eventId || normalizeId(enrollment.eventId);

  let nextUserId = userId || "";

  if (!nextUserId && nextParticipantId) {
    const participant = await Participant.findOne({
      _id: nextParticipantId,
      academyId,
    }).lean();

    nextUserId = normalizeId(participant?.userId);
  }

  return {
    participantId: nextParticipantId || null,
    eventId: nextEventId || null,
    userId: nextUserId || null,
  };
}

async function resolveParticipantParentFields({ academyId, participantId }) {
  if (!participantId || !isValidObjectId(participantId)) {
    return {
      parentUserId: null,
      parentEmail: "",
      participantName: "Participant",
      participantUserId: null,
      groupName: "",
      level: "",
    };
  }

  const participant = await Participant.findOne({
    _id: participantId,
    academyId,
  })
    .populate("userId", "name fullName email")
    .populate("parentUserId", "name email role")
    .populate("groupId", "name level")
    .lean();

  return {
    parentUserId:
      participant?.parentUserId?._id || participant?.parentUserId || null,
    parentEmail:
      participant?.parentUserId?.email ||
      participant?.parentEmail ||
      participant?.userId?.email ||
      "",
    participantName:
      participant?.userId?.name ||
      participant?.userId?.fullName ||
      participant?.name ||
      "Participant",
    participantUserId: participant?.userId?._id || participant?.userId || null,
    groupName: participant?.groupId?.name || "",
    level: participant?.groupId?.level || "",
  };
}

async function resolveEventFields({ academyId, eventId }) {
  if (!eventId || !isValidObjectId(eventId)) {
    return {
      eventName: "Event",
      eventCode: "",
      registrationFee: 0,
      paymentMethod: "CASH",
    };
  }

  const event = await Event.findOne({ _id: eventId, academyId }).lean();

  return {
    eventName: event?.name || event?.title || "Event",
    eventCode: event?.code || "",
    registrationFee: safeMoney(event?.registrationFee || 0),
    paymentMethod: normalizePaymentMethod(event?.paymentMethod || "CASH"),
  };
}

async function generateDailyRunningNumber({
  academyId,
  prefix,
  field,
  date = new Date(),
}) {
  const ymd = formatDateYmd(date);
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const docs = await Payment.find({
    academyId,
    createdAt: { $gte: dayStart, $lte: dayEnd },
    [field]: { $regex: `^${prefix}-${ymd}-`, $options: "i" },
  })
    .select(field)
    .lean();

  let maxSeq = 0;

  for (const doc of docs) {
    const raw = String(doc?.[field] || "")
      .trim()
      .toUpperCase();
    const parts = raw.split("-");
    const last = Number(parts[parts.length - 1] || 0);
    if (Number.isFinite(last) && last > maxSeq) maxSeq = last;
  }

  const next = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}-${ymd}-${next}`;
}

async function generateInvoiceNo(academyId, date = new Date()) {
  return await generateDailyRunningNumber({
    academyId,
    prefix: "INV",
    field: "invoiceNo",
    date,
  });
}

async function generateReceiptNo(academyId, date = new Date()) {
  return await generateDailyRunningNumber({
    academyId,
    prefix: "RCP",
    field: "receiptNo",
    date,
  });
}

async function ensureNumberingForPaid(doc, academyId, paidAt = new Date()) {
  if (!doc.invoiceNo) {
    doc.invoiceNo = await generateInvoiceNo(academyId, paidAt);
  }
  if (!doc.receiptNo) {
    doc.receiptNo = await generateReceiptNo(academyId, paidAt);
  }
  if (!doc.referenceNo) {
    doc.referenceNo =
      String(doc.transactionId || "").trim() ||
      String(doc.receiptNo || "").trim() ||
      String(doc.invoiceNo || "").trim();
  }
}

async function hydratePaymentOr404(id, academyId) {
  return await Payment.findOne({ _id: id, academyId })
    .populate("userId", "name email role")
    .populate("parentUserId", "name email role")
    .populate({
      path: "participantId",
      select: "bibNo age userId name parentUserId parentEmail groupId",
      populate: [
        { path: "userId", select: "name email role fullName" },
        { path: "parentUserId", select: "name email role" },
        { path: "groupId", select: "name level" },
      ],
    })
    .populate("eventId", "name title code status registrationFee paymentMethod")
    .populate("confirmedBy", "name email")
    .lean();
}

function buildFilterFromQuery(req, academyId) {
  const paymentStatus = normalizePaymentStatus(req.query.paymentStatus, "");
  const paymentMethod = String(req.query.paymentMethod || "")
    .trim()
    .toUpperCase();
  const eventId = normalizeId(req.query.eventId);
  const participantId = normalizeId(req.query.participantId);
  const userId = normalizeId(req.query.userId);
  const enrollmentId = normalizeId(req.query.enrollmentId);
  const q = String(req.query.q || "").trim();
  const from = pickDateOrNull(req.query.from);
  const to = pickDateOrNull(req.query.to);

  const filter = { academyId };

  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (paymentMethod === "CASH" || paymentMethod === "ONLINE") {
    filter.paymentMethod = paymentMethod;
  }
  if (eventId && isValidObjectId(eventId)) filter.eventId = eventId;
  if (participantId && isValidObjectId(participantId)) {
    filter.participantId = participantId;
  }
  if (userId && isValidObjectId(userId)) filter.userId = userId;
  if (enrollmentId && isValidObjectId(enrollmentId)) {
    filter.enrollmentId = enrollmentId;
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  if (q) {
    filter.$or = [
      { transactionId: { $regex: q, $options: "i" } },
      { invoiceNo: { $regex: q, $options: "i" } },
      { receiptNo: { $regex: q, $options: "i" } },
      { referenceNo: { $regex: q, $options: "i" } },
      { gateway: { $regex: q, $options: "i" } },
      { notes: { $regex: q, $options: "i" } },
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { parentEmail: { $regex: q, $options: "i" } },
    ];
  }

  return filter;
}

/* =========================
 * Notification helpers
 * ========================= */
function buildPaymentNotificationContent({
  participantName,
  eventName,
  amount,
  currency,
  paymentStatus,
}) {
  const status = String(paymentStatus || "PENDING").toUpperCase();
  const safeParticipant = participantName || "Participant";
  const safeEvent = eventName || "Event";
  const safeAmount = Number(amount || 0);
  const safeCurrency = String(currency || "QAR").toUpperCase();

  if (status === "PAID") {
    return {
      title: "Payment Confirmed",
      message: `${safeParticipant}'s payment of ${safeCurrency} ${safeAmount.toFixed(
        2,
      )} for ${safeEvent} has been marked as paid.`,
      type: "PAYMENT_PAID",
      priority: "HIGH",
    };
  }

  if (status === "FAILED") {
    return {
      title: "Payment Failed",
      message: `${safeParticipant}'s payment for ${safeEvent} is marked as failed.`,
      type: "PAYMENT_FAILED",
      priority: "HIGH",
    };
  }

  if (status === "REFUNDED") {
    return {
      title: "Payment Refunded",
      message: `${safeParticipant}'s payment of ${safeCurrency} ${safeAmount.toFixed(
        2,
      )} for ${safeEvent} has been refunded.`,
      type: "PAYMENT_REFUNDED",
      priority: "HIGH",
    };
  }

  if (status === "CANCELLED") {
    return {
      title: "Payment Cancelled",
      message: `${safeParticipant}'s payment for ${safeEvent} has been cancelled.`,
      type: "PAYMENT_CANCELLED",
      priority: "NORMAL",
    };
  }

  return {
    title: "Payment Updated",
    message: `${safeParticipant}'s payment for ${safeEvent} is now ${status}.`,
    type: "PAYMENT_UPDATED",
    priority: "NORMAL",
  };
}

async function sendPaymentNotification(paymentDoc, req) {
  try {
    const academyId =
      paymentDoc?.academyId?._id ||
      paymentDoc?.academyId?.id ||
      paymentDoc?.academyId ||
      null;

    if (!academyId || !isValidObjectId(academyId)) return;

    const participantId =
      paymentDoc?.participantId?._id || paymentDoc?.participantId || null;

    let participant = null;
    if (participantId && isValidObjectId(participantId)) {
      participant = await Participant.findOne({
        _id: participantId,
        academyId,
      })
        .select("parentUserId userId parentEmail")
        .lean();
    }

    const participantName =
      paymentDoc?.participantId?.userId?.name ||
      paymentDoc?.participantId?.name ||
      paymentDoc?.userId?.name ||
      "Participant";

    const eventName =
      paymentDoc?.eventId?.name || paymentDoc?.eventId?.title || "Event";

    const amount = Number(paymentDoc?.amount || 0);
    const currency = String(paymentDoc?.currency || "QAR").toUpperCase();
    const paymentStatus = String(
      paymentDoc?.paymentStatus || "PENDING",
    ).toUpperCase();

    const content = buildPaymentNotificationContent({
      participantName,
      eventName,
      amount,
      currency,
      paymentStatus,
    });

    const recipients = [];

    const parentUserId = normalizeId(
      paymentDoc?.parentUserId?._id ||
        paymentDoc?.parentUserId ||
        participant?.parentUserId ||
        "",
    );
    if (parentUserId && isValidObjectId(parentUserId)) {
      recipients.push({
        recipientUserId: parentUserId,
        recipientRole: "PARENT",
        actionUrl: "/parent/dashboard?tab=payments",
      });
    }

    const participantUserId = normalizeId(
      participant?.userId ||
        paymentDoc?.participantId?.userId?._id ||
        paymentDoc?.participantId?.userId ||
        paymentDoc?.userId?._id ||
        paymentDoc?.userId ||
        "",
    );

    if (participantUserId && isValidObjectId(participantUserId)) {
      recipients.push({
        recipientUserId: participantUserId,
        recipientRole: "PARTICIPANT",
        actionUrl: "/participant",
      });
    }

    const paymentUserId =
      paymentDoc?.userId?._id || paymentDoc?.userId?.id || paymentDoc?.userId;

    if (
      paymentUserId &&
      isValidObjectId(paymentUserId) &&
      !recipients.some(
        (r) => normalizeId(r.recipientUserId) === normalizeId(paymentUserId),
      )
    ) {
      recipients.push({
        recipientUserId: String(paymentUserId),
        recipientRole: "PARENT",
        actionUrl: "/parent/dashboard?tab=payments",
      });
    }

    const sentKeys = new Set();

    for (const recipient of recipients) {
      const dedupeKey = `${recipient.recipientRole}:${recipient.recipientUserId}`;
      if (sentKeys.has(dedupeKey)) continue;
      sentKeys.add(dedupeKey);

      const notification = await createNotification({
        academyId,
        recipientUserId: recipient.recipientUserId,
        recipientRole: recipient.recipientRole,
        title: content.title,
        message: content.message,
        type: content.type,
        category: "PAYMENT",
        priority: content.priority,
        actionUrl: recipient.actionUrl,
        meta: {
          paymentId: String(paymentDoc?._id || ""),
          eventId: String(
            paymentDoc?.eventId?._id || paymentDoc?.eventId || "",
          ),
          participantId: String(
            paymentDoc?.participantId?._id || paymentDoc?.participantId || "",
          ),
          eventName,
          participantName,
          amount,
          currency,
          paymentStatus,
          invoiceNo: paymentDoc?.invoiceNo || "",
          receiptNo: paymentDoc?.receiptNo || "",
          referenceNo: paymentDoc?.referenceNo || "",
          gateway: paymentDoc?.gateway || "",
          transactionId: paymentDoc?.transactionId || "",
        },
        createdByUserId: req?.user?._id || req?.user?.id || null,
      });

      emitNotification(req.app, notification);
    }
  } catch (err) {
    console.error("Payment notification failed:", err?.message || err);
  }
}

async function resolvePaymentEmailRecipient(paymentDoc) {
  const academyId =
    paymentDoc?.academyId?._id ||
    paymentDoc?.academyId?.id ||
    paymentDoc?.academyId ||
    null;

  const participantId =
    paymentDoc?.participantId?._id || paymentDoc?.participantId || null;

  let participant = null;

  if (academyId && participantId && isValidObjectId(participantId)) {
    participant = await Participant.findOne({
      _id: participantId,
      academyId,
    })
      .select("parentUserId parentEmail userId name")
      .populate("parentUserId", "name email role")
      .populate("userId", "name email role")
      .lean();
  }

  const parentUser =
    participant?.parentUserId || paymentDoc?.parentUserId || null;
  const participantUser = participant?.userId || null;
  const paymentUser = paymentDoc?.userId || null;

  const email =
    parentUser?.email ||
    paymentDoc?.parentEmail ||
    paymentUser?.email ||
    participantUser?.email ||
    participant?.parentEmail ||
    "";

  const recipientName =
    parentUser?.name ||
    paymentUser?.name ||
    participantUser?.name ||
    paymentDoc?.participantId?.userId?.name ||
    paymentDoc?.participantId?.name ||
    "Parent";

  const recipientUserId =
    parentUser?._id || paymentUser?._id || participantUser?._id || null;

  const recipientRole =
    parentUser?.role || paymentUser?.role || participantUser?.role || "PARENT";

  return {
    email,
    recipientName,
    recipientUserId: recipientUserId ? String(recipientUserId) : null,
    recipientRole: String(recipientRole || "PARENT").toUpperCase(),
    participant,
    parentUser,
    participantUser,
    paymentUser,
  };
}

async function sendPaymentEmail(paymentDoc) {
  try {
    if (!paymentDoc) return;

    const paymentStatus = String(
      paymentDoc?.paymentStatus || "PENDING",
    ).toUpperCase();

    if (paymentStatus !== "PAID") return;

    const { email, recipientName, recipientUserId, recipientRole } =
      await resolvePaymentEmailRecipient(paymentDoc);

    if (!email) return;

    const academyId =
      paymentDoc?.academyId?._id ||
      paymentDoc?.academyId?.id ||
      paymentDoc?.academyId ||
      null;

    const participantName =
      paymentDoc?.participantId?.userId?.name ||
      paymentDoc?.participantId?.name ||
      paymentDoc?.userId?.name ||
      "Participant";

    const eventName =
      paymentDoc?.eventId?.name || paymentDoc?.eventId?.title || "Event";

    const paymentRef =
      paymentDoc?.receiptNo ||
      paymentDoc?.invoiceNo ||
      paymentDoc?.referenceNo ||
      paymentDoc?.transactionId ||
      String(paymentDoc?._id || "");

    await triggerAutoEmail({
      academyId: academyId ? String(academyId) : null,
      recipientUserId: recipientUserId || null,
      recipientRole: recipientRole || "PARENT",
      recipientEmail: email,
      triggerEvent: "PAYMENT_SUCCESS",
      variables: {
        parentName: recipientName,
        participantName,
        childName: participantName,
        eventName,
        amount: Number(paymentDoc?.amount || 0).toFixed(2),
        currency: String(paymentDoc?.currency || "QAR").toUpperCase(),
        paymentRef,
        paymentStatus,
        invoiceNumber: paymentDoc?.invoiceNo || "",
        invoiceNo: paymentDoc?.invoiceNo || "",
        receiptNo: paymentDoc?.receiptNo || "",
        referenceNo: paymentDoc?.referenceNo || "",
        transactionId: paymentDoc?.transactionId || "",
        gateway: paymentDoc?.gateway || "",
        receiptUrl: `${process.env.APP_URL || ""}/parent/dashboard?tab=payments`,
        actionUrl: `${process.env.APP_URL || ""}/parent/dashboard?tab=payments`,
        actionLabel: "View Payments",
      },
      meta: {
        type: "PAYMENT_RECEIPT",
        academyId: String(academyId || ""),
        userId: String(recipientUserId || ""),
        paymentId: String(paymentDoc?._id || ""),
        participantId: String(
          paymentDoc?.participantId?._id || paymentDoc?.participantId || "",
        ),
        eventId: String(paymentDoc?.eventId?._id || paymentDoc?.eventId || ""),
        invoiceNo: paymentDoc?.invoiceNo || "",
        receiptNo: paymentDoc?.receiptNo || "",
        referenceNo: paymentDoc?.referenceNo || "",
        transactionId: paymentDoc?.transactionId || "",
        gateway: paymentDoc?.gateway || "",
      },
      syncNotification: false,
    });
  } catch (err) {
    console.error("Payment email failed:", err?.message || err);
  }
}

async function sendPaymentSideEffectsForStatus(paymentId, academyId, req) {
  const paymentDoc = await Payment.findOne({ _id: paymentId, academyId })
    .populate("userId", "name email role")
    .populate("parentUserId", "name email role")
    .populate({
      path: "participantId",
      select: "bibNo age userId name parentUserId parentEmail",
      populate: [
        { path: "userId", select: "name email role" },
        { path: "parentUserId", select: "name email role" },
      ],
    })
    .populate("eventId", "name title code status")
    .lean();

  if (!paymentDoc) return;

  await sendPaymentNotification(paymentDoc, req);
  await sendPaymentEmail(paymentDoc);
}

/* =========================
 * Validation
 * ========================= */
const createPaymentSchema = z.object({
  academyId: z.string().optional(),
  userId: z.string().optional(),
  participantId: z.string().optional(),
  eventId: z.string().optional(),
  enrollmentId: z.string().optional(),

  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),

  amount: z.coerce.number().min(0),
  totalAmount: z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  amountDue: z.coerce.number().min(0).optional(),
  dueAmount: z.coerce.number().min(0).optional(),
  balance: z.coerce.number().min(0).optional(),

  currency: z.string().trim().min(1).max(12).optional(),

  paymentMethod: z.enum(["CASH", "ONLINE"]).optional(),
  paymentStatus: z
    .enum(["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"])
    .optional(),

  gateway: z.string().trim().max(100).optional(),
  transactionId: z.string().trim().max(200).optional(),
  referenceNo: z.string().trim().max(200).optional(),
  invoiceNo: z.string().trim().max(100).optional(),
  receiptNo: z.string().trim().max(100).optional(),
  receiptUrl: z.string().trim().max(2000).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
  paidAt: z.union([z.string(), z.date()]).optional(),
  notes: z.string().trim().max(1000).optional(),
  meta: z.record(z.any()).optional(),
});

const updateStatusSchema = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),

  amount: z.coerce.number().min(0).optional(),
  totalAmount: z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  amountDue: z.coerce.number().min(0).optional(),
  dueAmount: z.coerce.number().min(0).optional(),
  balance: z.coerce.number().min(0).optional(),

  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"]),
  paymentMethod: z.enum(["CASH", "ONLINE"]).optional(),
  paidAt: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
  transactionId: z.string().trim().max(200).optional(),
  referenceNo: z.string().trim().max(200).optional(),
  receiptNo: z.string().trim().max(100).optional(),
  invoiceNo: z.string().trim().max(100).optional(),
  receiptUrl: z.string().trim().max(2000).optional(),
  gateway: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  meta: z.record(z.any()).optional(),
});

const bulkStatusSchema = z.object({
  paymentIds: z.array(z.string().min(1)).min(1),
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"]),
  paymentMethod: z.enum(["CASH", "ONLINE"]).optional(),
  paidAt: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
  notes: z.string().trim().max(1000).optional(),
});

/* =========================
 * GET /payments/summary
 * ========================= */
router.get(
  "/payments/summary",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const eventId = normalizeId(req.query.eventId);
    const filter = { academyId };

    if (eventId && isValidObjectId(eventId)) {
      filter.eventId = new mongoose.Types.ObjectId(eventId);
    }

    const grouped = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]);

    const methodGrouped = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]);

    const out = {
      totalCount: 0,
      totalAmount: 0,
      paidCount: 0,
      paidAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      failedCount: 0,
      failedAmount: 0,
      refundedCount: 0,
      refundedAmount: 0,
      cancelledCount: 0,
      cancelledAmount: 0,
      cashCount: 0,
      cashAmount: 0,
      onlineCount: 0,
      onlineAmount: 0,
    };

    for (const row of grouped) {
      const key = String(row._id || "").toUpperCase();
      const count = Number(row.count || 0);
      const amount = Number(row.amount || 0);

      out.totalCount += count;
      out.totalAmount += amount;

      if (key === "PAID") {
        out.paidCount = count;
        out.paidAmount = amount;
      } else if (key === "PENDING") {
        out.pendingCount = count;
        out.pendingAmount = amount;
      } else if (key === "FAILED") {
        out.failedCount = count;
        out.failedAmount = amount;
      } else if (key === "REFUNDED") {
        out.refundedCount = count;
        out.refundedAmount = amount;
      } else if (key === "CANCELLED") {
        out.cancelledCount = count;
        out.cancelledAmount = amount;
      }
    }

    for (const row of methodGrouped) {
      const key = String(row._id || "").toUpperCase();
      const count = Number(row.count || 0);
      const amount = Number(row.amount || 0);

      if (key === "CASH") {
        out.cashCount = count;
        out.cashAmount = amount;
      } else if (key === "ONLINE") {
        out.onlineCount = count;
        out.onlineAmount = amount;
      }
    }

    res.json(out);
  }),
);

/* =========================
 * GET /payments/export
 * ========================= */
router.get(
  "/payments/export",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const filter = buildFilterFromQuery(req, academyId);

    const rows = await Payment.find(filter)
      .populate("userId", "name email role")
      .populate("parentUserId", "name email role")
      .populate({
        path: "participantId",
        select: "bibNo age userId parentUserId parentEmail",
        populate: [
          { path: "userId", select: "name email" },
          { path: "parentUserId", select: "name email" },
        ],
      })
      .populate("eventId", "name title code status")
      .populate("confirmedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const headers = [
      "paymentId",
      "invoiceNo",
      "receiptNo",
      "referenceNo",
      "title",
      "description",
      "participantName",
      "participantEmail",
      "participantBibNo",
      "parentEmail",
      "userName",
      "userEmail",
      "eventName",
      "eventCode",
      "amount",
      "totalAmount",
      "paidAmount",
      "amountDue",
      "dueAmount",
      "balance",
      "currency",
      "paymentMethod",
      "paymentStatus",
      "gateway",
      "transactionId",
      "dueDate",
      "paidAt",
      "confirmedBy",
      "notes",
      "createdAt",
      "updatedAt",
    ];

    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        [
          csvEscape(row._id),
          csvEscape(row.invoiceNo || ""),
          csvEscape(row.receiptNo || ""),
          csvEscape(row.referenceNo || ""),
          csvEscape(row.title || ""),
          csvEscape(row.description || ""),
          csvEscape(getParticipantDisplayName(row)),
          csvEscape(getParticipantDisplayEmail(row)),
          csvEscape(row?.participantId?.bibNo || ""),
          csvEscape(
            row?.parentEmail ||
              row?.participantId?.parentEmail ||
              row?.parentUserId?.email ||
              "",
          ),
          csvEscape(row?.userId?.name || ""),
          csvEscape(row?.userId?.email || ""),
          csvEscape(row?.eventId?.name || row?.eventId?.title || ""),
          csvEscape(row?.eventId?.code || ""),
          csvEscape(Number(row.amount || 0)),
          csvEscape(Number(row.totalAmount || row.amount || 0)),
          csvEscape(Number(row.paidAmount || 0)),
          csvEscape(Number(row.amountDue || 0)),
          csvEscape(Number(row.dueAmount || 0)),
          csvEscape(Number(row.balance || 0)),
          csvEscape(String(row.currency || "QAR").toUpperCase()),
          csvEscape(row.paymentMethod || "CASH"),
          csvEscape(row.paymentStatus || "PENDING"),
          csvEscape(row.gateway || ""),
          csvEscape(row.transactionId || ""),
          csvEscape(row.dueDate ? new Date(row.dueDate).toISOString() : ""),
          csvEscape(row.paidAt ? new Date(row.paidAt).toISOString() : ""),
          csvEscape(row?.confirmedBy?.name || ""),
          csvEscape(row.notes || ""),
          csvEscape(row.createdAt ? new Date(row.createdAt).toISOString() : ""),
          csvEscape(row.updatedAt ? new Date(row.updatedAt).toISOString() : ""),
        ].join(","),
      ),
    ];

    const csv = lines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payments_export_${formatDateYmd(new Date())}.csv"`,
    );
    res.end(csv);
  }),
);

/* =========================
 * GET /payments
 * ========================= */
router.get(
  "/payments",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 500);
    const skip = (page - 1) * limit;

    const filter = buildFilterFromQuery(req, academyId);

    const [total, rows] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter)
        .populate("userId", "name email role")
        .populate("parentUserId", "name email role")
        .populate({
          path: "participantId",
          select: "bibNo age userId parentUserId parentEmail groupId",
          populate: [
            { path: "userId", select: "name email fullName" },
            { path: "parentUserId", select: "name email role" },
            { path: "groupId", select: "name level" },
          ],
        })
        .populate("eventId", "name title code status")
        .populate("confirmedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const items = rows.map((row) => buildPaymentDoc(row, academyId));

    res.json({
      items,
      total,
      page,
      limit,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  }),
);

/* =========================
 * GET /payments/:id
 * ========================= */
router.get(
  "/payments/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const id = req.params.id;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid payment id" });
    }

    const row = await hydratePaymentOr404(id, academyId);
    if (!row) return res.status(404).json({ message: "Payment not found" });

    res.json(buildPaymentDoc(row, academyId));
  }),
);

/* =========================
 * POST /payments
 * ========================= */
router.post(
  "/payments",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const payload = createPaymentSchema.parse(req.body || {});

    let userId = normalizeId(payload.userId);
    let participantId = normalizeId(payload.participantId);
    let eventId = normalizeId(payload.eventId);
    let enrollmentId = normalizeId(payload.enrollmentId);

    if (userId && !isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }
    if (participantId && !isValidObjectId(participantId)) {
      return res.status(400).json({ message: "Invalid participantId" });
    }
    if (eventId && !isValidObjectId(eventId)) {
      return res.status(400).json({ message: "Invalid eventId" });
    }
    if (enrollmentId && !isValidObjectId(enrollmentId)) {
      return res.status(400).json({ message: "Invalid enrollmentId" });
    }

    const filled = await autoFillRefsFromEnrollment({
      academyId,
      enrollmentId,
      participantId,
      eventId,
      userId,
    });

    userId = filled.userId || null;
    participantId = filled.participantId || null;
    eventId = filled.eventId || null;

    await ensureScopedRefs({
      academyId,
      userId,
      participantId,
      eventId,
      enrollmentId,
    });

    const participantMeta = await resolveParticipantParentFields({
      academyId,
      participantId,
    });

    const eventMeta = await resolveEventFields({
      academyId,
      eventId,
    });

    const paymentMethod = normalizePaymentMethod(
      payload.paymentMethod || eventMeta.paymentMethod || "CASH",
    );

    const paymentStatus = normalizePaymentStatus(
      payload.paymentStatus,
      "PENDING",
    );

    const amount = safeMoney(payload.amount);
    const totals = computeDueAmounts({
      amount,
      totalAmount: payload.totalAmount,
      paidAmount: payload.paidAmount,
      amountDue: payload.amountDue,
      dueAmount: payload.dueAmount,
      balance: payload.balance,
      paymentStatus,
    });

    const paidAt =
      paymentStatus === "PAID"
        ? pickDateOrNull(payload.paidAt) || new Date()
        : null;

    const title =
      String(payload.title || "").trim() ||
      buildPaymentTitle({
        participantName: participantMeta.participantName,
        eventName: eventMeta.eventName,
      });

    const description =
      String(payload.description || "").trim() ||
      buildPaymentDescription({
        participantName: participantMeta.participantName,
        eventName: eventMeta.eventName,
        paymentMethod,
      });

    const doc = new Payment({
      academyId,
      userId: userId || participantMeta.participantUserId || null,
      parentUserId: participantMeta.parentUserId || null,
      parentEmail: participantMeta.parentEmail || "",
      participantId: participantId || null,
      eventId: eventId || null,
      enrollmentId: enrollmentId || null,

      title,
      description,

      amount: totals.amount,
      totalAmount: totals.totalAmount,
      paidAmount: totals.paidAmount,
      amountDue: totals.amountDue,
      dueAmount: totals.dueAmount,
      balance: totals.balance,

      currency: String(payload.currency || "QAR")
        .trim()
        .toUpperCase(),

      paymentMethod,
      paymentStatus,
      status: paymentStatus,

      gateway: String(payload.gateway || "").trim(),
      transactionId: String(payload.transactionId || "").trim(),
      referenceNo: String(payload.referenceNo || "").trim(),
      invoiceNo: String(payload.invoiceNo || "").trim(),
      receiptNo: String(payload.receiptNo || "").trim(),
      receiptUrl: String(payload.receiptUrl || "").trim(),
      dueDate: pickDateOrNull(payload.dueDate),
      paidAt,
      confirmedBy: paymentStatus === "PAID" ? req.user.id : null,
      notes: String(payload.notes || "").trim(),
      meta: {
        ...(payload.meta || {}),
        groupName: participantMeta.groupName || "",
        level: participantMeta.level || "",
        eventCode: eventMeta.eventCode || "",
      },
    });

    if (paymentStatus === "PAID") {
      await ensureNumberingForPaid(doc, academyId, paidAt || new Date());
    } else if (!doc.invoiceNo) {
      doc.invoiceNo = await generateInvoiceNo(academyId, new Date());
    }

    if (!doc.referenceNo) {
      doc.referenceNo =
        String(doc.transactionId || "").trim() ||
        String(doc.receiptNo || "").trim() ||
        String(doc.invoiceNo || "").trim();
    }

    await doc.save();
    await sendPaymentSideEffectsForStatus(doc._id, academyId, req);

    const populated = await hydratePaymentOr404(doc._id, academyId);
    res.status(201).json(buildPaymentDoc(populated, academyId));
  }),
);

/* =========================
 * UPDATE PAYMENT INTERNAL
 * ========================= */
async function updatePaymentStatusHandler(req, res) {
  const academyId = requireScopedAcademy(req, res);
  if (!academyId) return;

  const id = req.params.id;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid payment id" });
  }

  const payload = updateStatusSchema.parse(req.body || {});
  const doc = await Payment.findOne({ _id: id, academyId });

  if (!doc) return res.status(404).json({ message: "Payment not found" });

  const beforeStatus = String(doc.paymentStatus || "").toUpperCase();

  if (payload.title !== undefined) {
    doc.title = String(payload.title || "").trim();
  }
  if (payload.description !== undefined) {
    doc.description = String(payload.description || "").trim();
  }

  if (payload.amount !== undefined) {
    doc.amount = safeMoney(payload.amount);
  }
  if (payload.totalAmount !== undefined) {
    doc.totalAmount = safeMoney(payload.totalAmount);
  }
  if (payload.paidAmount !== undefined) {
    doc.paidAmount = safeMoney(payload.paidAmount);
  }

  doc.paymentStatus = normalizePaymentStatus(payload.paymentStatus);
  doc.status = doc.paymentStatus;

  if (payload.paymentMethod) {
    doc.paymentMethod = normalizePaymentMethod(payload.paymentMethod);
  }

  if (payload.gateway !== undefined) {
    doc.gateway = String(payload.gateway || "").trim();
  }
  if (payload.transactionId !== undefined) {
    doc.transactionId = String(payload.transactionId || "").trim();
  }
  if (payload.referenceNo !== undefined) {
    doc.referenceNo = String(payload.referenceNo || "").trim();
  }
  if (payload.invoiceNo !== undefined) {
    doc.invoiceNo = String(payload.invoiceNo || "").trim();
  }
  if (payload.receiptNo !== undefined) {
    doc.receiptNo = String(payload.receiptNo || "").trim();
  }
  if (payload.receiptUrl !== undefined) {
    doc.receiptUrl = String(payload.receiptUrl || "").trim();
  }
  if (payload.notes !== undefined) {
    doc.notes = String(payload.notes || "").trim();
  }
  if (payload.meta !== undefined) {
    doc.meta = payload.meta || {};
  }
  if (payload.dueDate !== undefined) {
    doc.dueDate = pickDateOrNull(payload.dueDate);
  }

  if (doc.paymentStatus === "PAID") {
    doc.paidAt = pickDateOrNull(payload.paidAt) || doc.paidAt || new Date();
    doc.confirmedBy = req.user.id;
    await ensureNumberingForPaid(doc, academyId, doc.paidAt || new Date());
  } else {
    if (payload.paidAt !== undefined) {
      doc.paidAt = pickDateOrNull(payload.paidAt);
    }

    if (
      doc.paymentStatus === "FAILED" ||
      doc.paymentStatus === "CANCELLED" ||
      doc.paymentStatus === "PENDING"
    ) {
      doc.confirmedBy = null;
      if (payload.paidAt === undefined) {
        doc.paidAt = null;
      }
    }

    if (!doc.invoiceNo) {
      doc.invoiceNo = await generateInvoiceNo(
        academyId,
        doc.paidAt || new Date(),
      );
    }
  }

  const totals = computeDueAmounts({
    amount: doc.amount,
    totalAmount: doc.totalAmount,
    paidAmount: doc.paidAmount,
    amountDue:
      payload.amountDue !== undefined ? payload.amountDue : doc.amountDue,
    dueAmount:
      payload.dueAmount !== undefined ? payload.dueAmount : doc.dueAmount,
    balance: payload.balance !== undefined ? payload.balance : doc.balance,
    paymentStatus: doc.paymentStatus,
  });

  doc.amount = totals.amount;
  doc.totalAmount = totals.totalAmount;
  doc.paidAmount = totals.paidAmount;
  doc.amountDue = totals.amountDue;
  doc.dueAmount = totals.dueAmount;
  doc.balance = totals.balance;

  if (!doc.referenceNo) {
    doc.referenceNo =
      String(doc.transactionId || "").trim() ||
      String(doc.receiptNo || "").trim() ||
      String(doc.invoiceNo || "").trim();
  }

  await doc.save();

  const afterStatus = String(doc.paymentStatus || "").toUpperCase();
  if (beforeStatus !== afterStatus) {
    await sendPaymentSideEffectsForStatus(doc._id, academyId, req);
  }

  const populated = await hydratePaymentOr404(doc._id, academyId);
  res.json(buildPaymentDoc(populated, academyId));
}

/* =========================
 * PUT /payments/:id
 * PUT /payments/:id/status
 * ========================= */
router.put("/payments/:id", wrap(updatePaymentStatusHandler));
router.put("/payments/:id/status", wrap(updatePaymentStatusHandler));

/* =========================
 * BULK UPDATE INTERNAL
 * ========================= */
async function bulkUpdatePaymentsStatusHandler(req, res) {
  const academyId = requireScopedAcademy(req, res);
  if (!academyId) return;

  const payload = bulkStatusSchema.parse(req.body || {});
  const paymentIds = uniqIds(payload.paymentIds || []);

  for (const id of paymentIds) {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: `Invalid payment id: ${id}` });
    }
  }

  const docs = await Payment.find({
    _id: { $in: paymentIds },
    academyId,
  });

  const foundIds = new Set(docs.map((d) => String(d._id)));
  const missing = paymentIds.filter((id) => !foundIds.has(String(id)));

  let updated = 0;
  const now = new Date();
  const changedStatusIds = [];

  for (const doc of docs) {
    const beforeStatus = String(doc.paymentStatus || "").toUpperCase();

    doc.paymentStatus = normalizePaymentStatus(payload.paymentStatus);
    doc.status = doc.paymentStatus;

    if (payload.paymentMethod) {
      doc.paymentMethod = normalizePaymentMethod(payload.paymentMethod);
    }
    if (payload.notes !== undefined) {
      doc.notes = String(payload.notes || "").trim();
    }
    if (payload.dueDate !== undefined) {
      doc.dueDate = pickDateOrNull(payload.dueDate);
    }

    if (doc.paymentStatus === "PAID") {
      doc.paidAt = pickDateOrNull(payload.paidAt) || doc.paidAt || now;
      doc.confirmedBy = req.user.id;
      await ensureNumberingForPaid(doc, academyId, doc.paidAt || now);
    } else {
      if (payload.paidAt !== undefined) {
        doc.paidAt = pickDateOrNull(payload.paidAt);
      }
      if (
        doc.paymentStatus === "FAILED" ||
        doc.paymentStatus === "CANCELLED" ||
        doc.paymentStatus === "PENDING"
      ) {
        doc.confirmedBy = null;
        if (payload.paidAt === undefined) {
          doc.paidAt = null;
        }
      }
      if (!doc.invoiceNo) {
        doc.invoiceNo = await generateInvoiceNo(academyId, now);
      }
    }

    const totals = computeDueAmounts({
      amount: doc.amount,
      totalAmount: doc.totalAmount,
      paidAmount: doc.paidAmount,
      amountDue: doc.amountDue,
      dueAmount: doc.dueAmount,
      balance: doc.balance,
      paymentStatus: doc.paymentStatus,
    });

    doc.amount = totals.amount;
    doc.totalAmount = totals.totalAmount;
    doc.paidAmount = totals.paidAmount;
    doc.amountDue = totals.amountDue;
    doc.dueAmount = totals.dueAmount;
    doc.balance = totals.balance;

    if (!doc.referenceNo) {
      doc.referenceNo =
        String(doc.transactionId || "").trim() ||
        String(doc.receiptNo || "").trim() ||
        String(doc.invoiceNo || "").trim();
    }

    await doc.save();
    updated += 1;

    const afterStatus = String(doc.paymentStatus || "").toUpperCase();
    if (beforeStatus !== afterStatus) {
      changedStatusIds.push(String(doc._id));
    }
  }

  for (const paymentId of changedStatusIds) {
    await sendPaymentSideEffectsForStatus(paymentId, academyId, req);
  }

  res.json({
    ok: true,
    requested: paymentIds.length,
    updated,
    missingIds: missing,
    paymentStatus: normalizePaymentStatus(payload.paymentStatus),
  });
}

/* =========================
 * PUT/POST /payments/bulk-status
 * ========================= */
router.put("/payments/bulk-status", wrap(bulkUpdatePaymentsStatusHandler));
router.post("/payments/bulk-status", wrap(bulkUpdatePaymentsStatusHandler));

/* =========================
 * DELETE /payments/:id
 * ========================= */
router.delete(
  "/payments/:id",
  wrap(async (req, res) => {
    const academyId = requireScopedAcademy(req, res);
    if (!academyId) return;

    const id = req.params.id;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid payment id" });
    }

    const deleted = await Payment.findOneAndDelete({ _id: id, academyId });
    if (!deleted) return res.status(404).json({ message: "Payment not found" });

    res.json({ ok: true });
  }),
);

/* =========================
 * Route-level error handler
 * ========================= */
router.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: "Validation error",
      issues: err.issues,
    });
  }

  const msg = err?.message || "Server error";
  return res.status(500).json({ message: msg });
});

export default router;
