// client/src/pages/Admin/Notifications.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { UI } from "./ui.js";
import { getEffectiveAcademy } from "../../lib/auth.js";
import { getSocket } from "../../lib/socket.js";

const PAGE_SIZE = 12;

const CATEGORY_OPTIONS = [
  "ALL",
  "MESSAGE",
  "PAYMENT",
  "BOOKING",
  "EVENT",
  "RESULT",
  "CERTIFICATE",
  "ASSIGNMENT",
  "REGISTRATION",
  "SYSTEM",
];

const SEND_CATEGORY_OPTIONS = [
  "MESSAGE",
  "PAYMENT",
  "BOOKING",
  "EVENT",
  "RESULT",
  "CERTIFICATE",
  "ASSIGNMENT",
  "REGISTRATION",
  "SYSTEM",
];

const PRIORITY_OPTIONS = ["ALL", "LOW", "NORMAL", "HIGH", "URGENT"];
const SEND_PRIORITY_OPTIONS = ["LOW", "NORMAL", "HIGH", "URGENT"];
const STATUS_OPTIONS = ["ALL", "UNREAD", "READ"];
const ROLE_OPTIONS = ["ADMIN", "JUDGE", "PARENT", "PARTICIPANT"];

const CATEGORY_BADGE = {
  MESSAGE: { bg: "rgba(59,130,246,0.14)", color: "#2563eb", label: "Message" },
  PAYMENT: { bg: "rgba(16,185,129,0.14)", color: "#059669", label: "Payment" },
  BOOKING: { bg: "rgba(67,56,202,0.14)", color: "#4338ca", label: "Booking" },
  EVENT: { bg: "rgba(245,158,11,0.14)", color: "#d97706", label: "Event" },
  RESULT: { bg: "rgba(139,92,246,0.14)", color: "#7c3aed", label: "Result" },
  CERTIFICATE: {
    bg: "rgba(236,72,153,0.14)",
    color: "#db2777",
    label: "Certificate",
  },
  ASSIGNMENT: {
    bg: "rgba(13,148,136,0.14)",
    color: "#0f766e",
    label: "Assignment",
  },
  REGISTRATION: {
    bg: "rgba(14,116,144,0.14)",
    color: "#0369a1",
    label: "Registration",
  },
  SYSTEM: { bg: "rgba(15,23,42,0.08)", color: "#0f172a", label: "System" },
};

const PRIORITY_BADGE = {
  LOW: { bg: "rgba(100,116,139,0.14)", color: "#475569" },
  NORMAL: { bg: "rgba(15,23,42,0.08)", color: "#0f172a" },
  HIGH: { bg: "rgba(245,158,11,0.16)", color: "#b45309" },
  URGENT: { bg: "rgba(225,29,46,0.16)", color: "#b91c1c" },
};

function useViewport() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440,
  );

  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    width,
    isTablet: width < 1100,
    isMobile: width < 768,
  };
}

function safeDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function relativeTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);

  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return diff < 0 ? `${mins} min ago` : `in ${mins} min`;
  if (hours < 24) return diff < 0 ? `${hours} hr ago` : `in ${hours} hr`;
  return diff < 0
    ? `${days} day${days > 1 ? "s" : ""} ago`
    : `in ${days} day${days > 1 ? "s" : ""}`;
}

function truncate(text, max = 180) {
  const s = String(text || "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function normalizeUpper(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function normalizeBool(v) {
  return v === true;
}

function normalizeNotification(raw, index = 0) {
  const id =
    raw?._id || raw?.id || raw?.notificationId || raw?.uuid || `notif_${index}`;

  const title =
    raw?.title || raw?.subject || raw?.heading || raw?.type || "Notification";

  const message =
    raw?.message ||
    raw?.body ||
    raw?.text ||
    raw?.description ||
    raw?.content ||
    "";

  const category = normalizeUpper(raw?.category || "SYSTEM");
  const priority = normalizeUpper(raw?.priority || "NORMAL");

  const createdAt =
    raw?.createdAt ||
    raw?.timestamp ||
    raw?.date ||
    raw?.sentAt ||
    raw?.updatedAt ||
    null;

  const read =
    raw?.isRead === true ||
    raw?.read === true ||
    raw?.status === "READ" ||
    raw?.seen === true;

  const metadata =
    raw?.metadata || raw?.meta || raw?.payload || raw?.data || {};

  return {
    _raw: raw,
    id: String(id),
    title,
    message,
    type: raw?.type || metadata?.type || "",
    category,
    priority,
    read,
    isRead: read,
    createdAt,
    updatedAt: raw?.updatedAt || null,
    actionUrl: raw?.actionUrl || raw?.link || raw?.url || "",
    actionLabel: raw?.actionLabel || raw?.ctaLabel || "Open",
    recipientRole: raw?.recipientRole || raw?.role || "",
    recipientUserId:
      raw?.recipientUserId?._id ||
      raw?.recipientUserId?.id ||
      raw?.recipientUserId ||
      raw?.userId ||
      "",
    academyId:
      raw?.academyId?._id || raw?.academyId?.id || raw?.academyId || null,
    metadata,
  };
}

function extractNotificationArray(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.notifications)) return res.notifications;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.rows)) return res.rows;
  return [];
}

