// server/services/email/emailTemplates.js

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(amount, currency = "") {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount ?? 0} ${currency}`.trim();
  return `${n.toFixed(2)} ${currency}`.trim();
}

function button(label, href, bg = "#e11d2e") {
  if (!href) return "";
  return `
    <p style="margin:24px 0 0 0;">
      <a
        href="${esc(href)}"
        style="
          display:inline-block;
          background:${bg};
          color:#ffffff;
          text-decoration:none;
          padding:12px 18px;
          border-radius:10px;
          font-weight:700;
          font-size:14px;
        "
      >
        ${esc(label)}
      </a>
    </p>
  `;
}

function infoTable(rows = []) {
  const validRows = rows.filter(
    ([label, value]) =>
      label && value !== undefined && value !== null && value !== "",
  );

  if (!validRows.length) return "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:collapse;">
      ${validRows
        .map(
          ([label, value]) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;width:140px;vertical-align:top;">
                ${esc(label)}
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;vertical-align:top;">
                ${esc(value)}
              </td>
            </tr>
          `,
        )
        .join("")}
    </table>
  `;
}

function baseShell({ title, preheader = "", content }) {
  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${esc(title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
        ${esc(preheader)}
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 12px;">
        <tr>
          <td align="center">
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;"
            >
              <tr>
                <td style="background:#e11d2e;padding:18px 24px;color:#ffffff;font-size:22px;font-weight:800;">
                  Rebel Angels Gymnastics
                </td>
              </tr>

              <tr>
                <td style="padding:28px 24px;line-height:1.6;font-size:15px;">
                  ${content}
                </td>
              </tr>

              <tr>
                <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.6;">
                  This is an automated email from Rebel Angels Gymnastics.
                  Please do not reply unless instructed by our team.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

function buildWelcomeHtml({
  heading,
  name,
  intro,
  detailsRows = [],
  actionLabel,
  actionUrl,
  actionColor = "#e11d2e",
  footerNote = "",
}) {
  return baseShell({
    title: heading,
    preheader: intro,
    content: `
      <h2 style="margin:0 0 12px 0;font-size:24px;">${esc(heading)}</h2>
      <p style="margin:0 0 12px 0;">Hello ${esc(name || "there")},</p>
      <p style="margin:0 0 12px 0;">${esc(intro)}</p>
      ${infoTable(detailsRows)}
      ${button(actionLabel, actionUrl, actionColor)}
      ${
        footerNote
          ? `<p style="margin:18px 0 0 0;color:#6b7280;font-size:13px;">${esc(footerNote)}</p>`
          : ""
      }
    `,
  });
}

export function renderEmailTemplate(template, data = {}) {
  switch (
    String(template || "")
      .trim()
      .toUpperCase()
  ) {
    case "WELCOME": {
      const name = data.name || "there";
      const loginUrl = data.loginUrl || data.actionUrl || "";

      return {
        subject: "Welcome to Rebel Angels",
        html: baseShell({
          title: "Welcome to Rebel Angels",
          preheader: "Your account is ready.",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">Welcome, ${esc(name)}!</h2>
            <p style="margin:0 0 12px 0;">
              Your account has been created successfully.
            </p>
            <p style="margin:0 0 12px 0;">
              You can now sign in and manage registrations, results, certificates, and other academy activities.
            </p>
            ${button("Open Dashboard", loginUrl)}
          `,
        }),
        text: [
          `Welcome, ${name}!`,
          "",
          "Your account has been created successfully.",
          "You can now sign in and manage registrations, results, certificates, and other academy activities.",
          loginUrl ? `Open Dashboard: ${loginUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "WELCOME_PARENT": {
      const name = data.parentName || data.name || "Parent";
      const childName = data.childName || data.participantName || "";
      const academyName = data.academyName || "Rebel Angels Gymnastics";
      const loginUrl = data.loginUrl || data.actionUrl || "";
      const temporaryPassword = data.temporaryPassword || "";

      const intro = childName
        ? `Your parent account has been created for ${childName} at ${academyName}.`
        : `Your parent account has been created at ${academyName}.`;

      return {
        subject: `Welcome to ${academyName}`,
        html: buildWelcomeHtml({
          heading: "Welcome Parent",
          name,
          intro,
          detailsRows: [
            ["Parent Name", name],
            ["Child", childName],
            ["Academy", academyName],
            ["Temporary Password", temporaryPassword],
          ],
          actionLabel: "Login",
          actionUrl: loginUrl,
          footerNote: temporaryPassword
            ? "Please log in and change your password after first sign-in."
            : "You can now log in and access your parent dashboard.",
        }),
        text: [
          "Welcome Parent",
          "",
          `Hello ${name},`,
          intro,
          childName ? `Child: ${childName}` : "",
          `Academy: ${academyName}`,
          temporaryPassword ? `Temporary Password: ${temporaryPassword}` : "",
          loginUrl ? `Login: ${loginUrl}` : "",
          temporaryPassword
            ? "Please log in and change your password after first sign-in."
            : "You can now log in and access your parent dashboard.",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "WELCOME_JUDGE": {
      const name = data.judgeName || data.name || "Judge";
      const academyName = data.academyName || "Rebel Angels Gymnastics";
      const loginUrl = data.loginUrl || data.actionUrl || "";
      const temporaryPassword = data.temporaryPassword || "";

      return {
        subject: `Welcome Judge - ${academyName}`,
        html: buildWelcomeHtml({
          heading: "Welcome Judge",
          name,
          intro: `Your judge account has been created at ${academyName}.`,
          detailsRows: [
            ["Judge Name", name],
            ["Role", data.roleLabel || data.role || "JUDGE"],
            ["Academy", academyName],
            ["Temporary Password", temporaryPassword],
          ],
          actionLabel: "Login",
          actionUrl: loginUrl,
          footerNote: temporaryPassword
            ? "Please log in and change your password after first sign-in."
            : "You can now sign in and access judge assignments and scoring tools.",
        }),
        text: [
          "Welcome Judge",
          "",
          `Hello ${name},`,
          `Your judge account has been created at ${academyName}.`,
          `Role: ${data.roleLabel || data.role || "JUDGE"}`,
          `Academy: ${academyName}`,
          temporaryPassword ? `Temporary Password: ${temporaryPassword}` : "",
          loginUrl ? `Login: ${loginUrl}` : "",
          temporaryPassword
            ? "Please log in and change your password after first sign-in."
            : "You can now sign in and access judge assignments and scoring tools.",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "ACCOUNT_INVITE": {
      const name = data.name || "there";
      const role = data.roleLabel || data.role || "User";
      const inviteUrl = data.inviteUrl || data.resetUrl || data.actionUrl || "";
      const invitedBy = data.invitedBy || "Rebel Angels";
      const academyName = data.academyName || "Rebel Angels Gymnastics";

      return {
        subject: `You're invited to ${academyName}`,
        html: baseShell({
          title: "Account Invitation",
          preheader: "You have been invited to join Rebel Angels.",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">You’re Invited</h2>
            <p style="margin:0 0 12px 0;">Hello ${esc(name)},</p>
            <p style="margin:0 0 12px 0;">
              ${esc(invitedBy)} has invited you to join <strong>${esc(
                academyName,
              )}</strong> as <strong>${esc(role)}</strong>.
            </p>
            <p style="margin:0 0 12px 0;">
              Use the button below to complete your account setup.
            </p>
            ${button("Accept Invitation", inviteUrl)}
          `,
        }),
        text: [
          "You're Invited",
          "",
          `Hello ${name},`,
          `${invitedBy} has invited you to join ${academyName} as ${role}.`,
          inviteUrl ? `Accept Invitation: ${inviteUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "PAYMENT_RECEIPT":
    case "PAYMENT_SUCCESS": {
      const parentName =
        data.parentName || data.name || data.recipientName || "Parent";

      const participantName =
        data.childName ||
        data.participantName ||
        data.participant ||
        data.studentName ||
        "Participant";

      const eventName =
        data.eventName || data.eventTitle || data.competitionName || "Event";

      const amountRaw =
        data.amountValue ??
        data.amount ??
        data.totalAmount ??
        data.paymentAmount ??
        "";

      const currency =
        data.currency || data.currencyCode || data.paymentCurrency || "QAR";

      const amount = amountRaw
        ? money(amountRaw, currency)
        : `0.00 ${currency}`.trim();

      const receiptNo =
        data.receiptNo || data.receiptNumber || data.receipt || "";

      const invoiceNo =
        data.invoiceNo ||
        data.invoiceNumber ||
        data.invoice ||
        data.invoiceRef ||
        "";

      const paymentRef =
        data.paymentRef ||
        data.referenceNo ||
        data.reference ||
        data.transactionId ||
        data.transactionRef ||
        receiptNo ||
        invoiceNo ||
        "-";

      const paymentStatus = data.paymentStatus || data.status || "PAID";
      const paymentMethod = data.paymentMethod || data.method || "CASH";
      const paidAt =
        data.paidAt || data.paymentDate || data.paidDate || data.date || "";

      const receiptUrl =
        data.receiptUrl ||
        data.paymentUrl ||
        data.actionUrl ||
        data.viewPaymentUrl ||
        "";

      return {
        subject: `Payment Receipt - ${participantName}`,
        html: baseShell({
          title: "Payment Receipt",
          preheader: "Your payment was received successfully.",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">Payment Successful</h2>
            <p style="margin:0 0 12px 0;">Hi ${esc(parentName)},</p>
            <p style="margin:0 0 12px 0;">
              We have successfully received your payment for <strong>${esc(
                participantName,
              )}</strong>.
            </p>
            ${infoTable([
              ["Amount", amount],
              ["Reference", paymentRef],
              ["Child", participantName],
              ["Event", eventName],
              ["Status", paymentStatus],
              ["Method", paymentMethod],
              ["Receipt No", receiptNo],
              ["Invoice No", invoiceNo],
              ["Paid At", paidAt],
            ])}
            ${button("View Payment Details", receiptUrl)}
          `,
        }),
        text: [
          "Payment Successful",
          "",
          `Hi ${parentName},`,
          `We have successfully received your payment for ${participantName}.`,
          `Amount: ${amount}`,
          `Reference: ${paymentRef}`,
          `Child: ${participantName}`,
          `Event: ${eventName}`,
          `Status: ${paymentStatus}`,
          `Method: ${paymentMethod}`,
          receiptNo ? `Receipt No: ${receiptNo}` : "",
          invoiceNo ? `Invoice No: ${invoiceNo}` : "",
          paidAt ? `Paid At: ${paidAt}` : "",
          receiptUrl ? `View Payment Details: ${receiptUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "PAYMENT_FAILED": {
      const parentName = data.parentName || data.name || "Parent";
      const childName =
        data.childName || data.participantName || data.participant || "-";
      const eventName = data.eventName || "-";
      const amount = money(data.amount, data.currency || "");
      const actionUrl = data.actionUrl || data.paymentUrl || "";

      return {
        subject: `Payment Failed - ${eventName}`,
        html: baseShell({
          title: "Payment Failed",
          preheader: "Your payment attempt was not completed.",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">Payment Failed</h2>
            <p style="margin:0 0 12px 0;">Hi ${esc(parentName)},</p>
            <p style="margin:0 0 12px 0;">
              We could not complete your payment for <strong>${esc(
                eventName,
              )}</strong>.
            </p>
            ${infoTable([
              ["Child", childName],
              ["Event", eventName],
              ["Amount", amount],
              ["Status", data.paymentStatus || "FAILED"],
              ["Reference", data.paymentRef || data.referenceNo || ""],
            ])}
            <p style="margin:18px 0 0 0;color:#6b7280;font-size:13px;">
              Please try again or contact the academy if the issue continues.
            </p>
            ${button("Review Payment", actionUrl, "#111827")}
          `,
        }),
        text: [
          "Payment Failed",
          "",
          `Hi ${parentName},`,
          `We could not complete your payment for ${eventName}.`,
          `Child: ${childName}`,
          `Amount: ${amount}`,
          `Status: ${data.paymentStatus || "FAILED"}`,
          data.paymentRef || data.referenceNo
            ? `Reference: ${data.paymentRef || data.referenceNo}`
            : "",
          actionUrl ? `Review Payment: ${actionUrl}` : "",
          "Please try again or contact the academy if the issue continues.",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "RESULT_PUBLISHED": {
      const name = data.name || data.parentName || "there";
      const eventName = data.eventName || data.groupName || "your event";
      const resultsUrl = data.resultsUrl || data.actionUrl || "";

      return {
        subject: `Results Published - ${eventName}`,
        html: baseShell({
          title: "Results Published",
          preheader: "New competition results are now available.",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">Results Are Now Available</h2>
            <p style="margin:0 0 12px 0;">Hello ${esc(name)},</p>
            <p style="margin:0 0 12px 0;">
              The results for <strong>${esc(eventName)}</strong> have been published.
            </p>
            ${infoTable([
              ["Participant", data.participantName || data.childName || ""],
              ["Group", data.groupName || ""],
              ["Level", data.level || ""],
              ["Score", data.score || data.total || ""],
              ["Rank", data.rank || ""],
            ])}
            <p style="margin:0 0 12px 0;">
              You can review the latest scores and standings from your dashboard.
            </p>
            ${button("View Results", resultsUrl, "#111827")}
          `,
        }),
        text: [
          "Results Are Now Available",
          "",
          `Hello ${name},`,
          `The results for ${eventName} have been published.`,
          data.participantName || data.childName
            ? `Participant: ${data.participantName || data.childName}`
            : "",
          data.groupName ? `Group: ${data.groupName}` : "",
          data.level ? `Level: ${data.level}` : "",
          data.score || data.total ? `Score: ${data.score || data.total}` : "",
          data.rank ? `Rank: ${data.rank}` : "",
          "You can review the latest scores and standings from your dashboard.",
          resultsUrl ? `View Results: ${resultsUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "CERTIFICATE_READY": {
      const name = data.name || data.parentName || "there";
      const eventName = data.eventName || "the event";
      const certificateUrl = data.certificateUrl || data.actionUrl || "";
      const verifyUrl = data.verifyUrl || "";
      const serialNo = data.serialNo || "";

      return {
        subject: `Certificate Ready - ${eventName}`,
        html: baseShell({
          title: "Certificate Ready",
          preheader: "Your certificate is ready to download.",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">Certificate Ready</h2>
            <p style="margin:0 0 12px 0;">Hello ${esc(name)},</p>
            <p style="margin:0 0 12px 0;">
              Your certificate for <strong>${esc(eventName)}</strong> is now ready.
            </p>
            ${infoTable([
              ["Participant", data.participantName || data.childName || ""],
              ["Event", eventName],
              ["Certificate", data.certificateTitle || ""],
              ["Serial No", serialNo],
            ])}
            ${button("Download Certificate", certificateUrl)}
            ${
              verifyUrl
                ? `<p style="margin:18px 0 0 0;"><a href="${esc(
                    verifyUrl,
                  )}" style="color:#e11d2e;font-weight:700;text-decoration:none;">Verify Certificate</a></p>`
                : ""
            }
          `,
        }),
        text: [
          "Certificate Ready",
          "",
          `Hello ${name},`,
          `Your certificate for ${eventName} is now ready.`,
          data.participantName || data.childName
            ? `Participant: ${data.participantName || data.childName}`
            : "",
          data.certificateTitle ? `Certificate: ${data.certificateTitle}` : "",
          serialNo ? `Serial No: ${serialNo}` : "",
          certificateUrl ? `Download Certificate: ${certificateUrl}` : "",
          verifyUrl ? `Verify Certificate: ${verifyUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "EVENT_REMINDER": {
      const name = data.name || data.parentName || "there";
      const eventName = data.eventName || "Upcoming Event";
      const actionUrl = data.actionUrl || data.loginUrl || "";
      const actionLabel = data.actionLabel || "View Event";

      return {
        subject: `Event Reminder - ${eventName}`,
        html: baseShell({
          title: "Event Reminder",
          preheader: "Reminder about your upcoming event.",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">Event Reminder</h2>
            <p style="margin:0 0 12px 0;">Hello ${esc(name)},</p>
            <p style="margin:0 0 12px 0;">
              This is a reminder for <strong>${esc(eventName)}</strong>.
            </p>
            ${infoTable([
              ["Participant", data.participantName || data.childName || ""],
              ["Event", eventName],
              ["Activity", data.activityName || ""],
              ["Date", data.eventDate || data.date || ""],
              ["Time", data.eventTime || data.time || ""],
              ["Venue", data.venue || ""],
            ])}
            <p style="margin:0 0 12px 0;">
              Please be prepared and arrive on time.
            </p>
            ${button(actionLabel, actionUrl)}
          `,
        }),
        text: [
          "Event Reminder",
          "",
          `Hello ${name},`,
          `This is a reminder for ${eventName}.`,
          data.participantName || data.childName
            ? `Participant: ${data.participantName || data.childName}`
            : "",
          data.activityName ? `Activity: ${data.activityName}` : "",
          data.eventDate || data.date
            ? `Date: ${data.eventDate || data.date}`
            : "",
          data.eventTime || data.time
            ? `Time: ${data.eventTime || data.time}`
            : "",
          data.venue ? `Venue: ${data.venue}` : "",
          actionUrl ? `${actionLabel}: ${actionUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "REGISTRATION_APPROVED": {
      const name = data.name || "there";
      const academyName = data.academyName || "Rebel Angels Gymnastics";
      const actionUrl = data.actionUrl || data.loginUrl || "";

      return {
        subject: `Registration Approved - ${academyName}`,
        html: baseShell({
          title: "Registration Approved",
          preheader: "Your registration has been approved.",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">Registration Approved</h2>
            <p style="margin:0 0 12px 0;">Hello ${esc(name)},</p>
            <p style="margin:0 0 12px 0;">
              Your registration for <strong>${esc(
                academyName,
              )}</strong> has been approved.
            </p>
            ${button("Open Dashboard", actionUrl)}
          `,
        }),
        text: [
          "Registration Approved",
          "",
          `Hello ${name},`,
          `Your registration for ${academyName} has been approved.`,
          actionUrl ? `Open Dashboard: ${actionUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "REGISTRATION_REJECTED": {
      const name = data.name || "there";
      const academyName = data.academyName || "Rebel Angels Gymnastics";
      const reason = data.reason || data.message || "";

      return {
        subject: `Registration Update - ${academyName}`,
        html: baseShell({
          title: "Registration Update",
          preheader: "There is an update about your registration.",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">Registration Update</h2>
            <p style="margin:0 0 12px 0;">Hello ${esc(name)},</p>
            <p style="margin:0 0 12px 0;">
              Your registration for <strong>${esc(
                academyName,
              )}</strong> could not be approved at this time.
            </p>
            ${
              reason
                ? `<p style="margin:0 0 12px 0;"><strong>Reason:</strong> ${esc(
                    reason,
                  )}</p>`
                : ""
            }
          `,
        }),
        text: [
          "Registration Update",
          "",
          `Hello ${name},`,
          `Your registration for ${academyName} could not be approved at this time.`,
          reason ? `Reason: ${reason}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    case "PASSWORD_RESET": {
      const name = data.name || "there";
      const resetUrl = data.resetUrl || "";
      const otp = data.otp || "";
      const expiresInMinutes = data.expiresInMinutes || 15;

      return {
        subject: "Password Reset - Rebel Angels",
        html: baseShell({
          title: "Password Reset",
          preheader: "Use this email to reset your password.",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">Reset Your Password</h2>
            <p style="margin:0 0 12px 0;">Hello ${esc(name)},</p>
            <p style="margin:0 0 12px 0;">
              We received a request to reset your password.
            </p>
            ${
              otp
                ? `
                  <p style="margin:0 0 12px 0;">
                    Your verification code is:
                  </p>
                  <div style="margin:12px 0 18px 0;font-size:28px;font-weight:800;letter-spacing:6px;color:#111827;">
                    ${esc(otp)}
                  </div>
                `
                : ""
            }
            <p style="margin:0 0 12px 0;">
              This request will expire in ${esc(expiresInMinutes)} minutes.
            </p>
            ${button("Reset Password", resetUrl)}
            <p style="margin:18px 0 0 0;color:#6b7280;font-size:13px;">
              If you did not request this, you can safely ignore this email.
            </p>
          `,
        }),
        text: [
          "Reset Your Password",
          "",
          `Hello ${name},`,
          "We received a request to reset your password.",
          otp ? `Verification code: ${otp}` : "",
          `This request will expire in ${expiresInMinutes} minutes.`,
          resetUrl ? `Reset Password: ${resetUrl}` : "",
          "If you did not request this, you can safely ignore this email.",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    default: {
      const subject = data.subject || "Rebel Angels Notification";
      const message = data.message || "You have a new update.";
      const actionLabel = data.actionLabel || "Open Dashboard";
      const actionUrl = data.actionUrl || "";

      return {
        subject,
        html: baseShell({
          title: subject,
          preheader: data.preview || "",
          content: `
            <h2 style="margin:0 0 12px 0;font-size:24px;">${esc(subject)}</h2>
            <p style="margin:0;">${esc(message)}</p>
            ${button(actionLabel, actionUrl)}
          `,
        }),
        text: [
          subject,
          "",
          message,
          actionUrl ? `${actionLabel}: ${actionUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
  }
}
