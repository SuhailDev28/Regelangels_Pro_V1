// client/src/pages/Admin/Alerts.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import {
  getUser,
  isSuperAdmin,
  getEffectiveAcademy,
  getSelectedAcademy,
  setSelectedAcademy,
} from "../../lib/auth.js";

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

const IconBell = (p) => (
  <SvgIcon {...p}>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </SvgIcon>
);

const IconRefresh = (p) => (
  <SvgIcon {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </SvgIcon>
);

const IconSearch = (p) => (
  <SvgIcon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </SvgIcon>
);

const IconClock = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </SvgIcon>
);

const IconCheck = (p) => (
  <SvgIcon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </SvgIcon>
);

const IconAlert = (p) => (
  <SvgIcon {...p}>
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </SvgIcon>
);

const IconUser = (p) => (
  <SvgIcon {...p}>
    <path d="M20 21a8 8 0 1 0-16 0" />
    <circle cx="12" cy="8" r="4" />
  </SvgIcon>
);

const IconCalendar = (p) => (
  <SvgIcon {...p}>
    <path d="M8 2v4M16 2v4" />
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18" />
  </SvgIcon>
);

const IconActivity = (p) => (
  <SvgIcon {...p}>
    <path d="M3 12h4l3-7 4 14 3-7h4" />
  </SvgIcon>
);

const IconMessage = (p) => (
  <SvgIcon {...p}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </SvgIcon>
);

/* ------------------------------------------------------------------ */
/* MAIN */
/* ------------------------------------------------------------------ */

