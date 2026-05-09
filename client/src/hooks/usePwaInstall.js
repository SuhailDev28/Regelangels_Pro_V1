import { useCallback, useEffect, useState } from "react";

export function usePwaInstall() {
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

export default usePwaInstall;
