import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../db.js";
import EmailTemplate from "../models/EmailTemplate.js";
import { extractTemplateVariables } from "../services/templateRenderer.service.js";

async function upsertSystemTemplate(data) {
  const subject = String(data.subject || "");
  const html = String(data.html || "");
  const text = String(data.text || "");

  const variables = Array.from(
    new Set([
      ...extractTemplateVariables(subject),
      ...extractTemplateVariables(html),
      ...extractTemplateVariables(text),
      ...(Array.isArray(data.variables) ? data.variables : []),
    ]),
  );

  await EmailTemplate.updateOne(
    { academyId: null, key: data.key },
    {
      $set: {
        academyId: null,
        name: data.name,
        key: data.key,
        category: data.category,
        subject,
        html,
        text,
        variables,
        description: data.description || "",
        isActive: true,
        isSystem: true,
        meta: data.meta || {},
      },
    },
    { upsert: true },
  );
}

async function run() {
  await connectDB();

  await upsertSystemTemplate({
    key: "payment_success",
    name: "Payment Success",
    category: "PAYMENT",
    description: "Sent automatically when payment is successful",
    subject: "Payment received for {{participantName}}",
    html: `
      <div style="font-family:Arial,sans-serif;padding:20px;line-height:1.6">
        <h2>Hello {{parentName}},</h2>
        <p>Your payment of <strong>{{amount}}</strong> for <strong>{{participantName}}</strong> was successful.</p>
        <p>Event: {{eventName}}</p>
        <p>Invoice: {{invoiceNumber}}</p>
        <p>Status: {{paymentStatus}}</p>
        <br />
        <p>Thank you,<br/>{{academyName}}</p>
      </div>
    `,
    text: `
Hello {{parentName}},
Your payment of {{amount}} for {{participantName}} was successful.
Event: {{eventName}}
Invoice: {{invoiceNumber}}
Status: {{paymentStatus}}

Thank you,
{{academyName}}
    `,
  });

  await upsertSystemTemplate({
    key: "result_published",
    name: "Result Published",
    category: "RESULT",
    description: "Sent automatically when a result is published",
    subject: "Results published for {{participantName}}",
    html: `
      <div style="font-family:Arial,sans-serif;padding:20px;line-height:1.6">
        <h2>Hello {{parentName}},</h2>
        <p>The result for <strong>{{participantName}}</strong> has been published.</p>
        <p>Activity: {{activityName}}</p>
        <p>Score: <strong>{{score}}</strong></p>
        <p>Rank: <strong>{{rank}}</strong></p>
        <br />
        <p>Regards,<br/>{{academyName}}</p>
      </div>
    `,
    text: `
Hello {{parentName}},
The result for {{participantName}} has been published.
Activity: {{activityName}}
Score: {{score}}
Rank: {{rank}}

Regards,
{{academyName}}
    `,
  });

  await upsertSystemTemplate({
    key: "certificate_ready",
    name: "Certificate Ready",
    category: "CERTIFICATE",
    description: "Sent automatically when certificate is generated",
    subject: "Certificate ready for {{participantName}}",
    html: `
      <div style="font-family:Arial,sans-serif;padding:20px;line-height:1.6">
        <h2>Hello {{parentName}},</h2>
        <p>The certificate for <strong>{{participantName}}</strong> is now ready.</p>
        <p>Event: {{eventName}}</p>
        <p><a href="{{certificateUrl}}">Download Certificate</a></p>
        <br />
        <p>Regards,<br/>{{academyName}}</p>
      </div>
    `,
    text: `
Hello {{parentName}},
The certificate for {{participantName}} is now ready.
Event: {{eventName}}
Download: {{certificateUrl}}

Regards,
{{academyName}}
    `,
  });

  console.log("✅ System email templates seeded");
  await mongoose.connection.close();
}

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
