import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, AUTH_EVENT } from "../../lib/api.js";
import {
  getUser,
  getSelectedAcademy,
  setSelectedAcademy,
  clearSelectedAcademy,
} from "../../lib/auth.js";

/**
 * SuperAdminDashboard.jsx
 * ------------------------------------------------------------
 * ✅ Global KPI row
 * ✅ Academy / branch filter
 * ✅ Pending approvals center
 * ✅ Academy registration approvals center
 * ✅ Revenue / fee collection summary
 * ✅ Branch-wise analytics
 * ✅ Coach performance
 * ✅ Event enrollment trend
 * ✅ Certificate verification stats
 * ✅ Live leaderboard preview
 * ✅ CSV import shortcuts
 * ✅ Dark / Light theme support
 * ✅ Responsive enterprise UI
 * ✅ Safe fallbacks for missing APIs
 * ✅ Logout support
 * ✅ Scoped academy object sync compatible with AdminDashboard/auth.js
 * ✅ Real last refresh timestamp
 * ✅ Auth-required event listener
 * ✅ Online / offline awareness
 * ✅ Auto refresh while tab is visible
 * ✅ Beautiful upgraded chart cards
 * ✅ Activation link copy/open support
 * ✅ NEW: Onboarding hooks for Super Admin tour
 * ✅ NEW: Email settings + email logs shortcuts
 * ✅ NEW: Email templates shortcut
 */

const LS_THEME = "ra_superadmin_theme";
const RED = "var(--ra-accent, #e11d2e)";
const BG_LIGHT = "#f7f8fc";
const BG_DARK = "#0b1220";
const CARD_LIGHT = "rgba(255,255,255,0.92)";
const CARD_DARK = "rgba(15,23,42,0.92)";
const BORDER_LIGHT = "rgba(15,23,42,0.08)";
const BORDER_DARK = "rgba(255,255,255,0.08)";
const TEXT_LIGHT = "#0f172a";
const TEXT_DARK = "#e5eefc";
const MUTED_LIGHT = "#64748b";
const MUTED_DARK = "#94a3b8";

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
  if (Array.isArray(src?.academies)) return src.academies;
  if (Array.isArray(src?.branches)) return src.branches;
  if (Array.isArray(src?.participants)) return src.participants;
  return [];
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatCompact(n) {
  const val = toNumber(n, 0);
  try {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: val >= 1000 ? 1 : 0,
    }).format(val);
  } catch {
    return String(val);
  }
}

function formatCurrency(n, currency = "QAR") {
  const val = toNumber(n, 0);
  try {
    return new Intl.NumberFormat("en-QA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(val);
  } catch {
    return `${currency} ${val.toLocaleString?.() || val}`;
  }
}

function formatPercent(n) {
  const val = toNumber(n, 0);
  return `${Math.round(val)}%`;
}

function formatDateTime(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function academyIdOf(a) {
  return String(a?._id || a?.id || a?.academyId || a?.value || "");
}

function branchIdOf(b) {
  return String(b?._id || b?.id || b?.branchId || b?.value || "");
}

function registrationIdOf(r) {
  return String(r?._id || r?.id || "");
}

function buildAbsoluteActivationLink(relativeOrAbsolute) {
  const raw = String(relativeOrAbsolute || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (typeof window === "undefined") return raw;
  return `${window.location.origin}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

async function copyTextSafe(text) {
  const value = String(text || "").trim();
  if (!value) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

function normalizeAcademyRows(input) {
  return toArray(input).map((a) => ({
    ...a,
    _id: a?._id || a?.id || a?.academyId,
    id: String(a?._id || a?.id || a?.academyId || ""),
    academyId: String(a?._id || a?.id || a?.academyId || ""),
    name: a?.name || a?.academyName || "Academy",
    academyName: a?.name || a?.academyName || "Academy",
    code: a?.code || a?.academyCode || "",
    academyCode: a?.code || a?.academyCode || "",
    email: a?.email || "",
    phone: a?.phone || "",
    logoUrl: a?.logoUrl || a?.academyLogo || "",
    academyLogo: a?.logoUrl || a?.academyLogo || "",
    status: String(a?.status || "ACTIVE").toUpperCase(),
    primaryColor: a?.primaryColor || "",
    secondaryColor: a?.secondaryColor || "",
    address: a?.address || "",
    notes: a?.notes || "",
    branches: Array.isArray(a?.branches) ? a.branches : [],
    branchesCount: toNumber(
      a?.branchesCount ??
        a?.branchCount ??
        a?.totalBranches ??
        a?.branches?.length ??
        0,
      0,
    ),
    participantsCount: toNumber(
      a?.participantsCount ??
        a?.participantCount ??
        a?.totalParticipants ??
        a?.students ??
        0,
      0,
    ),
  }));
}

function normalizeRegistrationRows(input) {
  return toArray(input).map((r) => ({
    ...r,
    _id: r?._id || r?.id,
    id: String(r?._id || r?.id || ""),
    academyNameEn: r?.academyNameEn || "",
    academyNameAr: r?.academyNameAr || "",
    legalEntityType: r?.legalEntityType || "",
    commercialRegistrationNumber: r?.commercialRegistrationNumber || "",
    tradeLicenseNumber: r?.tradeLicenseNumber || "",
    activityType: r?.activityType || "",
    authorizedSignatoryName: r?.authorizedSignatoryName || "",
    authorizedSignatoryIdNumber: r?.authorizedSignatoryIdNumber || "",
    email: r?.email || "",
    phone: r?.phone || "",
    municipality: r?.municipality || "",
    zone: r?.zone || "",
    streetAddress: r?.streetAddress || "",
    logoUrl: r?.logoUrl || "",
    competentAuthorityApprovalRequired: !!r?.competentAuthorityApprovalRequired,
    declarationAccepted: !!r?.declarationAccepted,
    status: String(r?.status || "PENDING").toUpperCase(),
    rejectedReason: r?.rejectedReason || "",
    academyCode: r?.academyCode || "",
    activationToken: r?.activationToken || "",
    activationTokenExpiresAt: r?.activationTokenExpiresAt || null,
    activatedAt: r?.activatedAt || null,
    academyId: r?.academyId || null,
    adminUserId: r?.adminUserId || null,
    createdAt: r?.createdAt || null,
    updatedAt: r?.updatedAt || null,
    approvedAt: r?.approvedAt || null,
  }));
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

function SectionCard({
  title,
  subtitle,
  actions,
  children,
  dark,
  minHeight,
  dataTour,
}) {
  return (
    <section
      data-tour={dataTour}
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

function StatCard({ label, value, helper, dark, icon, trend }) {
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
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "start",
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
            flex: "0 0 auto",
          }}
        >
          {icon}
        </div>
        {trend ? (
          <span
            style={{
              padding: "6px 9px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 900,
              background: "rgba(225,29,46,0.08)",
              color: RED,
              whiteSpace: "nowrap",
            }}
          >
            {trend}
          </span>
        ) : null}
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
          minWidth: 680,
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
                      verticalAlign: "middle",
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

function Select({ value, onChange, options = [], dark, minWidth, dataTour }) {
  return (
    <select
      data-tour={dataTour}
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

function DashboardIcon({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      {children}
    </svg>
  );
}

function MiniBarChart({
  data = [],
  valueKey = "value",
  labelKey = "label",
  dark,
  compact = false,
}) {
  const safe = toArray(data).slice(0, compact ? 6 : 8);
  const max = Math.max(1, ...safe.map((d) => toNumber(d?.[valueKey], 0)));

  return (
    <div style={{ display: "grid", gap: compact ? 8 : 12 }}>
      {safe.length ? (
        safe.map((row, i) => {
          const value = toNumber(row?.[valueKey], 0);
          const pct = clamp((value / max) * 100, 4, 100);
          return (
            <div
              key={row?.id || row?._id || row?.[labelKey] || i}
              style={{ display: "grid", gap: 6 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    color: dark ? TEXT_DARK : TEXT_LIGHT,
                    opacity: 0.95,
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={row?.[labelKey] || "—"}
                >
                  {row?.[labelKey] || "—"}
                </span>
                <span
                  style={{
                    color: dark ? MUTED_DARK : MUTED_LIGHT,
                    fontWeight: 800,
                  }}
                >
                  {formatCompact(value)}
                </span>
              </div>
              <div
                style={{
                  height: compact ? 8 : 10,
                  borderRadius: 999,
                  background: dark
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(15,23,42,0.06)",
                  overflow: "hidden",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background:
                      "linear-gradient(90deg, rgba(225,29,46,1) 0%, rgba(244,63,94,0.88) 50%, rgba(251,113,133,0.7) 100%)",
                    boxShadow: "0 8px 18px rgba(225,29,46,0.2)",
                    transition: "width .35s ease",
                  }}
                />
              </div>
            </div>
          );
        })
      ) : (
        <EmptyState dark={dark} label="No chart data available" />
      )}
    </div>
  );
}

function TrendLine({
  data = [],
  valueKey = "value",
  labelKey = "label",
  dark,
  height = 64,
}) {
  const safe = toArray(data).slice(-12);
  const values = safe.map((d) => toNumber(d?.[valueKey], 0));
  const max = Math.max(1, ...values);
  const min = Math.min(...values, 0);
  const w = 100;
  const h = height;
  const areaPoints = [];
  const linePoints = [];

  safe.forEach((d, i) => {
    const x = safe.length === 1 ? w / 2 : (i / (safe.length - 1)) * w;
    const y =
      h -
      ((toNumber(d?.[valueKey], 0) - min) / Math.max(1, max - min)) * (h - 12) -
      6;
    linePoints.push(`${x},${y}`);
    areaPoints.push({ x, y, label: d?.[labelKey], value: d?.[valueKey] });
  });

  const areaD = areaPoints.length
    ? `M ${areaPoints[0].x} ${h} L ${areaPoints
        .map((p) => `${p.x} ${p.y}`)
        .join(" L ")} L ${areaPoints[areaPoints.length - 1].x} ${h} Z`
    : "";

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 18,
        padding: "8px 8px 2px",
        background: dark
          ? "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))"
          : "linear-gradient(180deg, rgba(225,29,46,0.04), rgba(15,23,42,0.01))",
        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
      }}
    >
      {safe.length ? (
        <>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            width="100%"
            height={height + 20}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="saTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(225,29,46,0.35)" />
                <stop offset="100%" stopColor="rgba(225,29,46,0.02)" />
              </linearGradient>
              <linearGradient id="saTrendStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(225,29,46,1)" />
                <stop offset="50%" stopColor="rgba(244,63,94,0.95)" />
                <stop offset="100%" stopColor="rgba(251,113,133,0.8)" />
              </linearGradient>
            </defs>

            <path d={areaD} fill="url(#saTrendFill)" />
            <polyline
              fill="none"
              stroke="url(#saTrendStroke)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={linePoints.join(" ")}
            />

            {areaPoints.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3.2"
                  fill={dark ? "#fff" : "#111827"}
                />
                <circle cx={p.x} cy={p.y} r="5.6" fill="rgba(225,29,46,0.14)" />
              </g>
            ))}
          </svg>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(safe.length, 6)}, minmax(0,1fr))`,
              gap: 8,
              marginTop: 2,
            }}
          >
            {safe.slice(-6).map((d, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: dark ? MUTED_DARK : MUTED_LIGHT,
                    fontWeight: 800,
                  }}
                >
                  {d?.[labelKey] || "—"}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    color: dark ? TEXT_DARK : TEXT_LIGHT,
                    fontWeight: 900,
                  }}
                >
                  {formatCompact(d?.[valueKey] || 0)}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState dark={dark} label="No trend data" />
      )}
    </div>
  );
}

