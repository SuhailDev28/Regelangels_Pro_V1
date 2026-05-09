import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io as ioClient } from "socket.io-client";
import { api } from "../../lib/api.js";

const ROTATE_MS = 10000;
const FALLBACK_REFRESH_MS = 60000;
const NUM_TWEEN_MS = 650;
const ROW_HIGHLIGHT_MS = 1400;
const FLIP_MS = 520;
const TICKER_MS = 3500;

const RED = "#e11d2e";
const GOLD = "#f59e0b";
const SILVER = "#94a3b8";
const BRONZE = "#b45309";

export default function LeaderboardTV() {
  const [groups, setGroups] = useState([]);
  const [groupIndex, setGroupIndex] = useState(0);

  const [data, setData] = useState({
    activities: [],
    rows: [],
    medalsByActivity: {},
  });

  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [err, setErr] = useState("");

  const [hotIds, setHotIds] = useState(() => new Set());
  const [now, setNow] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440,
  );
  const [reducedMotion, setReducedMotion] = useState(false);

  const mountedRef = useRef(true);
  const socketRef = useRef(null);
  const requestSeqRef = useRef(0);
  const wrapRef = useRef(null);
  const touchRef = useRef({ startX: 0, startY: 0, active: false });

  const timersRef = useRef({
    rotate: null,
    fallback: null,
    hotClear: null,
    clock: null,
    ticker: null,
    interactClear: null,
  });

  const groupIndexRef = useRef(0);
  const activeGroupIdRef = useRef("");

  const rowElsRef = useRef(new Map());
  const prevTopsRef = useRef(new Map());
  const prevSnapshotRef = useRef(new Map());

  const activeGroup = useMemo(
    () => groups[groupIndex] || null,
    [groups, groupIndex],
  );

  useEffect(() => {
    groupIndexRef.current = groupIndex;
  }, [groupIndex]);

  useEffect(() => {
    activeGroupIdRef.current = activeGroup?._id ? String(activeGroup._id) : "";
  }, [activeGroup?._id]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(!!mq.matches);
    apply();

    try {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } catch {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  useEffect(() => {
    function onResize() {
      setViewportWidth(window.innerWidth || 1440);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onFs() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const isMobile = viewportWidth <= 700;
  const isTablet = viewportWidth > 700 && viewportWidth <= 1100;
  const isCompact = viewportWidth <= 900;

  const groupLabel = useMemo(() => {
    if (!activeGroup) return "—";
    return `${activeGroup.name}${activeGroup.level ? ` (${activeGroup.level})` : ""}`;
  }, [activeGroup]);

  const cols = useMemo(() => {
    return Array.isArray(data?.activities) ? data.activities : [];
  }, [data]);

  const rows = useMemo(() => {
    const safeRows = Array.isArray(data?.rows) ? data.rows : [];
    return safeRows;
  }, [data]);

  const gridTemplate = useMemo(() => {
    if (isTablet) {
      return `74px minmax(240px,1.3fr) repeat(${Math.max(cols.length, 1)}, minmax(118px,1fr)) 132px`;
    }
    return `90px minmax(340px,1.5fr) repeat(${Math.max(cols.length, 1)}, minmax(160px,1fr)) 180px`;
  }, [cols.length, isTablet]);

  const stats = useMemo(() => {
    const count = rows.length;
    const avg = count
      ? rows.reduce((s, r) => s + Number(r?.total ?? 0), 0) / count
      : 0;
    const top = count ? Math.max(...rows.map((r) => Number(r?.total ?? 0))) : 0;
    return { count, avg, top };
  }, [rows]);

  const podium = useMemo(() => rows.slice(0, 3), [rows]);

  const tickerItems = useMemo(() => {
    const items = [];
    if (podium[0])
      items.push(`Leader: ${podium[0].name} • ${num(podium[0].total)}`);
    if (podium[1])
      items.push(`2nd: ${podium[1].name} • ${num(podium[1].total)}`);
    if (podium[2])
      items.push(`3rd: ${podium[2].name} • ${num(podium[2].total)}`);
    if (activeGroup) items.push(`Group: ${groupLabel}`);
    items.push(`Participants: ${stats.count}`);
    items.push(`Average: ${num(stats.avg)}`);
    items.push(`Top Score: ${num(stats.top)}`);
    return items.length ? items : ["Live leaderboard"];
  }, [podium, activeGroup, groupLabel, stats]);

  const socketUrl = useMemo(() => {
    const b = String(import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
    if (!b) {
      return typeof window !== "undefined" ? window.location.origin : "";
    }
    return b.replace(/\/api\/?$/, "");
  }, []);

  const medalsLookup = useMemo(() => {
    const map = {};
    for (const activity of cols) {
      const medal = data?.medalsByActivity?.[activity?._id];
      if (!medal) continue;
      if (medal.gold) map[`${medal.gold}_${activity._id}`] = "G";
      if (medal.silver) map[`${medal.silver}_${activity._id}`] = "S";
      if (medal.bronze) map[`${medal.bronze}_${activity._id}`] = "B";
    }
    return map;
  }, [cols, data?.medalsByActivity]);

  const markInteraction = useCallback(() => {
    setIsInteracting(true);
    if (timersRef.current.interactClear) {
      clearTimeout(timersRef.current.interactClear);
    }
    timersRef.current.interactClear = setTimeout(() => {
      if (!mountedRef.current) return;
      setIsInteracting(false);
    }, 4000);
  }, []);

  const rotateNext = useCallback(() => {
    setGroupIndex((i) => (groups.length ? (i + 1) % groups.length : 0));
  }, [groups.length]);

  const rotatePrev = useCallback(() => {
    setGroupIndex((i) => {
      if (!groups.length) return 0;
      return i === 0 ? groups.length - 1 : i - 1;
    });
  }, [groups.length]);

  const normalizeTotals = useCallback((totals) => {
    const activities = Array.isArray(totals?.activities)
      ? totals.activities
      : [];
    const rowsRaw = Array.isArray(totals?.rows) ? totals.rows : [];
    const medalsByActivity =
      totals?.medalsByActivity && typeof totals.medalsByActivity === "object"
        ? totals.medalsByActivity
        : {};

    const normalizedRows = [...rowsRaw]
      .map((r, i) => ({
        ...r,
        participantId:
          r?.participantId ||
          r?._id ||
          r?.id ||
          r?.participant?._id ||
          `row-${i}`,
        name:
          r?.name ||
          r?.participantName ||
          r?.participant?.name ||
          "Participant",
        total: Number(r?.total ?? 0),
        byActivity:
          r?.byActivity && typeof r.byActivity === "object" ? r.byActivity : {},
        medals:
          r?.medals && typeof r.medals === "object"
            ? r.medals
            : { G: 0, S: 0, B: 0 },
      }))
      .sort((a, b) => Number(b.total ?? 0) - Number(a.total ?? 0))
      .map((r, i) => ({
        ...r,
        rank: Number(r?.rank || i + 1),
      }));

    return {
      activities,
      rows: normalizedRows,
      medalsByActivity,
    };
  }, []);

  const loadGroupsOnce = useCallback(async () => {
    const gs = (await api.publicGroups()) || [];
    const safe = Array.isArray(gs) ? gs : [];
    if (!mountedRef.current) return safe;

    setGroups(safe);
    setGroupIndex((i) => (safe.length ? Math.min(i, safe.length - 1) : 0));
    return safe;
  }, []);

  const loadTotalsForGroup = useCallback(
    async (gid, { silent = false } = {}) => {
      if (!gid) {
        if (!mountedRef.current) return;
        setData({ activities: [], rows: [], medalsByActivity: {} });
        setTableLoading(false);
        return;
      }

      const reqId = ++requestSeqRef.current;

      if (mountedRef.current) {
        if (!silent) setLoading(true);
        else setTableLoading(true);
        setErr("");
      }

      try {
        const totals = await api.publicTotalsByGroup(gid);
        if (!mountedRef.current) return;
        if (reqId !== requestSeqRef.current) return;

        setData(
          normalizeTotals(
            totals || {
              activities: [],
              rows: [],
              medalsByActivity: {},
            },
          ),
        );
        setLastUpdated(new Date());
      } catch (e) {
        if (!mountedRef.current) return;
        if (reqId !== requestSeqRef.current) return;
        setErr(e?.message || "Failed to load leaderboard");
      } finally {
        if (!mountedRef.current) return;
        if (reqId !== requestSeqRef.current) return;
        if (!silent) setLoading(false);
        setTableLoading(false);
      }
    },
    [normalizeTotals],
  );

  const hardRefreshAll = useCallback(
    async ({ silent = false } = {}) => {
      if (mountedRef.current) {
        if (!silent) setLoading(true);
        setErr("");
      }

      try {
        const gs = await loadGroupsOnce();
        const idx = groupIndexRef.current || 0;
        const g = gs[idx] || gs[0] || null;
        await loadTotalsForGroup(g?._id || "", { silent: true });
      } catch (e) {
        if (!mountedRef.current) return;
        setErr(e?.message || "Failed to load leaderboard");
      } finally {
        if (!mountedRef.current) return;
        if (!silent) setLoading(false);
      }
    },
    [loadGroupsOnce, loadTotalsForGroup],
  );

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const gs = await loadGroupsOnce();
        const first = gs?.[0] || null;
        await loadTotalsForGroup(first?._id || "", { silent: true });
      } catch (e) {
        if (!mountedRef.current) return;
        setErr(e?.message || "Failed to load leaderboard");
      } finally {
        if (!mountedRef.current) return;
        setLoading(false);
      }
    })();

    const s = ioClient(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      autoConnect: true,
    });

    socketRef.current = s;

    const joinActiveRoom = () => {
      const gid = activeGroupIdRef.current;
      if (gid) s.emit("leaderboard:join", { groupId: gid });
    };

    const handleConnect = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      joinActiveRoom();
    };

    const handleDisconnect = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
    };

    const handleConnectError = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
    };

    const onUpdate = (payload) => {
      const gid = activeGroupIdRef.current;
      if (!gid) return;
      if (!payload?.groupId) return;
      if (String(payload.groupId) !== String(gid)) return;
      loadTotalsForGroup(gid, { silent: true });
    };

    s.on("connect", handleConnect);
    s.on("disconnect", handleDisconnect);
    s.on("connect_error", handleConnectError);
    s.on("leaderboard:update", onUpdate);

    timersRef.current.clock = setInterval(() => {
      if (!mountedRef.current) return;
      setNow(new Date());
    }, 1000);

    timersRef.current.ticker = setInterval(() => {
      if (!mountedRef.current) return;
      if (document.visibilityState === "hidden") return;
      if (isInteracting) return;
      setTickerIndex((i) =>
        tickerItems.length ? (i + 1) % tickerItems.length : 0,
      );
    }, TICKER_MS);

    return () => {
      mountedRef.current = false;

      if (timersRef.current.rotate) clearInterval(timersRef.current.rotate);
      if (timersRef.current.fallback) clearInterval(timersRef.current.fallback);
      if (timersRef.current.hotClear) clearTimeout(timersRef.current.hotClear);
      if (timersRef.current.clock) clearInterval(timersRef.current.clock);
      if (timersRef.current.ticker) clearInterval(timersRef.current.ticker);
      if (timersRef.current.interactClear)
        clearTimeout(timersRef.current.interactClear);

      try {
        const gid = activeGroupIdRef.current;
        if (gid) s.emit("leaderboard:leave", { groupId: gid });
      } catch {
        // noop
      }

      try {
        s.off("connect", handleConnect);
        s.off("disconnect", handleDisconnect);
        s.off("connect_error", handleConnectError);
        s.off("leaderboard:update", onUpdate);
        s.disconnect();
      } catch {
        // noop
      }

      socketRef.current = null;
    };
  }, [
    socketUrl,
    loadGroupsOnce,
    loadTotalsForGroup,
    tickerItems.length,
    isInteracting,
  ]);

  useEffect(() => {
    if (!groups.length) return;
    if (!autoRotate) return;

    const tick = () => {
      if (document.visibilityState === "hidden") return;
      if (isInteracting) return;
      rotateNext();
    };

    if (timersRef.current.rotate) clearInterval(timersRef.current.rotate);
    timersRef.current.rotate = setInterval(tick, ROTATE_MS);

    return () => {
      if (timersRef.current.rotate) clearInterval(timersRef.current.rotate);
      timersRef.current.rotate = null;
    };
  }, [groups.length, autoRotate, rotateNext, isInteracting]);

  useEffect(() => {
    if (!groups.length) return;
    if (!FALLBACK_REFRESH_MS) return;

    if (timersRef.current.fallback) clearInterval(timersRef.current.fallback);
    timersRef.current.fallback = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      hardRefreshAll({ silent: true });
    }, FALLBACK_REFRESH_MS);

    return () => {
      if (timersRef.current.fallback) clearInterval(timersRef.current.fallback);
      timersRef.current.fallback = null;
    };
  }, [groups.length, hardRefreshAll]);

  useEffect(() => {
    const gid = activeGroup?._id ? String(activeGroup._id) : "";
    if (!gid) return;

    prevSnapshotRef.current = new Map();
    prevTopsRef.current = new Map();
    setHotIds(new Set());

    loadTotalsForGroup(gid);

    const s = socketRef.current;
    if (s) s.emit("leaderboard:join", { groupId: gid });
  }, [activeGroup?._id, loadTotalsForGroup]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === " ") {
        e.preventDefault();
        markInteraction();
        rotateNext();
      }
      if (e.key?.toLowerCase() === "r") {
        markInteraction();
        const gid = activeGroupIdRef.current;
        if (gid) loadTotalsForGroup(gid);
      }
      if (e.key?.toLowerCase() === "f") {
        markInteraction();
        tryFullscreen();
      }
      if (e.key?.toLowerCase() === "a") {
        setAutoRotate((v) => !v);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        markInteraction();
        rotateNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        markInteraction();
        rotatePrev();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rotateNext, rotatePrev, loadTotalsForGroup, markInteraction]);

  async function tryFullscreen() {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // noop
    }
  }

  function onTouchStart(e) {
    const t = e.touches?.[0];
    if (!t) return;
    touchRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      active: true,
    };
  }

  function onTouchEnd(e) {
    const t0 = touchRef.current;
    if (!t0.active) return;
    const t = e.changedTouches?.[0];
    touchRef.current.active = false;
    if (!t) return;

    const dx = t.clientX - t0.startX;
    const dy = t.clientY - t0.startY;

    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;

    markInteraction();
    if (dx < 0) rotateNext();
    else rotatePrev();
  }

  useLayoutEffect(() => {
    const prev = prevSnapshotRef.current || new Map();
    const hot = new Set();

    for (const r of rows) {
      const id = String(r.participantId);
      const total = Number(r.total ?? 0);
      const rank = Number(r.rank ?? 0);

      const by = r.byActivity || {};
      let hash = "";
      for (const a of cols) {
        const v = Number(by[a._id] ?? 0).toFixed(2);
        hash += `${a._id}:${v}|`;
      }

      const old = prev.get(id);
      if (!old) {
        prev.set(id, { rank, total, hash });
        continue;
      }

      if (old.total !== total || old.rank !== rank || old.hash !== hash) {
        hot.add(id);
        prev.set(id, { rank, total, hash });
      }
    }

    prevSnapshotRef.current = prev;

    if (hot.size) {
      setHotIds((oldSet) => {
        const next = new Set(oldSet);
        hot.forEach((id) => next.add(id));
        return next;
      });

      if (timersRef.current.hotClear) clearTimeout(timersRef.current.hotClear);
      timersRef.current.hotClear = setTimeout(() => {
        if (!mountedRef.current) return;
        setHotIds(new Set());
      }, ROW_HIGHLIGHT_MS);
    }

    if (reducedMotion || isMobile) return;

    const prevTops = prevTopsRef.current || new Map();

    rows.forEach((r) => {
      const id = String(r.participantId);
      const el = rowElsRef.current.get(id);
      if (!el) return;

      const newTop = el.getBoundingClientRect().top;
      const oldTop = prevTops.get(id);

      if (oldTop == null) return;

      const dy = oldTop - newTop;
      if (Math.abs(dy) < 2) return;

      el.animate(
        [
          { transform: `translateY(${dy}px)`, filter: "brightness(1.05)" },
          { transform: "translateY(0px)", filter: "brightness(1)" },
        ],
        {
          duration: FLIP_MS,
          easing: "cubic-bezier(.2,.9,.2,1)",
        },
      );
    });

    const nowMap = new Map();
    rowElsRef.current.forEach((el, id) => {
      if (!el) return;
      nowMap.set(String(id), el.getBoundingClientRect().top);
    });
    prevTopsRef.current = nowMap;
  }, [rows, cols, reducedMotion, isMobile]);

  function bindRowEl(id) {
    return (el) => {
      if (!id) return;
      if (el) rowElsRef.current.set(String(id), el);
      else rowElsRef.current.delete(String(id));
    };
  }

  return (
    <>
      <StyleTag />

      <div
        ref={wrapRef}
        className="tvWrap"
        onMouseMove={markInteraction}
        onMouseEnter={markInteraction}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="tvHero">
          <div className="tvHeroLeft">
            <div className="tvBrandRow">
              <div className="tvBrandBadge">REBEL ANGELS</div>

              <div className={`tvConn ${isConnected ? "ok" : "bad"}`}>
                <span className="dot" />
                {isConnected ? "LIVE" : "RECONNECTING"}
              </div>

              <div className={`tvModePill ${autoRotate ? "on" : ""}`}>
                {autoRotate ? "AUTO ROTATE ON" : "AUTO ROTATE OFF"}
              </div>
            </div>

            <div className="tvTitle">Enterprise Public Leaderboard</div>

            <div className="tvSub">
              Group <b>{groupLabel}</b> • Rotation{" "}
              {Math.round(ROTATE_MS / 1000)}s • Live socket updates
              {FALLBACK_REFRESH_MS
                ? ` • Fallback ${Math.round(FALLBACK_REFRESH_MS / 1000)}s`
                : ""}
              {err ? <span className="tvErr"> • {err}</span> : null}
            </div>
          </div>

          <div className="tvHeroRight">
            <div className="tvClockCard">
              <div className="k">Current Time</div>
              <div className="v mono">{formatClock(now)}</div>
              <div className="s">{formatDate(now)}</div>
            </div>

            <TVStat label="Participants" value={stats.count} />
            <TVStat label="Top Score" value={stats.top} mono />
            <TVStat label="Average" value={stats.avg} mono />
          </div>
        </div>

        <div className="tvActionBar">
          <button
            className="tvBtn"
            type="button"
            onClick={() => {
              markInteraction();
              rotatePrev();
            }}
          >
            ← Previous
          </button>

          <button
            className="tvBtn"
            type="button"
            onClick={() => {
              markInteraction();
              rotateNext();
            }}
          >
            Next →
          </button>

          <button
            className="tvBtn"
            type="button"
            onClick={() => {
              markInteraction();
              const gid = activeGroupIdRef.current;
              if (gid) loadTotalsForGroup(gid);
            }}
          >
            Refresh
          </button>

          <button
            className="tvBtn"
            type="button"
            onClick={() => {
              markInteraction();
              setAutoRotate((v) => !v);
            }}
          >
            {autoRotate ? "Pause Auto Rotate" : "Resume Auto Rotate"}
          </button>

          <button
            className="tvBtn tvBtnAccent"
            type="button"
            onClick={() => {
              markInteraction();
              tryFullscreen();
            }}
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>

        <div className="tvTicker">
          <div key={tickerIndex} className="tvTickerText">
            {tickerItems[tickerIndex] || "Live leaderboard"}
          </div>
          <div className="tvTickerMeta">
            Updated {lastUpdated ? timeAgo(lastUpdated) : "—"}
          </div>
        </div>

        <div className="tvPodiumStrip">
          <PodiumCard place={1} row={podium[0]} />
          <PodiumCard place={2} row={podium[1]} />
          <PodiumCard place={3} row={podium[2]} />
        </div>

        {!isMobile ? (
          <div className="tvTableShell">
            <div className="tvTable">
              <div
                className="tvHead"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div className="center">Rank</div>
                <div>Participant</div>
                {cols.length ? (
                  cols.map((a) => (
                    <div key={a._id} className="center">
                      {a.name}
                    </div>
                  ))
                ) : (
                  <div className="center">Score</div>
                )}
                <div className="center">Total</div>
              </div>

              {loading ? (
                <div className="tvLoading">Loading leaderboard…</div>
              ) : null}

              {!loading && !tableLoading && rows.length === 0 ? (
                <div className="tvLoading">No scores yet.</div>
              ) : null}

              {!loading &&
                rows.map((r) => {
                  const pid = String(r.participantId);
                  const hot = hotIds.has(pid);

                  return (
                    <div
                      key={pid}
                      ref={bindRowEl(pid)}
                      className={`tvRow ${hot ? "tvRowHot" : ""}`}
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      <div className="center tvRank">{r.rank ?? "—"}</div>

                      <div className="tvNameCell">
                        <div className="tvName">{r.name || "—"}</div>
                        <div className="tvMini">
                          Participant ID: <span className="mono">{pid}</span>
                        </div>
                      </div>

                      {cols.length ? (
                        cols.map((a) => {
                          const score = Number(r.byActivity?.[a._id] ?? 0);
                          const medal = medalsLookup[`${pid}_${a._id}`] || "";

                          return (
                            <div key={a._id} className="center tvScoreWrap">
                              <div className="tvScore mono">
                                <AnimatedNumber value={score} />
                              </div>
                              <div
                                className={`tvMedal ${medal ? "show" : ""}`}
                                style={{ color: medalColor(medal) }}
                              >
                                {medalEmoji(medal)}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="center tvScore mono">
                          <AnimatedNumber value={Number(r.total ?? 0)} />
                        </div>
                      )}

                      <div className="center tvTotal mono">
                        <AnimatedNumber value={Number(r.total ?? 0)} />
                      </div>
                    </div>
                  );
                })}

              {tableLoading && !loading ? (
                <div className="tvRefreshBar">
                  <div className="tvRefreshInner" />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="tvCardListShell">
            {loading ? (
              <div className="tvLoading">Loading leaderboard…</div>
            ) : null}

            {!loading && !tableLoading && rows.length === 0 ? (
              <div className="tvLoading">No scores yet.</div>
            ) : null}

            {!loading &&
              rows.map((r) => {
                const pid = String(r.participantId);
                const hot = hotIds.has(pid);

                return (
                  <div
                    key={pid}
                    className={`tvCardRow ${hot ? "tvCardRowHot" : ""}`}
                  >
                    <div className="tvCardTop">
                      <div className="tvCardRank">#{r.rank ?? "—"}</div>
                      <div className="tvCardIdentity">
                        <div className="tvCardName">{r.name || "—"}</div>
                        <div className="tvCardMeta mono">{pid}</div>
                      </div>
                      <div className="tvCardTotal mono">
                        <AnimatedNumber value={Number(r.total ?? 0)} />
                      </div>
                    </div>

                    <div className="tvActivityChips">
                      {cols.length ? (
                        cols.map((a) => {
                          const score = Number(r.byActivity?.[a._id] ?? 0);
                          const medal = medalsLookup[`${pid}_${a._id}`] || "";
                          return (
                            <div key={a._id} className="tvActivityChip">
                              <div className="tvActivityChipName">{a.name}</div>
                              <div className="tvActivityChipValue mono">
                                <AnimatedNumber value={score} />
                                <span
                                  className="tvActivityChipMedal"
                                  style={{ color: medalColor(medal) }}
                                >
                                  {medalEmoji(medal)}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="tvActivityChip">
                          <div className="tvActivityChipName">Score</div>
                          <div className="tvActivityChipValue mono">
                            <AnimatedNumber value={Number(r.total ?? 0)} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            {tableLoading && !loading ? (
              <div className="tvRefreshBar mobile">
                <div className="tvRefreshInner" />
              </div>
            ) : null}
          </div>
        )}

        <div className="tvFooter">
          Controls: <b>Space</b> next group • <b>←/→</b> navigation • <b>R</b>{" "}
          refresh • <b>F</b> fullscreen • <b>A</b> auto rotate • swipe on mobile
        </div>
      </div>
    </>
  );
}

/* --------------------------- Small components --------------------------- */

function TVStat({ label, value, mono }) {
  return (
    <div className="tvStat">
      <div className="k">{label}</div>
      <div className={`v ${mono ? "mono" : ""}`}>
        <AnimatedNumber value={Number(value ?? 0)} />
      </div>
    </div>
  );
}

function PodiumCard({ place, row }) {
  const meta = {
    1: { label: "1st Place", emoji: "🥇", color: GOLD },
    2: { label: "2nd Place", emoji: "🥈", color: SILVER },
    3: { label: "3rd Place", emoji: "🥉", color: BRONZE },
  }[place];

  return (
    <div className={`tvPodiumCard ${row ? "" : "empty"}`}>
      <div className="tvPodiumTop" style={{ color: meta.color }}>
        <span>{meta.emoji}</span>
        <span>{meta.label}</span>
      </div>
      <div className="tvPodiumName">{row?.name || "—"}</div>
      <div className="tvPodiumScore mono">{row ? num(row.total) : "0.00"}</div>
    </div>
  );
}

function AnimatedNumber({ value }) {
  const [shown, setShown] = useState(Number(value ?? 0));
  const rafRef = useRef(0);
  const shownRef = useRef(Number(value ?? 0));

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    const to = Number(value ?? 0);
    const from = Number(shownRef.current ?? 0);

    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      setShown(to);
      return;
    }

    if (Math.abs(to - from) < 0.001) {
      setShown(to);
      return;
    }

    cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();

    const tick = (t) => {
      const p = Math.min(1, (t - t0) / NUM_TWEEN_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (to - from) * eased;
      setShown(v);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  const isInt = Math.abs(shown - Math.round(shown)) < 0.0005;
  return <span>{isInt ? String(Math.round(shown)) : shown.toFixed(2)}</span>;
}

/* --------------------------- Helpers --------------------------- */

function num(v) {
  return Number(v ?? 0).toFixed(2);
}

function medalEmoji(m) {
  if (m === "G") return "🥇";
  if (m === "S") return "🥈";
  if (m === "B") return "🥉";
  return "";
}

function medalColor(m) {
  if (m === "G") return GOLD;
  if (m === "S") return SILVER;
  if (m === "B") return BRONZE;
  return "rgba(255,255,255,0.45)";
}

function formatClock(date) {
  try {
    return new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch {
    return "—";
  }
}

function formatDate(date) {
  try {
    return new Intl.DateTimeFormat([], {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

function timeAgo(date) {
  try {
    const d = new Date(date).getTime();
    const diff = Math.max(0, Date.now() - d);
    const sec = Math.floor(diff / 1000);
    if (sec < 5) return "just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    return `${hr}h ago`;
  } catch {
    return "—";
  }
}

/* --------------------------- Styles --------------------------- */

function StyleTag() {
  return (
    <style>{`
      :root{
        --bg1:#040814;
        --bg2:#0b1225;
        --bg3:#111b33;
        --card:rgba(255,255,255,0.06);
        --card2:rgba(255,255,255,0.08);
        --line:rgba(255,255,255,0.10);
        --line2:rgba(255,255,255,0.14);
        --text:rgba(255,255,255,0.94);
        --muted:rgba(255,255,255,0.65);
        --accent:${RED};
      }

      *{ box-sizing:border-box; }
      .mono{ font-variant-numeric:tabular-nums; }
      .center{ text-align:center; }

      .tvWrap{
        min-height:100vh;
        padding:28px;
        color:var(--text);
        background:
          radial-gradient(1200px 700px at 8% 4%, rgba(225,29,46,0.22), rgba(225,29,46,0) 60%),
          radial-gradient(1000px 640px at 95% 10%, rgba(59,130,246,0.20), rgba(59,130,246,0) 60%),
          linear-gradient(135deg, var(--bg1), var(--bg2) 55%, var(--bg3));
        display:flex;
        flex-direction:column;
        gap:18px;
        overflow:hidden;
      }

      .tvHero{
        display:flex;
        justify-content:space-between;
        gap:18px;
        align-items:flex-start;
        flex-wrap:wrap;
      }

      .tvHeroLeft{ min-width:320px; flex:1; }
      .tvHeroRight{
        display:flex;
        gap:12px;
        flex-wrap:wrap;
        align-items:stretch;
        justify-content:flex-end;
      }

      .tvBrandRow{
        display:flex;
        gap:10px;
        align-items:center;
        flex-wrap:wrap;
        margin-bottom:10px;
      }

      .tvBrandBadge{
        display:inline-flex;
        align-items:center;
        padding:8px 14px;
        border-radius:999px;
        background:rgba(225,29,46,0.14);
        border:1px solid rgba(225,29,46,0.28);
        color:rgba(255,255,255,0.96);
        font-size:12px;
        font-weight:1000;
        letter-spacing:.16em;
        text-transform:uppercase;
      }

      .tvConn,
      .tvModePill{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:8px 12px;
        border-radius:999px;
        border:1px solid var(--line2);
        background:rgba(255,255,255,0.06);
        font-size:12px;
        font-weight:1000;
        letter-spacing:.08em;
      }

      .tvModePill.on{
        background:rgba(34,197,94,0.10);
        border-color:rgba(34,197,94,0.24);
      }

      .tvConn .dot{
        width:9px;
        height:9px;
        border-radius:999px;
        display:inline-block;
      }

      .tvConn.ok .dot{
        background:#22c55e;
        box-shadow:0 0 0 6px rgba(34,197,94,0.12);
      }

      .tvConn.bad .dot{
        background:#f59e0b;
        box-shadow:0 0 0 6px rgba(245,158,11,0.12);
      }

      .tvTitle{
        font-size:40px;
        line-height:1.02;
        font-weight:1000;
        letter-spacing:.2px;
      }

      .tvSub{
        margin-top:10px;
        font-size:14px;
        color:var(--muted);
        font-weight:800;
      }

      .tvErr{
        color:rgba(255,205,205,0.96);
        font-weight:1000;
      }

      .tvActionBar{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }

      .tvBtn{
        min-height:42px;
        padding:10px 14px;
        border-radius:14px;
        border:1px solid var(--line2);
        background:rgba(255,255,255,0.07);
        color:var(--text);
        cursor:pointer;
        font-weight:900;
        font-size:13px;
        backdrop-filter:blur(10px);
      }

      .tvBtn:hover{
        background:rgba(255,255,255,0.12);
      }

      .tvBtnAccent{
        background:rgba(225,29,46,0.14);
        border-color:rgba(225,29,46,0.32);
      }

      .tvClockCard,
      .tvStat,
      .tvPodiumCard,
      .tvCardRow{
        border-radius:20px;
        background:var(--card);
        border:1px solid var(--line);
        box-shadow:0 22px 60px rgba(0,0,0,0.28);
        backdrop-filter:blur(10px);
      }

      .tvClockCard{
        min-width:230px;
        padding:14px 16px;
      }

      .tvClockCard .k,
      .tvStat .k{
        font-size:12px;
        color:var(--muted);
        font-weight:1000;
        text-transform:uppercase;
        letter-spacing:.10em;
      }

      .tvClockCard .v{
        margin-top:8px;
        font-size:28px;
        line-height:1;
        font-weight:1000;
      }

      .tvClockCard .s{
        margin-top:8px;
        font-size:12px;
        color:var(--muted);
        font-weight:900;
      }

      .tvStat{
        min-width:170px;
        padding:14px 16px;
      }

      .tvStat .v{
        margin-top:8px;
        font-size:28px;
        line-height:1;
        font-weight:1000;
      }

      .tvTicker{
        display:flex;
        justify-content:space-between;
        gap:14px;
        align-items:center;
        padding:14px 18px;
        border-radius:18px;
        background:rgba(255,255,255,0.06);
        border:1px solid var(--line);
        overflow:hidden;
      }

      .tvTickerText{
        font-size:20px;
        font-weight:1000;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        animation:fadeSlide .35s ease;
      }

      .tvTickerMeta{
        flex-shrink:0;
        font-size:12px;
        color:var(--muted);
        font-weight:900;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      @keyframes fadeSlide{
        from{ opacity:0; transform:translateY(6px); }
        to{ opacity:1; transform:translateY(0); }
      }

      .tvPodiumStrip{
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:14px;
      }

      .tvPodiumCard{
        padding:16px;
        min-height:124px;
        display:flex;
        flex-direction:column;
        justify-content:center;
      }

      .tvPodiumCard.empty{
        opacity:.72;
      }

      .tvPodiumTop{
        display:flex;
        align-items:center;
        gap:10px;
        font-size:13px;
        font-weight:1000;
        text-transform:uppercase;
        letter-spacing:.08em;
      }

      .tvPodiumName{
        margin-top:10px;
        font-size:24px;
        font-weight:1000;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .tvPodiumScore{
        margin-top:8px;
        font-size:28px;
        font-weight:1000;
        color:rgba(255,255,255,0.96);
      }

      .tvTableShell{
        flex:1;
        min-height:0;
        border-radius:24px;
        background:rgba(255,255,255,0.04);
        border:1px solid var(--line);
        box-shadow:0 28px 80px rgba(0,0,0,0.42);
        overflow:hidden;
        display:flex;
      }

      .tvTable{
        width:100%;
        overflow:auto;
        position:relative;
      }

      .tvHead{
        display:grid;
        gap:14px;
        padding:16px;
        background:rgba(255,255,255,0.07);
        border-bottom:1px solid var(--line);
        position:sticky;
        top:0;
        z-index:3;
        align-items:center;
        font-size:13px;
        color:rgba(255,255,255,0.80);
        font-weight:1000;
        text-transform:uppercase;
        letter-spacing:.08em;
        backdrop-filter:blur(10px);
      }

      .tvRow{
        display:grid;
        gap:14px;
        padding:16px;
        align-items:center;
        font-size:18px;
        border-bottom:1px solid rgba(255,255,255,0.06);
        will-change:transform;
        transform:translateZ(0);
        position:relative;
      }

      .tvRow:nth-child(even){
        background:rgba(255,255,255,0.025);
      }

      .tvRowHot,
      .tvCardRowHot{
        background:
          linear-gradient(90deg, rgba(225,29,46,0.14), rgba(255,255,255,0.02));
        box-shadow:
          inset 0 0 0 1px rgba(225,29,46,0.20),
          inset 0 0 60px rgba(225,29,46,0.05);
        animation:tvPulse .9s ease-in-out 1;
      }

      @keyframes tvPulse{
        0%{ filter:brightness(1); }
        35%{ filter:brightness(1.16); }
        100%{ filter:brightness(1); }
      }

      .tvRank{
        font-weight:1000;
        font-size:24px;
        color:rgba(255,255,255,0.98);
      }

      .tvNameCell{ min-width:0; }

      .tvName{
        font-size:22px;
        font-weight:1000;
        letter-spacing:.2px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .tvMini{
        margin-top:6px;
        font-size:11px;
        color:var(--muted);
        font-weight:900;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .tvScoreWrap{
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:6px;
      }

      .tvScore{
        font-weight:1000;
        color:rgba(255,255,255,0.92);
      }

      .tvMedal{
        min-height:18px;
        font-size:16px;
        opacity:0;
        transform:translateY(2px);
        transition:all .2s ease;
      }

      .tvMedal.show{
        opacity:1;
        transform:none;
      }

      .tvTotal{
        font-weight:1000;
        color:rgba(255,255,255,0.98);
        background:rgba(225,29,46,0.12);
        border:1px solid rgba(225,29,46,0.28);
        padding:11px 14px;
        border-radius:16px;
        justify-self:center;
        min-width:124px;
      }

      .tvLoading{
        padding:34px;
        text-align:center;
        color:rgba(255,255,255,0.72);
        font-weight:1000;
        font-size:20px;
      }

      .tvRefreshBar{
        position:sticky;
        bottom:0;
        left:0;
        right:0;
        height:3px;
        background:rgba(255,255,255,0.05);
        overflow:hidden;
      }

      .tvRefreshBar.mobile{
        position:relative;
        border-radius:999px;
      }

      .tvRefreshInner{
        width:30%;
        height:100%;
        background:linear-gradient(90deg, rgba(225,29,46,0), rgba(225,29,46,0.95), rgba(225,29,46,0));
        animation:refreshSweep 1.1s linear infinite;
      }

      @keyframes refreshSweep{
        from{ transform:translateX(-120%); }
        to{ transform:translateX(420%); }
      }

      .tvCardListShell{
        display:grid;
        gap:12px;
      }

      .tvCardRow{
        padding:14px;
      }

      .tvCardTop{
        display:grid;
        grid-template-columns:68px 1fr auto;
        gap:12px;
        align-items:center;
      }

      .tvCardRank{
        display:flex;
        align-items:center;
        justify-content:center;
        min-height:54px;
        border-radius:16px;
        background:rgba(255,255,255,0.06);
        border:1px solid var(--line);
        font-size:22px;
        font-weight:1000;
      }

      .tvCardIdentity{
        min-width:0;
      }

      .tvCardName{
        font-size:18px;
        font-weight:1000;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .tvCardMeta{
        margin-top:5px;
        font-size:11px;
        color:var(--muted);
        font-weight:900;
      }

      .tvCardTotal{
        min-width:92px;
        text-align:center;
        padding:10px 12px;
        border-radius:14px;
        background:rgba(225,29,46,0.12);
        border:1px solid rgba(225,29,46,0.28);
        font-size:20px;
        font-weight:1000;
      }

      .tvActivityChips{
        display:grid;
        grid-template-columns:repeat(2, minmax(0,1fr));
        gap:10px;
        margin-top:12px;
      }

      .tvActivityChip{
        padding:10px 12px;
        border-radius:14px;
        background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.08);
      }

      .tvActivityChipName{
        font-size:11px;
        color:var(--muted);
        font-weight:1000;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .tvActivityChipValue{
        margin-top:6px;
        font-size:18px;
        font-weight:1000;
        display:flex;
        align-items:center;
        gap:8px;
      }

      .tvActivityChipMedal{
        min-width:18px;
      }

      .tvFooter{
        text-align:center;
        color:rgba(255,255,255,0.60);
        font-size:12px;
        font-weight:1000;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      @media (max-width: 1300px){
        .tvPodiumStrip{
          grid-template-columns:1fr;
        }
      }

      @media (max-width: 1100px){
        .tvHead,
        .tvRow{
          gap:10px;
          padding:14px;
        }

        .tvTitle{
          font-size:34px;
        }

        .tvName{
          font-size:20px;
        }

        .tvTableShell{
          min-height:420px;
        }
      }

      @media (max-width: 900px){
        .tvWrap{ padding:18px; }
        .tvTitle{ font-size:30px; }
        .tvTicker{ flex-direction:column; align-items:flex-start; }
        .tvHeroRight{ justify-content:flex-start; }
        .tvClockCard,
        .tvStat{
          min-width:160px;
        }
        .tvActionBar{
          gap:8px;
        }
        .tvBtn{
          flex:1 1 180px;
        }
      }

      @media (max-width: 700px){
        .tvWrap{ padding:14px; }
        .tvBrandRow{ gap:8px; }
        .tvBrandBadge,
        .tvConn,
        .tvModePill{
          font-size:11px;
          padding:7px 10px;
        }
        .tvTitle{ font-size:24px; }
        .tvSub{ font-size:12px; }
        .tvTickerText{ font-size:16px; }
        .tvClockCard .v,
        .tvStat .v{ font-size:22px; }
        .tvPodiumName{ font-size:20px; }
        .tvPodiumScore{ font-size:24px; }
        .tvFooter{ font-size:11px; }
        .tvActionBar{
          display:grid;
          grid-template-columns:1fr 1fr;
        }
        .tvBtn{
          min-width:0;
          width:100%;
        }
      }

      @media (max-width: 520px){
        .tvHeroLeft{
          min-width:0;
        }
        .tvActionBar{
          grid-template-columns:1fr;
        }
        .tvActivityChips{
          grid-template-columns:1fr;
        }
        .tvCardTop{
          grid-template-columns:56px 1fr auto;
        }
        .tvCardRank{
          min-height:48px;
          font-size:18px;
        }
        .tvCardName{
          font-size:16px;
        }
        .tvCardTotal{
          font-size:18px;
          min-width:78px;
        }
      }
    `}</style>
  );
}
