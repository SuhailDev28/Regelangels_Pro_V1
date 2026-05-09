import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, AUTH_EVENT } from "../../lib/api.js";
import {
  getUser,
  getSelectedAcademy,
  getEffectiveAcademy,
} from "../../lib/auth.js";

const LS_THEME = "ra_superadmin_theme";
const RED = "var(--ra-accent, #e11d2e)";
const CARD_LIGHT = "rgba(255,255,255,0.92)";
const CARD_DARK = "rgba(15,23,42,0.92)";
const BORDER_LIGHT = "rgba(15,23,42,0.08)";
const BORDER_DARK = "rgba(255,255,255,0.08)";
const TEXT_LIGHT = "#0f172a";
const TEXT_DARK = "#e5eefc";
const MUTED_LIGHT = "#64748b";
const MUTED_DARK = "#94a3b8";
const BG_LIGHT = "#f7f8fc";
const BG_DARK = "#0b1220";

const CATEGORY_OPTIONS = [
  { value: "ALL", label: "All categories" },
  { value: "GENERAL", label: "General" },
  { value: "ANNOUNCEMENT", label: "Announcement" },
  { value: "PAYMENT", label: "Payment" },
  { value: "EVENT", label: "Event" },
  { value: "REGISTRATION", label: "Registration" },
  { value: "RESULT", label: "Result" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "REMINDER", label: "Reminder" },
];

const CREATE_EDIT_CATEGORIES = CATEGORY_OPTIONS.filter(
  (x) => x.value !== "ALL",
);

