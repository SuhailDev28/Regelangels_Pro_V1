import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import {
  getUser,
  isSuperAdmin,
  getEffectiveAcademy,
  getSelectedAcademy,
  setSelectedAcademy,
} from "../../lib/auth.js";

const PAGE_SIZE = 12;
const RED = "var(--ra-accent, #e11d2e)";
const NAVY = "#0f172a";

const STATUS_OPTIONS = [
  "ALL",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
];

const METHOD_OPTIONS = ["ALL", "CASH", "ONLINE"];

function money(v, currency = "QAR") {
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currency || "QAR").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${String(currency || "QAR").toUpperCase()} ${n.toFixed(2)}`;
  }
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

function fmtDateOnly(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleDateString();
  } catch {
    return String(v);
  }
}

function normalizeList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.rows)) return res.rows;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function normalizeEvents(res) {
  const list = normalizeList(res);
  return list.map((e) => ({
    id: String(e?._id || e?.id || ""),
    name: e?.name || e?.title || "Untitled Event",
    code: e?.code || "",
    status: e?.status || "",
    registrationFee: Number(e?.registrationFee || 0),
    currency: String(e?.currency || "QAR").toUpperCase(),
  }));
}

function normalizeAcademies(res) {
  const list = normalizeList(res);
  return list.map((a) => ({
    id: String(a?._id || a?.id || ""),
    name: a?.name || a?.academyName || a?.title || "Unnamed Academy",
    code: a?.code || a?.academyCode || "",
    logo:
      a?.logo ||
      a?.logoUrl ||
      a?.image ||
      a?.imageUrl ||
      a?.brandLogo ||
      a?.academyLogo ||
      "",
  }));
}

function getId(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return String(v._id || v.id || "");
}

function getNameFromMaybeUser(v) {
  if (!v) return "";
  return v.name || v.fullName || v.email || "";
}

function getParticipantName(row) {
  return (
    row?.participantId?.name ||
    row?.participantId?.userId?.name ||
    row?.participantName ||
    row?.userId?.name ||
    "—"
  );
}

function getParticipantBib(row) {
  return row?.participantId?.bibNo || row?.bibNo || "—";
}

function getParticipantEmail(row) {
  return (
    row?.participantId?.userId?.email ||
    row?.participantId?.email ||
    row?.userId?.email ||
    row?.email ||
    "No email"
  );
}

function getEventName(row) {
  return row?.eventId?.name || row?.eventName || "—";
}

function getEventCode(row) {
  return row?.eventId?.code || row?.eventCode || "—";
}

function getEventStatus(row) {
  return row?.eventId?.status || row?.eventStatus || "—";
}

function getAcademyName(row) {
  return row?.academyId?.name || row?.academyName || "—";
}

function getAcademyLogo(row, academies = [], fallbackAcademyId = "") {
  const direct =
    row?.academyId?.logo ||
    row?.academyId?.logoUrl ||
    row?.academyId?.image ||
    row?.academyId?.imageUrl ||
    row?.academyId?.brandLogo ||
    row?.academyId?.academyLogo ||
    row?.academyLogo ||
    row?.logo ||
    "";

  if (direct) return direct;

  const rowAcademyId = String(
    row?.academyId?._id ||
      row?.academyId?.id ||
      row?.academyId ||
      fallbackAcademyId ||
      "",
  );

  const found = academies.find((a) => String(a.id) === rowAcademyId);
  return found?.logo || "";
}

function makeAutoNumber(prefix = "DOC") {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${y}${m}${day}-${rand}`;
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function PaymentStatusBadge({ value }) {
  const status = String(value || "PENDING").toUpperCase();

  const map = {
    PENDING: {
      bg: "rgba(245, 158, 11, 0.12)",
      color: "#b45309",
      border: "rgba(245, 158, 11, 0.28)",
    },
    PAID: {
      bg: "rgba(16, 185, 129, 0.12)",
      color: "#047857",
      border: "rgba(16, 185, 129, 0.28)",
    },
    FAILED: {
      bg: "rgba(239, 68, 68, 0.12)",
      color: "#b91c1c",
      border: "rgba(239, 68, 68, 0.28)",
    },
    REFUNDED: {
      bg: "rgba(99, 102, 241, 0.12)",
      color: "#4338ca",
      border: "rgba(99, 102, 241, 0.28)",
    },
    CANCELLED: {
      bg: "rgba(107, 114, 128, 0.12)",
      color: "#374151",
      border: "rgba(107, 114, 128, 0.28)",
    },
  };

  const x = map[status] || map.PENDING;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: x.bg,
        color: x.color,
        border: `1px solid ${x.border}`,
        letterSpacing: 0.2,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: "currentColor",
          display: "inline-block",
        }}
      />
      {status}
    </span>
  );
}

function MethodBadge({ value }) {
  const method = String(value || "CASH").toUpperCase();
  const isOnline = method === "ONLINE";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: isOnline ? "rgba(59,130,246,.10)" : "rgba(16,185,129,.10)",
        color: isOnline ? "#1d4ed8" : "#047857",
        border: `1px solid ${
          isOnline ? "rgba(59,130,246,.22)" : "rgba(16,185,129,.22)"
        }`,
      }}
    >
      {method}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent = "#0f172a",
  icon = "•",
  gradient = "linear-gradient(135deg,#ffffff 0%,#f8fafc 100%)",
}) {
  return (
    <div
      style={{
        background: gradient,
        border: "1px solid rgba(15,23,42,.08)",
        borderRadius: 22,
        padding: 18,
        boxShadow: "0 16px 40px rgba(2,6,23,.06)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -14,
          top: -14,
          width: 72,
          height: 72,
          borderRadius: 22,
          background: "rgba(255,255,255,.55)",
          border: "1px solid rgba(255,255,255,.6)",
        }}
      />
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 12,
          background: "rgba(15,23,42,.05)",
          fontSize: 16,
          marginBottom: 12,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 800,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.35,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: accent,
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function SectionCard({ children, style }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(15,23,42,.08)",
        borderRadius: 22,
        boxShadow: "0 14px 36px rgba(2,6,23,.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Input({ style, ...props }) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        height: 44,
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,.12)",
        padding: "0 13px",
        fontSize: 14,
        outline: "none",
        background: "#fff",
        transition: "all .18s ease",
        ...style,
      }}
    />
  );
}

function Select({ style, children, ...props }) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        height: 44,
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,.12)",
        padding: "0 13px",
        fontSize: 14,
        outline: "none",
        background: "#fff",
        transition: "all .18s ease",
        ...style,
      }}
    >
      {children}
    </select>
  );
}

function Textarea({ style, ...props }) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,.12)",
        padding: "12px 13px",
        fontSize: 14,
        outline: "none",
        background: "#fff",
        resize: "vertical",
        minHeight: 92,
        ...style,
      }}
    />
  );
}

