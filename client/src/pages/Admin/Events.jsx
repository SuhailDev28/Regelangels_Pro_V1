import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import {
  getEffectiveAcademy,
  getRole,
  getSelectedAcademy,
  isSuperAdmin,
} from "../../lib/auth.js";

/**
 * Events.jsx — ENTERPRISE CONTROL CENTER
 * ✅ Academy-aware multi-academy event control
 * ✅ Global search support from AdminDashboard
 * ✅ KPI cards + scope bar + quick filters
 * ✅ Desktop table / tablet cards / mobile cards
 * ✅ Create / Edit / Delete
 * ✅ CSV export
 * ✅ Refresh
 * ✅ Sticky table head
 * ✅ Date range and status filters
 * ✅ Super Admin scope-required state
 * ✅ Clean control-center layout
 * ✅ FIXED: supports array/object API responses
 * ✅ FIXED: safer status normalization
 * ✅ FIXED: load refreshes academy scope before fetching
 * ✅ NEW: registration fee support
 * ✅ NEW: payment method fixed to CASH
 */

const PAGE_SIZE = 8;
const STATUS_FILTERS = ["ALL", "DRAFT", "LIVE", "CLOSED"];
const QUICK_FILTERS = [
  { key: "ALL", label: "All Events" },
  { key: "LIVE", label: "Live Now" },
  { key: "DRAFT", label: "Drafts" },
  { key: "CLOSED", label: "Closed" },
];
const tableCols = "70px 2.2fr 1fr 1.05fr .9fr 220px";
const RED = "var(--ra-accent, #e11d2e)";

/* ----------------------------- Icons ----------------------------- */

function SvgIcon({
  children,
  size = 18,
  stroke = "currentColor",
  strokeWidth = 1.85,
  fill = "none",
  style,
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", ...style }}
    >
      {children}
    </svg>
  );
}

const IconCalendar = (p) => (
  <SvgIcon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M16 3v4M8 3v4M3 9h18" />
  </SvgIcon>
);

const IconSearch = (p) => (
  <SvgIcon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </SvgIcon>
);

const IconRefresh = (p) => (
  <SvgIcon {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </SvgIcon>
);

const IconDownload = (p) => (
  <SvgIcon {...p}>
    <path d="M12 3v11" />
    <path d="m8 10 4 4 4-4" />
    <path d="M4 20h16" />
  </SvgIcon>
);

const IconEdit = (p) => (
  <SvgIcon {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
  </SvgIcon>
);

const IconTrash = (p) => (
  <SvgIcon {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </SvgIcon>
);

const IconPlus = (p) => (
  <SvgIcon {...p}>
    <path d="M12 5v14M5 12h14" />
  </SvgIcon>
);

const IconClose = (p) => (
  <SvgIcon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </SvgIcon>
);

const IconReset = (p) => (
  <SvgIcon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 3v6h6" />
  </SvgIcon>
);

const IconClock = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </SvgIcon>
);

const IconBuilding = (p) => (
  <SvgIcon {...p}>
    <path d="M4 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14" />
    <path d="M2 20h20" />
    <path d="M8 8h.01M12 8h.01M8 12h.01M12 12h.01M8 16h.01M12 16h.01M18 10h.01M18 14h.01" />
  </SvgIcon>
);

const IconFile = (p) => (
  <SvgIcon {...p}>
    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v5h5" />
  </SvgIcon>
);

const IconStatusDraft = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l2.5 1.5" />
  </SvgIcon>
);

const IconStatusLive = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
  </SvgIcon>
);

const IconStatusClosed = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </SvgIcon>
);

const IconFunnel = (p) => (
  <SvgIcon {...p}>
    <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />
  </SvgIcon>
);

const IconSpark = (p) => (
  <SvgIcon {...p}>
    <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
  </SvgIcon>
);

/* ----------------------------- Main ----------------------------- */

