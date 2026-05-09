import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = String(import.meta.env.VITE_API_BASE || "").replace(
  /\/+$/,
  "",
);

const REGISTER_URL = `${API_BASE}/public/academy-register`;

const entityOptions = [
  { value: "LLC", label: "Limited Liability Company (LLC)" },
  { value: "SOLE_PROPRIETORSHIP", label: "Sole Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "PRIVATE_COMPANY", label: "Private Company" },
  { value: "OTHER", label: "Other" },
];

const municipalityOptions = [
  "Doha",
  "Al Rayyan",
  "Al Wakrah",
  "Umm Salal",
  "Al Khor and Al Thakhira",
  "Al Daayen",
  "Madinat ash Shamal",
  "Al Shahaniya",
];

const initialForm = {
  academyNameEn: "",
  academyNameAr: "",
  legalEntityType: "LLC",
  commercialRegistrationNumber: "",
  tradeLicenseNumber: "",
  activityType: "",
  authorizedSignatoryName: "",
  authorizedSignatoryIdNumber: "",
  email: "",
  phone: "",
  municipality: "Doha",
  zone: "",
  streetAddress: "",
  competentAuthorityApprovalRequired: false,
  declarationAccepted: false,
};

export default function AcademyRegister() {
  const [form, setForm] = useState(initialForm);
  const [logo, setLogo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const logoPreview = useMemo(() => {
    if (!logo) return "";
    return URL.createObjectURL(logo);
  }, [logo]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setErr("");
    setMsg("");

    try {
      const fd = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        fd.append(key, typeof value === "boolean" ? String(value) : value);
      });

      if (logo) fd.append("logo", logo);

      const res = await fetch(REGISTER_URL, {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.message || "Failed to submit academy registration",
        );
      }

      setMsg(
        data?.message ||
          "Academy registration submitted successfully. Waiting for super admin approval.",
      );

      setForm(initialForm);
      setLogo(null);
    } catch (error) {
      setErr(error?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.bgGlowA} />
      <div style={styles.bgGlowB} />

      <div style={styles.shell}>
        <div style={styles.leftPanel}>
          <div style={styles.badge}>Academy Onboarding</div>

          <h1 style={styles.title}>Register Your Academy</h1>

          <p style={styles.subtitle}>
            Submit your academy’s basic legal and contact details. Once the
            super admin approves the registration, you can complete the full
            profile and activate the application.
          </p>

          <div style={styles.infoCard}>
            <div style={styles.infoTitle}>Basic Registration Includes</div>
            <ul style={styles.list}>
              <li>Academy legal and trade details</li>
              <li>Commercial Registration number</li>
              <li>Authorized signatory information</li>
              <li>Qatar contact and location details</li>
              <li>Academy logo upload</li>
            </ul>
          </div>

          <div style={styles.infoCard}>
            <div style={styles.infoTitle}>Activation Flow</div>
            <div style={styles.flowStep}>1. Submit academy registration</div>
            <div style={styles.flowStep}>
              2. Super admin review and approval
            </div>
            <div style={styles.flowStep}>3. Complete academy profile</div>
            <div style={styles.flowStep}>4. Start using the app</div>
          </div>

          <Link to="/login" style={styles.backLink}>
            ← Back to Login
          </Link>
        </div>

        <div style={styles.card}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formHeaderRow}>
              <div>
                <div style={styles.formKicker}>Public Registration</div>
                <h2 style={styles.formTitle}>Basic Academy Information</h2>
              </div>
            </div>

            <div style={styles.logoWrap}>
              <label style={styles.logoLabel}>
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Academy logo preview"
                    style={styles.logoImg}
                  />
                ) : (
                  <div style={styles.logoPlaceholder}>
                    <div style={styles.logoPlaceholderIcon}>+</div>
                    <div>Upload Academy Logo</div>
                    <div style={styles.logoHint}>PNG, JPG, WEBP, SVG</div>
                  </div>
                )}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg"
                  hidden
                  onChange={(e) => setLogo(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div style={styles.grid2}>
              <Field
                label="Academy Name (English)"
                value={form.academyNameEn}
                onChange={(v) => update("academyNameEn", v)}
                required
                placeholder="Enter academy name"
              />
              <Field
                label="Academy Name (Arabic)"
                value={form.academyNameAr}
                onChange={(v) => update("academyNameAr", v)}
                placeholder="اسم الأكاديمية"
              />
            </div>

            <div style={styles.grid2}>
              <SelectField
                label="Legal Entity Type"
                value={form.legalEntityType}
                onChange={(v) => update("legalEntityType", v)}
                options={entityOptions}
              />
              <Field
                label="Business Activity"
                value={form.activityType}
                onChange={(v) => update("activityType", v)}
                required
                placeholder="Gymnastics / Sports Training / Kids Activities"
              />
            </div>

            <div style={styles.grid2}>
              <Field
                label="Commercial Registration Number"
                value={form.commercialRegistrationNumber}
                onChange={(v) => update("commercialRegistrationNumber", v)}
                required
                placeholder="CR number"
              />
              <Field
                label="Trade License Number"
                value={form.tradeLicenseNumber}
                onChange={(v) => update("tradeLicenseNumber", v)}
                placeholder="Trade license number"
              />
            </div>

            <div style={styles.grid2}>
              <Field
                label="Authorized Signatory Name"
                value={form.authorizedSignatoryName}
                onChange={(v) => update("authorizedSignatoryName", v)}
                required
                placeholder="Full name"
              />
              <Field
                label="Authorized Signatory ID / QID / Passport"
                value={form.authorizedSignatoryIdNumber}
                onChange={(v) => update("authorizedSignatoryIdNumber", v)}
                required
                placeholder="Identification number"
              />
            </div>

            <div style={styles.grid2}>
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => update("email", v)}
                required
                placeholder="academy@email.com"
              />
              <Field
                label="Qatar Mobile"
                value={form.phone}
                onChange={(v) => update("phone", v)}
                required
                placeholder="+974XXXXXXXX"
              />
            </div>

            <div style={styles.grid2}>
              <SelectField
                label="Municipality"
                value={form.municipality}
                onChange={(v) => update("municipality", v)}
                options={municipalityOptions.map((x) => ({
                  value: x,
                  label: x,
                }))}
              />
              <Field
                label="Zone"
                value={form.zone}
                onChange={(v) => update("zone", v)}
                placeholder="Zone"
              />
            </div>

            <div style={styles.grid1}>
              <TextAreaField
                label="Street Address"
                value={form.streetAddress}
                onChange={(v) => update("streetAddress", v)}
                required
                placeholder="Building, street, area, landmark"
              />
            </div>

            <label style={styles.checkCard}>
              <input
                type="checkbox"
                checked={form.competentAuthorityApprovalRequired}
                onChange={(e) =>
                  update("competentAuthorityApprovalRequired", e.target.checked)
                }
              />
              <span>
                This activity may require approval from a competent authority.
              </span>
            </label>

            <label style={styles.checkCard}>
              <input
                type="checkbox"
                checked={form.declarationAccepted}
                onChange={(e) =>
                  update("declarationAccepted", e.target.checked)
                }
              />
              <span>
                I confirm that the submitted information is accurate and that
                the academy will complete all required compliance and
                operational details before activation.
              </span>
            </label>

            {msg ? <div style={styles.success}>{msg}</div> : null}
            {err ? <div style={styles.error}>{err}</div> : null}

            <button type="submit" disabled={busy} style={styles.submitBtn}>
              {busy ? "Submitting..." : "Submit Registration"}
            </button>

            <div style={styles.loginLine}>
              Already registered?{" "}
              <Link to="/login" style={styles.loginLink}>
                Go to Login
              </Link>
            </div>
          </form>
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
        style={styles.input}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder = "",
  required = false,
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{ ...styles.input, resize: "vertical", minHeight: 110 }}
      />
    </label>
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
  list: {
    margin: 0,
    paddingLeft: 18,
    color: "rgba(15,23,42,0.72)",
    lineHeight: 1.8,
    fontSize: 14,
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
  logoWrap: {
    display: "flex",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 10,
  },
  logoLabel: {
    width: 150,
    height: 150,
    borderRadius: 24,
    cursor: "pointer",
    overflow: "hidden",
    border: "1px dashed rgba(225,29,46,0.35)",
    background: "rgba(255,255,255,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
  },
  logoPlaceholder: {
    textAlign: "center",
    color: "#0f172a",
    padding: 16,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  logoPlaceholderIcon: {
    width: 42,
    height: 42,
    margin: "0 auto 10px",
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 700,
    color: "#fff",
    background: "linear-gradient(135deg, #e11d2e, #ff2a3b)",
  },
  logoHint: {
    marginTop: 6,
    fontSize: 11,
    opacity: 0.65,
    fontWeight: 700,
  },
  logoImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    background: "#fff",
  },
  grid1: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 14,
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
  checkCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.45)",
    border: "1px solid rgba(255,255,255,0.42)",
    color: "rgba(15,23,42,0.75)",
    fontSize: 14,
    lineHeight: 1.55,
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
    cursor: "pointer",
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
