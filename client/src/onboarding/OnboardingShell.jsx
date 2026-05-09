// client/src/onboarding/OnboardingShell.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import { OnboardingProvider } from "./OnboardingContext.jsx";
import AutoStartOnboarding from "./AutoStartOnboarding.jsx";
import HelpLauncher from "./HelpLauncher.jsx";

const ONBOARDING_ENABLED_PATHS = [
  "/super-admin",
  "/admin",
  "/judge",
  "/participant",
  "/parent/dashboard",
];

function shouldEnableOnboarding(pathname = "") {
  const path = String(pathname || "");
  return ONBOARDING_ENABLED_PATHS.some(
    (base) => path === base || path.startsWith(`${base}/`),
  );
}

export default function OnboardingShell({ children, role, userId }) {
  const location = useLocation();

  if (!role) return children;

  // ✅ Prevent onboarding/Joyride from mounting on utility pages
  // like email logs, email settings, email templates, reset password, etc.
  const enabled = shouldEnableOnboarding(location.pathname);

  if (!enabled) {
    return children;
  }

  return (
    <OnboardingProvider role={role} userId={userId}>
      <AutoStartOnboarding />
      {children}
      <HelpLauncher />
    </OnboardingProvider>
  );
}