function Button({ children, variant = "primary", style, disabled, ...props }) {
  const variants = {
    primary: {
      background: RED,
      color: "#fff",
      border: `1px solid ${RED}`,
      boxShadow: "0 8px 20px rgba(225,29,46,.18)",
    },
    secondary: {
      background: "#fff",
      color: NAVY,
      border: "1px solid rgba(15,23,42,.12)",
    },
    success: {
      background: "#059669",
      color: "#fff",
      border: "1px solid #059669",
      boxShadow: "0 8px 20px rgba(5,150,105,.18)",
    },
    danger: {
      background: "#dc2626",
      color: "#fff",
      border: "1px solid #dc2626",
      boxShadow: "0 8px 20px rgba(220,38,38,.18)",
    },
    ghost: {
      background: "transparent",
      color: NAVY,
      border: "1px solid rgba(15,23,42,.08)",
    },
    dark: {
      background: NAVY,
      color: "#fff",
      border: `1px solid ${NAVY}`,
      boxShadow: "0 8px 20px rgba(15,23,42,.20)",
    },
  };

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        height: 42,
        padding: "0 14px",
        borderRadius: 14,
        fontSize: 14,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "all .18s ease",
        whiteSpace: "nowrap",
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Modal({ open, title, onClose, children, width = 760, footer = null }) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(2,6,23,.52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "90vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 26,
          boxShadow: "0 30px 100px rgba(2,6,23,.30)",
          border: "1px solid rgba(15,23,42,.08)",
        }}
      >
        <div
          style={{
            padding: 18,
            borderBottom: "1px solid rgba(15,23,42,.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 2,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>
            {title}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
        {footer ? (
          <div
            style={{
              padding: 18,
              borderTop: "1px solid rgba(15,23,42,.08)",
              position: "sticky",
              bottom: 0,
              background: "#fff",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CheckBox({ checked, onChange, disabled = false }) {
  return (
    <input
      type="checkbox"
      checked={!!checked}
      disabled={disabled}
      onChange={onChange}
      style={{
        width: 16,
        height: 16,
        accentColor: RED,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    />
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 40,
        padding: "0 14px",
        borderRadius: 999,
        border: active ? `1px solid ${RED}` : "1px solid rgba(15,23,42,.08)",
        background: active ? "rgba(225,29,46,.08)" : "#fff",
        color: active ? RED : NAVY,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value, tone = "#0f172a" }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid rgba(15,23,42,.06)",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: tone,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function Payments() {
  const user = useMemo(() => getUser?.() || null, []);
  const superAdmin = !!isSuperAdmin?.();

  const initialAcademy = useMemo(() => {
    const selected = getSelectedAcademy?.();
    const effective = getEffectiveAcademy?.();
    return (
      selected?._id ||
      selected?.id ||
      selected ||
      effective?._id ||
      effective?.id ||
      ""
    );
  }, []);

  const [view, setView] = useState("overview");

  const [academies, setAcademies] = useState([]);
  const [academyId, setAcademyIdState] = useState(initialAcademy);

  const [events, setEvents] = useState([]);
  const [loadingBoot, setLoadingBoot] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusyId, setActionBusyId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  const [summary, setSummary] = useState({
    totalCount: 0,
    totalCollected: 0,
    totalPending: 0,
    totalRefunded: 0,
    cashCount: 0,
    totalAmount: 0,
    paidCount: 0,
    paidAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
    failedCount: 0,
    failedAmount: 0,
    refundedCount: 0,
    refundedAmount: 0,
    cancelledCount: 0,
    cancelledAmount: 0,
    cashAmount: 0,
    onlineCount: 0,
    onlineAmount: 0,
  });

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    q: "",
    paymentStatus: "ALL",
    paymentMethod: "ALL",
    eventId: "",
    page: 1,
    limit: PAGE_SIZE,
  });

  const [selectedIds, setSelectedIds] = useState(new Set());

  const [openCreate, setOpenCreate] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [openEmail, setOpenEmail] = useState(false);
  const [openReport, setOpenReport] = useState(false);

  const [activeRow, setActiveRow] = useState(null);

  const [form, setForm] = useState({
    userId: "",
    participantId: "",
    eventId: "",
    enrollmentId: "",
    amount: "",
    currency: "QAR",
    paymentMethod: "CASH",
    paymentStatus: "PENDING",
    gateway: "",
    transactionId: "",
    invoiceNo: "",
    receiptNo: "",
    paidAt: "",
    notes: "",
  });

  const [emailForm, setEmailForm] = useState({
    type: "INVOICE",
    to: "",
    subject: "",
    message: "",
  });

  const [reportForm, setReportForm] = useState({
    from: "",
    to: "",
    eventId: "",
    paymentStatus: "ALL",
    paymentMethod: "ALL",
    includeSummary: true,
    sendEmail: false,
    emailTo: "",
    reportName: "",
  });

  const pages = Math.max(
    Math.ceil(Number(total || 0) / Number(filters.limit || PAGE_SIZE)),
    1,
  );

  const effectiveAcademyId = useMemo(() => {
    if (superAdmin) return academyId || "";
    const effective = getEffectiveAcademy?.();
    return String(effective?._id || effective?.id || academyId || "");
  }, [academyId, superAdmin]);

  const selectedEventDoc = useMemo(() => {
    const target = String(form.eventId || filters.eventId || "");
    return events.find((e) => String(e.id) === target) || null;
  }, [events, form.eventId, filters.eventId]);

  const tableRowIds = useMemo(
    () => rows.map((x) => String(getId(x))).filter(Boolean),
    [rows],
  );

  const allSelectedOnPage = useMemo(() => {
    if (!tableRowIds.length) return false;
    return tableRowIds.every((id) => selectedIds.has(id));
  }, [tableRowIds, selectedIds]);

  const selectedCount = selectedIds.size;

  const setAcademyValue = useCallback((next) => {
    const v = String(next || "");
    setAcademyIdState(v);
    try {
      setSelectedAcademy?.(v);
    } catch {
      //
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleOne = useCallback((id) => {
    const key = String(id || "");
    if (!key) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const togglePageSelection = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        tableRowIds.forEach((id) => next.delete(id));
      } else {
        tableRowIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allSelectedOnPage, tableRowIds]);

  const loadBoot = useCallback(async () => {
    setLoadingBoot(true);
    try {
      const reqs = [api.adminEvents?.(effectiveAcademyId)];
      if (superAdmin) reqs.unshift(api.adminAcademies?.({ limit: 500 }));

      const result = await Promise.all(reqs);

      if (superAdmin) {
        const [academiesRes, eventsRes] = result;
        setAcademies(normalizeAcademies(academiesRes));
        setEvents(normalizeEvents(eventsRes));
      } else {
        const [eventsRes] = result;
        setEvents(normalizeEvents(eventsRes));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBoot(false);
    }
  }, [effectiveAcademyId, superAdmin]);

  const loadTable = useCallback(async () => {
    setLoadingTable(true);
    try {
      const query = {
        page: filters.page,
        limit: filters.limit,
        q: filters.q,
        paymentStatus:
          filters.paymentStatus === "ALL" ? "" : filters.paymentStatus,
        paymentMethod:
          filters.paymentMethod === "ALL" ? "" : filters.paymentMethod,
        eventId: filters.eventId,
      };

      const [listRes, summaryRes] = await Promise.all([
        api.adminPayments(query, effectiveAcademyId),
        api.paymentsSummary(
          { eventId: filters.eventId || "" },
          effectiveAcademyId,
        ),
      ]);

      const list = normalizeList(listRes);
      setRows(list);
      setTotal(Number(listRes?.total || list.length || 0));
      setSummary({
        totalCount: Number(
          summaryRes?.totalCount ||
            summaryRes?.totalPayments ||
            list.length ||
            0,
        ),
        totalCollected: Number(
          summaryRes?.totalCollected ?? summaryRes?.paidAmount ?? 0,
        ),
        totalPending: Number(
          summaryRes?.totalPending ?? summaryRes?.pendingAmount ?? 0,
        ),
        totalRefunded: Number(
          summaryRes?.totalRefunded ?? summaryRes?.refundedAmount ?? 0,
        ),
        cashCount: Number(summaryRes?.cashCount || 0),

        totalAmount: Number(summaryRes?.totalAmount || 0),
        paidCount: Number(summaryRes?.paidCount || 0),
        paidAmount: Number(summaryRes?.paidAmount || 0),
        pendingCount: Number(summaryRes?.pendingCount || 0),
        pendingAmount: Number(summaryRes?.pendingAmount || 0),
        failedCount: Number(summaryRes?.failedCount || 0),
        failedAmount: Number(summaryRes?.failedAmount || 0),
        refundedCount: Number(summaryRes?.refundedCount || 0),
        refundedAmount: Number(summaryRes?.refundedAmount || 0),
        cancelledCount: Number(summaryRes?.cancelledCount || 0),
        cancelledAmount: Number(summaryRes?.cancelledAmount || 0),
        cashAmount: Number(summaryRes?.cashAmount || 0),
        onlineCount: Number(summaryRes?.onlineCount || 0),
        onlineAmount: Number(summaryRes?.onlineAmount || 0),
      });
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to load payments");
    } finally {
      setLoadingTable(false);
    }
  }, [filters, effectiveAcademyId]);

  useEffect(() => {
    loadBoot();
  }, [loadBoot]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, page: 1 }));
    clearSelection();
  }, [effectiveAcademyId, clearSelection]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set();
      const valid = new Set(tableRowIds);
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
      });
      return next;
    });
  }, [tableRowIds]);

  useEffect(() => {
    if (!selectedEventDoc) return;
    setForm((prev) => {
      const shouldAutofillAmount =
        prev.amount === "" || Number(prev.amount || 0) === 0;
      const nextAmount = shouldAutofillAmount
        ? String(selectedEventDoc.registrationFee || "")
        : prev.amount;

      return {
        ...prev,
        currency: selectedEventDoc.currency || prev.currency || "QAR",
        amount: nextAmount,
      };
    });
  }, [selectedEventDoc]);

  const resetCreateForm = useCallback(() => {
    const eventId = filters.eventId || "";
    const event = events.find((e) => e.id === eventId) || null;

    setForm({
      userId: "",
      participantId: "",
      eventId,
      enrollmentId: "",
      amount:
        event && Number(event.registrationFee || 0) > 0
          ? String(event.registrationFee)
          : "",
      currency: event?.currency || "QAR",
      paymentMethod: "CASH",
      paymentStatus: "PENDING",
      gateway: "",
      transactionId: "",
      invoiceNo: "",
      receiptNo: "",
      paidAt: "",
      notes: "",
    });
  }, [filters.eventId, events]);

  const openCreateModal = useCallback(() => {
    resetCreateForm();
    setOpenCreate(true);
  }, [resetCreateForm]);

  const onCreate = useCallback(async () => {
    const fallbackEvent = events.find((e) => e.id === form.eventId) || null;
    const amount =
      form.amount === "" || form.amount === null || form.amount === undefined
        ? Number(fallbackEvent?.registrationFee || 0)
        : Number(form.amount || 0);

    if (!Number.isFinite(amount) || amount < 0) {
      return alert("Enter a valid amount");
    }

    setSaving(true);
    try {
      await api.createPayment(
        {
          userId: form.userId || undefined,
          participantId: form.participantId || undefined,
          eventId: form.eventId || undefined,
          enrollmentId: form.enrollmentId || undefined,
          amount,
          currency: form.currency || fallbackEvent?.currency || "QAR",
          paymentMethod: form.paymentMethod || "CASH",
          paymentStatus: form.paymentStatus || "PENDING",
          gateway: form.gateway || undefined,
          transactionId: form.transactionId || undefined,
          invoiceNo: form.invoiceNo || makeAutoNumber("INV"),
          receiptNo:
            form.paymentStatus === "PAID"
              ? form.receiptNo || makeAutoNumber("RCT")
              : form.receiptNo || undefined,
          paidAt: form.paidAt || undefined,
          notes: form.notes || undefined,
        },
        effectiveAcademyId,
      );

      setOpenCreate(false);
      resetCreateForm();
      await loadTable();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to create payment");
    } finally {
      setSaving(false);
    }
  }, [effectiveAcademyId, events, form, loadTable, resetCreateForm]);

  const quickStatus = useCallback(
    async (id, paymentStatus) => {
      setActionBusyId(String(id));
      try {
        const payload = {
          paymentStatus,
          paidAt:
            paymentStatus === "PAID" ? new Date().toISOString() : undefined,
        };

        if (paymentStatus === "PAID") {
          const row = rows.find((r) => getId(r) === String(id));
          if (row && !row?.receiptNo) {
            payload.receiptNo = makeAutoNumber("RCT");
          }
          if (row && !row?.invoiceNo) {
            payload.invoiceNo = makeAutoNumber("INV");
          }
        }

        await api.updatePaymentStatus(id, payload, effectiveAcademyId);
        await loadTable();
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to update payment");
      } finally {
        setActionBusyId("");
      }
    },
    [effectiveAcademyId, loadTable, rows],
  );

  const bulkMarkSelectedPaid = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return alert("Select at least one payment");

    const ok = window.confirm(
      `Mark ${ids.length} selected payment(s) as PAID?`,
    );
    if (!ok) return;

    setBulkBusy(true);
    try {
      await api.bulkUpdatePaymentsStatus(ids, "PAID", effectiveAcademyId);
      clearSelection();
      await loadTable();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to bulk mark selected payments as paid");
    } finally {
      setBulkBusy(false);
    }
  }, [clearSelection, effectiveAcademyId, loadTable, selectedIds]);

  const bulkDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds).filter(Boolean);

    if (!ids.length) return alert("Select at least one payment");

    const ok = window.confirm(
      `Delete ${ids.length} selected payment(s)? This will permanently remove them from the MongoDB Payment collection.`,
    );

    if (!ok) return;

    setBulkBusy(true);
    try {
      /*
      Best option:
      api.bulkDeletePayments(ids, effectiveAcademyId)

      Fallback:
      Uses existing api.deletePayment() one by one.
      This still removes documents from MongoDB if your backend single delete route uses Payment.findByIdAndDelete() or Payment.deleteOne().
    */
      if (api.bulkDeletePayments) {
        await api.bulkDeletePayments(ids, effectiveAcademyId);
      } else {
        await Promise.all(
          ids.map((id) => api.deletePayment(id, effectiveAcademyId)),
        );
      }

      clearSelection();
      await loadTable();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to delete selected payments");
    } finally {
      setBulkBusy(false);
    }
  }, [clearSelection, effectiveAcademyId, loadTable, selectedIds]);

  const exportPayments = useCallback(async () => {
    try {
      setBulkBusy(true);
      await api.exportPaymentsReport({
        academyId: effectiveAcademyId,
        eventId: filters.eventId || "",
        paymentStatus:
          filters.paymentStatus === "ALL" ? "" : filters.paymentStatus,
        paymentMethod:
          filters.paymentMethod === "ALL" ? "" : filters.paymentMethod,
        q: filters.q || "",
      });
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to export payments");
    } finally {
      setBulkBusy(false);
    }
  }, [effectiveAcademyId, filters]);

  const onDelete = useCallback(
    async (id) => {
      const ok = window.confirm("Delete this payment?");
      if (!ok) return;

      setActionBusyId(String(id));
      try {
        await api.deletePayment(id, effectiveAcademyId);
        await loadTable();
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to delete payment");
      } finally {
        setActionBusyId("");
      }
    },
    [effectiveAcademyId, loadTable],
  );

  const openDetails = useCallback((row) => {
    setActiveRow(row);
    setOpenView(true);
  }, []);

  const openEmailModal = useCallback((row, type = "INVOICE") => {
    const email = getParticipantEmail(row);
    const person = getParticipantName(row);
    const eventName = getEventName(row);
    setActiveRow(row);
    setEmailForm({
      type,
      to: email === "No email" ? "" : email,
      subject:
        type === "RECEIPT"
          ? `Payment Receipt - ${eventName}`
          : `Invoice - ${eventName}`,
      message:
        type === "RECEIPT"
          ? `Hello ${person},\n\nPlease find your payment receipt attached.\n\nThank you.`
          : `Hello ${person},\n\nPlease find your invoice attached.\n\nThank you.`,
    });
    setOpenEmail(true);
  }, []);

  const totalPaidPct = useMemo(() => {
    const totalAmt = Number(summary.totalAmount || 0);
    const paidAmt = Number(summary.paidAmount || 0);
    if (!totalAmt) return 0;
    return Math.min((paidAmt / totalAmt) * 100, 100);
  }, [summary]);

  const selectedAcademyName = useMemo(() => {
    if (!superAdmin) {
      return (
        getEffectiveAcademy?.()?.name ||
        getSelectedAcademy?.()?.name ||
        "Assigned Academy"
      );
    }
    return academies.find((a) => a.id === academyId)?.name || "No academy";
  }, [academies, academyId, superAdmin]);

  const selectedAcademyLogo = useMemo(() => {
    if (superAdmin) {
      return academies.find((a) => a.id === academyId)?.logo || "";
    }

    const selected = getSelectedAcademy?.();
    const effective = getEffectiveAcademy?.();

    return (
      selected?.logo ||
      selected?.logoUrl ||
      effective?.logo ||
      effective?.logoUrl ||
      academies.find(
        (a) =>
          String(a.id) ===
          String(
            effective?._id ||
              effective?.id ||
              selected?._id ||
              selected?.id ||
              "",
          ),
      )?.logo ||
      ""
    );
  }, [academies, academyId, superAdmin]);

  const overviewStats = useMemo(() => {
    const totalCount = Number(summary.totalCount || 0);
    const paid = Number(summary.paidCount || 0);
    const pending = Number(summary.pendingCount || 0);
    const failed = Number(summary.failedCount || 0);
    const refunded = Number(summary.refundedCount || 0);
    const successRate = totalCount
      ? ((paid / totalCount) * 100).toFixed(1)
      : "0.0";

    return {
      totalCount,
      paid,
      pending,
      failed,
      refunded,
      successRate,
    };
  }, [summary]);

  const recentActivity = useMemo(() => {
    return [...rows]
      .slice()
      .sort((a, b) => {
        const da = new Date(
          a?.updatedAt || a?.paidAt || a?.createdAt || 0,
        ).getTime();
        const db = new Date(
          b?.updatedAt || b?.paidAt || b?.createdAt || 0,
        ).getTime();
        return db - da;
      })
      .slice(0, 6);
  }, [rows]);

  const buildDocumentHtml = useCallback(
    (row, type = "INVOICE") => {
      const docNo =
        type === "RECEIPT"
          ? row?.receiptNo || makeAutoNumber("RCT")
          : row?.invoiceNo || makeAutoNumber("INV");

      const participant = getParticipantName(row);
      const email = getParticipantEmail(row);
      const eventName = getEventName(row);
      const academy = getAcademyName(row) || selectedAcademyName;
      const academyLogo =
        getAcademyLogo(row, academies, effectiveAcademyId) ||
        selectedAcademyLogo ||
        "";
      const status = String(row?.paymentStatus || "PENDING").toUpperCase();
      const method = String(row?.paymentMethod || "CASH").toUpperCase();
      const issueDate = fmtDateOnly(
        type === "RECEIPT"
          ? row?.paidAt || row?.updatedAt || row?.createdAt
          : row?.createdAt,
      );

      const title = type === "RECEIPT" ? "Payment Receipt" : "Payment Invoice";
      const accent = "#e11d2e";
      const amountText = money(row?.amount, row?.currency || "QAR");

      return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Inter, Arial, Helvetica, sans-serif;
    background: #eef2f7;
    color: #0f172a;
    padding: 28px;
  }
  .sheet {
    max-width: 920px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(2,6,23,.12);
    border: 1px solid rgba(15,23,42,.08);
  }
  .topbar {
    height: 6px;
    background: linear-gradient(90deg, ${accent} 0%, #fb7185 100%);
  }
  .hero {
    padding: 30px 32px 22px;
    background:
      radial-gradient(circle at top right, rgba(225,29,46,.10), transparent 28%),
      linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #fff;
  }
  .heroRow {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .logoWrap {
    width: 72px;
    height: 72px;
    min-width: 72px;
    border-radius: 18px;
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.18);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    backdrop-filter: blur(4px);
  }
  .logoWrap img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #fff;
    padding: 8px;
  }
  .logoFallback {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    background: rgba(255,255,255,.16);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 900;
  }
  .hero h1 {
    margin: 0 0 8px;
    font-size: 31px;
    line-height: 1.08;
    letter-spacing: -.02em;
  }
  .hero .academy {
    margin: 0;
    font-size: 15px;
    opacity: .92;
    font-weight: 600;
  }
  .docMeta {
    text-align: right;
  }
  .docChip {
    display: inline-block;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.16);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .docNo {
    margin-top: 10px;
    font-size: 15px;
    font-weight: 800;
  }
  .body {
    padding: 28px 32px 22px;
  }
  .summaryBand {
    display: grid;
    grid-template-columns: 1.2fr .8fr;
    gap: 16px;
    margin-bottom: 22px;
  }
  .totalCard {
    background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%);
    border: 1px solid rgba(225,29,46,.14);
    border-radius: 20px;
    padding: 20px;
  }
  .totalLabel {
    color: #64748b;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .04em;
    margin-bottom: 10px;
  }
  .totalAmount {
    font-size: 34px;
    line-height: 1;
    font-weight: 900;
    color: #0f172a;
  }
  .statusCard {
    background: #f8fafc;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 20px;
    padding: 20px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(225,29,46,.08);
    color: ${accent};
    font-weight: 800;
    font-size: 12px;
    border: 1px solid rgba(225,29,46,.14);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: currentColor;
    display: inline-block;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 22px;
  }
  .card {
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 18px;
    padding: 16px;
    background: #fff;
    box-shadow: 0 6px 18px rgba(2,6,23,.03);
  }
  .cardTitle {
    color: #0f172a;
    font-size: 14px;
    font-weight: 900;
    margin-bottom: 14px;
  }
  .item {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed rgba(15,23,42,.08);
  }
  .item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .label {
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .03em;
  }
  .value {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    word-break: break-word;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 8px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 18px;
    overflow: hidden;
  }
  th, td {
    padding: 15px 16px;
    border-bottom: 1px solid rgba(15,23,42,.08);
    text-align: left;
    font-size: 14px;
  }
  tr:last-child td { border-bottom: none; }
  th {
    background: #f8fafc;
    color: #475569;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: .04em;
    font-weight: 800;
  }
  .strong {
    font-weight: 900;
    color: #0f172a;
  }
  .noteBox {
    margin-top: 18px;
    padding: 14px 16px;
    border-radius: 16px;
    background: #f8fafc;
    border: 1px solid rgba(15,23,42,.08);
    color: #475569;
    font-size: 13px;
    line-height: 1.6;
  }
  .footer {
    padding: 0 32px 28px;
    color: #64748b;
    font-size: 12px;
  }
  .footerLine {
    border-top: 1px solid rgba(15,23,42,.08);
    padding-top: 16px;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet {
      box-shadow: none;
      border: none;
      border-radius: 0;
      max-width: none;
    }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="topbar"></div>

    <div class="hero">
      <div class="heroRow">
        <div class="brand">
          <div class="logoWrap">
            ${
              academyLogo
                ? `<img src="${escapeHtml(academyLogo)}" alt="Academy Logo" />`
                : `<div class="logoFallback">${escapeHtml(
                    (academy || "A").charAt(0).toUpperCase(),
                  )}</div>`
            }
          </div>

          <div>
            <h1>${escapeHtml(title)}</h1>
            <p class="academy">${escapeHtml(academy)}</p>
          </div>
        </div>

        <div class="docMeta">
          <div class="docChip">${escapeHtml(type)}</div>
          <div class="docNo">${escapeHtml(docNo)}</div>
        </div>
      </div>
    </div>

    <div class="body">
      <div class="summaryBand">
        <div class="totalCard">
          <div class="totalLabel">Total Amount</div>
          <div class="totalAmount">${escapeHtml(amountText)}</div>
        </div>

        <div class="statusCard">
          <div class="totalLabel">Payment Status</div>
          <div class="badge"><span class="dot"></span>${escapeHtml(status)}</div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="cardTitle">Participant Details</div>
          <div class="item">
            <div class="label">Name</div>
            <div class="value">${escapeHtml(participant)}</div>
          </div>
          <div class="item">
            <div class="label">Email</div>
            <div class="value">${escapeHtml(email)}</div>
          </div>
          <div class="item">
            <div class="label">Issue Date</div>
            <div class="value">${escapeHtml(issueDate)}</div>
          </div>
        </div>

        <div class="card">
          <div class="cardTitle">Payment Details</div>
          <div class="item">
            <div class="label">Event</div>
            <div class="value">${escapeHtml(eventName)}</div>
          </div>
          <div class="item">
            <div class="label">Method</div>
            <div class="value">${escapeHtml(method)}</div>
          </div>
          <div class="item">
            <div class="label">Transaction</div>
            <div class="value">${escapeHtml(row?.transactionId || "—")}</div>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(eventName)} registration payment</td>
            <td>1</td>
            <td>${escapeHtml(amountText)}</td>
            <td class="strong">${escapeHtml(amountText)}</td>
          </tr>
        </tbody>
      </table>

      ${
        row?.notes
          ? `<div class="noteBox"><b>Notes:</b> ${escapeHtml(row.notes)}</div>`
          : ""
      }
    </div>

    <div class="footer">
      <div class="footerLine">
        <div>Generated on ${escapeHtml(fmtDate(new Date().toISOString()))}</div>
        <div style="margin-top:6px;">This document was generated from the payment management system.</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 250);
    };
  </script>
