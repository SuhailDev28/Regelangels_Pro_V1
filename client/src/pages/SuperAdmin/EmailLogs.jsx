import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, AUTH_EVENT } from "../../lib/api.js";

const RED = "#e11d2e";
const NAVY = "#0f172a";
const BG = "#f8fafc";

const cardStyle = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 24,
  boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
  padding: 20,
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  color: NAVY,
  marginBottom: 8,
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,0.12)",
  outline: "none",
  fontSize: 14,
  background: "#fff",
  boxSizing: "border-box",
};

const buttonStyle = {
  border: "none",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
};

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function toneColor(status = "") {
  const s = String(status || "").toUpperCase();

  if (s === "SENT" || s === "SUCCESS" || s === "DELIVERED") {
    return {
      bg: "rgba(34,197,94,0.12)",
      color: "#166534",
      border: "1px solid rgba(34,197,94,0.18)",
    };
  }

  if (s === "FAILED" || s === "ERROR") {
    return {
      bg: "rgba(239,68,68,0.12)",
      color: "#991b1b",
      border: "1px solid rgba(239,68,68,0.18)",
    };
  }

  if (s === "PENDING" || s === "QUEUED") {
    return {
      bg: "rgba(245,158,11,0.12)",
      color: "#92400e",
      border: "1px solid rgba(245,158,11,0.18)",
    };
  }

  if (s === "SKIPPED") {
    return {
      bg: "rgba(59,130,246,0.12)",
      color: "#1d4ed8",
      border: "1px solid rgba(59,130,246,0.18)",
    };
  }

  return {
    bg: "rgba(100,116,139,0.12)",
    color: "#475569",
    border: "1px solid rgba(100,116,139,0.18)",
  };
}

function StatusPill({ children }) {
  const t = toneColor(children);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: t.bg,
        color: t.color,
        border: t.border,
      }}
    >
      {children || "—"}
    </span>
  );
}

function unwrapLogsResponse(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.logs)) return res.logs;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.rows)) return res.rows;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function buildSummaryFromLogs(rows = []) {
  const summary = {
    total: rows.length,
    sent: 0,
    failed: 0,
    queued: 0,
    pending: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const s = String(row?.status || "").toUpperCase();
    if (s === "SENT" || s === "SUCCESS" || s === "DELIVERED") summary.sent += 1;
    else if (s === "FAILED" || s === "ERROR") summary.failed += 1;
    else if (s === "QUEUED") summary.queued += 1;
    else if (s === "PENDING") summary.pending += 1;
    else if (s === "SKIPPED") summary.skipped += 1;
  }

  return summary;
}

function unwrapSummaryResponse(res, rows = []) {
  const base = res?.stats || res?.summary || res?.data || res || {};
  const fallback = buildSummaryFromLogs(rows);

  return {
    total: Number(base?.total ?? fallback.total ?? 0),
    sent: Number(base?.sent ?? fallback.sent ?? 0),
    failed: Number(base?.failed ?? fallback.failed ?? 0),
    queued: Number(base?.queued ?? fallback.queued ?? 0),
    pending: Number(base?.pending ?? fallback.pending ?? 0),
    skipped: Number(base?.skipped ?? fallback.skipped ?? 0),
  };
}

function toDisplayList(value) {
  if (!value) return "—";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "—";
  return String(value || "").trim() || "—";
}

