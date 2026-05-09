// client/src/pages/SuperAdmin/EmailSettings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, AUTH_EVENT } from "../../lib/api.js";
import {
  getUser,
  getSelectedAcademy,
  setSelectedAcademy,
} from "../../lib/auth.js";

const RED = "#e11d2e";
const NAVY = "#0f172a";

const cardStyle = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 24,
  boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
  padding: 20,
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  color: NAVY,
  marginBottom: 8,
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,0.12)",
  outline: "none",
  fontSize: 14,
  background: "#fff",
  boxSizing: "border-box",
};

const buttonStyle = {
  border: "none",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
};

const PROVIDER_PRESETS = {
  smtp: {
    provider: "smtp",
    host: "",
    port: 587,
    secure: false,
    hint: "Use your own SMTP server settings.",
  },
  gmail: {
    provider: "smtp",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    hint: "Use Gmail address and Google App Password.",
  },
  outlook: {
    provider: "smtp",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    hint: "Use Microsoft 365 / Outlook SMTP credentials.",
  },
};

const emptySettings = {
  provider: "smtp",
  preset: "smtp",
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
  hasPassword: false,
  fromName: "Rebel Angels Gymnastics Academy",
  fromEmail: "",
  replyTo: "",
  isEnabled: true,
};

function detectPreset(data = {}) {
  const host = String(data.host || "")
    .trim()
    .toLowerCase();

  if (host === "smtp.gmail.com") return "gmail";
  if (host === "smtp.office365.com" || host === "smtp-mail.outlook.com") {
    return "outlook";
  }

  return "smtp";
}

function normalizeId(value) {
  return String(value || "").trim();
}

function getScopedAcademyId() {
  try {
    const selected = getSelectedAcademy?.();
    if (selected && typeof selected === "object") {
      return normalizeId(selected?._id || selected?.id || selected?.academyId);
    }
    return normalizeId(selected);
  } catch {
    return "";
  }
}

function getFriendlyError(error) {
  if (!error) return "Something went wrong.";

  const raw =
    error?.message ||
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.data?.message ||
    "";

  const message = String(raw || "").trim();
  if (!message) return "Something went wrong.";

  if (typeof api?.isOfflineError === "function" && api.isOfflineError(error)) {
    return "You are offline or the server is unreachable. Check internet and API connection.";
  }

  if (typeof api?.isAbortError === "function" && api.isAbortError(error)) {
    return "Request timed out. Please try again.";
  }

  if (message.toLowerCase().includes("request timeout")) {
    return "Request timed out. Please try again.";
  }

  if (message.toLowerCase().includes("valid academyid is required")) {
    return "Please select an academy first.";
  }

  return message;
}

function academyOptionId(academy) {
  return normalizeId(academy?._id || academy?.id || academy?.academyId);
}

function academyOptionName(academy) {
  return String(
    academy?.name ||
      academy?.academyName ||
      academy?.title ||
      "Unnamed Academy",
  ).trim();
}

async function loadAcademiesFromApi() {
  const candidates = [
    () => api.getAcademies?.(),
    () => api.adminAcademies?.(),
    () => api.superAdminAcademies?.(),
    () => api.get?.("/admin/academies"),
    () => api.get?.("/superadmin/academies"),
  ];

  for (const run of candidates) {
    try {
      if (typeof run !== "function") continue;

      const res = await run();
      const rows = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.academies)
            ? res.academies
            : Array.isArray(res?.data)
              ? res.data
              : Array.isArray(res?.data?.items)
                ? res.data.items
                : Array.isArray(res?.data?.academies)
                  ? res.data.academies
                  : [];

      if (rows.length) return rows;
    } catch {
      // try next candidate
    }
  }

  return [];
}

function getUserAcademyFallbacks(user) {
  const out = [];

  const pushOne = (value) => {
    const id = normalizeId(
      value?._id || value?.id || value?.academyId || value?.value || value,
    );
    if (id && !out.includes(id)) out.push(id);
  };

  pushOne(user?.academyId);
  pushOne(user?.academy);
  pushOne(user?.selectedAcademy);
  pushOne(getScopedAcademyId());

  return out;
}

