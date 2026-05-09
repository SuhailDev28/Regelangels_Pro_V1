// server/routes/testEmail.routes.js
import express from "express";
import { sendTransactionalEmail } from "../services/email/emailService.js";

const router = express.Router();

router.post("/test-email", async (req, res) => {
  try {
    const result = await sendTransactionalEmail({
      to: req.body?.to || process.env.SMTP_USER,
      template: "WELCOME",
      data: {
        name: "Test User",
        loginUrl: `${process.env.APP_URL}/login`,
      },
      meta: {
        type: "TEST_EMAIL",
      },
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to send test email",
    });
  }
});

export default router;