function parseRecipientIds(text = "") {
  return String(text || "")
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function getAlertIdFromNotification(item) {
  return String(
    item?.metadata?.alertId ||
      item?.metadata?._id ||
      item?.metadata?.id ||
      item?._raw?.alertId ||
      item?._raw?.alert?._id ||
      item?._raw?.alert?.id ||
      "",
  ).trim();
}

function isJudgeHelpNotification(item) {
  const type = normalizeUpper(item?.type || item?.metadata?.type || "");
  const source = String(item?.metadata?.source || "").trim();
  const category = normalizeUpper(item?.category || "");

  return (
    type === "JUDGE_HELP_REQUEST" ||
    type === "HELP_REQUEST" ||
    source === "judge_dashboard_help" ||
    (category === "SYSTEM" && !!getAlertIdFromNotification(item))
  );
}

function createTheme(isDark) {
  return {
    isDark,
    bg: isDark ? "#08111f" : "#f6f8fc",
    surface: isDark ? "#0f172a" : "#ffffff",
    surfaceSoft: isDark ? "#111c31" : "#fbfbfd",
    panel: isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.88)",
    border: isDark
      ? "1px solid rgba(148,163,184,0.16)"
      : "1px solid rgba(15,23,42,0.08)",
    borderSoft: isDark
      ? "1px solid rgba(148,163,184,0.10)"
      : "1px solid rgba(15,23,42,0.06)",
    text: isDark ? "#e5e7eb" : "#0f172a",
    textSoft: isDark ? "rgba(226,232,240,0.78)" : "rgba(15,23,42,0.72)",
    textMuted: isDark ? "rgba(226,232,240,0.56)" : "rgba(15,23,42,0.58)",
    inputBg: isDark ? "rgba(2,6,23,0.55)" : "#fff",
    inputBorder: isDark
      ? "1px solid rgba(148,163,184,0.16)"
      : "1px solid rgba(15,23,42,0.12)",
    primary: UI.RED || "#e11d2e",
    shadow: isDark
      ? "0 20px 50px rgba(2,6,23,0.34)"
      : "0 18px 50px rgba(15,23,42,0.08)",
    hero: isDark
      ? "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.94))"
      : "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,245,246,0.96))",
    successBg: isDark ? "rgba(16,185,129,0.16)" : "rgba(16,185,129,0.10)",
    successText: isDark ? "#bbf7d0" : "#047857",
    errorBg: isDark ? "rgba(225,29,46,0.18)" : "rgba(225,29,46,0.10)",
    errorText: isDark ? "#fecaca" : "#b91c1c",
    modalOverlay: "rgba(2,6,23,0.68)",
  };
}

function makeButtons(theme) {
  const base = {
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "0.18s ease",
  };

  return {
    primary: {
      ...base,
      border: `1px solid ${theme.primary}`,
      background: theme.primary,
      color: "#fff",
    },
    secondary: {
      ...base,
      border: `1px solid ${theme.primary}`,
      background: theme.primary,
      color: "#fff",
    },
    subtle: {
      ...base,
      border: theme.borderSoft,
      background: theme.surfaceSoft,
      color: theme.text,
    },
  };
}

function makeFields(theme) {
  return {
    input: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 14,
      border: theme.inputBorder,
      outline: "none",
      fontSize: 14,
      background: theme.inputBg,
      color: theme.text,
      boxSizing: "border-box",
    },
    select: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 14,
      border: theme.inputBorder,
      outline: "none",
      fontSize: 14,
      background: theme.inputBg,
      color: theme.text,
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%",
      minHeight: 120,
      resize: "vertical",
      padding: "12px 14px",
      borderRadius: 14,
      border: theme.inputBorder,
      outline: "none",
      fontSize: 14,
      background: theme.inputBg,
      color: theme.text,
      fontFamily: "inherit",
      boxSizing: "border-box",
    },
    infoBox: {
      background: theme.surfaceSoft,
      border: theme.border,
      borderRadius: 18,
      padding: 16,
    },
    label: {
      fontSize: 12,
      fontWeight: 800,
      color: theme.textSoft,
      marginBottom: 6,
      display: "block",
    },
  };
}

function IconBell() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function StatCard({ label, value, helper, theme }) {
  return (
    <div
      style={{
        ...UI.card,
        background: theme.surface,
        border: theme.border,
        boxShadow: theme.shadow,
        color: theme.text,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: theme.textSoft, marginTop: 8 }}>
        {helper}
      </div>
    </div>
  );
}

function MiniChip({ active, onClick, children, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        border: active ? `1px solid ${theme.primary}` : theme.borderSoft,
        background: active ? theme.primary : theme.surface,
        color: active ? "#fff" : theme.text,
      }}
    >
      {children}
    </button>
  );
}

