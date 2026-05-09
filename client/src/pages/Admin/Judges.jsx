// src/pages/Admin/Judges.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { UI } from "./ui.js";
import {
  getUser,
  isSuperAdmin,
  getEffectiveAcademy,
  getSelectedAcademy,
  setSelectedAcademy,
} from "../../lib/auth.js";

const RED = "var(--ra-accent, #e11d2e)";
const PAGE_SIZE = 8;

/* ------------------------------------------------------------------ */
/* ICONS */
/* ------------------------------------------------------------------ */

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

const IconJudge = (p) => (
  <SvgIcon {...p}>
    <path d="M14 4 4 14" />
    <path d="m13 5 6 6" />
    <path d="M11 7 17 13" />
    <path d="M3 21h7" />
    <path d="M13 14 8 19" />
  </SvgIcon>
);

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

const IconPlus = (p) => (
  <SvgIcon {...p}>
    <path d="M12 5v14M5 12h14" />
  </SvgIcon>
);

const IconEdit = (p) => (
  <SvgIcon {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
  </SvgIcon>
);

const IconLink = (p) => (
  <SvgIcon {...p}>
    <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.8 5.1" />
    <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.1a5 5 0 1 0 7.07 7.07L13.2 18.9" />
  </SvgIcon>
);

const IconBan = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5 5l14 14" />
  </SvgIcon>
);

const IconCheckCircle = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.3 2.3L15.8 9.3" />
  </SvgIcon>
);

const IconUsers = (p) => (
  <SvgIcon {...p}>
    <path d="M16.5 19a4.5 4.5 0 0 0-9 0" />
    <circle cx="12" cy="9" r="3.2" />
    <path d="M19.2 19a3.8 3.8 0 0 0-2.9-3.7" />
    <path d="M7.7 15.3A3.8 3.8 0 0 0 4.8 19" />
  </SvgIcon>
);

const IconActivity = (p) => (
  <SvgIcon {...p}>
    <path d="M3 12h4l2-5 4 10 2-5h6" />
  </SvgIcon>
);

const IconUserCard = (p) => (
  <SvgIcon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <circle cx="9" cy="11" r="2.2" />
    <path d="M6.4 15a3.4 3.4 0 0 1 5.2 0" />
    <path d="M14 10h4M14 14h3" />
  </SvgIcon>
);

const IconClose = (p) => (
  <SvgIcon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </SvgIcon>
);

const IconSave = (p) => (
  <SvgIcon {...p}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </SvgIcon>
);