export default function Alerts({
  onAlertCreated,
  onAlertResolved,
  onAlertDeleted,
  onNotificationCreated,
}) {
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

  const [status, setStatus] = useState("OPEN");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [selectedAlert, setSelectedAlert] = useState(null);

  const [search, setSearch] = useState("");
  const [judgeFilter, setJudgeFilter] = useState("ALL");
  const [eventFilter, setEventFilter] = useState("ALL");
  const [academyFilter, setAcademyFilter] = useState(() => {
    try {
      return normalizeAcademyValue(getSelectedAcademy?.());
    } catch {
      return "";
    }
  });

  const [academies, setAcademies] = useState([]);
  const [soundOn, setSoundOn] = useState(
    () => localStorage.getItem("ra_sound") === "1",
  );

  const audioRef = useRef(null);
  const prevOpenIdsRef = useRef(new Set());
  const resolvingRef = useRef(new Set());
  const pollRef = useRef(null);

  const effectiveAcademyId = useMemo(() => {
    try {
      return normalizeAcademyValue(
        getEffectiveAcademy?.() ||
          academyFilter ||
          me?.academyId?._id ||
          me?.academyId ||
          "",
      );
    } catch {
      return normalizeAcademyValue(
        academyFilter || me?.academyId?._id || me?.academyId || "",
      );
    }
  }, [academyFilter, me]);

  function toast(text, type = "ok") {
    setMsg("");
    setErr("");

    if (type === "err") setErr(text);
    else setMsg(text);

    window.clearTimeout(window.__ra_toast);
    window.__ra_toast = window.setTimeout(() => {
      setMsg("");
      setErr("");
    }, 2400);
  }

  function persistAcademy(value) {
    const nextId = normalizeAcademyValue(value);
    setAcademyFilter(nextId);

    try {
      if (!nextId) return;

      const found = academies.find((a) => String(a._id) === String(nextId));
      if (!found) return;

      setSelectedAcademy?.({
        academyId: found._id,
        academyName: found.name,
        academyCode: found.code || "",
        _id: found._id,
        id: found._id,
        name: found.name,
        code: found.code || "",
      });
    } catch {
      // noop
    }
  }

  function readQueryParams() {
    try {
      const sp = new URLSearchParams(window.location.search);
      return {
        qpAcademyId: normalizeAcademyValue(sp.get("academyId") || ""),
        qpStatus: String(sp.get("status") || "")
          .trim()
          .toUpperCase(),
        qpJudge: String(sp.get("judge") || "")
          .trim()
          .toLowerCase(),
        qpEventId: String(sp.get("eventId") || "").trim(),
      };
    } catch {
      return { qpAcademyId: "", qpStatus: "", qpJudge: "", qpEventId: "" };
    }
  }

  const openCount = useMemo(
    () =>
      (rows || []).filter((a) => normalizeStatus(a?.status) === "OPEN").length,
    [rows],
  );

  const judges = useMemo(() => {
    const map = new Map();

    for (const a of rows || []) {
      const name = getJudgeName(a);
      const email = getJudgeEmail(a);
      const key = String(email || name || "")
        .trim()
        .toLowerCase();
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          email,
          label: email ? `${name} (${email})` : name,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      String(a.label || "").localeCompare(String(b.label || "")),
    );
  }, [rows]);

  const events = useMemo(() => {
    const map = new Map();

    for (const a of rows || []) {
      const id = String(getEventId(a) || "").trim();
      const name = getEventName(a);
      if (!id && !name) continue;

      const key = id || name;
      if (!map.has(key)) {
        map.set(key, {
          key,
          id,
          name: name || "—",
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );
  }, [rows]);

  const selectedAcademy = useMemo(() => {
    return (
      academies.find((a) => String(a._id) === String(effectiveAcademyId)) ||
      academies.find((a) => String(a._id) === String(academyFilter)) ||
      null
    );
  }, [academies, effectiveAcademyId, academyFilter]);

  const filteredRows = useMemo(() => {
    const q = String(search || "")
      .trim()
      .toLowerCase();

    return (rows || []).filter((a) => {
      if (judgeFilter !== "ALL") {
        const judgeKey = String(
          getJudgeEmail(a) || getJudgeName(a) || "",
        ).toLowerCase();
        if (judgeKey !== judgeFilter) return false;
      }

      if (eventFilter !== "ALL") {
        const currentEventId = String(getEventId(a) || "");
        if (currentEventId !== String(eventFilter)) return false;
      }

      if (!q) return true;

      const hay = [
        normalizeStatus(a?.status),
        getJudgeName(a),
        getJudgeEmail(a),
        getActivityName(a),
        getEventName(a),
        getAcademyName(a),
        String(a?.message || ""),
        formatTime(a?.createdAt),
        formatTime(a?.resolvedAt),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [rows, search, judgeFilter, eventFilter]);

  const resolvedCount = useMemo(
    () =>
      (rows || []).filter((a) => normalizeStatus(a?.status) === "RESOLVED")
        .length,
    [rows],
  );

  const activeJudgeCount = useMemo(() => judges.length, [judges]);

  const academyCount = useMemo(() => {
    const set = new Set(
      (rows || [])
        .map((a) => String(getAcademyId(a) || "").trim())
        .filter(Boolean),
    );
    return set.size;
  }, [rows]);

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
        me?.academyId?._id || me?.academyId
          ? [
              {
                _id: String(me?.academyId?._id || me?.academyId),
                name: me?.academyId?.name || "My Academy",
                isActive: true,
              },
            ]
          : [];
      return normalizeAcademies(mine);
    }

    try {
      const res = await fn();
      const items = extractArrayPayload(res);
      if (items.length) return normalizeAcademies(items);
      return normalizeAcademies(Array.isArray(res) ? res : []);
    } catch {
      const mine =
        me?.academyId?._id || me?.academyId
          ? [
              {
                _id: String(me?.academyId?._id || me?.academyId),
                name: me?.academyId?.name || "My Academy",
                isActive: true,
              },
            ]
          : [];
      return normalizeAcademies(mine);
    }
  }

  async function playSoundIfNeeded(newRows) {
    if (!soundOn) return;
    if (!audioRef.current) return;

    const openAlerts = (newRows || []).filter(
      (a) => normalizeStatus(a?.status) === "OPEN",
    );

    const openIds = new Set(openAlerts.map((a) => String(getAlertId(a))));
    let hasNew = false;

    for (const id of openIds) {
      if (!prevOpenIdsRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }

    prevOpenIdsRef.current = openIds;

    if (hasNew) {
      try {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } catch {
        // autoplay may be blocked
      }
    }
  }

  function emitNewOpenAlerts(nextRows = []) {
    const nextOpen = nextRows.filter(
      (a) => normalizeStatus(a?.status) === "OPEN",
    );
    const nextOpenIds = new Set(nextOpen.map((a) => String(getAlertId(a))));
    const prevIds = prevOpenIdsRef.current || new Set();

    for (const alert of nextOpen) {
      const id = String(getAlertId(alert));
      if (!prevIds.has(id)) {
        onAlertCreated?.({
          id,
          alertId: id,
          message:
            alert?.message || `New alert from ${getJudgeName(alert)} received.`,
          judgeName: getJudgeName(alert),
          judgeEmail: getJudgeEmail(alert),
          academyId: getAcademyId(alert),
          academyName: getAcademyName(alert),
          eventId: getEventId(alert),
          eventName: getEventName(alert),
          activityName: getActivityName(alert),
          createdNotification: false,
        });
      }
    }

    prevOpenIdsRef.current = nextOpenIds;
  }

  async function fetchAlertsRobust(academyId = effectiveAcademyId) {
    const aid = normalizeAcademyValue(academyId);

    if (typeof api.adminAlerts !== "function") {
      throw new Error("api.adminAlerts is not defined in src/lib/api.js");
    }

    const queryString = `?status=${encodeURIComponent(status)}&limit=300${
      aid ? `&academyId=${encodeURIComponent(aid)}` : ""
    }`;

    try {
      const data = await api.adminAlerts(queryString);
      const arr = extractArrayPayload(data);
      if (arr.length) return arr;
      if (Array.isArray(data)) return data;
    } catch {
      // fallback below
    }

    const fallback = await api.adminAlerts(aid ? `?academyId=${aid}` : "");
    const arr = extractArrayPayload(fallback);

    if (status === "ALL") return arr;
    return arr.filter((x) => normalizeStatus(x?.status) === status);
  }

  async function load(silent = false, academyId = effectiveAcademyId) {
    if (!silent) {
      setLoading(true);
      setErr("");
    }

    try {
      const arr = await fetchAlertsRobust(academyId);
      setRows(arr);

      setSelectedAlert((prev) => {
        if (!prev) return arr?.[0] || null;
        const existing = arr.find(
          (x) => String(getAlertId(x)) === String(getAlertId(prev)),
        );
        return existing || arr?.[0] || null;
      });

      emitNewOpenAlerts(arr);

      if (status === "OPEN" || status === "ALL") {
        await playSoundIfNeeded(arr);
      } else {
        prevOpenIdsRef.current = new Set(
          (arr || [])
            .filter((a) => normalizeStatus(a?.status) === "OPEN")
            .map((a) => String(getAlertId(a))),
        );
      }
    } catch (e) {
      setErr(e?.message || "Request failed");
      setRows([]);
      setSelectedAlert(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    const { qpAcademyId, qpStatus, qpJudge, qpEventId } = readQueryParams();

    if (qpAcademyId) persistAcademy(qpAcademyId);
    if (qpStatus && ["OPEN", "RESOLVED", "ALL"].includes(qpStatus)) {
      setStatus(qpStatus);
    }
    if (qpJudge) setJudgeFilter(qpJudge);
    if (qpEventId) setEventFilter(qpEventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;

    loadAcademies().then((list) => {
      if (!mounted) return;
      setAcademies(list);
    });

    return () => {
      mounted = false;
    };
  }, [me]);

  useEffect(() => {
    load(false, effectiveAcademyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, effectiveAcademyId]);

  useEffect(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);

    pollRef.current = window.setInterval(() => {
      load(true, effectiveAcademyId);
    }, 3000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, soundOn, effectiveAcademyId]);

  async function resolve(id) {
    if (!id) return;
    if (resolvingRef.current.has(id)) return;

    resolvingRef.current.add(id);

    setRows((prev) =>
      (prev || []).map((x) =>
        String(getAlertId(x)) === String(id) ? { ...x, __resolving: true } : x,
      ),
    );

    setSelectedAlert((prev) => {
      if (!prev) return prev;
      if (String(getAlertId(prev)) !== String(id)) return prev;
      return { ...prev, __resolving: true };
    });

    try {
      if (typeof api.resolveAlert !== "function") {
        throw new Error("api.resolveAlert is not defined in src/lib/api.js");
      }

      const resolvedItem =
        (rows || []).find((x) => String(getAlertId(x)) === String(id)) || null;

      await api.resolveAlert(id);

      setRows((prev) => {
        const arr = prev || [];

        if (status === "OPEN") {
          return arr.filter((x) => String(getAlertId(x)) !== String(id));
        }

        return arr.map((x) =>
          String(getAlertId(x)) === String(id)
            ? {
                ...x,
                status: "RESOLVED",
                resolvedAt: new Date().toISOString(),
                __resolving: false,
              }
            : x,
        );
      });

      setSelectedAlert((prev) => {
        if (!prev) return prev;
        if (String(getAlertId(prev)) !== String(id)) return prev;
        if (status === "OPEN") return null;
        return {
          ...prev,
          status: "RESOLVED",
          resolvedAt: new Date().toISOString(),
          __resolving: false,
        };
      });

      prevOpenIdsRef.current = new Set(
        Array.from(prevOpenIdsRef.current || []).filter(
          (openId) => String(openId) !== String(id),
        ),
      );

      onAlertResolved?.({
        id,
        alertId: id,
        message:
          resolvedItem?.message ||
          `Alert from ${getJudgeName(resolvedItem)} resolved successfully.`,
        judgeName: getJudgeName(resolvedItem),
        judgeEmail: getJudgeEmail(resolvedItem),
        academyId: getAcademyId(resolvedItem),
        academyName: getAcademyName(resolvedItem),
        eventId: getEventId(resolvedItem),
        eventName: getEventName(resolvedItem),
        activityName: getActivityName(resolvedItem),
      });

      toast("Alert resolved successfully.");
    } catch (e) {
      setRows((prev) =>
        (prev || []).map((x) =>
          String(getAlertId(x)) === String(id)
            ? { ...x, __resolving: false }
            : x,
        ),
      );

      setSelectedAlert((prev) => {
        if (!prev) return prev;
        if (String(getAlertId(prev)) !== String(id)) return prev;
        return { ...prev, __resolving: false };
      });

      toast(e?.message || "Resolve failed", "err");
    } finally {
      resolvingRef.current.delete(id);
    }
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem("ra_sound", next ? "1" : "0");

    if (next && audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        })
        .catch(() => {});
    }
  }

  async function handleAcademyChange(nextId) {
    const safeId = normalizeAcademyValue(nextId);
    persistAcademy(safeId);
    setSelectedAlert(null);
    setRows([]);
    setJudgeFilter("ALL");
    setEventFilter("ALL");
    await load(false, safeId);
  }

  const selectedStatus = normalizeStatus(selectedAlert?.status);

  return (
    <div className="raAlertsPage">
      <StyleTag />

      <audio ref={audioRef} src="/notify.mp3" preload="auto" />

      <section className="raHero">
        <div className="raHeroMain">
          <div className="raHeroBadge">OPERATIONS HUB</div>

          <div className="raHeroTitleRow">
            <h1 className="raHeroTitle">Alerts Center</h1>
            <span className={`raHeroBubble ${openCount ? "is-live" : ""}`}>
              {openCount} live
            </span>
          </div>

          <p className="raHeroText">
            Monitor judge help requests, triage incidents faster, and resolve
            alerts with a cleaner responsive workflow built for desktop, tablet,
            and mobile.
          </p>

          <div className="raHeroChips">
            <div className="raHeroChip">
              <span className="raHeroChipIcon">
                <IconShield size={14} />
              </span>
              Academy-aware monitoring
            </div>
            <div className="raHeroChip">
              <span className="raHeroChipIcon">
                <IconFilter size={14} />
              </span>
              Smart filtering
            </div>
            <div className="raHeroChip">
              <span className="raHeroChipIcon">
                <IconSparkles size={14} />
              </span>
              Fast resolution flow
            </div>
          </div>
        </div>

        <div className="raHeroSide">
          <div className="raScopeCard">
            <div className="raScopeTop">
              <div className="raScopeTitle">Current Scope</div>
              {superAdmin ? (
                <span className="raScopeTag raScopeTagBlue">SUPER ADMIN</span>
              ) : (
                <span className="raScopeTag raScopeTagGreen">SCOPED</span>
              )}
            </div>

            <div className="raScopeAcademy">
              <span className="raScopeAcademyIcon">
                <IconBuilding size={16} />
              </span>
              <div>
                <div className="raScopeLabel">Academy</div>
                <div className="raScopeValue">
                  {selectedAcademy?.name || "All / Current"}
                </div>
              </div>
            </div>

            <div className="raHeroButtons">
              <button
                className={`raActionBtn ${soundOn ? "raActionBtnAccent" : ""}`}
                onClick={toggleSound}
                type="button"
              >
                <IconBell size={15} />
                {soundOn ? "Sound On" : "Sound Off"}
              </button>

              <button
                className="raActionBtn"
                onClick={() => load(false, effectiveAcademyId)}
                type="button"
                disabled={loading}
              >
                <IconRefresh size={15} />
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="raKpiGrid">
        <StatCard
          label="Open Alerts"
          value={openCount}
          tone="danger"
          icon={<IconAlert size={16} />}
          sub="Needs action"
        />
        <StatCard
          label="Resolved Alerts"
          value={resolvedCount}
          tone="success"
          icon={<IconCheck size={16} />}
          sub="Handled records"
        />
        <StatCard
          label="Visible Rows"
          value={filteredRows.length}
          icon={<IconFilter size={16} />}
          sub="Current filtered feed"
        />
        <StatCard
          label="Judges In Feed"
          value={activeJudgeCount}
          icon={<IconUser size={16} />}
          sub="Active unique judges"
        />
        <StatCard
          label="Academies"
          value={academyCount || 1}
          icon={<IconBuilding size={16} />}
          sub="Feed coverage"
        />
        <StatCard
          label="Polling"
          value="3s"
          icon={<IconClock size={16} />}
          sub="Live refresh cadence"
        />
      </section>

      {(msg || err) && (
        <div className={`raToast ${err ? "raToastErr" : "raToastOk"}`}>
          {err || msg}
        </div>
      )}

      <section className="raFilterPanel">
        <div className="raPanelHead">
          <div>
            <div className="raPanelTitle">Filter & Search</div>
            <div className="raPanelSub">
              Narrow alerts by academy, status, judge, event, or text search.
            </div>
          </div>

          <div className="raPanelPills">
            <span className="raMiniPill">
              Queue: <b>{filteredRows.length}</b>
            </span>
            <span className="raMiniPill">
              Open: <b>{openCount}</b>
            </span>
          </div>
        </div>

        <div className="raFiltersGrid">
          {superAdmin ? (
            <div className="raField">
              <label className="raFieldLabel">Academy</label>
              <select
                className="raSelect"
                value={academyFilter}
                onChange={(e) => handleAcademyChange(e.target.value)}
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

          <div
            className={`raField ${superAdmin ? "raFieldWide" : "raFieldXL"}`}
          >
            <label className="raFieldLabel">Search</label>
            <div className="raSearchBox">
              <span className="raSearchIcon">
                <IconSearch size={16} />
              </span>
              <input
                className="raInput raInputSearch"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search judge, academy, event, activity, message..."
              />
            </div>
          </div>

          <div className="raField">
            <label className="raFieldLabel">Status</label>
            <select
              className="raSelect"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ALL">All</option>
            </select>
          </div>

          <div className="raField">
            <label className="raFieldLabel">Judge</label>
            <select
              className="raSelect"
              value={judgeFilter}
              onChange={(e) => setJudgeFilter(e.target.value)}
            >
              <option value="ALL">All Judges</option>
              {judges.map((j) => (
                <option key={j.key} value={j.key}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>

          <div className="raField">
            <label className="raFieldLabel">Event</label>
            <select
              className="raSelect"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              <option value="ALL">All Events</option>
              {events.map((ev) => (
                <option key={ev.key} value={ev.id || ev.key}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="raMainGrid">
        <div className="raPanel raQueuePanel">
          <div className="raPanelHead">
            <div>
              <div className="raPanelTitle">Alert Queue</div>
              <div className="raPanelSub">
                Live incident feed optimized for large screens and compact
                mobile cards.
              </div>
            </div>

            <div className="raPanelPills">
              <span className="raMiniPill">
                Showing <b>{filteredRows.length}</b>
              </span>
              <span className="raMiniPill">
                Judges <b>{activeJudgeCount}</b>
              </span>
            </div>
          </div>

          {loading ? <div className="raEmpty">Loading alerts…</div> : null}

          {!loading && filteredRows.length === 0 ? (
            <div className="raEmpty">
              No alerts{" "}
              {status === "OPEN"
                ? "open"
                : status === "RESOLVED"
                  ? "resolved"
                  : ""}
              .
            </div>
          ) : null}

          {!loading && filteredRows.length > 0 ? (
            <>
              <div className="raDesktopTableWrap">
                <table className="raTable">
                  <thead>
                    <tr>
                      <th style={{ width: "13%" }}>Status</th>
                      <th style={{ width: "19%" }}>Judge</th>
                      <th style={{ width: "18%" }}>Academy / Event</th>
                      <th style={{ width: "15%" }}>Activity</th>
                      <th style={{ width: "22%" }}>Message</th>
                      <th style={{ width: "13%" }}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map((a) => {
                      const st = normalizeStatus(a?.status);
                      const judgeName = getJudgeName(a);
                      const judgeEmail = getJudgeEmail(a);
                      const id = getAlertId(a);
                      const active =
                        selectedAlert &&
                        String(getAlertId(selectedAlert)) === String(id);

                      return (
                        <tr
                          key={String(id)}
                          className={`raTr ${active ? "raTrActive" : ""}`}
                          onClick={() => setSelectedAlert(a)}
                        >
                          <td>
                            <div className="raCellStack">
                              <span
                                className={`raPill ${
                                  st === "OPEN" ? "raPillOpen" : "raPillRes"
                                }`}
                              >
                                {st}
                              </span>
                              <div className="raTextSub">
                                {formatTime(a?.createdAt)}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="raCellStrong">{judgeName}</div>
                            {judgeEmail ? (
                              <div className="raTextSub">{judgeEmail}</div>
                            ) : null}
                          </td>

                          <td>
                            <div className="raCellStrong">
                              {getAcademyName(a) || "—"}
                            </div>
                            <div className="raTextSub">
                              {getEventName(a) || "—"}
                            </div>
                          </td>

                          <td>
                            <div className="raCellStrong">
                              {getActivityName(a)}
                            </div>
                            {a?.activity?.maxScore !== undefined ? (
                              <div className="raTextSub">
                                Max {a.activity.maxScore}
                              </div>
                            ) : a?.activityId?.maxScore !== undefined ? (
                              <div className="raTextSub">
                                Max {a.activityId.maxScore}
                              </div>
                            ) : null}
                          </td>

                          <td>
                            <div className="raMessageClamp">
                              {a?.message || <span className="raMuted">—</span>}
                            </div>
                          </td>

                          <td>
                            {st === "OPEN" ? (
                              <button
                                className="raResolveBtn"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resolve(id);
                                }}
                                disabled={!!a.__resolving}
                              >
                                {a.__resolving ? "Resolving…" : "Resolve"}
                              </button>
                            ) : (
                              <span className="raMuted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="raMobileList">
                {filteredRows.map((a) => {
                  const st = normalizeStatus(a?.status);
                  const id = getAlertId(a);
                  const active =
                    selectedAlert &&
                    String(getAlertId(selectedAlert)) === String(id);

                  return (
                    <div
                      key={String(id)}
                      className={`raMobileCard ${
                        active ? "raMobileCardActive" : ""
                      }`}
                      onClick={() => setSelectedAlert(a)}
                    >
                      <div className="raMobileCardHead">
                        <div className="raMobileCardTop">
                          <span
                            className={`raPill ${
                              st === "OPEN" ? "raPillOpen" : "raPillRes"
                            }`}
                          >
                            {st}
                          </span>
                          <span className="raTextSub">
                            {formatTime(a?.createdAt)}
                          </span>
                        </div>

                        <div className="raMobileJudge">
                          <div className="raCellStrong">{getJudgeName(a)}</div>
                          {getJudgeEmail(a) ? (
                            <div className="raTextSub">{getJudgeEmail(a)}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="raInfoGrid">
                        <InfoMini
                          label="Academy"
                          value={getAcademyName(a) || "—"}
                          icon={<IconBuilding size={14} />}
                        />
                        <InfoMini
                          label="Event"
                          value={getEventName(a) || "—"}
                          icon={<IconCalendar size={14} />}
                        />
                        <InfoMini
                          label="Activity"
                          value={getActivityName(a)}
                          icon={<IconActivity size={14} />}
                        />
                        <InfoMini
                          label="Resolved"
                          value={formatTime(a?.resolvedAt) || "—"}
                          icon={<IconCheck size={14} />}
                        />
                      </div>

                      <div className="raMobileMessage">
                        <div className="raMobileMessageLabel">
                          <IconMessage size={14} />
                          Message
                        </div>
                        <div className="raMobileMessageText">
                          {a?.message || "—"}
                        </div>
                      </div>

                      <div className="raMobileActions">
                        {st === "OPEN" ? (
                          <button
                            className="raResolveBtn raResolveBtnWide"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              resolve(id);
                            }}
                            disabled={!!a.__resolving}
                          >
                            {a.__resolving ? "Resolving…" : "Resolve Alert"}
                          </button>
                        ) : (
                          <div className="raResolvedChip">Already resolved</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        <aside className="raPanel raDetailPanel">
          <div className="raPanelHead">
            <div>
              <div className="raPanelTitle">Alert Detail</div>
              <div className="raPanelSub">
                Inspect alert context before taking action.
              </div>
            </div>
          </div>

          {selectedAlert ? (
            <div className="raDetailBody">
              <div className="raDetailStatusCard">
                <div className="raDetailStatusTop">
                  <div>
                    <div className="raDetailStatusLabel">Current status</div>
                    <div className="raDetailStatusValue">
                      <span
                        className={`raPill ${
                          selectedStatus === "OPEN" ? "raPillOpen" : "raPillRes"
                        }`}
                      >
                        {selectedStatus}
                      </span>
                    </div>
                  </div>

                  <div className="raDetailStatusMeta">
                    <div className="raDetailMini">
                      <span>Created</span>
                      <b>{formatTime(selectedAlert?.createdAt) || "—"}</b>
                    </div>
                    <div className="raDetailMini">
                      <span>Resolved</span>
                      <b>{formatTime(selectedAlert?.resolvedAt) || "—"}</b>
                    </div>
                  </div>
                </div>
              </div>

              <div className="raDetailGrid">
                <DetailTile
                  label="Judge"
                  icon={<IconUser size={16} />}
                  value={getJudgeName(selectedAlert)}
                  sub={getJudgeEmail(selectedAlert) || ""}
                />
                <DetailTile
                  label="Academy"
                  icon={<IconBuilding size={16} />}
                  value={getAcademyName(selectedAlert) || "—"}
                />
                <DetailTile
                  label="Event"
                  icon={<IconCalendar size={16} />}
                  value={getEventName(selectedAlert) || "—"}
                />
                <DetailTile
                  label="Activity"
                  icon={<IconActivity size={16} />}
                  value={getActivityName(selectedAlert)}
                  sub={
                    selectedAlert?.activity?.maxScore !== undefined
                      ? `Max Score: ${selectedAlert.activity.maxScore}`
                      : selectedAlert?.activityId?.maxScore !== undefined
                        ? `Max Score: ${selectedAlert.activityId.maxScore}`
                        : ""
                  }
                />
              </div>

              <div className="raMessagePanel">
                <div className="raMessagePanelTitle">
                  <IconMessage size={16} />
                  Alert Message
                </div>
                <div className="raMessagePanelBody">
                  {selectedAlert?.message || "—"}
                </div>
              </div>

              {selectedStatus === "OPEN" ? (
                <button
                  className="raResolveBtn raResolveBtnWide"
                  type="button"
                  onClick={() => resolve(getAlertId(selectedAlert))}
                  disabled={!!selectedAlert?.__resolving}
                >
                  {selectedAlert?.__resolving ? "Resolving…" : "Resolve Alert"}
                </button>
              ) : (
                <div className="raResolvedState">
                  <IconCheck size={16} />
                  This alert has already been resolved.
                </div>
              )}
            </div>
          ) : (
            <div className="raEmpty">
              Select an alert from the queue to view its full details.
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SUB COMPONENTS */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, tone = "default", icon = null, sub = "" }) {
  return (
    <div className={`raKpiCard ${tone}`}>
      <div className="raKpiTop">
        <div className="raKpiIcon">{icon}</div>
        <div className="raKpiLabel">{label}</div>
      </div>
      <div className="raKpiValue">{value}</div>
      {sub ? <div className="raKpiSub">{sub}</div> : null}
    </div>
  );
}

function InfoMini({ label, value, icon = null }) {
  return (
    <div className="raInfoMini">
      <div className="raInfoMiniLabel">
        {icon}
        <span>{label}</span>
      </div>
      <div className="raInfoMiniValue">{value}</div>
    </div>
  );
}

function DetailTile({ label, value, sub = "", icon = null }) {
  return (
    <div className="raDetailTile">
      <div className="raDetailTileLabel">
        {icon}
        <span>{label}</span>
      </div>
      <div className="raDetailTileValue">{value}</div>
      {sub ? <div className="raDetailTileSub">{sub}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */

function extractArrayPayload(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.alerts)) return value.alerts;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  if (Array.isArray(value?.data?.rows)) return value.data.rows;
  if (Array.isArray(value?.data?.alerts)) return value.data.alerts;
  return [];
}

function normalizeAcademyValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();

  if (typeof value === "object") {
    return String(
      value?._id || value?.id || value?.academyId || value?.value || "",
    ).trim();
  }

  return String(value || "").trim();
}

function getAlertId(a) {
  return a?.id || a?._id || "";
}

function normalizeStatus(v) {
  const s = String(v || "OPEN")
    .trim()
    .toUpperCase();
  if (s === "RESOLVED") return "RESOLVED";
  return "OPEN";
}

function getJudgeName(a) {
  return a?.judge?.name || a?.judgeId?.name || a?.judgeUserId?.name || "—";
}

function getJudgeEmail(a) {
  return a?.judge?.email || a?.judgeId?.email || a?.judgeUserId?.email || "";
}

function getActivityName(a) {
  return a?.activity?.name || a?.activityId?.name || "—";
}

function getEventId(a) {
  return a?.event?._id || a?.eventId?._id || a?.eventId || "";
}

function getEventName(a) {
  return a?.event?.name || a?.eventId?.name || "—";
}

function getAcademyId(a) {
  return (
    a?.academy?._id ||
    a?.academyId?._id ||
    a?.academyId ||
    a?.judge?.academyId?._id ||
    a?.judge?.academyId ||
    a?.judgeId?.academyId?._id ||
    a?.judgeId?.academyId ||
    a?.judgeUserId?.academyId?._id ||
    a?.judgeUserId?.academyId ||
    ""
  );
}

function getAcademyName(a) {
  return (
    a?.academy?.name ||
    a?.academyId?.name ||
    a?.judge?.academyId?.name ||
    a?.judgeId?.academyId?.name ||
    a?.judgeUserId?.academyId?.name ||
    "—"
  );
}

function normalizeAcademies(list = []) {
  const map = new Map();

  for (const row of list || []) {
    const raw =
      row?.academyId || row?.academy || row?.branch || row?.item || row || null;

    const id = String(raw?._id || raw?.id || row?._id || "").trim();
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

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* STYLES */
/* ------------------------------------------------------------------ */

function StyleTag() {
  return (
    <style>{`
      .raAlertsPage{
        display:grid;
        gap:16px;
        padding:8px;
        color:#0f172a;
      }

      .raHero,
      .raPanel,
      .raFilterPanel{
        position:relative;
        overflow:hidden;
        border:1px solid rgba(15,23,42,0.08);
        background:
          linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.96));
        box-shadow:
          0 18px 50px rgba(2,8,23,0.06),
          inset 0 1px 0 rgba(255,255,255,0.72);
        border-radius:28px;
        backdrop-filter: blur(12px);
      }

      .raHero{
        display:grid;
        grid-template-columns:minmax(0,1.7fr) minmax(320px,.95fr);
        gap:16px;
        padding:20px;
      }

      .raHero::before,
      .raFilterPanel::before,
      .raPanel::before{
        content:"";
        position:absolute;
        inset:auto auto -80px -80px;
        width:220px;
        height:220px;
        border-radius:999px;
        background:radial-gradient(circle, rgba(225,29,46,0.09), transparent 70%);
        pointer-events:none;
      }

      .raHeroMain{
        position:relative;
        z-index:1;
      }

      .raHeroBadge{
        display:inline-flex;
        align-items:center;
        min-height:30px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(225,29,46,0.16);
        background:rgba(255,241,242,0.82);
        color:${RED};
        font-size:11px;
        font-weight:950;
        letter-spacing:.12em;
        text-transform:uppercase;
      }

      .raHeroTitleRow{
        display:flex;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
        margin-top:12px;
      }

      .raHeroTitle{
        margin:0;
        font-size:34px;
        line-height:1;
        font-weight:1000;
        letter-spacing:-.04em;
        color:#0b1220;
      }

      .raHeroBubble{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:34px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(15,23,42,0.12);
        background:rgba(255,255,255,0.92);
        font-size:12px;
        font-weight:950;
        color:#0f172a;
      }

      .raHeroBubble.is-live{
        border-color:rgba(225,29,46,0.22);
        background:rgba(255,241,242,0.92);
        color:${RED};
        box-shadow:0 10px 24px rgba(225,29,46,0.12);
      }

      .raHeroText{
        margin:12px 0 0;
        max-width:860px;
        font-size:14px;
        line-height:1.65;
        color:rgba(15,23,42,0.74);
        font-weight:700;
      }

      .raHeroChips{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:16px;
      }

      .raHeroChip{
        display:inline-flex;
        align-items:center;
        gap:8px;
        min-height:40px;
        padding:0 14px;
        border-radius:999px;
        border:1px solid rgba(15,23,42,0.08);
        background:rgba(255,255,255,0.88);
        font-size:12px;
        font-weight:900;
        color:#0f172a;
      }

      .raHeroChipIcon{
        display:grid;
        place-items:center;
        color:${RED};
      }

      .raHeroSide{
        position:relative;
        z-index:1;
      }

      .raScopeCard{
        height:100%;
        display:grid;
        gap:14px;
        align-content:start;
        padding:16px;
        border-radius:24px;
        border:1px solid rgba(15,23,42,0.08);
        background:
          linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,250,0.95));
      }

      .raScopeTop{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
      }

      .raScopeTitle{
        font-size:14px;
        font-weight:950;
        color:#0b1220;
      }

      .raScopeTag{
        display:inline-flex;
        align-items:center;
        min-height:28px;
        padding:0 10px;
        border-radius:999px;
        font-size:11px;
        font-weight:950;
      }

      .raScopeTagBlue{
        border:1px solid rgba(59,130,246,0.18);
        background:rgba(239,246,255,0.92);
        color:#1d4ed8;
      }

      .raScopeTagGreen{
        border:1px solid rgba(34,197,94,0.18);
        background:rgba(240,253,244,0.92);
        color:#166534;
      }

      .raScopeAcademy{
        display:flex;
        gap:12px;
        align-items:flex-start;
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(225,29,46,0.16);
        background:rgba(255,241,242,0.58);
      }

      .raScopeAcademyIcon{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        border-radius:12px;
        background:rgba(255,255,255,0.86);
        color:${RED};
        flex:0 0 auto;
      }

      .raScopeLabel{
        font-size:11px;
        font-weight:900;
        letter-spacing:.1em;
        text-transform:uppercase;
        color:rgba(15,23,42,0.55);
      }

      .raScopeValue{
        margin-top:4px;
        font-size:18px;
        font-weight:950;
        line-height:1.2;
        color:#0b1220;
      }

      .raHeroButtons{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .raActionBtn{
        min-height:46px;
        padding:0 14px;
        border-radius:16px;
        border:1px solid rgba(15,23,42,0.10);
        background:rgba(255,255,255,0.92);
        cursor:pointer;
        font-size:13px;
        font-weight:900;
        color:#0f172a;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
      }

      .raActionBtnAccent{
        border-color:rgba(225,29,46,0.22);
        background:rgba(255,241,242,0.92);
        color:${RED};
      }

      .raActionBtn:disabled{
        opacity:.65;
        cursor:not-allowed;
      }

      .raKpiGrid{
        display:grid;
        grid-template-columns:repeat(6,minmax(0,1fr));
        gap:12px;
      }

      .raKpiCard{
        padding:16px;
        border-radius:22px;
        border:1px solid rgba(15,23,42,0.08);
        background:
          linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.96));
        box-shadow:0 12px 28px rgba(2,8,23,0.05);
      }

      .raKpiCard.danger{
        border-color:rgba(225,29,46,0.16);
        background:linear-gradient(180deg, rgba(255,241,242,0.98), rgba(255,246,246,0.98));
      }

      .raKpiCard.success{
        border-color:rgba(34,197,94,0.16);
        background:linear-gradient(180deg, rgba(236,253,245,0.98), rgba(244,255,249,0.98));
      }

      .raKpiTop{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .raKpiIcon{
        width:32px;
        height:32px;
        display:grid;
        place-items:center;
        border-radius:12px;
        background:rgba(15,23,42,0.05);
        color:${RED};
      }

      .raKpiLabel{
        font-size:12px;
        font-weight:900;
        color:rgba(15,23,42,0.72);
      }

      .raKpiValue{
        margin-top:10px;
        font-size:32px;
        line-height:1;
        letter-spacing:-.04em;
        font-weight:1000;
        color:#0b1220;
      }

      .raKpiSub{
        margin-top:8px;
        font-size:12px;
        font-weight:800;
        color:rgba(15,23,42,0.58);
      }

      .raToast{
        padding:13px 15px;
        border-radius:18px;
        border:1px solid rgba(15,23,42,0.10);
        font-weight:900;
      }

      .raToastOk{
        color:rgba(22,101,52,0.96);
        border-color:rgba(34,197,94,0.20);
        background:rgba(236,253,245,0.92);
      }

      .raToastErr{
        color:${RED};
        border-color:rgba(225,29,46,0.18);
        background:rgba(255,241,242,0.94);
      }

      .raFilterPanel{
        padding:16px;
      }

      .raPanel{
        padding:16px;
      }

      .raPanelHead{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
      }

      .raPanelTitle{
        font-size:18px;
        font-weight:950;
        color:#0b1220;
      }

      .raPanelSub{
        margin-top:5px;
        font-size:12px;
        line-height:1.5;
        font-weight:700;
        color:rgba(15,23,42,0.66);
      }

      .raPanelPills{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .raMiniPill{
        display:inline-flex;
        align-items:center;
        min-height:34px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(15,23,42,0.09);
        background:rgba(255,255,255,0.90);
        font-size:12px;
        font-weight:900;
        color:#0f172a;
      }

      .raFiltersGrid{
        display:grid;
        grid-template-columns:repeat(12,minmax(0,1fr));
        gap:12px;
        margin-top:14px;
      }

      .raField{
        grid-column:span 2;
        display:grid;
        gap:7px;
      }

      .raFieldWide{
        grid-column:span 4;
      }

      .raFieldXL{
        grid-column:span 6;
      }

      .raFieldLabel{
        font-size:11px;
        font-weight:950;
        letter-spacing:.1em;
        text-transform:uppercase;
        color:rgba(15,23,42,0.56);
      }

      .raInput,
      .raSelect{
        width:100%;
        min-height:48px;
        border-radius:16px;
        border:1px solid rgba(15,23,42,0.12);
        background:rgba(255,255,255,0.95);
        color:#0f172a;
        font-size:14px;
        font-weight:850;
        outline:none;
        box-sizing:border-box;
      }

      .raInput{
        padding:0 14px;
      }

      .raSelect{
        padding:0 14px;
      }

      .raInput:focus,
      .raSelect:focus{
        border-color:rgba(225,29,46,0.30);
        box-shadow:0 0 0 6px rgba(225,29,46,0.09);
      }

      .raSearchBox{
        position:relative;
      }

      .raSearchIcon{
        position:absolute;
        top:50%;
        left:14px;
        transform:translateY(-50%);
        color:rgba(15,23,42,0.46);
        pointer-events:none;
      }

      .raInputSearch{
        padding-left:42px;
      }

      .raMainGrid{
        display:grid;
        grid-template-columns:minmax(0,1.7fr) minmax(340px,.95fr);
        gap:16px;
        align-items:start;
      }

      .raQueuePanel{
        min-width:0;
      }

      .raDetailPanel{
        position:sticky;
        top:12px;
      }

      .raDesktopTableWrap{
        margin-top:14px;
        border-radius:22px;
        border:1px solid rgba(15,23,42,0.08);
        overflow:auto;
        background:rgba(255,255,255,0.7);
      }

      .raTable{
        width:100%;
        min-width:1080px;
        border-collapse:separate;
        border-spacing:0;
      }

      .raTable thead th{
        position:sticky;
        top:0;
        z-index:1;
        text-align:left;
        padding:14px 14px;
        background:rgba(255,255,255,0.98);
        border-bottom:1px solid rgba(15,23,42,0.08);
        font-size:11px;
        font-weight:950;
        letter-spacing:.1em;
        text-transform:uppercase;
        color:rgba(15,23,42,0.62);
      }

      .raTable tbody td{
        padding:14px;
        vertical-align:top;
        border-bottom:1px solid rgba(15,23,42,0.07);
        background:rgba(255,255,255,0.84);
      }

      .raTr{
        cursor:pointer;
      }

      .raTr:hover td{
        background:rgba(248,250,252,0.95);
      }

      .raTrActive td{
        background:rgba(255,241,242,0.58) !important;
      }

      .raCellStack{
        display:flex;
        flex-direction:column;
        gap:6px;
      }

      .raCellStrong{
        font-weight:950;
        color:#0b1220;
      }

      .raTextSub{
        font-size:12px;
        line-height:1.45;
        font-weight:700;
        color:rgba(15,23,42,0.62);
      }

      .raMessageClamp{
        font-weight:800;
        line-height:1.5;
        color:#0f172a;
        display:-webkit-box;
        -webkit-line-clamp:3;
        -webkit-box-orient:vertical;
        overflow:hidden;
        word-break:break-word;
      }

      .raPill{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:30px;
        padding:0 10px;
        border-radius:999px;
        border:1px solid rgba(15,23,42,0.10);
        font-size:12px;
        font-weight:950;
        width:fit-content;
      }

      .raPillOpen{
        color:${RED};
        border-color:rgba(225,29,46,0.22);
        background:rgba(255,241,242,0.94);
      }

      .raPillRes{
        color:rgba(22,101,52,0.96);
        border-color:rgba(34,197,94,0.22);
        background:rgba(236,253,245,0.92);
      }

      .raResolveBtn{
        min-height:40px;
        padding:0 14px;
        border-radius:14px;
        border:1px solid rgba(225,29,46,0.24);
        background:rgba(255,241,242,0.94);
        color:${RED};
        cursor:pointer;
        font-size:13px;
        font-weight:950;
      }

      .raResolveBtnWide{
        width:100%;
        min-height:46px;
      }

      .raResolveBtn:disabled{
        opacity:.6;
        cursor:not-allowed;
      }

      .raMuted{
        color:rgba(15,23,42,0.48);
        font-weight:800;
      }

      .raEmpty{
        margin-top:14px;
        padding:18px;
        border-radius:18px;
        border:1px dashed rgba(15,23,42,0.16);
        background:rgba(255,255,255,0.7);
        color:rgba(15,23,42,0.76);
        font-weight:900;
      }

      .raMobileList{
        display:none;
        margin-top:14px;
        gap:12px;
      }

      .raMobileCard{
        border:1px solid rgba(15,23,42,0.08);
        border-radius:22px;
        background:rgba(255,255,255,0.95);
        box-shadow:0 10px 24px rgba(2,8,23,0.05);
        padding:14px;
        cursor:pointer;
      }

      .raMobileCardActive{
        border-color:rgba(225,29,46,0.20);
        background:rgba(255,241,242,0.62);
      }

      .raMobileCardHead{
        display:grid;
        gap:12px;
      }

      .raMobileCardTop{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
      }

      .raMobileJudge{
        display:grid;
        gap:3px;
      }

      .raInfoGrid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-top:14px;
      }

      .raInfoMini{
        padding:12px;
        border-radius:16px;
        border:1px solid rgba(15,23,42,0.07);
        background:rgba(248,250,252,0.82);
      }

      .raInfoMiniLabel{
        display:flex;
        align-items:center;
        gap:6px;
        font-size:11px;
        font-weight:900;
        letter-spacing:.06em;
        text-transform:uppercase;
        color:rgba(15,23,42,0.56);
      }

      .raInfoMiniValue{
        margin-top:7px;
        font-size:14px;
        font-weight:900;
        color:#0b1220;
        line-height:1.35;
        word-break:break-word;
      }

      .raMobileMessage{
        margin-top:14px;
        padding:12px;
        border-radius:16px;
        border:1px solid rgba(15,23,42,0.08);
        background:rgba(255,255,255,0.78);
      }

      .raMobileMessageLabel{
        display:flex;
        align-items:center;
        gap:6px;
        font-size:11px;
        font-weight:950;
        letter-spacing:.08em;
        text-transform:uppercase;
        color:rgba(15,23,42,0.56);
      }

      .raMobileMessageText{
        margin-top:8px;
        font-size:14px;
        line-height:1.55;
        font-weight:800;
        color:#0f172a;
        white-space:pre-wrap;
        word-break:break-word;
      }

      .raMobileActions{
        margin-top:14px;
        display:flex;
        justify-content:flex-end;
      }

      .raResolvedChip{
        display:inline-flex;
        align-items:center;
        min-height:34px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(34,197,94,0.18);
        background:rgba(236,253,245,0.9);
        color:rgba(22,101,52,0.96);
        font-size:12px;
        font-weight:950;
      }

      .raDetailBody{
        display:grid;
        gap:14px;
        margin-top:14px;
      }

      .raDetailStatusCard{
        padding:14px;
        border-radius:20px;
        border:1px solid rgba(15,23,42,0.08);
        background:linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96));
      }

      .raDetailStatusTop{
        display:grid;
        gap:12px;
      }

      .raDetailStatusLabel{
        font-size:11px;
        font-weight:950;
        text-transform:uppercase;
        letter-spacing:.1em;
        color:rgba(15,23,42,0.56);
      }

      .raDetailStatusValue{
        margin-top:8px;
      }

      .raDetailStatusMeta{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .raDetailMini{
        padding:12px;
        border-radius:16px;
        border:1px solid rgba(15,23,42,0.07);
        background:rgba(248,250,252,0.85);
        display:grid;
        gap:6px;
      }

      .raDetailMini span{
        font-size:11px;
        font-weight:950;
        text-transform:uppercase;
        letter-spacing:.08em;
        color:rgba(15,23,42,0.56);
      }

      .raDetailMini b{
        font-size:13px;
        line-height:1.45;
        color:#0b1220;
        font-weight:950;
        word-break:break-word;
      }

      .raDetailGrid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
      }

      .raDetailTile{
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(15,23,42,0.08);
        background:rgba(255,255,255,0.86);
      }

      .raDetailTileLabel{
        display:flex;
        align-items:center;
        gap:7px;
        font-size:11px;
        font-weight:950;
        letter-spacing:.08em;
        text-transform:uppercase;
        color:rgba(15,23,42,0.56);
      }

      .raDetailTileValue{
        margin-top:8px;
        font-size:16px;
        line-height:1.4;
        color:#0b1220;
        font-weight:950;
        word-break:break-word;
      }

      .raDetailTileSub{
        margin-top:6px;
        font-size:12px;
        line-height:1.45;
        color:rgba(15,23,42,0.62);
        font-weight:700;
      }

      .raMessagePanel{
        padding:14px;
        border-radius:20px;
        border:1px solid rgba(15,23,42,0.08);
        background:rgba(255,255,255,0.86);
      }

      .raMessagePanelTitle{
        display:flex;
        align-items:center;
        gap:8px;
        font-size:12px;
        font-weight:950;
        letter-spacing:.08em;
        text-transform:uppercase;
        color:rgba(15,23,42,0.58);
      }

      .raMessagePanelBody{
        margin-top:10px;
        padding:14px;
        border-radius:16px;
        border:1px solid rgba(15,23,42,0.07);
        background:rgba(248,250,252,0.86);
        white-space:pre-wrap;
        word-break:break-word;
        line-height:1.62;
        font-size:14px;
        font-weight:800;
        color:#0f172a;
      }

      .raResolvedState{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        min-height:46px;
        border-radius:16px;
        border:1px solid rgba(34,197,94,0.18);
        background:rgba(236,253,245,0.92);
        color:rgba(22,101,52,0.96);
        font-weight:950;
      }

      @media (max-width:1400px){
        .raKpiGrid{
          grid-template-columns:repeat(3,minmax(0,1fr));
        }

        .raField{
          grid-column:span 3;
        }

        .raFieldWide{
          grid-column:span 6;
        }

        .raFieldXL{
          grid-column:span 6;
        }
      }

      @media (max-width:1180px){
        .raHero{
          grid-template-columns:1fr;
        }

        .raMainGrid{
          grid-template-columns:1fr;
        }

        .raDetailPanel{
          position:static;
        }

        .raField{
          grid-column:span 4;
        }

        .raFieldWide,
        .raFieldXL{
          grid-column:span 8;
        }
      }

      @media (max-width:900px){
        .raDesktopTableWrap{
          display:none;
        }

        .raMobileList{
          display:grid;
        }

        .raDetailGrid{
          grid-template-columns:1fr 1fr;
        }

        .raHeroTitle{
          font-size:28px;
        }

        .raKpiGrid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .raHeroButtons{
          grid-template-columns:1fr;
        }

        .raField,
        .raFieldWide,
        .raFieldXL{
          grid-column:span 6;
        }
      }

      @media (max-width:640px){
        .raAlertsPage{
          padding:4px;
        }

        .raHero,
        .raPanel,
        .raFilterPanel{
          border-radius:22px;
        }

        .raHero,
        .raPanel,
        .raFilterPanel{
          padding:14px;
        }

        .raHeroTitle{
          font-size:24px;
        }

        .raHeroText{
          font-size:13px;
        }

        .raKpiGrid{
          grid-template-columns:1fr;
        }

        .raInfoGrid,
        .raDetailGrid,
        .raDetailStatusMeta{
          grid-template-columns:1fr;
        }

        .raField,
        .raFieldWide,
        .raFieldXL{
          grid-column:span 12;
        }

        .raPanelPills{
          width:100%;
        }

        .raPanelPills .raMiniPill{
          flex:1 1 auto;
          justify-content:center;
        }

        .raHeroChip{
          width:100%;
          justify-content:flex-start;
        }

        .raScopeValue{
          font-size:16px;
        }
      }
    `}</style>
  );
}
