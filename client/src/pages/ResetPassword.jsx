import React, { useMemo, useState } from "react";
import { api } from "../lib/api.js";

const RED = "#e11d2e";
const NAVY = "#111827";

export default function ResetPassword() {
  const token = useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams.get("token") || "";
  }, []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();

    if (loading) return;

    setErr("");
    setMsg("");

    if (!token) {
      setErr("Invalid reset link");
      return;
    }

    if (password.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setErr("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const data = await api.resetPassword(token, password);

      setMsg(data?.message || "Password reset successful");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (e) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #fff5f5 0%, #ffffff 100%)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#fff",
          border: "1px solid rgba(17,24,39,0.08)",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 20px 60px rgba(17,24,39,0.08)",
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 900,
              color: NAVY,
            }}
          >
            Reset Password
          </h1>
          <p
            style={{
              margin: "8px 0 0 0",
              color: "rgba(17,24,39,0.7)",
              lineHeight: 1.6,
            }}
          >
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={onSubmit}>
          <label
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 700,
              color: NAVY,
              marginBottom: 8,
            }}
          >
            New Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            required
            autoComplete="new-password"
            style={{
              width: "100%",
              height: 48,
              borderRadius: 14,
              border: "1px solid rgba(17,24,39,0.14)",
              padding: "0 14px",
              fontSize: 15,
              outline: "none",
              marginBottom: 14,
              boxSizing: "border-box",
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 700,
              color: NAVY,
              marginBottom: 8,
            }}
          >
            Confirm Password
          </label>

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            autoComplete="new-password"
            style={{
              width: "100%",
              height: 48,
              borderRadius: 14,
              border: "1px solid rgba(17,24,39,0.14)",
              padding: "0 14px",
              fontSize: 15,
              outline: "none",
              marginBottom: 14,
              boxSizing: "border-box",
            }}
          />

          {msg ? (
            <div
              style={{
                marginBottom: 14,
                borderRadius: 14,
                padding: 12,
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.18)",
                color: "#166534",
                fontSize: 14,
              }}
            >
              {msg}
            </div>
          ) : null}

          {err ? (
            <div
              style={{
                marginBottom: 14,
                borderRadius: 14,
                padding: 12,
                background: "rgba(225,29,46,0.08)",
                border: "1px solid rgba(225,29,46,0.18)",
                color: "#991b1b",
                fontSize: 14,
              }}
            >
              {err}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: 48,
              border: 0,
              borderRadius: 14,
              background: RED,
              color: "#fff",
              fontSize: 15,
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <a
            href="/login"
            style={{
              color: RED,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}
