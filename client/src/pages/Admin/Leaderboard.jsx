// src/pages/Admin/Leaderboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import {
  getSocket,
  joinAdminLiveRooms,
  leaveAdminLiveRooms,
} from "../../lib/socket.js";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  getUser,
  isSuperAdmin,
  getEffectiveAcademy,
  getSelectedAcademy,
  setSelectedAcademy,
  clearSelectedAcademy,
} from "../../lib/auth.js";

const RED = "var(--ra-accent, #e11d2e)";
const medalEmoji = (m) =>
  m === "G" ? "🥇" : m === "S" ? "🥈" : m === "B" ? "🥉" : "";
const medalLabel = (m) =>
  m === "G" ? "GOLD" : m === "S" ? "SILVER" : m === "B" ? "BRONZE" : "—";
const medalHex = (m) =>
  m === "G"
    ? ["#fff7c2", "#facc15", "#b45309"]
    : m === "S"
      ? ["#ffffff", "#d1d5db", "#6b7280"]
      : ["#f5d0c5", "#b87333", "#7c3f1d"];

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

/* ------------------------------------------------------------------ */
/* MAIN */
/* ------------------------------------------------------------------ */

export default function Leaderboard({ searchQuery = "" }) {
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
      const selected = getSelectedAcademy?.();
      if (selected?._id || selected?.id || selected?.academyId) {
        return String(selected?._id || selected?.id || selected?.academyId);
      }
      return "";
    } catch {
      return "";
    }
  });

  const [groups, setGroups] = useState([]);
  const [levelTab, setLevelTab] = useState("ALL");
  const [groupId, setGroupId] = useState("");

  const [data, setData] = useState({
    activities: [],
    rows: [],
    medalsByActivity: {},
  });

  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [podiumKey, setPodiumKey] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);

  const socketRef = useRef(null);
  const groupTabsRef = useRef(null);
  const joinedGroupRef = useRef("");
  const joinedAcademyRef = useRef("");
  const refreshTimerRef = useRef(null);
  const printContentRef = useRef(null);

  const userEffectiveAcademy = useMemo(() => {
    try {
      return getEffectiveAcademy?.() || null;
    } catch {
      return null;
    }
  }, []);

  const effectiveAcademyId = useMemo(() => {
    const selectedId = academyFilter ? String(academyFilter) : "";
    const effectiveId = String(
      userEffectiveAcademy?.academyId ||
        me?.academyId?._id ||
        me?.academyId ||
        "",
    );

    return selectedId || effectiveId || "";
  }, [academyFilter, userEffectiveAcademy, me]);

  const selectedAcademy = useMemo(() => {
    const byEffective =
      academies.find((a) => String(a._id) === String(effectiveAcademyId)) ||
      null;
    const byFilter =
      academies.find((a) => String(a._id) === String(academyFilter)) || null;

    return (
      byEffective ||
      byFilter || {
        _id: effectiveAcademyId || "",
        name:
          userEffectiveAcademy?.academyName ||
          me?.academyName ||
          me?.academyId?.name ||
          "Current Academy",
        code: userEffectiveAcademy?.academyCode || me?.academyCode || "",
      }
    );
  }, [academies, effectiveAcademyId, academyFilter, userEffectiveAcademy, me]);

  function toast(text, type = "ok") {
    setMsg("");
    setErr("");
    if (type === "err") setErr(text);
    else setMsg(text);

    window.clearTimeout(window.__ra_lb_toast);
    window.__ra_lb_toast = window.setTimeout(() => {
      setMsg("");
      setErr("");
    }, 2200);
  }

  function persistAcademy(id) {
    const safe = String(id || "");
    setAcademyFilter(safe);

    try {
      if (!safe) {
        clearSelectedAcademy?.();
      } else {
        const picked = academies.find((a) => String(a._id) === safe);
        if (picked) {
          setSelectedAcademy?.({
            _id: picked._id,
            id: picked._id,
            academyId: picked._id,
            name: picked.name || "",
            academyName: picked.name || "",
            code: picked.code || "",
            academyCode: picked.code || "",
          });
        } else {
          setSelectedAcademy?.(safe);
        }
      }
    } catch {
      // noop
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
            : typeof api?.superAdminAcademies === "function"
              ? api.superAdminAcademies
              : null;

    if (!fn) {
      const mine =
        me?.academyId?._id || me?.academyId
          ? [
              {
                _id: String(me?.academyId?._id || me?.academyId),
                name: me?.academyId?.name || me?.academyName || "My Academy",
                code: me?.academyCode || "",
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
        me?.academyId?._id || me?.academyId
          ? [
              {
                _id: String(me?.academyId?._id || me?.academyId),
                name: me?.academyId?.name || me?.academyName || "My Academy",
                code: me?.academyCode || "",
                isActive: true,
              },
            ]
          : [];
      return normalizeAcademies(mine);
    }
  }

  async function loadGroups(academyId = effectiveAcademyId) {
    const gs = await api.groups(academyId);
    return Array.isArray(gs) ? gs : [];
  }

  async function loadTotals(gid, academyId = effectiveAcademyId) {
    if (!gid) {
      setData({ activities: [], rows: [], medalsByActivity: {} });
      return;
    }

    const totals = await api.totalsByGroup(gid, academyId);

    setData(
      totals && typeof totals === "object"
        ? {
            activities: Array.isArray(totals.activities)
              ? totals.activities
              : [],
            rows: Array.isArray(totals.rows) ? totals.rows : [],
            medalsByActivity:
              totals.medalsByActivity &&
              typeof totals.medalsByActivity === "object"
                ? totals.medalsByActivity
                : {},
          }
        : { activities: [], rows: [], medalsByActivity: {} },
    );
  }

  async function init(academyId = effectiveAcademyId, keepGroup = false) {
    setLoading(true);
    setErr("");
    setMsg("");

    try {
      const [academyRows, gs] = await Promise.all([
        loadAcademies(),
        loadGroups(academyId),
      ]);

      setAcademies(academyRows);
      setGroups(gs);

      const preferredGroupId =
        keepGroup && gs.some((g) => String(g._id) === String(groupId))
          ? groupId
          : gs?.[0]?._id || "";

      setGroupId(preferredGroupId);

      if (preferredGroupId) {
        await loadTotals(preferredGroupId, academyId);
      } else {
        setData({ activities: [], rows: [], medalsByActivity: {} });
      }
    } catch (e) {
      setErr(e?.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    init();

    const socket = getSocket();
    socketRef.current = socket;

    return () => {
      try {
        if (joinedGroupRef.current || joinedAcademyRef.current) {
          leaveAdminLiveRooms({
            groupId: joinedGroupRef.current,
          });
        }
      } catch {
        // noop
      }

      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      socketRef.current = null;
      joinedGroupRef.current = "";
      joinedAcademyRef.current = "";
      window.clearTimeout(window.__ra_lb_toast);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!groupId) return;

    const socket = socketRef.current || getSocket();
    socketRef.current = socket;

    if (joinedGroupRef.current && joinedGroupRef.current !== groupId) {
      leaveAdminLiveRooms({ groupId: joinedGroupRef.current });
    }

    joinAdminLiveRooms({
      academyId: effectiveAcademyId || undefined,
      groupId,
    });

    joinedGroupRef.current = groupId;
    joinedAcademyRef.current = effectiveAcademyId || "";

    const handler = async (payload = {}) => {
      try {
        const payloadGroupId =
          payload?.groupId || payload?.gid || payload?.roomGroupId || "";
        const payloadAcademyId =
          payload?.academyId || payload?.academy?._id || payload?.academy || "";

        if (payloadGroupId && String(payloadGroupId) !== String(groupId)) {
          return;
        }

        if (
          payloadAcademyId &&
          effectiveAcademyId &&
          String(payloadAcademyId) !== String(effectiveAcademyId)
        ) {
          return;
        }

        if (refreshTimerRef.current) {
          window.clearTimeout(refreshTimerRef.current);
        }

        refreshTimerRef.current = window.setTimeout(async () => {
          await loadTotals(groupId, effectiveAcademyId);
          setPodiumKey((k) => k + 1);
        }, 250);
      } catch (e) {
        console.error("leaderboard live refresh failed", e);
      }
    };

    socket.on("leaderboard:update", handler);
    socket.on("admin:score-updated", handler);
    socket.on("admin:activity-finalized", handler);

    return () => {
      socket.off?.("leaderboard:update", handler);
      socket.off?.("admin:score-updated", handler);
      socket.off?.("admin:activity-finalized", handler);

      leaveAdminLiveRooms({ groupId });

      if (joinedGroupRef.current === groupId) joinedGroupRef.current = "";
    };
  }, [groupId, effectiveAcademyId]);

  useEffect(() => {
    setPodiumKey((k) => k + 1);
  }, [data.rows]);

  useEffect(() => {
    setLevelTab("ALL");
    init(effectiveAcademyId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAcademyId]);

  const levels = useMemo(() => {
    const set = new Set();
    for (const g of groups) {
      const lv = String(g?.level || "").trim();
      if (lv) set.add(lv);
    }
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [groups]);

  const filteredGroups = useMemo(() => {
    if (levelTab === "ALL") return groups;
    return groups.filter((g) => String(g?.level || "").trim() === levelTab);
  }, [groups, levelTab]);

  const activeGroup = useMemo(
    () => groups.find((g) => String(g._id) === String(groupId)) || null,
    [groups, groupId],
  );

  const groupLabel = useMemo(() => {
    if (!activeGroup) return "";
    return `${activeGroup.name || "Group"}${activeGroup.level ? ` (${activeGroup.level})` : ""}`;
  }, [activeGroup]);

  const cols = useMemo(
    () => (Array.isArray(data.activities) ? data.activities : []),
    [data.activities],
  );

  const rows = useMemo(() => {
    const sorted = [...(Array.isArray(data.rows) ? data.rows : [])].sort(
      (a, b) => Number(b?.total ?? 0) - Number(a?.total ?? 0),
    );
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [data.rows]);

  const normalizedSearch = String(searchQuery || "")
    .trim()
    .toLowerCase();

  const visibleRows = useMemo(() => {
    if (!normalizedSearch) return rows;
    return rows.filter((r) => {
      const name = String(r?.name || "").toLowerCase();
      const total = String(Number(r?.total ?? 0).toFixed(2)).toLowerCase();
      const rank = String(r?.rank ?? "").toLowerCase();
      return [name, total, rank].some((x) => x.includes(normalizedSearch));
    });
  }, [rows, normalizedSearch]);

  const visiblePodium = useMemo(() => visibleRows.slice(0, 3), [visibleRows]);

  const gridTemplate = useMemo(
    () =>
      `72px minmax(220px, 1.25fr) repeat(${cols.length}, minmax(148px, 1fr)) 120px 150px`,
    [cols.length],
  );

  const tableMinWidth = useMemo(() => {
    const rankWidth = 72;
    const participantWidth = 260;
    const activityWidth = 172;
    const totalWidth = 120;
    const medalsWidth = 150;
    const tablePadding = 28;

    return `${Math.max(
      980,
      rankWidth +
        participantWidth +
        cols.length * activityWidth +
        totalWidth +
        medalsWidth +
        tablePadding,
    )}px`;
  }, [cols.length]);

  const stats = useMemo(() => {
    const count = visibleRows.length;
    const avg = count
      ? visibleRows.reduce((s, r) => s + Number(r?.total ?? 0), 0) / count
      : 0;
    const top = count
      ? Math.max(...visibleRows.map((r) => Number(r?.total ?? 0)))
      : 0;
    return { count, avg, top };
  }, [visibleRows]);

  async function onPickLevel(lv) {
    setLevelTab(lv);
    setErr("");
    setMsg("");

    const nextGroups =
      lv === "ALL"
        ? groups
        : groups.filter((g) => String(g?.level || "").trim() === lv);

    const stillValid = nextGroups.some(
      (g) => String(g._id) === String(groupId),
    );
    const nextGid = stillValid ? groupId : nextGroups?.[0]?._id || "";

    setGroupId(nextGid);
    setLoading(true);

    try {
      if (nextGid) {
        await loadTotals(nextGid, effectiveAcademyId);
      } else {
        setData({ activities: [], rows: [], medalsByActivity: {} });
      }
    } catch (e) {
      setErr(e?.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }

    if (groupTabsRef.current) groupTabsRef.current.scrollLeft = 0;
  }

  async function onPickGroup(gid) {
    setGroupId(gid);
    setLoading(true);
    setErr("");
    setMsg("");

    try {
      await loadTotals(gid, effectiveAcademyId);
    } catch (e) {
      setErr(e?.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcademyChange(nextId) {
    persistAcademy(nextId);
    setGroups([]);
    setGroupId("");
    setLevelTab("ALL");
    setData({ activities: [], rows: [], medalsByActivity: {} });
    await init(nextId || "", false);
  }

  function scrollGroupTabs(dir) {
    const el = groupTabsRef.current;
    if (!el) return;
    const dx = Math.max(240, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({ left: dir === "L" ? -dx : dx, behavior: "smooth" });
  }

  function openPrint() {
    setPrintOpen(true);
    setTimeout(() => window.print(), 120);
  }

  function closePrint() {
    setPrintOpen(false);
  }

  async function exportPdf() {
    if (!visibleRows.length) return;
    if (!printContentRef.current) return;

    setExportingPdf(true);
    setErr("");
    setMsg("");

    try {
      const element = printContentRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= usableHeight) {
        pdf.addImage(
          imgData,
          "JPEG",
          margin,
          margin,
          imgWidth,
          imgHeight,
          undefined,
          "FAST",
        );
      } else {
        let remainingHeight = imgHeight;
        let sourceY = 0;

        const pageCanvas = document.createElement("canvas");
        const pageCtx = pageCanvas.getContext("2d");

        const pagePixelWidth = canvas.width;
        const pagePixelHeight = Math.floor(
          (usableHeight / imgHeight) * canvas.height,
        );

        pageCanvas.width = pagePixelWidth;
        pageCanvas.height = pagePixelHeight;

        let firstPage = true;

        while (remainingHeight > 0) {
          pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          pageCtx.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            pagePixelHeight,
            0,
            0,
            pageCanvas.width,
            pageCanvas.height,
          );

          const pageImg = pageCanvas.toDataURL("image/jpeg", 0.98);

          if (!firstPage) pdf.addPage();

          pdf.addImage(
            pageImg,
            "JPEG",
            margin,
            margin,
            usableWidth,
            usableHeight,
            undefined,
            "FAST",
          );

          firstPage = false;
          sourceY += pagePixelHeight;
          remainingHeight -= usableHeight;
        }
      }

      const safeAcademy = String(selectedAcademy?.name || "academy")
        .replace(/[^\w\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "_");

      const safeGroup = String(groupLabel || "group")
        .replace(/[^\w\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "_");

      pdf.save(`leaderboard-${safeAcademy}-${safeGroup}.pdf`);
      toast("PDF exported successfully.");
    } catch (e) {
      setErr(e?.message || "Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  }

  async function publishResultsForGroup() {
    if (!groupId) return;

    const ok = window.confirm(
      `Publish results for this group?\n\nAcademy: ${selectedAcademy?.name || "Current"}\nGroup: ${groupLabel || "—"}\n\nThis will send notifications / emails to parents and participants if your backend publish route is enabled.`,
    );
    if (!ok) return;

    setPublishing(true);
    setErr("");
    setMsg("");

    try {
      if (typeof api.publishGroupResults !== "function") {
        throw new Error(
          "Missing API method: api.publishGroupResults(groupId, academyId, body)",
        );
      }

      await api.publishGroupResults(groupId, effectiveAcademyId, {});
      await loadTotals(groupId, effectiveAcademyId);
      toast("Results published successfully.");
    } catch (e) {
      setErr(e?.message || "Failed to publish results");
    } finally {
      setPublishing(false);
    }
  }

  async function resetAllScoresForGroup() {
    if (!groupId) return;

    const ok = window.confirm(
      `Reset all scores for this group?\n\nAcademy: ${selectedAcademy?.name || "Current"}\nGroup: ${groupLabel || "—"}\n\nThis action cannot be undone.`,
    );
    if (!ok) return;

    setResetting(true);
    setErr("");
    setMsg("");

    try {
      if (typeof api.resetScoresByGroup === "function") {
        await api.resetScoresByGroup(groupId, undefined, effectiveAcademyId);
      } else if (typeof api.resetScores === "function") {
        await api.resetScores(groupId, effectiveAcademyId);
      } else {
        throw new Error(
          "Missing API method: add api.resetScoresByGroup(groupId) or api.resetScores(groupId)",
        );
      }

      await loadTotals(groupId, effectiveAcademyId);
      toast("Scores reset successfully.");
    } catch (e) {
      setErr(e?.message || "Failed to reset scores");
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <StyleTag />
      <PrintStyles />

      {printOpen ? (
        <PrintView
          onClose={closePrint}
          academyLabel={selectedAcademy?.name || "Current Academy"}
          groupLabel={groupLabel}
          cols={cols}
          rows={visibleRows}
          medalsByActivity={data.medalsByActivity}
          podium={visiblePodium}
          contentRef={printContentRef}
        />
      ) : null}

      <div className="lbPdfHiddenWrap" aria-hidden="true">
        <div ref={printContentRef}>
          <PrintSheet
            academyLabel={selectedAcademy?.name || "Current Academy"}
            groupLabel={groupLabel}
            cols={cols}
            rows={visibleRows}
            medalsByActivity={data.medalsByActivity}
            podium={visiblePodium}
          />
        </div>
      </div>

      <section className="lbWrap">
        <div className="lbHeader">
          <div>
            <div className="lbEyebrow">LEADERBOARD CENTER</div>
            <h3 className="lbTitle">Leaderboard</h3>
            <div className="lbSub">
              Multi-academy live rankings by level and group with responsive
              desktop, tablet, and mobile layouts, printable output, live socket
              refresh, and matching PDF export.
            </div>
            {msg ? <div className="lbOk">{msg}</div> : null}
            {err ? <div className="lbErr">{err}</div> : null}
          </div>

          <div className="lbHeaderRight">
            <div className="lbChip">
              Academy: <b>{selectedAcademy?.name || "Current"}</b>
            </div>
            <div className="lbChip">
              Group: <b>{groupLabel || "—"}</b>
            </div>

            <button
              className="lbBtn"
              type="button"
              onClick={publishResultsForGroup}
              disabled={loading || resetting || publishing || !groupId}
            >
              {publishing ? "Publishing..." : "Publish Results"}
            </button>

            <button
              className="lbBtn lbBtnDanger"
              type="button"
              onClick={resetAllScoresForGroup}
              disabled={loading || resetting || publishing || !groupId}
            >
              {resetting ? "Resetting..." : "Reset Scores"}
            </button>

            <button
              className="lbBtn"
              type="button"
              onClick={openPrint}
              disabled={loading || !visibleRows.length}
            >
              Print View
            </button>

            <button
              className="lbBtn"
              type="button"
              onClick={exportPdf}
              disabled={loading || exportingPdf || !visibleRows.length}
            >
              {exportingPdf ? "Exporting PDF..." : "Export PDF"}
            </button>
          </div>
        </div>

        <div className="lbEnhanceBar">
          <div className="lbInfoPill">
            <span className="lbInfoPillIcon">
              <IconBuilding size={13} />
            </span>
            <span>
              Academy Scope: <b>{selectedAcademy?.name || "Current"}</b>
            </span>
            {superAdmin ? (
              <span className="lbTagBlue">SUPER ADMIN</span>
            ) : (
              <span className="lbTagGreen">SCOPED</span>
            )}
          </div>

          <div className="lbEnhanceStrip">
            <div className="lbEnhanceItem">
              <span className="lbEnhanceIcon">
                <IconShield size={14} />
              </span>
              Live socket sync
            </div>
            <div className="lbEnhanceItem">
              <span className="lbEnhanceIcon">
                <IconFilter size={14} />
              </span>
              Level + group tabs
            </div>
            <div className="lbEnhanceItem">
              <span className="lbEnhanceIcon">
                <IconSparkles size={14} />
              </span>
              Badge export + print + PDF
            </div>
          </div>
        </div>

        <div className="lbStats">
          <StatCard label="Participants" value={stats.count} />
          <StatCard label="Top Score" value={stats.top.toFixed(2)} mono />
          <StatCard label="Average" value={stats.avg.toFixed(2)} mono />
        </div>

        <div className="lbCard lbTabsCard">
          <div className="lbTabsGrid">
            {superAdmin ? (
              <div className="lbTabsBlock">
                <div className="lbTabsLabel">Academy</div>
                <div className="lbAcademySelectWrap">
                  <select
                    className="lbSelect"
                    value={academyFilter}
                    onChange={(e) => handleAcademyChange(e.target.value)}
                    disabled={loading || resetting || publishing}
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
              </div>
            ) : null}

            <div className="lbTabsBlock">
              <div className="lbTabsLabel">Level</div>
              <div className="lbTabsRow">
                {levels.map((lv) => {
                  const active = levelTab === lv;
                  return (
                    <button
                      key={lv}
                      type="button"
                      className={`lbTab ${active ? "lbTabActive" : ""}`}
                      onClick={() => onPickLevel(lv)}
                      disabled={loading || resetting || publishing}
                    >
                      {lv === "ALL" ? "All Levels" : lv}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lbDivider" />

          <div className="lbTabsBlock">
            <div className="lbTabsLabel">Group</div>

            <div className="lbGroupShell">
              <button
                className="lbScrollBtn"
                type="button"
                onClick={() => scrollGroupTabs("L")}
                aria-label="Scroll left"
              >
                ‹
              </button>

              <div className="lbGroupTabs" ref={groupTabsRef}>
                {filteredGroups.map((g) => {
                  const active = String(g._id) === String(groupId);
                  return (
                    <button
                      key={g._id}
                      type="button"
                      className={`lbTab lbGroupTab ${active ? "lbTabActive" : ""}`}
                      onClick={() => onPickGroup(g._id)}
                      disabled={loading || resetting || publishing}
                      title={`${g.name}${g.level ? ` (${g.level})` : ""}`}
                    >
                      <span className="lbGroupName">{g.name}</span>
                      {g.level ? (
                        <span className="lbPill">{g.level}</span>
                      ) : null}
                    </button>
                  );
                })}

                {!filteredGroups.length ? (
                  <div className="lbEmptyMini">No groups for this level.</div>
                ) : null}
              </div>

              <button
                className="lbScrollBtn"
                type="button"
                onClick={() => scrollGroupTabs("R")}
                aria-label="Scroll right"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        <div key={podiumKey} className="lbPodium lbPodiumAnimated">
          <PodiumCard
            item={visiblePodium[1]}
            place={2}
            type="S"
            academyLabel={selectedAcademy?.name || "Current Academy"}
            groupLabel={groupLabel}
            cols={cols}
            medalsByActivity={data.medalsByActivity}
          />
          <PodiumCard
            item={visiblePodium[0]}
            place={1}
            type="G"
            academyLabel={selectedAcademy?.name || "Current Academy"}
            groupLabel={groupLabel}
            cols={cols}
            medalsByActivity={data.medalsByActivity}
          />
          <PodiumCard
            item={visiblePodium[2]}
            place={3}
            type="B"
            academyLabel={selectedAcademy?.name || "Current Academy"}
            groupLabel={groupLabel}
            cols={cols}
            medalsByActivity={data.medalsByActivity}
          />
        </div>

        <div className="lbCard lbTableCard">
          <div className="lbTableHeader">
            <div>
              <div className="lbSectionTitle">Detailed Leaderboard</div>
              <div className="lbSectionSub">
                Academy: <b>{selectedAcademy?.name || "Current"}</b> · Group:{" "}
                <b>{groupLabel || "—"}</b>
                {normalizedSearch ? (
                  <>
                    {" "}
                    · Search filter: <b>{searchQuery}</b>
                  </>
                ) : null}
              </div>
            </div>

            <div className="lbLegend">
              <span>🥇 Gold</span>
              <span>🥈 Silver</span>
              <span>🥉 Bronze</span>
            </div>
          </div>

          <div className="lbDesktopTable">
            <div className="lbScrollX">
              <div className="lbTable" style={{ minWidth: tableMinWidth }}>
                <div
                  className="lbHead"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div className="center">Rank</div>
                  <div>Participant</div>

                  {cols.map((a) => (
                    <div key={a._id} className="lbActHead">
                      <div className="lbActTitle">{a.name}</div>
                      <div className="lbActSub">Score · Medal · Export</div>
                    </div>
                  ))}

                  <div className="center">Total</div>
                  <div className="center">Medals</div>
                </div>

                {visibleRows.map((r) => (
                  <div
                    key={r.participantId || r._id || r.name}
                    className="lbRow"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    <div className="lbRank">{r.rank ?? "—"}</div>
                    <div className="lbName">{r.name || "—"}</div>

                    {cols.map((a) => {
                      const score = Number(r?.byActivity?.[a._id] ?? 0);
                      const medal =
                        data?.medalsByActivity?.[a._id]?.[r?.participantId] ||
                        null;

                      return (
                        <div key={a._id} className="lbCell">
                          <div className="lbScore mono">{score.toFixed(2)}</div>
                          <MedalIcon type={medal} small />
                          <button
                            className="lbIconBtn"
                            type="button"
                            title="Export badge PNG"
                            onClick={() =>
                              exportBadgePng({
                                academy:
                                  selectedAcademy?.name || "Rebel Angels",
                                app: "Gymnastics Scoring",
                                groupLabel,
                                participantName: r.name,
                                activityName: a.name,
                                score,
                                medal,
                                dateText: new Date().toLocaleDateString(),
                              })
                            }
                          >
                            <DownloadIcon />
                          </button>
                        </div>
                      );
                    })}

                    <div className="lbTotal mono">
                      {Number(r?.total ?? 0).toFixed(2)}
                    </div>
                    <div className="lbMedals mono">
                      🥇 {r?.medals?.G ?? 0} &nbsp; 🥈 {r?.medals?.S ?? 0}
                      &nbsp; 🥉 {r?.medals?.B ?? 0}
                    </div>
                  </div>
                ))}

                {!loading && visibleRows.length === 0 ? (
                  <div className="lbEmpty">
                    {normalizedSearch
                      ? "No matching participants for the current search."
                      : "No scores yet for this group."}
                  </div>
                ) : null}

                {loading ? <div className="lbEmpty">Loading...</div> : null}
              </div>
            </div>
          </div>

          <div className="lbMobileCards">
            {visibleRows.map((r) => (
              <MobileLeaderboardCard
                key={`mobile-${r.participantId || r._id || r.name}`}
                row={r}
                cols={cols}
                groupLabel={groupLabel}
                academyLabel={selectedAcademy?.name || "Rebel Angels"}
                medalsByActivity={data.medalsByActivity}
              />
            ))}

            {!loading && visibleRows.length === 0 ? (
              <div className="lbEmpty lbMobileEmpty">
                {normalizedSearch
                  ? "No matching participants for the current search."
                  : "No scores yet for this group."}
              </div>
            ) : null}

            {loading ? (
              <div className="lbEmpty lbMobileEmpty">Loading...</div>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, mono }) {
  return (
    <div className="lbStat">
      <div className="lbStatLabel">{label}</div>
      <div className={`lbStatValue ${mono ? "mono" : ""}`}>{value}</div>
    </div>
  );
}

function MobileLeaderboardCard({
  row,
  cols,
  groupLabel,
  academyLabel,
  medalsByActivity,
}) {
  return (
    <div className="lbMobileCard">
      <div className="lbMobileTop">
        <div>
          <div className="lbMobileRank">#{row?.rank ?? "—"}</div>
          <div className="lbMobileName">{row?.name || "—"}</div>
          <div className="lbMobileSub">
            {academyLabel}
            {groupLabel ? ` • ${groupLabel}` : ""}
          </div>
        </div>

        <div className="lbMobileTotalWrap">
          <div className="lbMobileTotalLabel">Total</div>
          <div className="lbMobileTotal mono">
            {Number(row?.total ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="lbMobileMedals">
        <span>🥇 {row?.medals?.G ?? 0}</span>
        <span>🥈 {row?.medals?.S ?? 0}</span>
        <span>🥉 {row?.medals?.B ?? 0}</span>
      </div>

      <div className="lbMobileActivities">
        {cols.map((a) => {
          const score = Number(row?.byActivity?.[a._id] ?? 0);
          const medal = medalsByActivity?.[a._id]?.[row?.participantId] || null;

          return (
            <div key={a._id} className="lbMobileActivity">
              <div className="lbMobileActivityHead">
                <span className="lbMobileActivityName">{a.name}</span>
                <MedalIcon type={medal} small />
              </div>

              <div className="lbMobileActivityFoot">
                <span className="mono lbMobileActivityScore">
                  {score.toFixed(2)}
                </span>

                <button
                  className="lbIconBtn"
                  type="button"
                  title="Export badge PNG"
                  onClick={() =>
                    exportBadgePng({
                      academy: academyLabel || "Rebel Angels",
                      app: "Gymnastics Scoring",
                      groupLabel,
                      participantName: row?.name,
                      activityName: a.name,
                      score,
                      medal,
                      dateText: new Date().toLocaleDateString(),
                    })
                  }
                >
                  <DownloadIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrintView({
  onClose,
  academyLabel,
  groupLabel,
  cols,
  rows,
  medalsByActivity,
  podium,
  contentRef,
}) {
  return (
    <div className="raPrintOverlay" role="dialog" aria-modal="true">
      <div className="raPrintTopbar">
        <div style={{ fontWeight: 950 }}>Print View</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="lbBtn"
            type="button"
            onClick={() => window.print()}
          >
            Print Now
          </button>
          <button className="lbBtn lbBtnGhost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="raPrintPage">
        <div ref={contentRef}>
          <PrintSheet
            academyLabel={academyLabel}
            groupLabel={groupLabel}
            cols={cols}
            rows={rows}
            medalsByActivity={medalsByActivity}
            podium={podium}
          />
        </div>
      </div>
    </div>
  );
}

function PrintSheet({
  academyLabel,
  groupLabel,
  cols,
  rows,
  medalsByActivity,
  podium,
}) {
  const dateText = new Date().toLocaleString();

  return (
    <div className="raPrintPageInner">
      <div className="raPrintHeader">
        <div>
          <div className="raPrintTitle">Leaderboard Report</div>
          <div className="raPrintMeta">
            <span>
              <b>Academy:</b> {academyLabel || "—"}
            </span>
            <span>
              <b>Group:</b> {groupLabel || "—"}
            </span>
            <span>
              <b>Date:</b> {dateText}
            </span>
          </div>
        </div>

        <div className="raPrintLegend">
          <span>🥇 Gold</span>
          <span>🥈 Silver</span>
          <span>🥉 Bronze</span>
        </div>
      </div>

      <div className="raPrintPodium">
        <PrintPodiumCard item={podium?.[0]} place={1} label="Gold Winner" />
        <PrintPodiumCard item={podium?.[1]} place={2} label="Silver Winner" />
        <PrintPodiumCard item={podium?.[2]} place={3} label="Bronze Winner" />
      </div>

      <div className="raPrintTableWrap">
        <table className="raPrintTable">
          <thead>
            <tr>
              <th style={{ width: 54, textAlign: "center" }}>Rank</th>
              <th style={{ minWidth: 190 }}>Participant</th>
              {cols.map((a) => (
                <th key={a._id} style={{ minWidth: 108, textAlign: "center" }}>
                  {a.name}
                  <div className="raPrintSmall">Score / Medal</div>
                </th>
              ))}
              <th style={{ width: 88, textAlign: "center" }}>Total</th>
              <th style={{ width: 112, textAlign: "center" }}>Medals</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.participantId || r._id || r.name}>
                <td style={{ textAlign: "center", fontWeight: 800 }}>
                  {r.rank ?? "—"}
                </td>
                <td style={{ fontWeight: 800 }}>{r.name || "—"}</td>

                {cols.map((a) => {
                  const score = Number(r?.byActivity?.[a._id] ?? 0);
                  const medal = medalsByActivity?.[a._id]?.[r?.participantId];
                  return (
                    <td
                      key={a._id}
                      style={{
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{score.toFixed(2)}</div>
                      <div style={{ fontSize: 14 }}>{medalEmoji(medal)}</div>
                    </td>
                  );
                })}

                <td style={{ textAlign: "center", fontWeight: 900 }}>
                  {Number(r?.total ?? 0).toFixed(2)}
                </td>
                <td style={{ textAlign: "center", fontWeight: 900 }}>
                  🥇 {r?.medals?.G ?? 0} &nbsp; 🥈 {r?.medals?.S ?? 0} &nbsp; 🥉{" "}
                  {r?.medals?.B ?? 0}
                </td>
              </tr>
            ))}

            {!rows.length ? (
              <tr>
                <td
                  colSpan={2 + cols.length + 2}
                  style={{ textAlign: "center", padding: 18, opacity: 0.7 }}
                >
                  No data
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="raPrintFooter">
        {academyLabel || "Rebel Angels"} • Gymnastics Scoring • Leaderboard
        Export
      </div>
    </div>
  );
}

function PrintPodiumCard({ item, place, label }) {
  return (
    <div className="raPrintPodiumCard">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
        }}
      >
        <div>
          <div style={{ fontWeight: 950 }}>#{place}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
        </div>
        <div style={{ fontSize: 18 }}>
          {place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}
        </div>
      </div>
      <div style={{ marginTop: 10, fontWeight: 950, fontSize: 14 }}>
        {item?.name || "—"}
      </div>
      <div
        style={{
          marginTop: 6,
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Number(item?.total ?? 0).toFixed(2)} pts
      </div>
    </div>
  );
}

function MedalIcon({ type, small = false }) {
  if (!type) {
    return <span style={{ display: "inline-block", width: small ? 28 : 34 }} />;
  }

  const [c1, c2, c3] = medalHex(type);
  const size = small ? 28 : 34;
  const ribbonH = small ? 12 : 16;

  return (
    <div
      className={`lbMedal lbMedal-${type}`}
      style={{
        width: size,
        height: size,
        "--m1": c1,
        "--m2": c2,
        "--m3": c3,
        "--rH": `${ribbonH}px`,
      }}
      title={medalLabel(type)}
    >
      <div className="lbMedalCore">
        <span className="lbMedalEmoji">{medalEmoji(type)}</span>
      </div>
      <div className="lbShine" />
    </div>
  );
}

function PodiumCard({
  item,
  place,
  type,
  academyLabel,
  groupLabel,
  cols,
  medalsByActivity,
}) {
  if (!item) {
    return (
      <div className="lbCard lbPodiumCard dim">
        <div className="lbPodiumTop">
          <div>
            <div className="lbPodiumPlace">#{place}</div>
            <div className="lbPodiumName">No data</div>
            <div className="lbPodiumSub">Waiting for scores</div>
          </div>
          <MedalIcon type={type} />
        </div>
      </div>
    );
  }

  const topActs = (cols || []).slice(0, 4).map((a) => {
    const medal = medalsByActivity?.[a._id]?.[item?.participantId];
    const score = Number(item?.byActivity?.[a._id] ?? 0);
    return { name: a.name, medal, score };
  });

  return (
    <div className={`lbCard lbPodiumCard lbPodium-${place}`}>
      <div className="lbPodiumTop">
        <div>
          <div className="lbPodiumPlace">#{place}</div>
          <div className="lbPodiumName">{item?.name || "—"}</div>
          <div className="lbPodiumSub">
            {academyLabel}
            {groupLabel ? ` • ${groupLabel}` : ""}
          </div>
        </div>

        <div className="lbPodiumRight">
          <MedalIcon type={type} />
          <div className="lbPodiumTotal mono">
            {Number(item?.total ?? 0).toFixed(2)} pts
          </div>
        </div>
      </div>

      <div className="lbPodiumGrid">
        {topActs.map((x) => (
          <div key={x.name} className="lbMini">
            <div className="lbMiniLabel">{x.name}</div>
            <div className="lbMiniRow">
              <MedalIcon type={x.medal} small />
              <div className="lbMiniScore mono">{x.score.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportBadgePng({
  academy,
  app,
  groupLabel,
  participantName,
  activityName,
  score,
  medal,
  dateText,
}) {
  const w = 1200;
  const h = 700;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#fff1f2");
  bg.addColorStop(0.35, "#ffffff");
  bg.addColorStop(1, "#f8fafc");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  roundRect(ctx, 70, 60, w - 140, h - 120, 38);
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.fill();
  ctx.strokeStyle = "rgba(225,29,46,0.14)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "rgba(225,29,46,0.14)";
  roundRect(ctx, 100, 95, w - 200, 12, 10);
  ctx.fill();

  ctx.fillStyle = "#0b1220";
  ctx.font = "700 44px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(academy || "Rebel Angels", 120, 170);

  ctx.fillStyle = "rgba(11,18,32,0.70)";
  ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(app || "Gymnastics Scoring", 120, 205);
  ctx.fillText(groupLabel || "", 120, 235);

  ctx.fillStyle = "#0b1220";
  ctx.font = "900 56px system-ui, -apple-system, Segoe UI, Roboto";
  wrapText(ctx, participantName || "—", 120, 320, w - 460, 62);

  ctx.fillStyle = "rgba(11,18,32,0.78)";
  ctx.font = "800 28px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(`Event: ${activityName || "Activity"}`, 120, 420);

  roundRect(ctx, 120, 455, 360, 110, 24);
  ctx.fillStyle = "rgba(225,29,46,0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(225,29,46,0.20)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#e11d2e";
  ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText("SCORE", 150, 500);

  ctx.fillStyle = "#0b1220";
  ctx.font = "900 48px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(Number(score ?? 0).toFixed(2), 150, 548);

  drawMedal(ctx, 760, 250, 320, medal);

  ctx.fillStyle = "rgba(11,18,32,0.65)";
  ctx.font = "700 18px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(
    `Issued: ${dateText || new Date().toLocaleDateString()}`,
    120,
    610,
  );

  ctx.fillStyle = "rgba(225,29,46,0.85)";
  ctx.font = "900 20px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText("Official Leaderboard Badge", w - 330, 610);

  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  const safeName =
    `${participantName || "participant"}-${activityName || "badge"}`.replace(
      /[^\w\-]+/g,
      "_",
    );
  a.download = `${safeName}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function drawMedal(ctx, x, y, size, type) {
  const [c1, c2, c3] = medalHex(type);

  ctx.save();
  ctx.translate(x, y);

  const ribbonW = size * 0.36;
  const ribbonH = size * 0.46;
  ctx.fillStyle = "#1f78ff";
  roundRect(ctx, size * 0.18, -ribbonH * 0.1, ribbonW, ribbonH, 18);
  ctx.fill();
  ctx.fillStyle = "#1666d8";
  roundRect(ctx, size * 0.46, -ribbonH * 0.1, ribbonW, ribbonH, 18);
  ctx.fill();

  const cx = size * 0.5;
  const cy = size * 0.62;
  const r = size * 0.32;

  const grad = ctx.createRadialGradient(
    cx - r * 0.35,
    cy - r * 0.35,
    r * 0.1,
    cx,
    cy,
    r,
  );
  grad.addColorStop(0, c1);
  grad.addColorStop(0.55, c2);
  grad.addColorStop(1, c3);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "rgba(11,18,32,0.78)";
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = `900 ${Math.floor(size * 0.18)}px system-ui, -apple-system, Segoe UI, Roboto`;
  ctx.textAlign = "center";
  ctx.fillText(medalEmoji(type), cx, cy + 14);

  const shine = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  shine.addColorStop(0, "rgba(255,255,255,0)");
  shine.addColorStop(0.45, "rgba(255,255,255,0.10)");
  shine.addColorStop(0.55, "rgba(255,255,255,0.45)");
  shine.addColorStop(0.65, "rgba(255,255,255,0.10)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(" ");
  let line = "";
  let yy = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = `${line}${words[n]} `;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, yy);
      line = `${words[n]} `;
      yy += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, yy);
}

function normalizeAcademies(list = []) {
  const map = new Map();

  for (const row of list || []) {
    const raw =
      row?.academyId || row?.academy || row?.branch || row?.item || row || null;

    const id = String(raw?._id || raw?.id || row?._id || "");
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

function DownloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3v10m0 0 4-4m-4 4-4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 17v3h16v-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StyleTag() {
  return (
    <style>{`
      .mono{ font-variant-numeric: tabular-nums; }

      .lbPdfHiddenWrap{
        position:fixed;
        left:-20000px;
        top:0;
        width:1180px;
        pointer-events:none;
        opacity:0;
        z-index:-1;
      }

      .lbWrap{
        padding:18px;
        border-radius:22px;
        border:1px solid rgba(17,24,39,0.10);
        background:
          radial-gradient(900px 420px at 12% 0%, rgba(225,29,46,0.10), rgba(225,29,46,0) 55%),
          radial-gradient(900px 420px at 92% 10%, rgba(59,130,246,0.08), rgba(59,130,246,0) 60%),
          linear-gradient(135deg, rgba(255,241,242,0.70), rgba(255,255,255,0.92) 45%, rgba(248,250,252,0.95));
        max-width:100%;
        min-width:0;
        overflow:hidden;
        box-sizing:border-box;
      }

      .lbEyebrow{
        font-size:11px;
        font-weight:950;
        text-transform:uppercase;
        letter-spacing:.12em;
        color:${RED};
        margin-bottom:6px;
      }

      .lbHeader{
        display:flex;
        justify-content:space-between;
        gap:14px;
        flex-wrap:wrap;
        align-items:flex-start;
      }

      .lbTitle{
        margin:0;
        font-weight:950;
        font-size:22px;
        color:#0b1220;
      }

      .lbSub{
        margin-top:6px;
        font-size:12px;
        opacity:.75;
        color:#475569;
        max-width:860px;
        line-height:1.5;
      }

      .lbErr,
      .lbOk{
        margin-top:10px;
        padding:10px 12px;
        border-radius:14px;
        font-weight:900;
      }

      .lbErr{
        border:1px solid rgba(225,29,46,0.22);
        background:rgba(255,241,242,0.75);
        color:${RED};
      }

      .lbOk{
        border:1px solid rgba(34,197,94,0.28);
        background:rgba(240,253,244,0.85);
        color:rgba(22,101,52,0.95);
      }

      .lbHeaderRight{
        display:flex;
        gap:10px;
        align-items:center;
        flex-wrap:wrap;
      }

      .lbChip{
        padding:10px 12px;
        border-radius:999px;
        background:rgba(255,255,255,0.76);
        border:1px solid rgba(17,24,39,0.10);
        font-weight:900;
        color:#0f172a;
      }

      .lbBtn{
        padding:10px 14px;
        border-radius:14px;
        border:1px solid rgba(225,29,46,0.22);
        background:rgba(255,241,242,0.85);
        color:${RED};
        font-weight:950;
        cursor:pointer;
        transition:transform .15s ease, box-shadow .2s ease, background .2s ease;
      }

      .lbBtn:hover{
        box-shadow:0 10px 24px rgba(225,29,46,0.12);
      }

      .lbBtn:active{
        transform:translateY(1px) scale(.99);
      }

      .lbBtn:disabled{
        opacity:.6;
        cursor:not-allowed;
      }

      .lbBtnGhost{
        background:rgba(255,255,255,0.92);
        border-color:rgba(17,24,39,0.14);
        color:#0f172a;
      }

      .lbBtnDanger{
        background:rgba(254,242,242,0.94);
        border-color:rgba(225,29,46,0.34);
      }

      .lbEnhanceBar{
        margin-top:14px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap;
      }

      .lbInfoPill{
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

      .lbInfoPillIcon{
        display:grid;
        place-items:center;
      }

      .lbTagBlue,
      .lbTagGreen{
        display:inline-flex;
        align-items:center;
        min-height:24px;
        padding:0 10px;
        border-radius:999px;
        font-size:11px;
        font-weight:950;
      }

      .lbTagBlue{
        border:1px solid rgba(59,130,246,0.20);
        background:rgba(239,246,255,0.92);
        color:#1d4ed8;
      }

      .lbTagGreen{
        border:1px solid rgba(34,197,94,0.20);
        background:rgba(240,253,244,0.92);
        color:#166534;
      }

      .lbEnhanceStrip{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }

      .lbEnhanceItem{
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

      .lbEnhanceIcon{
        display:grid;
        place-items:center;
        color:${RED};
      }

      .lbStats{
        margin-top:14px;
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:12px;
      }

      @media(max-width:920px){
        .lbStats{ grid-template-columns:1fr; }
      }

      .lbStat{
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.82);
        box-shadow:0 10px 24px rgba(2,8,23,0.06);
        padding:14px;
      }

      .lbStatLabel{
        font-size:12px;
        opacity:.72;
        font-weight:850;
        color:#64748b;
      }

      .lbStatValue{
        margin-top:8px;
        font-size:22px;
        font-weight:950;
        color:#0b1220;
      }

      .lbCard{
        background:rgba(255,255,255,0.88);
        border:1px solid rgba(17,24,39,0.08);
        border-radius:22px;
        box-shadow:0 12px 30px rgba(2,8,23,0.07);
        backdrop-filter:blur(12px);
      }

      .lbTabsCard{
        margin-top:14px;
        padding:16px;
      }

      .lbTabsGrid{
        display:grid;
        grid-template-columns:repeat(2, minmax(0,1fr));
        gap:14px;
      }

      .lbTabsBlock{
        display:flex;
        flex-direction:column;
        gap:10px;
      }

      .lbTabsLabel{
        font-weight:950;
        font-size:12px;
        opacity:.78;
        color:#475569;
      }

      .lbTabsRow{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        align-items:center;
      }

      .lbAcademySelectWrap{
        min-width:260px;
      }

      .lbSelect{
        width:100%;
        min-height:46px;
        padding:12px 14px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.92);
        outline:none;
        font-weight:800;
        font-size:14px;
        color:#0f172a;
        box-sizing:border-box;
      }

      .lbSelect:focus{
        border-color:rgba(225,29,46,0.35);
        box-shadow:0 0 0 6px rgba(225,29,46,0.10);
      }

      .lbDivider{
        height:1px;
        background:rgba(17,24,39,0.08);
        margin:14px 0;
      }

      .lbTab{
        padding:10px 14px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.84);
        font-weight:950;
        color:#0f172a;
        cursor:pointer;
        transition:box-shadow .2s ease, transform .15s ease, border-color .2s ease;
        white-space:nowrap;
      }

      .lbTab:hover{
        border-color:rgba(225,29,46,0.24);
        box-shadow:0 8px 18px rgba(225,29,46,0.10);
      }

      .lbTab:active{
        transform:translateY(1px) scale(.99);
      }

      .lbTab:disabled{
        opacity:.6;
        cursor:not-allowed;
      }

      .lbTabActive{
        border-color:rgba(225,29,46,0.30);
        box-shadow:inset 0 0 0 2px rgba(225,29,46,0.08);
        background:rgba(255,241,242,0.74);
      }

      .lbGroupShell{
        display:flex;
        gap:10px;
        align-items:center;
      }

      .lbScrollBtn{
        width:40px;
        height:40px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.88);
        font-weight:950;
        color:#0f172a;
        cursor:pointer;
        flex:0 0 auto;
      }

      .lbScrollBtn:hover{
        border-color:rgba(225,29,46,0.20);
        box-shadow:0 8px 18px rgba(2,8,23,0.08);
      }

      .lbGroupTabs{
        flex:1;
        display:flex;
        gap:10px;
        overflow-x:auto;
        padding:2px;
        scroll-behavior:smooth;
      }

      .lbGroupTabs::-webkit-scrollbar{ height:8px; }
      .lbGroupTabs::-webkit-scrollbar-thumb{
        background:rgba(17,24,39,0.18);
        border-radius:999px;
      }

      .lbGroupTab{
        display:flex;
        align-items:center;
        gap:10px;
      }

      .lbGroupName{ font-weight:950; }

      .lbPill{
        padding:6px 10px;
        border-radius:999px;
        background:rgba(255,241,242,0.90);
        border:1px solid rgba(225,29,46,0.18);
        color:${RED};
        font-weight:950;
        font-size:11px;
      }

      .lbEmptyMini{
        padding:10px 12px;
        opacity:.75;
        font-weight:800;
        white-space:nowrap;
        color:#64748b;
      }

      .lbPodium{
        margin-top:14px;
        display:flex;
        gap:12px;
        flex-wrap:wrap;
        align-items:stretch;
      }

      .lbPodiumAnimated .lbPodiumCard{
        animation:podiumFade .45s ease both;
      }

      @keyframes podiumFade{
        0%{ opacity:0; transform:translateY(18px) scale(.98); }
        100%{ opacity:1; transform:translateY(0) scale(1); }
      }

      .lbPodiumCard{
        flex:1;
        min-width:260px;
        padding:16px;
      }

      .lbPodiumTop{
        display:flex;
        justify-content:space-between;
        gap:14px;
        align-items:flex-start;
      }

      .lbPodiumPlace{
        font-weight:950;
        color:${RED};
        font-size:13px;
      }

      .lbPodiumName{
        font-weight:950;
        font-size:18px;
        margin-top:6px;
        color:#0b1220;
      }

      .lbPodiumSub{
        font-size:12px;
        opacity:.72;
        margin-top:2px;
        color:#64748b;
      }

      .lbPodiumRight{
        display:flex;
        flex-direction:column;
        align-items:flex-end;
        gap:8px;
      }

      .lbPodiumTotal{
        font-weight:950;
        color:${RED};
      }

      .lbPodiumGrid{
        display:grid;
        grid-template-columns:repeat(2, minmax(0,1fr));
        gap:10px;
        margin-top:12px;
      }

      .lbMini{
        padding:12px;
        border-radius:16px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.70);
      }

      .lbMiniLabel{
        font-size:12px;
        opacity:.72;
        color:#64748b;
      }

      .lbMiniRow{
        display:flex;
        align-items:center;
        gap:10px;
        margin-top:8px;
      }

      .lbMiniScore{ font-weight:950; }

      .lbTableCard{
        margin-top:14px;
        padding:16px;
        min-width:0;
        max-width:100%;
        overflow:hidden;
        box-sizing:border-box;
      }

      .lbTableHeader{
        display:flex;
        justify-content:space-between;
        gap:14px;
        flex-wrap:wrap;
        align-items:flex-end;
        margin-bottom:12px;
      }

      .lbSectionTitle{
        font-weight:950;
        font-size:16px;
        color:#0b1220;
      }

      .lbSectionSub{
        margin-top:6px;
        font-size:12px;
        opacity:.72;
        color:#64748b;
      }

      .lbLegend{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        font-size:12px;
        font-weight:900;
        opacity:.85;
        color:#475569;
      }

      .lbDesktopTable{
        display:block;
        min-width:0;
        max-width:100%;
      }

      .lbMobileCards{ display:none; }

      .lbScrollX{
        width:100%;
        max-width:100%;
        min-width:0;
        overflow-x:auto;
        overflow-y:hidden;
        padding-bottom:10px;
        -webkit-overflow-scrolling:touch;
        overscroll-behavior-x:contain;
      }

      .lbScrollX::-webkit-scrollbar{ height:10px; }
      .lbScrollX::-webkit-scrollbar-track{
        background:rgba(15,23,42,0.06);
        border-radius:999px;
      }
      .lbScrollX::-webkit-scrollbar-thumb{
        background:rgba(225,29,46,0.36);
        border-radius:999px;
        border:2px solid rgba(255,255,255,0.75);
      }

      .lbTable{
        width:max-content;
        max-width:none;
        border-radius:18px;
        overflow:hidden;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.60);
      }

      .lbHead{
        display:grid;
        padding:12px 14px;
        background:rgba(255,255,255,0.86);
        border-bottom:1px solid rgba(17,24,39,0.08);
        font-weight:950;
        font-size:12px;
        color:rgba(11,18,32,0.75);
        align-items:center;
        position:sticky;
        top:0;
        z-index:2;
      }

      .lbRow{
        display:grid;
        padding:14px 14px;
        background:rgba(255,255,255,0.66);
        border-bottom:1px solid rgba(17,24,39,0.06);
        align-items:center;
      }

      .lbRow:hover{
        background:rgba(255,255,255,0.84);
        box-shadow:inset 0 0 0 1px rgba(225,29,46,0.08);
      }

      .center{ text-align:center; }

      .lbRank{
        text-align:center;
        font-weight:950;
        color:#0f172a;
      }

      .lbName{
        font-weight:950;
        color:#0f172a;
      }

      .lbActHead{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:2px;
      }

      .lbActTitle{
        font-weight:950;
        color:#0f172a;
      }

      .lbActSub{
        font-size:11px;
        opacity:.6;
        color:#64748b;
      }

      .lbCell{
        display:grid;
        grid-template-columns:68px 34px 40px;
        align-items:center;
        justify-content:center;
        gap:10px;
      }

      .lbScore{
        text-align:right;
        font-weight:900;
        color:#0f172a;
      }

      .lbTotal{
        text-align:center;
        font-weight:950;
        color:${RED};
      }

      .lbMedals{
        text-align:center;
        font-weight:950;
        color:#0f172a;
      }

      .lbIconBtn{
        width:36px;
        height:36px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.90);
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        color:#0f172a;
        flex:0 0 auto;
      }

      .lbIconBtn:hover{
        border-color:rgba(225,29,46,0.24);
        box-shadow:0 8px 20px rgba(225,29,46,0.10);
      }

      .lbIconBtn:active{
        transform:translateY(1px) scale(.98);
      }

      .lbEmpty{
        padding:18px;
        text-align:center;
        opacity:.75;
        background:rgba(255,255,255,0.55);
        color:#64748b;
        font-weight:800;
      }

      .lbMobileEmpty{
        border-radius:16px;
      }

      .lbMobileCard{
        border:1px solid rgba(17,24,39,0.08);
        border-radius:18px;
        background:rgba(255,255,255,0.84);
        box-shadow:0 10px 24px rgba(2,8,23,0.06);
        padding:14px;
        display:grid;
        gap:12px;
      }

      .lbMobileTop{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
      }

      .lbMobileRank{
        font-size:12px;
        font-weight:950;
        color:${RED};
      }

      .lbMobileName{
        margin-top:4px;
        font-size:17px;
        font-weight:950;
        color:#0b1220;
      }

      .lbMobileSub{
        margin-top:4px;
        font-size:12px;
        color:#64748b;
        font-weight:800;
      }

      .lbMobileTotalWrap{
        text-align:right;
      }

      .lbMobileTotalLabel{
        font-size:11px;
        font-weight:900;
        color:#64748b;
        text-transform:uppercase;
        letter-spacing:.04em;
      }

      .lbMobileTotal{
        margin-top:4px;
        font-size:20px;
        font-weight:950;
        color:${RED};
      }

      .lbMobileMedals{
        display:flex;
        gap:12px;
        flex-wrap:wrap;
        font-size:13px;
        font-weight:900;
        color:#0f172a;
      }

      .lbMobileActivities{
        display:grid;
        gap:10px;
      }

      .lbMobileActivity{
        border:1px solid rgba(17,24,39,0.08);
        border-radius:14px;
        background:rgba(255,255,255,0.70);
        padding:12px;
      }

      .lbMobileActivityHead{
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:center;
      }

      .lbMobileActivityName{
        font-size:13px;
        font-weight:900;
        color:#0f172a;
      }

      .lbMobileActivityFoot{
        margin-top:10px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
      }

      .lbMobileActivityScore{
        font-size:18px;
        font-weight:950;
        color:#0f172a;
      }

      .lbMedal{
        position:relative;
        border-radius:999px;
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
        box-shadow:0 8px 18px rgba(2,8,23,0.10);
      }

      .lbMedal::before{
        content:"";
        position:absolute;
        top:calc(var(--rH) * -1);
        left:50%;
        width:70%;
        height:calc(var(--rH) * 1.55);
        transform:translateX(-50%);
        background:linear-gradient(135deg, rgba(31,120,255,0.95), rgba(22,102,216,0.95));
        border-radius:16px;
      }

      .lbMedalCore{
        width:100%;
        height:100%;
        border-radius:999px;
        background:radial-gradient(circle at 30% 30%, var(--m1), var(--m2), var(--m3));
        border:2px solid rgba(0,0,0,0.10);
        display:flex;
        align-items:center;
        justify-content:center;
        position:relative;
        z-index:2;
      }

      .lbMedalEmoji{
        font-weight:900;
        font-size:14px;
        filter:drop-shadow(0 4px 10px rgba(0,0,0,0.20));
      }

      .lbShine{
        position:absolute;
        inset:-40%;
        background:linear-gradient(120deg,
          rgba(255,255,255,0) 40%,
          rgba(255,255,255,0.10) 48%,
          rgba(255,255,255,0.45) 52%,
          rgba(255,255,255,0.10) 56%,
          rgba(255,255,255,0) 64%
        );
        transform:rotate(18deg) translateX(-40%);
        animation:lbShine 2.6s ease-in-out infinite;
        z-index:3;
        pointer-events:none;
        mix-blend-mode:screen;
      }

      @keyframes lbShine{
        0%{ transform:rotate(18deg) translateX(-55%); opacity:0.08; }
        35%{ opacity:0.38; }
        60%{ opacity:0.22; }
        100%{ transform:rotate(18deg) translateX(55%); opacity:0.08; }
      }

      .dim{ opacity:.65; }

      @media(max-width:980px){
        .lbTabsGrid{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:860px){
        .lbDesktopTable{ display:none; }
        .lbMobileCards{ display:grid; gap:12px; }
        .lbPodium{ flex-direction:column; }
        .lbPodiumCard{ min-width:unset; }
      }

      @media(max-width:768px){
        .lbHeaderRight{
          width:100%;
        }

        .lbBtn,
        .lbChip{
          width:100%;
          justify-content:center;
          text-align:center;
        }

        .lbPodiumGrid{
          grid-template-columns:1fr;
        }

        .lbEnhanceBar{
          align-items:stretch;
        }

        .lbGroupShell{
          gap:8px;
        }

        .lbScrollBtn{
          width:36px;
          height:36px;
        }
      }

      @media(max-width:640px){
        .lbWrap{
          padding:14px;
          border-radius:16px;
        }

        .lbTitle{
          font-size:20px;
        }

        .lbTabsCard,
        .lbTableCard{
          padding:14px;
        }

        .lbSelect{
          font-size:16px;
        }

        .lbTab{
          min-height:40px;
        }
      }
    `}</style>
  );
}

function PrintStyles() {
  return (
    <style>{`
      .raPrintOverlay{
        position:fixed;
        inset:0;
        background:rgba(2,8,23,0.55);
        z-index:9999;
        display:flex;
        flex-direction:column;
      }

      .raPrintTopbar{
        padding:12px 14px;
        background:rgba(255,255,255,0.92);
        border-bottom:1px solid rgba(17,24,39,0.12);
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
      }

      .raPrintPage{
        flex:1;
        overflow:auto;
        background:#eef2f7;
        padding:22px;
      }

      .raPrintPageInner{
        max-width:1180px;
        margin:0 auto;
        background:#fff;
        padding:20px;
        box-shadow:0 10px 30px rgba(2,8,23,0.08);
        border-radius:12px;
      }

      .raPrintHeader{
        display:flex;
        justify-content:space-between;
        gap:18px;
        align-items:flex-end;
        border-bottom:2px solid #111;
        padding-bottom:12px;
        margin-bottom:14px;
      }

      .raPrintTitle{
        font-size:20px;
        font-weight:950;
      }

      .raPrintMeta{
        display:flex;
        gap:14px;
        flex-wrap:wrap;
        margin-top:8px;
        font-size:12px;
      }

      .raPrintLegend{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        font-size:12px;
        font-weight:900;
      }

      .raPrintPodium{
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:12px;
        margin:14px 0 18px;
      }

      .raPrintPodiumCard{
        border:1px solid #111;
        border-radius:10px;
        padding:12px;
        break-inside:avoid;
      }

      .raPrintTableWrap{
        overflow-x:auto;
        width:100%;
      }

      .raPrintTable{
        width:100%;
        border-collapse:collapse;
        font-size:11px;
        table-layout:auto;
      }

      .raPrintTable th,
      .raPrintTable td{
        border:1px solid #111;
        padding:6px 6px;
        vertical-align:middle;
        word-break:break-word;
      }

      .raPrintTable thead th{
        background:#f2f2f2;
        font-weight:950;
      }

      .raPrintSmall{
        font-size:10px;
        font-weight:700;
        opacity:0.7;
        margin-top:2px;
      }

      .raPrintFooter{
        margin-top:14px;
        font-size:11px;
        opacity:.85;
        border-top:1px solid #111;
        padding-top:10px;
      }

      @media(max-width:900px){
        .raPrintPodium{
          grid-template-columns:1fr;
        }
      }

      @media print{
        @page{
          size: A4 landscape;
          margin: 10mm;
        }

        html, body{
          background:#fff !important;
        }

        body * { visibility:hidden; }
        .raPrintOverlay, .raPrintOverlay * { visibility:visible; }
        .raPrintOverlay{
          position:static !important;
          inset:auto !important;
          background:#fff !important;
          display:block !important;
        }
        .raPrintTopbar{ display:none !important; }
        .raPrintPage{
          padding:0 !important;
          overflow:visible !important;
          background:#fff !important;
        }
        .raPrintPageInner{
          max-width:none !important;
          box-shadow:none !important;
          border-radius:0 !important;
          padding:0 !important;
          background:#fff !important;
        }
        .raPrintHeader{
          break-inside:avoid;
        }
        .raPrintPodium{
          break-inside:avoid;
          page-break-inside:avoid;
          margin-bottom:10px !important;
        }
        .raPrintPodiumCard{
          break-inside:avoid;
          page-break-inside:avoid;
        }
        .raPrintTableWrap{
          overflow:visible !important;
        }
        table, tr, td, th {
          break-inside:avoid;
          page-break-inside:avoid;
        }
        thead{
          display:table-header-group;
        }
        tfoot{
          display:table-footer-group;
        }
      }
    `}</style>
  );
}