function safeGetLS(key, fallback = "") {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSetLS(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function unwrap(v) {
  return v?.data ?? v;
}

function toArray(v) {
  const src = unwrap(v);
  if (Array.isArray(src)) return src;
  if (Array.isArray(src?.items)) return src.items;
  if (Array.isArray(src?.rows)) return src.rows;
  if (Array.isArray(src?.data)) return src.data;
  if (Array.isArray(src?.results)) return src.results;
  if (Array.isArray(src?.templates)) return src.templates;
  return [];
}

function normalizeMsg(err, fallback = "Something went wrong") {
  return (
    err?.response?.data?.message ||
    err?.data?.message ||
    err?.message ||
    (typeof err === "string" ? err : "") ||
    fallback
  );
}

function formatDateTime(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function templateIdOf(t) {
  return String(t?._id || t?.id || "");
}

function slugifyName(name = "") {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function normalizeTemplateRows(input) {
  return toArray(input).map((t) => ({
    ...t,
    _id: t?._id || t?.id,
    id: templateIdOf(t),
    name: String(t?.name || "").trim(),
    key: String(t?.key || "").trim(),
    category: String(t?.category || "GENERAL").toUpperCase(),
    subject: String(t?.subject || "").trim(),
    html: String(t?.html || ""),
    text: String(t?.text || ""),
    description: String(t?.description || "").trim(),
    variables: Array.isArray(t?.variables) ? t.variables : [],
    isActive:
      typeof t?.isActive === "boolean"
        ? t.isActive
        : String(t?.status || "ACTIVE").toUpperCase() !== "INACTIVE",
    status:
      typeof t?.isActive === "boolean"
        ? t.isActive
          ? "ACTIVE"
          : "INACTIVE"
        : String(t?.status || "ACTIVE").toUpperCase(),
    isSystem: !!t?.isSystem,
    createdAt: t?.createdAt || null,
    updatedAt: t?.updatedAt || null,
    createdBy: t?.createdBy || null,
    updatedBy: t?.updatedBy || null,
  }));
}

function resolveAcademyId() {
  const user = getUser?.() || null;

  return String(
    getSelectedAcademy?.() ||
      getEffectiveAcademy?.() ||
      user?.academyId?._id ||
      user?.academyId?.id ||
      user?.academy?._id ||
      user?.academy?.id ||
      user?.academyId ||
      user?.academy ||
      "",
  ).trim();
}

function EmptyState({ label = "No data", dark }) {
  return (
    <div
      style={{
        border: `1px dashed ${
          dark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.12)"
        }`,
        borderRadius: 16,
        padding: 18,
        color: dark ? MUTED_DARK : MUTED_LIGHT,
        fontSize: 13,
        textAlign: "center",
      }}
    >
      {label}
    </div>
  );
}

function SectionCard({ title, subtitle, actions, children, dark, minHeight }) {
  return (
    <section
      style={{
        background: dark ? CARD_DARK : CARD_LIGHT,
        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
        borderRadius: 22,
        padding: 18,
        boxShadow: dark
          ? "0 18px 50px rgba(0,0,0,0.28)"
          : "0 18px 50px rgba(15,23,42,0.08)",
        minHeight,
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.2,
              fontWeight: 900,
              color: dark ? TEXT_DARK : TEXT_LIGHT,
            }}
          >
            {title}
          </h3>
          {subtitle ? (
            <div
              style={{
                marginTop: 5,
                fontSize: 12.5,
                color: dark ? MUTED_DARK : MUTED_LIGHT,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, helper, dark }) {
  return (
    <div
      style={{
        background: dark ? CARD_DARK : CARD_LIGHT,
        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
        borderRadius: 22,
        padding: 16,
        boxShadow: dark
          ? "0 12px 40px rgba(0,0,0,0.2)"
          : "0 12px 40px rgba(15,23,42,0.08)",
        minHeight: 116,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          background: "rgba(225,29,46,0.12)",
          color: RED,
          fontWeight: 950,
          fontSize: 18,
        }}
      >
        ✉
      </div>

      <div
        style={{
          marginTop: 14,
          color: dark ? MUTED_DARK : MUTED_LIGHT,
          fontSize: 12.5,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          color: dark ? TEXT_DARK : TEXT_LIGHT,
          fontWeight: 950,
          fontSize: 26,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 12,
          color: dark ? MUTED_DARK : MUTED_LIGHT,
        }}
      >
        {helper || "—"}
      </div>
    </div>
  );
}

function Pill({ children, dark, tone = "neutral" }) {
  const styles = {
    neutral: {
      bg: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)",
      color: dark ? TEXT_DARK : TEXT_LIGHT,
    },
    danger: {
      bg: "rgba(225,29,46,0.12)",
      color: "#ef4444",
    },
    success: {
      bg: "rgba(16,185,129,0.14)",
      color: "#10b981",
    },
    warn: {
      bg: "rgba(245,158,11,0.16)",
      color: "#f59e0b",
    },
    info: {
      bg: "rgba(59,130,246,0.14)",
      color: "#3b82f6",
    },
  };
  const s = styles[tone] || styles.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        fontSize: 11.5,
        fontWeight: 900,
      }}
    >
      {children}
    </span>
  );
}

function Btn({
  children,
  onClick,
  dark,
  primary = false,
  disabled = false,
  danger = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none",
        outline: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        borderRadius: 14,
        padding: "10px 14px",
        fontWeight: 900,
        fontSize: 12.5,
        opacity: disabled ? 0.5 : 1,
        color: primary || danger ? "#fff" : dark ? TEXT_DARK : TEXT_LIGHT,
        background: danger
          ? "#e11d2e"
          : primary
            ? RED
            : dark
              ? "rgba(255,255,255,0.07)"
              : "rgba(15,23,42,0.06)",
        boxShadow: primary ? "0 10px 25px rgba(225,29,46,0.22)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, dark, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        borderRadius: 14,
        padding: "10px 12px",
        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
        background: dark ? "rgba(255,255,255,0.06)" : "#fff",
        color: dark ? TEXT_DARK : TEXT_LIGHT,
        fontWeight: 700,
        fontSize: 13,
        boxSizing: "border-box",
        outline: "none",
      }}
    />
  );
}

function TextArea({ value, onChange, placeholder, dark, rows = 3 }) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        borderRadius: 14,
        padding: "10px 12px",
        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
        background: dark ? "rgba(255,255,255,0.06)" : "#fff",
        color: dark ? TEXT_DARK : TEXT_LIGHT,
        fontWeight: 700,
        fontSize: 13,
        boxSizing: "border-box",
        outline: "none",
        resize: "vertical",
      }}
    />
  );
}