function SparkDonut({ value = 0, label = "", dark }) {
  const v = clamp(toNumber(value, 0), 0, 100);
  const radius = 30;
  const circ = 2 * Math.PI * radius;
  const dash = (v / 100) * circ;

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 8,
        padding: 10,
      }}
    >
      <svg width="88" height="88" viewBox="0 0 88 88">
        <defs>
          <linearGradient id="saDonutGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(225,29,46,1)" />
            <stop offset="100%" stopColor="rgba(244,63,94,0.72)" />
          </linearGradient>
        </defs>
        <circle
          cx="44"
          cy="44"
          r={radius}
          stroke={dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          stroke="url(#saDonutGrad)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform="rotate(-90 44 44)"
        />
      </svg>
      <div
        style={{
          marginTop: -64,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 950,
            color: dark ? TEXT_DARK : TEXT_LIGHT,
          }}
        >
          {Math.round(v)}%
        </div>
      </div>
      <div
        style={{
          marginTop: -8,
          fontSize: 12,
          fontWeight: 800,
          color: dark ? MUTED_DARK : MUTED_LIGHT,
          textAlign: "center",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function AcademyModal({
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
          maxWidth: 880,
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
              {mode === "edit" ? "Edit Academy" : "Create Academy"}
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: 13,
                color: dark ? MUTED_DARK : MUTED_LIGHT,
              }}
            >
              Manage academy master records from super admin control center.
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
        >
          <Input
            dark={dark}
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="Academy name"
          />
          <Input
            dark={dark}
            value={form.code}
            onChange={(e) =>
              setForm((s) => ({ ...s, code: e.target.value.toUpperCase() }))
            }
            placeholder="Academy code"
          />
          <Input
            dark={dark}
            type="email"
            value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            placeholder="Official email"
          />
          <Input
            dark={dark}
            value={form.phone}
            onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            placeholder="Phone"
          />
          <Input
            dark={dark}
            value={form.logoUrl}
            onChange={(e) =>
              setForm((s) => ({ ...s, logoUrl: e.target.value }))
            }
            placeholder="Logo URL"
          />
          <Select
            dark={dark}
            value={form.status}
            onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
          <Input
            dark={dark}
            value={form.primaryColor}
            onChange={(e) =>
              setForm((s) => ({ ...s, primaryColor: e.target.value }))
            }
            placeholder="Primary color (#E11D2E)"
          />
          <Input
            dark={dark}
            value={form.secondaryColor}
            onChange={(e) =>
              setForm((s) => ({ ...s, secondaryColor: e.target.value }))
            }
            placeholder="Secondary color (#0F172A)"
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <TextArea
              dark={dark}
              value={form.address}
              onChange={(e) =>
                setForm((s) => ({ ...s, address: e.target.value }))
              }
              placeholder="Address"
              rows={2}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <TextArea
              dark={dark}
              value={form.notes}
              onChange={(e) =>
                setForm((s) => ({ ...s, notes: e.target.value }))
              }
              placeholder="Notes / remarks"
              rows={3}
            />
          </div>
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
                ? "Update Academy"
                : "Create Academy"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function RegistrationDetailModal({
  open,
  dark,
  row,
  rejectReason,
  setRejectReason,
  onClose,
  onApprove,
  onReject,
  onCopyActivationLink,
  onOpenActivationLink,
  busy,
}) {
  if (!open || !row) return null;

  const textColor = dark ? TEXT_DARK : TEXT_LIGHT;
  const muted = dark ? MUTED_DARK : MUTED_LIGHT;

  const item = (label, value) => (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
        background: dark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.02)",
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: muted }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 14,
          fontWeight: 800,
          color: textColor,
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(2,6,23,0.66)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          maxHeight: "92vh",
          overflow: "auto",
          background: dark ? CARD_DARK : "#fff",
          border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
          borderRadius: 24,
          padding: 20,
          boxShadow: "0 30px 90px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 950,
                color: textColor,
              }}
            >
              Academy Registration Review
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: muted,
              }}
            >
              Review basic registration details before approval or rejection.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill
              dark={dark}
              tone={
                row?.status === "ACTIVATED"
                  ? "info"
                  : row?.status === "APPROVED"
                    ? "success"
                    : row?.status === "REJECTED"
                      ? "danger"
                      : "warn"
              }
            >
              {row?.status || "PENDING"}
            </Pill>
            <Btn dark={dark} onClick={onClose}>
              Close
            </Btn>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: 18,
            alignItems: "start",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              borderRadius: 22,
              border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
              background: dark
                ? "rgba(255,255,255,0.04)"
                : "rgba(15,23,42,0.02)",
              minHeight: 180,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
          >
            {row?.logoUrl ? (
              <img
                src={row.logoUrl}
                alt="Academy logo"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  background: "#fff",
                }}
              />
            ) : (
              <div style={{ textAlign: "center", padding: 14, color: muted }}>
                No logo uploaded
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {item("Academy Name (English)", row?.academyNameEn)}
            {item("Academy Name (Arabic)", row?.academyNameAr)}
            {item("Legal Entity Type", row?.legalEntityType)}
            {item("Business Activity", row?.activityType)}
            {item("CR Number", row?.commercialRegistrationNumber)}
            {item("Trade License Number", row?.tradeLicenseNumber)}
            {item("Authorized Signatory Name", row?.authorizedSignatoryName)}
            {item(
              "Authorized Signatory ID / QID / Passport",
              row?.authorizedSignatoryIdNumber,
            )}
            {item("Email", row?.email)}
            {item("Phone", row?.phone)}
            {item("Municipality", row?.municipality)}
            {item("Zone", row?.zone)}
            <div style={{ gridColumn: "1 / -1" }}>
              {item("Street Address", row?.streetAddress)}
            </div>
            {item(
              "Competent Authority Approval",
              row?.competentAuthorityApprovalRequired
                ? "Required"
                : "Not marked",
            )}
            {item(
              "Declaration Accepted",
              row?.declarationAccepted ? "Yes" : "No",
            )}
            {item("Created At", formatDateTime(row?.createdAt))}
            {item("Approved At", formatDateTime(row?.approvedAt))}
            {item("Academy Code", row?.academyCode)}
            {item(
              "Activation Token Expiry",
              formatDateTime(row?.activationTokenExpiresAt),
            )}
            {item("Activated At", formatDateTime(row?.activatedAt))}
            <div style={{ gridColumn: "1 / -1" }}>
              {item("Rejected Reason", row?.rejectedReason)}
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 18,
            border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
            background: dark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.02)",
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: textColor,
              marginBottom: 10,
            }}
          >
            Rejection reason
          </div>
          <TextArea
            dark={dark}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Optional reason for rejection"
            rows={3}
          />
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

          {row?.status === "APPROVED" && row?.activationToken ? (
            <>
              <Btn dark={dark} onClick={() => onCopyActivationLink?.(row)}>
                Copy Activation Link
              </Btn>
              <Btn dark={dark} onClick={() => onOpenActivationLink?.(row)}>
                Open Activation Page
              </Btn>
            </>
          ) : null}

          {row?.status === "PENDING" ? (
            <>
              <Btn dark={dark} danger onClick={onReject} disabled={busy}>
                {busy ? "Processing..." : "Reject Registration"}
              </Btn>
              <Btn dark={dark} primary onClick={onApprove} disabled={busy}>
                {busy ? "Processing..." : "Approve Registration"}
              </Btn>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard({ onLogout }) {
  const navigate = useNavigate();
  const user = useMemo(() => getUser?.() || null, []);
  const [theme, setTheme] = useState(
    () => safeGetLS(LS_THEME, "light") || "light",
  );
  const dark = theme === "dark";

  const go = useCallback(
    (path) => {
      navigate(path);
    },
    [navigate],
  );

  const [range, setRange] = useState("30d");
  const [academyId, setAcademyIdState] = useState(() => {
    const scoped = getSelectedAcademy?.();
    return String(scoped?._id || scoped?.id || scoped?.academyId || "all");
  });
  const [branchId, setBranchId] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const [academies, setAcademies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [registrationStatusFilter, setRegistrationStatusFilter] =
    useState("PENDING");
  const [registrationSearch, setRegistrationSearch] = useState("");
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [latestActivationLink, setLatestActivationLink] = useState("");

  const [summary, setSummary] = useState({});
  const [approvals, setApprovals] = useState([]);
  const [finance, setFinance] = useState({});
  const [attendance, setAttendance] = useState({});
  const [coachPerformance, setCoachPerformance] = useState([]);
  const [enrollmentTrend, setEnrollmentTrend] = useState([]);
  const [certificateStats, setCertificateStats] = useState({});
  const [leaderboard, setLeaderboard] = useState({});

  const [academyModalOpen, setAcademyModalOpen] = useState(false);
  const [academyModalMode, setAcademyModalMode] = useState("create");
  const [academySaving, setAcademySaving] = useState(false);
  const [academyForm, setAcademyForm] = useState({
    id: "",
    name: "",
    code: "",
    email: "",
    phone: "",
    logoUrl: "",
    status: "ACTIVE",
    primaryColor: "",
    secondaryColor: "",
    address: "",
    notes: "",
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

  useEffect(() => {
    function onOnline() {
      setIsOnline(true);
    }
    function onOffline() {
      setIsOnline(false);
    }
    function onFocus() {
      const scoped = getSelectedAcademy?.();
      const nextId = String(
        scoped?._id || scoped?.id || scoped?.academyId || "all",
      );
      setAcademyIdState(nextId);
    }
    function onStorage() {
      const scoped = getSelectedAcademy?.();
      const nextId = String(
        scoped?._id || scoped?.id || scoped?.academyId || "all",
      );
      setAcademyIdState(nextId);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setAcademyId = useCallback(
    (next) => {
      setAcademyIdState(next);

      if (next && next !== "all") {
        const picked = academies.find((a) => academyIdOf(a) === String(next));

        if (picked) {
          const normalized = {
            academyId: academyIdOf(picked),
            academyName: picked?.name || picked?.academyName || "",
            academyCode: picked?.code || picked?.academyCode || "",
            academyLogo: picked?.logoUrl || picked?.academyLogo || "",
            _id: academyIdOf(picked),
            id: academyIdOf(picked),
            name: picked?.name || picked?.academyName || "",
            code: picked?.code || picked?.academyCode || "",
            logoUrl: picked?.logoUrl || picked?.academyLogo || "",
          };
          setSelectedAcademy?.(normalized);
        } else {
          setSelectedAcademy?.(next);
        }
      } else {
        clearSelectedAcademy?.();
      }

      setBranchId("all");
    },
    [academies],
  );

  const query = useMemo(() => {
    const q = {};
    if (academyId && academyId !== "all") q.academyId = academyId;
    if (branchId && branchId !== "all") q.branchId = branchId;
    if (range) q.range = range;
    return q;
  }, [academyId, branchId, range]);

  const resetAcademyForm = useCallback(() => {
    setAcademyForm({
      id: "",
      name: "",
      code: "",
      email: "",
      phone: "",
      logoUrl: "",
      status: "ACTIVE",
      primaryColor: "",
      secondaryColor: "",
      address: "",
      notes: "",
    });
  }, []);

  const openCreateAcademy = useCallback(() => {
    setAcademyModalMode("create");
    resetAcademyForm();
    setAcademyModalOpen(true);
  }, [resetAcademyForm]);

  const openEditAcademy = useCallback((academy) => {
    setAcademyModalMode("edit");
    setAcademyForm({
      id: academyIdOf(academy),
      name: academy?.name || academy?.academyName || "",
      code: academy?.code || academy?.academyCode || "",
      email: academy?.email || "",
      phone: academy?.phone || "",
      logoUrl: academy?.logoUrl || academy?.academyLogo || "",
      status: academy?.status || "ACTIVE",
      primaryColor: academy?.primaryColor || "",
      secondaryColor: academy?.secondaryColor || "",
      address: academy?.address || "",
      notes: academy?.notes || "",
    });
    setAcademyModalOpen(true);
  }, []);

  const loadRegistrations = useCallback(async () => {
    try {
      const params = {};
      if (registrationStatusFilter && registrationStatusFilter !== "ALL") {
        params.status = registrationStatusFilter;
      }
      if (registrationSearch.trim()) {
        params.q = registrationSearch.trim();
      }

      const res = await api
        .get("/super-admin/academy-registrations", { params })
        .catch(() => ({ data: [] }));

      setRegistrations(normalizeRegistrationRows(res));
    } catch (e) {
      setErr(normalizeMsg(e, "Failed to load academy registrations"));
    }
  }, [registrationSearch, registrationStatusFilter]);

  const loadAll = useCallback(
    async (soft = false) => {
      try {
        setErr("");
        if (soft) setRefreshing(true);
        else setLoading(true);

        const registrationParams = {};
        if (registrationStatusFilter && registrationStatusFilter !== "ALL") {
          registrationParams.status = registrationStatusFilter;
        }
        if (registrationSearch.trim()) {
          registrationParams.q = registrationSearch.trim();
        }

        const calls = [
          api
            .get("/super-admin/dashboard/summary", { params: query })
            .catch(() => ({ data: {} })),
          api
            .get("/super-admin/academies", {
              params: { includeBranches: true },
            })
            .catch(() => ({ data: { academies: [] } })),
          api
            .get("/super-admin/branches/analytics", { params: query })
            .catch(() => ({ data: [] })),
          api
            .get("/super-admin/finance/summary", { params: query })
            .catch(() => ({ data: {} })),
          api
            .get("/super-admin/attendance/summary", { params: query })
            .catch(() => ({ data: {} })),
          api
            .get("/super-admin/approvals/pending", { params: query })
            .catch(() => ({ data: [] })),
          api
            .get("/super-admin/coaches/performance", { params: query })
            .catch(() => ({ data: [] })),
          api
            .get("/super-admin/events/enrollment-trend", { params: query })
            .catch(() => ({ data: [] })),
          api
            .get("/super-admin/certificates/stats", { params: query })
            .catch(() => ({ data: {} })),
          api
            .get("/super-admin/leaderboard/live-preview", { params: query })
            .catch(() => ({ data: {} })),
          api
            .get("/super-admin/academy-registrations", {
              params: registrationParams,
            })
            .catch(() => ({ data: [] })),
        ];

        const [
          summaryRes,
          academiesRes,
          branchesRes,
          financeRes,
          attendanceRes,
          approvalsRes,
          coachesRes,
          trendRes,
          certRes,
          liveRes,
          registrationsRes,
        ] = await Promise.all(calls);

        const academyRows = normalizeAcademyRows(academiesRes);
        const branchRows = toArray(branchesRes);

        setSummary(unwrap(summaryRes) || {});
        setAcademies(academyRows);
        setBranches(branchRows);
        setFinance(unwrap(financeRes) || {});
        setAttendance(unwrap(attendanceRes) || {});
        setApprovals(toArray(approvalsRes));
        setCoachPerformance(toArray(coachesRes));
        setEnrollmentTrend(toArray(trendRes));
        setCertificateStats(unwrap(certRes) || {});
        setLeaderboard(unwrap(liveRes) || {});
        setRegistrations(normalizeRegistrationRows(registrationsRes));
        setLastRefresh(new Date());

        const scoped = getSelectedAcademy?.();
        const scopedId = String(
          scoped?._id || scoped?.id || scoped?.academyId || "",
        );
        if (
          scopedId &&
          scopedId !== "all" &&
          !academyRows.some((a) => academyIdOf(a) === scopedId)
        ) {
          clearSelectedAcademy?.();
          setAcademyIdState("all");
          setBranchId("all");
        }
      } catch (e) {
        setErr(normalizeMsg(e, "Failed to load super admin dashboard"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query, registrationSearch, registrationStatusFilter],
  );

  useEffect(() => {
    loadAll(false);
  }, [loadAll]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadAll(true);
      }
    }, 20000);

    return () => window.clearInterval(id);
  }, [loadAll]);

  const saveAcademy = useCallback(async () => {
    const payload = {
      name: String(academyForm.name || "").trim(),
      code: String(academyForm.code || "")
        .trim()
        .toUpperCase(),
      email: String(academyForm.email || "").trim(),
      phone: String(academyForm.phone || "").trim(),
      logoUrl: String(academyForm.logoUrl || "").trim(),
      status: String(academyForm.status || "ACTIVE")
        .trim()
        .toUpperCase(),
      primaryColor: String(academyForm.primaryColor || "").trim(),
      secondaryColor: String(academyForm.secondaryColor || "").trim(),
      address: String(academyForm.address || "").trim(),
      notes: String(academyForm.notes || "").trim(),
    };

    if (!payload.name) {
      setErr("Academy name is required.");
      return;
    }

    if (!payload.code) {
      setErr("Academy code is required.");
      return;
    }

    try {
      setErr("");
      setMsg("");
      setAcademySaving(true);

      if (academyModalMode === "edit" && academyForm.id) {
        if (typeof api.updateAcademy === "function") {
          await api.updateAcademy(academyForm.id, payload);
        } else {
          await api.put(`/super-admin/academies/${academyForm.id}`, payload);
        }
        setMsg("Academy updated successfully.");
      } else {
        if (typeof api.createAcademy === "function") {
          await api.createAcademy(payload);
        } else {
          await api.post("/super-admin/academies", payload);
        }
        setMsg("Academy created successfully.");
      }

      setAcademyModalOpen(false);
      resetAcademyForm();
      await loadAll(true);
    } catch (e) {
      setErr(normalizeMsg(e, "Failed to save academy"));
    } finally {
      setAcademySaving(false);
    }
  }, [academyForm, academyModalMode, loadAll, resetAcademyForm]);

  const removeAcademy = useCallback(
    async (academy) => {
      const id = academyIdOf(academy);
      if (!id) return;

      const ok = window.confirm(
        `Delete academy "${
          academy?.name || academy?.academyName || "Academy"
        }"?`,
      );
      if (!ok) return;

      try {
        setErr("");
        setMsg("");

        if (typeof api.deleteAcademy === "function") {
          await api.deleteAcademy(id);
        } else {
          await api.delete(`/super-admin/academies/${id}`);
        }

        if (String(academyId) === id) {
          clearSelectedAcademy?.();
          setAcademyIdState("all");
        }

        setMsg("Academy deleted successfully.");
        await loadAll(true);
      } catch (e) {
        setErr(normalizeMsg(e, "Failed to delete academy"));
      }
    },
    [academyId, loadAll],
  );

  const openRegistrationReview = useCallback((row) => {
    setSelectedRegistration(row);
    setRejectReason(row?.rejectedReason || "");
  }, []);

  const closeRegistrationReview = useCallback(() => {
    setSelectedRegistration(null);
    setRejectReason("");
  }, []);

  const approveRegistration = useCallback(
    async (row) => {
      const id = registrationIdOf(row || selectedRegistration);
      if (!id) return;

      try {
        setErr("");
        setMsg("");
        setRegistrationBusy(true);

        const res = await api.post(
          `/super-admin/academy-registrations/${id}/approve`,
          {},
        );

        const data = unwrap(res) || {};
        const activationLink = buildAbsoluteActivationLink(
          data?.activationLink,
        );

        setLatestActivationLink(activationLink);

        setMsg(
          activationLink
            ? "Academy registration approved successfully. Activation link generated."
            : "Academy registration approved successfully.",
        );

        closeRegistrationReview();
        await loadAll(true);
      } catch (e) {
        setErr(normalizeMsg(e, "Failed to approve academy registration"));
      } finally {
        setRegistrationBusy(false);
      }
    },
    [selectedRegistration, loadAll, closeRegistrationReview],
  );

  const rejectRegistration = useCallback(
    async (row) => {
      const id = registrationIdOf(row || selectedRegistration);
      if (!id) return;

      try {
        setErr("");
        setMsg("");
        setRegistrationBusy(true);

        await api.post(`/super-admin/academy-registrations/${id}/reject`, {
          reason: String(rejectReason || "").trim(),
        });

        setMsg("Academy registration rejected successfully.");
        closeRegistrationReview();
        await loadAll(true);
      } catch (e) {
        setErr(normalizeMsg(e, "Failed to reject academy registration"));
      } finally {
        setRegistrationBusy(false);
      }
    },
    [selectedRegistration, rejectReason, loadAll, closeRegistrationReview],
  );

  const copyActivationLink = useCallback(
    async (row) => {
      const token = String(row?.activationToken || "").trim();
      const link = token
        ? buildAbsoluteActivationLink(`/academy/activate?token=${token}`)
        : latestActivationLink;

      if (!link) {
        setErr("Activation link is not available for this registration.");
        return;
      }

      const ok = await copyTextSafe(link);
      if (ok) setMsg("Activation link copied successfully.");
      else setErr("Failed to copy activation link.");
    },
    [latestActivationLink],
  );

  const openActivationLink = useCallback((row) => {
    const token = String(row?.activationToken || "").trim();
    const link =
      token && buildAbsoluteActivationLink(`/academy/activate?token=${token}`);

    if (!link) {
      setErr("Activation link is not available for this registration.");
      return;
    }

    window.open(link, "_blank", "noopener,noreferrer");
  }, []);

  const academyOptions = useMemo(() => {
    return [
      { value: "all", label: "All academies" },
      ...academies.map((a) => ({
        value: academyIdOf(a),
        label: a?.name || a?.academyName || "Academy",
      })),
    ];
  }, [academies]);

  const branchOptions = useMemo(() => {
    let rows = branches;
    if (academyId !== "all") {
      rows = rows.filter(
        (b) =>
          String(b?.academyId || b?.academy?._id || "") === String(academyId),
      );
    }
    return [
      { value: "all", label: "All branches" },
      ...rows.map((b) => ({
        value: branchIdOf(b),
        label: b?.name || b?.branchName || "Branch",
      })),
    ];
  }, [branches, academyId]);

  const kpis = useMemo(() => {
    const totalBranches =
      summary?.totalBranches ??
      summary?.branches ??
      toArray(branches).length ??
      0;

    return [
      {
        label: "Total Branches",
        value: formatCompact(totalBranches),
        helper: "Platform-wide active units",
        trend: summary?.branchTrend ? `${summary.branchTrend}%` : null,
        icon: (
          <DashboardIcon>
            <rect x="4" y="4" width="7" height="7" rx="1.5" />
            <rect x="13" y="4" width="7" height="5" rx="1.5" />
            <rect x="13" y="11" width="7" height="9" rx="1.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" />
          </DashboardIcon>
        ),
      },
      {
        label: "Participants",
        value: formatCompact(
          summary?.totalParticipants ?? summary?.participants ?? 0,
        ),
        helper: "Active enrolled participants",
        trend: summary?.participantTrend
          ? `${summary.participantTrend}%`
          : null,
        icon: (
          <DashboardIcon>
            <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
            <circle cx="9.5" cy="7" r="4" />
            <path d="M20 8v6M23 11h-6" />
          </DashboardIcon>
        ),
      },
      {
        label: "Monthly Collection",
        value: formatCurrency(
          finance?.collectedThisMonth ?? summary?.monthlyRevenue ?? 0,
        ),
        helper: "Collected in selected range",
        trend: finance?.collectionTrend ? `${finance.collectionTrend}%` : null,
        icon: (
          <DashboardIcon>
            <path d="M12 1v22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" />
          </DashboardIcon>
        ),
      },
      {
        label: "Pending Fees",
        value: formatCurrency(
          finance?.pendingFees ?? summary?.pendingFees ?? 0,
        ),
        helper: `${formatCompact(finance?.overdueCount ?? 0)} overdue accounts`,
        trend: finance?.pendingTrend ? `${finance.pendingTrend}%` : null,
        icon: (
          <DashboardIcon>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M9 9h6M9 13h4" />
          </DashboardIcon>
        ),
      },
      {
        label: "Pending Approvals",
        value: formatCompact(
          summary?.pendingApprovals ?? approvals.length ?? 0,
        ),
        helper: "Needs action from super admin",
        trend: null,
        icon: (
          <DashboardIcon>
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </DashboardIcon>
        ),
      },
      {
        label: "Registrations Queue",
        value: formatCompact(registrations.length),
        helper: "Public academy sign-up requests",
        trend: null,
        icon: (
          <DashboardIcon>
            <path d="M12 5v14M5 12h14" />
            <rect x="3" y="4" width="18" height="16" rx="2" />
          </DashboardIcon>
        ),
      },
    ];
  }, [summary, finance, approvals, registrations, branches]);

  const branchAnalyticsRows = useMemo(() => {
    return branches
      .map((b) => ({
        ...b,
        participants: toNumber(b?.participants ?? b?.participantCount ?? 0),
        revenue: toNumber(b?.revenue ?? b?.collected ?? 0),
        pendingFees: toNumber(b?.pendingFees ?? b?.pending ?? 0),
        attendanceRate: toNumber(b?.attendanceRate ?? b?.attendance ?? 0),
        activeEvents: toNumber(b?.activeEvents ?? 0),
        approvals: toNumber(b?.pendingApprovals ?? b?.approvals ?? 0),
      }))
      .sort((a, b) => b.participants - a.participants);
  }, [branches]);

  const coachRows = useMemo(() => {
    return coachPerformance
      .map((c) => ({
        ...c,
        performanceScore: toNumber(c?.performanceScore ?? c?.score ?? 0),
      }))
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 8);
  }, [coachPerformance]);

  const liveRows = useMemo(() => {
    return toArray(leaderboard?.rows || leaderboard?.participants || []).slice(
      0,
      5,
    );
  }, [leaderboard]);

  const pendingBreakdown = useMemo(() => {
    const source = approvals.length
      ? approvals
      : [
          {
            type: "participants",
            count: summary?.pendingParticipantApprovals ?? 0,
          },
          { type: "coaches", count: summary?.pendingCoachApprovals ?? 0 },
          { type: "events", count: summary?.pendingEventApprovals ?? 0 },
          {
            type: "certificates",
            count: summary?.pendingCertificateApprovals ?? 0,
          },
        ];

    return source
      .map((a) => ({
        label: a?.label || a?.type || a?.name || "item",
        value: toNumber(a?.count ?? a?.total ?? a?.items ?? 0),
      }))
      .filter((x) => x.value > 0);
  }, [approvals, summary]);

  const overviewRevenueTrend = useMemo(() => {
    return toArray(finance?.trend || finance?.revenueTrend || enrollmentTrend)
      .slice(-12)
      .map((x, i) => ({
        id: i,
        label: x?.label || x?.month || x?.date || `P${i + 1}`,
        value: x?.value ?? x?.count ?? 0,
      }));
  }, [finance, enrollmentTrend]);

  const attendanceCards = useMemo(() => {
    return [
      {
        label: "Today Attendance",
        value: formatPercent(attendance?.todayRate ?? attendance?.rate ?? 0),
      },
      {
        label: "Marked Sessions",
        value: formatCompact(attendance?.markedSessions ?? 0),
      },
      {
        label: "Late Marking",
        value: formatCompact(attendance?.lateMarked ?? 0),
      },
      {
        label: "Pending Sessions",
        value: formatCompact(attendance?.pendingSessions ?? 0),
      },
    ];
  }, [attendance]);

  const academyManagementRows = useMemo(() => {
    return academies.map((a) => ({
      ...a,
      branchCount: toNumber(
        a?.branchCount ??
          a?.branchesCount ??
          a?.totalBranches ??
          a?.branches?.length ??
          0,
      ),
      participantCount: toNumber(
        a?.participantCount ??
          a?.participantsCount ??
          a?.participants ??
          a?.totalParticipants ??
          a?.students ??
          0,
      ),
      status: String(a?.status || "ACTIVE").toUpperCase(),
    }));
  }, [academies]);

  const registrationRows = useMemo(() => {
    return registrations.filter((r) => {
      const q = registrationSearch.trim().toLowerCase();
      if (!q) return true;
      return [
        r?.academyNameEn,
        r?.academyNameAr,
        r?.commercialRegistrationNumber,
        r?.email,
        r?.phone,
        r?.authorizedSignatoryName,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [registrations, registrationSearch]);

  const registrationCounts = useMemo(() => {
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, ACTIVATED: 0 };
    registrations.forEach((r) => {
      const s = String(r?.status || "PENDING").toUpperCase();
      if (counts[s] != null) counts[s] += 1;
    });
    return counts;
  }, [registrations]);

  const attendanceRateValue = useMemo(
    () => toNumber(attendance?.todayRate ?? attendance?.rate ?? 0),
    [attendance],
  );

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
      <AcademyModal
        open={academyModalOpen}
        dark={dark}
        mode={academyModalMode}
        form={academyForm}
        setForm={setAcademyForm}
        onClose={() => setAcademyModalOpen(false)}
        onSubmit={saveAcademy}
        saving={academySaving}
      />

      <RegistrationDetailModal
        open={!!selectedRegistration}
        dark={dark}
        row={selectedRegistration}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        onClose={closeRegistrationReview}
        onApprove={() => approveRegistration(selectedRegistration)}
        onReject={() => rejectRegistration(selectedRegistration)}
        onCopyActivationLink={copyActivationLink}
        onOpenActivationLink={openActivationLink}
        busy={registrationBusy}
      />

      <div
        style={{ maxWidth: 1600, margin: "0 auto", display: "grid", gap: 18 }}
      >
        <div
          data-tour="superadmin-settings"
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
                SUPER ADMIN CONTROL CENTER
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
                Platform Dashboard
              </h1>

              <div style={{ color: muted, fontSize: 14 }}>
                Welcome{user?.name ? `, ${user.name}` : ""}. Monitor academies,
                branches, revenue, events, coaches, certificates, public
                registrations, and live activity from one place.
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
              <Pill dark={dark} tone={isOnline ? "success" : "warn"}>
                {isOnline ? "Online" : "Offline"}
              </Pill>

              <Select
                dataTour="superadmin-academy-switcher"
                value={academyId}
                onChange={(e) => setAcademyId(e.target.value)}
                options={academyOptions}
                dark={dark}
                minWidth={190}
              />
              <Select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                options={branchOptions}
                dark={dark}
                minWidth={180}
              />
              <Select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                dark={dark}
                options={[
                  { value: "7d", label: "Last 7 days" },
                  { value: "30d", label: "Last 30 days" },
                  { value: "90d", label: "Last 90 days" },
                  { value: "12m", label: "Last 12 months" },
                ]}
              />
              <Btn
                dark={dark}
                onClick={() =>
                  setTheme((t) => (t === "dark" ? "light" : "dark"))
                }
              >
                {dark ? "☀ Light mode" : "🌙 Dark mode"}
              </Btn>
              <Btn
                dark={dark}
                primary
                onClick={() => loadAll(true)}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </Btn>
              <Btn
                dark={dark}
                onClick={() => go("/super-admin/email-settings")}
              >
                Email Settings
              </Btn>
              <Btn dark={dark} onClick={() => go("/super-admin/email-logs")}>
                Email Logs
              </Btn>
              <Btn
                dark={dark}
                onClick={() => go("/super-admin/email-templates")}
              >
                Email Templates
              </Btn>
              <Btn dark={dark} primary onClick={openCreateAcademy}>
                + Create Academy
              </Btn>
              {typeof onLogout === "function" ? (
                <Btn dark={dark} onClick={() => onLogout?.()}>
                  Logout
                </Btn>
              ) : null}
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                borderRadius: 18,
                padding: 14,
                background: dark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(255,255,255,0.76)",
                border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
              }}
            >
              <div style={{ fontSize: 12, color: muted, fontWeight: 800 }}>
                Selected academy
              </div>
              <div style={{ marginTop: 5, fontWeight: 900, fontSize: 16 }}>
                {academyOptions.find((x) => x.value === academyId)?.label ||
                  "All academies"}
              </div>
            </div>
            <div
              style={{
                borderRadius: 18,
                padding: 14,
                background: dark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(255,255,255,0.76)",
                border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
              }}
            >
              <div style={{ fontSize: 12, color: muted, fontWeight: 800 }}>
                Selected branch
              </div>
              <div style={{ marginTop: 5, fontWeight: 900, fontSize: 16 }}>
                {branchOptions.find((x) => x.value === branchId)?.label ||
                  "All branches"}
              </div>
            </div>
            <div
              style={{
                borderRadius: 18,
                padding: 14,
                background: dark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(255,255,255,0.76)",
                border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
              }}
            >
              <div style={{ fontSize: 12, color: muted, fontWeight: 800 }}>
                Range
              </div>
              <div style={{ marginTop: 5, fontWeight: 900, fontSize: 16 }}>
                {range === "7d"
                  ? "Last 7 days"
                  : range === "30d"
                    ? "Last 30 days"
                    : range === "90d"
                      ? "Last 90 days"
                      : "Last 12 months"}
              </div>
            </div>
            <div
              style={{
                borderRadius: 18,
                padding: 14,
                background: dark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(255,255,255,0.76)",
                border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
              }}
            >
              <div style={{ fontSize: 12, color: muted, fontWeight: 800 }}>
                Last refresh
              </div>
              <div style={{ marginTop: 5, fontWeight: 900, fontSize: 16 }}>
                {lastRefresh ? lastRefresh.toLocaleString() : "Not synced yet"}
              </div>
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

        {latestActivationLink ? (
          <div
            style={{
              background: dark
                ? "rgba(59,130,246,0.12)"
                : "rgba(59,130,246,0.10)",
              color: "#3b82f6",
              border: "1px solid rgba(59,130,246,0.18)",
              padding: 14,
              borderRadius: 16,
              fontWeight: 800,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                wordBreak: "break-all",
                fontSize: 13,
              }}
            >
              Activation Link: {latestActivationLink}
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn
                dark={dark}
                onClick={async () => {
                  const ok = await copyTextSafe(latestActivationLink);
                  if (ok) setMsg("Activation link copied successfully.");
                  else setErr("Failed to copy activation link.");
                }}
              >
                Copy
              </Btn>
              <Btn
                dark={dark}
                primary
                onClick={() =>
                  window.open(
                    latestActivationLink,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                Open
              </Btn>
            </div>
          </div>
        ) : null}

        <SectionCard
          dataTour="superadmin-academies"
          title="Academy Registration Approvals"
          subtitle="Review public academy sign-up requests, validate basic legal details, and approve or reject onboarding"
          dark={dark}
          actions={
            <>
              <Pill dark={dark} tone="warn">
                {formatCompact(registrationCounts.PENDING)} pending
              </Pill>
              <Pill dark={dark} tone="success">
                {formatCompact(registrationCounts.APPROVED)} approved
              </Pill>
              <Pill dark={dark} tone="info">
                {formatCompact(registrationCounts.ACTIVATED)} activated
              </Pill>
              <Pill dark={dark} tone="danger">
                {formatCompact(registrationCounts.REJECTED)} rejected
              </Pill>
            </>
          }
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Input
              dark={dark}
              value={registrationSearch}
              onChange={(e) => setRegistrationSearch(e.target.value)}
              placeholder="Search by academy, CR number, email, phone, signatory..."
            />
            <Select
              dark={dark}
              value={registrationStatusFilter}
              onChange={(e) => setRegistrationStatusFilter(e.target.value)}
              options={[
                { value: "PENDING", label: "Pending" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
                { value: "ACTIVATED", label: "Activated" },
                { value: "ALL", label: "All statuses" },
              ]}
              minWidth={160}
            />
            <Btn dark={dark} onClick={() => loadRegistrations()}>
              Reload
            </Btn>
            <Btn dark={dark} primary onClick={() => loadAll(true)}>
              Sync Dashboard
            </Btn>
          </div>

          <Table
            dark={dark}
            rows={registrationRows}
            columns={[
              {
                key: "academy",
                label: "Academy",
                render: (r) => (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "54px 1fr",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 14,
                        overflow: "hidden",
                        background: dark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(15,23,42,0.04)",
                        display: "grid",
                        placeItems: "center",
                        border: `1px solid ${
                          dark ? BORDER_DARK : BORDER_LIGHT
                        }`,
                      }}
                    >
                      {r?.logoUrl ? (
                        <img
                          src={r.logoUrl}
                          alt="logo"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            background: "#fff",
                          }}
                        />
                      ) : (
                        <span style={{ fontWeight: 900, color: muted }}>
                          {(r?.academyNameEn || "A").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {r?.academyNameEn || "—"}
                      </div>
                      <div style={{ fontSize: 12, color: muted }}>
                        {r?.academyNameAr || "No Arabic name"}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "cr",
                label: "Legal / CR",
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      CR: {r?.commercialRegistrationNumber || "—"}
                    </div>
                    <div style={{ fontSize: 12, color: muted }}>
                      {r?.legalEntityType || "—"}
                    </div>
                  </div>
                ),
              },
              {
                key: "contact",
                label: "Contact",
                render: (r) => (
                  <div>
                    <div>{r?.email || "—"}</div>
                    <div style={{ fontSize: 12, color: muted }}>
                      {r?.phone || "—"}
                    </div>
                  </div>
                ),
              },
              {
                key: "signatory",
                label: "Authorized Signatory",
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {r?.authorizedSignatoryName || "—"}
                    </div>
                    <div style={{ fontSize: 12, color: muted }}>
                      {r?.authorizedSignatoryIdNumber || "—"}
                    </div>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (r) => (
                  <Pill
                    dark={dark}
                    tone={
                      r?.status === "ACTIVATED"
                        ? "info"
                        : r?.status === "APPROVED"
                          ? "success"
                          : r?.status === "REJECTED"
                            ? "danger"
                            : "warn"
                    }
                  >
                    {r?.status || "PENDING"}
                  </Pill>
                ),
              },
              {
                key: "createdAt",
                label: "Submitted",
                render: (r) => (
                  <span style={{ whiteSpace: "nowrap" }}>
                    {formatDateTime(r?.createdAt)}
                  </span>
                ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (r) => (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn dark={dark} onClick={() => openRegistrationReview(r)}>
                      Review
                    </Btn>

                    {r?.status === "PENDING" ? (
                      <>
                        <Btn
                          dark={dark}
                          primary
                          onClick={() => approveRegistration(r)}
                        >
                          Approve
                        </Btn>
                        <Btn
                          dark={dark}
                          danger
                          onClick={() => {
                            setSelectedRegistration(r);
                            setRejectReason(r?.rejectedReason || "");
                          }}
                        >
                          Reject
                        </Btn>
                      </>
                    ) : null}

                    {r?.status === "APPROVED" && r?.activationToken ? (
                      <>
                        <Btn dark={dark} onClick={() => copyActivationLink(r)}>
                          Copy Link
                        </Btn>
                        <Btn dark={dark} onClick={() => openActivationLink(r)}>
                          Open Link
                        </Btn>
                      </>
                    ) : null}
                  </div>
                ),
              },
            ]}
            emptyLabel="No academy registrations found"
          />
        </SectionCard>

        <SectionCard
          dataTour="superadmin-academies"
          title="Academy Management"
          subtitle="Create, update, remove, and review academy master records"
          dark={dark}
          actions={
            <>
              <Pill dark={dark} tone="success">
                {formatCompact(academyManagementRows.length)} academies
              </Pill>
              <Btn dark={dark} primary onClick={openCreateAcademy}>
                + Create Academy
              </Btn>
            </>
          }
        >
          <Table
            dark={dark}
            rows={academyManagementRows}
            columns={[
              {
                key: "academy",
                label: "Academy",
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {r?.name || r?.academyName || "—"}
                    </div>
                    <div style={{ fontSize: 12, color: muted }}>
                      {r?.code || r?.academyCode || "No code"}
                    </div>
                  </div>
                ),
              },
              {
                key: "contact",
                label: "Contact",
                render: (r) => (
                  <div>
                    <div>{r?.email || "—"}</div>
                    <div style={{ fontSize: 12, color: muted }}>
                      {r?.phone || "—"}
                    </div>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (r) => (
                  <Pill
                    dark={dark}
                    tone={
                      String(r?.status || "").toUpperCase() === "ACTIVE"
                        ? "success"
                        : "warn"
                    }
                  >
                    {r?.status || "—"}
                  </Pill>
                ),
              },
              {
                key: "branchCount",
                label: "Branches",
                render: (r) => formatCompact(r?.branchCount ?? 0),
              },
              {
                key: "participantCount",
                label: "Participants",
                render: (r) => formatCompact(r?.participantCount ?? 0),
              },
              {
                key: "actions",
                label: "Actions",
                render: (r) => (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn dark={dark} onClick={() => openEditAcademy(r)}>
                      Edit
                    </Btn>
                    <Btn dark={dark} danger onClick={() => removeAcademy(r)}>
                      Delete
                    </Btn>
                  </div>
                ),
              },
            ]}
            emptyLabel="No academies found"
          />
        </SectionCard>

        <div
          data-tour="superadmin-kpis"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          {kpis.map((card) => (
            <StatCard key={card.label} {...card} dark={dark} />
          ))}
        </div>

        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: muted,
              fontWeight: 800,
            }}
          >
            Loading super admin dashboard...
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr .8fr .8fr",
                gap: 16,
              }}
            >
              <SectionCard
                dataTour="superadmin-finance"
                title="Revenue / Fee Collection Summary"
                subtitle="Collection, pending dues, overdue accounts, and trend overview"
                dark={dark}
                minHeight={320}
                actions={
                  <>
                    <Pill dark={dark} tone="success">
                      Collected{" "}
                      {formatCurrency(finance?.collectedThisMonth ?? 0)}
                    </Pill>
                    <Pill dark={dark} tone="warn">
                      Pending {formatCurrency(finance?.pendingFees ?? 0)}
                    </Pill>
                  </>
                }
              >
                <div style={{ display: "grid", gap: 16 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: 12,
                    }}
                  >
                    {[
                      [
                        "Collected",
                        formatCurrency(finance?.collectedThisMonth ?? 0),
                      ],
                      ["Pending", formatCurrency(finance?.pendingFees ?? 0)],
                      ["Overdue", formatCurrency(finance?.overdueFees ?? 0)],
                      ["Paid Ratio", formatPercent(finance?.paidRatio ?? 0)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          borderRadius: 18,
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
                            color: muted,
                            fontWeight: 800,
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            marginTop: 7,
                            fontSize: 19,
                            fontWeight: 950,
                          }}
                        >
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <TrendLine
                    data={overviewRevenueTrend}
                    valueKey="value"
                    labelKey="label"
                    dark={dark}
                    height={68}
                  />

                  <MiniBarChart
                    dark={dark}
                    data={toArray(
                      finance?.topBranches || finance?.branchComparison || [],
                    ).slice(0, 6)}
                    valueKey="value"
                    labelKey="label"
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Pending Approvals"
                subtitle="Action queue across branches and modules"
                dark={dark}
                minHeight={320}
                actions={
                  <Pill dark={dark} tone="danger">
                    {formatCompact(
                      pendingBreakdown.reduce((a, b) => a + b.value, 0),
                    )}{" "}
                    open
                  </Pill>
                }
              >
                {pendingBreakdown.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {pendingBreakdown.map((item) => (
                      <div
                        key={item.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          padding: 12,
                          borderRadius: 16,
                          background: dark
                            ? "rgba(255,255,255,0.04)"
                            : "rgba(15,23,42,0.02)",
                          border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 13,
                            textTransform: "capitalize",
                          }}
                        >
                          {String(item.label).replace(/_/g, " ")}
                        </div>
                        <Pill dark={dark} tone="danger">
                          {formatCompact(item.value)}
                        </Pill>
                      </div>
                    ))}
                    <div style={{ marginTop: 6 }}>
                      <Btn
                        dark={dark}
                        primary
                        onClick={() => navigate("/admin/approvals")}
                      >
                        Open approvals center
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <EmptyState dark={dark} label="No pending approvals" />
                )}
              </SectionCard>

              <SectionCard
                title="Attendance Snapshot"
                subtitle="Operational attendance health across sessions"
                dark={dark}
                minHeight={320}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: "1fr auto",
                    gap: 8,
                    height: "100%",
                  }}
                >
                  <SparkDonut
                    value={attendanceRateValue}
                    label="Today Attendance"
                    dark={dark}
                  />
                  <div style={{ display: "grid", gap: 10 }}>
                    {attendanceCards.slice(1).map((a) => (
                      <div
                        key={a.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: 12,
                          borderRadius: 16,
                          background: dark
                            ? "rgba(255,255,255,0.04)"
                            : "rgba(15,23,42,0.02)",
                          border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                        }}
                      >
                        <span
                          style={{
                            color: muted,
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          {a.label}
                        </span>
                        <span style={{ fontWeight: 950, fontSize: 18 }}>
                          {a.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.15fr .85fr",
                gap: 16,
              }}
            >
              <SectionCard
                title="Branch-wise Analytics"
                subtitle="Compare participants, revenue, attendance, events, and approvals across branches"
                dark={dark}
                minHeight={390}
              >
                <Table
                  dark={dark}
                  rows={branchAnalyticsRows.slice(0, 8)}
                  columns={[
                    {
                      key: "name",
                      label: "Branch",
                      render: (r) => (
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {r?.name || r?.branchName || "—"}
                          </div>
                          <div style={{ fontSize: 12, color: muted }}>
                            {r?.academyName || "Academy"}
                          </div>
                        </div>
                      ),
                    },
                    { key: "participants", label: "Participants" },
                    {
                      key: "attendanceRate",
                      label: "Attendance",
                      render: (r) => formatPercent(r?.attendanceRate),
                    },
                    {
                      key: "revenue",
                      label: "Revenue",
                      render: (r) => formatCurrency(r?.revenue),
                    },
                    {
                      key: "pendingFees",
                      label: "Pending",
                      render: (r) => formatCurrency(r?.pendingFees),
                    },
                    { key: "activeEvents", label: "Events" },
                    { key: "approvals", label: "Approvals" },
                  ]}
                  emptyLabel="No branch analytics found"
                />
              </SectionCard>

              <SectionCard
                title="Live Leaderboard Preview"
                subtitle="Top live results from active event"
                dark={dark}
                minHeight={390}
                actions={
                  leaderboard?.eventName ? (
                    <Pill dark={dark} tone="success">
                      {leaderboard.eventName}
                    </Pill>
                  ) : null
                }
              >
                <div style={{ display: "grid", gap: 12 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                        background: dark
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(15,23,42,0.02)",
                      }}
                    >
                      <div
                        style={{ color: muted, fontSize: 12, fontWeight: 800 }}
                      >
                        Active Event
                      </div>
                      <div style={{ marginTop: 6, fontWeight: 900 }}>
                        {leaderboard?.eventName || "—"}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                        background: dark
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(15,23,42,0.02)",
                      }}
                    >
                      <div
                        style={{ color: muted, fontSize: 12, fontWeight: 800 }}
                      >
                        Participants
                      </div>
                      <div style={{ marginTop: 6, fontWeight: 900 }}>
                        {formatCompact(
                          leaderboard?.participantCount ?? liveRows.length,
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                        background: dark
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(15,23,42,0.02)",
                      }}
                    >
                      <div
                        style={{ color: muted, fontSize: 12, fontWeight: 800 }}
                      >
                        Last Update
                      </div>
                      <div
                        style={{ marginTop: 6, fontWeight: 900, fontSize: 13 }}
                      >
                        {formatDateTime(leaderboard?.updatedAt)}
                      </div>
                    </div>
                  </div>

                  {liveRows.length ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {liveRows.map((r, i) => (
                        <div
                          key={r?._id || r?.id || `${i}-${r?.name || "live"}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "54px 1fr auto",
                            alignItems: "center",
                            gap: 12,
                            padding: 12,
                            borderRadius: 16,
                            background: dark
                              ? "rgba(255,255,255,0.04)"
                              : "rgba(15,23,42,0.02)",
                            border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                          }}
                        >
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 14,
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 950,
                              color: "#fff",
                              background:
                                i === 0
                                  ? "linear-gradient(135deg, #f59e0b, #facc15)"
                                  : i === 1
                                    ? "linear-gradient(135deg, #94a3b8, #cbd5e1)"
                                    : i === 2
                                      ? "linear-gradient(135deg, #d97706, #f59e0b)"
                                      : RED,
                            }}
                          >
                            {r?.rank || i + 1}
                          </div>
                          <div>
                            <div style={{ fontWeight: 900 }}>
                              {r?.name || r?.participantName || "Participant"}
                            </div>
                            <div style={{ fontSize: 12, color: muted }}>
                              {r?.branchName ||
                                leaderboard?.branchName ||
                                "Branch"}
                            </div>
                          </div>
                          <div style={{ fontWeight: 950, fontSize: 19 }}>
                            {toNumber(r?.total ?? r?.score ?? 0).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      dark={dark}
                      label="No live leaderboard data available"
                    />
                  )}

                  <div>
                    <Btn dark={dark} primary onClick={() => navigate("/tv")}>
                      Open TV leaderboard
                    </Btn>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: ".95fr 1.05fr 1fr",
                gap: 16,
              }}
            >
              <SectionCard
                title="Coach Performance"
                subtitle="Top coaches by score consistency, attendance quality, and operational discipline"
                dark={dark}
                minHeight={360}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  {coachRows.length ? (
                    coachRows.map((coach, i) => (
                      <div
                        key={
                          coach?._id ||
                          coach?.id ||
                          `${i}-${coach?.name || "coach"}`
                        }
                        style={{
                          borderRadius: 16,
                          border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                          background: dark
                            ? "rgba(255,255,255,0.04)"
                            : "rgba(15,23,42,0.02)",
                          padding: 12,
                          display: "grid",
                          gridTemplateColumns: "44px 1fr auto",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            display: "grid",
                            placeItems: "center",
                            background: "rgba(225,29,46,0.12)",
                            color: RED,
                            fontWeight: 950,
                          }}
                        >
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {coach?.name || coach?.coachName || "Coach"}
                          </div>
                          <div style={{ fontSize: 12, color: muted }}>
                            {coach?.branchName || "Branch"} •{" "}
                            {coach?.assignedGroups ?? 0} groups
                          </div>
                        </div>
                        <Pill dark={dark} tone="success">
                          {coach?.performanceScore ?? 0}
                        </Pill>
                      </div>
                    ))
                  ) : (
                    <EmptyState dark={dark} label="No coach performance data" />
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Event Enrollment Trend"
                subtitle="Enrollment growth over time across branches and events"
                dark={dark}
                minHeight={360}
              >
                <div style={{ display: "grid", gap: 16 }}>
                  <TrendLine
                    data={enrollmentTrend.map((x, i) => ({
                      id: i,
                      label: x?.label || x?.month || x?.date || `P${i + 1}`,
                      value: x?.value ?? x?.count ?? 0,
                    }))}
                    valueKey="value"
                    labelKey="label"
                    dark={dark}
                    height={76}
                  />
                  <MiniBarChart
                    data={enrollmentTrend.slice(-8).map((x, i) => ({
                      id: i,
                      label: x?.label || x?.month || x?.date || "Period",
                      value: x?.value ?? x?.count ?? 0,
                    }))}
                    valueKey="value"
                    labelKey="label"
                    dark={dark}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Certificate Verification Stats"
                subtitle="Issued, verified, invalid attempts, and recent trust metrics"
                dark={dark}
                minHeight={360}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    gap: 12,
                    marginBottom: 14,
                    alignItems: "center",
                  }}
                >
                  <SparkDonut
                    value={
                      certificateStats?.issued
                        ? (toNumber(certificateStats?.verified, 0) /
                            Math.max(
                              1,
                              toNumber(certificateStats?.issued, 0),
                            )) *
                          100
                        : 0
                    }
                    label="Verification Rate"
                    dark={dark}
                  />
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                      gap: 12,
                    }}
                  >
                    {[
                      ["Issued", formatCompact(certificateStats?.issued ?? 0)],
                      [
                        "Verified",
                        formatCompact(certificateStats?.verified ?? 0),
                      ],
                      [
                        "Invalid",
                        formatCompact(certificateStats?.invalidAttempts ?? 0),
                      ],
                      [
                        "Today",
                        formatCompact(certificateStats?.todayChecks ?? 0),
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          borderRadius: 16,
                          border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                          background: dark
                            ? "rgba(255,255,255,0.04)"
                            : "rgba(15,23,42,0.02)",
                          padding: 14,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: muted,
                            fontWeight: 800,
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            fontWeight: 950,
                            fontSize: 20,
                          }}
                        >
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <MiniBarChart
                  dark={dark}
                  data={toArray(certificateStats?.topEvents || [])}
                  valueKey="value"
                  labelKey="label"
                  compact
                />
              </SectionCard>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: ".9fr 1.1fr",
                gap: 16,
              }}
            >
              <SectionCard
                title="Quick Actions"
                subtitle="Mass operations and super admin shortcuts"
                dark={dark}
                minHeight={240}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: 12,
                  }}
                >
                  {[
                    {
                      label: "Create Academy",
                      helper: "Open academy master form",
                      onClick: openCreateAcademy,
                    },
                    {
                      label: "Email Settings",
                      helper: "Configure SMTP and sender setup",
                      onClick: () => go("/super-admin/email-settings"),
                    },
                    {
                      label: "Email Logs",
                      helper: "Review sent, failed, and skipped emails",
                      onClick: () => go("/super-admin/email-logs"),
                    },
                    {
                      label: "Email Templates",
                      helper: "Manage reusable template library",
                      onClick: () => go("/super-admin/email-templates"),
                    },
                    {
                      label: "Academy Admins",
                      helper: "Manage academy admin accounts",
                      onClick: () => navigate("/super-admin/admins"),
                    },
                    {
                      label: "Import Participants CSV",
                      helper: "Bulk participant onboarding",
                      onClick: () => navigate("/admin/participants?import=1"),
                    },
                    {
                      label: "Import Enrollments CSV",
                      helper: "Mass event registration",
                      onClick: () => navigate("/admin/enrollments?import=1"),
                    },
                    {
                      label: "Download Sample CSV",
                      helper: "Use the approved import format",
                      onClick: () =>
                        (window.location.href =
                          "/api/admin/participants/sample-csv"),
                    },
                    {
                      label: "Pending Import Reports",
                      helper: "Review rejected rows and errors",
                      onClick: () => navigate("/admin/imports"),
                    },
                    {
                      label: "Create New Event",
                      helper: "Open event configuration",
                      onClick: () => navigate("/admin/events"),
                    },
                    {
                      label: "Manage Certificates",
                      helper: "Issue, verify, and templates",
                      onClick: () => navigate("/admin/certificates"),
                    },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      style={{
                        textAlign: "left",
                        border: `1px solid ${dark ? BORDER_DARK : BORDER_LIGHT}`,
                        borderRadius: 18,
                        padding: 14,
                        background: dark ? "rgba(255,255,255,0.04)" : "#fff",
                        color: textColor,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 900, fontSize: 14 }}>
                        {action.label}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: muted }}>
                        {action.helper}
                      </div>
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="System / Governance Snapshot"
                subtitle="Operational signals useful for a super admin"
                dark={dark}
                minHeight={240}
              >
                <Table
                  dark={dark}
                  rows={[
                    {
                      name: "Active academies",
                      value: formatCompact(
                        summary?.activeAcademies ?? academies.length,
                      ),
                      status: "Healthy",
                    },
                    {
                      name: "Unresolved alerts",
                      value: formatCompact(summary?.openAlerts ?? 0),
                      status:
                        toNumber(summary?.openAlerts ?? 0) > 0
                          ? "Needs review"
                          : "Clear",
                    },
                    {
                      name: "Live events",
                      value: formatCompact(summary?.activeEvents ?? 0),
                      status: "Running",
                    },
                    {
                      name: "Recent certificate failures",
                      value: formatCompact(
                        certificateStats?.failedGenerations ?? 0,
                      ),
                      status:
                        toNumber(certificateStats?.failedGenerations ?? 0) > 0
                          ? "Investigate"
                          : "Clear",
                    },
                    {
                      name: "Pending registrations",
                      value: formatCompact(registrationCounts.PENDING),
                      status:
                        registrationCounts.PENDING > 0
                          ? "Needs review"
                          : "Clear",
                    },
                    {
                      name: "Activated academies from registration",
                      value: formatCompact(registrationCounts.ACTIVATED),
                      status:
                        registrationCounts.ACTIVATED > 0 ? "Healthy" : "Clear",
                    },
                  ]}
                  columns={[
                    { key: "name", label: "Metric" },
                    { key: "value", label: "Value" },
                    {
                      key: "status",
                      label: "Status",
                      render: (r) => (
                        <Pill
                          dark={dark}
                          tone={
                            r.status === "Healthy" ||
                            r.status === "Clear" ||
                            r.status === "Running"
                              ? "success"
                              : r.status === "Needs review" ||
                                  r.status === "Investigate"
                                ? "warn"
                                : "neutral"
                          }
                        >
                          {r.status}
                        </Pill>
                      ),
                    },
                  ]}
                />
              </SectionCard>
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 1180px) {
          div[style*="grid-template-columns: 1.2fr .8fr .8fr"],
          div[style*="grid-template-columns: 1.15fr .85fr"],
          div[style*="grid-template-columns: .95fr 1.05fr 1fr"],
          div[style*="grid-template-columns: .9fr 1.1fr"],
          div[style*="grid-template-columns: repeat(2, minmax(0, 1fr))"],
          div[style*="grid-template-columns: 180px 1fr"],
          div[style*="grid-template-columns: 160px 1fr"],
          div[style*="grid-template-columns: 1fr auto auto auto"] {
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
