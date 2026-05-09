// ✅ FULL UPDATED FILE — client/src/pages/Public/LeaderboardPublic.jsx
// Enterprise public leaderboard
//
// ✅ Enhancements:
// - Safer async loading with stale-request protection
// - Auto refresh (polling)
// - Auto rotate groups
// - Search participant
// - Summary stats
// - Top 3 podium
// - Activity medal indicators
// - Fullscreen toggle
// - Print action
// - Better empty/error/loading states
// - Mobile-friendly enterprise UI
// - Public-only, no login required
// - Better responsiveness for mobile / tablet / desktop
// - Stable level -> group switching
// - Rank normalization if API does not return rank
// - Visible live/refresh status
// - Auto-rotate pauses while tab hidden
// - Fullscreen state sync
//
// Assumes api has:
// - api.publicGroups(academyId?)
// - api.publicTotalsByGroup(groupId)

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../../lib/api.js";

const RED = "#e11d2e";
const INK = "#0b1220";
const MUTED = "#64748b";
const GOLD = "#f59e0b";
const SILVER = "#94a3b8";
const BRONZE = "#b45309";

const REFRESH_MS = 12000;
const ROTATE_MS = 10000;

export default function LeaderboardPublic() {
  const [groups, setGroups] = useState([]);
  const [levelTab, setLevelTab] = useState("ALL");
  const [groupId, setGroupId] = useState("");

  const [data, setData] = useState({
    activities: [],
    rows: [],
    medalsByActivity: {},
  });

  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [err, setErr] = useState("");

  const [query, setQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(
    () => !!document.fullscreenElement,
  );

  const groupTabsRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const rotateTimerRef = useRef(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const safeSetState = useCallback((fn) => {
    if (!mountedRef.current) return;
    fn();
  }, []);

  const loadGroups = useCallback(async () => {
    const gs = (await api.publicGroups?.()) || [];
    return Array.isArray(gs) ? gs : [];
  }, []);

  const normalizeTotals = useCallback((totals) => {
    const activities = Array.isArray(totals?.activities)
      ? totals.activities
      : [];
    const rawRows = Array.isArray(totals?.rows) ? totals.rows : [];
    const medalsByActivity =
      totals?.medalsByActivity && typeof totals.medalsByActivity === "object"
        ? totals.medalsByActivity
        : {};

    const rows = [...rawRows]
      .sort((a, b) => Number(b?.total || 0) - Number(a?.total || 0))
      .map((r, i) => ({
        ...r,
        participantId:
          r?.participantId ||
          r?._id ||
          r?.id ||
          r?.participant?._id ||
          `row-${i}`,
        rank: Number(r?.rank || i + 1),
      }));

    return { activities, rows, medalsByActivity };
  }, []);

  const loadTotals = useCallback(
    async (gid, { silent = false } = {}) => {
      if (!gid) {
        safeSetState(() => {
          setData({ activities: [], rows: [], medalsByActivity: {} });
          setTableLoading(false);
        });
        return;
      }

      const rid = ++requestIdRef.current;

      safeSetState(() => {
        if (!silent) setTableLoading(true);
        setErr("");
      });

      try {
        const totals = await api.publicTotalsByGroup(gid);
        if (!mountedRef.current || rid !== requestIdRef.current) return;

        safeSetState(() => {
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
        });
      } catch (e) {
        if (!mountedRef.current || rid !== requestIdRef.current) return;
        safeSetState(() => {
          setErr(e?.message || "Failed to load leaderboard");
        });
      } finally {
        if (!mountedRef.current || rid !== requestIdRef.current) return;
        safeSetState(() => {
          setTableLoading(false);
        });
      }
    },
    [normalizeTotals, safeSetState],
  );

  const bootstrap = useCallback(async () => {
    safeSetState(() => {
      setLoading(true);
      setErr("");
    });

    try {
      const gs = await loadGroups();

      safeSetState(() => {
        setGroups(gs);
      });

      const first = gs?.[0]?._id || "";
      safeSetState(() => {
        setGroupId(first);
      });

      await loadTotals(first);
    } catch (e) {
      safeSetState(() => {
        setErr(e?.message || "Failed to load leaderboard");
      });
    } finally {
      safeSetState(() => {
        setLoading(false);
      });
    }
  }, [loadGroups, loadTotals, safeSetState]);

  useEffect(() => {
    mountedRef.current = true;
    bootstrap();

    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
    };
  }, [bootstrap]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

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
    if (!activeGroup) return "—";
    return `${activeGroup.name}${activeGroup.level ? ` (${activeGroup.level})` : ""}`;
  }, [activeGroup]);

  const cols = useMemo(() => data?.activities || [], [data]);
  const baseRows = useMemo(() => data?.rows || [], [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseRows;
    return baseRows.filter((r) =>
      String(r?.name || "")
        .toLowerCase()
        .includes(q),
    );
  }, [baseRows, query]);

  const podium = useMemo(() => rows.slice(0, 3), [rows]);

  const stats = useMemo(() => {
    const totalParticipants = baseRows.length;
    const avgScore =
      totalParticipants > 0
        ? baseRows.reduce((sum, r) => sum + Number(r?.total || 0), 0) /
          totalParticipants
        : 0;
    const maxScore = baseRows.reduce(
      (max, r) => Math.max(max, Number(r?.total || 0)),
      0,
    );

    return {
      totalParticipants,
      activityCount: cols.length,
      avgScore,
      topScore: maxScore,
    };
  }, [baseRows, cols.length]);

  const medalOwners = useMemo(() => {
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

  const mobileRows = useMemo(() => rows, [rows]);

  const gridTemplate = useMemo(() => {
    const activityCols = Math.max(cols.length, 1);
    return `70px minmax(220px, 1.4fr) repeat(${activityCols}, minmax(120px, 1fr)) 130px`;
  }, [cols.length]);

  function scoreFmt(v) {
    return Number(v || 0).toFixed(2);
  }

  function medalLabelShort(m) {
    if (m === "G") return "🥇";
    if (m === "S") return "🥈";
    if (m === "B") return "🥉";
    return "";
  }

  function medalColor(m) {
    if (m === "G") return GOLD;
    if (m === "S") return SILVER;
    if (m === "B") return BRONZE;
    return MUTED;
  }

  function scrollGroupTabs(dir) {
    const el = groupTabsRef.current;
    if (!el) return;
    const dx = Math.max(240, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({ left: dir === "L" ? -dx : dx, behavior: "smooth" });
  }

  async function onPickLevel(lv) {
    setLevelTab(lv);

    const nextGroups =
      lv === "ALL"
        ? groups
        : groups.filter((g) => String(g?.level || "").trim() === lv);

    const stillValid = nextGroups.some(
      (g) => String(g._id) === String(groupId),
    );
    const nextGid = stillValid ? groupId : nextGroups?.[0]?._id || "";

    setGroupId(nextGid);

    if (groupTabsRef.current) groupTabsRef.current.scrollLeft = 0;
    await loadTotals(nextGid);
  }

  async function onPickGroup(gid) {
    setGroupId(gid);
    await loadTotals(gid);
  }

  async function refreshCurrent(silent = true) {
    await loadTotals(groupId, { silent });
  }

  function onPrint() {
    window.print();
  }

  async function onToggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // no-op
    }
  }

  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (!autoRefresh || !groupId) return;

    refreshTimerRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshCurrent(true);
      }
    }, REFRESH_MS);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefresh, groupId, loadTotals]);

  useEffect(() => {
    if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
    if (!autoRotate || !filteredGroups.length) return;

    rotateTimerRef.current = setInterval(() => {
      if (document.visibilityState !== "visible") return;

      setGroupId((prev) => {
        const idx = filteredGroups.findIndex(
          (g) => String(g._id) === String(prev),
        );
        const next =
          filteredGroups[(idx + 1) % filteredGroups.length]?._id ||
          filteredGroups[0]?._id ||
          "";

        if (next && String(next) !== String(prev)) {
          loadTotals(next, { silent: false });
        }
        return next;
      });
    }, ROTATE_MS);

    return () => {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
    };
  }, [autoRotate, filteredGroups, loadTotals]);

  return (
    <>
      <StyleTag />

      <div className="pubWrap">
        <div className="pubHero">
          <div className="pubHeroLeft">
            <div className="pubKicker">Rebel Angels</div>
            <div className="pubTitle">Public Leaderboard</div>
            <div className="pubSub">
              Live scores, rankings, and activity-wise totals for public
              display.
            </div>

            <div className="pubTopMeta">
              <div className="pubChip">
                Active Group: <b>{groupLabel}</b>
              </div>
              <div className="pubChip">
                Updated: <b>{lastUpdated ? formatTime(lastUpdated) : "—"}</b>
              </div>
              <div className="pubChip">
                Status: <b>{loading || tableLoading ? "Refreshing" : "Live"}</b>
              </div>
            </div>

            {err ? (
              <div className="pubErr">
                <span>⚠</span>
                <span>{err}</span>
                <button
                  className="pubInlineBtn"
                  type="button"
                  onClick={() => refreshCurrent(false)}
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>

          <div className="pubHeroRight">
            <button
              className="pubActionBtn"
              type="button"
              onClick={() => refreshCurrent(false)}
            >
              Refresh
            </button>
            <button
              className="pubActionBtn"
              type="button"
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
            <button className="pubActionBtn" type="button" onClick={onPrint}>
              Print
            </button>
          </div>
        </div>

        <div className="pubStatsGrid">
          <StatCard
            label="Participants"
            value={stats.totalParticipants}
            accent={RED}
          />
          <StatCard
            label="Activities"
            value={stats.activityCount}
            accent={INK}
          />
          <StatCard
            label="Average Score"
            value={scoreFmt(stats.avgScore)}
            accent="#0f766e"
          />
          <StatCard
            label="Top Score"
            value={scoreFmt(stats.topScore)}
            accent="#7c3aed"
          />
        </div>

        <div className="pubCard">
          <div className="pubFiltersTop">
            <div className="pubFilterBlock">
              <div className="pubTabsLabel">Level</div>
              <div className="pubTabsRow">
                {levels.map((lv) => {
                  const active = levelTab === lv;
                  return (
                    <button
                      key={lv}
                      type="button"
                      className={`pubTab ${active ? "pubTabActive" : ""}`}
                      onClick={() => onPickLevel(lv)}
                      disabled={loading || tableLoading}
                    >
                      {lv === "ALL" ? "All Levels" : lv}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pubFilterTools">
              <label className="pubToggle">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <span>Auto Refresh</span>
              </label>

              <label className="pubToggle">
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(e) => setAutoRotate(e.target.checked)}
                />
                <span>Auto Rotate</span>
              </label>

              <input
                className="pubSearch"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search participant..."
                aria-label="Search participant"
              />
            </div>
          </div>

          <div className="pubDivider" />

          <div className="pubTabsLabel">Group</div>
          <div className="pubGroupShell">
            <button
              className="pubScroll"
              type="button"
              onClick={() => scrollGroupTabs("L")}
              aria-label="Scroll left"
            >
              ‹
            </button>

            <div className="pubGroupTabs" ref={groupTabsRef}>
              {filteredGroups.map((g) => {
                const active = String(g._id) === String(groupId);
                return (
                  <button
                    key={g._id}
                    type="button"
                    className={`pubTab ${active ? "pubTabActive" : ""}`}
                    onClick={() => onPickGroup(g._id)}
                    disabled={loading || tableLoading}
                    title={`${g.name}${g.level ? ` (${g.level})` : ""}`}
                  >
                    <span>{g.name}</span>
                    {g.level ? (
                      <span className="pubPill">{g.level}</span>
                    ) : null}
                  </button>
                );
              })}

              {!filteredGroups.length ? (
                <div className="pubEmptyMini">
                  No groups available for this level.
                </div>
              ) : null}
            </div>

            <button
              className="pubScroll"
              type="button"
              onClick={() => scrollGroupTabs("R")}
              aria-label="Scroll right"
            >
              ›
            </button>
          </div>
        </div>

        <div className="pubPodiumCard">
          <div className="pubSectionTitle">Top Performers</div>
          <div className="pubSectionSub">Top 3 for the selected group</div>

          <div className="pubPodiumGrid">
            <PodiumCard place={2} row={podium[1]} />
            <PodiumCard place={1} row={podium[0]} big />
            <PodiumCard place={3} row={podium[2]} />
          </div>
        </div>

        <div className="pubCard" style={{ marginTop: 14 }}>
          <div className="pubTableHeader">
            <div>
              <div className="pubSectionTitle">Results</div>
              <div className="pubSectionSub">
                Showing <b>{rows.length}</b> of <b>{baseRows.length}</b>{" "}
                participants in <b>{groupLabel}</b>
              </div>
            </div>

            <div className="pubLegend">
              <span>
                <b>🥇</b> Gold
              </span>
              <span>
                <b>🥈</b> Silver
              </span>
              <span>
                <b>🥉</b> Bronze
              </span>
            </div>
          </div>

          <div className="pubScrollX pubDesktopOnly">
            <div className="pubTable">
              <div
                className="pubHead"
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

              {!loading &&
                !tableLoading &&
                rows.map((r) => (
                  <div
                    key={r.participantId}
                    className="pubRow"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    <div className="pubRank center">{r.rank ?? "—"}</div>

                    <div className="pubNameWrap">
                      <div className="pubName">{r.name || "—"}</div>
                      <div className="pubMiniMeta">
                        Participant ID: {r.participantId || "—"}
                      </div>
                    </div>

                    {cols.length ? (
                      cols.map((a) => {
                        const score = Number(r?.byActivity?.[a._id] ?? 0);
                        const medal =
                          medalOwners[`${r.participantId}_${a._id}`] || "";

                        return (
                          <div key={a._id} className="center pubScoreCell">
                            <div className="pubScore">{scoreFmt(score)}</div>
                            {medal ? (
                              <div
                                className="pubMedalMini"
                                title={`${a.name}: ${medal}`}
                                style={{ color: medalColor(medal) }}
                              >
                                {medalLabelShort(medal)}
                              </div>
                            ) : (
                              <div className="pubMedalSpacer" />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="center pubScore">{scoreFmt(r.total)}</div>
                    )}

                    <div className="center pubTotal">{scoreFmt(r.total)}</div>
                  </div>
                ))}

              {loading || tableLoading ? (
                <div className="pubEmpty">
                  <div className="pubLoader" />
                  <div>
                    {loading
                      ? "Loading leaderboard..."
                      : "Refreshing scores..."}
                  </div>
                </div>
              ) : null}

              {!loading && !tableLoading && rows.length === 0 ? (
                <div className="pubEmpty">
                  {query.trim()
                    ? "No participants match your search."
                    : "No scores yet."}
                </div>
              ) : null}
            </div>
          </div>

          <div className="pubMobileCards pubMobileOnly">
            {!loading &&
              !tableLoading &&
              mobileRows.map((r) => (
                <MobileResultCard
                  key={r.participantId}
                  row={r}
                  cols={cols}
                  medalOwners={medalOwners}
                  scoreFmt={scoreFmt}
                  medalColor={medalColor}
                  medalLabelShort={medalLabelShort}
                />
              ))}

            {loading || tableLoading ? (
              <div className="pubEmpty">
                <div className="pubLoader" />
                <div>
                  {loading ? "Loading leaderboard..." : "Refreshing scores..."}
                </div>
              </div>
            ) : null}

            {!loading && !tableLoading && rows.length === 0 ? (
              <div className="pubEmpty">
                {query.trim()
                  ? "No participants match your search."
                  : "No scores yet."}
              </div>
            ) : null}
          </div>
        </div>

        <div className="pubFooter">
          Rebel Angels • Public Leaderboard • Live Totals
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="pubStatCard">
      <div className="pubStatLabel">{label}</div>
      <div className="pubStatValue" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function PodiumCard({ place, row, big = false }) {
  const placeMeta = {
    1: { title: "1st Place", emoji: "🥇", color: GOLD },
    2: { title: "2nd Place", emoji: "🥈", color: SILVER },
    3: { title: "3rd Place", emoji: "🥉", color: BRONZE },
  };

  const meta = placeMeta[place] || placeMeta[3];

  return (
    <div className={`pubPodiumItem ${big ? "pubPodiumBig" : ""}`}>
      <div
        className="pubPodiumBadge"
        style={{ background: `${meta.color}18`, color: meta.color }}
      >
        <span>{meta.emoji}</span>
        <span>{meta.title}</span>
      </div>

      <div className="pubPodiumName">{row?.name || "—"}</div>
      <div className="pubPodiumScore">
        {row ? Number(row.total || 0).toFixed(2) : "0.00"}
      </div>
      <div className="pubPodiumRank">Rank {row?.rank ?? place}</div>
    </div>
  );
}

function MobileResultCard({
  row,
  cols,
  medalOwners,
  scoreFmt,
  medalColor,
  medalLabelShort,
}) {
  return (
    <div className="pubMobileCard">
      <div className="pubMobileTop">
        <div>
          <div className="pubMobileRank">Rank #{row?.rank ?? "—"}</div>
          <div className="pubMobileName">{row?.name || "—"}</div>
          <div className="pubMiniMeta">
            Participant ID: {row?.participantId || "—"}
          </div>
        </div>

        <div className="pubMobileTotalWrap">
          <div className="pubMobileTotalLabel">Total</div>
          <div className="pubMobileTotal">{scoreFmt(row?.total)}</div>
        </div>
      </div>

      <div className="pubMobileActivities">
        {cols.length ? (
          cols.map((a) => {
            const score = Number(row?.byActivity?.[a._id] ?? 0);
            const medal = medalOwners[`${row.participantId}_${a._id}`] || "";

            return (
              <div key={a._id} className="pubMobileActivity">
                <div className="pubMobileActivityName">{a.name}</div>
                <div className="pubMobileActivityValueWrap">
                  <span className="pubMobileActivityScore">
                    {scoreFmt(score)}
                  </span>
                  <span
                    className="pubMobileActivityMedal"
                    style={{ color: medal ? medalColor(medal) : MUTED }}
                  >
                    {medal ? medalLabelShort(medal) : "—"}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="pubMobileActivity">
            <div className="pubMobileActivityName">Score</div>
            <div className="pubMobileActivityValueWrap">
              <span className="pubMobileActivityScore">
                {scoreFmt(row?.total)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(d) {
  try {
    return new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(d));
  } catch {
    return "—";
  }
}

function StyleTag() {
  return (
    <style>{`
      :root{
        --pub-red:${RED};
        --pub-ink:${INK};
        --pub-muted:${MUTED};
        --pub-line:rgba(17,24,39,.08);
        --pub-line-strong:rgba(17,24,39,.12);
        --pub-bg:linear-gradient(180deg,#f8fafc 0%, #eef2ff 100%);
        --pub-card:rgba(255,255,255,.88);
      }

      *{ box-sizing:border-box; }
      .center{ text-align:center; }

      .pubWrap{
        max-width: 1380px;
        margin: 0 auto;
        padding: 20px;
        min-height: 100vh;
        background: var(--pub-bg);
      }

      .pubHero{
        display:flex;
        justify-content:space-between;
        gap:18px;
        align-items:flex-start;
        flex-wrap:wrap;
        margin-bottom:16px;
      }

      .pubHeroLeft{ flex:1; min-width:280px; }
      .pubHeroRight{ display:flex; gap:10px; flex-wrap:wrap; }

      .pubKicker{
        display:inline-flex;
        align-items:center;
        gap:8px;
        font-size:11px;
        font-weight:900;
        letter-spacing:.14em;
        text-transform:uppercase;
        color:var(--pub-red);
        background:rgba(255,241,242,.85);
        border:1px solid rgba(225,29,46,.16);
        border-radius:999px;
        padding:8px 12px;
      }

      .pubTitle{
        margin-top:10px;
        font-size:clamp(28px, 4vw, 42px);
        line-height:1;
        font-weight:1000;
        color:var(--pub-ink);
      }

      .pubSub{
        margin-top:10px;
        color:var(--pub-muted);
        font-size:14px;
        max-width:760px;
      }

      .pubTopMeta{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:14px;
      }

      .pubChip{
        padding:10px 14px;
        border-radius:999px;
        background:rgba(255,255,255,.86);
        border:1px solid var(--pub-line-strong);
        font-weight:900;
        color:var(--pub-ink);
        box-shadow:0 10px 30px rgba(2,8,23,.04);
      }

      .pubErr{
        margin-top:14px;
        display:flex;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
        padding:12px 14px;
        border-radius:16px;
        border:1px solid rgba(225,29,46,.22);
        background:rgba(255,241,242,.84);
        color:var(--pub-red);
        font-weight:900;
      }

      .pubInlineBtn,
      .pubActionBtn,
      .pubScroll,
      .pubTab{
        transition:.18s ease;
      }

      .pubInlineBtn,
      .pubActionBtn{
        border:1px solid var(--pub-line-strong);
        background:rgba(255,255,255,.92);
        color:var(--pub-ink);
        border-radius:14px;
        padding:10px 14px;
        font-weight:900;
        cursor:pointer;
        box-shadow:0 10px 24px rgba(2,8,23,.05);
      }

      .pubActionBtn:hover,
      .pubInlineBtn:hover,
      .pubScroll:hover,
      .pubTab:hover{
        transform:translateY(-1px);
        box-shadow:0 14px 28px rgba(2,8,23,.08);
      }

      .pubStatsGrid{
        display:grid;
        grid-template-columns:repeat(4, minmax(0,1fr));
        gap:14px;
        margin-bottom:14px;
      }

      .pubStatCard{
        background:var(--pub-card);
        border:1px solid var(--pub-line);
        border-radius:22px;
        padding:18px;
        box-shadow:0 18px 42px rgba(2,8,23,.06);
        backdrop-filter: blur(10px);
      }

      .pubStatLabel{
        font-size:12px;
        font-weight:900;
        color:var(--pub-muted);
        text-transform:uppercase;
        letter-spacing:.08em;
      }

      .pubStatValue{
        margin-top:10px;
        font-size:28px;
        line-height:1;
        font-weight:1000;
      }

      .pubCard,
      .pubPodiumCard{
        background:var(--pub-card);
        border:1px solid var(--pub-line);
        border-radius:22px;
        box-shadow:0 18px 46px rgba(2,8,23,.06);
        padding:16px;
        backdrop-filter: blur(10px);
      }

      .pubPodiumCard{ margin-top:14px; }

      .pubFiltersTop{
        display:flex;
        justify-content:space-between;
        gap:16px;
        flex-wrap:wrap;
      }

      .pubFilterBlock{ flex:1; min-width:280px; }
      .pubFilterTools{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        align-items:flex-end;
      }

      .pubTabsLabel{
        font-size:12px;
        font-weight:1000;
        color:var(--pub-muted);
        text-transform:uppercase;
        letter-spacing:.08em;
        margin-bottom:8px;
      }

      .pubTabsRow{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
      }

      .pubDivider{
        height:1px;
        background:var(--pub-line);
        margin:14px 0;
      }

      .pubTab{
        padding:10px 14px;
        border-radius:999px;
        border:1px solid var(--pub-line-strong);
        background:rgba(255,255,255,.9);
        font-weight:950;
        cursor:pointer;
        display:flex;
        align-items:center;
        gap:10px;
        white-space:nowrap;
        color:var(--pub-ink);
      }

      .pubTabActive{
        border-color:rgba(225,29,46,.28);
        background:rgba(255,241,242,.82);
        box-shadow: inset 0 0 0 2px rgba(225,29,46,.08);
        color:var(--pub-red);
      }

      .pubTab:disabled,
      .pubScroll:disabled{
        opacity:.55;
        cursor:not-allowed;
        transform:none;
        box-shadow:none;
      }

      .pubToggle{
        display:inline-flex;
        gap:8px;
        align-items:center;
        padding:10px 12px;
        border-radius:14px;
        border:1px solid var(--pub-line-strong);
        background:rgba(255,255,255,.9);
        font-weight:850;
        color:var(--pub-ink);
      }

      .pubToggle input{ accent-color: var(--pub-red); }

      .pubSearch{
        min-width:220px;
        height:42px;
        border-radius:14px;
        border:1px solid var(--pub-line-strong);
        background:rgba(255,255,255,.94);
        padding:0 14px;
        outline:none;
        font-weight:800;
        color:var(--pub-ink);
      }

      .pubSearch:focus{
        border-color:rgba(225,29,46,.28);
        box-shadow:0 0 0 4px rgba(225,29,46,.08);
      }

      .pubGroupShell{
        display:flex;
        gap:10px;
        align-items:center;
      }

      .pubScroll{
        width:42px;
        height:42px;
        border-radius:14px;
        border:1px solid var(--pub-line-strong);
        background:rgba(255,255,255,.92);
        font-size:22px;
        font-weight:1000;
        cursor:pointer;
        color:var(--pub-ink);
        flex:0 0 auto;
      }

      .pubGroupTabs{
        flex:1;
        display:flex;
        gap:10px;
        overflow-x:auto;
        padding:2px;
        scroll-behavior:smooth;
        scrollbar-width:thin;
      }

      .pubPill{
        padding:6px 10px;
        border-radius:999px;
        background:rgba(255,241,242,.92);
        border:1px solid rgba(225,29,46,.16);
        color:var(--pub-red);
        font-weight:950;
        font-size:11px;
      }

      .pubEmptyMini{
        padding:10px 12px;
        opacity:.72;
        font-weight:800;
        white-space:nowrap;
        color:var(--pub-muted);
      }

      .pubSectionTitle{
        font-weight:1000;
        font-size:18px;
        color:var(--pub-ink);
      }

      .pubSectionSub{
        font-size:12px;
        color:var(--pub-muted);
        margin-top:6px;
        font-weight:700;
      }

      .pubPodiumGrid{
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:14px;
        margin-top:14px;
        align-items:end;
      }

      .pubPodiumItem{
        border:1px solid var(--pub-line);
        background:rgba(255,255,255,.84);
        border-radius:20px;
        padding:16px;
        min-height:160px;
        display:flex;
        flex-direction:column;
        justify-content:center;
        align-items:center;
        text-align:center;
      }

      .pubPodiumBig{
        min-height:190px;
        box-shadow:0 18px 42px rgba(225,29,46,.08);
        border-color:rgba(225,29,46,.18);
      }

      .pubPodiumBadge{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:8px 12px;
        border-radius:999px;
        font-weight:950;
        font-size:12px;
      }

      .pubPodiumName{
        margin-top:14px;
        font-size:20px;
        font-weight:1000;
        color:var(--pub-ink);
      }

      .pubPodiumScore{
        margin-top:8px;
        font-size:30px;
        line-height:1;
        font-weight:1000;
        color:var(--pub-red);
      }

      .pubPodiumRank{
        margin-top:8px;
        font-size:12px;
        font-weight:900;
        color:var(--pub-muted);
      }

      .pubTableHeader{
        display:flex;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
        align-items:flex-end;
      }

      .pubLegend{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        font-size:12px;
        color:var(--pub-muted);
        font-weight:900;
      }

      .pubDesktopOnly{ display:block; }
      .pubMobileOnly{ display:none; }

      .pubScrollX{
        overflow-x:auto;
        margin-top:14px;
      }

      .pubTable{
        min-width:980px;
        border-radius:18px;
        overflow:hidden;
        border:1px solid var(--pub-line);
        background:rgba(255,255,255,.75);
      }

      .pubHead{
        display:grid;
        gap:12px;
        padding:14px 14px;
        background:rgba(248,250,252,.96);
        border-bottom:1px solid var(--pub-line);
        font-weight:1000;
        font-size:12px;
        color:rgba(11,18,32,.72);
        position:sticky;
        top:0;
        z-index:2;
        text-transform:uppercase;
        letter-spacing:.05em;
      }

      .pubRow{
        display:grid;
        gap:12px;
        padding:14px;
        border-bottom:1px solid rgba(17,24,39,.05);
        align-items:center;
        background:rgba(255,255,255,.7);
      }

      .pubRow:hover{
        background:rgba(255,255,255,.92);
      }

      .pubRank{
        font-weight:1000;
        color:var(--pub-red);
        font-size:18px;
      }

      .pubNameWrap{ min-width:0; }
      .pubName{
        font-weight:1000;
        color:var(--pub-ink);
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .pubMiniMeta{
        margin-top:4px;
        font-size:11px;
        color:var(--pub-muted);
        font-weight:700;
      }

      .pubScoreCell{
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:4px;
      }

      .pubScore{
        font-variant-numeric:tabular-nums;
        font-weight:900;
        color:var(--pub-ink);
      }

      .pubMedalMini{
        font-size:14px;
        line-height:1;
      }

      .pubMedalSpacer{
        height:14px;
      }

      .pubTotal{
        font-variant-numeric:tabular-nums;
        font-weight:1000;
        color:var(--pub-red);
        font-size:17px;
      }

      .pubMobileCards{
        margin-top:14px;
        display:grid;
        gap:12px;
      }

      .pubMobileCard{
        border:1px solid var(--pub-line);
        background:rgba(255,255,255,.9);
        border-radius:18px;
        padding:14px;
        box-shadow:0 10px 24px rgba(2,8,23,.04);
      }

      .pubMobileTop{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
      }

      .pubMobileRank{
        font-size:12px;
        font-weight:950;
        color:var(--pub-red);
        text-transform:uppercase;
        letter-spacing:.05em;
      }

      .pubMobileName{
        margin-top:4px;
        font-size:18px;
        font-weight:1000;
        color:var(--pub-ink);
      }

      .pubMobileTotalWrap{
        min-width:88px;
        text-align:right;
      }

      .pubMobileTotalLabel{
        font-size:11px;
        color:var(--pub-muted);
        font-weight:900;
        text-transform:uppercase;
      }

      .pubMobileTotal{
        margin-top:4px;
        font-size:22px;
        font-weight:1000;
        color:var(--pub-red);
        font-variant-numeric:tabular-nums;
      }

      .pubMobileActivities{
        margin-top:12px;
        display:grid;
        gap:8px;
      }

      .pubMobileActivity{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
        padding:10px 12px;
        border-radius:14px;
        background:rgba(248,250,252,.9);
        border:1px solid rgba(17,24,39,.06);
      }

      .pubMobileActivityName{
        font-size:13px;
        font-weight:900;
        color:var(--pub-ink);
      }

      .pubMobileActivityValueWrap{
        display:flex;
        align-items:center;
        gap:10px;
      }

      .pubMobileActivityScore{
        font-size:15px;
        font-weight:1000;
        color:var(--pub-ink);
        font-variant-numeric:tabular-nums;
      }

      .pubMobileActivityMedal{
        min-width:18px;
        text-align:center;
        font-size:14px;
      }

      .pubEmpty{
        padding:26px;
        text-align:center;
        color:var(--pub-muted);
        font-weight:900;
        background:rgba(255,255,255,.82);
        display:flex;
        flex-direction:column;
        gap:10px;
        align-items:center;
        justify-content:center;
        border-radius:16px;
      }

      .pubLoader{
        width:28px;
        height:28px;
        border-radius:999px;
        border:3px solid rgba(225,29,46,.15);
        border-top-color:var(--pub-red);
        animation:spin .8s linear infinite;
      }

      .pubFooter{
        margin-top:14px;
        text-align:center;
        color:var(--pub-muted);
        font-size:12px;
        font-weight:800;
      }

      @keyframes spin{
        to{ transform:rotate(360deg); }
      }

      @media (max-width: 1100px){
        .pubStatsGrid{
          grid-template-columns:repeat(2, minmax(0,1fr));
        }
        .pubPodiumGrid{
          grid-template-columns:1fr;
        }
      }

      @media (max-width: 820px){
        .pubDesktopOnly{ display:none; }
        .pubMobileOnly{ display:grid; }
      }

      @media (max-width: 720px){
        .pubWrap{ padding:14px; }
        .pubStatsGrid{
          grid-template-columns:1fr;
        }
        .pubTitle{ font-size:30px; }
        .pubHeroRight,
        .pubFilterTools{
          width:100%;
        }
        .pubActionBtn,
        .pubSearch{
          width:100%;
        }
      }

      @media print{
        .pubActionBtn,
        .pubScroll,
        .pubToggle,
        .pubSearch,
        .pubFooter{
          display:none !important;
        }

        .pubDesktopOnly{ display:block !important; }
        .pubMobileOnly{ display:none !important; }

        .pubWrap{
          max-width:none;
          padding:0;
          background:#fff;
        }

        .pubCard,
        .pubPodiumCard,
        .pubStatCard{
          box-shadow:none;
          background:#fff;
          break-inside:avoid;
        }

        .pubHero{
          margin-bottom:10px;
        }
      }
    `}</style>
  );
}
