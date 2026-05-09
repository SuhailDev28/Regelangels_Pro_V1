import React, { useCallback, useEffect, useState } from "react";
import { usePwaUpdater } from "./usePwaUpdater";

function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator?.standalone === true;

    if (standalone) {
      setIsInstalled(true);
      setCanInstall(false);
      return;
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
      setCanInstall(true);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice.catch(() => null);

    setDeferredPrompt(null);
    setCanInstall(false);

    return choice?.outcome === "accepted";
  }, [deferredPrompt]);

  return {
    canInstall,
    isInstalled,
    install,
  };
}

export default function PwaPrompt() {
  const { offlineReady, needRefresh, close, refresh } = usePwaUpdater();
  const { canInstall, isInstalled, install } = usePwaInstall();

  const [dismissInstall, setDismissInstall] = useState(false);

  const showInstall = canInstall && !isInstalled && !dismissInstall;
  const showBox = showInstall || offlineReady || needRefresh;

  if (!showBox) return null;

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
        {showInstall && (
          <>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              Install Rebel Angels App
            </div>
            <div style={{ opacity: 0.9, marginBottom: 12, lineHeight: 1.5 }}>
              Add the app to your device for quick access to judging, scoring,
              notifications, and live event dashboards.
            </div>
          </>
        )}

        {offlineReady && !showInstall && (
          <>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              App ready for offline use
            </div>
            <div style={{ opacity: 0.9, marginBottom: 12, lineHeight: 1.5 }}>
              Judge screens and cached pages are now available even with weak
              connectivity.
            </div>
          </>
        )}

        {needRefresh && !showInstall && (
          <>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              New version available
            </div>
            <div style={{ opacity: 0.9, marginBottom: 12, lineHeight: 1.5 }}>
              Refresh to update the installed app.
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => {
              if (showInstall) {
                setDismissInstall(true);
              } else {
                close();
              }
            }}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Close
          </button>

          {showInstall && (
            <button
              type="button"
              onClick={install}
              style={{
                border: 0,
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                background: "#e11d2e",
                color: "#fff",
                fontWeight: 800,
              }}
            >
              Install App
            </button>
          )}

          {needRefresh && !showInstall && (
            <button
              type="button"
              onClick={refresh}
              style={{
                border: 0,
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                background: "#e11d2e",
                color: "#fff",
                fontWeight: 800,
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