function SectionHeader({ title, sub, icon, theme }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: `${theme.primary}14`,
          color: theme.primary,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: theme.text }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: theme.textSoft, marginTop: 4 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function NotificationItem({
  item,
  selected,
  onToggleSelect,
  onOpen,
  onMarkRead,
  onDelete,
  onResolveHelpRequest,
  workingId,
  theme,
  buttons,
  isMobile,
}) {
  const categoryStyle = CATEGORY_BADGE[item.category] || CATEGORY_BADGE.SYSTEM;
  const priorityStyle = PRIORITY_BADGE[item.priority] || PRIORITY_BADGE.NORMAL;
  const busy = workingId === item.id;
  const canResolveHelp = isJudgeHelpNotification(item);

  return (
    <div
      style={{
        ...UI.card,
        background: theme.surface,
        border: item.read ? theme.border : `1px solid ${theme.primary}22`,
        boxShadow: theme.shadow,
        color: theme.text,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "24px 1fr" : "24px 1fr auto",
          gap: 14,
          alignItems: "start",
        }}
      >
        <div style={{ paddingTop: 4 }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(item.id)}
          />
        </div>

        <div>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: theme.text,
                lineHeight: 1.25,
              }}
            >
              {item.title}
            </div>

            <span
              style={{
                background: categoryStyle.bg,
                color: categoryStyle.color,
                fontSize: 11,
                fontWeight: 900,
                padding: "6px 10px",
                borderRadius: 999,
              }}
            >
              {categoryStyle.label}
            </span>

            <span
              style={{
                background: priorityStyle.bg,
                color: priorityStyle.color,
                fontSize: 11,
                fontWeight: 900,
                padding: "6px 10px",
                borderRadius: 999,
              }}
            >
              {item.priority}
            </span>

            <span
              style={{
                background: item.read
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(225,29,46,0.12)",
                color: item.read ? "#059669" : theme.primary,
                fontSize: 11,
                fontWeight: 900,
                padding: "6px 10px",
                borderRadius: 999,
              }}
            >
              {item.read ? "Read" : "Unread"}
            </span>

            {canResolveHelp ? (
              <span
                style={{
                  background: "rgba(245,158,11,0.16)",
                  color: "#b45309",
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "6px 10px",
                  borderRadius: 999,
                }}
              >
                Judge Help
              </span>
            ) : null}
          </div>

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: theme.textSoft,
              whiteSpace: "pre-wrap",
            }}
          >
            {truncate(item.message, 240)}
          </div>

          {isMobile ? (
            <div
              style={{
                marginTop: 10,
                color: theme.textMuted,
                fontSize: 12,
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontWeight: 800, color: theme.text }}>
                {safeDateTime(item.createdAt)}
              </div>
              <div>{relativeTime(item.createdAt)}</div>
              {item.type ? <div>Type: {item.type}</div> : null}
              {item.recipientRole ? (
                <div>Role: {item.recipientRole}</div>
              ) : null}
            </div>
          ) : null}

          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}
          >
            <button
              type="button"
              onClick={() => onOpen(item)}
              style={buttons.primary}
            >
              View Details
            </button>

            {!item.read ? (
              <button
                type="button"
                onClick={() => onMarkRead(item)}
                disabled={busy}
                style={buttons.primary}
              >
                <IconCheck />
                Mark Read
              </button>
            ) : null}

            {canResolveHelp ? (
              <button
                type="button"
                onClick={() => onResolveHelpRequest(item)}
                disabled={busy}
                style={buttons.primary}
              >
                <IconCheck />
                Resolve Help
              </button>
            ) : null}

            {item.actionUrl ? (
              <a
                href={item.actionUrl}
                target="_blank"
                rel="noreferrer"
                style={{ ...buttons.primary, textDecoration: "none" }}
              >
                {item.actionLabel || "Open"}
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => onDelete(item)}
              disabled={busy}
              style={buttons.primary}
            >
              <IconTrash />
              Delete
            </button>
          </div>
        </div>

        {!isMobile ? (
          <div
            style={{
              textAlign: "right",
              minWidth: 150,
              color: theme.textMuted,
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 800, color: theme.text }}>
              {safeDateTime(item.createdAt)}
            </div>
            <div style={{ marginTop: 4 }}>{relativeTime(item.createdAt)}</div>
            {item.type ? (
              <div style={{ marginTop: 6 }}>Type: {item.type}</div>
            ) : null}
            {item.recipientRole ? (
              <div style={{ marginTop: 6 }}>Role: {item.recipientRole}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailsModal({
  item,
  onClose,
  theme,
  buttons,
  fields,
  isMobile,
  onResolveHelpRequest,
}) {
  if (!item) return null;

  const categoryStyle = CATEGORY_BADGE[item.category] || CATEGORY_BADGE.SYSTEM;
  const priorityStyle = PRIORITY_BADGE[item.priority] || PRIORITY_BADGE.NORMAL;
  const canResolveHelp = isJudgeHelpNotification(item);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: theme.modalOverlay,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        padding: isMobile ? 12 : 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(820px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          background: theme.surface,
          borderRadius: 28,
          border: theme.border,
          boxShadow: theme.shadow,
          color: theme.text,
        }}
      >
        <div
          style={{
            padding: 22,
            borderBottom: theme.borderSoft,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{item.title}</div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 10,
              }}
            >
              <span
                style={{
                  background: categoryStyle.bg,
                  color: categoryStyle.color,
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "6px 10px",
                  borderRadius: 999,
                }}
              >
                {categoryStyle.label}
              </span>
              <span
                style={{
                  background: priorityStyle.bg,
                  color: priorityStyle.color,
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "6px 10px",
                  borderRadius: 999,
                }}
              >
                {item.priority}
              </span>
              <span
                style={{
                  background: item.read
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(225,29,46,0.12)",
                  color: item.read ? "#059669" : theme.primary,
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "6px 10px",
                  borderRadius: 999,
                }}
              >
                {item.read ? "Read" : "Unread"}
              </span>
              {canResolveHelp ? (
                <span
                  style={{
                    background: "rgba(245,158,11,0.16)",
                    color: "#b45309",
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "6px 10px",
                    borderRadius: 999,
                  }}
                >
                  Judge Help
                </span>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canResolveHelp ? (
              <button
                type="button"
                onClick={() => onResolveHelpRequest(item)}
                style={buttons.primary}
              >
                <IconCheck />
                Resolve Help
              </button>
            ) : null}
            <button type="button" onClick={onClose} style={buttons.primary}>
              Close
            </button>
          </div>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 16 }}>
          <div style={fields.infoBox}>
            <div
              style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}
            >
              Message
            </div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {item.message || "—"}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "1fr"
                : "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <div style={fields.infoBox}>
              <div
                style={{
                  fontSize: 12,
                  color: theme.textMuted,
                  marginBottom: 6,
                }}
              >
                Created
              </div>
              <div style={{ fontWeight: 800 }}>
                {safeDateTime(item.createdAt)}
              </div>
            </div>
            <div style={fields.infoBox}>
              <div
                style={{
                  fontSize: 12,
                  color: theme.textMuted,
                  marginBottom: 6,
                }}
              >
                Updated
              </div>
              <div style={{ fontWeight: 800 }}>
                {safeDateTime(item.updatedAt)}
              </div>
            </div>
            <div style={fields.infoBox}>
              <div
                style={{
                  fontSize: 12,
                  color: theme.textMuted,
                  marginBottom: 6,
                }}
              >
                Type
              </div>
              <div style={{ fontWeight: 800 }}>{item.type || "—"}</div>
            </div>
            <div style={fields.infoBox}>
              <div
                style={{
                  fontSize: 12,
                  color: theme.textMuted,
                  marginBottom: 6,
                }}
              >
                Recipient Role
              </div>
              <div style={{ fontWeight: 800 }}>{item.recipientRole || "—"}</div>
            </div>
          </div>

          {item.metadata && Object.keys(item.metadata).length ? (
            <div
              style={{
                background: theme.isDark ? "#020617" : "#0f172a",
                color: "#e2e8f0",
                borderRadius: 18,
                padding: 16,
                overflow: "auto",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
                Metadata
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12,
                  lineHeight: 1.6,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                }}
              >
                {JSON.stringify(item.metadata, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------- API HELPERS -------------------- */

async function apiNotifications(params = {}) {
  if (typeof api?.notifications === "function") {
    return await api.notifications(params);
  }
  if (typeof api?.get === "function") {
    return await api.get("/notifications", { params });
  }
  throw new Error("Notifications API not available");
}

async function apiMarkRead(id) {
  if (typeof api?.notificationMarkRead === "function") {
    return await api.notificationMarkRead(id);
  }
  if (typeof api?.markNotificationRead === "function") {
    return await api.markNotificationRead(id);
  }
  if (typeof api?.patch === "function") {
    return await api.patch(`/notifications/${encodeURIComponent(id)}/read`, {});
  }
  if (typeof api?.post === "function") {
    return await api.post(`/notifications/${encodeURIComponent(id)}/read`, {});
  }
  throw new Error("Notification mark read API not available");
}

async function apiMarkAllRead() {
  if (typeof api?.notificationMarkAllRead === "function") {
    return await api.notificationMarkAllRead();
  }
  if (typeof api?.markAllNotificationsRead === "function") {
    return await api.markAllNotificationsRead();
  }
  if (typeof api?.patch === "function") {
    return await api.patch("/notifications/read-all", {});
  }
  if (typeof api?.post === "function") {
    return await api.post("/notifications/read-all", {});
  }
  throw new Error("Notification mark all read API not available");
}

async function apiBulkRead(ids = []) {
  if (typeof api?.notificationBulkRead === "function") {
    return await api.notificationBulkRead(ids);
  }
  if (typeof api?.patch === "function") {
    return await api.patch("/notifications/bulk-read", { ids });
  }
  if (typeof api?.post === "function") {
    return await api.post("/notifications/bulk-read", { ids });
  }
  throw new Error("Notification bulk read API not available");
}

async function apiDeleteNotification(id) {
  if (typeof api?.notificationDelete === "function") {
    return await api.notificationDelete(id);
  }
  if (typeof api?.deleteNotification === "function") {
    return await api.deleteNotification(id);
  }
  if (typeof api?.delete === "function") {
    return await api.delete(`/notifications/${encodeURIComponent(id)}`);
  }
  throw new Error("Notification delete API not available");
}

async function apiAdminSendNotification(payload) {
  if (typeof api?.adminSendNotification === "function") {
    return await api.adminSendNotification(payload);
  }
  if (typeof api?.post === "function") {
    return await api.post("/admin/notifications/send", payload);
  }
  throw new Error("Admin send notification API not available");
}

async function apiAdminBroadcastNotification(payload) {
  if (typeof api?.adminBroadcastNotification === "function") {
    return await api.adminBroadcastNotification(payload);
  }
  if (typeof api?.post === "function") {
    return await api.post("/admin/notifications/broadcast", payload);
  }
  throw new Error("Admin broadcast notification API not available");
}

async function apiResolveJudgeAlert(alertId) {
  if (typeof api?.resolveJudgeAlert === "function") {
    return await api.resolveJudgeAlert(alertId);
  }
  if (typeof api?.resolveAdminAlert === "function") {
    return await api.resolveAdminAlert(alertId);
  }
  if (typeof api?.patch === "function") {
    return await api.patch(
      `/admin/alerts/${encodeURIComponent(alertId)}/resolve`,
      {},
    );
  }
  if (typeof api?.post === "function") {
    return await api.post(
      `/admin/alerts/${encodeURIComponent(alertId)}/resolve`,
      {},
    );
  }
  throw new Error("Resolve judge alert API not available");
}

export default function Notifications() {
  const viewport = useViewport();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailsItem, setDetailsItem] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);

  const [composeMode, setComposeMode] = useState("SEND");
  const [sendForm, setSendForm] = useState({
    recipientEmail: "",
    recipientRole: "PARENT",
    title: "",
    message: "",
    type: "ADMIN_MESSAGE",
    category: "MESSAGE",
    priority: "NORMAL",
    actionUrl: "",
  });

  const [broadcastForm, setBroadcastForm] = useState({
    recipientRole: "PARENT",
    recipientUserIdsText: "",
    title: "",
    message: "",
    type: "ADMIN_BROADCAST",
    category: "MESSAGE",
    priority: "NORMAL",
    actionUrl: "",
    includeSender: false,
    useSpecificUsers: false,
  });

  const academyScope = getEffectiveAcademy?.() || null;
  const academyId =
    academyScope?._id || academyScope?.id || academyScope?.academyId || "";

  const theme = useMemo(() => createTheme(darkMode), [darkMode]);
  const buttons = useMemo(() => makeButtons(theme), [theme]);
  const fields = useMemo(() => makeFields(theme), [theme]);

  const clearFlash = useCallback(() => {
    if (typeof window === "undefined") return;
    window.clearTimeout(window.__adminNotifFlashTimer);
    window.__adminNotifFlashTimer = window.setTimeout(() => {
      setErr("");
      setMsg("");
    }, 2500);
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);

        setErr("");

        const params = academyId ? { academyId } : {};
        const res = await apiNotifications(params);
        const list = extractNotificationArray(res);
        const normalized = list.map((n, i) => normalizeNotification(n, i));

        normalized.sort((a, b) => {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bt - at;
        });

        setItems(normalized);
      } catch (e) {
        console.error(e);
        setErr(
          e?.response?.data?.message ||
            e?.message ||
            "Failed to load notifications.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [academyId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket?.();
    if (!socket?.on) return;

    function refreshIncoming() {
      load({ silent: true });
    }

    try {
      if (academyId && socket.emit) socket.emit("academy:join", { academyId });
    } catch {
      // ignore
    }

    socket.on("notification:new", refreshIncoming);
    socket.on("alert:created", refreshIncoming);
    socket.on("alert:resolved", refreshIncoming);
    socket.on("notification:updated", refreshIncoming);
    socket.on("notification:deleted", refreshIncoming);

    return () => {
      socket.off?.("notification:new", refreshIncoming);
      socket.off?.("alert:created", refreshIncoming);
      socket.off?.("alert:resolved", refreshIncoming);
      socket.off?.("notification:updated", refreshIncoming);
      socket.off?.("notification:deleted", refreshIncoming);
    };
  }, [academyId, load]);

  const filtered = useMemo(() => {
    let arr = [...items];

    if (category !== "ALL") arr = arr.filter((n) => n.category === category);
    if (priority !== "ALL") arr = arr.filter((n) => n.priority === priority);
    if (status === "UNREAD") arr = arr.filter((n) => !n.read);
    if (status === "READ") arr = arr.filter((n) => n.read);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((n) =>
        [
          n.title,
          n.message,
          n.type,
          n.category,
          n.priority,
          n.recipientRole,
          JSON.stringify(n.metadata || {}),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    return arr;
  }, [items, category, priority, status, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search, category, priority, status]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const stats = useMemo(() => {
    const unread = items.filter((n) => !n.read).length;
    const urgent = items.filter((n) => n.priority === "URGENT").length;
    const today = items.filter((n) => {
      if (!n.createdAt) return false;
      const d = new Date(n.createdAt);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    });

    return {
      total: items.length,
      unread,
      urgent,
      today: today.length,
    };
  }, [items]);

  const recipientSpecificCount = useMemo(
    () => parseRecipientIds(broadcastForm.recipientUserIdsText).length,
    [broadcastForm.recipientUserIdsText],
  );

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }, []);

  const toggleSelectPage = useCallback(() => {
    const ids = paged.map((n) => n.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  }, [paged, selectedIds]);

  const handleMarkRead = useCallback(
    async (item) => {
      try {
        setWorkingId(item.id);
        setErr("");
        await apiMarkRead(item.id);
        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id ? { ...n, read: true, isRead: true } : n,
          ),
        );
        setMsg("Notification marked as read.");
        clearFlash();
      } catch (e) {
        console.error(e);
        setErr(
          e?.response?.data?.message || e?.message || "Failed to mark as read.",
        );
        clearFlash();
      } finally {
        setWorkingId("");
      }
    },
    [clearFlash],
  );

  const handleDelete = useCallback(
    async (item) => {
      const ok = window.confirm(`Delete notification "${item.title}"?`);
      if (!ok) return;

      try {
        setWorkingId(item.id);
        setErr("");
        await apiDeleteNotification(item.id);
        setItems((prev) => prev.filter((n) => n.id !== item.id));
        setSelectedIds((prev) => prev.filter((id) => id !== item.id));
        if (detailsItem?.id === item.id) setDetailsItem(null);
        setMsg("Notification deleted.");
        clearFlash();
      } catch (e) {
        console.error(e);
        setErr(
          e?.response?.data?.message ||
            e?.message ||
            "Failed to delete notification.",
        );
        clearFlash();
      } finally {
        setWorkingId("");
      }
    },
    [clearFlash, detailsItem],
  );

  const handleResolveHelpRequest = useCallback(
    async (item) => {
      const alertId = getAlertIdFromNotification(item);

      if (!alertId) {
        setErr("No alert ID found in this notification metadata.");
        clearFlash();
        return;
      }

      const ok = window.confirm("Mark this judge help request as resolved?");
      if (!ok) return;

      try {
        setWorkingId(item.id);
        setErr("");

        await apiResolveJudgeAlert(alertId);

        setItems((prev) =>
          prev.map((n) =>
            n.id === item.id
              ? {
                  ...n,
                  read: true,
                  isRead: true,
                  metadata: {
                    ...(n.metadata || {}),
                    alertStatus: "RESOLVED",
                    resolvedAt: new Date().toISOString(),
                  },
                }
              : n,
          ),
        );

        if (detailsItem?.id === item.id) {
          setDetailsItem((prev) =>
            prev
              ? {
                  ...prev,
                  read: true,
                  isRead: true,
                  metadata: {
                    ...(prev.metadata || {}),
                    alertStatus: "RESOLVED",
                    resolvedAt: new Date().toISOString(),
                  },
                }
              : prev,
          );
        }

        setMsg("Help request resolved.");
        clearFlash();
        await load({ silent: true });
      } catch (e) {
        console.error(e);
        setErr(
          e?.response?.data?.message ||
            e?.message ||
            "Failed to resolve help request.",
        );
        clearFlash();
      } finally {
        setWorkingId("");
      }
    },
    [clearFlash, detailsItem, load],
  );

  const handleMarkAllRead = useCallback(async () => {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (!unreadIds.length) {
      setMsg("No unread notifications.");
      clearFlash();
      return;
    }

    try {
      setBulkBusy(true);
      setErr("");
      await apiMarkAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
      setMsg("All notifications marked as read.");
      clearFlash();
    } catch (e) {
      console.error(e);
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to mark all as read.",
      );
      clearFlash();
    } finally {
      setBulkBusy(false);
    }
  }, [items, clearFlash]);

  const handleBulkMarkRead = useCallback(async () => {
    if (!selectedIds.length) {
      setErr("Select at least one notification.");
      clearFlash();
      return;
    }

    try {
      setBulkBusy(true);
      setErr("");
      await apiBulkRead(selectedIds);
      setItems((prev) =>
        prev.map((n) =>
          selectedIds.includes(n.id) ? { ...n, read: true, isRead: true } : n,
        ),
      );
      setMsg(`Marked ${selectedIds.length} notification(s) as read.`);
      clearFlash();
    } catch (e) {
      console.error(e);
      setErr(
        e?.response?.data?.message || e?.message || "Bulk mark read failed.",
      );
      clearFlash();
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, clearFlash]);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedIds.length) {
      setErr("Select at least one notification.");
      clearFlash();
      return;
    }

    const ok = window.confirm(
      `Delete ${selectedIds.length} selected notification(s)?`,
    );
    if (!ok) return;

    try {
      setBulkBusy(true);
      setErr("");
      await Promise.all(selectedIds.map((id) => apiDeleteNotification(id)));
      setItems((prev) => prev.filter((n) => !selectedIds.includes(n.id)));
      setSelectedIds([]);
      setMsg("Selected notifications deleted.");
      clearFlash();
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || e?.message || "Bulk delete failed.");
      clearFlash();
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, clearFlash]);

  const handleSendNotification = useCallback(async () => {
    if (!sendForm.recipientEmail.trim()) {
      setErr("User Email ID is required.");
      clearFlash();
      return;
    }
    if (!sendForm.title.trim()) {
      setErr("Title is required.");
      clearFlash();
      return;
    }
    if (!sendForm.message.trim()) {
      setErr("Message is required.");
      clearFlash();
      return;
    }

    try {
      setSending(true);
      setErr("");

      const payload = {
        recipientEmail: sendForm.recipientEmail.trim(),
        recipientRole: sendForm.recipientRole,
        title: sendForm.title.trim(),
        message: sendForm.message.trim(),
        type: sendForm.type.trim() || "ADMIN_MESSAGE",
        category: sendForm.category,
        priority: sendForm.priority,
        actionUrl: sendForm.actionUrl.trim(),
        ...(academyId ? { academyId } : {}),
      };

      await apiAdminSendNotification(payload);

      setSendForm((prev) => ({
        ...prev,
        recipientEmail: "",
        title: "",
        message: "",
        actionUrl: "",
      }));

      setMsg("Notification sent successfully.");
      clearFlash();
      await load({ silent: true });
    } catch (e) {
      console.error(e);
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to send notification.",
      );
      clearFlash();
    } finally {
      setSending(false);
    }
  }, [academyId, clearFlash, load, sendForm]);

  const handleBroadcastNotification = useCallback(async () => {
    if (!broadcastForm.title.trim()) {
      setErr("Broadcast title is required.");
      clearFlash();
      return;
    }
    if (!broadcastForm.message.trim()) {
      setErr("Broadcast message is required.");
      clearFlash();
      return;
    }

    const recipientUserIds = broadcastForm.useSpecificUsers
      ? parseRecipientIds(broadcastForm.recipientUserIdsText)
      : [];

    if (broadcastForm.useSpecificUsers && recipientUserIds.length === 0) {
      setErr("Enter at least one recipient user ID for specific users mode.");
      clearFlash();
      return;
    }

    if (!broadcastForm.useSpecificUsers && !broadcastForm.recipientRole) {
      setErr("Recipient role is required.");
      clearFlash();
      return;
    }

    try {
      setSending(true);
      setErr("");

      const payload = {
        title: broadcastForm.title.trim(),
        message: broadcastForm.message.trim(),
        type: broadcastForm.type.trim() || "ADMIN_BROADCAST",
        category: broadcastForm.category,
        priority: broadcastForm.priority,
        actionUrl: broadcastForm.actionUrl.trim(),
        includeSender: normalizeBool(broadcastForm.includeSender),
        ...(academyId ? { academyId } : {}),
        ...(broadcastForm.useSpecificUsers
          ? { recipientUserIds }
          : { recipientRole: broadcastForm.recipientRole }),
      };

      await apiAdminBroadcastNotification(payload);

      setBroadcastForm((prev) => ({
        ...prev,
        recipientUserIdsText: "",
        title: "",
        message: "",
        actionUrl: "",
      }));

      setMsg("Broadcast sent successfully.");
      clearFlash();
      await load({ silent: true });
    } catch (e) {
      console.error(e);
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to broadcast notification.",
      );
      clearFlash();
    } finally {
      setSending(false);
    }
  }, [academyId, broadcastForm, clearFlash, load]);

  const allPageSelected =
    paged.length > 0 && paged.every((item) => selectedIds.includes(item.id));

  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        background: theme.bg,
        padding: 6,
        borderRadius: 20,
      }}
    >
      <div
        style={{
          ...UI.card,
          background: theme.hero,
          border: theme.border,
          boxShadow: theme.shadow,
          overflow: "hidden",
          position: "relative",
          color: theme.text,
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -50,
            top: -50,
            width: 170,
            height: 170,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(225,29,46,0.14), transparent 68%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <SectionHeader
            icon={<IconBell />}
            title="Notifications Center"
            sub="A clean workspace for inbox management, admin messaging, and academy broadcasts."
            theme={theme}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setDarkMode((v) => !v)}
              style={buttons.primary}
            >
              {darkMode ? <IconSun /> : <IconMoon />}
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>

            <button
              type="button"
              onClick={() => load({ silent: true })}
              disabled={refreshing}
              style={buttons.primary}
            >
              <IconRefresh />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={bulkBusy}
              style={buttons.primary}
            >
              <IconCheck />
              Mark All Read
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: viewport.isMobile
            ? "1fr"
            : "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <StatCard
          label="Total Notifications"
          value={stats.total}
          helper="All inbox records"
          theme={theme}
        />
        <StatCard
          label="Unread"
          value={stats.unread}
          helper="Require attention"
          theme={theme}
        />
        <StatCard
          label="Urgent"
          value={stats.urgent}
          helper="High priority items"
          theme={theme}
        />
        <StatCard
          label="Today"
          value={stats.today}
          helper="Created today"
          theme={theme}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: viewport.isTablet
            ? "1fr"
            : "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            ...UI.card,
            background: theme.surface,
            border: theme.border,
            boxShadow: theme.shadow,
            color: theme.text,
            display: "grid",
            gap: 16,
            height: "100%",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <SectionHeader
              icon={<IconSend />}
              title="Compose"
              sub="Send one notification or deliver a broadcast."
              theme={theme}
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <MiniChip
                active={composeMode === "SEND"}
                onClick={() => setComposeMode("SEND")}
                theme={theme}
              >
                Single Send
              </MiniChip>
              <MiniChip
                active={composeMode === "BROADCAST"}
                onClick={() => setComposeMode("BROADCAST")}
                theme={theme}
              >
                Broadcast
              </MiniChip>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              alignContent: "start",
              gap: 12,
              height: "100%",
            }}
          >
            {composeMode === "SEND" ? (
              <>
                <div>
                  <label style={fields.label}>User Email ID</label>
                  <input
                    value={sendForm.recipientEmail}
                    onChange={(e) =>
                      setSendForm((prev) => ({
                        ...prev,
                        recipientEmail: e.target.value,
                      }))
                    }
                    placeholder="Enter user email ID"
                    style={fields.input}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: viewport.isMobile
                      ? "1fr"
                      : "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={fields.label}>Recipient Role</label>
                    <select
                      value={sendForm.recipientRole}
                      onChange={(e) =>
                        setSendForm((prev) => ({
                          ...prev,
                          recipientRole: e.target.value,
                        }))
                      }
                      style={fields.select}
                    >
                      {ROLE_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fields.label}>Category</label>
                    <select
                      value={sendForm.category}
                      onChange={(e) =>
                        setSendForm((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                      style={fields.select}
                    >
                      {SEND_CATEGORY_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fields.label}>Priority</label>
                    <select
                      value={sendForm.priority}
                      onChange={(e) =>
                        setSendForm((prev) => ({
                          ...prev,
                          priority: e.target.value,
                        }))
                      }
                      style={fields.select}
                    >
                      {SEND_PRIORITY_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={fields.label}>Type</label>
                  <input
                    value={sendForm.type}
                    onChange={(e) =>
                      setSendForm((prev) => ({ ...prev, type: e.target.value }))
                    }
                    placeholder="ADMIN_MESSAGE"
                    style={fields.input}
                  />
                </div>

                <div>
                  <label style={fields.label}>Title</label>
                  <input
                    value={sendForm.title}
                    onChange={(e) =>
                      setSendForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Enter notification title"
                    style={fields.input}
                  />
                </div>

                <div>
                  <label style={fields.label}>Message</label>
                  <textarea
                    value={sendForm.message}
                    onChange={(e) =>
                      setSendForm((prev) => ({
                        ...prev,
                        message: e.target.value,
                      }))
                    }
                    placeholder="Write the message to send"
                    style={{ ...fields.textarea, minHeight: 160 }}
                  />
                </div>

                <div>
                  <label style={fields.label}>Action URL (optional)</label>
                  <input
                    value={sendForm.actionUrl}
                    onChange={(e) =>
                      setSendForm((prev) => ({
                        ...prev,
                        actionUrl: e.target.value,
                      }))
                    }
                    placeholder="https://example.com/page"
                    style={fields.input}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "auto",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleSendNotification}
                    disabled={sending}
                    style={buttons.primary}
                  >
                    <IconSend />
                    {sending ? "Sending..." : "Send Notification"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <MiniChip
                    active={!broadcastForm.useSpecificUsers}
                    onClick={() =>
                      setBroadcastForm((prev) => ({
                        ...prev,
                        useSpecificUsers: false,
                      }))
                    }
                    theme={theme}
                  >
                    By Role
                  </MiniChip>
                  <MiniChip
                    active={broadcastForm.useSpecificUsers}
                    onClick={() =>
                      setBroadcastForm((prev) => ({
                        ...prev,
                        useSpecificUsers: true,
                      }))
                    }
                    theme={theme}
                  >
                    Specific Users
                  </MiniChip>
                </div>

                {broadcastForm.useSpecificUsers ? (
                  <div>
                    <label style={fields.label}>
                      Recipient User IDs (comma or new line separated)
                    </label>
                    <textarea
                      value={broadcastForm.recipientUserIdsText}
                      onChange={(e) =>
                        setBroadcastForm((prev) => ({
                          ...prev,
                          recipientUserIdsText: e.target.value,
                        }))
                      }
                      placeholder={"userId1\nuserId2\nuserId3"}
                      style={{ ...fields.textarea, minHeight: 160 }}
                    />
                    <div
                      style={{
                        fontSize: 12,
                        color: theme.textMuted,
                        marginTop: 6,
                      }}
                    >
                      {recipientSpecificCount} recipient ID(s) detected
                    </div>
                  </div>
                ) : (
                  <div>
                    <label style={fields.label}>Recipient Role</label>
                    <select
                      value={broadcastForm.recipientRole}
                      onChange={(e) =>
                        setBroadcastForm((prev) => ({
                          ...prev,
                          recipientRole: e.target.value,
                        }))
                      }
                      style={fields.select}
                    >
                      {ROLE_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: viewport.isMobile
                      ? "1fr"
                      : "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={fields.label}>Category</label>
                    <select
                      value={broadcastForm.category}
                      onChange={(e) =>
                        setBroadcastForm((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                      style={fields.select}
                    >
                      {SEND_CATEGORY_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fields.label}>Priority</label>
                    <select
                      value={broadcastForm.priority}
                      onChange={(e) =>
                        setBroadcastForm((prev) => ({
                          ...prev,
                          priority: e.target.value,
                        }))
                      }
                      style={fields.select}
                    >
                      {SEND_PRIORITY_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fields.label}>Type</label>
                    <input
                      value={broadcastForm.type}
                      onChange={(e) =>
                        setBroadcastForm((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                      placeholder="ADMIN_BROADCAST"
                      style={fields.input}
                    />
                  </div>
                </div>

                <div>
                  <label style={fields.label}>Title</label>
                  <input
                    value={broadcastForm.title}
                    onChange={(e) =>
                      setBroadcastForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Broadcast title"
                    style={fields.input}
                  />
                </div>

                <div>
                  <label style={fields.label}>Message</label>
                  <textarea
                    value={broadcastForm.message}
                    onChange={(e) =>
                      setBroadcastForm((prev) => ({
                        ...prev,
                        message: e.target.value,
                      }))
                    }
                    placeholder="Write the broadcast message"
                    style={{ ...fields.textarea, minHeight: 160 }}
                  />
                </div>

                <div>
                  <label style={fields.label}>Action URL (optional)</label>
                  <input
                    value={broadcastForm.actionUrl}
                    onChange={(e) =>
                      setBroadcastForm((prev) => ({
                        ...prev,
                        actionUrl: e.target.value,
                      }))
                    }
                    placeholder="https://example.com/page"
                    style={fields.input}
                  />
                </div>

                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    color: theme.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={broadcastForm.includeSender}
                    onChange={(e) =>
                      setBroadcastForm((prev) => ({
                        ...prev,
                        includeSender: e.target.checked,
                      }))
                    }
                  />
                  Include myself in this broadcast
                </label>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "auto",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleBroadcastNotification}
                    disabled={sending}
                    style={buttons.primary}
                  >
                    <IconUsers />
                    {sending ? "Sending..." : "Send Broadcast"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            ...UI.card,
            background: theme.surface,
            border: theme.border,
            boxShadow: theme.shadow,
            color: theme.text,
            display: "grid",
            gap: 16,
            height: "100%",
            minHeight: 0,
            alignContent: "start",
          }}
        >
          <SectionHeader
            icon={<IconUsers />}
            title="Scope & Delivery"
            sub="Summary of academy routing and delivery targeting."
            theme={theme}
          />

          <div style={fields.infoBox}>
            <div
              style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}
            >
              Academy Scope
            </div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>
              {academyId || "No academy selected"}
            </div>
          </div>
          <div style={fields.infoBox}>
            <div
              style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}
            >
              Current Mode
            </div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>
              {composeMode === "SEND" ? "Single Send" : "Broadcast"}
            </div>
          </div>
          <div style={fields.infoBox}>
            <div
              style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}
            >
              Recipient Target
            </div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>
              {composeMode === "SEND"
                ? sendForm.recipientRole
                : broadcastForm.useSpecificUsers
                  ? `${recipientSpecificCount} specific user(s)`
                  : broadcastForm.recipientRole}
            </div>
          </div>
          <div style={fields.infoBox}>
            <div
              style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}
            >
              Delivery Type
            </div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>
              {composeMode === "SEND"
                ? sendForm.type || "ADMIN_MESSAGE"
                : broadcastForm.type || "ADMIN_BROADCAST"}
            </div>
          </div>
          <div style={fields.infoBox}>
            <div
              style={{ fontSize: 13, color: theme.textSoft, lineHeight: 1.7 }}
            >
              This panel stays equal height with the compose panel on desktop.
              On smaller screens it stacks below the form automatically.
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          ...UI.card,
          background: theme.surface,
          border: theme.border,
          boxShadow: theme.shadow,
          color: theme.text,
          display: "grid",
          gap: 16,
        }}
      >
        <SectionHeader
          icon={<IconSearch />}
          title="Inbox"
          sub="Search, filter, select, and manage incoming notifications."
          theme={theme}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: viewport.isTablet
              ? "1fr"
              : "minmax(260px, 1.4fr) repeat(3, minmax(150px, 0.7fr))",
            gap: 12,
          }}
        >
          <div style={{ position: "relative", minWidth: 0 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, message, type, metadata..."
              style={{ ...fields.input, padding: "12px 14px 12px 38px" }}
            />
            <div
              style={{
                position: "absolute",
                left: 12,
                top: 12,
                color: theme.textMuted,
              }}
            >
              <IconSearch />
            </div>
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={fields.select}
          >
            {CATEGORY_OPTIONS.map((v) => (
              <option key={v} value={v}>
                Category: {v}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={fields.select}
          >
            {PRIORITY_OPTIONS.map((v) => (
              <option key={v} value={v}>
                Priority: {v}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={fields.select}
          >
            {STATUS_OPTIONS.map((v) => (
              <option key={v} value={v}>
                Status: {v}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <MiniChip
            active={status === "ALL"}
            onClick={() => setStatus("ALL")}
            theme={theme}
          >
            All
          </MiniChip>
          <MiniChip
            active={status === "UNREAD"}
            onClick={() => setStatus("UNREAD")}
            theme={theme}
          >
            Unread
          </MiniChip>
          <MiniChip
            active={status === "READ"}
            onClick={() => setStatus("READ")}
            theme={theme}
          >
            Read
          </MiniChip>
          <MiniChip
            active={priority === "URGENT"}
            onClick={() => setPriority("URGENT")}
            theme={theme}
          >
            Urgent
          </MiniChip>
          <MiniChip
            active={category === "PAYMENT"}
            onClick={() => setCategory("PAYMENT")}
            theme={theme}
          >
            Payments
          </MiniChip>
          <MiniChip
            active={category === "RESULT"}
            onClick={() => setCategory("RESULT")}
            theme={theme}
          >
            Results
          </MiniChip>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: theme.borderSoft,
            paddingTop: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 800,
                color: theme.text,
              }}
            >
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={toggleSelectPage}
              />
              Select this page
            </label>
            <span style={{ fontSize: 12, color: theme.textSoft }}>
              {selectedIds.length} selected
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleBulkMarkRead}
              disabled={bulkBusy || !selectedIds.length}
              style={buttons.primary}
            >
              <IconCheck />
              Mark Selected Read
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkBusy || !selectedIds.length}
              style={buttons.primary}
            >
              <IconTrash />
              Delete Selected
            </button>
          </div>
        </div>

        {err ? (
          <div
            style={{
              background: theme.errorBg,
              color: theme.errorText,
              border: "1px solid rgba(225,29,46,0.18)",
              borderRadius: 14,
              padding: "12px 14px",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {err}
          </div>
        ) : null}
        {msg ? (
          <div
            style={{
              background: theme.successBg,
              color: theme.successText,
              border: "1px solid rgba(16,185,129,0.18)",
              borderRadius: 14,
              padding: "12px 14px",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {msg}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div
          style={{
            ...UI.card,
            textAlign: "center",
            padding: 40,
            background: theme.surface,
            border: theme.border,
            color: theme.text,
            boxShadow: theme.shadow,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            Loading notifications...
          </div>
          <div style={{ fontSize: 13, color: theme.textSoft, marginTop: 8 }}>
            Fetching latest admin alerts
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            ...UI.card,
            textAlign: "center",
            padding: 50,
            background: theme.surface,
            border: theme.border,
            color: theme.text,
            boxShadow: theme.shadow,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            No notifications found
          </div>
          <div style={{ fontSize: 13, color: theme.textSoft, marginTop: 8 }}>
            Try changing filters, sending a new notification, or refreshing the
            page.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {paged.map((item) => (
            <NotificationItem
              key={item.id}
              item={item}
              selected={selectedIds.includes(item.id)}
              onToggleSelect={toggleSelect}
              onOpen={setDetailsItem}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
              onResolveHelpRequest={handleResolveHelpRequest}
              workingId={workingId}
              theme={theme}
              buttons={buttons}
              isMobile={viewport.isMobile}
            />
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <div
          style={{
            ...UI.card,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            background: theme.surface,
            border: theme.border,
            color: theme.text,
            boxShadow: theme.shadow,
          }}
        >
          <div style={{ fontSize: 13, color: theme.textSoft }}>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page === 1}
              style={buttons.primary}
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={buttons.primary}
            >
              Prev
            </button>
            <div
              style={{
                minWidth: 84,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 900,
                color: theme.text,
              }}
            >
              {page} / {totalPages}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={buttons.primary}
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              style={buttons.primary}
            >
              Last
            </button>
          </div>
        </div>
      ) : null}

      <DetailsModal
        item={detailsItem}
        onClose={() => setDetailsItem(null)}
        theme={theme}
        buttons={buttons}
        fields={fields}
        isMobile={viewport.isMobile}
        onResolveHelpRequest={handleResolveHelpRequest}
      />
    </div>
  );
}
