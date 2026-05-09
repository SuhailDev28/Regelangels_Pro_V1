export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function formatMoney(amount, currency = "QAR") {
  const num = Number(amount || 0);
  return `${currency} ${num.toFixed(2)}`;
}

export function getMedalEmoji(medal = "") {
  const value = String(medal || "").toUpperCase();
  if (value === "GOLD") return "🥇";
  if (value === "SILVER") return "🥈";
  if (value === "BRONZE") return "🥉";
  return "";
}
