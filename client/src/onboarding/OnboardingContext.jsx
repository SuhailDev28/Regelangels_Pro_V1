// client/src/onboarding/OnboardingContext.jsx
import React, { createContext, useContext, useMemo, useState } from "react";
import Joyride, { ACTIONS, EVENTS, STATUS } from "react-joyride";
import { useLocation, useNavigate } from "react-router-dom";
import { TOUR_CONFIG } from "./tours.js";
import {
  getUserOnboardingState,
  patchUserOnboardingState,
  resetUserOnboardingState,
} from "./storage.js";

const OnboardingContext = createContext(null);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasValidTarget(step) {
  if (!step) return false;

  const target = step.target;

  if (!target) return true;
  if (typeof target !== "string") return true;

  try {
    return !!document.querySelector(target);
  } catch {
    return false;
  }
}

export function OnboardingProvider({ children, role, userId }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [tourId, setTourId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [run, setRun] = useState(false);

  const state = useMemo(
    () => getUserOnboardingState({ userId, role }),
    [userId, role, run, tourId, stepIndex],
  );

  const activeTour = tourId ? TOUR_CONFIG[tourId] : null;
  const steps = activeTour?.steps || [];

  async function ensureRouteForStep(idx) {
    const step = steps[idx];
    if (!step?.route) return;

    if (location.pathname !== step.route) {
      navigate(step.route);
      await sleep(500);
    }
  }

  async function waitForStepTarget(idx, tries = 10) {
    const step = steps[idx];
    if (!step) return false;

    if (!step.target || typeof step.target !== "string") return true;

    for (let i = 0; i < tries; i += 1) {
      if (hasValidTarget(step)) return true;
      await sleep(120);
    }

    return false;
  }

  async function startTour(nextTourId, options = {}) {
    const cfg = TOUR_CONFIG[nextTourId];
    if (!cfg) return;

    const startAt = Number.isFinite(options.startAt) ? options.startAt : 0;

    setTourId(nextTourId);
    setStepIndex(startAt);
    setRun(false);

    const firstStep = cfg.steps?.[startAt];

    if (firstStep?.route && location.pathname !== firstStep.route) {
      navigate(firstStep.route);
      await sleep(500);
    } else {
      await sleep(80);
    }

    patchUserOnboardingState({
      userId,
      role,
      patch: {
        lastTourId: nextTourId,
        progress: {
          [nextTourId]: startAt,
        },
      },
    });

    const ok = await waitForStepTarget(startAt, 12);

    if (!ok) {
      setRun(false);
      return;
    }

    setRun(true);
  }

  function stopTour() {
    setRun(false);
  }

  function markTourCompleted(nextTourId) {
    patchUserOnboardingState({
      userId,
      role,
      patch: {
        completedTours: {
          [nextTourId]: true,
        },
        progress: {
          [nextTourId]: 0,
        },
        dismissedTours: {
          [nextTourId]: false,
        },
      },
    });
  }

  function markTourDismissed(nextTourId, idx) {
    patchUserOnboardingState({
      userId,
      role,
      patch: {
        dismissedTours: {
          [nextTourId]: true,
        },
        progress: {
          [nextTourId]: idx || 0,
        },
      },
    });
  }

  function replayTour(nextTourId) {
    return startTour(nextTourId, { startAt: 0 });
  }

  function resetAll() {
    resetUserOnboardingState({ userId, role });
    setRun(false);
    setTourId(null);
    setStepIndex(0);
  }

  async function onJoyrideCallback(data) {
    const { action, index, status, type } = data;

    if (!tourId) return;

    if ([STATUS.FINISHED].includes(status)) {
      markTourCompleted(tourId);
      setRun(false);
      setTourId(null);
      setStepIndex(0);
      return;
    }

    if ([STATUS.SKIPPED].includes(status)) {
      markTourDismissed(tourId, index || 0);
      setRun(false);
      setTourId(null);
      setStepIndex(0);
      return;
    }

    if (type === EVENTS.TARGET_NOT_FOUND) {
      const nextIndex = index + 1;

      if (nextIndex >= steps.length) {
        markTourCompleted(tourId);
        setRun(false);
        setTourId(null);
        setStepIndex(0);
        return;
      }

      patchUserOnboardingState({
        userId,
        role,
        patch: {
          progress: {
            [tourId]: nextIndex,
          },
        },
      });

      await ensureRouteForStep(nextIndex);
      const ok = await waitForStepTarget(nextIndex, 12);

      if (!ok) {
        setRun(false);
        return;
      }

      setStepIndex(nextIndex);
      return;
    }

    if (type === EVENTS.STEP_AFTER) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);

      if (nextIndex >= 0 && nextIndex < steps.length) {
        patchUserOnboardingState({
          userId,
          role,
          patch: {
            progress: {
              [tourId]: nextIndex,
            },
          },
        });

        await ensureRouteForStep(nextIndex);
        const ok = await waitForStepTarget(nextIndex, 12);

        if (!ok) {
          setRun(false);
          return;
        }

        setStepIndex(nextIndex);
      }
    }
  }

  const safeSteps = useMemo(() => {
    return Array.isArray(steps) ? steps.filter(Boolean) : [];
  }, [steps]);

  const value = {
    role,
    userId,
    run,
    tourId,
    stepIndex,
    state,
    activeTour,
    steps: safeSteps,
    startTour,
    stopTour,
    replayTour,
    resetAll,
    markTourCompleted,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}

      {safeSteps.length ? (
        <Joyride
          run={run}
          stepIndex={stepIndex}
          steps={safeSteps}
          callback={onJoyrideCallback}
          continuous
          showProgress
          showSkipButton
          scrollToFirstStep
          disableOverlayClose
          disableScrolling={false}
          styles={{
            options: {
              zIndex: 999999,
              primaryColor: "#e11d2e",
            },
            tooltip: {
              borderRadius: 16,
              fontSize: 14,
            },
            buttonNext: {
              borderRadius: 10,
            },
            buttonBack: {
              borderRadius: 10,
            },
            buttonSkip: {
              borderRadius: 10,
            },
          }}
          locale={{
            back: "Back",
            close: "Close",
            last: "Finish",
            next: "Next",
            skip: "Skip",
          }}
        />
      ) : null}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used inside OnboardingProvider");
  }
  return ctx;
}
