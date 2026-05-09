export function participantWelcomeEmail({
  participantName,
  email,
  tempPassword,
  loginUrl,
  academyName,
}) {
  const subject = `Welcome to ${academyName || "the Academy Portal"}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin-bottom:8px;">Welcome ${participantName || ""}</h2>
      <p>Your participant account has been created successfully.</p>

      <div style="padding:14px 16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
        <p style="margin:0 0 8px;"><b>Login Email:</b> ${email}</p>
        <p style="margin:0 0 8px;"><b>Temporary Password:</b> ${tempPassword}</p>
        <p style="margin:0;"><b>Login URL:</b> <a href="${loginUrl}">${loginUrl}</a></p>
      </div>

      <p style="margin-top:14px;">For security, you must change this password after your first login.</p>
    </div>
  `;

  const text = [
    `Welcome ${participantName || ""}`,
    `Your participant account has been created.`,
    `Login Email: ${email}`,
    `Temporary Password: ${tempPassword}`,
    `Login URL: ${loginUrl}`,
    `You must change this password after your first login.`,
  ].join("\n");

  return { subject, html, text };
}

export function parentWelcomeEmail({
  parentName,
  participantName,
  email,
  tempPassword,
  loginUrl,
  academyName,
}) {
  const subject = `Parent account created for ${participantName || "participant"} - ${academyName || "Academy Portal"}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin-bottom:8px;">Welcome ${parentName || ""}</h2>
      <p>Your parent dashboard account has been created.</p>

      <div style="padding:14px 16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
        <p style="margin:0 0 8px;"><b>Participant:</b> ${participantName || "—"}</p>
        <p style="margin:0 0 8px;"><b>Login Email:</b> ${email}</p>
        <p style="margin:0 0 8px;"><b>Temporary Password:</b> ${tempPassword}</p>
        <p style="margin:0;"><b>Login URL:</b> <a href="${loginUrl}">${loginUrl}</a></p>
      </div>

      <p style="margin-top:14px;">For security, you must change this password after your first login.</p>
    </div>
  `;

  const text = [
    `Welcome ${parentName || ""}`,
    `Your parent dashboard account has been created.`,
    `Participant: ${participantName || "—"}`,
    `Login Email: ${email}`,
    `Temporary Password: ${tempPassword}`,
    `Login URL: ${loginUrl}`,
    `You must change this password after your first login.`,
  ].join("\n");

  return { subject, html, text };
}
