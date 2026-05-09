// client/src/onboarding/AutoStartOnboarding.jsx

import { useEffect, useRef } from "react";
import { getTourIdForRole } from "./tours.js";
import { useOnboarding } from "./OnboardingContext.jsx";

export default function AutoStartOnboarding() {
  const { role, state, startTour, run, tourId } = useOnboarding();
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const defaultTourId = getTourIdForRole(role);
    if (!defaultTourId) return;

    const completed = !!state?.completedTours?.[defaultTourId];
    if (completed) return;
    if (run || tourId) return;

    const savedIndex = Number(state?.progress?.[defaultTourId] || 0);
    startTour(defaultTourId, { startAt: savedIndex });
  }, [role, run, tourId, state, startTour]);

  return null;
}