</body>
</html>`;
    },
    [academies, effectiveAcademyId, selectedAcademyLogo, selectedAcademyName],
  );

  const printDocument = useCallback(
    async (row, type = "INVOICE") => {
      try {
        const w = window.open("", "_blank", "width=1024,height=900");
        if (!w) {
          alert("Popup blocked. Please allow popups and try again.");
          return;
        }
        const html = buildDocumentHtml(row, type);
        w.document.open();
        w.document.write(html);
        w.document.close();

        if (type === "INVOICE" && !row?.invoiceNo && api.updatePaymentStatus) {
          try {
            await api.updatePaymentStatus(
              getId(row),
              { invoiceNo: makeAutoNumber("INV") },
              effectiveAcademyId,
            );
            await loadTable();
          } catch {
            //
          }
        }

        if (type === "RECEIPT" && !row?.receiptNo && api.updatePaymentStatus) {
          try {
            await api.updatePaymentStatus(
              getId(row),
              { receiptNo: makeAutoNumber("RCT") },
              effectiveAcademyId,
            );
            await loadTable();
          } catch {
            //
          }
        }
      } catch (err) {
        console.error(err);
        alert("Failed to generate document");
      }
    },
    [buildDocumentHtml, effectiveAcademyId, loadTable],
  );

  const sendDocumentByEmail = useCallback(async () => {
    if (!activeRow) return;
    if (!emailForm.to.trim()) return alert("Enter recipient email");

    setEmailBusy(true);
    try {
      if (api.sendPaymentDocumentEmail) {
        await api.sendPaymentDocumentEmail(
          getId(activeRow),
          {
            type: emailForm.type,
            to: emailForm.to.trim(),
            subject: emailForm.subject.trim(),
            message: emailForm.message.trim(),
          },
          effectiveAcademyId,
        );
      } else {
        alert(
          "Frontend UI is ready, but api.sendPaymentDocumentEmail() is not added in api.js / backend yet.",
        );
        return;
      }

      setOpenEmail(false);
      alert(`${emailForm.type} sent successfully`);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to send email");
    } finally {
      setEmailBusy(false);
    }
  }, [activeRow, effectiveAcademyId, emailForm]);

  const generateReportNow = useCallback(async () => {
    try {
      setReportBusy(true);

      const payload = {
        academyId: effectiveAcademyId,
        from: reportForm.from || "",
        to: reportForm.to || "",
        eventId: reportForm.eventId || "",
        paymentStatus:
          reportForm.paymentStatus === "ALL" ? "" : reportForm.paymentStatus,
        paymentMethod:
          reportForm.paymentMethod === "ALL" ? "" : reportForm.paymentMethod,
        includeSummary: !!reportForm.includeSummary,
        reportName:
          reportForm.reportName ||
          `Payments Report ${new Date().toLocaleDateString()}`,
      };

      if (reportForm.sendEmail) {
        if (!reportForm.emailTo.trim()) {
          alert("Enter email address for report delivery");
          return;
        }

        if (api.sendPaymentsReportEmail) {
          await api.sendPaymentsReportEmail(
            {
              ...payload,
              to: reportForm.emailTo.trim(),
            },
            effectiveAcademyId,
          );
          alert("Report sent by email successfully");
        } else {
          alert(
            "Frontend UI is ready, but api.sendPaymentsReportEmail() is not added in api.js / backend yet.",
          );
          return;
        }
      } else {
        await api.exportPaymentsReport(payload);
      }

      setOpenReport(false);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to generate report");
    } finally {
      setReportBusy(false);
    }
  }, [effectiveAcademyId, reportForm]);

  const paymentHistoryEntries = useMemo(() => {
    if (!activeRow) return [];

    const entries = [
      {
        label: "Created",
        at: activeRow?.createdAt,
        tone: "#334155",
      },
      {
        label: "Last Updated",
        at: activeRow?.updatedAt,
        tone: "#0f172a",
      },
      {
        label: "Paid At",
        at: activeRow?.paidAt,
        tone: "#047857",
      },
      {
        label: "Refunded / Final Change",
        at:
          String(activeRow?.paymentStatus || "").toUpperCase() === "REFUNDED"
            ? activeRow?.updatedAt
            : "",
        tone: "#4338ca",
      },
    ];

    return entries.filter((x) => x.at);
  }, [activeRow]);

  return (
    <div
      style={{
        padding: 16,
        background:
          "radial-gradient(circle at top left, rgba(225,29,46,.04), transparent 25%), #f8fafc",
        minHeight: "100%",
      }}
    >
      <div
        style={{
          maxWidth: 1680,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <SectionCard
          style={{
            padding: 20,
            background:
              "radial-gradient(circle at top right, rgba(225,29,46,.08), transparent 22%), linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr auto",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {selectedAcademyLogo ? (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 18,
                      background: "#fff",
                      border: "1px solid rgba(15,23,42,.08)",
                      boxShadow: "0 10px 24px rgba(2,6,23,.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={selectedAcademyLogo}
                      alt="Academy Logo"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        padding: 8,
                      }}
                    />
                  </div>
                ) : null}

                <div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: NAVY }}>
                    Payments Management
                  </div>
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 14 }}>
                    Create and manage payments, generate invoices and receipts,
                    review payment history, export reports, and deliver payment
                    documents by email.
                  </div>
                  <div
                    style={{ marginTop: 10, color: "#94a3b8", fontSize: 13 }}
                  >
                    Signed in as {getNameFromMaybeUser(user) || "Admin"} •
                    Academy: {selectedAcademyName}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <TabButton
                  active={view === "overview"}
                  onClick={() => setView("overview")}
                >
                  Overview
                </TabButton>
                <TabButton
                  active={view === "payments"}
                  onClick={() => setView("payments")}
                >
                  Payments
                </TabButton>
                <TabButton
                  active={view === "reports"}
                  onClick={() => {
                    setView("reports");
                    setOpenReport(true);
                  }}
                >
                  Reports
                </TabButton>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="secondary"
                onClick={loadTable}
                disabled={loadingTable || bulkBusy}
              >
                {loadingTable ? "Refreshing..." : "Refresh"}
              </Button>
              <Button
                variant="dark"
                onClick={() => setOpenReport(true)}
                disabled={loadingTable || bulkBusy}
              >
                Generate Report
              </Button>
              <Button
                variant="secondary"
                onClick={exportPayments}
                disabled={loadingTable || bulkBusy}
              >
                {bulkBusy ? "Working..." : "Export CSV"}
              </Button>
              <Button onClick={openCreateModal}>+ Create Payment</Button>
            </div>
          </div>
        </SectionCard>

        {superAdmin ? (
          <SectionCard style={{ padding: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "220px minmax(260px, 1fr)",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>
                Academy Scope
              </div>
              <div>
                <Select
                  value={academyId}
                  onChange={(e) => setAcademyValue(e.target.value)}
                >
                  <option value="">Select academy</option>
                  {academies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.code ? ` (${a.code})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <StatCard
            label="Total Collected"
            value={money(summary.totalCollected, "QAR")}
            sub={`${summary.paidCount} paid • ${totalPaidPct.toFixed(0)}% paid ratio`}
            accent="#047857"
            icon="💰"
            gradient="linear-gradient(135deg,#ffffff 0%,#ecfdf5 100%)"
          />
          <StatCard
            label="Pending Amount"
            value={money(summary.totalPending, "QAR")}
            sub={`${summary.pendingCount} pending payments`}
            accent="#b45309"
            icon="⏳"
            gradient="linear-gradient(135deg,#ffffff 0%,#fffbeb 100%)"
          />
          <StatCard
            label="Refunded"
            value={money(summary.totalRefunded, "QAR")}
            sub={`${summary.refundedCount} refunded records`}
            accent="#4338ca"
            icon="↩️"
            gradient="linear-gradient(135deg,#ffffff 0%,#eef2ff 100%)"
          />
          <StatCard
            label="Payment Success"
            value={`${overviewStats.successRate}%`}
            sub={`${overviewStats.paid} paid • ${overviewStats.failed} failed`}
            accent="#0f172a"
            icon="📈"
            gradient="linear-gradient(135deg,#ffffff 0%,#f8fafc 100%)"
          />
        </div>

        <SectionCard style={{ padding: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: NAVY,
                  marginBottom: 12,
                }}
              >
                Collection Progress
              </div>
              <div
                style={{
                  height: 16,
                  borderRadius: 999,
                  background: "#e2e8f0",
                  overflow: "hidden",
                  border: "1px solid rgba(15,23,42,.06)",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, totalPaidPct))}%`,
                    height: "100%",
                    background:
                      "linear-gradient(90deg, #059669 0%, #10b981 100%)",
                    borderRadius: 999,
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "#64748b",
                }}
              >
                Paid amount {money(summary.paidAmount, "QAR")} out of total
                scope {money(summary.totalAmount, "QAR")}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <MiniStat label="Records" value={summary.totalCount} />
              <MiniStat label="Cash" value={summary.cashCount} tone="#047857" />
              <MiniStat
                label="Online"
                value={summary.onlineCount}
                tone="#1d4ed8"
              />
              <MiniStat
                label="Cancelled"
                value={summary.cancelledCount}
                tone="#374151"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard style={{ padding: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1.3fr) repeat(3, minmax(160px, .8fr)) auto",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Search
              </div>
              <Input
                placeholder="Invoice, receipt, transaction, participant, email, notes..."
                value={filters.q}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, q: e.target.value, page: 1 }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Status
              </div>
              <Select
                value={filters.paymentStatus}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    paymentStatus: e.target.value,
                    page: 1,
                  }))
                }
              >
                {STATUS_OPTIONS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Method
              </div>
              <Select
                value={filters.paymentMethod}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    paymentMethod: e.target.value,
                    page: 1,
                  }))
                }
              >
                {METHOD_OPTIONS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Event
              </div>
              <Select
                value={filters.eventId}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    eventId: e.target.value,
                    page: 1,
                  }))
                }
              >
                <option value="">All events</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.code ? ` (${e.code})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters({
                    q: "",
                    paymentStatus: "ALL",
                    paymentMethod: "ALL",
                    eventId: "",
                    page: 1,
                    limit: PAGE_SIZE,
                  });
                  clearSelection();
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid rgba(15,23,42,.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>
                Payment Records
              </div>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                {loadingTable ? "Loading..." : `${total} record(s) found`}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Selected: {selectedCount}
              </div>
              <Button
                variant="success"
                disabled={!selectedCount || bulkBusy || loadingTable}
                onClick={bulkMarkSelectedPaid}
              >
                {bulkBusy ? "Processing..." : "Mark Selected Paid"}
              </Button>

              <Button
                variant="danger"
                disabled={!selectedCount || bulkBusy || loadingTable}
                onClick={bulkDeleteSelected}
              >
                {bulkBusy ? "Deleting..." : "Delete Selected"}
              </Button>

              <Button
                variant="secondary"
                disabled={!selectedCount || bulkBusy}
                onClick={clearSelection}
              >
                Clear Selection
              </Button>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Page {filters.page} / {pages}
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 1620,
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "",
                    "Payment",
                    "Participant / User",
                    "Event",
                    "Amount",
                    "Method",
                    "Status",
                    "Paid At",
                    "Documents",
                    "Actions",
                  ].map((h, idx) => (
                    <th
                      key={`${h}-${idx}`}
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        letterSpacing: 0.3,
                        color: "#64748b",
                        fontWeight: 800,
                        padding: "14px 16px",
                        borderBottom: "1px solid rgba(15,23,42,.08)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {idx === 0 ? (
                        <CheckBox
                          checked={allSelectedOnPage}
                          onChange={togglePageSelection}
                          disabled={!tableRowIds.length}
                        />
                      ) : (
                        h
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 24 }}>
                      <div
                        style={{
                          border: "1px dashed rgba(15,23,42,.15)",
                          borderRadius: 18,
                          padding: 30,
                          textAlign: "center",
                          color: "#64748b",
                        }}
                      >
                        No payment records found.
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const id = getId(row);
                    const busy = actionBusyId === id;
                    const selected = selectedIds.has(id);
                    const statusUpper = String(
                      row?.paymentStatus || "",
                    ).toUpperCase();

                    return (
                      <tr key={id}>
                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid rgba(15,23,42,.06)",
                            verticalAlign: "top",
                          }}
                        >
                          <CheckBox
                            checked={selected}
                            onChange={() => toggleOne(id)}
                          />
                        </td>

                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid rgba(15,23,42,.06)",
                            verticalAlign: "top",
                            minWidth: 200,
                          }}
                        >
                          <div style={{ fontWeight: 900, color: NAVY }}>
                            {row?.invoiceNo || "No Invoice"}
                          </div>
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 12,
                              marginTop: 6,
                            }}
                          >
                            Receipt: {row?.receiptNo || "—"}
                          </div>
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            Txn: {row?.transactionId || "—"}
                          </div>
                          <div
                            style={{
                              color: "#94a3b8",
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            Created: {fmtDate(row?.createdAt)}
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid rgba(15,23,42,.06)",
                            verticalAlign: "top",
                            minWidth: 230,
                          }}
                        >
                          <div style={{ fontWeight: 800, color: NAVY }}>
                            {getParticipantName(row)}
                          </div>
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 12,
                              marginTop: 6,
                            }}
                          >
                            {getParticipantEmail(row)}
                          </div>
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            Bib: {getParticipantBib(row)}
                          </div>
                          <div
                            style={{
                              color: "#94a3b8",
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            User: {getId(row?.userId) || "—"}
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid rgba(15,23,42,.06)",
                            verticalAlign: "top",
                            minWidth: 220,
                          }}
                        >
                          <div style={{ fontWeight: 800, color: NAVY }}>
                            {getEventName(row)}
                          </div>
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 12,
                              marginTop: 6,
                            }}
                          >
                            Code: {getEventCode(row)}
                          </div>
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 12,
                              marginTop: 4,
                            }}
                          >
                            Event status: {getEventStatus(row)}
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid rgba(15,23,42,.06)",
                            verticalAlign: "top",
                            minWidth: 140,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 17,
                              fontWeight: 900,
                              color: NAVY,
                            }}
                          >
                            {money(row?.amount, row?.currency || "QAR")}
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid rgba(15,23,42,.06)",
                            verticalAlign: "top",
                            minWidth: 140,
                          }}
                        >
                          <MethodBadge value={row?.paymentMethod} />
                          {row?.gateway ? (
                            <div
                              style={{
                                color: "#64748b",
                                fontSize: 12,
                                marginTop: 8,
                              }}
                            >
                              Gateway: {row.gateway}
                            </div>
                          ) : null}
                        </td>

                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid rgba(15,23,42,.06)",
                            verticalAlign: "top",
                            minWidth: 150,
                          }}
                        >
                          <PaymentStatusBadge value={row?.paymentStatus} />
                          {row?.confirmedBy?.name ? (
                            <div
                              style={{
                                color: "#64748b",
                                fontSize: 12,
                                marginTop: 8,
                              }}
                            >
                              By: {row.confirmedBy.name}
                            </div>
                          ) : null}
                        </td>

                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid rgba(15,23,42,.06)",
                            verticalAlign: "top",
                            whiteSpace: "nowrap",
                            minWidth: 150,
                          }}
                        >
                          {fmtDate(row?.paidAt)}
                        </td>

                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid rgba(15,23,42,.06)",
                            verticalAlign: "top",
                            minWidth: 240,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <Button
                              variant="secondary"
                              onClick={() => printDocument(row, "INVOICE")}
                            >
                              Invoice
                            </Button>

                            <Button
                              variant="secondary"
                              disabled={statusUpper !== "PAID"}
                              onClick={() => printDocument(row, "RECEIPT")}
                            >
                              Receipt
                            </Button>

                            <Button
                              variant="ghost"
                              onClick={() => openEmailModal(row, "INVOICE")}
                            >
                              Email
                            </Button>
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid rgba(15,23,42,.06)",
                            verticalAlign: "top",
                            minWidth: 320,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <Button
                              variant="dark"
                              onClick={() => openDetails(row)}
                            >
                              View
                            </Button>

                            {statusUpper !== "PAID" ? (
                              <Button
                                variant="success"
                                disabled={busy}
                                onClick={() => quickStatus(id, "PAID")}
                              >
                                {busy ? "Updating..." : "Mark Paid"}
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                onClick={() => openEmailModal(row, "RECEIPT")}
                              >
                                Send Receipt
                              </Button>
                            )}

                            {statusUpper !== "FAILED" ? (
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() => quickStatus(id, "FAILED")}
                              >
                                Failed
                              </Button>
                            ) : null}

                            {statusUpper !== "REFUNDED" ? (
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() => quickStatus(id, "REFUNDED")}
                              >
                                Refund
                              </Button>
                            ) : null}

                            <Button
                              variant="danger"
                              disabled={busy}
                              onClick={() => onDelete(id)}
                            >
                              Delete
                            </Button>
                          </div>

                          {row?.notes ? (
                            <div
                              style={{
                                marginTop: 10,
                                fontSize: 12,
                                color: "#64748b",
                                lineHeight: 1.5,
                                maxWidth: 280,
                              }}
                            >
                              {row.notes}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              borderTop: "1px solid rgba(15,23,42,.08)",
            }}
          >
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Showing page {filters.page} of {pages}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="secondary"
                disabled={filters.page <= 1 || loadingTable}
                onClick={() =>
                  setFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
                }
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={filters.page >= pages || loadingTable}
                onClick={() =>
                  setFilters((p) => ({
                    ...p,
                    page: Math.min(pages, p.page + 1),
                  }))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard style={{ padding: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: NAVY,
                  marginBottom: 12,
                }}
              >
                Recent Payment Activity
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {recentActivity.length ? (
                  recentActivity.map((row) => (
                    <div
                      key={getId(row)}
                      style={{
                        border: "1px solid rgba(15,23,42,.08)",
                        borderRadius: 16,
                        padding: 14,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        background: "#fff",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, color: NAVY }}>
                          {getParticipantName(row)}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            marginTop: 4,
                          }}
                        >
                          {getEventName(row)}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            marginTop: 4,
                          }}
                        >
                          {fmtDate(
                            row?.updatedAt || row?.paidAt || row?.createdAt,
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontWeight: 900,
                            color: NAVY,
                          }}
                        >
                          {money(row?.amount, row?.currency || "QAR")}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <PaymentStatusBadge value={row?.paymentStatus} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: 13,
                    }}
                  >
                    No recent activity
                  </div>
                )}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: NAVY,
                  marginBottom: 12,
                }}
              >
                Quick Report Summary
              </div>

              <div
                style={{
                  border: "1px solid rgba(15,23,42,.08)",
                  borderRadius: 18,
                  padding: 16,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <MiniStat
                    label="Paid Amount"
                    value={money(summary.paidAmount, "QAR")}
                    tone="#047857"
                  />
                  <MiniStat
                    label="Pending Amount"
                    value={money(summary.pendingAmount, "QAR")}
                    tone="#b45309"
                  />
                  <MiniStat
                    label="Failed Amount"
                    value={money(summary.failedAmount, "QAR")}
                    tone="#b91c1c"
                  />
                  <MiniStat
                    label="Online Amount"
                    value={money(summary.onlineAmount, "QAR")}
                    tone="#1d4ed8"
                  />
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <Button variant="dark" onClick={() => setOpenReport(true)}>
                    Generate Report
                  </Button>
                  <Button variant="secondary" onClick={exportPayments}>
                    Export Current Data
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <Modal
          open={openCreate}
          title="Create Payment"
          onClose={() => !saving && setOpenCreate(false)}
          width={900}
          footer={
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setOpenCreate(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={onCreate} disabled={saving}>
                {saving ? "Creating..." : "Create Payment"}
              </Button>
            </div>
          }
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Event
              </div>
              <Select
                value={form.eventId}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    eventId: e.target.value,
                  }))
                }
              >
                <option value="">Select event</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.code ? ` (${e.code})` : ""}
                  </option>
                ))}
              </Select>
              {selectedEventDoc ? (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  Registration Fee:{" "}
                  <b style={{ color: NAVY }}>
                    {money(
                      selectedEventDoc.registrationFee,
                      selectedEventDoc.currency,
                    )}
                  </b>
                </div>
              ) : null}
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Enrollment ID
              </div>
              <Input
                placeholder="Optional enrollment id"
                value={form.enrollmentId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, enrollmentId: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                User ID
              </div>
              <Input
                placeholder="Optional user id"
                value={form.userId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, userId: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Participant ID
              </div>
              <Input
                placeholder="Optional participant id"
                value={form.participantId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, participantId: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Amount
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, amount: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Currency
              </div>
              <Input
                value={form.currency}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    currency: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Payment Method
              </div>
              <Select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm((p) => ({ ...p, paymentMethod: e.target.value }))
                }
              >
                <option value="CASH">CASH</option>
                <option value="ONLINE">ONLINE</option>
              </Select>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Payment Status
              </div>
              <Select
                value={form.paymentStatus}
                onChange={(e) =>
                  setForm((p) => ({ ...p, paymentStatus: e.target.value }))
                }
              >
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
                <option value="FAILED">FAILED</option>
                <option value="REFUNDED">REFUNDED</option>
                <option value="CANCELLED">CANCELLED</option>
              </Select>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Gateway
              </div>
              <Input
                placeholder="e.g. MyFatoorah / Stripe"
                value={form.gateway}
                onChange={(e) =>
                  setForm((p) => ({ ...p, gateway: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Transaction ID
              </div>
              <Input
                placeholder="Optional transaction id"
                value={form.transactionId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, transactionId: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Invoice No
              </div>
              <Input
                placeholder="Auto-generated if empty"
                value={form.invoiceNo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, invoiceNo: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Receipt No
              </div>
              <Input
                placeholder="Auto-generated if payment is PAID"
                value={form.receiptNo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, receiptNo: e.target.value }))
                }
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Paid At
              </div>
              <Input
                type="datetime-local"
                value={form.paidAt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, paidAt: e.target.value }))
                }
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Notes
              </div>
              <Textarea
                placeholder="Add internal notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>
          </div>
        </Modal>

        <Modal
          open={openView}
          title="Payment Details"
          onClose={() => setOpenView(false)}
          width={1080}
        >
          {activeRow ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  border: "1px solid rgba(15,23,42,.08)",
                  borderRadius: 20,
                  background:
                    "radial-gradient(circle at top right, rgba(225,29,46,.06), transparent 28%), #fff",
                }}
              >
                {getAcademyLogo(activeRow, academies, effectiveAcademyId) ||
                selectedAcademyLogo ? (
                  <div
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: 16,
                      overflow: "hidden",
                      background: "#fff",
                      border: "1px solid rgba(15,23,42,.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={
                        getAcademyLogo(
                          activeRow,
                          academies,
                          effectiveAcademyId,
                        ) || selectedAcademyLogo
                      }
                      alt="Academy Logo"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        padding: 8,
                      }}
                    />
                  </div>
                ) : null}

                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>
                    {getAcademyName(activeRow) || selectedAcademyName}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                    {getEventName(activeRow)} •{" "}
                    {activeRow?.invoiceNo || "No Invoice Number"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <MiniStat
                  label="Amount"
                  value={money(activeRow?.amount, activeRow?.currency || "QAR")}
                  tone="#0f172a"
                />
                <MiniStat
                  label="Status"
                  value={String(
                    activeRow?.paymentStatus || "PENDING",
                  ).toUpperCase()}
                  tone="#047857"
                />
                <MiniStat
                  label="Method"
                  value={String(
                    activeRow?.paymentMethod || "CASH",
                  ).toUpperCase()}
                  tone="#1d4ed8"
                />
                <MiniStat
                  label="Paid At"
                  value={fmtDateOnly(activeRow?.paidAt)}
                  tone="#334155"
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <SectionCard style={{ padding: 16 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: NAVY,
                      marginBottom: 12,
                    }}
                  >
                    Reference Information
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <b>Invoice No:</b> {activeRow?.invoiceNo || "—"}
                    </div>
                    <div>
                      <b>Receipt No:</b> {activeRow?.receiptNo || "—"}
                    </div>
                    <div>
                      <b>Transaction ID:</b> {activeRow?.transactionId || "—"}
                    </div>
                    <div>
                      <b>Gateway:</b> {activeRow?.gateway || "—"}
                    </div>
                    <div>
                      <b>Created:</b> {fmtDate(activeRow?.createdAt)}
                    </div>
                    <div>
                      <b>Updated:</b> {fmtDate(activeRow?.updatedAt)}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard style={{ padding: 16 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: NAVY,
                      marginBottom: 12,
                    }}
                  >
                    Participant & Event
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <b>Participant:</b> {getParticipantName(activeRow)}
                    </div>
                    <div>
                      <b>Email:</b> {getParticipantEmail(activeRow)}
                    </div>
                    <div>
                      <b>Bib No:</b> {getParticipantBib(activeRow)}
                    </div>
                    <div>
                      <b>Event:</b> {getEventName(activeRow)}
                    </div>
                    <div>
                      <b>Event Code:</b> {getEventCode(activeRow)}
                    </div>
                    <div>
                      <b>Academy:</b>{" "}
                      {getAcademyName(activeRow) || selectedAcademyName}
                    </div>
                  </div>
                </SectionCard>
              </div>

              <SectionCard style={{ padding: 16 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    color: NAVY,
                    marginBottom: 12,
                  }}
                >
                  Payment History
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {paymentHistoryEntries.length ? (
                    paymentHistoryEntries.map((item, idx) => (
                      <div
                        key={`${item.label}-${idx}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: 12,
                          border: "1px solid rgba(15,23,42,.08)",
                          borderRadius: 16,
                          background: "#fff",
                        }}
                      >
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            background: item.tone,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, color: NAVY }}>
                            {item.label}
                          </div>
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 13,
                              marginTop: 4,
                            }}
                          >
                            {fmtDate(item.at)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#64748b" }}>No history available</div>
                  )}
                </div>
              </SectionCard>

              {activeRow?.notes ? (
                <SectionCard style={{ padding: 16 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: NAVY,
                      marginBottom: 10,
                    }}
                  >
                    Notes
                  </div>
                  <div style={{ color: "#475569", lineHeight: 1.6 }}>
                    {activeRow.notes}
                  </div>
                </SectionCard>
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => printDocument(activeRow, "INVOICE")}
                >
                  Generate Invoice
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    String(activeRow?.paymentStatus || "").toUpperCase() !==
                    "PAID"
                  }
                  onClick={() => printDocument(activeRow, "RECEIPT")}
                >
                  Generate Receipt
                </Button>
                <Button
                  variant="dark"
                  onClick={() => openEmailModal(activeRow, "INVOICE")}
                >
                  Send by Email
                </Button>
              </div>
            </div>
          ) : null}
        </Modal>

        <Modal
          open={openEmail}
          title={`Send ${
            emailForm.type === "RECEIPT" ? "Receipt" : "Invoice"
          } by Email`}
          onClose={() => !emailBusy && setOpenEmail(false)}
          width={760}
          footer={
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setOpenEmail(false)}
                disabled={emailBusy}
              >
                Cancel
              </Button>
              <Button
                variant="dark"
                onClick={sendDocumentByEmail}
                disabled={emailBusy}
              >
                {emailBusy ? "Sending..." : "Send Email"}
              </Button>
            </div>
          }
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Document Type
              </div>
              <Select
                value={emailForm.type}
                onChange={(e) =>
                  setEmailForm((p) => ({ ...p, type: e.target.value }))
                }
              >
                <option value="INVOICE">INVOICE</option>
                <option value="RECEIPT">RECEIPT</option>
              </Select>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                To
              </div>
              <Input
                type="email"
                placeholder="Recipient email"
                value={emailForm.to}
                onChange={(e) =>
                  setEmailForm((p) => ({ ...p, to: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Subject
              </div>
              <Input
                placeholder="Email subject"
                value={emailForm.subject}
                onChange={(e) =>
                  setEmailForm((p) => ({ ...p, subject: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Message
              </div>
              <Textarea
                placeholder="Email message"
                value={emailForm.message}
                onChange={(e) =>
                  setEmailForm((p) => ({ ...p, message: e.target.value }))
                }
              />
            </div>
          </div>
        </Modal>

        <Modal
          open={openReport}
          title="Generate Payment Report"
          onClose={() => !reportBusy && setOpenReport(false)}
          width={900}
          footer={
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setOpenReport(false)}
                disabled={reportBusy}
              >
                Cancel
              </Button>
              <Button
                variant="dark"
                onClick={generateReportNow}
                disabled={reportBusy}
              >
                {reportBusy
                  ? "Generating..."
                  : reportForm.sendEmail
                    ? "Send Report"
                    : "Generate Report"}
              </Button>
            </div>
          }
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                From Date
              </div>
              <Input
                type="date"
                value={reportForm.from}
                onChange={(e) =>
                  setReportForm((p) => ({ ...p, from: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                To Date
              </div>
              <Input
                type="date"
                value={reportForm.to}
                onChange={(e) =>
                  setReportForm((p) => ({ ...p, to: e.target.value }))
                }
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Event
              </div>
              <Select
                value={reportForm.eventId}
                onChange={(e) =>
                  setReportForm((p) => ({ ...p, eventId: e.target.value }))
                }
              >
                <option value="">All events</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.code ? ` (${e.code})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Status
              </div>
              <Select
                value={reportForm.paymentStatus}
                onChange={(e) =>
                  setReportForm((p) => ({
                    ...p,
                    paymentStatus: e.target.value,
                  }))
                }
              >
                {STATUS_OPTIONS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Method
              </div>
              <Select
                value={reportForm.paymentMethod}
                onChange={(e) =>
                  setReportForm((p) => ({
                    ...p,
                    paymentMethod: e.target.value,
                  }))
                }
              >
                {METHOD_OPTIONS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                Report Name
              </div>
              <Input
                placeholder="Optional custom report name"
                value={reportForm.reportName}
                onChange={(e) =>
                  setReportForm((p) => ({ ...p, reportName: e.target.value }))
                }
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "grid", gap: 10 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 14,
                  color: NAVY,
                  fontWeight: 700,
                }}
              >
                <CheckBox
                  checked={reportForm.includeSummary}
                  onChange={(e) =>
                    setReportForm((p) => ({
                      ...p,
                      includeSummary: e.target.checked,
                    }))
                  }
                />
                Include summary metrics
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 14,
                  color: NAVY,
                  fontWeight: 700,
                }}
              >
                <CheckBox
                  checked={reportForm.sendEmail}
                  onChange={(e) =>
                    setReportForm((p) => ({
                      ...p,
                      sendEmail: e.target.checked,
                    }))
                  }
                />
                Send report by email instead of direct export
              </label>
            </div>

            {reportForm.sendEmail ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                    marginBottom: 6,
                  }}
                >
                  Email To
                </div>
                <Input
                  type="email"
                  placeholder="Recipient email address"
                  value={reportForm.emailTo}
                  onChange={(e) =>
                    setReportForm((p) => ({ ...p, emailTo: e.target.value }))
                  }
                />
              </div>
            ) : null}
          </div>
        </Modal>

        {loadingBoot ? (
          <div
            style={{
              color: "#64748b",
              fontSize: 13,
              textAlign: "center",
              padding: 6,
            }}
          >
            Loading configuration...
          </div>
        ) : null}
      </div>
    </div>
  );
}
