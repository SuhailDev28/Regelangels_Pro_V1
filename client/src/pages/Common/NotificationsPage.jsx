// client/src/pages/Common/NotificationsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../hooks/useNotifications.js";

const RED = "#e11d2e";
const NAVY = "#0f172a";
const BORDER = "rgba(15,23,42,0.08)";
const SOFT = "rgba(15,23,42,0.06)";
const SHADOW = "0 20px 50px rgba(2, 6, 23, 0.08)";
const PAGE_SIZE = 20;

function normalizeUpper(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function normalizeId(v) {
  return String(v || "").trim();
}

function isItemRead(item) {
  return !!(item?.isRead === true || item?.read === true || item?.readAt);
}

function formatWhen(value) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString();
}

function getInitials(text = "") {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");
}

function typeColor(type = "", category = "", priority = "") {
  const t = normalizeUpper(type);
  const c = normalizeUpper(category);
  const p = normalizeUpper(priority);

  if (p === "URGENT" || p === "HIGH") return "#b91c1c";
  if (c === "PAYMENT") return "#166534";
  if (c === "BOOKING") return "#4338ca";
  if (c === "EVENT") return "#1d4ed8";
  if (c === "RESULT") return "#7c3aed";
  if (c === "CERTIFICATE") return "#92400e";
  if (c === "ASSIGNMENT") return "#0f766e";
  if (c === "REGISTRATION") return "#0369a1";
  if (t.includes("ALERT")) return "#b91c1c";

  return RED;
}

function mapActionUrl(url = "") {
  const actionUrl = String(url || "").trim();
  if (!actionUrl) return "";

  if (/^https?:\/\//i.test(actionUrl)) return actionUrl;

  if (actionUrl === "/participant") return "/participant";
  if (actionUrl === "/parent/results") return "/parent/dashboard?tab=results";

  if (actionUrl === "/parent/dashboard?tab=payments") {
    return "/parent/dashboard?tab=payments";
  }

  return actionUrl;
}

function BellIcon({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 18H9M18 16V11C18 7.686 15.314 5 12 5C8.686 5 6 7.686 6 11V16L4.8 17.2C4.17 17.83 4.616 18.9 5.507 18.9H18.493C19.384 18.9 19.83 17.83 19.2 17.2L18 16Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21C13.5542 21.3031 13.3018 21.5553 12.9986 21.7309C12.6954 21.9065 12.3513 21.9993 12.001 22C11.6508 22.0007 11.3062 21.9091 11.0023 21.7347C10.6984 21.5604 10.445 21.3092 10.2681 21.0068"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17L4 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6H21M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19V6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11V17M14 11V17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowRightIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12H19M19 12L13 6M19 12L13 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m20 20-4.2-4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RefreshIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12a9 9 0 1 1-2.64-6.36"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M21 3v6h-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 34,
        textAlign: "center",
        borderRadius: 24,
        border: `1px dashed ${BORDER}`,
        background: "rgba(255,255,255,0.75)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 14px",
          borderRadius: 18,
          display: "grid",
          placeItems: "center",
          background: "rgba(15,23,42,0.05)",
          color: "rgba(15,23,42,0.55)",
        }}
      >
        <BellIcon size={28} />
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: NAVY,
        }}
      >
        No notifications found
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 13,
          color: "rgba(15,23,42,0.58)",
          lineHeight: 1.6,
        }}
      >
        New alerts, payments, results, bookings, and certificates will appear
        here.
      </div>
    </div>
  );
}

function btnStyle(kind = "default", busy = false) {
  const styles = {
    default: {
      border: `1px solid ${SOFT}`,
      background: "#fff",
      color: NAVY,
    },
    success: {
      border: "1px solid rgba(22,163,74,0.18)",
      background: "rgba(22,163,74,0.08)",
      color: "#166534",
    },
    danger: {
      border: "1px solid rgba(239,68,68,0.18)",
      background: "rgba(239,68,68,0.08)",
      color: "#991b1b",
    },
  };

  return {
    ...styles[kind],
    borderRadius: 12,
    padding: "9px 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 900,
    cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.7 : 1,
  };
}