export default function EmailLogs({ onLogout }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(buildSummaryFromLogs([]));

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [template, setTemplate] = useState("");
  const [limit, setLimit] = useState(20);

  const pageTitle = useMemo(() => "Email Logs", []);

  useEffect(() => {
    function handleAuthRequired() {
      onLogout?.();
    }

    window.addEventListener(AUTH_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_EVENT, handleAuthRequired);
  }, [onLogout]);

  const loadData = useCallback(
    async (soft = false) => {
      try {
        if (soft) setRefreshing(true);
        else setLoading(true);

        setErr("");
        setMsg("");

        const params = {
          limit,
          ...(String(status || "").trim()
            ? { status: String(status).trim().toUpperCase() }
            : {}),
          ...(String(template || "").trim()
            ? { template: String(template).trim() }
            : {}),
          ...(String(search || "").trim()
            ? { search: String(search).trim() }
            : {}),
        };

        const logsRes = await api.getEmailLogs?.(params);
        const rows = unwrapLogsResponse(logsRes);

        let summaryRes = {};
        if (typeof api.getEmailHistorySummary === "function") {
          try {
            summaryRes = await api.getEmailHistorySummary();
          } catch {
            summaryRes = {};
          }
        }

        setLogs(rows);
        setSummary(unwrapSummaryResponse(summaryRes, rows));
      } catch (e) {
        console.error("EMAIL LOGS LOAD ERROR:", e);
        setErr(
          e?.response?.data?.message ||
            e?.message ||
            "Failed to load email logs.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [limit, search, status, template],
  );

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const statCards = useMemo(
    () => [
      ["Total", summary?.total ?? logs.length ?? 0],
      ["Sent", summary?.sent ?? 0],
      ["Failed", summary?.failed ?? 0],
      ["Queued", summary?.queued ?? 0],
      ["Skipped", summary?.skipped ?? 0],
      ["Pending", summary?.pending ?? 0],
    ],
    [summary, logs.length],
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 20,
        background: `linear-gradient(180deg, #fff 0%, #fff8f8 40%, ${BG} 100%)`,
      }}
    >
      <div
        style={{
          maxWidth: 1300,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            ...cardStyle,
            padding: 24,
            background:
              "linear-gradient(135deg, rgba(225,29,46,0.95), rgba(127,29,29,0.95))",
            color: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{pageTitle}</div>
              <div style={{ marginTop: 8, opacity: 0.92, maxWidth: 720 }}>
                Review sent, failed, pending, skipped, and queued emails across
                the platform.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => navigate("/super-admin")}
                style={{
                  ...buttonStyle,
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.22)",
                }}
              >
                Back to Dashboard
              </button>

              {typeof onLogout === "function" ? (
                <button
                  type="button"
                  onClick={() => onLogout()}
                  style={{
                    ...buttonStyle,
                    background: "#fff",
                    color: NAVY,
                  }}
                >
                  Logout
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {err ? (
          <div
            style={{
              ...cardStyle,
              border: "1px solid rgba(225,29,46,0.18)",
              background: "rgba(254,242,242,0.96)",
              color: "#991b1b",
              fontWeight: 700,
            }}
          >
            {err}
          </div>
        ) : null}

        {msg ? (
          <div
            style={{
              ...cardStyle,
              border: "1px solid rgba(34,197,94,0.18)",
              background: "rgba(240,253,244,0.96)",
              color: "#166534",
              fontWeight: 700,
            }}
          >
            {msg}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          {statCards.map(([label, value]) => (
            <div key={label} style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>
                {label}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 28,
                  fontWeight: 900,
                  color: NAVY,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: NAVY,
              marginBottom: 18,
            }}
          >
            Filters
          </div>

          <div className="email-logs-filters-grid">
            <div>
              <label style={labelStyle}>Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipient, subject, message..."
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={inputStyle}
              >
                <option value="">All statuses</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
                <option value="QUEUED">Queued</option>
                <option value="PENDING">Pending</option>
                <option value="SKIPPED">Skipped</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Template</label>
              <input
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="PAYMENT_RECEIVED"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Limit</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={inputStyle}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="email-logs-action-cell">
              <button
                type="button"
                onClick={() => loadData(false)}
                style={{
                  ...buttonStyle,
                  background: RED,
                  color: "#fff",
                  width: "100%",
                }}
              >
                Apply
              </button>
            </div>

            <div className="email-logs-action-cell">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setTemplate("");
                  setLimit(20);
                }}
                style={{
                  ...buttonStyle,
                  background: NAVY,
                  color: "#fff",
                  width: "100%",
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: NAVY,
              }}
            >
              Email Delivery History
            </div>

            <button
              type="button"
              onClick={() => loadData(true)}
              style={{
                ...buttonStyle,
                background: "rgba(15,23,42,0.08)",
                color: NAVY,
              }}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div>Loading email logs...</div>
          ) : logs.length === 0 ? (
            <div
              style={{
                border: "1px dashed rgba(15,23,42,0.12)",
                borderRadius: 18,
                padding: 24,
                textAlign: "center",
                color: "#64748b",
                fontWeight: 600,
              }}
            >
              No email logs found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 1150,
                }}
              >
                <thead>
                  <tr style={{ background: "rgba(15,23,42,0.04)" }}>
                    {[
                      "Status",
                      "Recipient",
                      "Subject",
                      "Template",
                      "Provider",
                      "Created",
                      "Sent At",
                      "Error / Info",
                    ].map((head) => (
                      <th
                        key={head}
                        style={{
                          textAlign: "left",
                          padding: "14px 12px",
                          fontSize: 12,
                          color: "#64748b",
                          fontWeight: 800,
                          borderBottom: "1px solid rgba(15,23,42,0.08)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row, i) => (
                    <tr
                      key={row?._id || row?.id || i}
                      style={{
                        borderBottom: "1px solid rgba(15,23,42,0.06)",
                      }}
                    >
                      <td
                        style={{ padding: "14px 12px", verticalAlign: "top" }}
                      >
                        <StatusPill>{row?.status || "UNKNOWN"}</StatusPill>
                      </td>

                      <td
                        style={{ padding: "14px 12px", verticalAlign: "top" }}
                      >
                        <div style={{ fontWeight: 800, color: NAVY }}>
                          {toDisplayList(row?.to || row?.recipient)}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            marginTop: 4,
                            lineHeight: 1.5,
                          }}
                        >
                          CC: {toDisplayList(row?.cc)}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            marginTop: 2,
                            lineHeight: 1.5,
                          }}
                        >
                          BCC: {toDisplayList(row?.bcc)}
                        </div>
                      </td>

                      <td
                        style={{ padding: "14px 12px", verticalAlign: "top" }}
                      >
                        <div style={{ fontWeight: 700, color: NAVY }}>
                          {row?.subject || "—"}
                        </div>
                      </td>

                      <td
                        style={{ padding: "14px 12px", verticalAlign: "top" }}
                      >
                        <div style={{ color: NAVY }}>
                          {row?.templateName ||
                            row?.templateKey ||
                            row?.template ||
                            "—"}
                        </div>
                      </td>

                      <td
                        style={{ padding: "14px 12px", verticalAlign: "top" }}
                      >
                        <div style={{ color: NAVY }}>
                          {row?.provider || row?.transport || "—"}
                        </div>
                      </td>

                      <td
                        style={{ padding: "14px 12px", verticalAlign: "top" }}
                      >
                        <div style={{ color: NAVY }}>
                          {fmtDate(row?.createdAt)}
                        </div>
                      </td>

                      <td
                        style={{ padding: "14px 12px", verticalAlign: "top" }}
                      >
                        <div style={{ color: NAVY }}>
                          {fmtDate(row?.sentAt)}
                        </div>
                      </td>

                      <td
                        style={{ padding: "14px 12px", verticalAlign: "top" }}
                      >
                        <div
                          style={{
                            maxWidth: 320,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            color: row?.errorMessage ? "#991b1b" : "#475569",
                            fontSize: 13,
                            lineHeight: 1.5,
                          }}
                        >
                          {row?.errorMessage ||
                            row?.message ||
                            row?.responseMessage ||
                            row?.providerMessageId ||
                            "—"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .email-logs-filters-grid{
          display:grid;
          grid-template-columns:minmax(220px,1.2fr) minmax(180px,0.8fr) minmax(200px,1fr) 130px 120px 120px;
          gap:12px;
        }

        .email-logs-action-cell{
          display:flex;
          align-items:end;
        }

        @media (max-width: 1100px) {
          .email-logs-filters-grid{
            grid-template-columns:repeat(2,minmax(220px,1fr));
          }
        }

        @media (max-width: 700px) {
          .email-logs-filters-grid{
            grid-template-columns:1fr;
          }
        }
      `}</style>
    </div>
  );
}
