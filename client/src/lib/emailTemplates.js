export function academyWelcomeTemplate({
  academyName,
  adminName,
  loginUrl,
  email,
}) {
  return {
    subject: `Welcome to ${academyName}`,
    text: `Hello ${adminName}, your academy account is ready. Login: ${loginUrl} Email: ${email}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Welcome to ${academyName}</h2>
        <p>Hello ${adminName},</p>
        <p>Your academy admin account has been created successfully.</p>
        <p><strong>Login Email:</strong> ${email}</p>
        <p>
          <a href="${loginUrl}" style="display:inline-block;padding:10px 16px;background:#e11d2e;color:#fff;text-decoration:none;border-radius:8px">
            Login to Dashboard
          </a>
        </p>
      </div>
    `,
  };
}

export function resetPasswordTemplate({ name, resetUrl }) {
  return {
    subject: "Reset your password",
    text: `Hello ${name}, reset your password here: ${resetUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Password Reset</h2>
        <p>Hello ${name},</p>
        <p>Click the button below to reset your password.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px">
            Reset Password
          </a>
        </p>
      </div>
    `,
  };
}

export function eventRegistrationTemplate({
  parentName,
  childName,
  eventName,
}) {
  return {
    subject: `Registration confirmed: ${eventName}`,
    text: `Hi ${parentName}, ${childName} has been registered for ${eventName}.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Event Registration Confirmed</h2>
        <p>Hi ${parentName},</p>
        <p><strong>${childName}</strong> has been registered for <strong>${eventName}</strong>.</p>
      </div>
    `,
  };
}
