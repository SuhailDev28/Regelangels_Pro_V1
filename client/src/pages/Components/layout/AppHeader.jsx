// client/src/Components/layout/AppHeader.jsx
import React from "react";
import { NotificationsProvider } from "./Components/notifications/NotificationsProvider.jsx";

const RED = "#e11d2e";

export default function AppHeader({
  title = "Dashboard",
  subtitle = "",
  onLogout,
  rightExtras = null,
  logoKey = "ra_admin_logo",
  fallbackLogo = `${import.meta.env.BASE_URL}logo.png`,
}) {
  const logoSrc =
    (typeof localStorage !== "undefined" && localStorage.getItem(logoKey)) ||
    fallbackLogo;

  return (
    <div style={wrap}>
      <div style={left}>
        <div style={logoWrap}>
          <img
            src={logoSrc}
            alt="Logo"
            style={logo}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = fallbackLogo;
            }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={titleStyle}>{title}</div>
          {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
        </div>
      </div>

      <div style={right}>
        <NotificationBell panelWidth={380} maxItems={8} />
        {rightExtras}
        {typeof onLogout === "function" ? (
          <button type="button" style={logoutBtn} onClick={onLogout}>
            Logout
          </button>
        ) : null}
      </div>
    </div>
  );
}

const wrap = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 14,
  position: "relative",
  zIndex: 5,
};

const left = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const right = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const logoWrap = {
  width: 58,
  height: 58,
  borderRadius: 18,
  background: "rgba(255,255,255,0.88)",
  border: "1px solid rgba(17,24,39,0.08)",
  boxShadow: "0 18px 40px rgba(17,24,39,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(10px)",
  flexShrink: 0,
};

const logo = {
  height: 42,
  width: "auto",
};

const titleStyle = {
  fontSize: 24,
  fontWeight: 950,
  lineHeight: 1.1,
  color: "#0f172a",
};

const subtitleStyle = {
  fontSize: 12,
  opacity: 0.72,
  marginTop: 4,
  color: "#334155",
};

const logoutBtn = {
  height: 40,
  padding: "0 14px",
  borderRadius: 14,
  cursor: "pointer",
  fontWeight: 950,
  border: "1px solid rgba(225,29,46,0.30)",
  background: "rgba(225,29,46,0.12)",
  color: RED,
};
