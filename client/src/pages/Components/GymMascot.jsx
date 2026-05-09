import React, { useEffect, useState } from "react";

/**
 * GymMascot.jsx
 * Global animated gymnastics character (CSS animated SVG)
 * - Fixed bottom-right
 * - Non-intrusive (auto hides on very small screens)
 * - Has minimize toggle
 * - Respects light/dark via CSS variables
 */

export default function GymMascot() {
  const [min, setMin] = useState(
    () => localStorage.getItem("ra_mascot_min") === "1",
  );
  const [hide, setHide] = useState(false);

  useEffect(() => {
    localStorage.setItem("ra_mascot_min", min ? "1" : "0");
  }, [min]);

  useEffect(() => {
    // Auto-hide on tiny screens to avoid blocking UI
    function onResize() {
      setHide(window.innerWidth < 420);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (hide) return null;

  return (
    <div
      className={`raMascot ${min ? "raMascotMin" : ""}`}
      aria-label="Gymnastics mascot"
    >
      <style>{styles}</style>

      <button
        className="raMascotToggle"
        type="button"
        onClick={() => setMin((s) => !s)}
        aria-label="Toggle mascot"
      >
        {min ? "＋" : "—"}
      </button>

      <div className="raMascotBubble">
        <div className="raMascotBubbleTitle">Keep going 💪</div>
        <div className="raMascotBubbleSub">Check scores & stay consistent.</div>
      </div>

      <div className="raMascotArt">
        <svg
          width="130"
          height="130"
          viewBox="0 0 130 130"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Shadow */}
          <ellipse cx="62" cy="118" rx="28" ry="9" fill="rgba(0,0,0,0.10)" />

          {/* Hoop (ring) */}
          <g className="raMascotRing">
            <circle
              cx="94"
              cy="38"
              r="18"
              stroke="var(--ra-accent)"
              strokeWidth="6"
              opacity="0.95"
            />
            <circle
              cx="94"
              cy="38"
              r="18"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2"
            />
          </g>

          {/* Body group */}
          <g className="raMascotBody">
            {/* Head */}
            <circle cx="48" cy="40" r="13" fill="var(--ra-skin)" />
            {/* Hair */}
            <path
              d="M36 40c1-9 7-15 15-15 8 0 14 6 14 14-4-4-10-6-15-6-5 0-10 2-14 7Z"
              fill="var(--ra-hair)"
              opacity="0.95"
            />

            {/* Face (tiny) */}
            <circle cx="44" cy="40" r="1.6" fill="rgba(0,0,0,0.55)" />
            <circle cx="52" cy="40" r="1.6" fill="rgba(0,0,0,0.55)" />
            <path
              d="M46.5 45c2.5 2 6.5 2 9 0"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Torso */}
            <path
              d="M40 54c8-6 20-6 28 0 2 1.5 3 4 2.5 6.3l-3.5 15c-.5 2.4-2.6 4-5 4H46c-2.4 0-4.5-1.6-5-4l-3.5-15C37 58 38 55.5 40 54Z"
              fill="var(--ra-suit)"
            />

            {/* Arm (waving) */}
            <g className="raMascotArm">
              <path
                d="M66 56c6-6 13-8 18-7"
                stroke="var(--ra-suit)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M80 48c3 2 5 4 6 7"
                stroke="var(--ra-skin)"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <circle cx="87" cy="57" r="4" fill="var(--ra-skin)" />
            </g>

            {/* Other arm */}
            <path
              d="M44 57c-7 6-12 14-12 22"
              stroke="var(--ra-suit)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <circle cx="32" cy="79" r="4" fill="var(--ra-skin)" />

            {/* Legs (split pose) */}
            <path
              d="M54 78c-2 10-10 18-22 24"
              stroke="var(--ra-suit)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M64 78c3 10 12 18 26 23"
              stroke="var(--ra-suit)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <circle cx="31" cy="103" r="4" fill="var(--ra-skin)" />
            <circle cx="92" cy="101" r="4" fill="var(--ra-skin)" />
          </g>

          {/* Sparkles */}
          <g className="raMascotSpark">
            <path
              d="M104 70l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z"
              fill="rgba(225,29,46,0.25)"
            />
            <path
              d="M16 56l1.5 4.5 4.5 1.5-4.5 1.5L16 68l-1.5-4.5L10 62l4.5-1.5L16 56Z"
              fill="rgba(225,29,46,0.18)"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

const styles = `
  /* Theme variables (works with your light/dark strategy) */
  :root{
    --ra-accent: #e11d2e;
    --ra-card: rgba(255,255,255,0.88);
    --ra-border: rgba(17,24,39,0.10);
    --ra-text: rgba(11,18,32,0.88);
    --ra-muted: rgba(11,18,32,0.65);

    --ra-skin: #f2c8a2;
    --ra-hair: #1f2937;
    --ra-suit: rgba(225,29,46,0.85);
  }

  /* If your app uses a dark wrapper class, this auto adapts */
  .raDark{
    --ra-card: rgba(17,24,39,0.72);
    --ra-border: rgba(255,255,255,0.12);
    --ra-text: rgba(255,255,255,0.92);
    --ra-muted: rgba(255,255,255,0.70);

    --ra-hair: rgba(255,255,255,0.88);
    --ra-suit: rgba(225,29,46,0.65);
  }

  .raMascot{
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 60;
    display: flex;
    align-items: flex-end;
    gap: 10px;
    pointer-events: none; /* important: doesn't block app interactions */
  }

  .raMascotToggle{
    pointer-events: auto;
    width: 38px;
    height: 38px;
    border-radius: 14px;
    border: 1px solid var(--ra-border);
    background: var(--ra-card);
    color: var(--ra-text);
    font-weight: 950;
    cursor: pointer;
    box-shadow: 0 18px 45px rgba(2,8,23,0.15);
  }

  .raMascotBubble{
    pointer-events: none;
    max-width: 220px;
    padding: 10px 12px;
    border-radius: 16px;
    background: var(--ra-card);
    border: 1px solid var(--ra-border);
    box-shadow: 0 18px 45px rgba(2,8,23,0.12);
    backdrop-filter: blur(12px);
    transform: translateY(-10px);
  }
  .raMascotBubbleTitle{
    font-weight: 950;
    font-size: 12px;
    color: var(--ra-text);
  }
  .raMascotBubbleSub{
    margin-top: 2px;
    font-size: 12px;
    color: var(--ra-muted);
    font-weight: 800;
  }

  .raMascotArt{
    pointer-events: none;
    width: 130px;
    height: 130px;
    filter: drop-shadow(0 18px 40px rgba(2,8,23,0.18));
  }

  /* Minimized state */
  .raMascotMin .raMascotBubble{
    display: none;
  }
  .raMascotMin .raMascotArt{
    width: 110px;
    height: 110px;
  }

  /* Animations */
  .raMascotArt svg{
    animation: raFloat 2.8s ease-in-out infinite;
  }

  .raMascotArm{
    transform-origin: 70px 58px;
    animation: raWave 1.4s ease-in-out infinite;
  }

  .raMascotRing{
    transform-origin: 94px 38px;
    animation: raSpin 3.2s linear infinite;
  }

  .raMascotSpark{
    animation: raBlink 1.8s ease-in-out infinite;
  }

  @keyframes raFloat{
    0%,100%{ transform: translateY(0px); }
    50%{ transform: translateY(-7px); }
  }

  @keyframes raWave{
    0%,100%{ transform: rotate(0deg); }
    50%{ transform: rotate(12deg); }
  }

  @keyframes raSpin{
    0%{ transform: rotate(0deg); }
    100%{ transform: rotate(360deg); }
  }

  @keyframes raBlink{
    0%,100%{ opacity: 0.55; transform: scale(0.98); }
    50%{ opacity: 1; transform: scale(1.05); }
  }
`;