export default function EmailSettings({ onLogout }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [form, setForm] = useState(emptySettings);
  const [testEmail, setTestEmail] = useState("");
  const [verifyInfo, setVerifyInfo] = useState(null);

  const [academies, setAcademies] = useState([]);
  const [selectedAcademyId, setSelectedAcademyIdState] =
    useState(getScopedAcademyId());

  const pageTitle = useMemo(() => "Email Settings", []);
  const currentPreset = useMemo(
    () => PROVIDER_PRESETS[form.preset] || PROVIDER_PRESETS.smtp,
    [form.preset],
  );

  const currentUser = useMemo(() => getUser?.() || null, []);
  const isSuperAdmin =
    String(currentUser?.role || "")
      .trim()
      .toUpperCase() === "SUPER_ADMIN";

  useEffect(() => {
    function handleAuthRequired() {
      onLogout?.();
    }

    window.addEventListener(AUTH_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_EVENT, handleAuthRequired);
  }, [onLogout]);

  async function fetchAcademies() {
    try {
      const rows = await loadAcademiesFromApi();
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      console.error("Failed to load academies:", error);
      return [];
    }
  }

  async function loadSettingsForAcademy(academyId) {
    if (!academyId) {
      setForm(emptySettings);
      setVerifyInfo(null);
      return;
    }

    const res = await api.getEmailSettings?.({
      headers: { "x-academy-id": academyId },
    });

    const data = res?.settings || res || {};
    const preset = detectPreset(data);

    setForm({
      provider: String(data.provider || "smtp")
        .trim()
        .toLowerCase(),
      preset,
      host: data.host || "",
      port: Number(data.port || 587),
      secure: !!data.secure,
      username: data.username || "",
      password: "",
      hasPassword: !!data.hasPassword,
      fromName: data.fromName || "Rebel Angels Gymnastics Academy",
      fromEmail: data.fromEmail || "",
      replyTo: data.replyTo || "",
      isEnabled: typeof data.isEnabled === "boolean" ? data.isEnabled : true,
    });
  }

  function setSelectedAcademyId(nextId) {
    const safeId = normalizeId(nextId);
    setSelectedAcademyIdState(safeId);

    if (safeId) {
      try {
        setSelectedAcademy?.(safeId);
      } catch {
        // ignore
      }
    }
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        setLoading(true);
        setErr("");
        setMsg("");
        setVerifyInfo(null);

        let academyList = [];
        if (isSuperAdmin) {
          academyList = await fetchAcademies();
        } else {
          const localAcademyId =
            academyOptionId(currentUser?.academyId) ||
            academyOptionId(currentUser?.academy) ||
            getScopedAcademyId();

          if (localAcademyId) {
            academyList = [
              {
                _id: localAcademyId,
                name:
                  currentUser?.academyId?.name ||
                  currentUser?.academy?.name ||
                  "My Academy",
              },
            ];
          }
        }

        if (!active) return;

        setAcademies(academyList);

        let academyId = getScopedAcademyId();

        if (isSuperAdmin) {
          if (!academyId) {
            const remembered = getUserAcademyFallbacks(currentUser);
            for (const rememberedId of remembered) {
              if (
                academyList.some(
                  (academy) => academyOptionId(academy) === rememberedId,
                )
              ) {
                academyId = rememberedId;
                break;
              }
            }
          }

          if (!academyId && academyList.length > 0) {
            academyId = academyOptionId(academyList[0]);
          }

          if (academyId) {
            try {
              setSelectedAcademy?.(academyId);
            } catch {
              // ignore
            }
          }
        } else {
          academyId =
            academyId ||
            academyOptionId(currentUser?.academyId) ||
            academyOptionId(currentUser?.academy);
        }

        if (!active) return;

        setSelectedAcademyIdState(academyId);

        if (!academyId) {
          setForm(emptySettings);
          setErr(
            isSuperAdmin
              ? "No academy is selected. Please select an academy first."
              : "Valid academyId is required.",
          );
          return;
        }

        await loadSettingsForAcademy(academyId);
      } catch (e) {
        console.error(e);
        if (!active) return;
        setForm(emptySettings);
        setErr(getFriendlyError(e) || "Failed to load email settings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    boot();

    return () => {
      active = false;
    };
  }, [isSuperAdmin, currentUser]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyProviderPreset(presetKey) {
    const preset = PROVIDER_PRESETS[presetKey] || PROVIDER_PRESETS.smtp;

    setForm((prev) => ({
      ...prev,
      preset: presetKey,
      provider: preset.provider,
      host: preset.host,
      port: preset.port,
      secure: preset.secure,
    }));
  }

  async function handleAcademyChange(nextId) {
    const academyId = normalizeId(nextId);

    setSelectedAcademyId(academyId);
    setErr("");
    setMsg("");
    setVerifyInfo(null);

    if (!academyId) {
      setForm(emptySettings);
      setErr("Please select an academy first.");
      return;
    }

    try {
      setLoading(true);
      await loadSettingsForAcademy(academyId);
    } catch (error) {
      console.error(error);
      setForm(emptySettings);
      setErr(
        getFriendlyError(error) || "Failed to load academy email settings.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onSave(e) {
    e.preventDefault();

    const academyId = selectedAcademyId || getScopedAcademyId();

    if (!academyId) {
      setErr("Please select an academy first.");
      setMsg("");
      return;
    }

    try {
      setSaving(true);
      setErr("");
      setMsg("");
      setVerifyInfo(null);

      const payload = {
        provider: "smtp",
        host: String(form.host || "").trim(),
        port: Number(form.port || 0),
        secure: !!form.secure,
        username: String(form.username || "").trim(),
        password: String(form.password || "").trim(),
        fromName: String(form.fromName || "").trim(),
        fromEmail: String(form.fromEmail || "").trim(),
        replyTo: String(form.replyTo || "").trim(),
        isEnabled: !!form.isEnabled,
      };

      const res = await api.updateEmailSettings?.(payload, {
        headers: { "x-academy-id": academyId },
      });

      const data = res?.settings || res || {};

      setMsg("Email settings saved successfully.");
      setForm((prev) => {
        const nextHost = data.host || payload.host || "";
        const nextPreset = detectPreset({ host: nextHost });

        return {
          ...prev,
          provider: String(data.provider || payload.provider || "smtp")
            .trim()
            .toLowerCase(),
          preset: nextPreset,
          host: nextHost,
          port: Number(data.port || payload.port || 587),
          secure:
            typeof data.secure === "boolean" ? data.secure : !!payload.secure,
          username: data.username || payload.username || "",
          password: "",
          hasPassword:
            typeof data.hasPassword === "boolean"
              ? data.hasPassword
              : !!String(payload.password || "").trim() || prev.hasPassword,
          fromName:
            data.fromName ||
            payload.fromName ||
            "Rebel Angels Gymnastics Academy",
          fromEmail: data.fromEmail || payload.fromEmail || "",
          replyTo: data.replyTo || payload.replyTo || "",
          isEnabled:
            typeof data.isEnabled === "boolean"
              ? data.isEnabled
              : !!payload.isEnabled,
        };
      });
    } catch (e) {
      console.error(e);
      setErr(getFriendlyError(e) || "Failed to save email settings.");
    } finally {
      setSaving(false);
    }
  }

  async function onVerify() {
    const academyId = selectedAcademyId || getScopedAcademyId();

    if (!academyId) {
      setErr("Please select an academy first.");
      setMsg("");
      return;
    }

    try {
      setVerifying(true);
      setErr("");
      setMsg("");
      setVerifyInfo(null);

      const res = await api.verifyEmailSettings?.({
        headers: { "x-academy-id": academyId },
      });

      const result = res?.details || res?.result || res || null;
      setVerifyInfo(result);

      if (res?.ok || result?.ok) {
        setMsg(
          res?.message || result?.message || "SMTP verified successfully.",
        );
      } else {
        setErr(res?.message || result?.message || "SMTP verification failed.");
      }
    } catch (e) {
      console.error(e);
      setVerifyInfo(null);
      setErr(getFriendlyError(e) || "Failed to verify SMTP connection.");
    } finally {
      setVerifying(false);
    }
  }

  async function onTestEmail() {
    const academyId = selectedAcademyId || getScopedAcademyId();

    if (!academyId) {
      setErr("Please select an academy first.");
      setMsg("");
      return;
    }

    try {
      setTesting(true);
      setErr("");
      setMsg("");

      if (!String(testEmail || "").trim()) {
        setErr("Please enter a test email address.");
        return;
      }

      const res = await api.testEmailSettings?.(
        {
          to: String(testEmail).trim(),
        },
        {
          headers: { "x-academy-id": academyId },
        },
      );

      setMsg(res?.message || `Test email sent successfully to ${testEmail}.`);
    } catch (e) {
      console.error(e);
      setErr(getFriendlyError(e) || "Failed to send test email.");
    } finally {
      setTesting(false);
    }
  }

  const showAcademySelector = isSuperAdmin;
  const academyMissing = !selectedAcademyId;

  return (
    <div
      style={{
        minHeight: "100%",
        padding: 20,
        background:
          "linear-gradient(180deg, #fff 0%, #fff7f7 45%, #f8fafc 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            ...cardStyle,
            padding: 24,
            background:
              "linear-gradient(135deg, rgba(225,29,46,0.95), rgba(127,29,29,0.95))",
            color: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{pageTitle}</div>
              <div style={{ marginTop: 8, opacity: 0.92, maxWidth: 700 }}>
                Configure SMTP, sender details, verify connection, and send test
                email for notifications, results, receipts, reminders, and
                invite flows.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => navigate("/super-admin")}
                style={{
                  ...buttonStyle,
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.22)",
                }}
              >
                Back to Dashboard
              </button>

              {typeof onLogout === "function" ? (
                <button
                  type="button"
                  onClick={() => onLogout?.()}
                  style={{
                    ...buttonStyle,
                    background: "#fff",
                    color: NAVY,
                  }}
                >
                  Logout
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {showAcademySelector ? (
          <div
            style={{
              ...cardStyle,
              border: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: NAVY,
                marginBottom: 18,
              }}
            >
              Academy Selection
            </div>

            <div style={{ maxWidth: 420 }}>
              <label style={labelStyle}>Select Academy</label>
              <select
                value={selectedAcademyId || ""}
                onChange={(e) => handleAcademyChange(e.target.value)}
                style={inputStyle}
              >
                <option value="">
                  {academies.length ? "Select academy" : "No academies found"}
                </option>

                {academies.map((academy, index) => {
                  const id = academyOptionId(academy) || `academy-${index}`;
                  const name = academyOptionName(academy);
                  return (
                    <option key={id} value={academyOptionId(academy)}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            {academyMissing && !loading ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,247,237,0.96)",
                  border: "1px solid rgba(245,158,11,0.22)",
                  color: "#92400e",
                  fontWeight: 700,
                }}
              >
                No academy is selected. Please select an academy first.
              </div>
            ) : null}
          </div>
        ) : null}

        {err ? (
          <div
            style={{
              ...cardStyle,
              border: "1px solid rgba(225,29,46,0.18)",
              background: "rgba(254,242,242,0.96)",
              color: "#991b1b",
              fontWeight: 700,
            }}
          >
            {err}
          </div>
        ) : null}

        {msg ? (
          <div
            style={{
              ...cardStyle,
              border: "1px solid rgba(34,197,94,0.18)",
              background: "rgba(240,253,244,0.96)",
              color: "#166534",
              fontWeight: 700,
            }}
          >
            {msg}
          </div>
        ) : null}

        {loading ? (
          <div style={cardStyle}>Loading email settings...</div>
        ) : (
          <>
            <form onSubmit={onSave} style={cardStyle}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: NAVY,
                  marginBottom: 18,
                }}
              >
                SMTP Configuration
              </div>

              <div
                style={{
                  marginBottom: 16,
                  padding: 14,
                  borderRadius: 16,
                  background: "rgba(248,250,252,0.88)",
                  border: "1px solid rgba(15,23,42,0.08)",
                }}
              >
                <label style={labelStyle}>Quick Provider Preset</label>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    ["smtp", "Custom SMTP"],
                    ["gmail", "Gmail"],
                    ["outlook", "Outlook / Microsoft 365"],
                  ].map(([key, label]) => {
                    const active = form.preset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => applyProviderPreset(key)}
                        style={{
                          ...buttonStyle,
                          background: active ? RED : "rgba(15,23,42,0.06)",
                          color: active ? "#fff" : NAVY,
                          padding: "10px 14px",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: "rgba(15,23,42,0.65)",
                    fontWeight: 700,
                  }}
                >
                  {currentPreset?.hint}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 16,
                }}
              >
                <div>
                  <label style={labelStyle}>Provider</label>
                  <select
                    value={form.provider}
                    onChange={(e) => updateField("provider", e.target.value)}
                    style={inputStyle}
                    disabled
                  >
                    <option value="smtp">SMTP</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>SMTP Host</label>
                  <input
                    value={form.host}
                    onChange={(e) => updateField("host", e.target.value)}
                    placeholder="smtp.gmail.com"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Port</label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={(e) => updateField("port", e.target.value)}
                    placeholder="587"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Encryption</label>
                  <select
                    value={form.secure ? "ssl" : "tls"}
                    onChange={(e) =>
                      updateField("secure", e.target.value === "ssl")
                    }
                    style={inputStyle}
                  >
                    <option value="tls">TLS / STARTTLS</option>
                    <option value="ssl">SSL</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>SMTP Username</label>
                  <input
                    value={form.username}
                    onChange={(e) => updateField("username", e.target.value)}
                    placeholder="your@email.com"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>SMTP Password / App Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder={
                      form.hasPassword
                        ? "Leave blank to keep existing password"
                        : "••••••••••"
                    }
                    style={inputStyle}
                  />
                  {form.hasPassword ? (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: "rgba(15,23,42,0.65)",
                        fontWeight: 700,
                      }}
                    >
                      Password already saved. Leave blank to keep current value.
                    </div>
                  ) : null}
                </div>

                <div>
                  <label style={labelStyle}>Sender Name</label>
                  <input
                    value={form.fromName}
                    onChange={(e) => updateField("fromName", e.target.value)}
                    placeholder="Rebel Angels Gymnastics Academy"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Sender Email</label>
                  <input
                    type="email"
                    value={form.fromEmail}
                    onChange={(e) => updateField("fromEmail", e.target.value)}
                    placeholder="noreply@yourdomain.com"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Reply-To Email</label>
                  <input
                    type="email"
                    value={form.replyTo}
                    onChange={(e) => updateField("replyTo", e.target.value)}
                    placeholder="support@yourdomain.com"
                    style={inputStyle}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "end",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontWeight: 800,
                      color: NAVY,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!form.isEnabled}
                      onChange={(e) =>
                        updateField("isEnabled", e.target.checked)
                      }
                    />
                    Enable outgoing email
                  </label>
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="submit"
                  disabled={saving || academyMissing}
                  style={{
                    ...buttonStyle,
                    background: RED,
                    color: "#fff",
                    opacity: saving || academyMissing ? 0.65 : 1,
                    cursor:
                      saving || academyMissing ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>

                <button
                  type="button"
                  onClick={onVerify}
                  disabled={verifying || academyMissing}
                  style={{
                    ...buttonStyle,
                    background: NAVY,
                    color: "#fff",
                    opacity: verifying || academyMissing ? 0.65 : 1,
                    cursor:
                      verifying || academyMissing ? "not-allowed" : "pointer",
                  }}
                >
                  {verifying ? "Verifying..." : "Verify SMTP"}
                </button>
              </div>
            </form>

            {verifyInfo ? (
              <div style={cardStyle}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: NAVY,
                    marginBottom: 18,
                  }}
                >
                  Verification Result
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <InfoBox
                    label="Status"
                    value={verifyInfo.ok ? "OK" : "Failed"}
                  />
                  <InfoBox
                    label="Provider"
                    value={verifyInfo.provider || form.provider || "smtp"}
                  />
                  <InfoBox label="Message" value={verifyInfo.message || "—"} />
                  <InfoBox
                    label="Host"
                    value={verifyInfo.host || form.host || "—"}
                  />
                  <InfoBox
                    label="Port"
                    value={String(verifyInfo.port || form.port || "—")}
                  />
                  <InfoBox
                    label="Secure"
                    value={
                      typeof verifyInfo.secure === "boolean"
                        ? verifyInfo.secure
                          ? "Yes"
                          : "No"
                        : form.secure
                          ? "Yes"
                          : "No"
                    }
                  />
                  <InfoBox
                    label="From Email"
                    value={verifyInfo.fromEmail || form.fromEmail || "—"}
                  />
                  <InfoBox
                    label="Reply-To"
                    value={verifyInfo.replyTo || form.replyTo || "—"}
                  />
                </div>
              </div>
            ) : null}

            <div style={cardStyle}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: NAVY,
                  marginBottom: 18,
                }}
              >
                Send Test Email
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(260px, 1fr) auto",
                  gap: 12,
                }}
                className="ra-email-test-grid"
              >
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter recipient email"
                  style={inputStyle}
                />

                <button
                  type="button"
                  onClick={onTestEmail}
                  disabled={testing || academyMissing}
                  style={{
                    ...buttonStyle,
                    background: NAVY,
                    color: "#fff",
                    minWidth: 160,
                    opacity: testing || academyMissing ? 0.65 : 1,
                    cursor:
                      testing || academyMissing ? "not-allowed" : "pointer",
                  }}
                >
                  {testing ? "Sending..." : "Send Test Email"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .ra-email-test-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,0.08)",
        background: "rgba(248,250,252,0.85)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "rgba(15,23,42,0.55)",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: ".04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: NAVY,
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}
