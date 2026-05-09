// server/src/routes/verify.routes.js
import { Router } from "express";
import Certificate from "../models/Certificate.js";
import { verifyCertificateToken } from "../utils/certificateVerify.js";

const router = Router();

router.get("/verify-certificate", async (req, res) => {
  try {
    const token = String(req.query.t || "");
    const payload = verifyCertificateToken(token);

    const cert = await Certificate.findOne({
      serialNo: payload.serialNo,
      eventId: payload.eventId,
      participantId: payload.participantId,
    });

    if (!cert) {
      return res.status(404).send(renderVerifyPage({
        ok: false,
        title: "Certificate Not Found",
        message: "No matching certificate record exists.",
      }));
    }

    if (cert.isRevoked) {
      return res.status(410).send(renderVerifyPage({
        ok: false,
        title: "Certificate Revoked",
        message: "This certificate has been revoked.",
        cert,
      }));
    }

    return res.send(renderVerifyPage({
      ok: true,
      title: "Certificate Verified",
      message: "This certificate is valid.",
      cert,
    }));
  } catch (err) {
    return res.status(400).send(renderVerifyPage({
      ok: false,
      title: "Invalid Verification Link",
      message: err?.message || "Verification failed.",
    }));
  }
});

function renderVerifyPage({ ok, title, message, cert }) {
  return `
  <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; background: #f8fafc; }
        .card { max-width: 760px; margin: auto; background: white; border-radius: 18px; padding: 28px; box-shadow: 0 12px 30px rgba(0,0,0,.08); }
        h1 { margin: 0 0 10px; color: ${ok ? "#166534" : "#e11d2e"}; }
        .msg { font-size: 16px; margin-bottom: 18px; }
        .meta { margin: 8px 0; color: #334155; }
        .pill { display:inline-block; padding: 6px 10px; border-radius: 999px; background:#f1f5f9; margin-bottom: 12px; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="pill">${ok ? "VALID" : "INVALID"}</div>
        <h1>${title}</h1>
        <div class="msg">${message}</div>
        ${
          cert
            ? `
          <div class="meta"><b>Serial No:</b> ${cert.serialNo}</div>
          <div class="meta"><b>Participant:</b> ${cert.participantName}</div>
          <div class="meta"><b>Event:</b> ${cert.eventName}</div>
          <div class="meta"><b>Group:</b> ${cert.groupName}${cert.level ? ` (${cert.level})` : ""}</div>
          <div class="meta"><b>BIB No:</b> ${cert.bibNo || "—"}</div>
          <div class="meta"><b>Title:</b> ${cert.title}</div>
          <div class="meta"><b>Issued At:</b> ${new Date(cert.issuedAt).toLocaleString()}</div>
          <div class="meta"><b>Status:</b> ${cert.isRevoked ? "Revoked" : "Active"}</div>
        `
            : ""
        }
      </div>
    </body>
  </html>
  `;
}

export default router;