const IconRefresh = (p) => (
  <SvgIcon {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </SvgIcon>
);

const IconBuilding = (p) => (
  <SvgIcon {...p}>
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
    <path d="M11 21v-4h2v4" />
  </SvgIcon>
);

const IconShield = (p) => (
  <SvgIcon {...p}>
    <path d="M12 3 5 6v5c0 5 3.4 8 7 10 3.6-2 7-5 7-10V6l-7-3Z" />
    <path d="m9.2 12 1.8 1.8 3.8-4" />
  </SvgIcon>
);

const IconFilter = (p) => (
  <SvgIcon {...p}>
    <path d="M4 6h16" />
    <path d="M7 12h10" />
    <path d="M10 18h4" />
  </SvgIcon>
);

/* ------------------------------------------------------------------ */
/* MAIN */
/* ------------------------------------------------------------------ */

export default function Judges() {
  const aliveRef = useRef(true);

  const me = useMemo(() => {
    try {
      return getUser?.() || {};
    } catch {
      return {};
    }
  }, []);

  const superAdmin = useMemo(() => {
    try {
      return !!isSuperAdmin?.();
    } catch {
      return false;
    }
  }, []);

  const [academies, setAcademies] = useState([]);
  const [academyFilter, setAcademyFilter] = useState(() => {
    try {
      return normalizeAcademyId(getSelectedAcademy?.()) || "";
    } catch {
      return "";
    }
  });

  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");

  const [assignRows, setAssignRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [busy, setBusy] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Judge@12345");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  const [page, setPage] = useState(1);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [confirmBox, setConfirmBox] = useState(null);

  const effectiveAcademyId = useMemo(() => {
    try {
      return (
        normalizeAcademyId(getEffectiveAcademy?.()) ||
        normalizeAcademyId(academyFilter) ||
        normalizeAcademyId(me?.academyId) ||
        ""
      );
    } catch {
      return (
        normalizeAcademyId(academyFilter) ||
        normalizeAcademyId(me?.academyId) ||
        ""
      );
    }
  }, [academyFilter, me]);

  const selectedAcademy = useMemo(() => {
    return (
      academies.find((a) => String(a._id) === String(effectiveAcademyId)) ||
      academies.find((a) => String(a._id) === String(academyFilter)) ||
      null
    );
  }, [academies, effectiveAcademyId, academyFilter]);

  function toast(text, type = "ok") {
    setMsg("");
    setErr("");
    if (type === "err") setErr(text);
    else setMsg(text);

    window.clearTimeout(window.__ra_toast);
    window.__ra_toast = window.setTimeout(() => {
      if (!aliveRef.current) return;
      setMsg("");
      setErr("");
    }, 2200);
  }

  function persistAcademy(id) {
    const normalized = normalizeAcademyId(id);
    setAcademyFilter(normalized);
    try {
      setSelectedAcademy?.(normalized);
    } catch {
      // noop
    }
  }

  function getUserFromRow(row) {
    return row?.userId || row || {};
  }

  function getUserIdFromRow(row) {
    const user = getUserFromRow(row);
    return user?._id || row?._id || "";
  }

  function getRowAcademyId(row) {
    const user = getUserFromRow(row);
    return normalizeAcademyId(
      row?.academyId || user?.academyId || selectedAcademy?._id || "",
    );
  }

  function getRowAcademyName(row) {
    const user = getUserFromRow(row);
    return (
      row?.academyId?.name ||
      user?.academyId?.name ||
      selectedAcademy?.name ||
      "—"
    );
  }

  function pickDefaultEventId(list = []) {
    const live = (list || []).find(
      (e) => String(e?.status || "").toUpperCase() === "LIVE",
    );
    if (live?._id) return String(live._id);
    if (list?.[0]?._id) return String(list[0]._id);
    return "";
  }

  async function loadAcademies() {
    const fn =
      typeof api?.academies === "function"
        ? api.academies
        : typeof api?.adminAcademies === "function"
          ? api.adminAcademies
          : typeof api?.getAcademies === "function"
            ? api.getAcademies
            : null;

    if (!fn) {
      const mine =
        normalizeAcademyId(me?.academyId) || normalizeAcademyId(me?.academy)
          ? [
              {
                _id:
                  normalizeAcademyId(me?.academyId) ||
                  normalizeAcademyId(me?.academy),
                name: me?.academyId?.name || me?.academy?.name || "My Academy",
                isActive: true,
              },
            ]
          : [];
      return normalizeAcademies(mine);
    }

    try {
      const rows = await fn();
      return normalizeAcademies(Array.isArray(rows) ? rows : []);
    } catch {
      const mine =
        normalizeAcademyId(me?.academyId) || normalizeAcademyId(me?.academy)
          ? [
              {
                _id:
                  normalizeAcademyId(me?.academyId) ||
                  normalizeAcademyId(me?.academy),
                name: me?.academyId?.name || me?.academy?.name || "My Academy",
                isActive: true,
              },
            ]
          : [];
      return normalizeAcademies(mine);
    }
  }

  async function loadJudges(academyId = effectiveAcademyId) {
    if (typeof api?.judges !== "function") {
      throw new Error("api.judges() is missing in api.js");
    }
    const js = await api.judges(normalizeAcademyId(academyId));
    return Array.isArray(js) ? js : [];
  }

  async function loadEvents(academyId = effectiveAcademyId) {
    const fn =
      typeof api?.adminEvents === "function"
        ? api.adminEvents
        : typeof api?.events === "function"
          ? api.events
          : null;

    if (!fn) return [];

    const es = await fn(normalizeAcademyId(academyId));
    const sorted = (Array.isArray(es) ? es : []).slice().sort((a, b) => {
      const da = new Date(a?.createdAt || a?.startDate || 0).getTime();
      const db = new Date(b?.createdAt || b?.startDate || 0).getTime();
      return db - da;
    });
    return sorted;
  }

  async function loadAssignmentsForEvent(eid, academyId = effectiveAcademyId) {
    if (!eid) {
      if (aliveRef.current) setAssignRows([]);
      return [];
    }

    if (typeof api?.judgeAssignments !== "function") {
      if (aliveRef.current) setAssignRows([]);
      return [];
    }

    setLoadingAssign(true);
    try {
      const rows = await api.judgeAssignments(
        String(eid || "").trim(),
        normalizeAcademyId(academyId),
      );
      const safeRows = Array.isArray(rows) ? rows : [];
      if (aliveRef.current) setAssignRows(safeRows);
      return safeRows;
    } finally {
      if (aliveRef.current) setLoadingAssign(false);
    }
  }

  async function loadAll(forceEventId = "", academyId = effectiveAcademyId) {
    const scopedAcademyId = normalizeAcademyId(academyId);

    setLoading(true);
    setErr("");
    try {
      const [academyRows, judgeRows, eventRows] = await Promise.all([
        loadAcademies(),
        loadJudges(scopedAcademyId),
        loadEvents(scopedAcademyId),
      ]);

      if (!aliveRef.current) return;

      setAcademies(academyRows);
      setItems(judgeRows);
      setEvents(eventRows);

      const chosenEventId =
        String(forceEventId || "").trim() ||
        String(eventId || "").trim() ||
        pickDefaultEventId(eventRows) ||
        "";

      setEventId(chosenEventId);

      await loadAssignmentsForEvent(chosenEventId, scopedAcademyId);
    } catch (e) {
      if (!aliveRef.current) return;
      setErr(e?.message || "Failed to load judges");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    aliveRef.current = true;
    loadAll();

    return () => {
      aliveRef.current = false;
      window.clearTimeout(window.__ra_toast);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!eventId) {
      setAssignRows([]);
      return;
    }
    loadAssignmentsForEvent(eventId, effectiveAcademyId).catch((e) => {
      if (!aliveRef.current) return;
      setErr(e?.message || "Failed to load assignments");
    });
  }, [eventId, effectiveAcademyId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return (items || []).filter((j) => {
      const user = getUserFromRow(j);
      const nm = String(user?.name || "").toLowerCase();
      const em = String(user?.email || "").toLowerCase();
      const ac = String(getRowAcademyName(j) || "").toLowerCase();
      const isActive = user?.isActive !== false;

      if (s && ![nm, em, ac].some((x) => x.includes(s))) return false;
      if (status === "ACTIVE" && !isActive) return false;
      if (status === "INACTIVE" && isActive) return false;

      return true;
    });
  }, [items, q, status, selectedAcademy]);

  useEffect(() => {
    setPage(1);
  }, [q, status, eventId, effectiveAcademyId]);

  const assignStatsByJudge = useMemo(() => {
    const map = new Map();

    for (const a of assignRows || []) {
      const jid = String(a?.judgeUserId?._id || a?.judgeUserId || "");
      if (!jid) continue;

      if (!map.has(jid)) {
        map.set(jid, { groups: new Set(), acts: new Set(), rows: 0 });
      }

      const bucket = map.get(jid);

      const gid = a?.groupId?._id
        ? String(a.groupId._id)
        : a?.groupId
          ? String(a.groupId)
          : "";

      const aid = a?.activityId?._id
        ? String(a.activityId._id)
        : a?.activityId
          ? String(a.activityId)
          : "";

      if (gid) bucket.groups.add(gid);
      if (aid) bucket.acts.add(aid);
      bucket.rows += 1;
    }

    return map;
  }, [assignRows]);

  const selectedEvent = useMemo(
    () => events.find((e) => String(e._id) === String(eventId)) || null,
    [events, eventId],
  );

  const activeCount = useMemo(
    () =>
      (items || []).filter((j) => getUserFromRow(j)?.isActive !== false).length,
    [items],
  );

  const inactiveCount = (items?.length || 0) - activeCount;

  const academyCount = useMemo(() => {
    const set = new Set(
      (items || [])
        .map((row) => String(getRowAcademyId(row) || "").trim())
        .filter(Boolean),
    );
    return set.size || (selectedAcademy ? 1 : 0);
  }, [items, selectedAcademy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function handleAcademyChange(nextId) {
    const normalized = normalizeAcademyId(nextId);
    persistAcademy(normalized);
    setItems([]);
    setAssignRows([]);
    setEvents([]);
    setEventId("");
    setPage(1);
    await loadAll("", normalized);
  }

  async function add() {
    setMsg("");
    setErr("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || "Judge";
    const academyId = normalizeAcademyId(effectiveAcademyId);

    if (!cleanEmail) return setErr("Email is required");
    if (!isEmail(cleanEmail)) return setErr("Invalid email format");
    if (!password || password.length < 6) {
      return setErr("Password must be at least 6 characters");
    }
    if (!academyId) {
      return setErr("Academy is required");
    }

    if (typeof api?.createUser !== "function") {
      return setErr("api.createUser() is missing in api.js");
    }

    try {
      setBusy(true);

      await api.createUser({
        name: cleanName,
        email: cleanEmail,
        password,
        role: "JUDGE",
        academyId,
      });

      setName("");
      setEmail("");
      setPassword("Judge@12345");
      toast("Judge created successfully.");

      const judgeRows = await loadJudges(academyId);
      if (aliveRef.current) setItems(judgeRows);
    } catch (e) {
      setErr(e?.message || "Failed to create judge");
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }

  function openEdit(j) {
    const user = getUserFromRow(j);
    setEditRow(j);
    setEditName(String(user?.name || ""));
    setEditEmail(String(user?.email || ""));
    setEditPassword("");
    setEditOpen(true);
    setMsg("");
    setErr("");
  }

  async function saveEdit() {
    if (!editRow) return;

    const userId = getUserIdFromRow(editRow);
    if (!userId) return setErr("Missing user id");
    if (typeof api?.updateUser !== "function") {
      return setErr("api.updateUser() is missing in api.js");
    }

    const cleanName = editName.trim();
    const cleanEmail = editEmail.trim().toLowerCase();
    const academyId = normalizeAcademyId(effectiveAcademyId);

    if (!cleanName) return setErr("Name is required");
    if (!cleanEmail) return setErr("Email is required");
    if (!isEmail(cleanEmail)) return setErr("Invalid email format");

    const payload = {
      name: cleanName,
      email: cleanEmail,
      ...(academyId ? { academyId } : {}),
    };

    const pw = String(editPassword || "").trim();

    if (pw) {
      if (pw.length < 6) {
        return setErr("Password must be at least 6 characters");
      }
      payload.password = pw;
    }

    try {
      setBusy(true);
      setErr("");
      await api.updateUser(userId, payload);

      setEditOpen(false);
      setEditRow(null);
      toast("Judge updated successfully.");

      const judgeRows = await loadJudges(academyId);
      if (aliveRef.current) setItems(judgeRows);
    } catch (e) {
      setErr(e?.message || "Failed to update judge");
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }

  function askDeactivate(j) {
    const user = getUserFromRow(j);
    const isActive = user?.isActive !== false;
    if (!isActive) return;

    const userId = getUserIdFromRow(j);
    if (!userId) return;

    setConfirmBox({
      title: "Deactivate judge user?",
      body: `This will disable login for ${user?.email || "this judge"}.`,
      yesText: "Deactivate",
      tone: "danger",
      onYes: async () => {
        try {
          setBusy(true);
          setErr("");

          if (typeof api?.deactivateUser === "function") {
            await api.deactivateUser(userId);
          } else if (typeof api?.updateUser === "function") {
            await api.updateUser(userId, { isActive: false });
          } else {
            throw new Error(
              "Missing API method (deactivateUser or updateUser).",
            );
          }

          toast("Judge deactivated successfully.");
          const judgeRows = await loadJudges(effectiveAcademyId);
          if (aliveRef.current) setItems(judgeRows);
        } catch (e) {
          setErr(e?.message || "Failed to deactivate");
        } finally {
          if (aliveRef.current) setBusy(false);
        }
      },
    });
  }

  function askReactivate(j) {
    const user = getUserFromRow(j);
    const isActive = user?.isActive !== false;
    if (isActive) return;

    const userId = getUserIdFromRow(j);
    if (!userId) return;

    setConfirmBox({
      title: "Reactivate judge user?",
      body: `This will re-enable login for ${user?.email || "this judge"}.`,
      yesText: "Reactivate",
      tone: "success",
      onYes: async () => {
        try {
          setBusy(true);
          setErr("");

          if (typeof api?.reactivateUser === "function") {
            await api.reactivateUser(userId);
          } else if (typeof api?.activateUser === "function") {
            await api.activateUser(userId);
          } else if (typeof api?.updateUser === "function") {
            await api.updateUser(userId, { isActive: true });
          } else {
            throw new Error(
              "Missing API method (reactivateUser/activateUser/updateUser).",
            );
          }

          toast("Judge reactivated successfully.");
          const judgeRows = await loadJudges(effectiveAcademyId);
          if (aliveRef.current) setItems(judgeRows);
        } catch (e) {
          setErr(e?.message || "Failed to reactivate");
        } finally {
          if (aliveRef.current) setBusy(false);
        }
      },
    });
  }

  function goAssignments(j) {
    const user = getUserFromRow(j);
    const userId = user?._id || j?._id || "";
    const scopedAcademyId = normalizeAcademyId(effectiveAcademyId);

    const url = `/admin/assignments?eventId=${encodeURIComponent(
      eventId || "",
    )}&judgeUserId=${encodeURIComponent(userId)}${
      scopedAcademyId ? `&academyId=${encodeURIComponent(scopedAcademyId)}` : ""
    }`;
    window.location.href = url;
  }

  return (
    <section style={UI.wrap}>
      <StyleTag />

      <div className="raTopbar">
        <div>
          <div className="raPageEyebrow">
            <span className="raEyebrowIcon">
              <IconJudge size={12} />
            </span>
            ADMIN PANEL
          </div>
          <h3 style={UI.h3}>Judges</h3>
          <div style={UI.sub}>
            Create judge accounts, manage access, and review assignment coverage
            for the selected event. Academy name is visible for multi-academy
            management.
          </div>
        </div>

        <div className="raStats">
          <StatCard
            label="Total Judges"
            value={items.length}
            icon={<IconJudge size={18} />}
          />
          <StatCard
            label="Active"
            value={activeCount}
            tone="live"
            icon={<IconCheckCircle size={18} />}
          />
          <StatCard
            label="Inactive"
            value={inactiveCount}
            tone="closed"
            icon={<IconBan size={18} />}
          />
          <StatCard
            label="Academies"
            value={academyCount || 1}
            tone="draft"
            icon={<IconBuilding size={18} />}
          />
        </div>
      </div>

      {err ? <div className="raAlert raAlertErr">{err}</div> : null}
      {msg ? <div className="raAlert raAlertOk">{msg}</div> : null}

      <div className="raAcademyBar">
        <div className="raInfoPill">
          <span className="raInfoPillIcon">
            <IconBuilding size={13} />
          </span>
          <span>
            Academy: <b>{selectedAcademy?.name || "Current / Default"}</b>
          </span>
          {superAdmin ? (
            <span className="raTagBlue">SUPER ADMIN</span>
          ) : (
            <span className="raTagGreen">SCOPED</span>
          )}
        </div>

        <div className="raEnhanceStrip">
          <div className="raEnhanceItem">
            <span className="raEnhanceIcon">
              <IconShield size={14} />
            </span>
            Multi-academy scope
          </div>
          <div className="raEnhanceItem">
            <span className="raEnhanceIcon">
              <IconFilter size={14} />
            </span>
            Responsive 13-inch layout
          </div>
        </div>
      </div>

      <div className="raEventBar">
        <div className="raInfoPill">
          <span className="raInfoPillIcon">
            <IconCalendar size={13} />
          </span>
          <span>
            Event: <b>{selectedEvent?.name || "—"}</b>
          </span>
          {selectedEvent?.status ? (
            <span className="raTag">
              {String(selectedEvent.status).toUpperCase()}
            </span>
          ) : null}
        </div>

        <div className="raEventBarRight">
          {superAdmin ? (
            <div className="raSelectWrap" style={{ minWidth: 260 }}>
              <span className="raSelectIcon">
                <IconBuilding size={14} />
              </span>
              <select
                className="raInput raSelectInput"
                value={academyFilter}
                onChange={(e) => handleAcademyChange(e.target.value)}
                disabled={loading || busy}
              >
                <option value="">All / Default Academy Scope</option>
                {academies.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                    {a.code ? ` (${a.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="raSelectWrap" style={{ minWidth: 280 }}>
            <span className="raSelectIcon">
              <IconCalendar size={14} />
            </span>
            <select
              className="raInput raSelectInput"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={loading || busy}
            >
              <option value="">Select Event</option>
              {(events || []).map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name || "Event"}{" "}
                  {e.status ? `(${String(e.status).toUpperCase()})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="raTopActions">
            <button
              className="raBtn"
              type="button"
              onClick={() => loadAll(eventId, effectiveAcademyId)}
              disabled={loading || busy}
            >
              <IconRefresh size={14} />
              Refresh
            </button>

            <div className="raMiniPill">
              Visible: <b>{filtered.length}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="raTopGrid" style={{ marginTop: 14 }}>
        <div className="raCard raCard2">
          <div className="raCardTitle">Add Judge</div>
          <div className="raCardSub">
            Creates a user with role: <b>JUDGE</b>
            {selectedAcademy?.name ? (
              <>
                {" "}
                for academy: <b>{selectedAcademy.name}</b>
              </>
            ) : null}
          </div>

          <div className="raGrid2" style={{ marginTop: 14 }}>
            <Field label="Name">
              <input
                className="raInput"
                placeholder="Judge name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field label="Email">
              <input
                className="raInput"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Password">
              <input
                className="raInput"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Field label="Academy">
              <div className="raReadOnlyPill">
                <IconBuilding size={14} />
                <span>{selectedAcademy?.name || "Current / Default"}</span>
              </div>
            </Field>
          </div>

          <div className="raFormFooter">
            <button className="raBtnPrimary" onClick={add} disabled={busy}>
              <IconPlus size={14} />
              {busy ? "Saving..." : "Add Judge"}
            </button>
          </div>
        </div>

        <div className="raCard raCard2 raSearchCard">
          <div className="raCardTitle">Search & Filters</div>
          <div className="raCardSub">
            Search by name, email, academy and filter by account status.
          </div>

          <div className="raSearchWrap" style={{ marginTop: 14 }}>
            <span className="raSearchIcon">
              <IconSearch size={15} />
            </span>
            <input
              className="raInput raInputSearch"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email or academy..."
            />
          </div>

          <div className="raFiltersOne" style={{ marginTop: 12 }}>
            <Field label="Status">
              <select
                className="raInput"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </div>

          <div className="raSummaryList" style={{ marginTop: 14 }}>
            <div className="raSummaryItem">
              <span>Selected academy</span>
              <b>{selectedAcademy?.name || "Current / Default"}</b>
            </div>
            <div className="raSummaryItem">
              <span>Selected event</span>
              <b>{selectedEvent?.name || "—"}</b>
            </div>
            <div className="raSummaryItem">
              <span>Assignment loading</span>
              <b>{loadingAssign ? "In progress" : "Ready"}</b>
            </div>
            <div className="raSummaryItem">
              <span>Filtered judges</span>
              <b>{filtered.length}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="raCard raTableCard" style={{ marginTop: 14 }}>
        <div className="raTableHeadBar">
          <div>
            <div className="raCardTitle">Judges Directory</div>
            <div className="raCardSub">
              Event-specific assignment coverage is shown for the selected
              event. Academy name is visible for multi-academy management.
            </div>
          </div>

          <div className="raRightMeta">
            <span className="raMiniText">
              Total loaded: <b>{items.length}</b>
            </span>
            <span className="raMiniText">
              Visible: <b>{filtered.length}</b>
            </span>
            <span className="raMiniText">
              Inactive: <b>{inactiveCount}</b>
            </span>
            <span className="raMiniText">
              Page: <b>{page}</b> / <b>{totalPages}</b>
            </span>
          </div>
        </div>

        <div className="raTableDesktop">
          <div className="raTableWrap">
            <div className="raTable">
              <div
                className="raThead raStickyHead"
                style={{
                  gridTemplateColumns:
                    "70px 1.15fr 1.25fr 1fr 140px 1.5fr 320px",
                }}
              >
                <div>#</div>
                <div>Name</div>
                <div>Email</div>
                <div>Academy</div>
                <div>Status</div>
                <div>Assignments</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              {paged.map((j, idx) => {
                const user = getUserFromRow(j);
                const isActive = user?.isActive !== false;
                const jid = String(user?._id || j?._id || "");
                const stats = assignStatsByJudge.get(jid);
                const gCount = stats ? stats.groups.size : 0;
                const aCount = stats ? stats.acts.size : 0;
                const rowCount = stats ? stats.rows : 0;

                return (
                  <div
                    key={j._id || user?._id || idx}
                    className="raTrow raRowHover"
                    style={{
                      gridTemplateColumns:
                        "70px 1.15fr 1.25fr 1fr 140px 1.5fr 320px",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </div>

                    <div className="raJudgeCell">
                      <span className="raJudgeIcon">
                        <IconUserCard size={15} />
                      </span>
                      <span className="raClamp2" style={{ fontWeight: 950 }}>
                        {user?.name || "-"}
                      </span>
                    </div>

                    <div className="raEmailCell" style={{ opacity: 0.88 }}>
                      {user?.email || "-"}
                    </div>

                    <div className="raAcademyCell">
                      <span className="raMiniTag raMiniTagBlue">
                        <IconBuilding size={12} />
                        {getRowAcademyName(j)}
                      </span>
                    </div>

                    <div>
                      <span className={`raStatus ${isActive ? "on" : "off"}`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="raAssignCell">
                      <span className="raMiniTag">
                        <IconUsers size={12} />
                        Groups: {gCount}
                      </span>
                      <span className="raMiniTag">
                        <IconActivity size={12} />
                        Activities: {aCount}
                      </span>
                      <span className="raMiniTag">Rows: {rowCount}</span>
                    </div>

                    <div className="raActions">
                      <button
                        className="raBtn"
                        type="button"
                        onClick={() => openEdit(j)}
                      >
                        <IconEdit size={14} />
                        Edit
                      </button>

                      <button
                        className="raBtn"
                        type="button"
                        onClick={() => goAssignments(j)}
                        disabled={!eventId}
                      >
                        <IconLink size={14} />
                        Manage
                      </button>

                      {isActive ? (
                        <button
                          className="raBtnDanger"
                          type="button"
                          onClick={() => askDeactivate(j)}
                        >
                          <IconBan size={14} />
                          Deactivate
                        </button>
                      ) : (
                        <button
                          className="raBtnSuccess"
                          type="button"
                          onClick={() => askReactivate(j)}
                        >
                          <IconCheckCircle size={14} />
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {!loading && paged.length === 0 ? (
                <div className="raEmpty">No judges found.</div>
              ) : null}

              {loading ? <div className="raEmpty">Loading…</div> : null}
            </div>
          </div>
        </div>

        <div className="raMobileList">
          {paged.map((j, idx) => {
            const user = getUserFromRow(j);
            const isActive = user?.isActive !== false;
            const jid = String(user?._id || j?._id || "");
            const stats = assignStatsByJudge.get(jid);
            const gCount = stats ? stats.groups.size : 0;
            const aCount = stats ? stats.acts.size : 0;
            const rowCount = stats ? stats.rows : 0;

            return (
              <div key={j._id || user?._id || idx} className="raMobileCard">
                <div className="raMobileHead">
                  <div className="raMobileHeadLeft">
                    <div className="raMobileIndex">
                      #{(page - 1) * PAGE_SIZE + idx + 1}
                    </div>
                    <div className="raMainTitle">{user?.name || "-"}</div>
                    <div className="raSubText">{user?.email || "-"}</div>
                  </div>

                  <span className={`raStatus ${isActive ? "on" : "off"}`}>
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="raMobilePills">
                  <span className="raMiniTag raMiniTagBlue">
                    <IconBuilding size={12} />
                    {getRowAcademyName(j)}
                  </span>
                  {selectedEvent?.name ? (
                    <span className="raMiniTag">
                      <IconCalendar size={12} />
                      {selectedEvent.name}
                    </span>
                  ) : null}
                </div>

                <div className="raMobileMetaGrid">
                  <div className="raMetaBox">
                    <span>Groups</span>
                    <b>{gCount}</b>
                  </div>
                  <div className="raMetaBox">
                    <span>Activities</span>
                    <b>{aCount}</b>
                  </div>
                  <div className="raMetaBox">
                    <span>Rows</span>
                    <b>{rowCount}</b>
                  </div>
                  <div className="raMetaBox">
                    <span>Academy</span>
                    <b>{getRowAcademyName(j)}</b>
                  </div>
                </div>

                <div className="raMobileActions">
                  <button
                    className="raBtn"
                    type="button"
                    onClick={() => openEdit(j)}
                  >
                    <IconEdit size={14} />
                    Edit
                  </button>

                  <button
                    className="raBtn"
                    type="button"
                    onClick={() => goAssignments(j)}
                    disabled={!eventId}
                  >
                    <IconLink size={14} />
                    Manage
                  </button>

                  {isActive ? (
                    <button
                      className="raBtnDanger"
                      type="button"
                      onClick={() => askDeactivate(j)}
                    >
                      <IconBan size={14} />
                      Deactivate
                    </button>
                  ) : (
                    <button
                      className="raBtnSuccess"
                      type="button"
                      onClick={() => askReactivate(j)}
                    >
                      <IconCheckCircle size={14} />
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {!loading && paged.length === 0 ? (
            <div className="raEmpty">No judges found.</div>
          ) : null}
          {loading ? <div className="raEmpty">Loading…</div> : null}
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

      {editOpen ? (
        <div className="raModalOverlay" onMouseDown={() => setEditOpen(false)}>
          <div className="raModal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="raModalHead">
              <div>
                <div className="raModalTitle">Edit Judge</div>
                <div className="raModalSub">
                  {(editRow?.userId || editRow)?.email || "—"}
                </div>
              </div>
              <button
                className="raIconClose"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="raGrid2" style={{ marginTop: 14 }}>
              <Field label="Name">
                <input
                  className="raInput"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </Field>

              <Field label="Email">
                <input
                  className="raInput"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </Field>

              <Field label="New Password (optional)">
                <input
                  className="raInput"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                />
              </Field>

              <Field label="Academy">
                <div className="raReadOnlyPill">
                  <IconBuilding size={14} />
                  <span>{selectedAcademy?.name || "Current / Default"}</span>
                </div>
              </Field>
            </div>

            <div className="raModalActions">
              <button className="raBtn" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button
                className="raBtnPrimary"
                onClick={saveEdit}
                disabled={busy}
              >
                <IconSave size={14} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmBox ? (
        <div className="raModalOverlay" onMouseDown={() => setConfirmBox(null)}>
          <div
            className="raModal"
            style={{ maxWidth: 520 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="raModalHead">
              <div className="raModalTitle">{confirmBox.title}</div>
              <button
                className="raIconClose"
                onClick={() => setConfirmBox(null)}
                aria-label="Close"
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
                className={
                  confirmBox.tone === "danger"
                    ? "raBtnDanger"
                    : confirmBox.tone === "success"
                      ? "raBtnSuccess"
                      : "raBtnWarn"
                }
                type="button"
                disabled={busy}
                onClick={async () => {
                  const run = confirmBox.onYes;
                  setConfirmBox(null);
                  await run?.();
                }}
              >
                {confirmBox.yesText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */

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

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function normalizeAcademyId(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return String(value?._id || value?.id || value?.academyId || "").trim();
  }
  return String(value).trim();
}

function normalizeAcademies(list = []) {
  const map = new Map();

  for (const row of list || []) {
    const raw =
      row?.academyId || row?.academy || row?.branch || row?.item || row || null;

    const id = normalizeAcademyId(raw?._id || raw?.id || row?._id || row?.id);
    if (!id) continue;

    if (!map.has(id)) {
      map.set(id, {
        _id: id,
        name: raw?.name || raw?.title || raw?.academyName || "Academy",
        code: raw?.code || "",
        isActive: raw?.isActive !== false,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || "")),
  );
}

/* ------------------------------------------------------------------ */
/* STYLES */
/* ------------------------------------------------------------------ */

function StyleTag() {
  return (
    <style>{`
      .raTopbar{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:16px;
        flex-wrap:wrap;
      }

      .raPageEyebrow{
        display:inline-flex;
        align-items:center;
        gap:8px;
        height:28px;
        padding:0 12px;
        border-radius:999px;
        background:rgba(255,241,242,0.95);
        border:1px solid rgba(225,29,46,0.18);
        color:${RED} !important;
        font-size:11px;
        font-weight:900;
        letter-spacing:.08em;
      }

      .raEyebrowIcon{
        display:grid;
        place-items:center;
      }

      .raStats{
        display:grid;
        grid-template-columns:repeat(4, minmax(120px, 1fr));
        gap:12px;
        min-width:min(100%, 560px);
      }

      .raAcademyBar{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
        margin-top:14px;
      }

      .raEnhanceStrip{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }

      .raEnhanceItem{
        display:inline-flex;
        align-items:center;
        gap:8px;
        min-height:36px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.86);
        font-weight:900;
        font-size:12px;
        color:#0f172a;
      }

      .raEnhanceIcon{
        display:grid;
        place-items:center;
        color:${RED};
      }

      .raTagBlue,
      .raTagGreen{
        display:inline-flex;
        align-items:center;
        min-height:24px;
        padding:0 10px;
        border-radius:999px;
        font-size:11px;
        font-weight:950;
      }

      .raTagBlue{
        border:1px solid rgba(59,130,246,0.20);
        background:rgba(239,246,255,0.92);
        color:#1d4ed8;
      }

      .raTagGreen{
        border:1px solid rgba(34,197,94,0.20);
        background:rgba(240,253,244,0.92);
        color:#166534;
      }

      .raMiniTagBlue{
        border-color:rgba(59,130,246,0.20) !important;
        background:rgba(239,246,255,0.92) !important;
        color:#1d4ed8 !important;
      }

      @media (max-width:1000px){
        .raStats{grid-template-columns:repeat(2, minmax(120px, 1fr)); width:100%;}
      }

      @media (max-width:560px){
        .raStats{grid-template-columns:1fr 1fr; gap:10px;}
      }

      .raStatCard{
        padding:14px;
        border-radius:20px;
        border:1px solid rgba(17,24,39,0.08);
        background:linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,250,252,0.98));
        box-shadow:0 12px 30px rgba(2,8,23,0.06);
        color:#0f172a !important;
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

      .raStatLabel{font-size:12px; opacity:.72; font-weight:800;}
      .raStatValue{margin-top:8px; font-size:28px; line-height:1; font-weight:950; letter-spacing:-0.03em;}

      .raAlert{
        margin-top:10px;
        padding:12px 14px;
        border-radius:16px;
        font-weight:900;
        font-size:13px;
      }

      .raAlertErr{
        border:1px solid rgba(225,29,46,0.18);
        background:rgba(255,241,242,0.96);
        color:${RED};
      }

      .raAlertOk{
        border:1px solid rgba(16,185,129,0.20);
        background:rgba(236,253,245,0.98);
        color:#047857;
      }

      .raEventBar{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
        margin-top:14px;
      }

      .raEventBarRight{
        display:flex;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
      }

      .raInfoPill{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:8px 12px;
        border-radius:999px;
        background:rgba(255,241,242,0.70);
        border:1px solid rgba(225,29,46,0.18);
        color:${RED};
        font-weight:900;
        font-size:12px;
        flex-wrap:wrap;
      }

      .raInfoPillIcon{
        display:grid;
        place-items:center;
      }

      .raTag{
        display:inline-flex;
        align-items:center;
        height:24px;
        padding:0 10px;
        border-radius:999px;
        border:1px solid rgba(225,29,46,0.18);
        background:rgba(255,241,242,0.70);
        color:${RED};
        font-size:11px;
        font-weight:950;
        margin-left:4px;
      }

      .raMiniPill{
        padding:6px 10px;
        border-radius:999px;
        background:rgba(255,255,255,0.88);
        border:1px solid rgba(17,24,39,0.10);
        font-weight:900;
        font-size:12px;
        color:#111827;
        white-space:nowrap;
      }

      .raTopActions{
        display:flex;
        gap:10px;
        align-items:center;
        flex-wrap:wrap;
      }

      .raTopGrid{
        display:grid;
        grid-template-columns:minmax(560px, 1.6fr) minmax(320px, 0.9fr);
        gap:14px;
        align-items:start;
      }

      @media (max-width:980px){
        .raTopGrid{ grid-template-columns:1fr; }
      }

      .raSearchCard{ position:relative; z-index:0; }

      .raCard{
        background:rgba(255,255,255,0.90);
        border:1px solid rgba(17,24,39,0.10);
        border-radius:22px;
        box-shadow:0 18px 52px rgba(2,8,23,0.08);
        backdrop-filter:blur(14px);
      }

      .raCard2{ padding:18px; overflow:hidden; }
      .raTableCard{ padding:14px; }

      .raCardTitle{ font-weight:950; font-size:16px; color:#0b1220; }
      .raCardSub{ margin-top:6px; font-size:12px; opacity:0.72; color:#475569; }

      .raGrid2{
        display:grid;
        grid-template-columns:repeat(2, minmax(0,1fr));
        gap:16px;
      }

      @media (max-width:900px){
        .raGrid2{ grid-template-columns:1fr; }
      }

      .raLabel{
        font-size:12px;
        opacity:0.78;
        margin-bottom:6px;
        font-weight:800;
        color:#475569 !important;
      }

      .raMiniText{
        font-size:12px;
        opacity:0.85;
        font-weight:800;
        color:#475569 !important;
      }

      .raInput{
        width:100%;
        box-sizing:border-box;
        min-height:46px;
        padding:12px 14px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.90);
        outline:none;
        font-weight:800;
        font-size:14px;
        color:#0f172a !important;
      }

      .raInput:focus{
        border-color:rgba(225,29,46,0.35);
        box-shadow:0 0 0 6px rgba(225,29,46,0.12);
      }

      .raReadOnlyPill{
        min-height:46px;
        padding:0 14px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(248,250,252,0.95);
        display:flex;
        align-items:center;
        gap:10px;
        font-weight:900;
        color:#0f172a;
      }

      .raSelectWrap,
      .raSearchWrap{
        position:relative;
      }

      .raSelectIcon,
      .raSearchIcon{
        position:absolute;
        left:14px;
        top:50%;
        transform:translateY(-50%);
        opacity:.6;
        pointer-events:none;
        display:grid;
        place-items:center;
        color:#64748b;
      }

      .raSelectInput,
      .raInputSearch{
        padding-left:42px;
      }

      .raFiltersOne{
        display:grid;
        grid-template-columns:1fr;
        gap:12px;
      }

      .raSummaryList{
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
        background:rgba(248,250,252,0.95);
        border:1px solid rgba(17,24,39,0.07);
        font-size:13px;
        font-weight:800;
        color:#0f172a !important;
      }

      .raFormFooter{
        display:flex;
        justify-content:flex-end;
        margin-top:20px;
      }

      .raBtnPrimary{
        height:42px;
        padding:0 16px;
        border-radius:14px;
        border:1px solid rgba(225,29,46,0.30);
        background:rgba(255,241,242,0.92);
        color:${RED};
        font-weight:950;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
      }

      .raBtn{
        height:38px;
        padding:0 14px;
        border-radius:12px;
        border:1px solid rgba(17,24,39,0.14);
        background:rgba(255,255,255,0.92);
        font-weight:950;
        cursor:pointer;
        color:#0f172a;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        white-space:nowrap;
      }

      .raBtnWarn{
        height:38px;
        padding:0 14px;
        border-radius:12px;
        border:1px solid rgba(245,158,11,0.35);
        background:rgba(255,251,235,0.95);
        font-weight:950;
        cursor:pointer;
        color:#9a3412;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
      }

      .raBtnDanger{
        height:38px;
        padding:0 14px;
        border-radius:12px;
        border:1px solid rgba(225,29,46,0.32);
        background:rgba(255,241,242,0.95);
        color:${RED};
        font-weight:950;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        white-space:nowrap;
      }

      .raBtnSuccess{
        height:38px;
        padding:0 14px;
        border-radius:12px;
        border:1px solid rgba(22,163,74,0.28);
        background:rgba(240,253,244,0.95);
        color:#166534;
        font-weight:950;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        white-space:nowrap;
      }

      .raBtn:disabled,
      .raBtnPrimary:disabled,
      .raBtnWarn:disabled,
      .raBtnDanger:disabled,
      .raBtnSuccess:disabled{
        opacity:.55;
        cursor:not-allowed;
      }

      .raTableDesktop{display:block;}
      .raMobileList{display:none;}

      .raTable{
        border-radius:16px;
        overflow:hidden;
        border:1px solid rgba(17,24,39,0.08);
      }

      .raTableWrap{
        overflow:auto;
        border-radius:16px;
      }

      .raThead{
        display:grid;
        padding:12px 14px;
        background:rgba(255,255,255,0.78);
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
        background:rgba(255,255,255,0.58);
        border-bottom:1px solid rgba(17,24,39,0.06);
        align-items:center;
      }

      .raThead > div,
      .raTrow > div{
        min-width:0;
      }

      .raRowHover:hover{
        background:rgba(255,255,255,0.82);
      }

      .raJudgeCell{
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }

      .raJudgeCell span:last-child{
        min-width:0;
      }

      .raJudgeIcon{
        width:34px;
        height:34px;
        border-radius:12px;
        display:grid;
        place-items:center;
        background:rgba(15,23,42,0.05);
        color:${RED};
        flex:0 0 auto;
      }

      .raClamp2{
        display:-webkit-box;
        -webkit-line-clamp:2;
        -webkit-box-orient:vertical;
        overflow:hidden;
        word-break:break-word;
      }

      .raEmailCell{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .raAcademyCell{
        min-width:0;
        overflow:hidden;
      }

      .raStatus{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:28px;
        padding:0 12px;
        border-radius:999px;
        font-size:12px;
        font-weight:950;
        border:1px solid rgba(17,24,39,0.10);
      }

      .raStatus.on{
        border-color:rgba(22,163,74,0.24);
        background:rgba(240,253,244,0.95);
        color:#166534;
      }

      .raStatus.off{
        border-color:rgba(225,29,46,0.24);
        background:rgba(255,241,242,0.95);
        color:${RED};
      }

      .raMiniTag{
        display:inline-flex;
        align-items:center;
        gap:6px;
        min-height:28px;
        padding:0 10px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.76);
        font-size:12px;
        font-weight:950;
        max-width:100%;
      }

      .raAssignCell{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        align-items:center;
      }

      .raActions{
        display:flex;
        gap:8px;
        justify-content:flex-end;
        flex-wrap:wrap;
      }

      .raEmpty{
        padding:18px;
        text-align:center;
        opacity:.75;
        background:rgba(255,255,255,0.55);
      }

      .raTableHeadBar{
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        gap:12px;
        flex-wrap:wrap;
        margin-bottom:12px;
      }

      .raRightMeta{
        display:flex;
        gap:12px;
        flex-wrap:wrap;
        justify-content:flex-end;
        align-items:center;
      }

      .raPagination{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
        margin-top:14px;
      }

      .raPaginationBtns{
        display:flex;
        gap:10px;
      }

      .raMobileCard{
        padding:16px;
        border:1px solid rgba(17,24,39,0.08);
        border-radius:18px;
        background:rgba(255,255,255,0.96);
        box-shadow:0 10px 24px rgba(2,8,23,0.05);
      }

      .raMobileCard + .raMobileCard{
        margin-top:12px;
      }

      .raMobileHead{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
      }

      .raMobileHeadLeft{
        min-width:0;
        flex:1;
      }

      .raMobileIndex{
        font-size:12px;
        opacity:.8;
        font-weight:900;
        margin-bottom:4px;
        color:#64748b !important;
      }

      .raMainTitle{
        font-weight:950;
        color:#0b1220 !important;
        word-break:break-word;
        line-height:1.15;
      }

      .raSubText{
        font-size:12px;
        opacity:.86;
        font-weight:700;
        word-break:break-word;
        line-height:1.35;
        color:#64748b !important;
        margin-top:4px;
      }

      .raMobilePills{
        margin-top:12px;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .raMobileMetaGrid{
        margin-top:14px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
      }

      .raMetaBox{
        display:flex;
        flex-direction:column;
        gap:4px;
        min-width:0;
      }

      .raMetaBox span{
        font-size:11px;
        opacity:.78;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.03em;
        color:#64748b !important;
      }

      .raMetaBox b{
        font-size:13px;
        font-weight:900;
        word-break:break-word;
        color:#0f172a !important;
      }

      .raMobileActions{
        margin-top:14px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .raModalOverlay{
        position:fixed;
        inset:0;
        background:rgba(2,8,23,0.45);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:16px;
        z-index:50;
      }

      .raModal{
        width:100%;
        max-width:900px;
        border-radius:22px;
        background:rgba(255,255,255,0.94);
        border:1px solid rgba(17,24,39,0.12);
        box-shadow:0 35px 90px rgba(2,8,23,0.20);
        backdrop-filter:blur(14px);
        padding:16px;
        max-height:86vh;
        overflow:auto;
      }

      .raModalHead{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
      }

      .raModalTitle{
        font-weight:950;
        font-size:16px;
      }

      .raModalSub{
        margin-top:4px;
        font-size:12px;
        opacity:0.72;
      }

      .raModalActions{
        display:flex;
        justify-content:flex-end;
        gap:10px;
        margin-top:16px;
        flex-wrap:wrap;
      }

      .raConfirmText{
        margin-top:10px;
        font-size:13px;
        opacity:0.78;
        line-height:1.45;
      }

      .raIconClose{
        width:38px;
        height:38px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.9);
        cursor:pointer;
        display:grid;
        place-items:center;
        font-weight:950;
      }

      @media (max-width:1280px){
        .raTableDesktop{display:none;}
        .raMobileList{display:block;}
      }

      @media (max-width:900px){
        .raEnhanceStrip{
          width:100%;
        }
      }

      @media (max-width:640px){
        .raFormFooter,
        .raModalActions{
          flex-direction:column;
          align-items:stretch;
        }

        .raBtn,
        .raBtnPrimary,
        .raBtnDanger,
        .raBtnSuccess,
        .raBtnWarn{
          width:100%;
        }

        .raEventBar,
        .raAcademyBar{
          align-items:stretch;
        }

        .raEventBarRight{
          width:100%;
        }

        .raPagination{
          flex-direction:column;
          align-items:stretch;
        }

        .raPaginationBtns{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        }

        .raPaginationBtns .raBtn{
          width:100%;
        }

        .raMobileActions{
          grid-template-columns:1fr;
        }
      }

      @media (max-width:480px){
        .raStats{grid-template-columns:1fr;}
        .raMobileMetaGrid{grid-template-columns:1fr;}
      }
    `}</style>
  );
}
