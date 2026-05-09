// client/src/pages/Admin/BulkEmail.jsx

import React, { useEffect, useMemo, useState } from "react";
import { api, AUTH_EVENT } from "../../lib/api.js";

const RED = "#e11d2e";
const NAVY = "#0f172a";
const BORDER = "rgba(15,23,42,0.08)";

const cardStyle = {
  background: "rgba(255,255,255,0.96)",
  border: `1px solid ${BORDER}`,
  borderRadius: 24,
  boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
  padding: 20,
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${BORDER}`,
  outline: "none",
  fontSize: 14,
  background: "#fff",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 800,
  color: NAVY,
  marginBottom: 8,
};

const buttonStyle = {
  border: "none",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
};

function safeJson(v) {
  try {
    return JSON.stringify(v || {}, null, 2);
  } catch {
    return "{}";
  }
}

function parseJson(value) {
  const raw = String(value || "").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Template data must be valid JSON");
  }
}

function normalizeEmails(value) {
  return String(value || "")
    .split(",")
    .map((v) =>
      String(v || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
}

function uniqueEmails(list = []) {
  return [
    ...new Set(
      (list || [])
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  ];
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.items)) return v.items;
  if (Array.isArray(v?.rows)) return v.rows;
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray(v?.results)) return v.results;
  if (Array.isArray(v?.templates)) return v.templates;
  return [];
}

function normalizeMsg(err, fallback = "Something went wrong") {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.data?.message ||
    err?.message ||
    (typeof err === "string" ? err : "") ||
    fallback
  );
}

function getResponseData(res) {
  return res?.data !== undefined ? res.data : res;
}

async function callGetEmailTemplates(params = {}) {
  if (typeof api.getEmailTemplates === "function") {
    return api.getEmailTemplates(params);
  }

  const res = await api.get("/admin/email/templates", {
    params,
  });

  return getResponseData(res);
}

async function callPreviewEmail(payload) {
  if (typeof api.previewEmail === "function") {
    return api.previewEmail(payload);
  }

  const res = await api.post("/admin/email/preview", payload);
  return getResponseData(res);
}

async function callSendSingleEmail(payload) {
  if (typeof api.sendEmail === "function") {
    return api.sendEmail(payload);
  }

  const res = await api.post("/admin/email/test", payload);
  return getResponseData(res);
}

async function callSendBulkEmail(payload) {
  if (typeof api.sendBulkEmail === "function") {
    return api.sendBulkEmail(payload);
  }

  const res = await api.post("/admin/email/bulk", payload);
  return getResponseData(res);
}

const initialForm = {
  mode: "manual",
  emails: "",
  role: "PARENT",
  eventId: "",
  subject: "Important Update from Rebel Angels",
  html: `<div style="font-family:Arial,sans-serif;padding:24px;">
  <h2 style="margin:0 0 12px;">Hello from Rebel Angels</h2>
  <p style="margin:0 0 10px;">This is a bulk email message.</p>
</div>`,
  text: "Hello from Rebel Angels. This is a bulk email message.",
  template: "",
  dataJson: safeJson({}),
  cc: "",
  bcc: "",
  chunkSize: 50,
};

export default function BulkEmail({ onLogout }) {
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [form, setForm] = useState(initialForm);
  const [preview, setPreview] = useState(null);
  const [templates, setTemplates] = useState([]);

  const pageTitle = useMemo(() => "Bulk Email", []);

  useEffect(() => {
    function handleAuthRequired() {
      onLogout?.();
    }

    window.addEventListener(AUTH_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_EVENT, handleAuthRequired);
  }, [onLogout]);

  useEffect(() => {
    let active = true;

    async function loadTemplates() {
      try {
        setLoadingTemplates(true);

        const res = await callGetEmailTemplates({ isActive: true });

        if (!active) return;

        setTemplates(toArray(res));
      } catch {
        if (!active) return;
        setTemplates([]);
      } finally {
        if (active) setLoadingTemplates(false);
      }
    }

    loadTemplates();

    return () => {
      active = false;
    };
  }, []);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetComposer() {
    setForm(initialForm);
    setPreview(null);
    setErr("");
    setMsg("");
  }

  function buildPayload() {
    const emails = uniqueEmails(normalizeEmails(form.emails));
    const cc = uniqueEmails(normalizeEmails(form.cc));
    const bcc = uniqueEmails(normalizeEmails(form.bcc));

    const subject = String(form.subject || "").trim();
    const html = String(form.html || "").trim();
    const text = String(form.text || "").trim();
    const template = String(form.template || "")
      .trim()
      .toLowerCase();

    return {
      mode: String(form.mode || "manual").trim(),
      emails,
      role: String(form.role || "")
        .trim()
        .toUpperCase(),
      eventId: String(form.eventId || "").trim(),
      subject,
      html,
      text,
      template,
      data: parseJson(form.dataJson),
      cc,
      bcc,
      chunkSize: Math.min(200, Math.max(1, Number(form.chunkSize || 50))),
    };
  }

  function validate(payload) {
    if (!payload.template && !payload.subject) {
      throw new Error("Subject is required");
    }

    if (!payload.template && !payload.html && !payload.text) {
      throw new Error(
        "Email body is required. Add HTML body, plain text, or select a template.",
      );
    }

    if (payload.mode === "manual" && !payload.emails.length) {
      throw new Error("Enter at least one recipient email");
    }

    if (payload.mode === "role" && !payload.role) {
      throw new Error("Recipient role is required");
    }

    if (payload.mode === "event" && !payload.eventId) {
      throw new Error("Event ID is required");
    }
  }

  function applyTemplateByKey(key) {
    const cleanKey = String(key || "")
      .trim()
      .toLowerCase();

    const selected = templates.find(
      (t) =>
        String(t?.key || "")
          .trim()
          .toLowerCase() === cleanKey,
    );

    setForm((prev) => ({
      ...prev,
      template: cleanKey,
      subject: selected?.subject
        ? String(selected.subject).trim()
        : prev.subject,
      html:
        selected?.html !== undefined ? String(selected.html || "") : prev.html,
      text:
        selected?.text !== undefined ? String(selected.text || "") : prev.text,
      dataJson:
        Array.isArray(selected?.variables) && selected.variables.length
          ? safeJson(
              selected.variables.reduce((acc, v) => {
                acc[String(v)] = "";
                return acc;
              }, {}),
            )
          : prev.dataJson,
    }));
  }

  async function onSend() {
    try {
      setSending(true);
      setErr("");
      setMsg("");

      const payload = buildPayload();
      validate(payload);

      let res;

      if (payload.mode === "manual" && payload.emails.length === 1) {
        res = await callSendSingleEmail({
          to: payload.emails[0],
          cc: payload.cc,
          bcc: payload.bcc,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          message: payload.text || payload.html,
          template: payload.template,
          data: payload.data,
        });
      } else {
        res = await callSendBulkEmail(payload);
      }

      const summary = res?.summary || res?.data?.summary;

      if (summary) {
        setMsg(
          `Bulk email processed. Recipients: ${summary.totalRecipients || 0}, Batches: ${summary.totalBatches || 0}, Sent: ${summary.sentBatches || 0}, Skipped: ${summary.skippedBatches || 0}, Failed: ${summary.failedBatches || 0}.`,
        );
      } else {
        setMsg(
          res?.message || res?.data?.message || "Email sent successfully.",
        );
      }
    } catch (e) {
      setErr(normalizeMsg(e, "Failed to send email"));
    } finally {
      setSending(false);
    }
  }

  async function onPreview() {
    try {
      setPreviewing(true);
      setErr("");
      setMsg("");

      const payload = buildPayload();

      if (!payload.template && !payload.subject) {
        throw new Error("Subject is required for preview");
      }

      if (!payload.template && !payload.html && !payload.text) {
        throw new Error("Email body is required for preview");
      }

      const res = await callPreviewEmail({
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        template: payload.template,
        data: payload.data,
      });

      setPreview(res?.preview || res?.data?.preview || res || null);
    } catch (e) {
      setErr(normalizeMsg(e, "Failed to preview email"));
    } finally {
      setPreviewing(false);
    }
  }

  const showManualRecipients = form.mode === "manual";
  const showRole = form.mode === "role";
  const showEvent = form.mode === "event";

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
          maxWidth: 1200,
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
          <div style={{ fontSize: 28, fontWeight: 900 }}>{pageTitle}</div>
          <div style={{ marginTop: 8, opacity: 0.92, maxWidth: 780 }}>
            Send manual or bulk email to parents, participants, roles, or event
            recipients. Supports CC, BCC, HTML, plain text, saved templates, and
            preview.
          </div>
        </div>

        {err ? (
          <div
            style={{
              ...cardStyle,
              border: "1px solid rgba(239,68,68,0.18)",
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

        <div
          className="bulk-email-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 0.95fr",
            gap: 18,
          }}
        >
          <div style={cardStyle}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: NAVY,
                marginBottom: 18,
              }}
            >
              Email Composer
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                <div>
                  <label style={labelStyle}>Recipient Mode</label>
                  <select
                    value={form.mode}
                    onChange={(e) => updateField("mode", e.target.value)}
                    style={inputStyle}
                  >
                    <option value="manual">Manual Emails</option>
                    <option value="role">By Role</option>
                    <option value="event">By Event</option>
                    <option value="all-parents">All Parents</option>
                    <option value="all-participants">All Participants</option>
                  </select>
                </div>

                {showRole ? (
                  <div>
                    <label style={labelStyle}>Recipient Role</label>
                    <select
                      value={form.role}
                      onChange={(e) => updateField("role", e.target.value)}
                      style={inputStyle}
                    >
                      <option value="PARENT">Parent</option>
                      <option value="PARTICIPANT">Participant</option>
                      <option value="JUDGE">Judge</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                ) : showEvent ? (
                  <div>
                    <label style={labelStyle}>Event ID</label>
                    <input
                      value={form.eventId}
                      onChange={(e) => updateField("eventId", e.target.value)}
                      placeholder="Enter event ID"
                      style={inputStyle}
                    />
                  </div>
                ) : (
                  <div>
                    <label style={labelStyle}>Chunk Size</label>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={form.chunkSize}
                      onChange={(e) => updateField("chunkSize", e.target.value)}
                      placeholder="50"
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>

              {showManualRecipients ? (
                <div>
                  <label style={labelStyle}>
                    Recipient Emails {form.mode === "manual" ? "*" : ""}{" "}
                    <span style={{ color: "#64748b" }}>comma separated</span>
                  </label>
                  <textarea
                    rows={4}
                    value={form.emails}
                    onChange={(e) => updateField("emails", e.target.value)}
                    placeholder="parent1@example.com, parent2@example.com"
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>
              ) : null}

              <div>
                <label style={labelStyle}>Saved Template Optional</label>
                <select
                  value={form.template}
                  onChange={(e) => applyTemplateByKey(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">
                    {loadingTemplates
                      ? "Loading templates..."
                      : "Select template"}
                  </option>

                  {templates.map((tpl) => (
                    <option
                      key={tpl?._id || tpl?.id || tpl?.key}
                      value={String(tpl?.key || "")
                        .trim()
                        .toLowerCase()}
                    >
                      {tpl?.name || tpl?.key || "Template"}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                <div>
                  <label style={labelStyle}>CC</label>
                  <input
                    value={form.cc}
                    onChange={(e) => updateField("cc", e.target.value)}
                    placeholder="cc1@example.com, cc2@example.com"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>BCC</label>
                  <input
                    value={form.bcc}
                    onChange={(e) => updateField("bcc", e.target.value)}
                    placeholder="bcc1@example.com, bcc2@example.com"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Template Key Optional</label>
                <input
                  value={form.template}
                  onChange={(e) =>
                    updateField(
                      "template",
                      String(e.target.value || "")
                        .trim()
                        .toLowerCase(),
                    )
                  }
                  placeholder="payment_receipt"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Subject *</label>
                <input
                  value={form.subject}
                  onChange={(e) => updateField("subject", e.target.value)}
                  placeholder="Important Update from Rebel Angels"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>HTML Body</label>
                <textarea
                  rows={10}
                  value={form.html}
                  onChange={(e) => updateField("html", e.target.value)}
                  placeholder="<div>Hello</div>"
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    fontFamily: "monospace",
                  }}
                />
              </div>

              <div>
                <label style={labelStyle}>Plain Text Body</label>
                <textarea
                  rows={5}
                  value={form.text}
                  onChange={(e) => updateField("text", e.target.value)}
                  placeholder="Hello from Rebel Angels"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <div>
                <label style={labelStyle}>Template Data JSON</label>
                <textarea
                  rows={6}
                  value={form.dataJson}
                  onChange={(e) => updateField("dataJson", e.target.value)}
                  placeholder='{"parentName":"Amina"}'
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    fontFamily: "monospace",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 4,
                }}
              >
                <button
                  type="button"
                  onClick={onPreview}
                  disabled={previewing || sending}
                  style={{
                    ...buttonStyle,
                    background: previewing || sending ? "#94a3b8" : NAVY,
                    color: "#fff",
                  }}
                >
                  {previewing ? "Previewing..." : "Preview Email"}
                </button>

                <button
                  type="button"
                  onClick={onSend}
                  disabled={sending || previewing}
                  style={{
                    ...buttonStyle,
                    background: sending || previewing ? "#fca5a5" : RED,
                    color: "#fff",
                  }}
                >
                  {sending ? "Sending..." : "Send Email"}
                </button>

                <button
                  type="button"
                  onClick={resetComposer}
                  disabled={sending || previewing}
                  style={{
                    ...buttonStyle,
                    background: "rgba(15,23,42,0.08)",
                    color: NAVY,
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div style={cardStyle}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: NAVY,
                  marginBottom: 14,
                }}
              >
                Sending Guide
              </div>

              <div
                style={{ display: "grid", gap: 12, fontSize: 14, color: NAVY }}
              >
                <div>
                  <strong>Manual Emails</strong>
                  <div style={{ marginTop: 4, color: "#475569" }}>
                    Send directly to one or more explicit email addresses.
                  </div>
                </div>

                <div>
                  <strong>By Role</strong>
                  <div style={{ marginTop: 4, color: "#475569" }}>
                    Sends to users filtered by selected role within the academy.
                  </div>
                </div>

                <div>
                  <strong>By Event</strong>
                  <div style={{ marginTop: 4, color: "#475569" }}>
                    Sends to event-related participant and parent recipients.
                  </div>
                </div>

                <div>
                  <strong>All Parents / All Participants</strong>
                  <div style={{ marginTop: 4, color: "#475569" }}>
                    Fast broadcast mode for academy-wide updates.
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid rgba(225,29,46,0.16)",
                    background: "rgba(255,241,242,0.8)",
                    padding: 12,
                    borderRadius: 14,
                    color: "#7f1d1d",
                    fontWeight: 700,
                  }}
                >
                  For one manual recipient, this page calls{" "}
                  <code>/admin/email/test</code>. For multiple recipients or
                  bulk modes, it calls <code>/admin/email/bulk</code>.
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: NAVY,
                  marginBottom: 14,
                }}
              >
                Preview
              </div>

              {!preview ? (
                <div style={{ color: "#64748b", fontWeight: 700 }}>
                  No preview generated yet.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 6 }}>
                      Subject
                    </div>
                    <div
                      style={{
                        border: `1px solid ${BORDER}`,
                        borderRadius: 14,
                        padding: 12,
                        background: "#fff",
                        fontWeight: 800,
                        color: NAVY,
                      }}
                    >
                      {preview.subject || "—"}
                    </div>
                  </div>

                  <div>
                    <div style={{ ...labelStyle, marginBottom: 6 }}>
                      HTML Preview
                    </div>
                    <div
                      style={{
                        border: `1px solid ${BORDER}`,
                        borderRadius: 14,
                        padding: 14,
                        background: "#fff",
                        minHeight: 140,
                        overflow: "auto",
                      }}
                      dangerouslySetInnerHTML={{
                        __html: preview.html || "<div>—</div>",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ ...labelStyle, marginBottom: 6 }}>
                      Plain Text
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 14,
                        padding: 12,
                        background: "#fff",
                        color: NAVY,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontFamily: "inherit",
                      }}
                    >
                      {preview.text || "—"}
                    </pre>
                  </div>

                  <div>
                    <div style={{ ...labelStyle, marginBottom: 6 }}>
                      Template
                    </div>
                    <div
                      style={{
                        border: `1px solid ${BORDER}`,
                        borderRadius: 14,
                        padding: 12,
                        background: "#fff",
                        color: NAVY,
                        fontWeight: 700,
                      }}
                    >
                      {preview.templateName ||
                        preview.templateKey ||
                        preview.template ||
                        "No template key"}
                    </div>
                  </div>

                  {!!preview.variables?.length && (
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>
                        Variables
                      </div>
                      <div
                        style={{
                          border: `1px solid ${BORDER}`,
                          borderRadius: 14,
                          padding: 12,
                          background: "#fff",
                          color: NAVY,
                          fontWeight: 700,
                        }}
                      >
                        {preview.variables.join(", ")}
                      </div>
                    </div>
                  )}

                  {!!preview.source && (
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>
                        Source
                      </div>
                      <div
                        style={{
                          border: `1px solid ${BORDER}`,
                          borderRadius: 14,
                          padding: 12,
                          background: "#fff",
                          color: NAVY,
                          fontWeight: 700,
                          textTransform: "capitalize",
                        }}
                      >
                        {preview.source}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 980px) {
            .bulk-email-grid {
              grid-template-columns: 1fr !important;
            }
          }

          button:disabled {
            cursor: not-allowed !important;
            opacity: 0.75;
          }

          code {
            background: rgba(15, 23, 42, 0.08);
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 12px;
          }
        `}</style>
      </div>
    </div>
  );
}
