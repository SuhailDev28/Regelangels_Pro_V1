// src/pages/Admin/Setup.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import {
  getEffectiveAcademy,
  getRole,
  getSelectedAcademy,
  isSuperAdmin,
} from "../../lib/auth.js";
import { UI } from "./ui.js";

/**
 * Setup.jsx — MULTI-ACADEMY ENTERPRISE VERSION
 * ✅ Tabs: Groups / Activities
 * ✅ Works for ADMIN + scoped SUPER_ADMIN
 * ✅ Academy scope awareness
 * ✅ Scope-required empty state for SUPER_ADMIN
 * ✅ Create / Edit / Delete with modals
 * ✅ Grouped groups with expandable levels
 * ✅ Expand All / Collapse All
 * ✅ Duplicate prevention
 * ✅ Search / filter / chips
 * ✅ KPI cards
 * ✅ Bulk import (CSV paste + file upload)
 * ✅ Bulk select / bulk delete
 * ✅ Archive / restore
 * ✅ Active / Archived / All filter
 * ✅ Stronger mobile / tablet responsiveness
 * ✅ Table view on desktop, stacked cards on mobile
 */

const RED = "var(--ra-accent, #e11d2e)";
const MOBILE_BP = 720;
const TABLET_BP = 980;

export default function Setup() {
  const [tab, setTab] = useState("GROUPS");

  const [groups, setGroups] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [gName, setGName] = useState("");
  const [gLevel, setGLevel] = useState("");

  const [aName, setAName] = useState("");
  const [aMax, setAMax] = useState(10);

  const [fGroupName, setFGroupName] = useState("");
  const [fLevel, setFLevel] = useState("");
  const [fActName, setFActName] = useState("");
  const [aSort, setASort] = useState("name_asc");
  const [statusFilter, setStatusFilter] = useState("ACTIVE"); // ACTIVE | ARCHIVED | ALL

  const [openGroupKeys, setOpenGroupKeys] = useState(() => new Set());

  const [selectedGroupIds, setSelectedGroupIds] = useState(() => new Set());
  const [selectedActivityIds, setSelectedActivityIds] = useState(
    () => new Set(),
  );

  const [edit, setEdit] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [importState, setImportState] = useState(null);

  const [theme, setTheme] = useState(() => {
    const t = document?.documentElement?.getAttribute?.("data-theme");
    return t === "dark" ? "dark" : "light";
  });

  const [viewport, setViewport] = useState(() => {
    try {
      return window.innerWidth || 1200;
    } catch {
      return 1200;
    }
  });

  const [academyCtx, setAcademyCtx] = useState(() => getEffectiveAcademy());
  const [role, setRoleState] = useState(() => getRole());
  const [selectedAcademyCtx, setSelectedAcademyCtx] = useState(() =>
    getSelectedAcademy(),
  );

  const isMobile = viewport <= MOBILE_BP;
  const isTablet = viewport > MOBILE_BP && viewport <= TABLET_BP;
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

  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      const t = el.getAttribute("data-theme");
      setTheme(t === "dark" ? "dark" : "light");
    });
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!ok) return;
    const id = setTimeout(() => setOk(""), 2600);
    return () => clearTimeout(id);
  }, [ok]);

  useEffect(() => {
    function onResize() {
      setViewport(window.innerWidth || 1200);
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

  const T = useMemo(() => {
    const light = {
      bgTop:
        "radial-gradient(1100px 440px at 0% 0%, rgba(225,29,46,0.08), transparent 55%), radial-gradient(900px 380px at 100% 0%, rgba(59,130,246,0.06), transparent 50%), linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.96))",
      text: "#0f172a",
      sub: "rgba(15,23,42,0.68)",
      cardBg: "rgba(255,255,255,0.92)",
      cardBorder: "rgba(15,23,42,0.08)",
      headBg: "rgba(248,250,252,0.92)",
      rowBorder: "rgba(15,23,42,0.08)",
      inputBg: "rgba(255,255,255,0.96)",
      inputBorder: "rgba(15,23,42,0.12)",
      pillBg: "rgba(255,241,242,0.78)",
      pillBorder: "rgba(225,29,46,0.20)",
      softBtnBg: "rgba(255,255,255,0.96)",
      softBtnBorder: "rgba(15,23,42,0.10)",
      modalBg: "rgba(255,255,255,0.98)",
      overlay: "rgba(15,23,42,0.42)",
      panelSoft: "rgba(15,23,42,0.03)",
      successBg: "rgba(16,185,129,0.10)",
      successBorder: "rgba(16,185,129,0.20)",
      dangerBg: "rgba(225,29,46,0.08)",
      dangerBorder: "rgba(225,29,46,0.18)",
      warnBg: "rgba(245,158,11,0.10)",
      warnBorder: "rgba(245,158,11,0.24)",
      shadow: "0 24px 60px rgba(15,23,42,0.08)",
      cardShadow: "0 16px 36px rgba(15,23,42,0.06)",
      statBg: "rgba(255,255,255,0.90)",
      statBorder: "rgba(15,23,42,0.08)",
      activeRow: "rgba(225,29,46,0.05)",
      archiveBg: "rgba(148,163,184,0.10)",
      accentSoft: "rgba(225,29,46,0.08)",
      successText: "#047857",
      warnText: "#b45309",
    };

    const dark = {
      bgTop:
        "radial-gradient(1100px 440px at 0% 0%, rgba(225,29,46,0.16), transparent 55%), radial-gradient(900px 380px at 100% 0%, rgba(59,130,246,0.10), transparent 50%), linear-gradient(180deg, rgba(2,6,23,0.92), rgba(15,23,42,0.96))",
      text: "rgba(255,255,255,0.94)",
      sub: "rgba(255,255,255,0.66)",
      cardBg: "rgba(15,23,42,0.88)",
      cardBorder: "rgba(148,163,184,0.16)",
      headBg: "rgba(2,6,23,0.44)",
      rowBorder: "rgba(148,163,184,0.14)",
      inputBg: "rgba(2,6,23,0.48)",
      inputBorder: "rgba(148,163,184,0.18)",
      pillBg: "rgba(225,29,46,0.16)",
      pillBorder: "rgba(225,29,46,0.22)",
      softBtnBg: "rgba(2,6,23,0.42)",
      softBtnBorder: "rgba(148,163,184,0.18)",
      modalBg: "rgba(2,6,23,0.96)",
      overlay: "rgba(0,0,0,0.60)",
      panelSoft: "rgba(255,255,255,0.03)",
      successBg: "rgba(16,185,129,0.10)",
      successBorder: "rgba(16,185,129,0.22)",
      dangerBg: "rgba(225,29,46,0.10)",
      dangerBorder: "rgba(225,29,46,0.20)",
      warnBg: "rgba(245,158,11,0.12)",
      warnBorder: "rgba(245,158,11,0.26)",
      shadow: "0 24px 70px rgba(0,0,0,0.34)",
      cardShadow: "0 16px 36px rgba(0,0,0,0.22)",
      statBg: "rgba(2,6,23,0.36)",
      statBorder: "rgba(148,163,184,0.14)",
      activeRow: "rgba(225,29,46,0.07)",
      archiveBg: "rgba(148,163,184,0.10)",
      accentSoft: "rgba(225,29,46,0.12)",
      successText: "#10b981",
      warnText: "#f59e0b",
    };

    return theme === "dark" ? dark : light;
  }, [theme]);

  async function load() {
    if (scopeRequired) {
      setGroups([]);
      setActivities([]);
      setSelectedGroupIds(new Set());
      setSelectedActivityIds(new Set());
      setOpenGroupKeys(new Set());
      setLoading(false);
      setErr("");
      return;
    }

    setLoading(true);
    setErr("");
    try {
      const [gs, as] = await Promise.all([api.groups(), api.activities()]);
      setGroups(Array.isArray(gs) ? gs : []);
      setActivities(Array.isArray(as) ? as : []);
    } catch (e) {
      setErr(e?.message || "Failed to load setup data");
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
  ]);

  async function addGroup() {
    const name = String(gName || "").trim();
    const level = String(gLevel || "").trim();
    if (!name || scopeRequired) return;

    const exists = groups.some(
      (g) =>
        String(g.name || "")
          .trim()
          .toLowerCase() === name.toLowerCase() &&
        String(g.level || "")
          .trim()
          .toLowerCase() === level.toLowerCase(),
    );
    if (exists) {
      setErr("This group + level combination already exists.");
      return;
    }

    setBusy(true);
    setErr("");
    setOk("");
    try {
      await api.createGroup({ name, level: level || "" });
      setGName("");
      setGLevel("");
      await load();
      setOk("Group created successfully.");
    } catch (e) {
      setErr(e?.message || "Failed to create group");
    } finally {
      setBusy(false);
    }
  }

  async function updateGroup(doc, patch) {
    setBusy(true);
    setErr("");
    setOk("");
    try {
      await api.updateGroup(doc._id, patch);
      await load();
      setOk("Group updated successfully.");
    } catch (e) {
      setErr(e?.message || "Failed to update group");
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup(id) {
    setBusy(true);
    setErr("");
    setOk("");
    try {
      await api.deleteGroup(id);
      await load();
      setOk("Group deleted successfully.");
    } catch (e) {
      setErr(e?.message || "Failed to delete group");
    } finally {
      setBusy(false);
    }
  }

  async function addActivity() {
    const name = String(aName || "").trim();
    const maxScore = Number(aMax || 10);
    if (!name || scopeRequired) return;

    const exists = activities.some(
      (a) =>
        String(a.name || "")
          .trim()
          .toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      setErr("This activity already exists.");
      return;
    }

    setBusy(true);
    setErr("");
    setOk("");
    try {
      await api.createActivity({ name, maxScore });
      setAName("");
      setAMax(10);
      await load();
      setOk("Activity created successfully.");
    } catch (e) {
      setErr(e?.message || "Failed to create activity");
    } finally {
      setBusy(false);
    }
  }

  async function updateActivity(a, patch) {
    setBusy(true);
    setErr("");
    setOk("");
    try {
      await api.updateActivity(a._id, patch);
      await load();
      setOk("Activity updated successfully.");
    } catch (e) {
      setErr(e?.message || "Failed to update activity");
    } finally {
      setBusy(false);
    }
  }

  async function deleteActivity(id) {
    setBusy(true);
    setErr("");
    setOk("");
    try {
      await api.deleteActivity(id);
      await load();
      setOk("Activity deleted successfully.");
    } catch (e) {
      setErr(e?.message || "Failed to delete activity");
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchiveGroup(doc, nextArchived) {
    setBusy(true);
    setErr("");
    setOk("");
    try {
      await api.updateGroup(doc._id, { archived: !!nextArchived });
      await load();
      setOk(nextArchived ? "Group archived." : "Group restored.");
    } catch (e) {
      setErr(e?.message || "Failed to update archive status.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchiveActivity(doc, nextArchived) {
    setBusy(true);
    setErr("");
    setOk("");
    try {
      await api.updateActivity(doc._id, { archived: !!nextArchived });
      await load();
      setOk(nextArchived ? "Activity archived." : "Activity restored.");
    } catch (e) {
      setErr(e?.message || "Failed to update archive status.");
    } finally {
      setBusy(false);
    }
  }

  function isVisibleByStatus(doc) {
    const archived = !!doc?.archived;
    if (statusFilter === "ALL") return true;
    if (statusFilter === "ARCHIVED") return archived;
    return !archived;
  }

  const levels = useMemo(() => {
    const set = new Set();
    groups.forEach((g) => {
      if (!isVisibleByStatus(g)) return;
      const lv = String(g.level || "").trim();
      if (lv) set.add(lv);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [groups, statusFilter]);

  const groupedGroups = useMemo(() => {
    const nameNeedle = String(fGroupName || "")
      .trim()
      .toLowerCase();
    const lvNeedle = String(fLevel || "")
      .trim()
      .toLowerCase();

    const visibleGroups = groups.filter(isVisibleByStatus);
    const map = new Map();

    visibleGroups.forEach((g) => {
      const name = String(g.name || "").trim();
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, { name, key, items: [] });
      map.get(key).items.push(g);
    });

    return Array.from(map.values())
      .map((x) => {
        const items = [...x.items].sort((a, b) =>
          String(a.level || "").localeCompare(String(b.level || "")),
        );
        const rawLevels = items
          .map((it) => String(it.level || "—").trim() || "—")
          .filter(Boolean);
        const uniqueLevels = Array.from(new Set(rawLevels));
        const archivedCount = items.filter((it) => !!it.archived).length;

        return {
          name: x.name,
          key: x.key,
          items,
          levels: uniqueLevels,
          levelsText: uniqueLevels.join(", "),
          archivedCount,
        };
      })
      .filter((g) => {
        if (nameNeedle && !g.key.includes(nameNeedle)) return false;
        if (lvNeedle) {
          const has = g.levels.some(
            (lv) => String(lv).trim().toLowerCase() === lvNeedle,
          );
          if (!has) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, fGroupName, fLevel, statusFilter]);

  const uniqueGroupNameCount = useMemo(() => {
    const set = new Set(
      groups.filter(isVisibleByStatus).map((g) =>
        String(g.name || "")
          .trim()
          .toLowerCase(),
      ),
    );
    return set.size;
  }, [groups, statusFilter]);

  const totalLevels = useMemo(
    () => groups.filter(isVisibleByStatus).length,
    [groups, statusFilter],
  );

  const filteredActivities = useMemo(() => {
    const s = String(fActName || "")
      .trim()
      .toLowerCase();

    let arr = activities.filter(isVisibleByStatus);
    if (s) {
      arr = arr.filter((a) =>
        String(a.name || "")
          .toLowerCase()
          .includes(s),
      );
    }

    arr = [...arr];
    arr.sort((a, b) => {
      if (aSort === "name_asc") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }
      if (aSort === "name_desc") {
        return String(b.name || "").localeCompare(String(a.name || ""));
      }
      if (aSort === "score_asc") {
        return Number(a.maxScore ?? 0) - Number(b.maxScore ?? 0);
      }
      return Number(b.maxScore ?? 0) - Number(a.maxScore ?? 0);
    });

    return arr;
  }, [activities, fActName, aSort, statusFilter]);

  const visibleGroupItems = useMemo(
    () => groupedGroups.flatMap((g) => g.items),
    [groupedGroups],
  );

  const allVisibleGroupIds = useMemo(
    () => visibleGroupItems.map((x) => x._id),
    [visibleGroupItems],
  );

  const allVisibleActivityIds = useMemo(
    () => filteredActivities.map((x) => x._id),
    [filteredActivities],
  );

  const selectedVisibleGroupCount = useMemo(
    () => allVisibleGroupIds.filter((id) => selectedGroupIds.has(id)).length,
    [allVisibleGroupIds, selectedGroupIds],
  );

  const selectedVisibleActivityCount = useMemo(
    () =>
      allVisibleActivityIds.filter((id) => selectedActivityIds.has(id)).length,
    [allVisibleActivityIds, selectedActivityIds],
  );

  const archivedGroupsCount = useMemo(
    () => groups.filter((g) => !!g.archived).length,
    [groups],
  );

  const archivedActivitiesCount = useMemo(
    () => activities.filter((a) => !!a.archived).length,
    [activities],
  );

  function clearGroupFilters() {
    setFGroupName("");
    setFLevel("");
  }

  function clearActivityFilters() {
    setFActName("");
  }

  function toggleOpen(key) {
    setOpenGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAllVisible() {
    setOpenGroupKeys(new Set(groupedGroups.map((g) => g.key)));
  }

  function collapseAllVisible() {
    setOpenGroupKeys(new Set());
  }

  function toggleGroupSelection(id) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleActivitySelection(id) {
    setSelectedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisibleGroups() {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      const allSelected = allVisibleGroupIds.every((id) => next.has(id));
      if (allSelected) allVisibleGroupIds.forEach((id) => next.delete(id));
      else allVisibleGroupIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleSelectAllVisibleActivities() {
    setSelectedActivityIds((prev) => {
      const next = new Set(prev);
      const allSelected = allVisibleActivityIds.every((id) => next.has(id));
      if (allSelected) allVisibleActivityIds.forEach((id) => next.delete(id));
      else allVisibleActivityIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkDeleteGroups() {
    const ids = Array.from(selectedGroupIds);
    if (!ids.length) return;

    setBusy(true);
    setErr("");
    setOk("");
    try {
      for (const id of ids) {
        await api.deleteGroup(id);
      }
      setSelectedGroupIds(new Set());
      await load();
      setOk(`${ids.length} group entries deleted.`);
    } catch (e) {
      setErr(e?.message || "Failed to delete selected groups.");
    } finally {
      setBusy(false);
    }
  }

  async function bulkDeleteActivities() {
    const ids = Array.from(selectedActivityIds);
    if (!ids.length) return;

    setBusy(true);
    setErr("");
    setOk("");
    try {
      for (const id of ids) {
        await api.deleteActivity(id);
      }
      setSelectedActivityIds(new Set());
      await load();
      setOk(`${ids.length} activities deleted.`);
    } catch (e) {
      setErr(e?.message || "Failed to delete selected activities.");
    } finally {
      setBusy(false);
    }
  }

  async function bulkArchiveGroups(nextArchived) {
    const ids = Array.from(selectedGroupIds);
    if (!ids.length) return;

    setBusy(true);
    setErr("");
    setOk("");
    try {
      for (const id of ids) {
        await api.updateGroup(id, { archived: !!nextArchived });
      }
      setSelectedGroupIds(new Set());
      await load();
      setOk(
        nextArchived
          ? `${ids.length} groups archived.`
          : `${ids.length} groups restored.`,
      );
    } catch (e) {
      setErr(e?.message || "Failed to update selected groups.");
    } finally {
      setBusy(false);
    }
  }

  async function bulkArchiveActivities(nextArchived) {
    const ids = Array.from(selectedActivityIds);
    if (!ids.length) return;

    setBusy(true);
    setErr("");
    setOk("");
    try {
      for (const id of ids) {
        await api.updateActivity(id, { archived: !!nextArchived });
      }
      setSelectedActivityIds(new Set());
      await load();
      setOk(
        nextArchived
          ? `${ids.length} activities archived.`
          : `${ids.length} activities restored.`,
      );
    } catch (e) {
      setErr(e?.message || "Failed to update selected activities.");
    } finally {
      setBusy(false);
    }
  }

  function openEditGroup(doc) {
    setEdit({ type: "group", doc });
  }

  function openEditActivity(doc) {
    setEdit({ type: "activity", doc });
  }

  function askConfirm({ title, body, onYes }) {
    setConfirmState({ title, body, onYes });
  }

  function closeModals() {
    setEdit(null);
    setConfirmState(null);
    setImportState(null);
  }

  const academyName = academyCtx?.academyName || "Academy";
  const academyCode = academyCtx?.academyCode || "";
  const academyScopeSource = academyCtx?.source || "user";

  return (
    <div style={{ display: "grid", gap: 14, color: T.text }}>
      <StyleTag />

      <section style={topShell(T)}>
        <div style={topHead}>
          <div>
            <div style={eyebrow}>Configuration Center</div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>
              Setup Console
            </h2>
            <div
              style={{
                marginTop: 6,
                color: T.sub,
                fontWeight: 700,
                lineHeight: 1.5,
              }}
            >
              Manage competition structure, activity definitions, archive
              states, imports, batch operations, and academy-scoped setup from
              one controlled workspace.
            </div>
          </div>

          <div style={summaryRow}>
            <div style={summaryPill(T)}>
              Unique Groups: <b>{uniqueGroupNameCount}</b>
            </div>
            <div style={summaryPill(T)}>
              Levels: <b>{totalLevels}</b>
            </div>
            <div style={summaryPill(T)}>
              Activities: <b>{activities.filter(isVisibleByStatus).length}</b>
            </div>
          </div>
        </div>

        <div style={academyScopeBar(T)}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, color: T.sub, fontWeight: 950 }}>
              ACTIVE ACADEMY SCOPE
            </div>
            <div style={{ fontSize: 15, fontWeight: 950, color: T.text }}>
              {scopeRequired
                ? "No academy selected"
                : academyCode
                  ? `${academyName} (${academyCode})`
                  : academyName}
            </div>
          </div>

          <div style={academyScopeMetaWrap}>
            <span style={scopePill(T)}>
              Role: {String(role || "ADMIN").replaceAll("_", " ")}
            </span>
            <span style={scopePill(T)}>
              Scope: {academyScopeSource === "selected" ? "Scoped" : "Direct"}
            </span>
            <button
              type="button"
              style={softBtn(T)}
              onClick={load}
              disabled={busy || loading || scopeRequired}
            >
              {loading ? "Loading..." : "Refresh Scope Data"}
            </button>
          </div>
        </div>

        <div style={statsGrid}>
          <StatCard
            title="Unique Groups"
            value={uniqueGroupNameCount}
            hint="Grouped names"
            T={T}
          />
          <StatCard
            title="Total Levels"
            value={totalLevels}
            hint="Visible level entries"
            T={T}
          />
          <StatCard
            title="Activities"
            value={activities.filter(isVisibleByStatus).length}
            hint="Current visible activities"
            T={T}
          />
          <StatCard
            title="Archived Records"
            value={archivedGroupsCount + archivedActivitiesCount}
            hint="Groups + activities archived"
            T={T}
          />
        </div>

        <div style={tabRow}>
          <button
            type="button"
            onClick={() => setTab("GROUPS")}
            style={tabBtn(tab === "GROUPS", T)}
          >
            Groups
          </button>

          <button
            type="button"
            onClick={() => setTab("ACTIVITIES")}
            style={tabBtn(tab === "ACTIVITIES", T)}
          >
            Activities
          </button>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={statusSelect(T)}
          >
            <option value="ACTIVE">Show Active</option>
            <option value="ARCHIVED">Show Archived</option>
            <option value="ALL">Show All</option>
          </select>

          <div style={{ flex: 1 }} />

          {tab === "GROUPS" ? (
            <>
              <div style={metaText(T)}>
                Showing <b>{groupedGroups.length}</b> / {uniqueGroupNameCount}
              </div>

              <button
                type="button"
                style={softBtn(T)}
                onClick={() => setImportState({ type: "group" })}
                disabled={busy || loading || scopeRequired}
              >
                Import CSV
              </button>

              <button
                type="button"
                style={softBtn(T)}
                onClick={expandAllVisible}
                disabled={busy || loading || !groupedGroups.length}
              >
                Expand All
              </button>

              <button
                type="button"
                style={softBtn(T)}
                onClick={collapseAllVisible}
                disabled={busy || loading || !groupedGroups.length}
              >
                Collapse All
              </button>

              <button
                type="button"
                style={softBtn(T)}
                onClick={clearGroupFilters}
                disabled={busy || loading}
              >
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <div style={metaText(T)}>
                Showing <b>{filteredActivities.length}</b> /{" "}
                {activities.filter(isVisibleByStatus).length}
              </div>

              <button
                type="button"
                style={softBtn(T)}
                onClick={() => setImportState({ type: "activity" })}
                disabled={busy || loading || scopeRequired}
              >
                Import CSV
              </button>

              <button
                type="button"
                style={softBtn(T)}
                onClick={clearActivityFilters}
                disabled={busy || loading}
              >
                Clear Filters
              </button>
            </>
          )}
        </div>
      </section>

      {scopeRequired ? (
        <section style={scopeRequiredCard(T)}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>
            Academy scope required
          </div>
          <div
            style={{
              marginTop: 8,
              color: T.sub,
              lineHeight: 1.55,
              fontWeight: 700,
            }}
          >
            You are signed in as Super Admin. Select an academy from the academy
            scope switcher in the dashboard/sidebar to load groups and
            activities for that academy.
          </div>
        </section>
      ) : null}

      {ok ? <div style={successBanner(T)}>{ok}</div> : null}
      {err ? <div style={errorBanner(T)}>{err}</div> : null}

      {tab === "GROUPS" && !scopeRequired ? (
        <section style={card(UI.card, T)}>
          <Header
            title="Groups"
            subtitle="Create, import, batch-manage, archive, and organize multi-level groups"
            total={groups.filter(isVisibleByStatus).length}
            T={T}
          />

          <div style={filterGrid}>
            <div style={{ position: "relative" }}>
              <input
                style={input(UI.input, T, { width: "100%" })}
                placeholder="Filter by group name"
                value={fGroupName}
                onChange={(e) => setFGroupName(e.target.value)}
              />
              {fGroupName ? (
                <button
                  type="button"
                  style={xBtn(T)}
                  onClick={() => setFGroupName("")}
                >
                  ✕
                </button>
              ) : null}
            </div>

            <div style={{ position: "relative" }}>
              <select
                style={input(UI.input, T, { width: "100%" })}
                value={fLevel}
                onChange={(e) => setFLevel(e.target.value)}
              >
                <option value="">All Levels</option>
                {levels.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>
              {fLevel ? (
                <button
                  type="button"
                  style={xBtn(T)}
                  onClick={() => setFLevel("")}
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>

          {(fGroupName || fLevel) && (
            <div style={chipRow}>
              {fGroupName ? (
                <span style={filterChip(T)}>
                  Name: {fGroupName}
                  <button
                    type="button"
                    style={chipX}
                    onClick={() => setFGroupName("")}
                  >
                    ✕
                  </button>
                </span>
              ) : null}
              {fLevel ? (
                <span style={filterChip(T)}>
                  Level: {fLevel}
                  <button
                    type="button"
                    style={chipX}
                    onClick={() => setFLevel("")}
                  >
                    ✕
                  </button>
                </span>
              ) : null}
            </div>
          )}

          <section style={createPanel(T)}>
            <div style={sectionMiniTitle(T)}>Create New Group</div>
            <div
              className="ra-setup-group-grid"
              style={createGridResponsive(isMobile, isTablet)}
            >
              <input
                style={input(UI.input, T, { width: "100%" })}
                placeholder="Group name"
                value={gName}
                onChange={(e) => setGName(e.target.value)}
              />
              <input
                style={input(UI.input, T, { width: "100%" })}
                placeholder="Level (optional)"
                value={gLevel}
                onChange={(e) => setGLevel(e.target.value)}
              />
              <button
                style={primaryBtn(UI.btnPrimary)}
                onClick={addGroup}
                disabled={!gName.trim() || busy || loading}
              >
                {busy ? "Saving..." : "+ Add Group"}
              </button>
            </div>
          </section>

          {selectedGroupIds.size > 0 ? (
            <div style={bulkBar(T)}>
              <div style={{ fontWeight: 900 }}>
                Selected group entries: <b>{selectedGroupIds.size}</b>
              </div>

              <div style={bulkActions}>
                <button
                  type="button"
                  style={softBtn(T)}
                  onClick={() => bulkArchiveGroups(true)}
                  disabled={busy}
                >
                  Archive Selected
                </button>

                <button
                  type="button"
                  style={softBtn(T)}
                  onClick={() => bulkArchiveGroups(false)}
                  disabled={busy}
                >
                  Restore Selected
                </button>

                <button
                  type="button"
                  style={UI.btnDanger}
                  onClick={() =>
                    askConfirm({
                      title: "Delete selected groups",
                      body: `Delete ${selectedGroupIds.size} selected group entries? This cannot be undone.`,
                      onYes: bulkDeleteGroups,
                    })
                  }
                  disabled={busy}
                >
                  Delete Selected
                </button>
              </div>
            </div>
          ) : null}

          {!isMobile ? (
            <div style={tableWrap(UI.table, T)}>
              <div
                className="ra-setup-table-head"
                style={{ ...thead(UI.thead, T), ...gridColsGroupEnhanced }}
              >
                <div>
                  <input
                    type="checkbox"
                    checked={
                      allVisibleGroupIds.length > 0 &&
                      selectedVisibleGroupCount === allVisibleGroupIds.length
                    }
                    onChange={toggleSelectAllVisibleGroups}
                  />
                </div>
                <div>Name</div>
                <div>Levels</div>
                <div>Status</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              {loading ? (
                <SkeletonRows T={T} rows={6} cols={3} />
              ) : groupedGroups.length ? (
                groupedGroups.map((g) => {
                  const isOpen = openGroupKeys.has(g.key);

                  return (
                    <div
                      key={g.key}
                      style={{ borderBottom: `1px solid ${T.rowBorder}` }}
                    >
                      <div
                        style={{
                          ...trow(UI.trow, T),
                          ...gridColsGroupEnhanced,
                          borderBottom: "none",
                          background:
                            g.archivedCount === g.items.length && g.items.length
                              ? T.archiveBg
                              : "transparent",
                        }}
                      >
                        <div style={{ display: "grid", placeItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={
                              g.items.length > 0 &&
                              g.items.every((it) =>
                                selectedGroupIds.has(it._id),
                              )
                            }
                            onChange={() => {
                              const allSelected = g.items.every((it) =>
                                selectedGroupIds.has(it._id),
                              );
                              setSelectedGroupIds((prev) => {
                                const next = new Set(prev);
                                if (allSelected)
                                  g.items.forEach((it) => next.delete(it._id));
                                else g.items.forEach((it) => next.add(it._id));
                                return next;
                              });
                            }}
                          />
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            minWidth: 0,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleOpen(g.key)}
                            style={chevBtn(T)}
                            aria-label={isOpen ? "Collapse" : "Expand"}
                          >
                            {isOpen ? "▾" : "▸"}
                          </button>

                          <div
                            style={{
                              fontWeight: 950,
                              minWidth: 0,
                              wordBreak: "break-word",
                            }}
                          >
                            {g.name}
                          </div>

                          <span style={countPill(T)}>{g.items.length}</span>
                        </div>

                        <div
                          style={{ opacity: 0.85, textTransform: "uppercase" }}
                        >
                          {g.levelsText || "—"}
                        </div>

                        <div>
                          {g.archivedCount === g.items.length &&
                          g.items.length ? (
                            <span style={archiveBadge(T)}>Archived</span>
                          ) : g.archivedCount > 0 ? (
                            <span style={mixedBadge(T)}>Mixed</span>
                          ) : (
                            <span style={activeBadge(T)}>Active</span>
                          )}
                        </div>

                        <div className="ra-setup-actions" style={actions}>
                          <button
                            style={UI.btnGhost}
                            onClick={() => {
                              if (g.items.length === 1)
                                openEditGroup(g.items[0]);
                              else toggleOpen(g.key);
                            }}
                            disabled={busy}
                          >
                            Edit
                          </button>

                          <button
                            style={softBtnSmall(T)}
                            onClick={async () => {
                              const allArchived = g.items.every(
                                (it) => !!it.archived,
                              );
                              setBusy(true);
                              setErr("");
                              setOk("");
                              try {
                                for (const it of g.items) {
                                  await api.updateGroup(it._id, {
                                    archived: !allArchived,
                                  });
                                }
                                await load();
                                setOk(
                                  allArchived
                                    ? "Group restored."
                                    : "Group archived.",
                                );
                              } catch (e) {
                                setErr(
                                  e?.message ||
                                    "Failed to update archive status.",
                                );
                              } finally {
                                setBusy(false);
                              }
                            }}
                            disabled={busy}
                          >
                            {g.items.every((it) => !!it.archived)
                              ? "Restore"
                              : "Archive"}
                          </button>

                          <button
                            style={UI.btnDanger}
                            onClick={() =>
                              askConfirm({
                                title: `Delete "${g.name}"`,
                                body:
                                  g.items.length === 1
                                    ? `Delete this group entry (level "${g.items[0].level || "—"}")?`
                                    : `This group has ${g.items.length} levels. Expand and delete specific levels, or delete all levels together.`,
                                onYes: async () => {
                                  if (g.items.length === 1)
                                    return deleteGroup(g.items[0]._id);
                                  toggleOpen(g.key);
                                },
                              })
                            }
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {isOpen ? (
                        <div style={{ padding: "10px 12px 12px" }}>
                          {g.items.map((it) => (
                            <div
                              key={it._id}
                              style={{
                                ...levelRow(T),
                                background: selectedGroupIds.has(it._id)
                                  ? T.activeRow
                                  : !!it.archived
                                    ? T.archiveBg
                                    : T.panelSoft,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedGroupIds.has(it._id)}
                                  onChange={() => toggleGroupSelection(it._id)}
                                />

                                <div>
                                  <div style={{ fontWeight: 950 }}>
                                    {it.level || "—"}
                                  </div>
                                  <div
                                    style={{
                                      color: T.sub,
                                      fontSize: 12,
                                      marginTop: 4,
                                    }}
                                  >
                                    Group: {g.name}
                                  </div>
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  justifyContent: "flex-end",
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={
                                    !!it.archived
                                      ? archiveBadge(T)
                                      : activeBadge(T)
                                  }
                                >
                                  {!!it.archived ? "Archived" : "Active"}
                                </span>

                                <button
                                  style={UI.btnGhost}
                                  onClick={() => openEditGroup(it)}
                                  disabled={busy}
                                >
                                  Edit Level
                                </button>

                                <button
                                  style={softBtnSmall(T)}
                                  onClick={() =>
                                    toggleArchiveGroup(it, !it.archived)
                                  }
                                  disabled={busy}
                                >
                                  {it.archived ? "Restore" : "Archive"}
                                </button>

                                <button
                                  style={UI.btnDanger}
                                  onClick={() =>
                                    askConfirm({
                                      title: `Delete "${g.name}"`,
                                      body: `Delete level "${it.level || "—"}"?`,
                                      onYes: () => deleteGroup(it._id),
                                    })
                                  }
                                  disabled={busy}
                                >
                                  Delete Level
                                </button>
                              </div>
                            </div>
                          ))}

                          {g.items.length > 1 ? (
                            <div
                              style={{
                                marginTop: 12,
                                display: "flex",
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                style={UI.btnDanger}
                                disabled={busy}
                                onClick={() =>
                                  askConfirm({
                                    title: `Delete ALL levels for "${g.name}"`,
                                    body: `This will delete ${g.items.length} entries. This cannot be undone.`,
                                    onYes: async () => {
                                      setBusy(true);
                                      setErr("");
                                      setOk("");
                                      try {
                                        for (const it of g.items) {
                                          await api.deleteGroup(it._id);
                                        }
                                        setSelectedGroupIds((prev) => {
                                          const next = new Set(prev);
                                          g.items.forEach((it) =>
                                            next.delete(it._id),
                                          );
                                          return next;
                                        });
                                        await load();
                                        setOk(
                                          `All levels for "${g.name}" deleted.`,
                                        );
                                      } catch (e) {
                                        setErr(
                                          e?.message ||
                                            "Failed to delete all levels",
                                        );
                                      } finally {
                                        setBusy(false);
                                      }
                                    },
                                  })
                                }
                              >
                                Delete All Levels
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div style={empty(UI.empty, T)}>
                  No groups match the current filters.
                </div>
              )}
            </div>
          ) : (
            <div style={mobileListWrap}>
              {loading ? (
                <SkeletonCardsMobile T={T} count={4} />
              ) : groupedGroups.length ? (
                groupedGroups.map((g) => {
                  const isOpen = openGroupKeys.has(g.key);
                  const allSelected =
                    g.items.length > 0 &&
                    g.items.every((it) => selectedGroupIds.has(it._id));

                  return (
                    <div
                      key={g.key}
                      style={{
                        ...mobileGroupCard(T),
                        background:
                          g.archivedCount === g.items.length && g.items.length
                            ? T.archiveBg
                            : T.cardBg,
                      }}
                    >
                      <div style={mobileCardHead}>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            minWidth: 0,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => {
                              setSelectedGroupIds((prev) => {
                                const next = new Set(prev);
                                if (allSelected) {
                                  g.items.forEach((it) => next.delete(it._id));
                                } else {
                                  g.items.forEach((it) => next.add(it._id));
                                }
                                return next;
                              });
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 950,
                                wordBreak: "break-word",
                              }}
                            >
                              {g.name}
                            </div>
                            <div
                              style={{
                                color: T.sub,
                                fontSize: 12,
                                marginTop: 4,
                              }}
                            >
                              Levels: {g.levelsText || "—"}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleOpen(g.key)}
                          style={chevBtn(T)}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      <div style={mobileBadgeRow}>
                        <span style={countPill(T)}>
                          {g.items.length} entries
                        </span>
                        {g.archivedCount === g.items.length &&
                        g.items.length ? (
                          <span style={archiveBadge(T)}>Archived</span>
                        ) : g.archivedCount > 0 ? (
                          <span style={mixedBadge(T)}>Mixed</span>
                        ) : (
                          <span style={activeBadge(T)}>Active</span>
                        )}
                      </div>

                      <div style={mobileActionGrid}>
                        <button
                          style={UI.btnGhost}
                          onClick={() => {
                            if (g.items.length === 1) openEditGroup(g.items[0]);
                            else toggleOpen(g.key);
                          }}
                          disabled={busy}
                        >
                          Edit
                        </button>
                        <button
                          style={softBtnSmall(T)}
                          disabled={busy}
                          onClick={async () => {
                            const allArchived = g.items.every(
                              (it) => !!it.archived,
                            );
                            setBusy(true);
                            setErr("");
                            setOk("");
                            try {
                              for (const it of g.items) {
                                await api.updateGroup(it._id, {
                                  archived: !allArchived,
                                });
                              }
                              await load();
                              setOk(
                                allArchived
                                  ? "Group restored."
                                  : "Group archived.",
                              );
                            } catch (e) {
                              setErr(
                                e?.message ||
                                  "Failed to update archive status.",
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {g.items.every((it) => !!it.archived)
                            ? "Restore"
                            : "Archive"}
                        </button>
                        <button
                          style={UI.btnDanger}
                          disabled={busy}
                          onClick={() =>
                            askConfirm({
                              title: `Delete "${g.name}"`,
                              body:
                                g.items.length === 1
                                  ? `Delete this group entry (level "${g.items[0].level || "—"}")?`
                                  : `This group has ${g.items.length} levels. Expand and delete specific levels, or delete all levels together.`,
                              onYes: async () => {
                                if (g.items.length === 1)
                                  return deleteGroup(g.items[0]._id);
                                toggleOpen(g.key);
                              },
                            })
                          }
                        >
                          Delete
                        </button>
                      </div>

                      {isOpen ? (
                        <div
                          style={{ display: "grid", gap: 10, marginTop: 12 }}
                        >
                          {g.items.map((it) => (
                            <div
                              key={it._id}
                              style={{
                                ...mobileNestedCard(T),
                                background: selectedGroupIds.has(it._id)
                                  ? T.activeRow
                                  : !!it.archived
                                    ? T.archiveBg
                                    : T.panelSoft,
                              }}
                            >
                              <div style={mobileCardHead}>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 10,
                                    alignItems: "center",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedGroupIds.has(it._id)}
                                    onChange={() =>
                                      toggleGroupSelection(it._id)
                                    }
                                  />
                                  <div>
                                    <div style={{ fontWeight: 950 }}>
                                      {it.level || "—"}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: T.sub,
                                        marginTop: 4,
                                      }}
                                    >
                                      Group: {g.name}
                                    </div>
                                  </div>
                                </div>
                                <span
                                  style={
                                    it.archived
                                      ? archiveBadge(T)
                                      : activeBadge(T)
                                  }
                                >
                                  {it.archived ? "Archived" : "Active"}
                                </span>
                              </div>

                              <div style={mobileActionGrid}>
                                <button
                                  style={UI.btnGhost}
                                  onClick={() => openEditGroup(it)}
                                  disabled={busy}
                                >
                                  Edit Level
                                </button>
                                <button
                                  style={softBtnSmall(T)}
                                  onClick={() =>
                                    toggleArchiveGroup(it, !it.archived)
                                  }
                                  disabled={busy}
                                >
                                  {it.archived ? "Restore" : "Archive"}
                                </button>
                                <button
                                  style={UI.btnDanger}
                                  onClick={() =>
                                    askConfirm({
                                      title: `Delete "${g.name}"`,
                                      body: `Delete level "${it.level || "—"}"?`,
                                      onYes: () => deleteGroup(it._id),
                                    })
                                  }
                                  disabled={busy}
                                >
                                  Delete Level
                                </button>
                              </div>
                            </div>
                          ))}

                          {g.items.length > 1 ? (
                            <button
                              style={UI.btnDanger}
                              disabled={busy}
                              onClick={() =>
                                askConfirm({
                                  title: `Delete ALL levels for "${g.name}"`,
                                  body: `This will delete ${g.items.length} entries. This cannot be undone.`,
                                  onYes: async () => {
                                    setBusy(true);
                                    setErr("");
                                    setOk("");
                                    try {
                                      for (const it of g.items) {
                                        await api.deleteGroup(it._id);
                                      }
                                      setSelectedGroupIds((prev) => {
                                        const next = new Set(prev);
                                        g.items.forEach((it) =>
                                          next.delete(it._id),
                                        );
                                        return next;
                                      });
                                      await load();
                                      setOk(
                                        `All levels for "${g.name}" deleted.`,
                                      );
                                    } catch (e) {
                                      setErr(
                                        e?.message ||
                                          "Failed to delete all levels",
                                      );
                                    } finally {
                                      setBusy(false);
                                    }
                                  },
                                })
                              }
                            >
                              Delete All Levels
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div style={empty(UI.empty, T)}>
                  No groups match the current filters.
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}

      {tab === "ACTIVITIES" && !scopeRequired ? (
        <section style={card(UI.card, T)}>
          <Header
            title="Activities"
            subtitle="Create, import, batch-manage, archive, sort, and maintain scoring activities"
            total={activities.filter(isVisibleByStatus).length}
            T={T}
          />

          <div style={filterGrid}>
            <div style={{ position: "relative" }}>
              <input
                style={input(UI.input, T, { width: "100%" })}
                placeholder="Filter by activity name"
                value={fActName}
                onChange={(e) => setFActName(e.target.value)}
              />
              {fActName ? (
                <button
                  type="button"
                  style={xBtn(T)}
                  onClick={() => setFActName("")}
                >
                  ✕
                </button>
              ) : null}
            </div>

            <div>
              <select
                style={input(UI.input, T, { width: "100%" })}
                value={aSort}
                onChange={(e) => setASort(e.target.value)}
              >
                <option value="name_asc">Sort: Name A → Z</option>
                <option value="name_desc">Sort: Name Z → A</option>
                <option value="score_asc">Sort: Score Low → High</option>
                <option value="score_desc">Sort: Score High → Low</option>
              </select>
            </div>
          </div>

          {fActName ? (
            <div style={chipRow}>
              <span style={filterChip(T)}>
                Activity: {fActName}
                <button
                  type="button"
                  style={chipX}
                  onClick={() => setFActName("")}
                >
                  ✕
                </button>
              </span>
            </div>
          ) : null}

          <section style={createPanel(T)}>
            <div style={sectionMiniTitle(T)}>Create New Activity</div>

            <div
              className="ra-setup-act-grid"
              style={createGridActResponsive(isMobile, isTablet)}
            >
              <input
                style={input(UI.input, T, { width: "100%" })}
                placeholder="Activity name"
                value={aName}
                onChange={(e) => setAName(e.target.value)}
              />
              <input
                style={input(UI.input, T, { width: "100%" })}
                type="number"
                min="1"
                value={aMax}
                onChange={(e) => setAMax(e.target.value)}
              />
              <button
                style={primaryBtn(UI.btnPrimary)}
                onClick={addActivity}
                disabled={!aName.trim() || busy || loading}
              >
                {busy ? "Saving..." : "+ Add Activity"}
              </button>
            </div>
          </section>

          {selectedActivityIds.size > 0 ? (
            <div style={bulkBar(T)}>
              <div style={{ fontWeight: 900 }}>
                Selected activities: <b>{selectedActivityIds.size}</b>
              </div>

              <div style={bulkActions}>
                <button
                  type="button"
                  style={softBtn(T)}
                  onClick={() => bulkArchiveActivities(true)}
                  disabled={busy}
                >
                  Archive Selected
                </button>

                <button
                  type="button"
                  style={softBtn(T)}
                  onClick={() => bulkArchiveActivities(false)}
                  disabled={busy}
                >
                  Restore Selected
                </button>

                <button
                  type="button"
                  style={UI.btnDanger}
                  onClick={() =>
                    askConfirm({
                      title: "Delete selected activities",
                      body: `Delete ${selectedActivityIds.size} selected activities? This cannot be undone.`,
                      onYes: bulkDeleteActivities,
                    })
                  }
                  disabled={busy}
                >
                  Delete Selected
                </button>
              </div>
            </div>
          ) : null}

          {!isMobile ? (
            <div style={tableWrap(UI.table, T)}>
              <div
                className="ra-setup-table-head"
                style={{ ...thead(UI.thead, T), ...gridColsActEnhanced }}
              >
                <div>
                  <input
                    type="checkbox"
                    checked={
                      allVisibleActivityIds.length > 0 &&
                      selectedVisibleActivityCount ===
                        allVisibleActivityIds.length
                    }
                    onChange={toggleSelectAllVisibleActivities}
                  />
                </div>
                <div>Name</div>
                <div>Max Score</div>
                <div>Status</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              {loading ? (
                <SkeletonRows T={T} rows={6} cols={4} />
              ) : filteredActivities.length ? (
                filteredActivities.map((a) => (
                  <div
                    key={a._id}
                    style={{
                      ...trow(UI.trow, T),
                      ...gridColsActEnhanced,
                      background: selectedActivityIds.has(a._id)
                        ? T.activeRow
                        : !!a.archived
                          ? T.archiveBg
                          : "transparent",
                    }}
                  >
                    <div style={{ display: "grid", placeItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedActivityIds.has(a._id)}
                        onChange={() => toggleActivitySelection(a._id)}
                      />
                    </div>

                    <div
                      style={{ fontWeight: 950, textTransform: "uppercase" }}
                    >
                      {a.name}
                    </div>
                    <div style={{ opacity: 0.88 }}>{a.maxScore ?? 10}</div>
                    <div>
                      {!!a.archived ? (
                        <span style={archiveBadge(T)}>Archived</span>
                      ) : (
                        <span style={activeBadge(T)}>Active</span>
                      )}
                    </div>

                    <div className="ra-setup-actions" style={actions}>
                      <button
                        style={UI.btnGhost}
                        onClick={() => openEditActivity(a)}
                        disabled={busy}
                      >
                        Edit
                      </button>

                      <button
                        style={softBtnSmall(T)}
                        onClick={() => toggleArchiveActivity(a, !a.archived)}
                        disabled={busy}
                      >
                        {a.archived ? "Restore" : "Archive"}
                      </button>

                      <button
                        style={UI.btnDanger}
                        onClick={() =>
                          askConfirm({
                            title: `Delete "${a.name}"`,
                            body: "Delete this activity? This cannot be undone.",
                            onYes: () => deleteActivity(a._id),
                          })
                        }
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={empty(UI.empty, T)}>
                  No activities match the current filters.
                </div>
              )}
            </div>
          ) : (
            <div style={mobileListWrap}>
              {loading ? (
                <SkeletonCardsMobile T={T} count={4} />
              ) : filteredActivities.length ? (
                filteredActivities.map((a) => (
                  <div
                    key={a._id}
                    style={{
                      ...mobileGroupCard(T),
                      background: selectedActivityIds.has(a._id)
                        ? T.activeRow
                        : !!a.archived
                          ? T.archiveBg
                          : T.cardBg,
                    }}
                  >
                    <div style={mobileCardHead}>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedActivityIds.has(a._id)}
                          onChange={() => toggleActivitySelection(a._id)}
                        />
                        <div>
                          <div
                            style={{
                              fontWeight: 950,
                              textTransform: "uppercase",
                            }}
                          >
                            {a.name}
                          </div>
                          <div
                            style={{ fontSize: 12, color: T.sub, marginTop: 4 }}
                          >
                            Max Score: {a.maxScore ?? 10}
                          </div>
                        </div>
                      </div>

                      <span
                        style={a.archived ? archiveBadge(T) : activeBadge(T)}
                      >
                        {a.archived ? "Archived" : "Active"}
                      </span>
                    </div>

                    <div style={mobileActionGrid}>
                      <button
                        style={UI.btnGhost}
                        onClick={() => openEditActivity(a)}
                        disabled={busy}
                      >
                        Edit
                      </button>

                      <button
                        style={softBtnSmall(T)}
                        onClick={() => toggleArchiveActivity(a, !a.archived)}
                        disabled={busy}
                      >
                        {a.archived ? "Restore" : "Archive"}
                      </button>

                      <button
                        style={UI.btnDanger}
                        onClick={() =>
                          askConfirm({
                            title: `Delete "${a.name}"`,
                            body: "Delete this activity? This cannot be undone.",
                            onYes: () => deleteActivity(a._id),
                          })
                        }
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={empty(UI.empty, T)}>
                  No activities match the current filters.
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}

      {edit ? (
        <EditModal
          T={T}
          UI={UI}
          edit={edit}
          allGroups={groups}
          allActivities={activities}
          onClose={closeModals}
          onSave={async (patch) => {
            if (edit.type === "group") return updateGroup(edit.doc, patch);
            return updateActivity(edit.doc, patch);
          }}
          setErr={setErr}
          busy={busy}
        />
      ) : null}

      {confirmState ? (
        <ConfirmModal
          T={T}
          UI={UI}
          title={confirmState.title}
          body={confirmState.body}
          busy={busy}
          onClose={() => setConfirmState(null)}
          onYes={async () => {
            setConfirmState(null);
            await confirmState.onYes?.();
          }}
        />
      ) : null}

      {importState ? (
        <ImportModal
          T={T}
          type={importState.type}
          groups={groups}
          activities={activities}
          busy={busy}
          setBusy={setBusy}
          setErr={setErr}
          setOk={setOk}
          onClose={closeModals}
          onDone={load}
        />
      ) : null}
    </div>
  );
}

function Header({ title, subtitle, total, T }) {
  return (
    <div style={sectionHeader}>
      <div>
        <h3 style={{ ...UI.h3, color: T.text, marginBottom: 6 }}>{title}</h3>
        <div style={{ ...UI.sub, color: T.sub }}>{subtitle}</div>
      </div>
      <div style={pill(T)}>Total: {total}</div>
    </div>
  );
}

function StatCard({ title, value, hint, T }) {
  return (
    <div style={statCard(T)}>
      <div style={{ fontSize: 12, color: T.sub, fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 950, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: T.sub, marginTop: 6 }}>{hint}</div>
    </div>
  );
}

function SkeletonRows({ T, rows = 6, cols = 4 }) {
  const template =
    cols === 3
      ? "36px minmax(220px,2fr) minmax(160px,2fr) minmax(90px,1fr) auto"
      : "36px minmax(220px,2fr) minmax(100px,1fr) minmax(90px,1fr) auto";

  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: template,
            columnGap: 16,
            padding: "12px 14px",
            borderBottom: `1px solid ${T.rowBorder}`,
          }}
        >
          <div style={{ ...sk(T), width: 18 }} />
          <div style={sk(T)} />
          <div style={sk(T)} />
          <div style={sk(T)} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <div style={{ ...sk(T), width: 72 }} />
            <div style={{ ...sk(T), width: 72 }} />
          </div>
        </div>
      ))}
    </>
  );
}

function SkeletonCardsMobile({ T, count = 4 }) {
  return (
    <div style={mobileListWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={mobileGroupCard(T)}>
          <div style={{ ...sk(T), height: 16, width: "50%" }} />
          <div style={{ ...sk(T), marginTop: 12, height: 12, width: "70%" }} />
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <div style={{ ...sk(T), height: 34 }} />
            <div style={{ ...sk(T), height: 34 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EditModal({
  T,
  UI,
  edit,
  allGroups,
  allActivities,
  onClose,
  onSave,
  setErr,
  busy,
}) {
  const isGroup = edit.type === "group";
  const [name, setName] = useState(() => String(edit.doc?.name || ""));
  const [level, setLevel] = useState(() => String(edit.doc?.level || ""));
  const [maxScore, setMaxScore] = useState(() =>
    Number(edit.doc?.maxScore ?? 10),
  );

  return (
    <div style={overlay(T)} onMouseDown={onClose}>
      <div style={modal(T)} onMouseDown={(e) => e.stopPropagation()}>
        <div style={modalHead}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>
            Edit {isGroup ? "Group" : "Activity"}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={xIconBtn(T)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gap: 12 }}>
          <label style={lbl}>
            <div style={lblT(T)}>Name</div>
            <input
              style={input(UI.input, T)}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {isGroup ? (
            <label style={lbl}>
              <div style={lblT(T)}>Level (optional)</div>
              <input
                style={input(UI.input, T)}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
            </label>
          ) : (
            <label style={lbl}>
              <div style={lblT(T)}>Max Score</div>
              <input
                style={input(UI.input, T)}
                type="number"
                min="1"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </label>
          )}
        </div>

        <div style={{ height: 16 }} />

        <div style={modalActions}>
          <button
            type="button"
            style={softBtn(T)}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            style={primaryBtn(UI.btnPrimary)}
            disabled={busy || !String(name || "").trim()}
            onClick={async () => {
              const cleanName = String(name || "").trim();

              if (isGroup) {
                const cleanLevel = String(level || "").trim();
                const dup = allGroups.some(
                  (g) =>
                    g._id !== edit.doc._id &&
                    String(g.name || "")
                      .trim()
                      .toLowerCase() === cleanName.toLowerCase() &&
                    String(g.level || "")
                      .trim()
                      .toLowerCase() === cleanLevel.toLowerCase(),
                );
                if (dup) {
                  setErr(
                    "Another group with the same name and level already exists.",
                  );
                  return;
                }

                await onSave({
                  name: cleanName,
                  level: cleanLevel || "",
                });
              } else {
                const dup = allActivities.some(
                  (a) =>
                    a._id !== edit.doc._id &&
                    String(a.name || "")
                      .trim()
                      .toLowerCase() === cleanName.toLowerCase(),
                );
                if (dup) {
                  setErr("Another activity with the same name already exists.");
                  return;
                }

                await onSave({
                  name: cleanName,
                  maxScore: Number(maxScore || 10),
                });
              }

              onClose();
            }}
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ T, UI, title, body, onClose, onYes, busy }) {
  return (
    <div style={overlay(T)} onMouseDown={onClose}>
      <div style={modal(T)} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 950, fontSize: 16 }}>{title}</div>
        <div
          style={{
            marginTop: 8,
            color: T.sub,
            fontWeight: 800,
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>

        <div style={{ height: 16 }} />

        <div style={modalActions}>
          <button
            type="button"
            style={softBtn(T)}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            style={UI.btnDanger}
            onClick={onYes}
            disabled={busy}
          >
            {busy ? "Working..." : "Yes, Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({
  T,
  type,
  groups,
  activities,
  busy,
  setBusy,
  setErr,
  setOk,
  onClose,
  onDone,
}) {
  const isGroup = type === "group";
  const [raw, setRaw] = useState(
    isGroup ? "name,level\nGroup A,Level 1" : "name,maxScore\nVault,10",
  );
  const [fileName, setFileName] = useState("");

  function parseCsv(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(",").map((x) => x.trim()));
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = String(file.name || "").toLowerCase();
    if (!lower.endsWith(".csv") && file.type !== "text/csv") {
      setErr("Please upload a valid CSV file.");
      return;
    }

    try {
      const text = await file.text();
      setRaw(text);
      setFileName(file.name || "uploaded.csv");
      setErr("");
    } catch {
      setErr("Failed to read CSV file.");
    } finally {
      e.target.value = "";
    }
  }

  const preview = useMemo(() => {
    const rows = parseCsv(raw);
    if (!rows.length) return { valid: [], skipped: [], errors: [] };

    const hasHeader = rows[0]?.[0]?.toLowerCase?.() === "name";
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const valid = [];
    const skipped = [];
    const errors = [];

    dataRows.forEach((r, idx) => {
      if (isGroup) {
        const name = String(r[0] || "").trim();
        const level = String(r[1] || "").trim();

        if (!name) {
          errors.push(`Row ${idx + 1}: Missing group name`);
          return;
        }

        const exists = groups.some(
          (g) =>
            String(g.name || "")
              .trim()
              .toLowerCase() === name.toLowerCase() &&
            String(g.level || "")
              .trim()
              .toLowerCase() === level.toLowerCase(),
        );

        if (exists) {
          skipped.push(`${name} / ${level || "—"} already exists`);
          return;
        }

        valid.push({ name, level });
      } else {
        const name = String(r[0] || "").trim();
        const maxScore = Number(r[1] || 10);

        if (!name) {
          errors.push(`Row ${idx + 1}: Missing activity name`);
          return;
        }

        const exists = activities.some(
          (a) =>
            String(a.name || "")
              .trim()
              .toLowerCase() === name.toLowerCase(),
        );

        if (exists) {
          skipped.push(`${name} already exists`);
          return;
        }

        valid.push({
          name,
          maxScore: Number.isFinite(maxScore) ? maxScore : 10,
        });
      }
    });

    return { valid, skipped, errors };
  }, [raw, isGroup, groups, activities]);

  async function runImport() {
    if (!preview.valid.length) {
      setErr("No valid rows to import.");
      return;
    }

    setBusy(true);
    setErr("");
    setOk("");

    try {
      for (const row of preview.valid) {
        if (isGroup) {
          await api.createGroup({
            name: row.name,
            level: row.level || "",
          });
        } else {
          await api.createActivity({
            name: row.name,
            maxScore: row.maxScore,
          });
        }
      }

      await onDone();
      setOk(
        isGroup
          ? `${preview.valid.length} group rows imported successfully.`
          : `${preview.valid.length} activities imported successfully.`,
      );
      onClose();
    } catch (e) {
      setErr(e?.message || "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay(T)} onMouseDown={onClose}>
      <div style={modalWide(T)} onMouseDown={(e) => e.stopPropagation()}>
        <div style={modalHead}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>
            Bulk Import {isGroup ? "Groups" : "Activities"}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={xIconBtn(T)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            color: T.sub,
            fontWeight: 800,
            lineHeight: 1.5,
          }}
        >
          Upload a CSV file or paste CSV content below. Header row is optional.
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
          <div style={uploadBar(T)}>
            <label style={uploadBtn(T)}>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                style={{ display: "none" }}
              />
              Upload CSV File
            </label>

            <div style={{ color: T.sub, fontSize: 12, fontWeight: 800 }}>
              {fileName ? `Loaded: ${fileName}` : "No file selected"}
            </div>
          </div>

          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            style={textareaStyle(T)}
            rows={12}
          />

          <div style={importPreviewBox(T)}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Preview</div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <span style={activeBadge(T)}>Valid: {preview.valid.length}</span>
              <span style={archiveBadge(T)}>
                Skipped: {preview.skipped.length}
              </span>
              <span style={mixedBadge(T)}>Errors: {preview.errors.length}</span>
            </div>

            {preview.errors.length ? (
              <div style={previewList(T)}>
                {preview.errors.slice(0, 8).map((x, i) => (
                  <div key={i}>• {x}</div>
                ))}
              </div>
            ) : null}

            {preview.skipped.length ? (
              <div style={{ ...previewList(T), marginTop: 8 }}>
                {preview.skipped.slice(0, 8).map((x, i) => (
                  <div key={i}>• {x}</div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div style={modalActions}>
          <button
            type="button"
            style={softBtn(T)}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            style={primaryBtn(UI.btnPrimary)}
            onClick={runImport}
            disabled={busy || !preview.valid.length}
          >
            {busy ? "Importing..." : `Import ${preview.valid.length} rows`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- styles -------------------- */

function StyleTag() {
  return (
    <style>{`
      @media (max-width: 980px){
        .ra-setup-actions{
          justify-content: flex-start !important;
          min-width: 0 !important;
        }
      }

      @media (max-width: 860px){
        .ra-setup-group-grid,
        .ra-setup-act-grid{
          grid-template-columns: 1fr !important;
        }
      }

      @media (max-width: 720px){
        .ra-setup-table-head{
          display: none !important;
        }
      }
    `}</style>
  );
}

function card(base, T) {
  return {
    ...base,
    background: T.cardBg,
    border: `1px solid ${T.cardBorder}`,
    color: T.text,
    boxShadow: T.cardShadow,
    borderRadius: 24,
  };
}

function input(base, T, extra = {}) {
  return {
    ...base,
    ...extra,
    background: T.inputBg,
    border: `1px solid ${T.inputBorder}`,
    color: T.text,
    outline: "none",
    minHeight: 46,
  };
}

function tableWrap(base, T) {
  return {
    ...base,
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    borderRadius: 18,
    border: `1px solid ${T.rowBorder}`,
    background: "transparent",
    marginTop: 6,
  };
}

function thead(base, T) {
  return {
    ...base,
    background: T.headBg,
    borderBottom: `1px solid ${T.rowBorder}`,
    color: T.sub,
    fontWeight: 900,
  };
}

function trow(base, T) {
  return {
    ...base,
    background: "transparent",
    color: T.text,
    borderBottom: `1px solid ${T.rowBorder}`,
    alignItems: "center",
  };
}

function empty(base, T) {
  return {
    ...base,
    color: T.sub,
    background: "transparent",
  };
}

const topShell = (T) => ({
  display: "grid",
  gap: 14,
  padding: 18,
  borderRadius: 26,
  border: `1px solid ${T.cardBorder}`,
  background: T.bgTop,
  boxShadow: T.shadow,
});

const academyScopeBar = (T) => ({
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  padding: 14,
  borderRadius: 18,
  background: T.panelSoft,
  border: `1px solid ${T.cardBorder}`,
});

const academyScopeMetaWrap = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const scopePill = (T) => ({
  padding: "8px 12px",
  borderRadius: 999,
  background: T.softBtnBg,
  border: `1px solid ${T.softBtnBorder}`,
  fontSize: 12,
  fontWeight: 900,
  color: T.text,
});

const scopeRequiredCard = (T) => ({
  padding: 18,
  borderRadius: 22,
  border: `1px solid ${T.warnBorder}`,
  background: T.warnBg,
  color: T.text,
});

const topHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
};

const summaryRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const summaryPill = (T) => ({
  padding: "8px 12px",
  borderRadius: 999,
  background: T.panelSoft,
  border: `1px solid ${T.cardBorder}`,
  fontSize: 12,
  fontWeight: 900,
});

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const statCard = (T) => ({
  padding: 16,
  borderRadius: 18,
  border: `1px solid ${T.statBorder}`,
  background: T.statBg,
});

const eyebrow = {
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: RED,
  marginBottom: 6,
};

const tabRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const metaText = (T) => ({
  fontWeight: 900,
  opacity: 0.8,
  color: T.text,
});

const statusSelect = (T) => ({
  height: 40,
  padding: "0 14px",
  borderRadius: 999,
  border: `1px solid ${T.softBtnBorder}`,
  background: T.softBtnBg,
  color: T.text,
  fontWeight: 900,
  cursor: "pointer",
});

const filterGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  marginTop: 14,
  marginBottom: 14,
};

const chipRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 12,
};

const filterChip = (T) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  background: T.pillBg,
  border: `1px solid ${T.pillBorder}`,
  fontSize: 12,
  fontWeight: 900,
  color: RED,
});

const chipX = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 900,
  color: "inherit",
};

const createPanel = (T) => ({
  padding: 14,
  borderRadius: 18,
  border: `1px solid ${T.cardBorder}`,
  background: T.panelSoft,
  marginBottom: 14,
});

const sectionMiniTitle = (T) => ({
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: T.sub,
  marginBottom: 12,
});

function createGridResponsive(isMobile, isTablet) {
  if (isMobile) {
    return { display: "grid", gridTemplateColumns: "1fr", gap: 10 };
  }
  if (isTablet) {
    return { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
  }
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr)) auto",
    gap: 10,
  };
}

function createGridActResponsive(isMobile, isTablet) {
  if (isMobile) {
    return { display: "grid", gridTemplateColumns: "1fr", gap: 10 };
  }
  if (isTablet) {
    return { display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 };
  }
  return {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 140px auto",
    gap: 10,
  };
}

const bulkBar = (T) => ({
  marginBottom: 14,
  padding: 12,
  borderRadius: 16,
  border: `1px solid ${T.warnBorder}`,
  background: T.warnBg,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
});

const bulkActions = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const gridColsGroupEnhanced = {
  gridTemplateColumns:
    "36px minmax(220px,2fr) minmax(160px,2fr) minmax(90px,1fr) auto",
  columnGap: 16,
};

const gridColsActEnhanced = {
  gridTemplateColumns:
    "36px minmax(220px,2fr) minmax(100px,1fr) minmax(90px,1fr) auto",
  columnGap: 16,
};

const actions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 220,
};

const mobileListWrap = {
  display: "grid",
  gap: 12,
};

const mobileGroupCard = (T) => ({
  borderRadius: 18,
  border: `1px solid ${T.rowBorder}`,
  padding: 14,
  boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
});

const mobileNestedCard = (T) => ({
  borderRadius: 14,
  border: `1px solid ${T.rowBorder}`,
  padding: 12,
});

const mobileCardHead = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

const mobileBadgeRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const mobileActionGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
  marginTop: 12,
};

const pill = (T) => ({
  padding: "8px 12px",
  borderRadius: 999,
  background: T.pillBg,
  border: `1px solid ${T.pillBorder}`,
  fontWeight: 950,
  fontSize: 12,
  color: RED,
});

function tabBtn(active, T) {
  return {
    height: 40,
    padding: "0 16px",
    borderRadius: 999,
    border: `1px solid ${active ? "rgba(225,29,46,0.28)" : T.softBtnBorder}`,
    background: active ? "rgba(255,241,242,0.95)" : T.softBtnBg,
    color: active ? RED : T.text,
    fontWeight: 950,
    cursor: "pointer",
  };
}

function softBtn(T) {
  return {
    height: 40,
    padding: "0 14px",
    borderRadius: 999,
    border: `1px solid ${T.softBtnBorder}`,
    background: T.softBtnBg,
    color: T.text,
    fontWeight: 950,
    cursor: "pointer",
  };
}

function softBtnSmall(T) {
  return {
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${T.softBtnBorder}`,
    background: T.softBtnBg,
    color: T.text,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function primaryBtn(base) {
  return {
    ...base,
    height: 42,
    whiteSpace: "nowrap",
  };
}

function successBanner(T) {
  return {
    padding: "12px 14px",
    borderRadius: 16,
    border: `1px solid ${T.successBorder}`,
    background: T.successBg,
    color: T.successText,
    fontWeight: 900,
  };
}

function errorBanner(T) {
  return {
    padding: "12px 14px",
    borderRadius: 16,
    border: `1px solid ${T.dangerBorder}`,
    background: T.dangerBg,
    color: RED,
    fontWeight: 900,
  };
}

function xBtn(T) {
  return {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    height: 26,
    width: 26,
    borderRadius: 10,
    border: `1px solid ${T.inputBorder}`,
    background: "transparent",
    color: T.sub,
    cursor: "pointer",
    fontWeight: 950,
  };
}

function chevBtn(T) {
  return {
    width: 30,
    height: 30,
    borderRadius: 10,
    border: `1px solid ${T.softBtnBorder}`,
    background: T.softBtnBg,
    color: T.text,
    cursor: "pointer",
    fontWeight: 950,
    flexShrink: 0,
  };
}

function countPill(T) {
  return {
    fontSize: 12,
    fontWeight: 950,
    padding: "2px 10px",
    borderRadius: 999,
    border: `1px solid ${T.softBtnBorder}`,
    background: T.softBtnBg,
    color: T.sub,
    flexShrink: 0,
  };
}

function levelRow(T) {
  return {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    border: `1px solid ${T.rowBorder}`,
    marginTop: 8,
    alignItems: "center",
  };
}

function activeBadge(T) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    color: T.successText,
    background: T.successBg,
    border: `1px solid ${T.successBorder}`,
  };
}

function archiveBadge(T) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    color: T.sub,
    background: T.archiveBg,
    border: `1px solid ${T.cardBorder}`,
  };
}

function mixedBadge(T) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    color: T.warnText,
    background: T.warnBg,
    border: `1px solid ${T.warnBorder}`,
  };
}

function overlay(T) {
  return {
    position: "fixed",
    inset: 0,
    background: T.overlay,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10000,
  };
}

function modal(T) {
  return {
    width: "min(560px, 100%)",
    borderRadius: 20,
    border: `1px solid ${T.cardBorder}`,
    background: T.modalBg,
    padding: 16,
    boxShadow: "0 24px 70px rgba(0,0,0,0.30)",
    backdropFilter: "blur(12px)",
    color: T.text,
  };
}

function modalWide(T) {
  return {
    width: "min(760px, 100%)",
    borderRadius: 20,
    border: `1px solid ${T.cardBorder}`,
    background: T.modalBg,
    padding: 16,
    boxShadow: "0 24px 70px rgba(0,0,0,0.30)",
    backdropFilter: "blur(12px)",
    color: T.text,
  };
}

const modalHead = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const modalActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

function xIconBtn(T) {
  return {
    height: 34,
    width: 34,
    borderRadius: 12,
    border: `1px solid ${T.softBtnBorder}`,
    background: T.softBtnBg,
    color: T.text,
    cursor: "pointer",
    fontWeight: 950,
  };
}

function textareaStyle(T) {
  return {
    width: "100%",
    minHeight: 240,
    resize: "vertical",
    padding: 12,
    borderRadius: 16,
    border: `1px solid ${T.inputBorder}`,
    background: T.inputBg,
    color: T.text,
    outline: "none",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
  };
}

function importPreviewBox(T) {
  return {
    padding: 12,
    borderRadius: 16,
    border: `1px solid ${T.cardBorder}`,
    background: T.panelSoft,
  };
}

function previewList(T) {
  return {
    display: "grid",
    gap: 4,
    color: T.sub,
    fontSize: 12,
    fontWeight: 700,
  };
}

function uploadBar(T) {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${T.cardBorder}`,
    background: T.panelSoft,
  };
}

function uploadBtn(T) {
  return {
    height: 38,
    padding: "0 14px",
    borderRadius: 999,
    border: `1px solid ${T.softBtnBorder}`,
    background: T.softBtnBg,
    color: T.text,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  };
}

const lbl = { display: "grid", gap: 6 };

function lblT(T) {
  return {
    fontWeight: 950,
    color: T.sub,
    fontSize: 12,
  };
}

function sk(T) {
  const dark = String(T.text || "").includes("255");
  return {
    height: 14,
    borderRadius: 999,
    background: dark ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.10)",
  };
}
