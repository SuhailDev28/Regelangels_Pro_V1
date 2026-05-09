import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { getUser, setUser } from "../../lib/auth.js";

const APP_AUTH_CHANGED_EVENT = "ra:app:auth-changed";

export default function ForceChangePassword() {
  const navigate = useNavigate();
  const user = useMemo(() => getUser?.() || null, []);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  function emitAuthChanged() {
    try {
      window.dispatchEvent(new CustomEvent(APP_AUTH_CHANGED_EVENT));
    } catch {
      // ignore
    }
  }

  function getHomePath(role) {
    const r = String(role || "").toUpperCase();

    if (r === "SUPER_ADMIN") return "/super-admin";
    if (r === "ADMIN") return "/admin";
    if (r === "JUDGE") return "/judge";
    if (r === "PARTICIPANT") return "/participant";
    if (r === "PARENT") return "/parent/dashboard";

    return "/";
  }

  async function onSubmit(e) {
    e?.preventDefault?.();
    if (busy) return;

    setErr("");
    setMsg("");

    if (!currentPassword) {
      setErr("Temporary password is required");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setErr("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match");
      return;
    }

    if (newPassword === currentPassword) {
      setErr("New password must be different from temporary password");
      return;
    }

    try {
      setBusy(true);

      const res = await api.changePassword({
        currentPassword,
        newPassword,
      });

      const updatedUser = {
        ...(user || {}),
        ...(res?.user || {}),
        mustChangePassword: false,
      };

      setUser(updatedUser);
      emitAuthChanged();

      setMsg("Password changed successfully.");

      navigate(getHomePath(updatedUser?.role), { replace: true });
    } catch (e2) {
      setErr(e2?.message || "Failed to change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background:
          "linear-gradient(180deg, rgba(248,250,252,1), rgba(241,245,249,1))",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          borderRadius: 24,
          border: "1px solid rgba(17,24,39,0.08)",
          padding: 24,
          boxShadow: "0 24px 60px rgba(2,8,23,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: ".08em",
            color: "#e11d2e",
            marginBottom: 10,
          }}
        >
          SECURITY CHECK
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 950,
            color: "#0f172a",
          }}
        >
          Change Temporary Password
        </h1>

        <p
          style={{
            marginTop: 8,
            marginBottom: 18,
            fontSize: 13,
            lineHeight: 1.5,
            color: "#475569",
            fontWeight: 700,
          }}
        >
          For security, you must change your temporary password before accessing
          the dashboard.
        </p>

        {err ? (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(255,241,242,0.95)",
              border: "1px solid rgba(225,29,46,0.18)",
              color: "#e11d2e",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {err}
          </div>
        ) : null}

        {msg ? (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(236,253,245,0.98)",
              border: "1px solid rgba(16,185,129,0.18)",
              color: "#047857",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {msg}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#475569",
                marginBottom: 6,
              }}
            >
              Temporary Password
            </div>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter temporary password"
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#475569",
                marginBottom: 6,
              }}
            >
              New Password
            </div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              style={inputStyle}
              autoComplete="new-password"
            />
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#475569",
                marginBottom: 6,
              }}
            >
              Confirm New Password
            </div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={inputStyle}
              autoComplete="new-password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 18,
            width: "100%",
            height: 46,
            borderRadius: 14,
            border: "1px solid rgba(225,29,46,0.28)",
            background:
              "linear-gradient(180deg, rgba(255,241,242,0.96), rgba(255,228,230,0.95))",
            color: "#e11d2e",
            fontWeight: 950,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Updating..." : "Update Password"}
        </button>
      </form>
    </section>
  );
}

const inputStyle = {
  width: "100%",
  minHeight: 48,
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(17,24,39,0.12)",
  background: "rgba(255,255,255,0.96)",
  outline: "none",
  fontWeight: 800,
  fontSize: 14,
  color: "#0f172a",
};
