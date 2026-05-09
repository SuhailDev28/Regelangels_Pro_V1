import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";

import User from "../models/User.js";
import Academy from "../models/Academy.js";
import { sendTransactionalEmail } from "../services/email/emailService.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

/* =========================
 * SCHEMAS
 * ========================= */

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  academyCode: z.string().trim().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Invalid email"),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

/* =========================
 * CONFIG
 * ========================= */

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

const REFRESH_COOKIE_MAX_AGE =
  Number(process.env.REFRESH_COOKIE_MAX_AGE_MS) || 1000 * 60 * 60 * 24 * 7;

/* =========================
 * HELPERS
 * ========================= */

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function buildAppUrl(pathname = "") {
  const base = String(process.env.APP_URL || "http://localhost:5173").replace(
    /\/+$/,
    "",
  );

  const path = String(pathname || "");
  if (!path) return base;
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base}/${path}`;
}

function ensureJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("Server misconfigured: JWT_SECRET missing");
  }
}

function isAcademyActive(user) {
  if (normalizeRole(user?.role) === "SUPER_ADMIN") return true;
  if (!user?.academyId) return false;
  return user.academyId.status !== "INACTIVE";
}

function getUserIdFromReq(req) {
  return (
    req?.user?._id ||
    req?.user?.id ||
    req?.user?.userId ||
    req?.user?.sub ||
    null
  );
}

function getAcademyIdFromUser(user) {
  return (
    user?.academyId?._id?.toString?.() ||
    user?.academyId?.id?.toString?.() ||
    user?.academyId?.toString?.() ||
    null
  );
}

function buildUserResponse(user) {
  const academyId = getAcademyIdFromUser(user);

  return {
    id: String(user._id),
    _id: String(user._id),
    userId: String(user._id),
    name: user.name,
    role: normalizeRole(user.role),
    email: user.email,
    academyId,
    academyName: user.academyId?.name || null,
    academyCode: user.academyId?.code || null,
    academyLogo: user.academyId?.logoUrl || null,
    mustChangePassword: !!user.mustChangePassword,
    passwordChangedAt: user.passwordChangedAt || null,
    tempPasswordIssuedAt: user.tempPasswordIssuedAt || null,
    isActive: user.isActive !== false,
  };
}

function buildJwtPayload(user) {
  const userId = String(user._id);
  const academyId = getAcademyIdFromUser(user);
  const role = normalizeRole(user.role);

  return {
    id: userId,
    _id: userId,
    userId,
    role,
    academyId,
    mustChangePassword: !!user.mustChangePassword,
  };
}

function signAccessToken(user) {
  ensureJwtSecret();

  return jwt.sign(buildJwtPayload(user), process.env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    algorithm: "HS256",
  });
}

function signRefreshToken(user) {
  ensureJwtSecret();

  return jwt.sign(
    {
      type: "refresh",
      ...buildJwtPayload(user),
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      subject: String(user._id),
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      algorithm: "HS256",
    },
  );
}

function getCookieOptions() {
  const production = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/api/auth",
  };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie("refreshToken", refreshToken, {
    ...getCookieOptions(),
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", getCookieOptions());
}

function sendLoginResponse(res, user) {
  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  clearRefreshCookie(res);
  setRefreshCookie(res, refreshToken);

  return res.json({
    ok: true,
    token,
    accessToken: token,
    accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN,
    mustChangePassword: !!user.mustChangePassword,
    user: buildUserResponse(user),
  });
}

/* =========================
 * POST /api/auth/login
 * ========================= */

router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: parsed.error.flatten(),
      });
    }

    ensureJwtSecret();

    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;
    const academyCode = String(parsed.data.academyCode || "")
      .trim()
      .toUpperCase();

    let user = null;

    if (academyCode) {
      const academy = await Academy.findOne({
        code: academyCode,
        status: "ACTIVE",
      })
        .select("_id name code logoUrl status")
        .lean();

      if (!academy) {
        return res.status(401).json({ message: "Invalid academy code" });
      }

      user = await User.findOne({
        email,
        academyId: academy._id,
      })
        .populate("academyId", "name code logoUrl status")
        .select(
          "_id name email role passwordHash isActive academyId mustChangePassword passwordChangedAt tempPasswordIssuedAt",
        )
        .lean();
    } else {
      const superAdmin = await User.findOne({
        email,
        role: "SUPER_ADMIN",
      })
        .select(
          "_id name email role passwordHash isActive academyId mustChangePassword passwordChangedAt tempPasswordIssuedAt",
        )
        .lean();

      if (superAdmin && superAdmin.isActive !== false) {
        user = {
          ...superAdmin,
          academyId: null,
          role: "SUPER_ADMIN",
        };
      } else {
        const matches = await User.find({
          email,
          role: { $in: ["ADMIN", "JUDGE", "PARTICIPANT", "PARENT"] },
        })
          .populate("academyId", "name code logoUrl status")
          .select(
            "_id name email role passwordHash isActive academyId mustChangePassword passwordChangedAt tempPasswordIssuedAt",
          )
          .lean();

        const activeMatches = (matches || []).filter(
          (u) => u?.isActive !== false && isAcademyActive(u),
        );

        if (!activeMatches.length) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        if (activeMatches.length > 1) {
          return res.status(409).json({
            message:
              "Multiple academies found for this email. Please provide academyCode.",
            requireAcademyCode: true,
            academies: activeMatches
              .map((u) => ({
                academyId: u.academyId?._id?.toString() || null,
                academyName: u.academyId?.name || "",
                academyCode: u.academyId?.code || "",
                academyLogo: u.academyId?.logoUrl || "",
              }))
              .filter((a) => a.academyId),
          });
        }

        user = activeMatches[0];
      }
    }

    if (!user || user.isActive === false) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (
      normalizeRole(user.role) !== "SUPER_ADMIN" &&
      user.academyId &&
      user.academyId.status === "INACTIVE"
    ) {
      return res.status(403).json({ message: "Academy is inactive" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash || "");

    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return sendLoginResponse(res, user);
  } catch (e) {
    console.error("LOGIN ERROR:", e);

    if (String(e?.message || "").includes("JWT_SECRET")) {
      return res.status(500).json({
        message: "Server misconfigured (JWT_SECRET missing)",
      });
    }

    return res.status(500).json({ message: "Login failed" });
  }
});

/* =========================
 * POST /api/auth/refresh
 * Kept for compatibility, but frontend should not auto-use this
 * for multi-tab judge/admin testing.
 * ========================= */

router.post("/refresh", async (req, res) => {
  try {
    ensureJwtSecret();

    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      {
        algorithms: ["HS256"],
      },
    );

    if (decoded?.type !== "refresh") {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.sub)
      .populate("academyId", "name code logoUrl status")
      .select(
        "_id name email role isActive academyId mustChangePassword passwordChangedAt tempPasswordIssuedAt",
      );

    if (!user || user.isActive === false) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "User not found" });
    }

    if (
      normalizeRole(user.role) !== "SUPER_ADMIN" &&
      user.academyId &&
      user.academyId.status === "INACTIVE"
    ) {
      clearRefreshCookie(res);
      return res.status(403).json({ message: "Academy is inactive" });
    }

    const token = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    setRefreshCookie(res, newRefreshToken);

    return res.json({
      ok: true,
      token,
      accessToken: token,
      accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN,
      user: buildUserResponse(user),
    });
  } catch (e) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

/* =========================
 * POST /api/auth/logout
 * ========================= */

router.post("/logout", (_req, res) => {
  clearRefreshCookie(res);

  return res.json({
    ok: true,
    message: "Logged out successfully",
  });
});

/* =========================
 * GET /api/auth/me
 * ========================= */

router.get("/me", auth, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId)
      .populate("academyId", "name code logoUrl status")
      .select(
        "_id name email role isActive academyId mustChangePassword passwordChangedAt tempPasswordIssuedAt",
      );

    if (!user || user.isActive === false) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      normalizeRole(user.role) !== "SUPER_ADMIN" &&
      user.academyId &&
      user.academyId.status === "INACTIVE"
    ) {
      return res.status(403).json({ message: "Academy is inactive" });
    }

    return res.json({
      ok: true,
      user: buildUserResponse(user),
    });
  } catch (e) {
    console.error("ME ERROR:", e);
    return res.status(500).json({ message: "Failed to load user" });
  }
});

/* =========================
 * POST /api/auth/forgot-password
 * ========================= */

router.post("/forgot-password", async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: parsed.error.flatten(),
      });
    }

    const email = normalizeEmail(parsed.data.email);

    const users = await User.find({
      email,
      isActive: true,
    }).select("_id name email role academyId resetTokenHash resetTokenExp");

    if (!users.length) {
      return res.json({
        ok: true,
        message:
          "If an account with that email exists, a reset link has been sent.",
      });
    }

    const appUrl = buildAppUrl();

    for (const user of users) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      user.resetTokenHash = hashedToken;
      user.resetTokenExp = new Date(Date.now() + 1000 * 60 * 15);
      await user.save();

      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      await sendTransactionalEmail({
        to: user.email,
        template: "PASSWORD_RESET",
        data: {
          name: user.name || "there",
          resetUrl,
          expiresInMinutes: 15,
        },
        meta: {
          type: "PASSWORD_RESET",
          userId: String(user._id),
          academyId: user.academyId ? String(user.academyId) : null,
          role: user.role || "",
        },
      });
    }

    return res.json({
      ok: true,
      message:
        "If an account with that email exists, a reset link has been sent.",
    });
  } catch (e) {
    console.error("FORGOT PASSWORD ERROR:", e);
    return res.status(500).json({ message: "Failed to process request" });
  }
});

/* =========================
 * POST /api/auth/reset-password
 * ========================= */

router.post("/reset-password", async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: parsed.error.flatten(),
      });
    }

    const rawToken = parsed.data.token;
    const newPassword = parsed.data.password;

    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const user = await User.findOne({
      resetTokenHash: hashedToken,
      resetTokenExp: { $gt: new Date() },
      isActive: true,
    }).populate("academyId", "name code logoUrl status");

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset link",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetTokenHash = "";
    user.resetTokenExp = null;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    return res.json({
      ok: true,
      message: "Password reset successful",
      mustChangePassword: false,
      user: buildUserResponse(user),
    });
  } catch (e) {
    console.error("RESET PASSWORD ERROR:", e);
    return res.status(500).json({ message: "Password reset failed" });
  }
});

/* =========================
 * CHANGE PASSWORD SHARED HANDLER
 * ========================= */

async function handleChangePassword(req, res) {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: parsed.error.flatten(),
      });
    }

    const { currentPassword, newPassword } = parsed.data;
    const userId = getUserIdFromReq(req);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId).populate(
      "academyId",
      "name code logoUrl status",
    );

    if (!user || user.isActive === false) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      normalizeRole(user.role) !== "SUPER_ADMIN" &&
      user.academyId &&
      user.academyId.status === "INACTIVE"
    ) {
      return res.status(403).json({ message: "Academy is inactive" });
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash || "");

    if (!ok) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    const sameAsOld = await bcrypt.compare(
      newPassword,
      user.passwordHash || "",
    );

    if (sameAsOld) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    return res.json({
      ok: true,
      message: "Password changed successfully",
      mustChangePassword: false,
      user: buildUserResponse(user),
    });
  } catch (e) {
    console.error("CHANGE PASSWORD ERROR:", e);
    return res.status(500).json({ message: "Failed to change password" });
  }
}

router.post("/change-password", auth, handleChangePassword);
router.post("/me/change-password", auth, handleChangePassword);

export default router;
