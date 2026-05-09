// server/src/utils/certificateVerify.js
import crypto from "crypto";

const CERT_VERIFY_SECRET =
  process.env.CERT_VERIFY_SECRET || "change-this-in-env";

export function signCertificatePayload(payload) {
  const json = JSON.stringify(payload);
  const base = Buffer.from(json).toString("base64url");

  const sig = crypto
    .createHmac("sha256", CERT_VERIFY_SECRET)
    .update(base)
    .digest("base64url");

  return `${base}.${sig}`;
}

export function verifyCertificateToken(token) {
  if (!token || !String(token).includes(".")) {
    throw new Error("Invalid token");
  }

  const [base, sig] = String(token).split(".");

  const expected = crypto
    .createHmac("sha256", CERT_VERIFY_SECRET)
    .update(base)
    .digest("base64url");

  if (sig !== expected) {
    throw new Error("Invalid signature");
  }

  const json = Buffer.from(base, "base64url").toString("utf8");
  return JSON.parse(json);
}