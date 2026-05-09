// src/pages/Admin/ui.js
export const UI = {
  // Global theme tokens from Settings.jsx
  ACCENT: "var(--ra-accent, #e11d2e)",
  ACCENT_HOVER: "var(--ra-accent-hover, #ef4444)",
  ACCENT_ACTIVE: "var(--ra-accent-active, #be123c)",
  ACCENT_SOFT: "var(--ra-accent-soft, rgba(225,29,46,0.12))",
  ACCENT_SOFTEST: "var(--ra-accent-softest, rgba(225,29,46,0.06))",
  ACCENT_BORDER: "var(--ra-accent-border, rgba(225,29,46,0.24))",
  ACCENT_RING: "var(--ra-accent-ring, rgba(225,29,46,0.16))",
  ACCENT_CONTRAST: "var(--ra-accent-contrast, #ffffff)",

  SURFACE_TINT:
    "var(--ra-surface-tint, linear-gradient(135deg, rgba(225,29,46,0.08), rgba(255,255,255,0.96)))",
  PANEL_BG: "var(--ra-panel-bg, rgba(225,29,46,0.045))",
  CHIP_BG: "var(--ra-chip-bg, rgba(225,29,46,0.10))",
  CHIP_BORDER: "var(--ra-chip-border, rgba(225,29,46,0.20))",
  SELECTION_BG: "var(--ra-selection-bg, rgba(225,29,46,0.16))",

  FONT: "var(--ra-font, system-ui)",

  card: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.88))",
    border: "1px solid rgba(17,24,39,0.08)",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 18px 55px rgba(17,24,39,0.08)",
    backdropFilter: "blur(10px)",
    fontFamily: "var(--ra-font, system-ui)",
  },

  cardTinted: {
    background:
      "var(--ra-surface-tint, linear-gradient(135deg, rgba(225,29,46,0.08), rgba(255,255,255,0.96)))",
    border: "1px solid var(--ra-accent-border, rgba(225,29,46,0.24))",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 18px 55px rgba(17,24,39,0.08)",
    backdropFilter: "blur(10px)",
    fontFamily: "var(--ra-font, system-ui)",
  },

  panel: {
    background: "var(--ra-panel-bg, rgba(225,29,46,0.045))",
    border: "1px solid var(--ra-accent-border, rgba(225,29,46,0.24))",
    borderRadius: 18,
    padding: 14,
    fontFamily: "var(--ra-font, system-ui)",
  },

  h3: {
    margin: 0,
    marginBottom: 10,
    fontWeight: 950,
    fontSize: 16,
    color: "#0f172a",
    fontFamily: "var(--ra-font, system-ui)",
  },

  sub: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
    color: "#475569",
    fontFamily: "var(--ra-font, system-ui)",
  },

  lbl: {
    fontSize: 12,
    opacity: 0.75,
    marginBottom: 6,
    fontWeight: 900,
    color: "#475569",
    fontFamily: "var(--ra-font, system-ui)",
  },

  row: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  col: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
  },

  input: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(17,24,39,0.10)",
    outline: "none",
    background: "rgba(255,255,255,0.95)",
    minWidth: 220,
    fontWeight: 800,
    color: "#0f172a",
    fontFamily: "var(--ra-font, system-ui)",
  },

  inputAccent: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid var(--ra-accent-border, rgba(225,29,46,0.24))",
    outline: "none",
    background: "rgba(255,255,255,0.95)",
    minWidth: 220,
    fontWeight: 800,
    color: "#0f172a",
    boxShadow: "0 0 0 4px transparent",
    fontFamily: "var(--ra-font, system-ui)",
  },

  btnPrimary: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid var(--ra-accent-border, rgba(225,29,46,0.24))",
    background: "var(--ra-chip-bg, rgba(225,29,46,0.10))",
    color: "var(--ra-accent, #e11d2e)",
    cursor: "pointer",
    fontWeight: 950,
    boxShadow: "0 10px 24px var(--ra-accent-soft, rgba(225,29,46,0.12))",
    fontFamily: "var(--ra-font, system-ui)",
  },

  btnPrimarySolid: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid var(--ra-accent, #e11d2e)",
    background: "var(--ra-accent, #e11d2e)",
    color: "var(--ra-accent-contrast, #ffffff)",
    cursor: "pointer",
    fontWeight: 950,
    boxShadow: "0 12px 28px var(--ra-accent-soft, rgba(225,29,46,0.12))",
    fontFamily: "var(--ra-font, system-ui)",
  },

  btnGhost: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(17,24,39,0.12)",
    background: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    color: "#0f172a",
    fontFamily: "var(--ra-font, system-ui)",
  },

  btnAccentGhost: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid var(--ra-accent-border, rgba(225,29,46,0.24))",
    background: "var(--ra-accent-softest, rgba(225,29,46,0.06))",
    color: "var(--ra-accent, #e11d2e)",
    cursor: "pointer",
    fontWeight: 900,
    fontFamily: "var(--ra-font, system-ui)",
  },

  btnDanger: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(239,68,68,0.25)",
    background: "rgba(255,255,255,0.92)",
    color: "#dc2626",
    cursor: "pointer",
    fontWeight: 900,
    fontFamily: "var(--ra-font, system-ui)",
  },

  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid var(--ra-chip-border, rgba(225,29,46,0.20))",
    background: "var(--ra-chip-bg, rgba(225,29,46,0.10))",
    color: "var(--ra-accent, #e11d2e)",
    fontWeight: 900,
    fontSize: 12,
    fontFamily: "var(--ra-font, system-ui)",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid var(--ra-accent-border, rgba(225,29,46,0.24))",
    background: "var(--ra-accent-softest, rgba(225,29,46,0.06))",
    color: "var(--ra-accent, #e11d2e)",
    fontWeight: 900,
    fontSize: 12,
    fontFamily: "var(--ra-font, system-ui)",
  },

  table: {
    border: "1px solid rgba(17,24,39,0.08)",
    borderRadius: 16,
    overflow: "hidden",
    background: "rgba(255,255,255,0.84)",
  },

  thead: {
    display: "grid",
    gap: 10,
    padding: "12px 14px",
    background: "var(--ra-accent-softest, rgba(225,29,46,0.06))",
    borderBottom: "1px solid var(--ra-accent-border, rgba(225,29,46,0.24))",
    fontWeight: 950,
    fontSize: 12,
    opacity: 0.9,
    color: "#334155",
    fontFamily: "var(--ra-font, system-ui)",
  },

  trow: {
    display: "grid",
    gap: 10,
    padding: "12px 14px",
    borderTop: "1px solid rgba(17,24,39,0.06)",
    alignItems: "center",
    background: "rgba(255,255,255,0.82)",
    fontFamily: "var(--ra-font, system-ui)",
  },

  trowSelected: {
    display: "grid",
    gap: 10,
    padding: "12px 14px",
    borderTop: "1px solid var(--ra-accent-border, rgba(225,29,46,0.24))",
    alignItems: "center",
    background: "var(--ra-selection-bg, rgba(225,29,46,0.16))",
    fontFamily: "var(--ra-font, system-ui)",
  },

  divider: {
    height: 1,
    background: "rgba(17,24,39,0.08)",
    margin: "8px 0",
    border: 0,
  },

  ok: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(16,185,129,0.25)",
    background: "rgba(236,253,245,0.95)",
    color: "rgba(6,95,70,0.95)",
    fontWeight: 900,
    fontFamily: "var(--ra-font, system-ui)",
  },

  err: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid var(--ra-accent-border, rgba(225,29,46,0.24))",
    background: "rgba(255,241,242,0.92)",
    color: "var(--ra-accent, #e11d2e)",
    fontWeight: 900,
    fontFamily: "var(--ra-font, system-ui)",
  },

  empty: {
    padding: 14,
    fontSize: 13,
    opacity: 0.7,
    color: "#64748b",
    fontFamily: "var(--ra-font, system-ui)",
  },
};
