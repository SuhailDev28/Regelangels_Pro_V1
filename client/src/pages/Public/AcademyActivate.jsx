import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API_BASE = String(import.meta.env.VITE_API_BASE || "").replace(
  /\/+$/,
  "",
);

export default function AcademyActivate() {
  const [params] = useSearchParams();
  const token = String(params.get("token") || "").trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activated, setActivated] = useState(false);

  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    adminName: "",
    adminEmail: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    let mounted = true;

    async function loadInfo() {
      if (!token) {
        setErr("Missing activation token");
        setLoading(false);
        return;
      }

      try {
        setErr("");
        setMsg("");

        const res = await fetch(
          `${API_BASE}/public/academy-activate-info?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.message || "Failed to load activation details");
        }

        if (!mounted) return;

        setInfo(data || null);
        setForm((prev) => ({
          ...prev,
          adminEmail: data?.email || "",
        }));
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load activation details");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInfo();

    return () => {
      mounted = false;
    };
  }, [token]);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateBeforeSubmit() {
    const adminName = String(form.adminName || "").trim();
    const adminEmail = String(form.adminEmail || "").trim();
    const password = String(form.password || "");
    const confirmPassword = String(form.confirmPassword || "");

    if (!token) return "Missing activation token";
    if (!adminName) return "Admin full name is required";
    if (!adminEmail) return "Admin email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return "Enter a valid admin email";
    }
    if (!password || password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must include at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must include at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must include at least one number";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match";
    }

    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy || activated) return;

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setErr(validationError);
      setMsg("");
      return;
    }

    setBusy(true);
    setErr("");
    setMsg("");

    try {
      const res = await fetch(`${API_BASE}/public/academy-activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          adminName: String(form.adminName || "").trim(),
          adminEmail: String(form.adminEmail || "").trim(),
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "Failed to activate academy");
      }

      setActivated(true);
      setMsg(
        data?.message || "Academy activated successfully. You can now log in.",
      );

      setForm({
        adminName: "",
        adminEmail: data?.loginEmail || form.adminEmail,
        password: "",
        confirmPassword: "",
      });

      setInfo((prev) => ({
        ...(prev || {}),
        academyCode: data?.academyCode || prev?.academyCode || "",
        status: "ACTIVATED",
      }));
    } catch (e) {
      setErr(e?.message || "Failed to activate academy");
    } finally {
      setBusy(false);
    }
  }

  async function copyLoginDetails() {
    if (!loginHelper) return;
    const text = [
      `Role: ${loginHelper.role}`,
      `Email: ${loginHelper.email || "—"}`,
      `Academy Code: ${loginHelper.academyCode || "—"}`,
      `Login URL: ${window.location.origin}/login`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setMsg("Login details copied to clipboard.");
      setErr("");
    } catch {
      setErr("Could not copy login details");
    }
  }

  const loginHelper = useMemo(() => {
    if (!info?.academyCode) return null;
    return {
      role: "ADMIN",
      email: form.adminEmail || info?.email || "",
      academyCode: info.academyCode,
    };
  }, [form.adminEmail, info]);

  const passwordStrength = useMemo(() => {
    const p = String(form.password || "");
    let score = 0;
    if (p.length >= 8) score += 1;
    if (/[A-Z]/.test(p)) score += 1;
    if (/[a-z]/.test(p)) score += 1;
    if (/[0-9]/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;

    if (!p) return { label: "—", color: "#94a3b8", width: "0%" };
    if (score <= 2) return { label: "Weak", color: "#ef4444", width: "33%" };
    if (score <= 4) return { label: "Medium", color: "#f59e0b", width: "66%" };
    return { label: "Strong", color: "#10b981", width: "100%" };
  }, [form.password]);

  return (
    <div style={styles.page}>
      <div style={styles.bgGlowA} />
      <div style={styles.bgGlowB} />

      <div style={styles.shell}>
        <div style={styles.leftPanel}>
          <div style={styles.badge}>Academy Activation</div>

          <h1 style={styles.title}>Complete Setup</h1>

          <p style={styles.subtitle}>
            Finish your academy onboarding by creating the first admin account.
            After this step, you can log in and start using the platform.
          </p>

          <div style={styles.infoCard}>
            <div style={styles.infoTitle}>Activation Flow</div>
            <div style={styles.flowStep}>1. Registration approved</div>
            <div style={styles.flowStep}>2. Create first admin account</div>
            <div style={styles.flowStep}>3. Login using academy code</div>
            <div style={styles.flowStep}>4. Complete academy profile setup</div>
          </div>

          {info ? (
            <div style={styles.infoCard}>
              <div style={styles.infoTitle}>Approved Academy</div>
              <div style={styles.flowStep}>
                <strong>Name:</strong> {info?.academyNameEn || "—"}
              </div>
              <div style={styles.flowStep}>
                <strong>Arabic Name:</strong> {info?.academyNameAr || "—"}
              </div>
              <div style={styles.flowStep}>
                <strong>Academy Code:</strong> {info?.academyCode || "—"}
              </div>
              <div style={styles.flowStep}>
                <strong>Email:</strong> {info?.email || "—"}
              </div>
              <div style={styles.flowStep}>
                <strong>Phone:</strong> {info?.phone || "—"}
              </div>
              <div style={styles.flowStep}>
                <strong>Status:</strong> {info?.status || "—"}
              </div>
            </div>
          ) : null}

          <Link to="/login" style={styles.backLink}>
            ← Back to Login
          </Link>
        </div>

        <div style={styles.card}>
          {loading ? (
            <div style={styles.loadingBox}>Loading activation details...</div>
          ) : err && !info ? (
            <div style={styles.error}>{err}</div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formHeaderRow}>
                <div>
                  <div style={styles.formKicker}>First Admin Account</div>
                  <h2 style={styles.formTitle}>Activate Academy Access</h2>
                </div>
              </div>

              <div style={styles.grid2}>
                <Field
                  label="Admin Full Name"
                  value={form.adminName}
                  onChange={(v) => update("adminName", v)}
                  required
                  placeholder="Enter full name"
                  disabled={activated}
                />
                <Field
                  label="Admin Email"
                  type="email"
                  value={form.adminEmail}
                  onChange={(v) => update("adminEmail", v)}
                  required
                  placeholder="admin@academy.com"
                  disabled={activated}
                />
              </div>

              <div style={styles.grid2}>
                <PasswordField
                  label="Password"
                  value={form.password}
                  onChange={(v) => update("password", v)}
                  required
                  placeholder="Create password"
                  show={showPassword}
                  onToggle={() => setShowPassword((s) => !s)}
                  disabled={activated}
                />
                <PasswordField
                  label="Confirm Password"
                  value={form.confirmPassword}
                  onChange={(v) => update("confirmPassword", v)}
                  required
                  placeholder="Confirm password"
                  show={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((s) => !s)}
                  disabled={activated}
                />
              </div>

              {!activated ? (
                <div style={styles.passwordStrengthWrap}>
                  <div style={styles.passwordStrengthTop}>
                    <span>Password strength</span>
                    <strong style={{ color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </strong>
                  </div>
                  <div style={styles.passwordStrengthBar}>
                    <div
                      style={{
                        ...styles.passwordStrengthFill,
                        width: passwordStrength.width,
                        background: passwordStrength.color,
                      }}
                    />
                  </div>
                  <div style={styles.passwordHint}>
                    Use at least 8 characters with uppercase, lowercase, and
                    number.
                  </div>
                </div>
              ) : null}

              {loginHelper ? (
                <div style={styles.loginBox}>
                  <div style={styles.infoTitle}>
                    Login Details After Activation
                  </div>
                  <div style={styles.flowStep}>
                    <strong>Role:</strong> {loginHelper.role}
                  </div>
                  <div style={styles.flowStep}>
                    <strong>Email:</strong> {loginHelper.email || "—"}
                  </div>
                  <div style={styles.flowStep}>
                    <strong>Academy Code:</strong> {loginHelper.academyCode}
                  </div>

                  <div style={styles.loginBoxActions}>
                    <button
                      type="button"
                      onClick={copyLoginDetails}
                      style={styles.secondaryBtn}
                    >
                      Copy Login Details
                    </button>

                    <Link to="/login" style={styles.secondaryLinkBtn}>
                      Go to Login
                    </Link>
                  </div>
                </div>
              ) : null}

              {msg ? <div style={styles.success}>{msg}</div> : null}
              {err ? <div style={styles.error}>{err}</div> : null}

              <button
                type="submit"
                disabled={busy || activated}
                style={{
                  ...styles.submitBtn,
                  opacity: busy || activated ? 0.8 : 1,
                  cursor: busy || activated ? "not-allowed" : "pointer",
                }}
              >
                {activated
                  ? "Academy Activated"
                  : busy
                    ? "Activating..."
                    : "Activate Academy"}
              </button>

              <div style={styles.loginLine}>
                After activation, go to{" "}
                <Link to="/login" style={styles.loginLink}>
                  Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  disabled = false,
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        style={{
          ...styles.input,
          opacity: disabled ? 0.75 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder = "",
  required = false,
  show = false,
  onToggle,
  disabled = false,
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <div style={styles.passwordWrap}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          style={{
            ...styles.input,
            ...styles.passwordInput,
            opacity: disabled ? 0.75 : 1,
            cursor: disabled ? "not-allowed" : "text",
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          style={styles.eyeBtn}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />
      <path
        d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6 0 9.5 7 9.5 7a17.6 17.6 0 0 1-3.2 4.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 6.2A17 17 0 0 0 2.5 12s3.5 7 9.5 7c1.2 0 2.3-.2 3.3-.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9A3 3 0 0 0 14.1 14.1"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "20px",
    position: "relative",
    overflow: "hidden",
    background:
      "radial-gradient(circle at 20% 30%, rgba(225,29,46,0.10), transparent 40%), radial-gradient(circle at 80% 70%, rgba(225,29,46,0.08), transparent 45%), radial-gradient(circle at 60% 20%, rgba(11,31,42,0.06), transparent 40%), #f4f6f9",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  bgGlowA: {
    position: "absolute",
    width: 280,
    height: 280,
    left: -60,
    top: 40,
    borderRadius: 999,
    filter: "blur(60px)",
    background: "rgba(225, 29, 46, 0.14)",
    pointerEvents: "none",
  },
  bgGlowB: {
    position: "absolute",
    width: 320,
    height: 320,
    right: -70,
    bottom: 40,
    borderRadius: 999,
    filter: "blur(60px)",
    background: "rgba(17, 107, 156, 0.08)",
    pointerEvents: "none",
  },
  shell: {
    width: "min(1320px, 100%)",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(320px, 430px) minmax(0, 1fr)",
    gap: 22,
    position: "relative",
    zIndex: 1,
  },
  leftPanel: {
    background: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.45)",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
    borderRadius: 28,
    padding: 28,
    alignSelf: "start",
    position: "sticky",
    top: 20,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 900,
    color: "#e11d2e",
    background: "rgba(225,29,46,0.08)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "16px 0 10px",
    fontSize: "clamp(28px, 4vw, 42px)",
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#0f172a",
  },
  subtitle: {
    margin: 0,
    color: "rgba(15,23,42,0.68)",
    fontSize: 15,
    lineHeight: 1.75,
  },
  infoCard: {
    marginTop: 18,
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.5)",
    borderRadius: 20,
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  flowStep: {
    fontSize: 14,
    color: "rgba(15,23,42,0.75)",
    lineHeight: 1.8,
  },
  backLink: {
    display: "inline-block",
    marginTop: 20,
    color: "#e11d2e",
    textDecoration: "none",
    fontWeight: 800,
  },
  card: {
    background: "rgba(255,255,255,0.16)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.3)",
    boxShadow: "0 24px 55px rgba(0,0,0,0.10), 0 0 0 1px rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: 28,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  formHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    marginBottom: 4,
  },
  formKicker: {
    fontSize: 11,
    fontWeight: 900,
    color: "#e11d2e",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  formTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.1,
    color: "#0f172a",
    fontWeight: 900,
  },
  loadingBox: {
    padding: 40,
    textAlign: "center",
    fontWeight: 800,
    color: "#475569",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  label: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(15,23,42,0.78)",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.42)",
    background: "rgba(255,255,255,0.62)",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  },
  passwordWrap: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 60,
  },
  eyeBtn: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #e11d2e, #ff2a3b)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(225, 29, 46, 0.22)",
  },
  passwordStrengthWrap: {
    marginTop: 2,
    borderRadius: 18,
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.45)",
    padding: 14,
  },
  passwordStrengthTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    color: "#334155",
    fontWeight: 800,
  },
  passwordStrengthBar: {
    marginTop: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(15,23,42,0.08)",
    overflow: "hidden",
  },
  passwordStrengthFill: {
    height: "100%",
    borderRadius: 999,
    transition: "all .2s ease",
  },
  passwordHint: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(15,23,42,0.65)",
    lineHeight: 1.5,
  },
  loginBox: {
    marginTop: 4,
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.45)",
    borderRadius: 18,
    padding: 14,
  },
  loginBoxActions: {
    marginTop: 12,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  secondaryBtn: {
    minHeight: 44,
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 14,
    padding: "10px 14px",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
  },
  secondaryLinkBtn: {
    minHeight: 44,
    borderRadius: 14,
    padding: "10px 14px",
    background: "rgba(225,29,46,0.1)",
    color: "#e11d2e",
    fontWeight: 900,
    fontSize: 13,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  success: {
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(236, 253, 243, 0.96)",
    border: "1px solid rgba(34,197,94,0.18)",
    color: "#166534",
    fontSize: 13,
    fontWeight: 800,
  },
  error: {
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,245,245,0.96)",
    border: "1px solid rgba(255,215,215,0.95)",
    color: "#b42318",
    fontSize: 13,
    fontWeight: 800,
  },
  submitBtn: {
    width: "100%",
    minHeight: 52,
    border: "none",
    borderRadius: 16,
    background: "linear-gradient(90deg, #e11d2e, #ff2a3b)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 900,
    boxShadow: "0 12px 26px rgba(225, 29, 46, 0.22)",
    marginTop: 4,
  },
  loginLine: {
    textAlign: "center",
    color: "rgba(15,23,42,0.68)",
    fontSize: 14,
    marginTop: 6,
  },
  loginLink: {
    color: "#e11d2e",
    fontWeight: 800,
    textDecoration: "none",
  },
};
