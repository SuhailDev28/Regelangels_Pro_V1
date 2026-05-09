// client/src/onboarding/HelpLauncher.jsx

import React, { useMemo, useState } from "react";
import { useOnboarding } from "./OnboardingContext.jsx";
import { getTourIdForRole, TOUR_CONFIG } from "./tours.js";

function cardStyle(active = false) {
  return {
    border: active ? "1px solid #e11d2e" : "1px solid rgba(17,24,39,0.08)",
    background: "#fff",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 30px rgba(2,6,23,0.08)",
    marginBottom: 12,
  };
}

export default function HelpLauncher() {
  const [open, setOpen] = useState(false);
  const { role, state, replayTour, resetAll } = useOnboarding();

  const tourId = useMemo(() => getTourIdForRole(role), [role]);
  const config = tourId ? TOUR_CONFIG[tourId] : null;
  const completed = !!state?.completedTours?.[tourId];

  if (!config) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 99999,
          width: 58,
          height: 58,
          border: "none",
          borderRadius: "999px",
          background: "#e11d2e",
          color: "#fff",
          fontWeight: 900,
          fontSize: 20,
          boxShadow: "0 14px 34px rgba(225,29,46,0.35)",
          cursor: "pointer",
        }}
        title="Help & Training"
      >
        ?
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 100000,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(760px, 96vw)",
              maxHeight: "90vh",
              overflow: "auto",
              background: "#f8fafc",
              borderRadius: 24,
              padding: 20,
              boxShadow: "0 22px 60px rgba(2,6,23,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>
                  Help & Training
                </h2>
                <div style={{ marginTop: 6, opacity: 0.7 }}>
                  Role-based onboarding and learning center
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: "1px solid rgba(17,24,39,0.12)",
                  background: "#fff",
                  borderRadius: 12,
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Close
              </button>
            </div>

            <div style={cardStyle(true)}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#e11d2e",
                  marginBottom: 8,
                }}
              >
                PRIMARY TRAINING
              </div>
              <h3 style={{ margin: 0, fontSize: 20 }}>{config.title}</h3>
              <p style={{ marginTop: 8, lineHeight: 1.6, opacity: 0.82 }}>
                {config.description}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    replayTour(tourId);
                    setOpen(false);
                  }}
                  style={{
                    border: "none",
                    background: "#e11d2e",
                    color: "#fff",
                    padding: "12px 16px",
                    borderRadius: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {completed ? "Replay tutorial" : "Start tutorial"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetAll();
                    replayTour(tourId);
                    setOpen(false);
                  }}
                  style={{
                    border: "1px solid rgba(17,24,39,0.12)",
                    background: "#fff",
                    color: "#0f172a",
                    padding: "12px 16px",
                    borderRadius: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Reset onboarding
                </button>
              </div>
            </div>

            <div style={cardStyle()}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#0f172a",
                  marginBottom: 8,
                }}
              >
                TRAINING CHECKLIST
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {(config.steps || []).map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: 12,
                      background: "#fff",
                      borderRadius: 14,
                      border: "1px solid rgba(17,24,39,0.06)",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 28,
                        height: 28,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontWeight: 900,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ lineHeight: 1.55 }}>{step.content}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle()}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#0f172a",
                  marginBottom: 8,
                }}
              >
                STATUS
              </div>
              <div style={{ lineHeight: 1.7 }}>
                <div>
                  <strong>Completed:</strong> {completed ? "Yes" : "No"}
                </div>
                <div>
                  <strong>Saved progress step:</strong>{" "}
                  {(state?.progress?.[tourId] || 0) + 1}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
