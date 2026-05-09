// server/seeds/emailTemplates.seed.js

import EmailTemplate from "../src/models/EmailTemplate.js";
import { renderEmailTemplate } from "../src/services/email/emailTemplates.js";

const SYSTEM_TEMPLATE_DEFS = [
  {
    key: "welcome_parent",
    name: "Welcome Parent",
    category: "GENERAL",
    templateType: "WELCOME_PARENT",
    description: "Sent when a parent account is created or invited.",
    variables: [
      "name",
      "parentName",
      "childName",
      "participantName",
      "academyName",
      "loginUrl",
      "actionUrl",
      "temporaryPassword",
      "role",
      "roleLabel",
      "invitedBy",
    ],
  },
  {
    key: "welcome_judge",
    name: "Welcome Judge",
    category: "GENERAL",
    templateType: "WELCOME_JUDGE",
    description: "Sent when a judge account is created or invited.",
    variables: [
      "name",
      "judgeName",
      "academyName",
      "loginUrl",
      "actionUrl",
      "temporaryPassword",
      "role",
      "roleLabel",
      "invitedBy",
    ],
  },
  {
    key: "welcome_participant",
    name: "Welcome Participant",
    category: "GENERAL",
    templateType: "WELCOME",
    description:
      "Sent when a participant account is created with login access or temporary password.",
    variables: [
      "name",
      "participantName",
      "childName",
      "academyName",
      "loginUrl",
      "actionUrl",
      "temporaryPassword",
      "role",
      "roleLabel",
      "invitedBy",
    ],
  },
  {
    key: "account_invite",
    name: "Account Invite",
    category: "GENERAL",
    templateType: "ACCOUNT_INVITE",
    description: "Sent when a user is invited to set up an account.",
    variables: [
      "name",
      "role",
      "roleLabel",
      "inviteUrl",
      "resetUrl",
      "actionUrl",
      "invitedBy",
      "academyName",
    ],
  },
  {
    key: "payment_success",
    name: "Payment Success",
    category: "PAYMENT",
    templateType: "PAYMENT_SUCCESS",
    description: "Sent after a payment is marked as paid.",
    variables: [
      "name",
      "parentName",
      "childName",
      "participantName",
      "participant",
      "eventName",
      "amount",
      "currency",
      "paymentStatus",
      "paymentMethod",
      "receiptNo",
      "invoiceNo",
      "invoiceNumber",
      "paymentRef",
      "referenceNo",
      "transactionId",
      "receiptUrl",
      "paymentUrl",
      "actionUrl",
    ],
  },
  {
    key: "payment_pending",
    name: "Payment Pending",
    category: "PAYMENT",
    templateType: "PAYMENT_RECEIPT",
    description: "Sent when a payment record is created but still pending.",
    variables: [
      "name",
      "parentName",
      "childName",
      "participantName",
      "participant",
      "eventName",
      "amount",
      "currency",
      "paymentStatus",
      "paymentMethod",
      "receiptNo",
      "invoiceNo",
      "invoiceNumber",
      "paymentRef",
      "referenceNo",
      "transactionId",
      "receiptUrl",
      "paymentUrl",
      "actionUrl",
    ],
  },
  {
    key: "payment_failed",
    name: "Payment Failed",
    category: "PAYMENT",
    templateType: "PAYMENT_FAILED",
    description: "Sent when a payment attempt fails.",
    variables: [
      "name",
      "parentName",
      "childName",
      "participantName",
      "participant",
      "eventName",
      "amount",
      "currency",
      "paymentStatus",
      "paymentRef",
      "referenceNo",
      "paymentUrl",
      "actionUrl",
    ],
  },
  {
    key: "result_published",
    name: "Result Published",
    category: "RESULT",
    templateType: "RESULT_PUBLISHED",
    description: "Sent when participant or group results are published.",
    variables: [
      "name",
      "parentName",
      "participantName",
      "childName",
      "eventName",
      "groupName",
      "level",
      "score",
      "total",
      "rank",
      "resultsUrl",
      "actionUrl",
      "academyName",
    ],
  },
  {
    key: "certificate_ready",
    name: "Certificate Ready",
    category: "CERTIFICATE",
    templateType: "CERTIFICATE_READY",
    description: "Sent when a certificate PDF is generated and ready.",
    variables: [
      "name",
      "parentName",
      "participantName",
      "childName",
      "eventName",
      "certificateTitle",
      "serialNo",
      "certificateUrl",
      "verifyUrl",
      "actionUrl",
    ],
  },
  {
    key: "registration_approved",
    name: "Registration Approved",
    category: "REGISTRATION",
    templateType: "REGISTRATION_APPROVED",
    description: "Sent when an academy registration is approved.",
    variables: ["name", "academyName", "actionUrl", "loginUrl"],
  },
  {
    key: "registration_rejected",
    name: "Registration Rejected",
    category: "REGISTRATION",
    templateType: "REGISTRATION_REJECTED",
    description: "Sent when an academy registration is rejected.",
    variables: ["name", "academyName", "reason", "message"],
  },
  {
    key: "event_reminder",
    name: "Event Reminder",
    category: "REMINDER",
    templateType: "EVENT_REMINDER",
    description: "Sent before an upcoming event or activity.",
    variables: [
      "name",
      "parentName",
      "participantName",
      "childName",
      "eventName",
      "activityName",
      "eventDate",
      "date",
      "eventTime",
      "time",
      "venue",
      "actionLabel",
      "actionUrl",
      "loginUrl",
    ],
  },
  {
    key: "password_reset",
    name: "Password Reset",
    category: "GENERAL",
    templateType: "PASSWORD_RESET",
    description: "Sent when a user requests a password reset.",
    variables: ["name", "resetUrl", "otp", "expiresInMinutes"],
  },
];

function buildSeedPayload(def) {
  const rendered = renderEmailTemplate(def.templateType, {});

  return {
    academyId: null,
    name: def.name,
    key: def.key,
    category: def.category,
    subject: rendered.subject || def.name,
    html: rendered.html || "",
    text: rendered.text || "",
    variables: Array.isArray(def.variables) ? def.variables : [],
    description: def.description || "",
    isActive: true,
    isSystem: true,
    meta: {
      templateType: def.templateType,
      seedVersion: 1,
      lockedKey: true,
    },
  };
}

export const DEFAULT_EMAIL_TEMPLATES =
  SYSTEM_TEMPLATE_DEFS.map(buildSeedPayload);

export async function seedDefaultEmailTemplates({ overwrite = false } = {}) {
  const results = {
    total: DEFAULT_EMAIL_TEMPLATES.length,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    const existing = await EmailTemplate.findOne({
      academyId: null,
      key: template.key,
    });

    if (!existing) {
      await EmailTemplate.create(template);
      results.created += 1;
      continue;
    }

    if (!overwrite) {
      results.skipped += 1;
      continue;
    }

    existing.name = template.name;
    existing.category = template.category;
    existing.subject = template.subject;
    existing.html = template.html;
    existing.text = template.text;
    existing.variables = template.variables;
    existing.description = template.description;
    existing.isActive = true;
    existing.isSystem = true;
    existing.meta = {
      ...(existing.meta || {}),
      ...(template.meta || {}),
    };

    await existing.save();
    results.updated += 1;
  }

  return results;
}

export async function ensureDefaultEmailTemplates() {
  return seedDefaultEmailTemplates({ overwrite: false });
}

export default seedDefaultEmailTemplates;