export default function Events({ searchQuery = "" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [q, setQ] = useState(String(searchQuery || ""));
  const qDebounced = useDebouncedValue(q, 250);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [venue, setVenue] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [registrationFee, setRegistrationFee] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const [eName, setEName] = useState("");
  const [eCode, setECode] = useState("");
  const [eVenue, setEVenue] = useState("");
  const [eNotes, setENotes] = useState("");
  const [eStartDate, setEStartDate] = useState("");
  const [eEndDate, setEEndDate] = useState("");
  const [eStatus, setEStatus] = useState("DRAFT");
  const [eRegistrationFee, setERegistrationFee] = useState("");
  const [ePaymentMethod, setEPaymentMethod] = useState("CASH");

  const [confirmBox, setConfirmBox] = useState(null);

  const [viewport, setViewport] = useState(() => {
    try {
      return window.innerWidth || 1400;
    } catch {
      return 1400;
    }
  });

  const [academyCtx, setAcademyCtx] = useState(() => getEffectiveAcademy());
  const [role, setRoleState] = useState(() => getRole());
  const [selectedAcademyCtx, setSelectedAcademyCtx] = useState(() =>
    getSelectedAcademy(),
  );

  const isMobile = viewport <= 680;
  const isTablet = viewport > 680 && viewport <= 1100;

  const superAdminMode = useMemo(
    () => String(role || "").toUpperCase() === "SUPER_ADMIN" || isSuperAdmin(),
    [role],
  );

  const scopeRequired = useMemo(() => {
    if (!superAdminMode) return false;
    return !(
      selectedAcademyCtx?._id ||
      selectedAcademyCtx?.id ||
      selectedAcademyCtx?.academyId
    );
  }, [superAdminMode, selectedAcademyCtx]);

  const academyName = academyCtx?.academyName || "Academy";
  const academyCode = academyCtx?.academyCode || "";
  const academySource = academyCtx?.source || "user";

  useEffect(() => {
    setQ(String(searchQuery || ""));
  }, [searchQuery]);

  useEffect(() => {
    function onResize() {
      setViewport(window.innerWidth || 1400);
    }

    function syncScope() {
      setAcademyCtx(getEffectiveAcademy());
      setRoleState(getRole());
      setSelectedAcademyCtx(getSelectedAcademy());
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("focus", syncScope);
    window.addEventListener("storage", syncScope);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("focus", syncScope);
      window.removeEventListener("storage", syncScope);
    };
  }, []);

  async function load() {
    const nextAcademy = getEffectiveAcademy();
    const nextRole = getRole();
    const nextSelected = getSelectedAcademy();

    setAcademyCtx(nextAcademy);
    setRoleState(nextRole);
    setSelectedAcademyCtx(nextSelected);

    const needsScope =
      String(nextRole || "").toUpperCase() === "SUPER_ADMIN" &&
      !(nextSelected?._id || nextSelected?.id || nextSelected?.academyId);

    if (needsScope) {
      setRows([]);
      setLoading(false);
      setErr("");
      return;
    }

    setLoading(true);
    setErr("");
    try {
      if (typeof api?.adminEvents !== "function") {
        throw new Error(
          "api.adminEvents is missing. Update client/src/lib/api.js",
        );
      }
      const data = await api.adminEvents();
      setRows(toArray(data));
    } catch (e) {
      setErr(e?.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scopeRequired,
    academyCtx?.academyId,
    selectedAcademyCtx?._id,
    selectedAcademyCtx?.id,
    selectedAcademyCtx?.academyId,
  ]);

  const filtered = useMemo(() => {
    const s = qDebounced.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0) : null;
    const toTs = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : null;

    return (rows || []).filter((r) => {
      const rowStatus = getRowStatus(r);
      if (statusFilter !== "ALL" && rowStatus !== statusFilter) return false;

      const rowDateValue =
        r.startDate ||
        r.startsAt ||
        r.startAt ||
        r.date ||
        r.endDate ||
        r.endsAt ||
        r.endAt;
      const rowTime = rowDateValue ? new Date(rowDateValue).getTime() : null;

      if (fromTs && rowTime && rowTime < fromTs) return false;
      if (toTs && rowTime && rowTime > toTs) return false;

      if (!s) return true;

      const n = String(r.name || r.title || "").toLowerCase();
      const c = String(r.code || "").toLowerCase();
      const v = String(r.venue || r.location || "").toLowerCase();
      const nt = String(r.notes || r.note || "").toLowerCase();
      const st = String(
        r.startDate || r.startsAt || r.startAt || "",
      ).toLowerCase();
      const en = String(r.endDate || r.endsAt || r.endAt || "").toLowerCase();
      const ss = String(rowStatus).toLowerCase();
      const fee = String(
        r.registrationFee ?? r.fee ?? r.registration_amount ?? "",
      ).toLowerCase();
      const pm = String(
        r.paymentMethod || r.payment_method || "CASH",
      ).toLowerCase();

      return [n, c, v, nt, st, en, ss, fee, pm].some((x) => x.includes(s));
    });
  }, [rows, qDebounced, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, statusFilter, dateFrom, dateTo, academyCtx?.academyId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const draft = rows.filter((r) => getRowStatus(r) === "DRAFT").length;
    const live = rows.filter((r) => getRowStatus(r) === "LIVE").length;
    const closed = rows.filter((r) => getRowStatus(r) === "CLOSED").length;
    const upcoming = rows.filter((r) => isUpcomingEvent(r)).length;
    return { total, draft, live, closed, upcoming };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paged = useMemo(() => {
    const startIdx = (page - 1) * PAGE_SIZE;
    return filtered.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (qDebounced.trim()) n += 1;
    if (statusFilter !== "ALL") n += 1;
    if (dateFrom) n += 1;
    if (dateTo) n += 1;
    return n;
  }, [qDebounced, statusFilter, dateFrom, dateTo]);

  function getRowId(r) {
    return String(r?._id || r?.id || r?.eventId || "");
  }

  function normalizeCode(s) {
    return String(s || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .toUpperCase();
  }

  function toApiDate(v) {
    if (!v) return undefined;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  }

  function toInputDate(v) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function normalizeMoney(v) {
    if (v === "" || v === null || typeof v === "undefined") return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return Number(n.toFixed(2));
  }

  function getRowFee(r) {
    const n = Number(
      r?.registrationFee ?? r?.fee ?? r?.registration_amount ?? 0,
    );
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function getRowPaymentMethod(r) {
    return String(
      r?.paymentMethod || r?.payment_method || "CASH",
    ).toUpperCase();
  }

  function resetCreateForm() {
    setName("");
    setCode("");
    setVenue("");
    setNotes("");
    setStartDate("");
    setEndDate("");
    setStatus("DRAFT");
    setRegistrationFee("");
    setPaymentMethod("CASH");
  }

  function clearFilters() {
    setQ("");
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function validateDates(start, end) {
    if (!start || !end) return "";
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (!Number.isNaN(s) && !Number.isNaN(e) && e < s) {
      return "End date cannot be earlier than start date";
    }
    return "";
  }

  async function createEvent() {
    setMsg("");
    setErr("");

    if (scopeRequired) {
      setErr("Select an academy scope first.");
      return;
    }

    const n = name.trim();
    const c = normalizeCode(code || n);
    const fee = normalizeMoney(registrationFee);

    if (!n) return setErr("Event name is required");
    if (fee === null) return setErr("Registration fee must be a valid amount");

    const dateErr = validateDates(startDate, endDate);
    if (dateErr) return setErr(dateErr);

    try {
      setBusy(true);

      if (typeof api?.createEvent !== "function") {
        throw new Error("api.createEvent is missing in api.js");
      }

      await api.createEvent({
        name: n,
        code: c,
        venue: venue.trim(),
        notes: notes.trim(),
        status,
        startDate: toApiDate(startDate),
        endDate: toApiDate(endDate),
        registrationFee: fee,
        paymentMethod: "CASH",
      });

      resetCreateForm();
      setMsg("Event created successfully.");
      await load();
    } catch (e) {
      setErr(e?.message || "Failed to create event");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(r) {
    if (!getRowId(r)) return;

    setEditRow(r);

    const rName = String(r.name || r.title || "").trim();
    const rStatus = getRowStatus(r);

    setEName(rName);
    setECode(String(r.code || "").trim());
    setEVenue(String(r.venue || r.location || "").trim());
    setENotes(String(r.notes || r.note || "").trim());
    setEStartDate(
      toInputDate(r.startDate || r.startsAt || r.startAt || r.date),
    );
    setEEndDate(toInputDate(r.endDate || r.endsAt || r.endAt || ""));
    setEStatus(rStatus);
    setERegistrationFee(
      String(r.registrationFee ?? r.fee ?? r.registration_amount ?? ""),
    );
    setEPaymentMethod(
      String(r.paymentMethod || r.payment_method || "CASH").toUpperCase(),
    );

    setEditOpen(true);
    setMsg("");
    setErr("");
  }

  async function saveEdit() {
    const rowId = getRowId(editRow);
    if (!rowId) return;

    const n = eName.trim();
    const c = normalizeCode(eCode || n);
    const fee = normalizeMoney(eRegistrationFee);

    if (!n) return setErr("Event name is required");
    if (fee === null) return setErr("Registration fee must be a valid amount");

    const dateErr = validateDates(eStartDate, eEndDate);
    if (dateErr) return setErr(dateErr);

    try {
      setBusy(true);
      setErr("");

      if (typeof api?.updateEvent !== "function") {
        throw new Error("api.updateEvent is missing in api.js");
      }

      await api.updateEvent(rowId, {
        name: n,
        code: c,
        venue: eVenue.trim(),
        notes: eNotes.trim(),
        status: eStatus,
        startDate: toApiDate(eStartDate),
        endDate: toApiDate(eEndDate),
        registrationFee: fee,
        paymentMethod: "CASH",
      });

      setEditOpen(false);
      setEditRow(null);
      setMsg("Event updated successfully.");
      await load();
    } catch (e) {
      setErr(e?.message || "Failed to update event");
    } finally {
      setBusy(false);
    }
  }

  function askDelete(r) {
    const rowId = getRowId(r);
    if (!rowId) return;

    const label = r.name || r.title || "this event";

    setConfirmBox({
      title: "Delete event?",
      body: `This will permanently delete "${label}". This action cannot be undone.`,
      yesText: "Delete",
      onYes: async () => {
        try {
          setBusy(true);
          setErr("");
          if (typeof api?.deleteEvent !== "function") {
            throw new Error("api.deleteEvent is missing in api.js");
          }
          await api.deleteEvent(rowId);
          setMsg("Event deleted successfully.");
          await load();
        } catch (e) {
          setErr(e?.message || "Failed to delete event");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function exportCsv() {
    const header = [
      "Name",
      "Code",
      "Venue",
      "Status",
      "Registration Fee",
      "Payment Method",
      "Start Date",
      "End Date",
      "Notes",
      "Academy Scope",
    ];

    const body = filtered.map((r) => [
      csvSafe(r.name || r.title || ""),
      csvSafe(r.code || ""),
      csvSafe(r.venue || r.location || ""),
      csvSafe(getRowStatus(r)),
      csvSafe(r.registrationFee ?? r.fee ?? r.registration_amount ?? 0),
      csvSafe(r.paymentMethod || r.payment_method || "CASH"),
      csvSafe(r.startDate || r.startsAt || r.startAt || ""),
      csvSafe(r.endDate || r.endsAt || r.endAt || ""),
      csvSafe(r.notes || r.note || ""),
      csvSafe(academyCode ? `${academyName} (${academyCode})` : academyName),
    ]);

    const csv = [header, ...body]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date();
    const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    a.href = url;
    a.download = `events-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section style={wrap}>
      <StyleTag />

      <div className="raHero">
        <div className="raHeroLeft">
          <div className="raPageEyebrow">
            <span className="raEyebrowIcon">
              <IconCalendar size={12} />
            </span>
            EVENTS CONTROL CENTER
          </div>

          <h3 style={h3}>Events Management</h3>

          <div style={sub}>
            Create, supervise and maintain competition events with an
            academy-scoped, enterprise-grade operations workflow.
          </div>

          <div className="raHeroPills">
            <span className="raHeroPill">
              <IconSpark size={13} />
              Control Center
            </span>
            <span className="raHeroPill">
              <IconClock size={13} />
              {stats.upcoming} upcoming
            </span>
            <span className="raHeroPill">
              <IconFunnel size={13} />
              {activeFilterCount} active filter
              {activeFilterCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="raStats">
          <StatCard
            label="Total Events"
            value={stats.total}
            tone="default"
            icon={<IconCalendar size={18} />}
          />
          <StatCard
            label="Draft"
            value={stats.draft}
            tone="draft"
            icon={<IconStatusDraft size={18} />}
          />
          <StatCard
            label="Live"
            value={stats.live}
            tone="live"
            icon={<IconStatusLive size={18} />}
          />
          <StatCard
            label="Closed"
            value={stats.closed}
            tone="closed"
            icon={<IconStatusClosed size={18} />}
          />
        </div>
      </div>

      <div className="raScopeBar">
        <div className="raScopeLeft">
          <div className="raScopeLabel">ACTIVE ACADEMY SCOPE</div>
          <div className="raScopeValue">
            {scopeRequired
              ? "No academy selected"
              : academyCode
                ? `${academyName} (${academyCode})`
                : academyName}
          </div>
        </div>

        <div className="raScopeMeta">
          <span className="raScopePill">
            Role: {String(role || "ADMIN").replaceAll("_", " ")}
          </span>
          <span className="raScopePill">
            Scope: {academySource === "selected" ? "Scoped" : "Direct"}
          </span>
          <button
            className="raBtn"
            type="button"
            onClick={load}
            disabled={loading || busy || scopeRequired}
          >
            <IconRefresh size={14} />
            Refresh Scope Data
          </button>
        </div>
      </div>

      {scopeRequired ? (
        <div className="raScopeRequired">
          <div className="raScopeRequiredTitle">Academy scope required</div>
          <div className="raScopeRequiredSub">
            You are signed in as Super Admin. Select an academy from the academy
            scope switcher to load event data for that academy.
          </div>
        </div>
      ) : null}

      {err ? <div style={errBox}>{err}</div> : null}
      {msg ? <div style={okBox}>{msg}</div> : null}

      {!scopeRequired ? (
        <>
          <div className="raControlBar">
            <div className="raSearchBox raControlSearch">
              <span className="raSearchIcon">
                <IconSearch size={15} />
              </span>
              <input
                className="raInput raInputSearch"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search event name, code, venue, notes, fee or date..."
              />
            </div>

            <div className="raControlActions">
              <button
                className="raBtn"
                type="button"
                onClick={load}
                disabled={loading || busy}
              >
                <IconRefresh size={15} />
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <button className="raBtn" type="button" onClick={exportCsv}>
                <IconDownload size={15} />
                Export CSV
              </button>
              <button className="raBtn" type="button" onClick={clearFilters}>
                <IconReset size={15} />
                Clear Filters
              </button>
            </div>
          </div>

          <div className="raQuickFilters">
            {QUICK_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`raQuickChip ${
                  statusFilter === item.key ? "active" : ""
                }`}
                onClick={() => setStatusFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="raLayout">
            <div className="raCard raCard2">
              <div className="raSectionHead">
                <div>
                  <div className="raCardTitle">Create New Event</div>
                  <div className="raCardSub">
                    Define the event lifecycle for assignments, scoring,
                    certificates and reporting.
                  </div>
                </div>
              </div>

              <div className="raGrid2" style={{ marginTop: 14 }}>
                <Field label="Event Name *">
                  <input
                    className="raInput"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rebel Angels Cup 2026"
                  />
                </Field>

                <Field label="Code (unique)">
                  <input
                    className="raInput"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. RAC-2026"
                    onBlur={() => setCode((v) => normalizeCode(v || name))}
                  />
                </Field>

                <Field label="Venue">
                  <input
                    className="raInput"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. Doha Sports Hall"
                  />
                </Field>

                <Field label="Status *">
                  <select
                    className="raInput"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="LIVE">LIVE</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </Field>

                <Field label="Registration Fee">
                  <input
                    className="raInput"
                    type="number"
                    min="0"
                    step="0.01"
                    value={registrationFee}
                    onChange={(e) => setRegistrationFee(e.target.value)}
                    placeholder="e.g. 100"
                  />
                </Field>

                <Field label="Payment Method">
                  <input
                    className="raInput"
                    value={paymentMethod}
                    readOnly
                    disabled
                  />
                </Field>

                <Field label="Start Date">
                  <input
                    className="raInput"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>

                <Field label="End Date">
                  <input
                    className="raInput"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Field>

                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Notes">
                    <textarea
                      className="raInput"
                      style={{ height: 100, resize: "vertical" }}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Internal remarks, logistics, admin notes or special instructions..."
                    />
                  </Field>
                </div>
              </div>

              <div className="raFormFooter">
                <button
                  className="raBtn"
                  onClick={resetCreateForm}
                  disabled={busy}
                  type="button"
                >
                  <IconReset size={15} />
                  Reset
                </button>
                <button
                  className="raBtnPrimary"
                  onClick={createEvent}
                  disabled={busy}
                  type="button"
                >
                  <IconPlus size={15} />
                  {busy ? "Processing..." : "Create Event"}
                </button>
              </div>
            </div>

            <div className="raRightCol">
              <div className="raCard raCard2">
                <div className="raCardTitle">Filters & Visibility</div>
                <div className="raCardSub">
                  Narrow results by lifecycle status and event schedule.
                </div>

                <div className="raFilterChips">
                  {STATUS_FILTERS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`raChip ${
                        statusFilter === item ? "active" : ""
                      }`}
                      onClick={() => setStatusFilter(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div
                  className="raGrid2 raGrid2Compact"
                  style={{ marginTop: 12 }}
                >
                  <Field label="From">
                    <input
                      className="raInput"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </Field>

                  <Field label="To">
                    <input
                      className="raInput"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="raRightActions">
                  <div className="raMiniText">
                    Showing <b>{filtered.length}</b> of <b>{rows.length}</b>{" "}
                    event(s)
                  </div>
                  <button
                    type="button"
                    className="raBtn"
                    onClick={clearFilters}
                  >
                    <IconReset size={14} />
                    Clear
                  </button>
                </div>
              </div>

              <div className="raCard raCard2">
                <div className="raCardTitle">Operational Summary</div>
                <div className="raCardSub">
                  High-level visibility for administrators and coordinators.
                </div>

                <div className="raSummaryList">
                  <div className="raSummaryItem">
                    <span className="raSummaryLeft">
                      <IconStatusDraft size={14} />
                      Draft events
                    </span>
                    <b>{stats.draft}</b>
                  </div>
                  <div className="raSummaryItem">
                    <span className="raSummaryLeft">
                      <IconStatusLive size={14} />
                      Live events
                    </span>
                    <b>{stats.live}</b>
                  </div>
                  <div className="raSummaryItem">
                    <span className="raSummaryLeft">
                      <IconStatusClosed size={14} />
                      Closed events
                    </span>
                    <b>{stats.closed}</b>
                  </div>
                  <div className="raSummaryItem">
                    <span className="raSummaryLeft">
                      <IconClock size={14} />
                      Upcoming
                    </span>
                    <b>{stats.upcoming}</b>
                  </div>
                  <div className="raSummaryItem">
                    <span className="raSummaryLeft">
                      <IconFile size={14} />
                      Total records
                    </span>
                    <b>{stats.total}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="raCard raTableCard" style={{ marginTop: 16 }}>
            <div className="raTableHeadBar">
              <div>
                <div className="raCardTitle">Events Directory</div>
                <div className="raCardSub">
                  Review event records and manage operations directly.
                </div>
              </div>

              <div className="raToolbarSummary">
                <span className="raToolbarPill">
                  Page {page} / {totalPages}
                </span>
                <span className="raToolbarPill">
                  {filtered.length} filtered result
                  {filtered.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="raTableDesktop">
              <div className="raTableWrap">
                <div className="raTable">
                  <div
                    className="raThead raStickyHead"
                    style={{ gridTemplateColumns: tableCols }}
                  >
                    <div>#</div>
                    <div>Event</div>
                    <div>Code</div>
                    <div>Venue</div>
                    <div>Status</div>
                    <div style={{ textAlign: "right" }}>Actions</div>
                  </div>

                  {paged.map((r, i) => {
                    const rowId = getRowId(r);
                    const nm = r.name || r.title || "—";
                    const cd = r.code || "—";
                    const vn = r.venue || r.location || "—";
                    const st = getRowStatus(r);
                    const nt = String(r.notes || r.note || "").trim();
                    const fee = getRowFee(r);
                    const pm = getRowPaymentMethod(r);

                    return (
                      <div
                        key={rowId || i}
                        className="raTrow raRowHover"
                        style={{ gridTemplateColumns: tableCols }}
                      >
                        <div style={{ fontWeight: 950 }}>
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </div>

                        <div className="raNameCell">
                          <div className="raMainTitle">{nm}</div>
                          <div className="raSubText">
                            {fmtRange(
                              r.startDate || r.startsAt || r.startAt,
                              r.endDate || r.endsAt || r.endAt,
                            )}
                          </div>
                          <div className="raSubText">
                            Fee: QAR {fee.toFixed(2)} • Payment: {pm}
                          </div>
                          {nt ? (
                            <div className="raNotesLine">
                              {truncate(nt, 90)}
                            </div>
                          ) : null}
                        </div>

                        <div className="raMono">{cd}</div>

                        <div className="raVenueCell">
                          <span className="raVenueIcon">
                            <IconBuilding size={14} />
                          </span>
                          <span>{vn}</span>
                        </div>

                        <div>{renderStatusBadge(st)}</div>

                        <div className="raInlineActions">
                          <button
                            className="raBtnSmall"
                            type="button"
                            onClick={() => openEdit(r)}
                            disabled={!rowId || busy}
                          >
                            <IconEdit size={14} />
                            Edit
                          </button>
                          <button
                            className="raBtnSmallDanger"
                            type="button"
                            onClick={() => askDelete(r)}
                            disabled={!rowId || busy}
                          >
                            <IconTrash size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {!loading && paged.length === 0 ? (
                    <EmptyState
                      title="No events found"
                      sub="Try another filter or create a new event."
                    />
                  ) : null}

                  {loading ? (
                    <EmptyState
                      title="Loading events…"
                      sub="Please wait while records are being fetched."
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="raTabletList">
              {paged.map((r, i) => {
                const rowId = getRowId(r);
                const nm = r.name || r.title || "—";
                const cd = r.code || "—";
                const vn = r.venue || r.location || "—";
                const st = getRowStatus(r);
                const nt = String(r.notes || r.note || "").trim();
                const fee = getRowFee(r);
                const pm = getRowPaymentMethod(r);

                return (
                  <div key={rowId || i} className="raTabletCard">
                    <div className="raTabletTop">
                      <div className="raTabletTitleWrap">
                        <div className="raTabletIndex">
                          #{(page - 1) * PAGE_SIZE + i + 1}
                        </div>
                        <div className="raMainTitle">{nm}</div>
                        <div className="raSubText">
                          {fmtRange(
                            r.startDate || r.startsAt || r.startAt,
                            r.endDate || r.endsAt || r.endAt,
                          )}
                        </div>
                        <div className="raSubText">
                          Fee: QAR {fee.toFixed(2)} • Payment: {pm}
                        </div>
                      </div>

                      <div className="raTabletTopRight">
                        {renderStatusBadge(st)}
                      </div>
                    </div>

                    <div className="raTabletBottom">
                      <div className="raTabletMeta">
                        <div className="raTabletMetaItem">
                          <span>Code</span>
                          <b>{cd}</b>
                        </div>
                        <div className="raTabletMetaItem">
                          <span>Venue</span>
                          <b>{vn}</b>
                        </div>
                        {nt ? (
                          <div className="raTabletMetaItem raTabletMetaWide">
                            <span>Notes</span>
                            <b>{truncate(nt, 110)}</b>
                          </div>
                        ) : null}
                      </div>

                      <div className="raTabletActions">
                        <button
                          className="raBtnSmall"
                          type="button"
                          onClick={() => openEdit(r)}
                          disabled={!rowId || busy}
                        >
                          <IconEdit size={14} />
                          Edit
                        </button>
                        <button
                          className="raBtnSmallDanger"
                          type="button"
                          onClick={() => askDelete(r)}
                          disabled={!rowId || busy}
                        >
                          <IconTrash size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!loading && paged.length === 0 ? (
                <EmptyState
                  title="No events found"
                  sub="Try another filter or create a new event."
                />
              ) : null}

              {loading ? (
                <EmptyState
                  title="Loading events…"
                  sub="Please wait while records are being fetched."
                />
              ) : null}
            </div>

            <div className="raMobileList">
              {paged.map((r, i) => {
                const rowId = getRowId(r);
                const nm = r.name || r.title || "—";
                const cd = r.code || "—";
                const vn = r.venue || r.location || "—";
                const st = getRowStatus(r);
                const nt = String(r.notes || r.note || "").trim();
                const fee = getRowFee(r);
                const pm = getRowPaymentMethod(r);

                return (
                  <div key={rowId || i} className="raMobileCard">
                    <div className="raMobileCardHead">
                      <div>
                        <div className="raMobileIndex">
                          #{(page - 1) * PAGE_SIZE + i + 1}
                        </div>
                        <div className="raMainTitle">{nm}</div>
                      </div>

                      {renderStatusBadge(st)}
                    </div>

                    <div className="raMobileMeta">
                      <div className="raMobileMetaRow">
                        <span>Code</span>
                        <b>{cd}</b>
                      </div>
                      <div className="raMobileMetaRow">
                        <span>Venue</span>
                        <b>{vn}</b>
                      </div>
                      <div className="raMobileMetaRow">
                        <span>Fee</span>
                        <b>QAR {fee.toFixed(2)}</b>
                      </div>
                      <div className="raMobileMetaRow">
                        <span>Payment</span>
                        <b>{pm}</b>
                      </div>
                      <div className="raMobileMetaRow raMobileDateRow">
                        <span>Date</span>
                        <b>
                          {fmtRange(
                            r.startDate || r.startsAt || r.startAt,
                            r.endDate || r.endsAt || r.endAt,
                          )}
                        </b>
                      </div>
                      {nt ? (
                        <div className="raMobileMetaRow raMobileNotes">
                          <span>Notes</span>
                          <b>{truncate(nt, 120)}</b>
                        </div>
                      ) : null}
                    </div>

                    <div className="raMobileActions">
                      <button
                        className="raBtn"
                        type="button"
                        onClick={() => openEdit(r)}
                        disabled={!rowId || busy}
                      >
                        <IconEdit size={14} />
                        Edit
                      </button>
                      <button
                        className="raBtnDanger"
                        type="button"
                        onClick={() => askDelete(r)}
                        disabled={!rowId || busy}
                      >
                        <IconTrash size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}

              {!loading && paged.length === 0 ? (
                <EmptyState
                  title="No events found"
                  sub="Try another filter or create a new event."
                />
              ) : null}

              {loading ? (
                <EmptyState
                  title="Loading events…"
                  sub="Please wait while records are being fetched."
                />
              ) : null}
            </div>

            <div className="raPagination">
              <div className="raMiniText">
                Page <b>{page}</b> of <b>{totalPages}</b>
              </div>

              <div className="raPaginationBtns">
                <button
                  className="raBtn"
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </button>
                <button
                  className="raBtn"
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {editOpen ? (
        <div className="raModalOverlay" onMouseDown={() => setEditOpen(false)}>
          <div
            className="raModal"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 860 }}
          >
            <div className="raModalHead">
              <div>
                <div className="raModalTitle">Edit Event</div>
                <div className="raModalSub">
                  {editRow?.name || editRow?.title || "—"}
                </div>
              </div>

              <button
                className="raIconClose"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
                type="button"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="raGrid2" style={{ marginTop: 16 }}>
              <Field label="Event Name *">
                <input
                  className="raInput"
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                />
              </Field>

              <Field label="Code">
                <input
                  className="raInput"
                  value={eCode}
                  onChange={(e) => setECode(e.target.value)}
                  onBlur={() => setECode((v) => normalizeCode(v || eName))}
                />
              </Field>

              <Field label="Venue">
                <input
                  className="raInput"
                  value={eVenue}
                  onChange={(e) => setEVenue(e.target.value)}
                />
              </Field>

              <Field label="Status *">
                <select
                  className="raInput"
                  value={eStatus}
                  onChange={(e) => setEStatus(e.target.value)}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="LIVE">LIVE</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </Field>

              <Field label="Registration Fee">
                <input
                  className="raInput"
                  type="number"
                  min="0"
                  step="0.01"
                  value={eRegistrationFee}
                  onChange={(e) => setERegistrationFee(e.target.value)}
                />
              </Field>

              <Field label="Payment Method">
                <input
                  className="raInput"
                  value={ePaymentMethod || "CASH"}
                  readOnly
                  disabled
                />
              </Field>

              <Field label="Start Date">
                <input
                  className="raInput"
                  type="datetime-local"
                  value={eStartDate}
                  onChange={(e) => setEStartDate(e.target.value)}
                />
              </Field>

              <Field label="End Date">
                <input
                  className="raInput"
                  type="datetime-local"
                  value={eEndDate}
                  onChange={(e) => setEEndDate(e.target.value)}
                />
              </Field>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Notes">
                  <textarea
                    className="raInput"
                    style={{ height: 100, resize: "vertical" }}
                    value={eNotes}
                    onChange={(e) => setENotes(e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="raModalActions">
              <button
                className="raBtn"
                onClick={() => setEditOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="raBtnPrimary"
                onClick={saveEdit}
                disabled={busy}
                type="button"
              >
                <IconEdit size={15} />
                {busy ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmBox ? (
        <div className="raModalOverlay" onMouseDown={() => setConfirmBox(null)}>
          <div
            className="raModal raModalSmall"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="raModalHead">
              <div className="raModalTitle">{confirmBox.title}</div>
              <button
                className="raIconClose"
                onClick={() => setConfirmBox(null)}
                aria-label="Close"
                type="button"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="raConfirmText">{confirmBox.body}</div>

            <div className="raModalActions">
              <button
                className="raBtn"
                type="button"
                onClick={() => setConfirmBox(null)}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                className="raBtnDanger"
                type="button"
                disabled={busy}
                onClick={async () => {
                  const run = confirmBox.onYes;
                  setConfirmBox(null);
                  await run?.();
                }}
              >
                <IconTrash size={15} />
                {confirmBox.yesText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ---------------------- Helpers ---------------------- */

function csvSafe(v) {
  return String(v ?? "");
}

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function EmptyState({ title, sub }) {
  return (
    <div className="raEmpty">
      <div className="raEmptyTitle">{title}</div>
      <div className="raEmptySub">{sub}</div>
    </div>
  );
}

function StatCard({ label, value, tone = "default", icon }) {
  return (
    <div className={`raStatCard ${tone}`}>
      <div className="raStatTop">
        <span className="raStatIcon">{icon}</span>
        <div className="raStatLabel">{label}</div>
      </div>
      <div className="raStatValue">{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="raLabel">{label}</div>
      {children}
    </div>
  );
}

function useDebouncedValue(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function getRowStatus(r) {
  const raw = String(r?.status || "")
    .toUpperCase()
    .trim();
  if (raw === "DRAFT" || raw === "LIVE" || raw === "CLOSED") return raw;

  if (r?.isActive === false) return "CLOSED";
  if (r?.isActive === true) return "LIVE";

  return "DRAFT";
}

function isUpcomingEvent(r) {
  const s = r?.startDate || r?.startsAt || r?.startAt || r?.date;
  if (!s) return false;
  const ts = new Date(s).getTime();
  if (Number.isNaN(ts)) return false;
  return ts > Date.now();
}

function truncate(s, len = 80) {
  const v = String(s || "");
  if (v.length <= len) return v;
  return `${v.slice(0, len)}...`;
}

function fmtRange(a, b) {
  const fmt = (x) => {
    if (!x) return "";
    const d = new Date(x);
    if (Number.isNaN(d.getTime())) return String(x);
    return d.toLocaleString();
  };
  const A = fmt(a);
  const B = fmt(b);
  if (!A && !B) return "—";
  if (A && !B) return `Starts: ${A}`;
  if (!A && B) return `Ends: ${B}`;
  return `${A} → ${B}`;
}

function renderStatusBadge(st) {
  const v = String(st || "").toUpperCase();

  if (v === "LIVE") {
    return (
      <span className="raStatus on">
        <IconStatusLive size={12} />
        LIVE
      </span>
    );
  }

  if (v === "CLOSED") {
    return (
      <span className="raStatus off">
        <IconStatusClosed size={12} />
        CLOSED
      </span>
    );
  }

  return (
    <span className="raStatus draft">
      <IconStatusDraft size={12} />
      DRAFT
    </span>
  );
}

/* ---------------------- Styles ---------------------- */

const wrap = { maxWidth: 1320, margin: "0 auto" };
const h3 = {
  margin: "4px 0 0",
  fontSize: 24,
  fontWeight: 950,
  letterSpacing: "-0.02em",
};
const sub = { marginTop: 8, fontSize: 13, opacity: 0.72, fontWeight: 700 };

const okBox = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid rgba(16,185,129,0.22)",
  background:
    "linear-gradient(180deg, rgba(236,253,245,0.98), rgba(240,253,250,0.98))",
  color: "#065f46",
  fontWeight: 900,
};

const errBox = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid rgba(225,29,46,0.16)",
  background:
    "linear-gradient(180deg, rgba(255,241,242,0.98), rgba(255,245,245,0.98))",
  color: "var(--ra-accent, #e11d2e)",
  fontWeight: 900,
};

function StyleTag() {
  return (
    <style>{`
      .raHero{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:16px;
        flex-wrap:wrap;
      }

      .raHeroLeft{
        min-width:0;
        flex:1 1 420px;
      }

      .raHeroPills{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:14px;
      }

      .raHeroPill{
        display:inline-flex;
        align-items:center;
        gap:6px;
        height:34px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.95);
        font-size:12px;
        font-weight:900;
      }

      .raPageEyebrow{
        display:inline-flex;
        align-items:center;
        gap:8px;
        height:28px;
        padding:0 12px;
        border-radius:999px;
        background:rgba(255,241,242,0.95);
        border:1px solid rgba(225,29,46,0.16);
        color:${RED};
        font-size:11px;
        font-weight:900;
        letter-spacing:.08em;
      }

      .raEyebrowIcon{
        display:grid;
        place-items:center;
      }

      .raScopeBar{
        margin-top:14px;
        padding:14px 16px;
        border-radius:20px;
        border:1px solid rgba(17,24,39,0.08);
        background:linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.98));
        box-shadow:0 12px 30px rgba(2,8,23,0.05);
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
      }

      .raScopeLeft{
        min-width:0;
      }

      .raScopeLabel{
        font-size:11px;
        font-weight:950;
        letter-spacing:.08em;
        opacity:.68;
      }

      .raScopeValue{
        margin-top:4px;
        font-size:15px;
        font-weight:950;
        color:#0b1220;
        word-break:break-word;
      }

      .raScopeMeta{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        align-items:center;
      }

      .raScopePill{
        height:36px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.96);
        font-size:12px;
        font-weight:900;
        display:inline-flex;
        align-items:center;
      }

      .raScopeRequired{
        margin-top:14px;
        padding:16px;
        border-radius:20px;
        border:1px solid rgba(245,158,11,0.22);
        background:linear-gradient(180deg, rgba(255,251,235,0.98), rgba(254,252,232,0.98));
      }

      .raScopeRequiredTitle{
        font-size:16px;
        font-weight:950;
        color:#0b1220;
      }

      .raScopeRequiredSub{
        margin-top:8px;
        font-size:13px;
        line-height:1.55;
        opacity:.78;
        font-weight:800;
      }

      .raStats{
        display:grid;
        grid-template-columns:repeat(4, minmax(120px, 1fr));
        gap:12px;
        min-width:min(100%, 560px);
      }

      @media (max-width: 1000px){
        .raStats{
          grid-template-columns:repeat(2, minmax(120px, 1fr));
          width:100%;
        }
      }

      @media (max-width: 560px){
        .raStats{
          grid-template-columns:1fr 1fr;
          gap:10px;
        }
      }

      .raStatCard{
        padding:14px;
        border-radius:20px;
        border:1px solid rgba(17,24,39,0.08);
        background:linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.98));
        box-shadow:0 12px 30px rgba(2,8,23,0.06);
      }

      .raStatCard.live{
        background:linear-gradient(180deg, rgba(236,253,245,0.98), rgba(240,253,250,0.98));
        border-color:rgba(16,185,129,0.18);
      }

      .raStatCard.draft{
        background:linear-gradient(180deg, rgba(255,251,235,0.98), rgba(254,252,232,0.98));
        border-color:rgba(245,158,11,0.18);
      }

      .raStatCard.closed{
        background:linear-gradient(180deg, rgba(255,241,242,0.98), rgba(255,245,245,0.98));
        border-color:rgba(225,29,46,0.18);
      }

      .raStatTop{
        display:flex;
        align-items:center;
        gap:10px;
      }

      .raStatIcon{
        width:34px;
        height:34px;
        border-radius:12px;
        display:grid;
        place-items:center;
        background:rgba(15,23,42,0.04);
        color:${RED};
        flex:0 0 auto;
      }

      .raStatLabel{
        font-size:12px;
        opacity:.72;
        font-weight:800;
      }

      .raStatValue{
        margin-top:8px;
        font-size:28px;
        line-height:1;
        font-weight:950;
        letter-spacing:-0.03em;
      }

      .raControlBar{
        margin-top:16px;
        display:flex;
        gap:12px;
        align-items:center;
        justify-content:space-between;
        flex-wrap:wrap;
      }

      .raControlSearch{
        flex:1 1 360px;
        margin-top:0;
      }

      .raControlActions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }

      .raQuickFilters{
        margin-top:12px;
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .raQuickChip{
        height:36px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.96);
        font-size:12px;
        font-weight:900;
        cursor:pointer;
      }

      .raQuickChip.active{
        border-color:rgba(225,29,46,0.18);
        background:rgba(255,241,242,0.96);
        color:${RED};
      }

      .raLayout{
        display:grid;
        grid-template-columns:minmax(650px, 1.65fr) minmax(320px, 0.85fr);
        gap:16px;
        align-items:start;
        margin-top:16px;
      }

      .raRightCol{
        display:grid;
        gap:16px;
      }

      @media (max-width: 1180px){
        .raLayout{
          grid-template-columns:1.25fr .95fr;
        }
      }

      @media (max-width: 1020px){
        .raLayout{
          grid-template-columns:1fr;
        }
      }

      .raCard{
        background:linear-gradient(180deg, rgba(255,255,255,0.95), rgba(249,250,251,0.96));
        border:1px solid rgba(17,24,39,0.08);
        border-radius:24px;
        box-shadow:
          0 18px 52px rgba(2,8,23,0.07),
          inset 0 1px 0 rgba(255,255,255,0.55);
        backdrop-filter:blur(14px);
      }

      .raCard2{
        padding:20px;
        overflow:hidden;
      }

      @media (max-width: 640px){
        .raCard2{
          padding:16px;
          border-radius:20px;
        }
      }

      .raSectionHead{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
      }

      .raCardTitle{
        font-weight:950;
        font-size:17px;
        color:#0b1220;
      }

      .raCardSub{
        margin-top:6px;
        font-size:12px;
        opacity:0.72;
        font-weight:800;
        line-height:1.45;
      }

      .raGrid2{
        display:grid;
        grid-template-columns:repeat(2, minmax(0,1fr));
        gap:16px;
      }

      .raGrid2Compact{
        gap:12px;
      }

      @media (max-width: 900px){
        .raGrid2{
          grid-template-columns:1fr;
        }
      }

      .raLabel{
        font-size:12px;
        opacity:0.75;
        margin-bottom:6px;
        font-weight:800;
      }

      .raMiniText{
        font-size:12px;
        opacity:.75;
        font-weight:800;
      }

      .raMono{
        font-variant-numeric:tabular-nums;
        font-feature-settings:"tnum";
        opacity:.95;
        font-weight:900;
      }

      .raInput{
        width:100%;
        box-sizing:border-box;
        min-height:48px;
        padding:12px 14px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.94);
        outline:none;
        font-weight:800;
        font-size:14px;
        transition:border-color .16s ease, box-shadow .16s ease;
      }

      .raInput:focus{
        border-color:rgba(225,29,46,0.28);
        box-shadow:0 0 0 6px rgba(225,29,46,0.08);
      }

      .raSearchBox{
        position:relative;
        margin-top:14px;
      }

      .raSearchIcon{
        position:absolute;
        left:14px;
        top:50%;
        transform:translateY(-50%);
        opacity:.55;
        pointer-events:none;
        display:grid;
        place-items:center;
      }

      .raInputSearch{
        padding-left:42px;
      }

      .raFilterChips{
        margin-top:14px;
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .raChip{
        height:36px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.96);
        font-size:12px;
        font-weight:900;
        cursor:pointer;
      }

      .raChip.active{
        border-color:rgba(225,29,46,0.18);
        background:rgba(255,241,242,0.96);
        color:${RED};
      }

      .raSummaryList{
        margin-top:14px;
        display:grid;
        gap:10px;
      }

      .raSummaryItem{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        min-height:46px;
        padding:0 14px;
        border-radius:14px;
        background:rgba(248,250,252,0.92);
        border:1px solid rgba(17,24,39,0.07);
        font-size:13px;
        font-weight:800;
      }

      .raSummaryLeft{
        display:inline-flex;
        align-items:center;
        gap:8px;
      }

      .raSummaryItem b{
        font-size:14px;
      }

      .raFormFooter{
        display:flex;
        justify-content:flex-end;
        gap:10px;
        margin-top:20px;
        flex-wrap:wrap;
      }

      .raRightActions{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
        margin-top:14px;
      }

      .raBtnPrimary{
        height:42px;
        padding:0 16px;
        border-radius:14px;
        border:1px solid rgba(225,29,46,0.22);
        background:linear-gradient(180deg, rgba(255,241,242,0.98), rgba(255,228,230,0.96));
        color:${RED};
        font-weight:950;
        cursor:pointer;
        box-shadow:0 10px 24px rgba(225,29,46,0.08);
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
      }

      .raBtn{
        height:42px;
        padding:0 14px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.96);
        font-weight:950;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
      }

      .raBtnDanger{
        height:42px;
        padding:0 14px;
        border-radius:14px;
        border:1px solid rgba(225,29,46,0.18);
        background:rgba(255,241,242,0.96);
        color:${RED};
        font-weight:950;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
      }

      .raBtnSmall{
        height:38px;
        padding:0 12px;
        border-radius:12px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.96);
        font-weight:900;
        cursor:pointer;
        white-space:nowrap;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
      }

      .raBtnSmallDanger{
        height:38px;
        padding:0 12px;
        border-radius:12px;
        border:1px solid rgba(225,29,46,0.18);
        background:rgba(255,241,242,0.96);
        color:${RED};
        font-weight:900;
        cursor:pointer;
        white-space:nowrap;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
      }

      .raBtn:disabled,
      .raBtnPrimary:disabled,
      .raBtnDanger:disabled,
      .raBtnSmall:disabled,
      .raBtnSmallDanger:disabled{
        opacity:.55;
        cursor:not-allowed;
      }

      .raTableCard{
        padding:14px;
      }

      .raTableHeadBar{
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        gap:12px;
        flex-wrap:wrap;
        margin-bottom:12px;
      }

      .raToolbarSummary{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .raToolbarPill{
        height:36px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.96);
        font-size:12px;
        font-weight:900;
        display:inline-flex;
        align-items:center;
      }

      .raTableDesktop{
        display:block;
      }

      .raTabletList{
        display:none;
      }

      .raMobileList{
        display:none;
      }

      .raTableWrap{
        overflow:auto;
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.08);
        max-height:72vh;
        background:rgba(255,255,255,0.72);
      }

      .raTable{
        min-width:1080px;
        overflow:hidden;
      }

      .raThead{
        display:grid;
        padding:13px 14px;
        background:rgba(248,250,252,0.98);
        border-bottom:1px solid rgba(17,24,39,0.08);
        font-weight:950;
        font-size:12px;
        color:rgba(11,18,32,0.75);
        text-transform:uppercase;
        letter-spacing:.03em;
      }

      .raStickyHead{
        position:sticky;
        top:0;
        z-index:2;
        backdrop-filter:blur(10px);
      }

      .raTrow{
        display:grid;
        padding:14px 14px;
        background:rgba(255,255,255,0.82);
        border-bottom:1px solid rgba(17,24,39,0.06);
        align-items:center;
      }

      .raRowHover:hover{
        background:rgba(255,255,255,0.98);
      }

      .raInlineActions{
        display:flex;
        justify-content:flex-end;
        gap:8px;
        flex-wrap:wrap;
      }

      .raEmpty{
        padding:28px 18px;
        text-align:center;
        background:rgba(255,255,255,0.72);
      }

      .raEmptyTitle{
        font-size:15px;
        font-weight:950;
        color:#0b1220;
      }

      .raEmptySub{
        margin-top:6px;
        font-size:12px;
        opacity:.72;
        font-weight:800;
      }

      .raNameCell{
        display:flex;
        flex-direction:column;
        gap:6px;
        min-width:0;
      }

      .raMainTitle{
        font-weight:950;
        color:#0b1220;
        word-break:break-word;
      }

      .raSubText{
        font-size:12px;
        opacity:.72;
        font-weight:700;
      }

      .raNotesLine{
        font-size:12px;
        color:rgba(15,23,42,0.72);
        font-weight:700;
        line-height:1.35;
      }

      .raVenueCell{
        display:flex;
        align-items:center;
        gap:8px;
        font-weight:850;
      }

      .raVenueIcon{
        width:26px;
        height:26px;
        border-radius:9px;
        display:grid;
        place-items:center;
        background:rgba(15,23,42,0.05);
        color:#334155;
        flex:0 0 auto;
      }

      .raStatus{
        width:fit-content;
        padding:6px 11px;
        border-radius:999px;
        font-size:11px;
        font-weight:950;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.88);
        opacity:.95;
        display:inline-flex;
        align-items:center;
        gap:6px;
      }

      .raStatus.on{
        border-color:rgba(16,185,129,0.22);
        background:rgba(236,253,245,0.95);
        color:#047857;
      }

      .raStatus.off{
        border-color:rgba(225,29,46,0.18);
        background:rgba(255,241,242,0.95);
        color:${RED};
      }

      .raStatus.draft{
        border-color:rgba(245,158,11,0.20);
        background:rgba(255,251,235,0.95);
        color:#b45309;
      }

      .raPagination{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
        padding:14px 4px 4px;
      }

      .raPaginationBtns{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .raTabletCard{
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.92);
        display:grid;
        gap:12px;
      }

      .raTabletTop{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
      }

      .raTabletTopRight{
        flex:0 0 auto;
      }

      .raTabletTitleWrap{
        min-width:0;
      }

      .raTabletIndex{
        font-size:11px;
        font-weight:900;
        opacity:.6;
        margin-bottom:4px;
      }

      .raTabletBottom{
        display:grid;
        gap:12px;
      }

      .raTabletMeta{
        display:grid;
        grid-template-columns:repeat(2, minmax(0, 1fr));
        gap:10px;
      }

      .raTabletMetaItem{
        border:1px solid rgba(17,24,39,0.07);
        background:rgba(248,250,252,0.92);
        border-radius:14px;
        padding:10px 12px;
        display:grid;
        gap:4px;
      }

      .raTabletMetaItem span{
        font-size:11px;
        opacity:.68;
        font-weight:900;
      }

      .raTabletMetaItem b{
        font-size:13px;
        color:#0b1220;
        word-break:break-word;
      }

      .raTabletMetaWide{
        grid-column:1 / -1;
      }

      .raTabletActions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .raMobileCard{
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.92);
        display:grid;
        gap:12px;
      }

      .raMobileCardHead{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:10px;
      }

      .raMobileIndex{
        font-size:11px;
        font-weight:900;
        opacity:.6;
        margin-bottom:4px;
      }

      .raMobileMeta{
        display:grid;
        gap:8px;
      }

      .raMobileMetaRow{
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:flex-start;
        padding:10px 12px;
        border-radius:14px;
        background:rgba(248,250,252,0.92);
        border:1px solid rgba(17,24,39,0.07);
      }

      .raMobileMetaRow span{
        font-size:11px;
        opacity:.68;
        font-weight:900;
        flex:0 0 auto;
      }

      .raMobileMetaRow b{
        font-size:13px;
        color:#0b1220;
        text-align:right;
        word-break:break-word;
      }

      .raMobileNotes{
        align-items:flex-start;
      }

      .raMobileDateRow b{
        max-width:70%;
      }

      .raMobileActions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .raModalOverlay{
        position:fixed;
        inset:0;
        background:rgba(2,8,23,0.46);
        backdrop-filter:blur(6px);
        z-index:1200;
        display:grid;
        place-items:center;
        padding:18px;
      }

      .raModal{
        width:min(100%, 920px);
        max-height:min(88vh, 900px);
        overflow:auto;
        background:linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98));
        border:1px solid rgba(17,24,39,0.08);
        border-radius:24px;
        box-shadow:0 28px 80px rgba(2,8,23,0.28);
        padding:18px;
      }

      .raModalSmall{
        width:min(100%, 520px);
      }

      .raModalHead{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
      }

      .raModalTitle{
        font-size:18px;
        font-weight:950;
        color:#0b1220;
      }

      .raModalSub{
        margin-top:6px;
        font-size:12px;
        opacity:.72;
        font-weight:800;
      }

      .raIconClose{
        width:38px;
        height:38px;
        border-radius:12px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.96);
        cursor:pointer;
        display:grid;
        place-items:center;
        flex:0 0 auto;
      }

      .raModalActions{
        display:flex;
        justify-content:flex-end;
        gap:10px;
        flex-wrap:wrap;
        margin-top:18px;
      }

      .raConfirmText{
        margin-top:14px;
        font-size:14px;
        line-height:1.6;
        color:#334155;
        font-weight:800;
      }

      @media (max-width: 1100px){
        .raTableDesktop{ display:none; }
        .raTabletList{
          display:grid;
          gap:12px;
        }
      }

      @media (max-width: 680px){
        .raTabletList{ display:none; }
        .raMobileList{
          display:grid;
          gap:12px;
        }
      }
    `}</style>
  );
}
