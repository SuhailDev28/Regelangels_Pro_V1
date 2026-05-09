// src/pages/Admin/Assignments.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { UI } from "./ui.js";
import {
  getUser,
  isSuperAdmin,
  getEffectiveAcademy,
  getSelectedAcademy,
  setSelectedAcademy,
} from "../../lib/auth.js";

/**
 * Assignments.jsx — MULTI-ACADEMY / EVENT-BASED / GROUPED JUDGE SETS
 * ✅ Academy integration
 * ✅ Super admin academy switcher
 * ✅ Deep-link: ?eventId=...&judgeUserId=...&academyId=...
 * ✅ One judge -> multiple groups + multiple activities (per event)
 * ✅ One grouped row per judge in the grid
 * ✅ Replace strategy for selected event + judge
 * ✅ Edit Judge Set edits all rows for that judge+event
 * ✅ Delete Judge Set deletes all rows for that judge+event
 * ✅ Corporate inline SVG icons
 * ✅ Enterprise KPI / panels / grouped table
 * ✅ Coverage + academy-aware filtering
 * ✅ FIXED: selected academy object/id normalization
 * ✅ FIXED: academyId no longer becomes [object Object]
 * ✅ FIXED: safe academy persistence for super-admin scope
 * ✅ FIXED: duplicate groups removed from group panel
 */

const RED = "var(--ra-accent, #e11d2e)";

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

const IconLink = (p) => (
  <SvgIcon {...p}>
    <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.8 5.1" />
    <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.1a5 5 0 1 0 7.07 7.07L13.2 18.9" />
  </SvgIcon>
);

const IconCalendar = (p) => (
  <SvgIcon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M16 3v4M8 3v4M3 9h18" />
  </SvgIcon>
);

