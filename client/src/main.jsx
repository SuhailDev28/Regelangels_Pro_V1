import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PwaPrompt from "./pwa/PwaPrompt";
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  immediate: true,

  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent("ra-pwa:update-ready"));
  },

  onOfflineReady() {
    window.dispatchEvent(new CustomEvent("ra-pwa:offline-ready"));
  },

  onRegistered(registration) {
    window.__ra_pwa_registration = registration || null;
  },

  onRegisterError(error) {
    console.error("PWA service worker registration failed:", error);
  },
});

window.__ra_update_sw = updateSW;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <>
      <App />
      <PwaPrompt />
    </>
  </React.StrictMode>,
);
