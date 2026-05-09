import React, { useEffect, useState } from "react";

export default function PWAInstallButton({
  className = "",
  label = "Install Mobile App",
}) {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setPromptEvent(event);
    }

    function handleInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if (window.matchMedia?.("(display-mode: standalone)")?.matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!promptEvent) return;

    promptEvent.prompt();

    const choice = await promptEvent.userChoice;

    if (choice?.outcome === "accepted") {
      setInstalled(true);
    }

    setPromptEvent(null);
  }

  if (installed || !promptEvent) return null;

  return (
    <button
      type="button"
      onClick={installApp}
      className={className}
      style={{
        border: 0,
        borderRadius: 999,
        padding: "10px 16px",
        fontWeight: 800,
        background: "var(--ra-accent, #e11d2e)",
        color: "#fff",
        cursor: "pointer",
        boxShadow: "0 12px 30px rgba(225,29,46,0.22)",
      }}
    >
      {label}
    </button>
  );
}
