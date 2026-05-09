import React from "react";
import { usePwaUpdater } from "./usePwaUpdater";

export default function PwaPrompt() {
  const { offlineReady, needRefresh, close, refresh } = usePwaUpdater();

  if (!offlineReady && !needRefresh) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          background: "#111827",
          color: "#fff",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 14px 40px rgba(0,0,0,.28)",
        }}
      >
        {offlineReady && (
          <>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              App ready for offline use
            </div>
            <div style={{ opacity: 0.9, marginBottom: 12 }}>
              Judge screens and cached pages are now available even with weak
              connectivity.
            </div>
          </>
        )}

        {needRefresh && (
          <>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              New version available
            </div>
            <div style={{ opacity: 0.9, marginBottom: 12 }}>
              Refresh to update the installed app.
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={close}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            Close
          </button>

          {needRefresh && (
            <button
              onClick={refresh}
              style={{
                border: 0,
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                background: "#e11d2e",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              Update
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
