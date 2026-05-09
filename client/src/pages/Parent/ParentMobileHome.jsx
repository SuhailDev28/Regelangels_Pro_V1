import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  getMedalEmoji,
} from "./parentMobileUtils.js";

const shellStyle = {
  minHeight: "100vh",
  background: "#f3f4f6",
  padding: 14,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 8px 30px rgba(0,0,0,.06)",
  marginBottom: 14,
};

const sectionTitleStyle = {
  fontSize: 18,
  fontWeight: 900,
  marginBottom: 12,
};

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 28,
  height: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
};

function EmptyState({ text }) {
  return (
    <div
      style={{
        color: "#6b7280",
        fontSize: 14,
        padding: "8px 0",
      }}
    >
      {text}
    </div>
  );
}

export default function ParentMobileHome() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [children, setChildren] = useState([]);
  const [events, setEvents] = useState([]);
  const [results, setResults] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      setLoading(true);
      setError("");

      try {
        const [childrenRes, eventsRes, resultsRes, certsRes, paymentsRes] =
          await Promise.all([
            api.get("/parent/children"),
            api.get("/parent/events"),
            api.get("/parent/results"),
            api.get("/parent/certificates"),
            api.get("/parent/payments"),
          ]);

        if (!mounted) return;

        setChildren(
          Array.isArray(childrenRes?.children) ? childrenRes.children : [],
        );
        setEvents(Array.isArray(eventsRes?.events) ? eventsRes.events : []);
        setResults(
          Array.isArray(resultsRes?.results) ? resultsRes.results : [],
        );
        setCertificates(
          Array.isArray(certsRes?.certificates) ? certsRes.certificates : [],
        );
        setPayments(
          Array.isArray(paymentsRes?.payments) ? paymentsRes.payments : [],
        );
      } catch (err) {
        if (mounted)
          setError(err?.message || "Failed to load parent dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAll();

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalChildren = children.length;
    const totalEvents = events.length;
    const totalCertificates = certificates.length;
    const pendingPayments = payments.filter(
      (x) => String(x.status || "").toUpperCase() === "PENDING",
    ).length;

    return {
      totalChildren,
      totalEvents,
      totalCertificates,
      pendingPayments,
    };
  }, [children, events, certificates, payments]);

  if (loading) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            Loading parent dashboard...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#dc2626" }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
          Parent Dashboard
        </div>
        <div style={{ color: "#6b7280", fontSize: 14 }}>
          Mobile overview for children, events, results, certificates, and
          payments.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={cardStyle}>
          <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 6 }}>
            Children
          </div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>
            {stats.totalChildren}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 6 }}>
            Upcoming Events
          </div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>
            {stats.totalEvents}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 6 }}>
            Certificates
          </div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>
            {stats.totalCertificates}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 6 }}>
            Pending Payments
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#e11d2e" }}>
            {stats.pendingPayments}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={sectionTitleStyle}>My Children</div>
        {!children.length ? (
          <EmptyState text="No children linked to this parent account." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {children.map((child) => (
              <div
                key={child._id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {child.name}
                </div>
                <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
                  Academy: {child.academyName || "—"}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                  Group: {child.groupName || "—"}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                  Level: {child.level || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Upcoming Events</div>
        {!events.length ? (
          <EmptyState text="No upcoming enrolled events found." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {events.slice(0, 6).map((event) => (
              <div
                key={
                  event.enrollmentId ||
                  `${event.eventId}_${event.participantId}`
                }
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {event.title}
                </div>
                <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
                  Child: {event.participantName}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                  Date: {formatDate(event.date)}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                  Venue: {event.venue || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Latest Results</div>
        {!results.length ? (
          <EmptyState text="No published results available yet." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {results.slice(0, 8).map((row) => (
              <div
                key={row._id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {row.participantName}
                  </div>
                  <div style={badgeStyle}>
                    {Number(row.total || 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
                  Event: {row.eventTitle}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                  Activity: {row.activityName}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                  Updated: {formatDateTime(row.updatedAt)}
                </div>

                {(row.rank || row.medal) && (
                  <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700 }}>
                    {row.rank ? `Rank #${row.rank}` : ""}
                    {row.rank && row.medal ? " · " : ""}
                    {row.medal
                      ? `${getMedalEmoji(row.medal)} ${row.medal}`
                      : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Certificates</div>
        {!certificates.length ? (
          <EmptyState text="No certificates available yet." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {certificates.slice(0, 8).map((cert) => (
              <div
                key={cert._id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {cert.title}
                </div>
                <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
                  Child: {cert.participantName}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                  Event: {cert.eventTitle || "—"}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                  Issued: {formatDate(cert.issuedAt)}
                </div>

                {cert.pdfUrl ? (
                  <a
                    href={cert.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      textDecoration: "none",
                      background: "#111827",
                      color: "#fff",
                      padding: "10px 14px",
                      borderRadius: 12,
                      fontWeight: 800,
                    }}
                  >
                    Open Certificate
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Payments</div>
        {!payments.length ? (
          <EmptyState text="No payments recorded yet." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {payments.slice(0, 8).map((payment) => (
              <div
                key={payment._id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {formatMoney(payment.amount, payment.currency)}
                  </div>
                  <div
                    style={{
                      ...badgeStyle,
                      background:
                        String(payment.status || "").toUpperCase() === "SUCCESS"
                          ? "#059669"
                          : String(payment.status || "").toUpperCase() ===
                              "FAILED"
                            ? "#dc2626"
                            : "#111827",
                    }}
                  >
                    {payment.status || "PENDING"}
                  </div>
                </div>

                <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
                  Gateway: {payment.gateway || "—"}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                  Date: {formatDate(payment.createdAt)}
                </div>
                <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                  Invoice: {payment.invoiceNo || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