function Select({ value, onChange, options = [], dark, minWidth }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        minWidth: minWidth || 140,
        borderRadius: 14,
        padding: "10px 12px",
        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
        background: dark ? "rgba(255,255,255,0.06)" : "#fff",
        color: dark ? TEXT_DARK : TEXT_LIGHT,
        fontWeight: 800,
        fontSize: 13,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Table({ columns = [], rows = [], dark, emptyLabel = "No records" }) {
  return (
    <div
      style={{
        overflowX: "auto",
        borderRadius: 16,
        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: 980,
          background: "transparent",
        }}
      >
        <thead>
          <tr
            style={{
              background: dark
                ? "rgba(255,255,255,0.03)"
                : "rgba(15,23,42,0.03)",
            }}
          >
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  fontSize: 12,
                  color: dark ? MUTED_DARK : MUTED_LIGHT,
                  borderBottom: `1px solid ${
                    dark ? BORDER_DARK : BORDER_LIGHT
                  }`,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr
                key={row?.id || row?._id || `${i}-${row?.name || "row"}`}
                style={{
                  borderBottom: `1px solid ${
                    dark ? BORDER_DARK : BORDER_LIGHT
                  }`,
                }}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      padding: "12px 14px",
                      fontSize: 13,
                      color: dark ? TEXT_DARK : TEXT_LIGHT,
                      verticalAlign: "top",
                    }}
                  >
                    {typeof c.render === "function"
                      ? c.render(row)
                      : (row?.[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length || 1}
                style={{
                  padding: 18,
                  textAlign: "center",
                  color: dark ? MUTED_DARK : MUTED_LIGHT,
                  fontSize: 13,
                }}
              >
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TemplateModal({
  open,
  dark,
  mode,
  form,
  setForm,
  onClose,
  onSubmit,
  saving,
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(2,6,23,0.62)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1000,
          maxHeight: "92vh",
          overflow: "auto",
          background: dark ? CARD_DARK : "#fff",
          border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
          borderRadius: 24,
          padding: 20,
          boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 950,
                color: dark ? TEXT_DARK : TEXT_LIGHT,
              }}
            >
              {mode === "edit"
                ? "Edit Email Template"
                : "Create Email Template"}
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: 13,
                color: dark ? MUTED_DARK : MUTED_LIGHT,
              }}
            >
              Manage reusable email subjects, HTML bodies, text fallbacks, and
              variable placeholders.
            </div>
          </div>

          <Btn dark={dark} onClick={onClose}>
            Close
          </Btn>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
          }}
          className="email-template-modal-grid"
        >
          <Input
            dark={dark}
            value={form.name}
            onChange={(e) =>
              setForm((s) => {
                const nextName = e.target.value;
                return {
                  ...s,
                  name: nextName,
                  key:
                    mode === "create" && !String(s.key || "").trim()
                      ? slugifyName(nextName)
                      : s.key,
                };
              })
            }
            placeholder="Template name"
          />

          <Input
            dark={dark}
            value={form.key}
            onChange={(e) =>
              setForm((s) => ({ ...s, key: slugifyName(e.target.value) }))
            }
            placeholder="template_key"
          />

          <Select
            dark={dark}
            value={form.category}
            onChange={(e) =>
              setForm((s) => ({ ...s, category: e.target.value }))
            }
            options={CREATE_EDIT_CATEGORIES}
          />

          <Select
            dark={dark}
            value={form.isActive ? "ACTIVE" : "INACTIVE"}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                isActive: e.target.value === "ACTIVE",
              }))
            }
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />

          <div style={{ gridColumn: "1 / -1" }}>
            <Input
              dark={dark}
              value={form.subject}
              onChange={(e) =>
                setForm((s) => ({ ...s, subject: e.target.value }))
              }
              placeholder="Email subject"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <Input
              dark={dark}
              value={form.variables}
              onChange={(e) =>
                setForm((s) => ({ ...s, variables: e.target.value }))
              }
              placeholder="Variables comma separated, example: parentName, participantName, eventName"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <TextArea
              dark={dark}
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
              placeholder="Template description"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <TextArea
              dark={dark}
              rows={12}
              value={form.html}
              onChange={(e) => setForm((s) => ({ ...s, html: e.target.value }))}
              placeholder="HTML body"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <TextArea
              dark={dark}
              rows={6}
              value={form.text}
              onChange={(e) => setForm((s) => ({ ...s, text: e.target.value }))}
              placeholder="Plain text fallback"
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              fontWeight: 800,
              color: dark ? TEXT_DARK : TEXT_LIGHT,
            }}
          >
            <input
              type="checkbox"
              checked={!!form.isSystem}
              onChange={(e) =>
                setForm((s) => ({ ...s, isSystem: e.target.checked }))
              }
            />
            Save as system template
          </label>
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Btn dark={dark} onClick={onClose}>
            Cancel
          </Btn>
          <Btn dark={dark} primary onClick={onSubmit} disabled={saving}>
            {saving
              ? "Saving..."
              : mode === "edit"
                ? "Update Template"
                : "Create Template"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ open, dark, template, onClose }) {
  if (!open || !template) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(2,6,23,0.62)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1000,
          maxHeight: "92vh",
          overflow: "auto",
          background: dark ? CARD_DARK : "#fff",
          border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
          borderRadius: 24,
          padding: 20,
          boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 950,
                color: dark ? TEXT_DARK : TEXT_LIGHT,
              }}
            >
              Template Preview
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: 13,
                color: dark ? MUTED_DARK : MUTED_LIGHT,
              }}
            >
              Subject, variables, HTML source, and plain text preview.
            </div>
          </div>

          <Btn dark={dark} onClick={onClose}>
            Close
          </Btn>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
              padding: 14,
              background: dark
                ? "rgba(255,255,255,0.04)"
                : "rgba(15,23,42,0.02)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: dark ? MUTED_DARK : MUTED_LIGHT,
              }}
            >
              Subject
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 16,
                fontWeight: 900,
                color: dark ? TEXT_DARK : TEXT_LIGHT,
              }}
            >
              {template.subject || "—"}
            </div>
          </div>

          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
              padding: 14,
              background: dark
                ? "rgba(255,255,255,0.04)"
                : "rgba(15,23,42,0.02)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: dark ? MUTED_DARK : MUTED_LIGHT,
              }}
            >
              Variables
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {template.variables?.length ? (
                template.variables.map((v, i) => (
                  <Pill key={`${v}-${i}`} dark={dark} tone="info">
                    {`{{${v}}}`}
                  </Pill>
                ))
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    color: dark ? MUTED_DARK : MUTED_LIGHT,
                  }}
                >
                  No variables
                </span>
              )}
            </div>
          </div>

          {!!template.description && (
            <div
              style={{
                borderRadius: 16,
                border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                padding: 14,
                background: dark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(15,23,42,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: dark ? MUTED_DARK : MUTED_LIGHT,
                }}
              >
                Description
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: dark ? TEXT_DARK : TEXT_LIGHT,
                  whiteSpace: "pre-wrap",
                }}
              >
                {template.description}
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
            className="email-template-preview-grid"
          >
            <div
              style={{
                borderRadius: 16,
                border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                padding: 14,
                background: dark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(15,23,42,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: dark ? MUTED_DARK : MUTED_LIGHT,
                  marginBottom: 10,
                }}
              >
                HTML Source
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12.5,
                  color: dark ? TEXT_DARK : TEXT_LIGHT,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                }}
              >
                {template.html || "—"}
              </pre>
            </div>

            <div
              style={{
                borderRadius: 16,
                border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                padding: 14,
                background: dark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(15,23,42,0.02)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: dark ? MUTED_DARK : MUTED_LIGHT,
                  marginBottom: 10,
                }}
              >
                Plain Text
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12.5,
                  color: dark ? TEXT_DARK : TEXT_LIGHT,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                }}
              >
                {template.text || "—"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmailTemplates({ onLogout }) {
  const navigate = useNavigate();

  const [theme, setTheme] = useState(
    () => safeGetLS(LS_THEME, "light") || "light",
  );
  const dark = theme === "dark";

  const academyId = useMemo(() => resolveAcademyId(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [templates, setTemplates] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const [form, setForm] = useState({
    id: "",
    name: "",
    key: "",
    category: "GENERAL",
    subject: "",
    html: "",
    text: "",
    description: "",
    variables: "",
    isActive: true,
    isSystem: false,
  });

  useEffect(() => {
    safeSetLS(LS_THEME, theme);
    try {
      document.documentElement.setAttribute("data-theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    function handleAuthRequired() {
      onLogout?.();
    }
    window.addEventListener(AUTH_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_EVENT, handleAuthRequired);
  }, [onLogout]);

  const resetForm = useCallback(() => {
    setForm({
      id: "",
      name: "",
      key: "",
      category: "GENERAL",
      subject: "",
      html: "",
      text: "",
      description: "",
      variables: "",
      isActive: true,
      isSystem: false,
    });
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setErr("");
      setLoading(true);

      if (!academyId) {
        setTemplates([]);
        setErr("Valid academyId is required");
        return;
      }

      const params = { academyId };

      if (String(search || "").trim()) params.q = String(search).trim();
      if (statusFilter !== "ALL") {
        params.isActive = statusFilter === "ACTIVE";
      }
      if (categoryFilter !== "ALL") {
        params.category = categoryFilter;
      }

      const res = await api.getEmailTemplates(params);
      setTemplates(normalizeTemplateRows(res));
      setLastRefresh(new Date());
    } catch (e) {
      setErr(normalizeMsg(e, "Failed to load email templates"));
    } finally {
      setLoading(false);
    }
  }, [academyId, search, statusFilter, categoryFilter]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const filteredRows = useMemo(() => templates, [templates]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const active = filteredRows.filter((t) => t.isActive).length;
    const inactive = filteredRows.filter((t) => !t.isActive).length;
    const system = filteredRows.filter((t) => t.isSystem).length;
    return { total, active, inactive, system };
  }, [filteredRows]);

  const openCreate = useCallback(() => {
    resetForm();
    setModalMode("create");
    setModalOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((row) => {
    setForm({
      id: templateIdOf(row),
      name: row?.name || "",
      key: row?.key || "",
      category: String(row?.category || "GENERAL").toUpperCase(),
      subject: row?.subject || "",
      html: row?.html || "",
      text: row?.text || "",
      description: row?.description || "",
      variables: Array.isArray(row?.variables) ? row.variables.join(", ") : "",
      isActive: !!row?.isActive,
      isSystem: !!row?.isSystem,
    });
    setModalMode("edit");
    setModalOpen(true);
  }, []);

  const openPreview = useCallback(
    async (row) => {
      try {
        const id = templateIdOf(row);
        if (!id) return;
        if (!academyId) {
          setErr("Valid academyId is required");
          return;
        }

        const res = await api.getEmailTemplateById(id, { academyId });
        const item = res?.item || res?.data || res || row;
        const normalized = normalizeTemplateRows([item])[0] || row;

        setPreviewTemplate(normalized);
        setPreviewOpen(true);
      } catch {
        setPreviewTemplate(row);
        setPreviewOpen(true);
      }
    },
    [academyId],
  );

  const saveTemplate = useCallback(async () => {
    if (!academyId) {
      setErr("Valid academyId is required");
      return;
    }

    const payload = {
      academyId,
      name: String(form.name || "").trim(),
      key: String(form.key || "").trim() || slugifyName(form.name),
      category: String(form.category || "GENERAL")
        .trim()
        .toUpperCase(),
      subject: String(form.subject || "").trim(),
      html: String(form.html || ""),
      text: String(form.text || ""),
      description: String(form.description || "").trim(),
      variables: String(form.variables || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      isActive: !!form.isActive,
      isSystem: !!form.isSystem,
    };

    if (!payload.name) {
      setErr("Template name is required.");
      return;
    }

    if (!payload.key) {
      setErr("Template key is required.");
      return;
    }

    if (!payload.subject) {
      setErr("Template subject is required.");
      return;
    }

    try {
      setErr("");
      setMsg("");
      setSaving(true);

      if (modalMode === "edit" && form.id) {
        await api.updateEmailTemplate(form.id, payload);
        setMsg("Email template updated successfully.");
      } else {
        await api.createEmailTemplate(payload);
        setMsg("Email template created successfully.");
      }

      setModalOpen(false);
      resetForm();
      await loadTemplates();
    } catch (e) {
      setErr(normalizeMsg(e, "Failed to save email template"));
    } finally {
      setSaving(false);
    }
  }, [academyId, form, modalMode, resetForm, loadTemplates]);

  const toggleTemplate = useCallback(
    async (row) => {
      const id = templateIdOf(row);
      if (!id) return;

      try {
        if (!academyId) {
          setErr("Valid academyId is required");
          return;
        }

        setErr("");
        setMsg("");
        setTogglingId(id);
        await api.toggleEmailTemplate(id, { academyId });
        setMsg(
          row?.isActive
            ? "Template deactivated successfully."
            : "Template activated successfully.",
        );
        await loadTemplates();
      } catch (e) {
        setErr(normalizeMsg(e, "Failed to toggle template"));
      } finally {
        setTogglingId("");
      }
    },
    [academyId, loadTemplates],
  );

  const deleteTemplate = useCallback(
    async (row) => {
      const id = templateIdOf(row);
      if (!id) return;

      const ok = window.confirm(
        `Delete template "${row?.name || "Template"}"?`,
      );
      if (!ok) return;

      try {
        if (!academyId) {
          setErr("Valid academyId is required");
          return;
        }

        setErr("");
        setMsg("");
        setDeletingId(id);
        await api.deleteEmailTemplate(id, { academyId });
        setMsg("Template deleted successfully.");
        await loadTemplates();
      } catch (e) {
        setErr(normalizeMsg(e, "Failed to delete template"));
      } finally {
        setDeletingId("");
      }
    },
    [academyId, loadTemplates],
  );

  const handleResetFilters = useCallback(async () => {
    setSearch("");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");

    try {
      setErr("");
      setLoading(true);

      if (!academyId) {
        setTemplates([]);
        setErr("Valid academyId is required");
        return;
      }

      const res = await api.getEmailTemplates({ academyId });
      setTemplates(normalizeTemplateRows(res));
      setLastRefresh(new Date());
    } catch (e) {
      setErr(normalizeMsg(e, "Failed to reload email templates"));
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  const pageBg = dark ? BG_DARK : BG_LIGHT;
  const textColor = dark ? TEXT_DARK : TEXT_LIGHT;
  const muted = dark ? MUTED_DARK : MUTED_LIGHT;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: pageBg,
        color: textColor,
        padding: 18,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <TemplateModal
        open={modalOpen}
        dark={dark}
        mode={modalMode}
        form={form}
        setForm={setForm}
        onClose={() => setModalOpen(false)}
        onSubmit={saveTemplate}
        saving={saving}
      />

      <PreviewModal
        open={previewOpen}
        dark={dark}
        template={previewTemplate}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewTemplate(null);
        }}
      />

      <div
        style={{ maxWidth: 1600, margin: "0 auto", display: "grid", gap: 18 }}
      >
        <div
          style={{
            background: dark
              ? "linear-gradient(135deg, rgba(225,29,46,0.14), rgba(15,23,42,0.98))"
              : "linear-gradient(135deg, rgba(225,29,46,0.08), rgba(255,255,255,0.95))",
            border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
            borderRadius: 28,
            padding: 20,
            boxShadow: dark
              ? "0 20px 60px rgba(0,0,0,0.28)"
              : "0 20px 60px rgba(15,23,42,0.08)",
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
            <div style={{ minWidth: 260 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(225,29,46,0.10)",
                  color: RED,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                SUPER ADMIN EMAIL TEMPLATES
              </div>

              <h1
                style={{
                  margin: "12px 0 6px",
                  fontSize: 31,
                  lineHeight: 1.08,
                  letterSpacing: "-0.03em",
                  fontWeight: 950,
                }}
              >
                Saved Email Templates
              </h1>

              <div style={{ color: muted, fontSize: 14 }}>
                Create, update, preview, activate, and reuse structured email
                templates for payments, events, certificates, results,
                reminders, registration, and announcements.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <Pill dark={dark} tone="info">
                {lastRefresh
                  ? `Last refresh: ${lastRefresh.toLocaleTimeString()}`
                  : "Not synced yet"}
              </Pill>

              {academyId ? (
                <Pill dark={dark} tone="success">
                  Academy: {academyId}
                </Pill>
              ) : (
                <Pill dark={dark} tone="danger">
                  No academy selected
                </Pill>
              )}

              <Btn
                dark={dark}
                onClick={() =>
                  setTheme((t) => (t === "dark" ? "light" : "dark"))
                }
              >
                {dark ? "☀ Light mode" : "🌙 Dark mode"}
              </Btn>

              <Btn dark={dark} onClick={() => navigate("/super-admin")}>
                Back
              </Btn>

              {typeof onLogout === "function" ? (
                <Btn dark={dark} onClick={() => onLogout()}>
                  Logout
                </Btn>
              ) : null}

              <Btn dark={dark} onClick={loadTemplates}>
                Refresh
              </Btn>

              <Btn dark={dark} primary onClick={openCreate}>
                + Create Template
              </Btn>
            </div>
          </div>
        </div>

        {err ? (
          <div
            style={{
              background: "rgba(225,29,46,0.1)",
              color: "#ef4444",
              border: "1px solid rgba(225,29,46,0.18)",
              padding: 14,
              borderRadius: 16,
              fontWeight: 800,
            }}
          >
            {err}
          </div>
        ) : null}

        {msg ? (
          <div
            style={{
              background: "rgba(16,185,129,0.12)",
              color: "#10b981",
              border: "1px solid rgba(16,185,129,0.18)",
              padding: 14,
              borderRadius: 16,
              fontWeight: 800,
            }}
          >
            {msg}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          <StatCard
            dark={dark}
            label="Loaded Templates"
            value={stats.total}
            helper="Current filtered query result"
          />
          <StatCard
            dark={dark}
            label="Active Templates"
            value={stats.active}
            helper="Currently enabled for sending"
          />
          <StatCard
            dark={dark}
            label="Inactive Templates"
            value={stats.inactive}
            helper="Saved but disabled"
          />
          <StatCard
            dark={dark}
            label="System Templates"
            value={stats.system}
            helper="Global reusable templates"
          />
        </div>

        <SectionCard
          title="Template Library"
          subtitle="Search and manage stored template definitions"
          dark={dark}
          actions={
            <Btn dark={dark} primary onClick={openCreate}>
              + New Template
            </Btn>
          }
        >
          <div
            className="email-template-toolbar-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto auto",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Input
              dark={dark}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, key, subject, variable..."
            />

            <Select
              dark={dark}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              minWidth={150}
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />

            <Select
              dark={dark}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              minWidth={170}
              options={CATEGORY_OPTIONS}
            />

            <Btn dark={dark} onClick={loadTemplates}>
              Apply
            </Btn>

            <Btn dark={dark} onClick={handleResetFilters}>
              Reset
            </Btn>
          </div>

          {loading ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: muted,
                fontWeight: 800,
              }}
            >
              Loading email templates...
            </div>
          ) : filteredRows.length ? (
            <Table
              dark={dark}
              rows={filteredRows}
              emptyLabel="No email templates found"
              columns={[
                {
                  key: "template",
                  label: "Template",
                  render: (r) => (
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {r?.name || "Untitled Template"}
                      </div>
                      <div style={{ fontSize: 12, color: muted }}>
                        Key: {r?.key || "—"}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "category",
                  label: "Category",
                  render: (r) => (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Pill dark={dark} tone="info">
                        {r?.category || "GENERAL"}
                      </Pill>
                      {r?.isSystem ? (
                        <Pill dark={dark} tone="warn">
                          System
                        </Pill>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "subject",
                  label: "Subject",
                  render: (r) => (
                    <div
                      style={{
                        maxWidth: 280,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {r?.subject || "—"}
                    </div>
                  ),
                },
                {
                  key: "variables",
                  label: "Variables",
                  render: (r) => (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        maxWidth: 240,
                      }}
                    >
                      {r?.variables?.length ? (
                        r.variables.slice(0, 5).map((v, i) => (
                          <Pill key={`${v}-${i}`} dark={dark} tone="neutral">
                            {v}
                          </Pill>
                        ))
                      ) : (
                        <span style={{ color: muted }}>—</span>
                      )}
                      {r?.variables?.length > 5 ? (
                        <Pill dark={dark} tone="neutral">
                          +{r.variables.length - 5}
                        </Pill>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => (
                    <Pill dark={dark} tone={r?.isActive ? "success" : "danger"}>
                      {r?.isActive ? "ACTIVE" : "INACTIVE"}
                    </Pill>
                  ),
                },
                {
                  key: "updatedAt",
                  label: "Updated",
                  render: (r) => (
                    <div>
                      <div>{formatDateTime(r?.updatedAt)}</div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: muted,
                        }}
                      >
                        {r?.updatedBy?.name || r?.updatedBy?.email || "—"}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "actions",
                  label: "Actions",
                  render: (r) => (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Btn dark={dark} onClick={() => openPreview(r)}>
                        Preview
                      </Btn>
                      <Btn dark={dark} onClick={() => openEdit(r)}>
                        Edit
                      </Btn>
                      <Btn
                        dark={dark}
                        onClick={() => toggleTemplate(r)}
                        disabled={togglingId === templateIdOf(r)}
                      >
                        {togglingId === templateIdOf(r)
                          ? "Saving..."
                          : r?.isActive
                            ? "Disable"
                            : "Enable"}
                      </Btn>
                      {!r?.isSystem ? (
                        <Btn
                          dark={dark}
                          danger
                          onClick={() => deleteTemplate(r)}
                          disabled={deletingId === templateIdOf(r)}
                        >
                          {deletingId === templateIdOf(r)
                            ? "Deleting..."
                            : "Delete"}
                        </Btn>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState
              dark={dark}
              label="No templates found. Create your first saved email template."
            />
          )}
        </SectionCard>
      </div>

      <style>{`
        @media (max-width: 1180px) {
          .email-template-toolbar-grid,
          .email-template-modal-grid,
          .email-template-preview-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 760px) {
          body {
            overflow-x: hidden;
          }
        }
      `}</style>
    </div>
  );
}
