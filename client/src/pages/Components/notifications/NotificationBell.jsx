import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../../hooks/useNotifications.js";

const RED = "#e11d2e";
const NAVY = "#0f172a";
const BORDER = "rgba(15,23,42,0.08)";
const SOFT = "rgba(15,23,42,0.06)";
const SHADOW = "0 18px 50px rgba(2, 6, 23, 0.14)";

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
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

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

function NotificationItem({ item, onOpen, onMarkRead, onDelete, busy }) {
  const id = normalizeId(item?._id || item?.id);
  const unread = !isItemRead(item);
  const accent = typeColor(item?.type, item?.category, item?.priority);
  const actionUrl = mapActionUrl(item?.actionUrl);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0,1fr)",
        gap: 12,
        padding: 12,
        border: `1px solid ${unread ? "rgba(225,29,46,0.18)" : BORDER}`,
        background: unread ? "rgba(255,255,255,1)" : "rgba(248,250,252,0.72)",
        borderRadius: 16,
        boxShadow: unread ? "0 10px 22px rgba(225,29,46,0.08)" : "none",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          fontWeight: 900,
          fontSize: 12,
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
          }}
        >
          <div style={{ minWidth: 0 }}>
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
                  fontSize: 14,
                  fontWeight: unread ? 900 : 800,
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

              {["HIGH", "URGENT"].includes(
                normalizeUpper(item?.priority || ""),
              ) ? (
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.3,
                    color: "#991b1b",
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {normalizeUpper(item?.priority || "")}
                </span>
              ) : null}
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "rgba(15,23,42,0.62)",
                fontWeight: 700,
              }}
            >
              {[item?.category, item?.type].filter(Boolean).join(" • ")}
            </div>
          </div>

          <div
            style={{
              fontSize: 11,
              color: "rgba(15,23,42,0.55)",
              whiteSpace: "nowrap",
              marginTop: 2,
            }}
          >
            {formatWhen(item?.createdAt)}
          </div>
        </div>

        {item?.message ? (
          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              lineHeight: 1.5,
              color: "rgba(15,23,42,0.82)",
              wordBreak: "break-word",
            }}
          >
            {item.message}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {!!actionUrl && (
            <button
              type="button"
              onClick={() => onOpen(item)}
              style={{
                border: `1px solid ${SOFT}`,
                background: "#fff",
                color: NAVY,
                borderRadius: 12,
                padding: "8px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Open
              <ArrowRightIcon />
            </button>
          )}

          {unread ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onMarkRead(id)}
              style={{
                border: "1px solid rgba(22,163,74,0.18)",
                background: "rgba(22,163,74,0.08)",
                color: "#166534",
                borderRadius: 12,
                padding: "8px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              <CheckIcon />
              Mark read
            </button>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(id)}
            style={{
              border: "1px solid rgba(239,68,68,0.18)",
              background: "rgba(239,68,68,0.08)",
              color: "#991b1b",
              borderRadius: 12,
              padding: "8px 12px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationBell({
  maxItems = 6,
  panelWidth = 420,
  showViewAll = true,
  onViewAll,
  viewAllPath = "/notifications",
}) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const {
    items,
    notifications,
    unread,
    unreadCount,
    loading,
    busy,
    markRead,
    markAllRead,
    deleteNotification,
    remove,
    loadNotifications,
    loadUnread,
  } = useNotifications();

  const notificationItems = Array.isArray(items)
    ? items
    : Array.isArray(notifications)
      ? notifications
      : [];

  const liveUnread = Number(unreadCount ?? unread ?? 0);

  const previewItems = useMemo(
    () => notificationItems.slice(0, maxItems),
    [notificationItems, maxItems],
  );

  useEffect(() => {
    function handleClickOutside(e) {
      if (!rootRef.current) return;

      if (!rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    loadNotifications?.({ page: 1, limit: maxItems });
    loadUnread?.();
  }, [open, loadNotifications, loadUnread, maxItems]);

  const handleOpenAction = async (item) => {
    const id = normalizeId(item?._id || item?.id);
    const unreadItem = !isItemRead(item);

    if (unreadItem && id) {
      try {
        await markRead?.(id);
      } catch {
        // ignore
      }

      await loadUnread?.();
    }

    setOpen(false);

    const actionUrl = mapActionUrl(item?.actionUrl);
    if (!actionUrl) return;

    if (/^https?:\/\//i.test(actionUrl)) {
      window.open(actionUrl, "_blank", "noopener,noreferrer");
      return;
    }

    navigate(actionUrl);
  };

  const handleMarkRead = async (id) => {
    if (!id) return;

    await markRead?.(id);
    await loadUnread?.();
  };

  const handleDelete = async (id) => {
    if (!id) return;

    const fn = deleteNotification || remove;
    if (typeof fn !== "function") return;

    await fn(id);
    await loadUnread?.();
  };

  const handleMarkAllRead = async () => {
    await markAllRead?.();
    await loadUnread?.();

    if (open) {
      await loadNotifications?.({ page: 1, limit: maxItems });
    }
  };

  const handleViewAll = () => {
    setOpen(false);

    if (typeof onViewAll === "function") {
      onViewAll();
      return;
    }

    navigate(viewAllPath);
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        display: "inline-block",
      }}
    >
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 46,
          height: 46,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          background: "#fff",
          color: NAVY,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
          cursor: "pointer",
          position: "relative",
        }}
      >
        <BellIcon />

        {liveUnread > 0 ? (
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              minWidth: 20,
              height: 20,
              padding: "0 6px",
              borderRadius: 999,
              background: RED,
              color: "#fff",
              fontSize: 11,
              fontWeight: 900,
              display: "grid",
              placeItems: "center",
              lineHeight: 1,
              boxShadow: "0 8px 18px rgba(225,29,46,0.32)",
              border: "2px solid #fff",
            }}
          >
            {liveUnread > 99 ? "99+" : liveUnread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: 56,
            right: 0,
            width: panelWidth,
            maxWidth: "calc(100vw - 24px)",
            background: "rgba(255,255,255,0.98)",
            backdropFilter: "blur(14px)",
            border: `1px solid ${BORDER}`,
            borderRadius: 22,
            boxShadow: SHADOW,
            overflow: "hidden",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              padding: "16px 16px 14px",
              borderBottom: `1px solid ${BORDER}`,
              background:
                "linear-gradient(180deg, rgba(248,250,252,0.95) 0%, rgba(255,255,255,0.95) 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: NAVY,
                  }}
                >
                  Notifications
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "rgba(15,23,42,0.6)",
                    fontWeight: 700,
                  }}
                >
                  {liveUnread > 0
                    ? `${liveUnread} unread notification${
                        liveUnread > 1 ? "s" : ""
                      }`
                    : "You are all caught up"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={busy || liveUnread <= 0}
                  onClick={handleMarkAllRead}
                  style={{
                    border: `1px solid ${SOFT}`,
                    background:
                      liveUnread > 0 ? "#fff" : "rgba(248,250,252,0.9)",
                    color: NAVY,
                    borderRadius: 12,
                    padding: "8px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: busy || liveUnread <= 0 ? "not-allowed" : "pointer",
                    opacity: busy || liveUnread <= 0 ? 0.65 : 1,
                  }}
                >
                  Mark all read
                </button>

                {showViewAll ? (
                  <button
                    type="button"
                    onClick={handleViewAll}
                    style={{
                      border: `1px solid ${RED}22`,
                      background: `${RED}10`,
                      color: RED,
                      borderRadius: 12,
                      padding: "8px 10px",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    View all
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div
            style={{
              maxHeight: 460,
              overflowY: "auto",
              padding: 12,
              background:
                "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.72) 100%)",
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "rgba(15,23,42,0.6)",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Loading notifications...
              </div>
            ) : !previewItems.length ? (
              <div
                style={{
                  padding: 28,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    margin: "0 auto 12px",
                    borderRadius: 18,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(15,23,42,0.05)",
                    color: "rgba(15,23,42,0.55)",
                  }}
                >
                  <BellIcon size={24} />
                </div>

                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    color: NAVY,
                  }}
                >
                  No recent notifications
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "rgba(15,23,42,0.58)",
                    lineHeight: 1.5,
                  }}
                >
                  New alerts, updates, payments, and certificates will appear
                  here.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                {previewItems.map((item) => (
                  <NotificationItem
                    key={item?._id || item?.id}
                    item={item}
                    onOpen={handleOpenAction}
                    onMarkRead={handleMarkRead}
                    onDelete={handleDelete}
                    busy={busy}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
