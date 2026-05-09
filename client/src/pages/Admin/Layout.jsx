import React from "react";

export default function AdminLayout({ title, onLogout, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb", fontFamily: "system-ui" }}>
      <div style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <button
          onClick={onLogout}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid #eee",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ padding: 18 }}>
        <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 18, padding: 18 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