function NotificationCard({
  item,
  busy,
  onOpen,
  onMarkRead,
  onDelete,
  compact = false,
}) {
  const id = item?._id || item?.id;
  const unread = !isItemRead(item);
  const accent = typeColor(item?.type, item?.category, item?.priority);
  const priority = normalizeUpper(item?.priority);
  const actionUrl = mapActionUrl(item?.actionUrl);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact
          ? "44px minmax(0,1fr)"
          : "56px minmax(0,1fr)",
        gap: compact ? 12 : 16,
        padding: compact ? 14 : 18,
        border: `1px solid ${unread ? "rgba(225,29,46,0.18)" : BORDER}`,
        background: unread ? "#fff" : "rgba(248,250,252,0.9)",
        borderRadius: 20,
        boxShadow: unread ? "0 12px 24px rgba(225,29,46,0.07)" : "none",
      }}
    >
      <div
        style={{
          width: compact ? 44 : 56,
          height: compact ? 44 : 56,
          borderRadius: compact ? 14 : 18,
          display: "grid",
          placeItems: "center",
          fontWeight: 900,
          fontSize: compact ? 12 : 14,
          color: accent,
          background: `${accent}12`,
          border: `1px solid ${accent}25`,
          userSelect: "none",
        }}
      >
        {getInitials(item?.category || item?.type || "N")}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: compact ? 15 : 16,
                  fontWeight: unread ? 950 : 900,
                  color: NAVY,
                  lineHeight: 1.3,
                }}
              >
                {item?.title || "Notification"}
              </div>

              {unread ? (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: RED,
                    flex: "0 0 auto",
                  }}
                />
              ) : null}

              {["HIGH", "URGENT"].includes(priority) ? (
                <span
                  style={{
                    padding: "4px 9px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.3,
                    color: "#991b1b",
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {priority}
                </span>
              ) : null}
            </div>

            <div
              style={{
                marginTop: 7,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(15,23,42,0.62)",
                  fontWeight: 900,
                  padding: "5px 9px",
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.05)",
                  border: `1px solid ${BORDER}`,
                }}
              >
                {normalizeUpper(item?.category || "SYSTEM")}
              </span>

              <span
                style={{
                  fontSize: 11,
                  color: "rgba(15,23,42,0.62)",
                  fontWeight: 800,
                }}
              >
                {normalizeUpper(item?.type || "NOTICE")}
              </span>
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "rgba(15,23,42,0.55)",
              whiteSpace: "nowrap",
              marginTop: 2,
              fontWeight: 700,
            }}
          >
            {formatWhen(item?.createdAt)}
          </div>
        </div>

        {item?.message ? (
          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(15,23,42,0.82)",
              wordBreak: "break-word",
            }}
          >
            {item.message}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {!!actionUrl && (
            <button
              type="button"
              onClick={() => onOpen(item)}
              style={btnStyle("default")}
            >
              Open
              <ArrowRightIcon />
            </button>
          )}

          {unread && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onMarkRead(id)}
              style={btnStyle("success", busy)}
            >
              <CheckIcon />
              Mark read
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(id)}
            style={btnStyle("danger", busy)}
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryBox({ label, value, tone = "red" }) {
  const tones = {
    red: {
      bg: "linear-gradient(180deg, #fff5f5, #fff)",
      color: "#b91c1c",
      border: "rgba(225,29,46,0.15)",
    },
    green: {
      bg: "linear-gradient(180deg, #f0fdf4, #fff)",
      color: "#166534",
      border: "rgba(22,163,74,0.15)",
    },
    blue: {
      bg: "linear-gradient(180deg, #eff6ff, #fff)",
      color: "#1d4ed8",
      border: "rgba(59,130,246,0.15)",
    },
    navy: {
      bg: "linear-gradient(180deg, #f8fafc, #fff)",
      color: NAVY,
      border: "rgba(15,23,42,0.12)",
    },
    purple: {
      bg: "linear-gradient(180deg, #f5f3ff, #fff)",
      color: "#7c3aed",
      border: "rgba(124,58,237,0.15)",
    },
    amber: {
      bg: "linear-gradient(180deg, #fffbeb, #fff)",
      color: "#92400e",
      border: "rgba(245,158,11,0.15)",
    },
  };

  const current = tones[tone] || tones.red;

  return (
    <div
      style={{
        minHeight: 108,
        borderRadius: 22,
        padding: 18,
        border: `1px solid ${current.border}`,
        background: current.bg,
        boxShadow: "0 10px 24px rgba(2,8,23,.04)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "rgba(15,23,42,0.64)",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 34,
          lineHeight: 1,
          fontWeight: 950,
          color: current.color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();

  const {
    items,
    notifications,
    unread,
    unreadCount,
    total,
    loading,
    busy,
    page,
    pages,
    loadNotifications,
    loadUnread,
    markRead,
    markAllRead,
    deleteNotification,
    remove,
  } = useNotifications();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pageInput, setPageInput] = useState(1);

  const safeItems = useMemo(() => {
    if (Array.isArray(items)) return items;
    if (Array.isArray(notifications)) return notifications;
    return [];
  }, [items, notifications]);

  const liveUnread = Number(unreadCount ?? unread ?? 0);
  const livePage = Number(page || 1);
  const livePages = Number(pages || 1);
  const liveTotal = Number(total || 0);

  useEffect(() => {
    setPageInput(livePage || 1);
  }, [livePage]);

  const currentFilters = useMemo(
    () => ({
      q: query,
      search: query,
      category,
      isRead: unreadOnly ? false : undefined,
      page: livePage || 1,
      limit: PAGE_SIZE,
    }),
    [query, category, unreadOnly, livePage],
  );

  useEffect(() => {
    loadNotifications?.({
      page: 1,
      limit: PAGE_SIZE,
      q: "",
      search: "",
      category: "",
      isRead: undefined,
    });

    loadUnread?.();
  }, [loadNotifications, loadUnread]);

  const summary = useMemo(() => {
    const counts = {
      PAYMENT: 0,
      BOOKING: 0,
      EVENT: 0,
      RESULT: 0,
      CERTIFICATE: 0,
      SYSTEM: 0,
    };

    for (const item of safeItems) {
      const c = normalizeUpper(item?.category || "SYSTEM");

      if (counts[c] !== undefined) {
        counts[c] += 1;
      } else {
        counts.SYSTEM += 1;
      }
    }

    return counts;
  }, [safeItems]);

  async function applyFilters(nextPage = 1) {
    await loadNotifications?.({
      page: nextPage,
      limit: PAGE_SIZE,
      q: query,
      search: query,
      category,
      isRead: unreadOnly ? false : undefined,
    });
  }

  async function handleSearchSubmit(e) {
    e.preventDefault();
    await applyFilters(1);
  }

  async function handleRefresh() {
    await loadNotifications?.({
      ...currentFilters,
      page: livePage || 1,
    });

    await loadUnread?.();
  }

  async function handleMarkAllRead() {
    await markAllRead?.();
    await applyFilters(livePage || 1);
    await loadUnread?.();
  }

  async function handleMarkRead(id) {
    if (!id) return;

    await markRead?.(id);
    await loadUnread?.();
  }

  async function handleDelete(id) {
    if (!id) return;

    const fn = deleteNotification || remove;
    if (typeof fn !== "function") return;

    await fn(id);
    await loadUnread?.();

    const shouldGoPrevPage =
      safeItems.length === 1 && livePage > 1 && liveTotal > 1;

    await applyFilters(shouldGoPrevPage ? livePage - 1 : livePage || 1);
  }

  async function handleOpen(item) {
    const id = normalizeId(item?._id || item?.id);
    const read = isItemRead(item);

    if (!read && id) {
      try {
        await markRead?.(id);
      } catch {
        // ignore
      }

      await loadUnread?.();
    }

    const actionUrl = mapActionUrl(item?.actionUrl);
    if (!actionUrl) return;

    if (/^https?:\/\//i.test(actionUrl)) {
      window.open(actionUrl, "_blank", "noopener,noreferrer");
      return;
    }

    navigate(actionUrl);
  }

  return (
    <section style={styles.page}>
      <StyleTag />

      <div style={styles.shell}>
        <div style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>
              <BellIcon size={14} />
              NOTIFICATION CENTER
            </div>

            <h1 style={styles.title}>Notifications</h1>

            <div style={styles.sub}>
              Unified inbox for payments, bookings, results, certificates, event
              updates, and system alerts.
            </div>

            <div style={styles.badgeRow}>
              <span style={styles.badge}>Unread: {liveUnread}</span>
              <span style={styles.badge}>Total: {liveTotal}</span>
              <span style={styles.badge}>Page: {livePage}</span>
            </div>
          </div>

          <div style={styles.heroActions}>
            <button
              type="button"
              onClick={handleRefresh}
              style={styles.topBtn}
              disabled={loading}
            >
              <RefreshIcon size={14} />
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={handleMarkAllRead}
              style={{
                ...styles.topBtn,
                ...styles.topBtnSoftRed,
                opacity: busy || liveUnread <= 0 ? 0.65 : 1,
                cursor: busy || liveUnread <= 0 ? "not-allowed" : "pointer",
              }}
              disabled={busy || liveUnread <= 0}
            >
              <CheckIcon size={14} />
              Mark all read
            </button>
          </div>
        </div>

        <div style={styles.summaryGrid}>
          <SummaryBox label="Payments" value={summary.PAYMENT} tone="green" />
          <SummaryBox label="Bookings" value={summary.BOOKING} tone="blue" />
          <SummaryBox label="Events" value={summary.EVENT} tone="navy" />
          <SummaryBox label="Results" value={summary.RESULT} tone="purple" />
          <SummaryBox
            label="Certificates"
            value={summary.CERTIFICATE}
            tone="amber"
          />
          <SummaryBox label="System" value={summary.SYSTEM} tone="red" />
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="np-toolbar"
          style={styles.toolbar}
        >
          <div style={styles.searchWrap}>
            <SearchIcon size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, message, or type..."
              style={styles.searchInput}
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={styles.select}
          >
            <option value="">All Categories</option>
            <option value="PAYMENT">Payment</option>
            <option value="BOOKING">Booking</option>
            <option value="EVENT">Event</option>
            <option value="RESULT">Result</option>
            <option value="CERTIFICATE">Certificate</option>
            <option value="ASSIGNMENT">Assignment</option>
            <option value="REGISTRATION">Registration</option>
            <option value="SYSTEM">System</option>
          </select>

          <label style={styles.checkboxWrap}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            Unread only
          </label>

          <button type="submit" style={styles.topBtn}>
            Apply
          </button>
        </form>

        <div style={styles.listCard}>
          {loading ? (
            <div style={styles.loadingBox}>Loading notifications...</div>
          ) : !safeItems.length ? (
            <EmptyState />
          ) : (
            <div style={styles.list}>
              {safeItems.map((item) => (
                <NotificationCard
                  key={item?._id || item?.id}
                  item={item}
                  onOpen={handleOpen}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                  busy={busy}
                />
              ))}
            </div>
          )}
        </div>

        <div style={styles.pagination}>
          <button
            type="button"
            onClick={() => applyFilters(Math.max(livePage - 1, 1))}
            disabled={loading || livePage <= 1}
            style={{
              ...styles.pageBtn,
              opacity: loading || livePage <= 1 ? 0.6 : 1,
              cursor: loading || livePage <= 1 ? "not-allowed" : "pointer",
            }}
          >
            Prev
          </button>

          <div style={styles.pageInfo}>
            <span>
              Page <b>{livePage}</b> of <b>{livePages}</b>
            </span>

            <div style={styles.pageJump}>
              <input
                type="number"
                min={1}
                max={livePages || 1}
                value={pageInput}
                onChange={(e) => setPageInput(Number(e.target.value || 1))}
                style={styles.pageInput}
              />

              <button
                type="button"
                style={styles.pageBtn}
                onClick={() => {
                  const next = Math.max(
                    1,
                    Math.min(Number(pageInput || 1), livePages || 1),
                  );

                  applyFilters(next);
                }}
              >
                Go
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => applyFilters(Math.min(livePage + 1, livePages))}
            disabled={loading || livePage >= livePages}
            style={{
              ...styles.pageBtn,
              opacity: loading || livePage >= livePages ? 0.6 : 1,
              cursor:
                loading || livePage >= livePages ? "not-allowed" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(255,241,242,.9), transparent 28%), linear-gradient(180deg, #f8fafc 0%, #f5f7fb 100%)",
    padding: 16,
  },
  shell: {
    maxWidth: 1440,
    margin: "0 auto",
    display: "grid",
    gap: 16,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: 16,
    flexWrap: "wrap",
    padding: 22,
    borderRadius: 28,
    border: `1px solid ${BORDER}`,
    background:
      "linear-gradient(180deg, rgba(255,255,255,.96), rgba(250,250,252,.98))",
    boxShadow: SHADOW,
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 30,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(225,29,46,0.18)",
    background: "#fff5f5",
    color: RED,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: ".08em",
  },
  title: {
    margin: "12px 0 0",
    fontSize: 36,
    lineHeight: 1.02,
    fontWeight: 950,
    color: NAVY,
  },
  sub: {
    marginTop: 10,
    fontSize: 15,
    color: "#64748b",
    fontWeight: 700,
    lineHeight: 1.6,
    maxWidth: 900,
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  badge: {
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 900,
    color: "#475569",
  },
  heroActions: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  topBtn: {
    height: 42,
    padding: "0 16px",
    borderRadius: 14,
    border: `1px solid ${BORDER}`,
    background: "#fff",
    color: NAVY,
    cursor: "pointer",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  topBtnSoftRed: {
    background: "#fff5f5",
    color: RED,
    borderColor: "rgba(225,29,46,.16)",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },
  toolbar: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 220px 160px 110px",
    gap: 12,
    alignItems: "center",
  },
  searchWrap: {
    minHeight: 52,
    borderRadius: 18,
    border: `1px solid ${BORDER}`,
    background: "#fff",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
  },
  searchInput: {
    width: "100%",
    border: "none",
    background: "transparent",
    outline: "none",
    color: NAVY,
    fontSize: 14,
    fontWeight: 800,
  },
  select: {
    minHeight: 52,
    borderRadius: 18,
    border: `1px solid ${BORDER}`,
    background: "#fff",
    padding: "0 14px",
    fontSize: 14,
    fontWeight: 900,
    color: NAVY,
    outline: "none",
  },
  checkboxWrap: {
    minHeight: 52,
    borderRadius: 18,
    border: `1px solid ${BORDER}`,
    background: "#fff",
    padding: "0 14px",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    fontWeight: 800,
    color: NAVY,
  },
  listCard: {
    borderRadius: 26,
    border: `1px solid ${BORDER}`,
    background:
      "linear-gradient(180deg, rgba(255,255,255,.96), rgba(250,250,252,.98))",
    boxShadow: SHADOW,
    padding: 18,
  },
  list: {
    display: "grid",
    gap: 12,
  },
  loadingBox: {
    minHeight: 220,
    display: "grid",
    placeItems: "center",
    color: "#64748b",
    fontWeight: 900,
    fontSize: 15,
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "4px 2px 10px",
  },
  pageBtn: {
    minHeight: 42,
    padding: "0 14px",
    borderRadius: 14,
    border: `1px solid ${BORDER}`,
    background: "#fff",
    color: NAVY,
    fontWeight: 900,
    cursor: "pointer",
  },
  pageInfo: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    color: NAVY,
    fontWeight: 800,
  },
  pageJump: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  pageInput: {
    width: 72,
    minHeight: 42,
    borderRadius: 14,
    border: `1px solid ${BORDER}`,
    background: "#fff",
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 800,
    color: NAVY,
    outline: "none",
  },
};

function StyleTag() {
  return (
    <style>{`
      .np-toolbar {
        grid-template-columns: minmax(0,1fr) 220px 160px 110px;
      }

      @media (max-width: 900px) {
        .np-toolbar {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
  );
}
