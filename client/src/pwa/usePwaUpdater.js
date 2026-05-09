import { useEffect, useState, useCallback } from "react";

export function usePwaUpdater() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleOfflineReady() {
      setOfflineReady(true);
    }

    function handleNeedRefresh() {
      setNeedRefresh(true);
    }

    window.addEventListener("ra-pwa:offline-ready", handleOfflineReady);
    window.addEventListener("ra-pwa:update-ready", handleNeedRefresh);

    return () => {
      window.removeEventListener("ra-pwa:offline-ready", handleOfflineReady);
      window.removeEventListener("ra-pwa:update-ready", handleNeedRefresh);
    };
  }, []);

  const close = useCallback(() => {
    setOfflineReady(false);
    setNeedRefresh(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (
        typeof window !== "undefined" &&
        typeof window.__ra_update_sw === "function"
      ) {
        await window.__ra_update_sw(true);
        return;
      }
      window.location.reload();
    } catch (err) {
      console.error("PWA update failed:", err);
      window.location.reload();
    }
  }, []);

  return {
    offlineReady,
    needRefresh,
    close,
    refresh,
  };
}

export default usePwaUpdater;