const IconJudge = (p) => (
  <SvgIcon {...p}>
    <path d="M14 4 4 14" />
    <path d="m13 5 6 6" />
    <path d="M11 7 17 13" />
    <path d="M3 21h7" />
    <path d="M13 14 8 19" />
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

const IconSearch = (p) => (
  <SvgIcon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
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

const IconSave = (p) => (
  <SvgIcon {...p}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <path d="M17 21v-8H7v8" />
    <path d="M7 3v5h8" />
  </SvgIcon>
);

const IconReset = (p) => (
  <SvgIcon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 3v6h6" />
  </SvgIcon>
);

const IconChevronDown = (p) => (
  <SvgIcon {...p}>
    <path d="m6 9 6 6 6-6" />
  </SvgIcon>
);

const IconChevronUp = (p) => (
  <SvgIcon {...p}>
    <path d="m18 15-6-6-6 6" />
  </SvgIcon>
);

const IconFolder = (p) => (
  <SvgIcon {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </SvgIcon>
);

const IconGrid = (p) => (
  <SvgIcon {...p}>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="8" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
    <rect x="13" y="13" width="8" height="8" rx="2" />
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

const IconSparkles = (p) => (
  <SvgIcon {...p}>
    <path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
    <path d="m18.5 14 .6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" />
    <path d="m5.5 14 .8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8.8-2.4Z" />
  </SvgIcon>
);

/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */

function academyIdFromAny(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return String(value._id || value.id || value.academyId || "").trim();
  }
  return "";
}

function academyObjectFromAny(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  return null;
}

function normalizeGroups(list = []) {
  const map = new Map();

  for (const g of list || []) {
    const id = String(g?._id || g?.id || "").trim();
    const name = String(g?.name || "Group").trim();
    const level = String(g?.level || "").trim();

    if (!id) continue;

    if (!map.has(id)) {
      map.set(id, {
        ...g,
        _id: id,
        name,
        level,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    `${a.name} ${a.level}`.localeCompare(`${b.name} ${b.level}`),
  );
}

/* ------------------------------------------------------------------ */
/* MAIN */
/* ------------------------------------------------------------------ */

export default function Assignments() {
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

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");

  const [judges, setJudges] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activities, setActivities] = useState([]);
  const [academies, setAcademies] = useState([]);

  const [assignments, setAssignments] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAsg, setLoadingAsg] = useState(false);

  const [selectedAcademyId, setSelectedAcademyIdState] = useState(() => {
    try {
      const a = getSelectedAcademy?.();
      return academyIdFromAny(a);
    } catch {
      return "";
    }
  });

  const [judgeUserId, setJudgeUserId] = useState("");
  const [groupIds, setGroupIds] = useState([]);
  const [activityIds, setActivityIds] = useState([]);

  const [editingJudgeId, setEditingJudgeId] = useState("");

  const [q, setQ] = useState("");
  const [gQuery, setGQuery] = useState("");
  const [aQuery, setAQuery] = useState("");
  const [coverage, setCoverage] = useState("ALL");

  const [showGroups, setShowGroups] = useState(true);
  const [showActivities, setShowActivities] = useState(true);

  const effectiveAcademyId = useMemo(() => {
    try {
      const eff = getEffectiveAcademy?.();
      return (
        academyIdFromAny(eff) ||
        selectedAcademyId ||
        academyIdFromAny(me?.academyId) ||
        ""
      );
    } catch {
      return selectedAcademyId || academyIdFromAny(me?.academyId) || "";
    }
  }, [me, selectedAcademyId]);

  function toast(text, type = "ok") {
    setMsg("");
    setErr("");
    if (type === "err") setErr(text);
    else setMsg(text);
    window.clearTimeout(window.__ra_toast);
    window.__ra_toast = window.setTimeout(() => {
      setMsg("");
      setErr("");
    }, 1800);
  }

  function persistAcademy(id) {
    const nextId = String(id || "").trim();
    setSelectedAcademyIdState(nextId);

    const academyObj =
      academies.find(
        (a) => String(a?._id || a?.id || a?.academyId) === nextId,
      ) || null;

    try {
      setSelectedAcademy?.(academyObj);
    } catch {
      // noop
    }
  }

  function withAcademy(payload = {}, academyId = effectiveAcademyId) {
    const aid = String(academyId || "").trim();
    if (!aid) return { ...payload };
    return { ...payload, academyId: aid };
  }

  async function callWithAcademy(
    primaryFn,
    args = [],
    payload = null,
    academyId = effectiveAcademyId,
  ) {
    if (typeof primaryFn !== "function") {
      throw new Error("Missing API method.");
    }

    try {
      if (payload && typeof payload === "object") {
        return await primaryFn(...args, withAcademy(payload, academyId));
      }

      if (academyId) {
        return await primaryFn(...args, academyId);
      }

      return await primaryFn(...args);
    } catch (e) {
      const text = String(e?.message || "");
      const looksLikePayloadMismatch =
        text.includes("academyId") ||
        text.includes("Unexpected") ||
        text.includes("validation") ||
        text.includes("not allowed") ||
        text.includes("body") ||
        text.includes("Cast to ObjectId failed");

      if (!looksLikePayloadMismatch) throw e;

      if (payload && typeof payload === "object") {
        return await primaryFn(...args, payload);
      }
      return await primaryFn(...args);
    }
  }

  function isValidId(x) {
    return String(x || "").trim().length > 0;
  }

  function pickDefaultEventId(list = []) {
    const live = (list || []).find(
      (e) => String(e?.status || "").toUpperCase() === "LIVE",
    );
    if (live?._id) return String(live._id);

    const sorted = (list || []).slice().sort((a, b) => {
      const da = new Date(a?.createdAt || a?.startDate || 0).getTime();
      const db = new Date(b?.createdAt || b?.startDate || 0).getTime();
      return db - da;
    });
    if (sorted?.[0]?._id) return String(sorted[0]._id);

    return "";
  }

  function normalizeAcademies(list = []) {
    const map = new Map();

    for (const row of list || []) {
      const raw =
        row?.academyId ||
        row?.academy ||
        row?.branch ||
        row?.item ||
        row ||
        null;

      const id = academyIdFromAny(raw || row);
      if (!id) continue;

      if (!map.has(id)) {
        map.set(id, {
          _id: id,
          id,
          academyId: id,
          name:
            raw?.name ||
            raw?.title ||
            raw?.academyName ||
            row?.name ||
            "Academy",
          code: raw?.code || row?.code || "",
          isActive: raw?.isActive !== false && row?.isActive !== false,
          logoUrl: raw?.logoUrl || row?.logoUrl || "",
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || "")),
    );
  }

  function getJudgeUserId(j) {
    return String(j?.userId?._id || j?._id || "");
  }

  function getJudgeName(j) {
    return j?.name || j?.userId?.name || j?.email || j?.userId?.email || "—";
  }

  function getJudgeEmail(j) {
    return j?.email || j?.userId?.email || "—";
  }

  function getJudgeActive(j) {
    const user = j?.userId || j;
    return user?.isActive !== false;
  }

  function getJudgeAcademyId(j) {
    return String(
      j?.academyId?._id ||
        j?.academyId ||
        j?.userId?.academyId?._id ||
        j?.userId?.academyId ||
        "",
    );
  }

  function getJudgeAcademyName(j) {
    return j?.academyId?.name || j?.userId?.academyId?.name || "—";
  }

  function readQueryParams() {
    try {
      const sp = new URLSearchParams(window.location.search);
      const qpEventId = sp.get("eventId") || "";
      const qpJudgeUserId = sp.get("judgeUserId") || "";
      const qpAcademyId = sp.get("academyId") || "";
      return {
        qpEventId: String(qpEventId || "").trim(),
        qpJudgeUserId: String(qpJudgeUserId || "").trim(),
        qpAcademyId: String(qpAcademyId || "").trim(),
      };
    } catch {
      return { qpEventId: "", qpJudgeUserId: "", qpAcademyId: "" };
    }
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
      const mineId = academyIdFromAny(me?.academyId);
      const mine = mineId
        ? [
            {
              _id: mineId,
              id: mineId,
              academyId: mineId,
              name: me?.academyId?.name || me?.academyName || "My Academy",
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
      const mineId = academyIdFromAny(me?.academyId);
      const mine = mineId
        ? [
            {
              _id: mineId,
              id: mineId,
              academyId: mineId,
              name: me?.academyId?.name || me?.academyName || "My Academy",
              isActive: true,
            },
          ]
        : [];
      return normalizeAcademies(mine);
    }
  }

  async function loadAssignmentsForEvent(eid, academyId = effectiveAcademyId) {
    if (!eid) {
      setAssignments([]);
      return [];
    }

    setLoadingAsg(true);
    try {
      if (typeof api?.judgeAssignments !== "function") {
        throw new Error(
          "api.judgeAssignments(eventId, academyId) missing in api.js",
        );
      }

      const safeAcademyId = academyIdFromAny(academyId);
      const asg = await api.judgeAssignments(String(eid), safeAcademyId || "");
      const safe = Array.isArray(asg) ? asg : [];
      setAssignments(safe);
      return safe;
    } finally {
      setLoadingAsg(false);
    }
  }

  async function refreshAll(
    initial = false,
    forceAcademyId = effectiveAcademyId,
  ) {
    setLoading(true);
    setErr("");
    try {
      const { qpEventId, qpJudgeUserId, qpAcademyId } = readQueryParams();

      const activeAcademyId = academyIdFromAny(qpAcademyId || forceAcademyId);

      if (qpAcademyId && academyIdFromAny(qpAcademyId) !== selectedAcademyId) {
        setSelectedAcademyIdState(academyIdFromAny(qpAcademyId));
      }

      const [academyRows, evs, j, g, a] = await Promise.all([
        loadAcademies(),
        callWithAcademy(
          typeof api?.adminEvents === "function" ? api.adminEvents : api.events,
          [],
          null,
          activeAcademyId,
        ),
        callWithAcademy(api.judges, [], null, activeAcademyId),
        callWithAcademy(api.groups, [], null, activeAcademyId),
        callWithAcademy(api.activities, [], null, activeAcademyId),
      ]);

      const evList = Array.isArray(evs) ? evs : [];
      const judgeList = Array.isArray(j) ? j : [];
      const groupList = normalizeGroups(Array.isArray(g) ? g : []);
      const activityList = Array.isArray(a) ? a : [];

      setAcademies(academyRows);
      setEvents(evList);
      setJudges(judgeList);
      setGroups(groupList);
      setActivities(activityList);

      if (qpAcademyId) {
        const matchedAcademy =
          academyRows.find(
            (x) =>
              String(x?._id || x?.id || x?.academyId) === String(qpAcademyId),
          ) || null;
        if (matchedAcademy) {
          try {
            setSelectedAcademy?.(matchedAcademy);
          } catch {
            // noop
          }
          setSelectedAcademyIdState(String(matchedAcademy._id));
        }
      }

      const defEvent = qpEventId || eventId || pickDefaultEventId(evList);
      if (defEvent && String(defEvent) !== String(eventId)) {
        setEventId(defEvent);
      }

      const firstJudgeId = getJudgeUserId(judgeList?.[0] || {});
      const defJudge = qpJudgeUserId || judgeUserId || firstJudgeId;

      if (defJudge && String(defJudge) !== String(judgeUserId)) {
        setJudgeUserId(defJudge);
      }

      if (defEvent) {
        const asg = await loadAssignmentsForEvent(defEvent, activeAcademyId);

        if (initial && qpJudgeUserId) {
          hydrateFromJudgeRows(qpJudgeUserId, defEvent, asg);
          setEditingJudgeId(String(qpJudgeUserId));
        } else if (initial && defJudge) {
          hydrateFromJudgeRows(defJudge, defEvent, asg);
          setEditingJudgeId(String(defJudge));
        }
      }
    } catch (e) {
      setErr(e?.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!eventId) return;
    loadAssignmentsForEvent(eventId, effectiveAcademyId).catch((e) =>
      setErr(e?.message || "Failed to load assignments"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, effectiveAcademyId]);

  function toggle(setList, id) {
    const sid = String(id);
    setList((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );
  }

  function clearForm() {
    setEditingJudgeId("");
    setGroupIds([]);
    setActivityIds([]);
    setMsg("");
  }

  function hydrateFromJudgeRows(jId, eId, rows = assignments) {
    const sameJudgeRows = (rows || []).filter((x) => {
      const ju = x?.judgeUserId?._id || x?.judgeUserId;
      const ev = x?.eventId?._id || x?.eventId;
      return String(ju) === String(jId) && String(ev) === String(eId);
    });

    const gSet = new Set();
    const aSet = new Set();

    sameJudgeRows.forEach((r) => {
      const gid = r?.groupId?._id || r?.groupId;
      const aid = r?.activityId?._id || r?.activityId;
      if (gid) gSet.add(String(gid));
      if (aid) aSet.add(String(aid));
    });

    setGroupIds(Array.from(gSet));
    setActivityIds(Array.from(aSet));
  }

  function startEditFromGrouped(groupedRow) {
    const jId = groupedRow?.judgeId;
    if (!jId) return;

    setJudgeUserId(String(jId));
    setEditingJudgeId(String(jId));
    hydrateFromJudgeRows(String(jId), eventId, assignments);

    toast("Editing this judge set. Update selections and click Save.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setMsg("");
    setErr("");

    if (!isValidId(eventId)) return toast("Select an event first", "err");
    if (!isValidId(judgeUserId)) return toast("Select a judge", "err");
    if (!groupIds.length) return toast("Select at least 1 group", "err");
    if (!activityIds.length) return toast("Select at least 1 activity", "err");

    try {
      setLoading(true);

      if (typeof api?.replaceJudgeAssignments !== "function") {
        throw new Error(
          "api.replaceJudgeAssignments(payload) missing in api.js",
        );
      }

      await callWithAcademy(
        api.replaceJudgeAssignments,
        [],
        {
          eventId,
          judgeUserId,
          groupIds,
          activityIds,
        },
        effectiveAcademyId,
      );

      const asg = await loadAssignmentsForEvent(eventId, effectiveAcademyId);

      setEditingJudgeId(String(judgeUserId));
      toast("Assignments saved successfully.");

      hydrateFromJudgeRows(String(judgeUserId), eventId, asg);
    } catch (e) {
      toast(e?.message || "Failed to save", "err");
    } finally {
      setLoading(false);
    }
  }

  async function removeJudgeSet(groupedRow) {
    const judgeName = groupedRow?.judgeName || "this judge";
    const groupText = groupedRow?.groupList?.length
      ? groupedRow.groupList
          .map((g) => `${g.name}${g.level ? ` (${g.level})` : ""}`)
          .join(", ")
      : "—";
    const actText = groupedRow?.activityList?.length
      ? groupedRow.activityList.map((a) => a.name).join(", ")
      : "—";

    const ok = window.confirm(
      `Delete FULL judge set?\n\nJudge: ${judgeName}\nGroups: ${groupText}\nActivities: ${actText}\n\nThis will delete ${groupedRow?.rowIds?.length || 0} rows.`,
    );
    if (!ok) return;

    try {
      setLoading(true);

      if (!groupedRow?.rowIds?.length) {
        toast("Nothing to delete", "err");
        return;
      }

      if (typeof api?.deleteAssignment !== "function") {
        throw new Error("api.deleteAssignment(id) missing in api.js");
      }

      await Promise.all(
        groupedRow.rowIds.map((id) =>
          callWithAcademy(api.deleteAssignment, [id], null, effectiveAcademyId),
        ),
      );

      const asg = await loadAssignmentsForEvent(eventId, effectiveAcademyId);

      if (editingJudgeId) hydrateFromJudgeRows(editingJudgeId, eventId, asg);

      toast("Judge set deleted successfully.");
    } catch (e) {
      toast(e?.message || "Failed to delete", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcademyChange(nextId) {
    persistAcademy(nextId);
    setEventId("");
    setAssignments([]);
    setJudgeUserId("");
    clearForm();
    await refreshAll(false, nextId || "");
  }

  const selectedAcademy = useMemo(() => {
    return (
      academies.find(
        (a) =>
          String(a?._id || a?.id || a?.academyId) ===
          String(effectiveAcademyId),
      ) ||
      academies.find(
        (a) =>
          String(a?._id || a?.id || a?.academyId) === String(selectedAcademyId),
      ) ||
      academyObjectFromAny(getSelectedAcademy?.()) ||
      null
    );
  }, [academies, effectiveAcademyId, selectedAcademyId]);

  const selectedGroups = useMemo(
    () => groups.filter((g) => groupIds.includes(String(g._id))),
    [groups, groupIds],
  );

  const selectedActivities = useMemo(
    () => activities.filter((a) => activityIds.includes(String(a._id))),
    [activities, activityIds],
  );

  const filteredGroups = useMemo(() => {
    const search = gQuery.trim().toLowerCase();
    if (!search) return groups;
    return groups.filter((g) =>
      `${g.name} ${g.level || ""}`.toLowerCase().includes(search),
    );
  }, [groups, gQuery]);

  const filteredActivities = useMemo(() => {
    const search = aQuery.trim().toLowerCase();
    if (!search) return activities;
    return activities.filter((a) =>
      `${a.name} ${a.maxScore ?? ""}`.toLowerCase().includes(search),
    );
  }, [activities, aQuery]);

  const filteredJudges = useMemo(() => {
    const search = q.trim().toLowerCase();

    return (judges || []).filter((j) => {
      const name = String(getJudgeName(j) || "").toLowerCase();
      const email = String(getJudgeEmail(j) || "").toLowerCase();
      const academyOk = superAdmin
        ? !selectedAcademyId ||
          getJudgeAcademyId(j) === String(selectedAcademyId)
        : true;

      if (!academyOk) return false;
      if (search && ![name, email].some((x) => x.includes(search)))
        return false;

      const jid = getJudgeUserId(j);
      const assigned = (assignments || []).some((r) => {
        const ju = r?.judgeUserId?._id || r?.judgeUserId;
        const ev = r?.eventId?._id || r?.eventId;
        return String(ju) === String(jid) && String(ev) === String(eventId);
      });

      if (coverage === "ASSIGNED" && !assigned) return false;
      if (coverage === "UNASSIGNED" && assigned) return false;

      return true;
    });
  }, [
    judges,
    q,
    superAdmin,
    selectedAcademyId,
    coverage,
    assignments,
    eventId,
  ]);

  const eventLabel = useMemo(() => {
    const ev = (events || []).find((x) => String(x._id) === String(eventId));
    if (!ev) return "—";
    return `${ev.name}${ev.status ? ` (${ev.status})` : ""}`;
  }, [events, eventId]);

  const groupedRows = useMemo(() => {
    const rows = (assignments || []).filter((r) => {
      const ev = r?.eventId?._id || r?.eventId;
      return !eventId || String(ev) === String(eventId);
    });

    const map = new Map();

    for (const r of rows) {
      const j = r?.judgeUserId;
      const jId = String(j?._id || r?.judgeUserId || "");
      if (!jId) continue;

      const key = `${String(eventId || "")}__${jId}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          eventText: r?.eventId?.name
            ? `${r.eventId.name}${r.eventId.status ? ` (${r.eventId.status})` : ""}`
            : eventLabel,
          judgeId: jId,
          judgeName: j?.name || j?.email || "Judge",
          judgeEmail: j?.email || "—",
          academyName: r?.academyId?.name || j?.academyId?.name || "—",
          academyId: String(
            r?.academyId?._id ||
              r?.academyId ||
              j?.academyId?._id ||
              j?.academyId ||
              "",
          ),
          groupsMap: new Map(),
          actsMap: new Map(),
          rowIds: [],
        });
      }

      const bucket = map.get(key);
      bucket.rowIds.push(String(r._id));

      const grp = r?.groupId;
      if (grp?._id) {
        bucket.groupsMap.set(String(grp._id), {
          _id: String(grp._id),
          name: grp.name || "Group",
          level: grp.level || "",
        });
      }

      const act = r?.activityId;
      if (act?._id) {
        bucket.actsMap.set(String(act._id), {
          _id: String(act._id),
          name: act.name || "Activity",
          maxScore: act.maxScore,
        });
      }
    }

    const out = Array.from(map.values()).map((x) => ({
      ...x,
      groupList: Array.from(x.groupsMap.values()).sort((a, b) =>
        `${a.name} ${a.level}`.localeCompare(`${b.name} ${b.level}`),
      ),
      activityList: Array.from(x.actsMap.values()).sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      ),
    }));

    out.sort((a, b) => a.judgeName.localeCompare(b.judgeName));
    return out;
  }, [assignments, eventId, eventLabel]);

  const canSave =
    isValidId(eventId) &&
    isValidId(judgeUserId) &&
    groupIds.length &&
    activityIds.length;

  const totalProjectedRows =
    Math.max(0, groupIds.length) * Math.max(0, activityIds.length);

  const activeJudgeCount = useMemo(
    () => (filteredJudges || []).filter((j) => getJudgeActive(j)).length,
    [filteredJudges],
  );

  const assignedJudgeCount = groupedRows.length;
  const academyCountInRows = useMemo(() => {
    const set = new Set(
      groupedRows.map((x) => String(x.academyId || "").trim()).filter(Boolean),
    );
    return set.size;
  }, [groupedRows]);

  return (
    <section style={wrap}>
      <StyleTag />

      <div className="raTopbar">
        <div>
          <div className="raPageEyebrow">
            <span className="raEyebrowIcon">
              <IconLink size={12} />
            </span>
            ADMIN PANEL
          </div>
          <h3 style={UI.h3}>Assignments</h3>
          <div style={UI.sub}>
            Multi-academy event assignment control with judge-set replacement,
            scoped academy loading, and grouped event coverage.
          </div>

          {err ? <div className="raAlert raAlertErr">{err}</div> : null}
          {msg ? <div className="raAlert raAlertOk">{msg}</div> : null}

          {editingJudgeId ? (
            <div className="raMiniText" style={{ marginTop: 8 }}>
              Editing judge set: <b>{editingJudgeId}</b>
            </div>
          ) : null}
        </div>

        <div className="raStats">
          <StatCard
            label="Judge Sets"
            value={groupedRows.length}
            icon={<IconGrid size={18} />}
          />
          <StatCard
            label="Event Rows"
            value={assignments.length}
            tone="live"
            icon={<IconLink size={18} />}
          />
          <StatCard
            label="Active Judges"
            value={activeJudgeCount}
            tone="draft"
            icon={<IconJudge size={18} />}
          />
          <StatCard
            label="Academies"
            value={academyCountInRows || (selectedAcademy ? 1 : 0)}
            tone="default"
            icon={<IconBuilding size={18} />}
          />
        </div>
      </div>

      <div className="raControlBar">
        <div className="raInfoPill">
          <span className="raInfoPillIcon">
            <IconBuilding size={13} />
          </span>
          <span>
            Academy: <b>{selectedAcademy?.name || "All / Current"}</b>
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
            Academy-aware load
          </div>
          <div className="raEnhanceItem">
            <span className="raEnhanceIcon">
              <IconFilter size={14} />
            </span>
            Coverage filtering
          </div>
          <div className="raEnhanceItem">
            <span className="raEnhanceIcon">
              <IconSparkles size={14} />
            </span>
            Judge-set replace
          </div>
        </div>
      </div>

      <div className="raCard raCard2" style={{ marginTop: 16 }}>
        <div className="raTopSelectionRow">
          <div className="raSelectionGrid">
            {superAdmin ? (
              <Field label="Academy">
                <div className="raSelectWrap">
                  <span className="raSelectIcon">
                    <IconBuilding size={14} />
                  </span>
                  <select
                    className="raInput raSelectInput"
                    value={selectedAcademyId}
                    onChange={(e) => handleAcademyChange(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">All / Default Academy Scope</option>
                    {(academies || []).map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name || "Academy"}
                        {a.code ? ` (${a.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            ) : null}

            <Field label="Event">
              <div className="raSelectWrap">
                <span className="raSelectIcon">
                  <IconCalendar size={14} />
                </span>
                <select
                  className="raInput raSelectInput"
                  value={eventId}
                  onChange={(e) => {
                    setEventId(e.target.value);
                    clearForm();
                  }}
                  disabled={loading}
                >
                  <option value="">Select Event</option>
                  {(events || []).map((ev) => (
                    <option key={ev._id} value={ev._id}>
                      {ev.name} {ev.status ? `(${ev.status})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            <Field label="Judge Search">
              <div className="raSearchWrap">
                <span className="raSearchIcon">
                  <IconSearch size={14} />
                </span>
                <input
                  className="raInput raInputSearch"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search judge name or email..."
                />
              </div>
            </Field>

            <Field label="Judge Coverage">
              <select
                className="raInput"
                value={coverage}
                onChange={(e) => setCoverage(e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="UNASSIGNED">Unassigned</option>
              </select>
            </Field>

            <Field label="Judge">
              <div className="raSelectWrap">
                <span className="raSelectIcon">
                  <IconJudge size={14} />
                </span>
                <select
                  className="raInput raSelectInput"
                  value={judgeUserId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setJudgeUserId(next);
                    setEditingJudgeId(next || "");

                    if (next && eventId) {
                      hydrateFromJudgeRows(
                        String(next),
                        String(eventId),
                        assignments,
                      );
                    } else {
                      setGroupIds([]);
                      setActivityIds([]);
                    }
                  }}
                  disabled={loading}
                >
                  <option value="">Select Judge</option>
                  {filteredJudges.map((j) => (
                    <option key={getJudgeUserId(j)} value={getJudgeUserId(j)}>
                      {getJudgeName(j)}
                      {getJudgeAcademyName(j) !== "—"
                        ? ` — ${getJudgeAcademyName(j)}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            <div className="raInlineStats">
              <MiniStat label="Groups" value={groupIds.length} />
              <MiniStat label="Activities" value={activityIds.length} />
              <MiniStat label="Projected Rows" value={totalProjectedRows} />
              <MiniStat label="Assigned Judges" value={assignedJudgeCount} />
            </div>
          </div>

          <div className="raFormActions">
            <button
              className="raBtn"
              onClick={() => {
                setEditingJudgeId("");
                setGroupIds([]);
                setActivityIds([]);
                setMsg("");
                setErr("");
              }}
              disabled={loading}
              type="button"
            >
              <IconReset size={14} />
              Clear
            </button>

            <button
              className="raBtnPrimary"
              onClick={save}
              disabled={!canSave || loading}
              type="button"
            >
              <IconSave size={14} />
              {loading ? "Saving..." : "Save (Replace Set)"}
            </button>
          </div>
        </div>

        <div className="raSummaryStrip">
          <InfoPill
            icon={<IconBuilding size={13} />}
            label={`Academy: ${selectedAcademy?.name || "All / Current"}`}
          />
          <InfoPill
            icon={<IconCalendar size={13} />}
            label={`Event: ${eventLabel}`}
          />
          <InfoPill
            icon={<IconGrid size={13} />}
            label={`Rows: ${assignments.length}${loadingAsg ? " (loading…)" : ""}`}
          />
          <InfoPill
            icon={<IconJudge size={13} />}
            label={`Judge Sets: ${groupedRows.length}${loadingAsg ? " (loading…)" : ""}`}
          />
        </div>
      </div>

      <div className="raDualGrid">
        <Panel
          title="Groups"
          subtitle="Select which groups the judge can access within this event and academy scope."
          query={gQuery}
          setQuery={setGQuery}
          open={showGroups}
          setOpen={setShowGroups}
          selected={selectedGroups}
          selectedCount={groupIds.length}
          rightHint={`${filteredGroups.length} available`}
          icon={<IconUsers size={16} />}
        >
          {showGroups && (
            <div className="raListBox">
              {filteredGroups.map((g) => {
                const active = groupIds.includes(String(g._id));
                return (
                  <RowItem
                    key={g._id}
                    active={active}
                    title={g.name}
                    meta={g.level ? `Level: ${g.level}` : ""}
                    onClick={() => toggle(setGroupIds, g._id)}
                  />
                );
              })}
              {!groups.length && (
                <div className="raEmpty">No groups yet. Add them in Setup.</div>
              )}
            </div>
          )}
        </Panel>

        <Panel
          title="Activities"
          subtitle="Select what the judge can score within this event and academy scope."
          query={aQuery}
          setQuery={setAQuery}
          open={showActivities}
          setOpen={setShowActivities}
          selected={selectedActivities}
          selectedCount={activityIds.length}
          rightHint={`${filteredActivities.length} available`}
          icon={<IconActivity size={16} />}
        >
          {showActivities && (
            <div className="raListBox">
              {filteredActivities.map((a) => {
                const active = activityIds.includes(String(a._id));
                return (
                  <RowItem
                    key={a._id}
                    active={active}
                    title={a.name}
                    meta={`Max Score: ${a.maxScore ?? 10}`}
                    onClick={() => toggle(setActivityIds, a._id)}
                  />
                );
              })}
              {!activities.length && (
                <div className="raEmpty">
                  No activities yet. Add them in Setup.
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      <div className="raCard raTableCard" style={{ marginTop: 16 }}>
        <div className="raTableHeadBar">
          <div>
            <div className="raCardTitle">Existing Assignments (Judge Sets)</div>
            <div className="raCardSub">
              One grouped row per judge for the selected event and academy
              scope.
            </div>
          </div>

          <div className="raRightMeta">
            <span className="raMiniText">
              Sets: <b>{groupedRows.length}</b>
            </span>
            <span className="raMiniText">
              Rows: <b>{assignments.length}</b>
            </span>
            <span className="raMiniText">
              Academy: <b>{selectedAcademy?.name || "All / Current"}</b>
            </span>
          </div>
        </div>

        <div className="raTableDesktop">
          <div className="raTableWrap">
            <div className="raTable">
              <div
                className="raThead raStickyHead"
                style={{
                  gridTemplateColumns: "1.15fr 1fr 1fr 1.8fr 1.8fr 260px",
                }}
              >
                <div>Event</div>
                <div>Judge</div>
                <div>Academy</div>
                <div>Groups</div>
                <div>Activities</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              {(groupedRows || []).map((g) => {
                const groupText = g.groupList.length
                  ? g.groupList
                      .map((x) => `${x.name}${x.level ? ` (${x.level})` : ""}`)
                      .join(", ")
                  : "—";

                return (
                  <div
                    key={g.key}
                    className="raTrow raRowHover"
                    style={{
                      gridTemplateColumns: "1.15fr 1fr 1fr 1.8fr 1.8fr 260px",
                    }}
                  >
                    <div style={{ fontWeight: 950 }}>
                      {g.eventText || eventLabel}
                    </div>

                    <div className="raJudgeCell">
                      <span className="raJudgeIcon">
                        <IconJudge size={14} />
                      </span>
                      <span style={{ fontWeight: 950 }}>{g.judgeName}</span>
                    </div>

                    <div>
                      <span className="raTagSoft raTagSoftBlue">
                        <IconBuilding size={12} style={{ marginRight: 6 }} />
                        {g.academyName || "—"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {g.groupList.length ? (
                        <>
                          {g.groupList.slice(0, 3).map((gr) => (
                            <span
                              key={gr._id}
                              className="raTagSoft"
                              title={groupText}
                            >
                              {gr.name}
                              {gr.level ? (
                                <span style={{ marginLeft: 6, opacity: 0.75 }}>
                                  ({gr.level})
                                </span>
                              ) : null}
                            </span>
                          ))}
                          {g.groupList.length > 3 ? (
                            <span className="raMoreTag" title={groupText}>
                              +{g.groupList.length - 3}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span style={{ opacity: 0.65 }}>—</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {g.activityList.length ? (
                        g.activityList.map((a) => (
                          <span key={a._id} className="raTagSoft">
                            {a.name}
                            {a.maxScore != null ? (
                              <span style={{ marginLeft: 8, opacity: 0.72 }}>
                                max {a.maxScore}
                              </span>
                            ) : null}
                          </span>
                        ))
                      ) : (
                        <span style={{ opacity: 0.65 }}>—</span>
                      )}
                    </div>

                    <div className="raInlineActions">
                      <button
                        type="button"
                        className="raBtnSmall"
                        onClick={() => startEditFromGrouped(g)}
                        disabled={loading}
                        title="Edit all rows for this judge in this event"
                      >
                        <IconEdit size={14} />
                        Edit Judge Set
                      </button>

                      <button
                        type="button"
                        className="raBtnSmallDanger"
                        onClick={() => removeJudgeSet(g)}
                        disabled={loading}
                        title="Deletes all rows for this judge in this event"
                      >
                        <IconTrash size={14} />
                        Delete Set
                      </button>

                      <span className="raMoreTag">{g.rowIds.length} rows</span>
                    </div>
                  </div>
                );
              })}

              {!groupedRows.length && (
                <div className="raEmpty">
                  No assignments yet for this event.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* COMPONENTS */
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

function InfoPill({ icon, label }) {
  return (
    <div className="raInfoPill">
      <span className="raInfoPillIcon">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  query,
  setQuery,
  open,
  setOpen,
  selected,
  selectedCount,
  rightHint,
  children,
  icon,
}) {
  return (
    <div className="raPanel">
      <div className="raPanelHead">
        <div>
          <div className="raPanelTitle">
            <span className="raPanelTitleIcon">{icon}</span>
            <span>{title}</span>
          </div>
          <div className="raPanelSub">{subtitle}</div>
        </div>

        <div className="raPanelHeadRight">
          <span className="raMiniPill">
            <b>{selectedCount}</b> selected
          </span>
          <button
            className="raLinkBtn"
            onClick={() => setOpen(!open)}
            type="button"
          >
            {open ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="raSelectedWrap">
          {selected.slice(0, 4).map((x) => (
            <span key={x._id} className="raTagSoft">
              {x.name}
            </span>
          ))}
          {selectedCount > 4 && (
            <span className="raMoreTag">+{selectedCount - 4}</span>
          )}
        </div>
      )}

      <div className="raPanelSearchRow">
        <div className="raSearchWrap">
          <span className="raSearchIcon">
            <IconSearch size={14} />
          </span>
          <input
            className="raInput raInputSearch"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="raMiniText" style={{ whiteSpace: "nowrap" }}>
          {rightHint}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function RowItem({ active, title, meta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`raRowItem ${active ? "active" : ""}`}
    >
      <div className="raRowItemInner">
        <div style={{ textAlign: "left" }}>
          <div className="raRowItemTitle">{title}</div>
          {meta ? <div className="raRowItemMeta">{meta}</div> : null}
        </div>
        <div className="raRowItemState">{active ? "Selected" : "Select"}</div>
      </div>
    </button>
  );
}

function MiniStat({ label, value }) {
  return (
    <span className="raMiniPill">
      <span style={{ opacity: 0.72 }}>{label}:</span> <b>{value}</b>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* STYLES */
/* ------------------------------------------------------------------ */

const wrap = { maxWidth: 1320, margin: "0 auto" };

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

      @media (max-width:1000px){
        .raStats{grid-template-columns:repeat(2, minmax(120px, 1fr)); width:100%;}
      }

      @media (max-width:560px){
        .raStats{grid-template-columns:1fr 1fr; gap:10px;}
      }

      @media (max-width:480px){
        .raStats{grid-template-columns:1fr;}
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

      .raControlBar{
        margin-top:14px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
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

      .raCard{
        background:linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,250,252,0.97));
        border:1px solid rgba(17,24,39,0.08);
        border-radius:24px;
        box-shadow:0 18px 52px rgba(2,8,23,0.07), inset 0 1px 0 rgba(255,255,255,0.55);
        backdrop-filter:blur(14px);
        color:#0f172a !important;
      }

      .raCard2{padding:20px; overflow:hidden;}
      .raTableCard{padding:14px;}

      .raLabel{
        font-size:12px;
        opacity:.78;
        margin-bottom:6px;
        font-weight:800;
        color:#475569 !important;
      }

      .raMiniText{
        font-size:12px;
        opacity:.85;
        font-weight:800;
        color:#475569 !important;
      }

      .raInput{
        width:100%;
        box-sizing:border-box;
        min-height:48px;
        padding:12px 14px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.96);
        outline:none;
        font-weight:800;
        font-size:14px;
        color:#0f172a !important;
      }

      .raInput:focus{
        border-color:rgba(225,29,46,0.35);
        box-shadow:0 0 0 6px rgba(225,29,46,0.12);
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

      .raTopSelectionRow{
        display:flex;
        justify-content:space-between;
        gap:14px;
        flex-wrap:wrap;
      }

      .raSelectionGrid{
        display:grid;
        grid-template-columns:repeat(3, minmax(240px, 1fr));
        gap:12px;
        align-items:end;
        flex:1;
        min-width:0;
      }

      .raInlineStats{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        align-items:center;
        grid-column:1 / -1;
      }

      .raFormActions{
        display:flex;
        gap:10px;
        align-items:flex-end;
        flex-wrap:wrap;
      }

      .raSummaryStrip{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:14px;
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

      .raBtnPrimary{
        height:42px;
        padding:0 16px;
        border-radius:14px;
        border:1px solid rgba(225,29,46,0.28);
        background:linear-gradient(180deg, rgba(255,241,242,0.96), rgba(255,228,230,0.95));
        color:${RED} !important;
        font-weight:950;
        cursor:pointer;
        box-shadow:0 12px 26px rgba(225,29,46,0.08);
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
        background:rgba(255,255,255,0.98);
        font-weight:950;
        cursor:pointer;
        color:#0f172a !important;
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
        background:rgba(255,255,255,0.98);
        font-weight:900;
        cursor:pointer;
        color:#0f172a !important;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
      }

      .raBtnSmallDanger{
        height:38px;
        padding:0 12px;
        border-radius:12px;
        border:1px solid rgba(225,29,46,0.22);
        background:rgba(255,241,242,0.98);
        color:${RED} !important;
        font-weight:900;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
      }

      .raBtn:disabled,
      .raBtnPrimary:disabled,
      .raBtnSmall:disabled,
      .raBtnSmallDanger:disabled{
        opacity:.55;
        cursor:not-allowed;
      }

      .raDualGrid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
        margin-top:14px;
      }

      .raPanel{
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.08);
        background:linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.97));
        box-shadow:0 10px 30px rgba(17,24,39,0.05);
        padding:14px;
      }

      .raPanelHead{
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:flex-start;
      }

      .raPanelHeadRight{
        display:flex;
        gap:8px;
        align-items:center;
        flex-wrap:wrap;
      }

      .raPanelTitle{
        display:flex;
        align-items:center;
        gap:8px;
        font-weight:950;
        color:#111827;
      }

      .raPanelTitleIcon{
        width:30px;
        height:30px;
        border-radius:10px;
        display:grid;
        place-items:center;
        background:rgba(15,23,42,0.05);
        color:${RED};
        flex:0 0 auto;
      }

      .raPanelSub{
        font-size:12px;
        opacity:.72;
        margin-top:4px;
        color:#475569;
        line-height:1.45;
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

      .raLinkBtn{
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.94);
        border-radius:999px;
        padding:6px 10px;
        cursor:pointer;
        font-weight:900;
        font-size:12px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        color:#111827;
      }

      .raSelectedWrap{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:10px;
      }

      .raPanelSearchRow{
        display:flex;
        justify-content:space-between;
        gap:10px;
        margin-top:10px;
        align-items:center;
      }

      .raListBox{
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.72);
        padding:10px;
        max-height:280px;
        overflow:auto;
        display:grid;
        gap:10px;
      }

      .raRowItem{
        width:100%;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.10);
        padding:12px;
        cursor:pointer;
        background:rgba(255,255,255,0.92);
        text-align:left;
        transition:all .16s ease;
      }

      .raRowItem.active{
        border-color:rgba(225,29,46,0.25);
        background:rgba(255,241,242,0.75);
      }

      .raRowItemInner{
        display:flex;
        justify-content:space-between;
        gap:10px;
        width:100%;
      }

      .raRowItemTitle{
        font-weight:950;
        color:#111827;
      }

      .raRowItemMeta{
        font-size:12px;
        opacity:.72;
        margin-top:4px;
        color:#475569;
      }

      .raRowItemState{
        align-self:center;
        font-weight:950;
        color:#111827;
        opacity:.9;
      }

      .raRowItem.active .raRowItemTitle,
      .raRowItem.active .raRowItemState{
        color:${RED};
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

      .raTableDesktop{display:block;}
      .raTableWrap{
        overflow:auto;
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.08);
        max-height:72vh;
        background:rgba(255,255,255,0.78);
      }

      .raTable{
        min-width:1350px;
        overflow:hidden;
        color:#0f172a !important;
      }

      .raThead{
        display:grid;
        padding:13px 14px;
        background:rgba(248,250,252,0.98);
        border-bottom:1px solid rgba(17,24,39,0.08);
        font-weight:950;
        font-size:12px;
        color:#475569 !important;
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
        background:rgba(255,255,255,0.94);
        border-bottom:1px solid rgba(17,24,39,0.06);
        align-items:center;
      }

      .raRowHover:hover{background:rgba(255,255,255,0.99);}
      .raInlineActions{
        display:flex;
        justify-content:flex-end;
        gap:8px;
        flex-wrap:wrap;
      }

      .raJudgeCell{
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }

      .raJudgeIcon{
        width:32px;
        height:32px;
        border-radius:10px;
        display:grid;
        place-items:center;
        background:rgba(15,23,42,0.05);
        color:${RED};
        flex:0 0 auto;
      }

      .raTagSoft{
        display:inline-flex;
        align-items:center;
        padding:6px 10px;
        border-radius:999px;
        background:rgba(255,255,255,0.88);
        border:1px solid rgba(17,24,39,0.10);
        color:#111827;
        font-weight:900;
        font-size:12px;
        white-space:nowrap;
      }

      .raTagSoftBlue{
        border-color:rgba(59,130,246,0.20);
        background:rgba(239,246,255,0.95);
        color:#1d4ed8;
      }

      .raMoreTag{
        display:inline-flex;
        align-items:center;
        padding:6px 10px;
        border-radius:999px;
        background:rgba(17,24,39,0.06);
        border:1px solid rgba(17,24,39,0.10);
        color:#111827;
        font-weight:900;
        font-size:12px;
        white-space:nowrap;
      }

      .raEmpty{
        padding:28px 18px;
        text-align:center;
        opacity:.95;
        background:rgba(255,255,255,0.72);
        color:#475569 !important;
        border-radius:14px;
      }

      @media (max-width:1200px){
        .raSelectionGrid{
          grid-template-columns:repeat(2, minmax(240px, 1fr));
        }
      }

      @media (max-width:900px){
        .raDualGrid{
          grid-template-columns:1fr;
        }
      }

      @media (max-width:700px){
        .raSelectionGrid{
          grid-template-columns:1fr;
        }
        .raFormActions{
          width:100%;
        }
        .raFormActions .raBtn,
        .raFormActions .raBtnPrimary{
          flex:1 1 100%;
        }
      }

      @media (max-width:640px){
        .raPanelSearchRow{
          flex-direction:column;
          align-items:stretch;
        }
        .raSummaryStrip{
          flex-direction:column;
        }
        .raEnhanceStrip{
          width:100%;
        }
      }

      @media (prefers-reduced-motion: reduce){
        *{transition:none !important;}
      }
    `}</style>
  );
}
