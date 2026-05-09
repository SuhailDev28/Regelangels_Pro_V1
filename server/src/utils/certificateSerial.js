// server/src/utils/certificateSerial.js
export function generateCertificateSerial({
  eventId,
  participantId,
  date = new Date(),
}) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  const ev = String(eventId || "").slice(-4).toUpperCase() || "EVNT";
  const pt = String(participantId || "").slice(-6).toUpperCase() || "PARTIC";

  return `RA-${y}${m}${d}-${ev}-${pt}`;
}