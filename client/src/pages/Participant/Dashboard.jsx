import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import NotificationBell from "../Components/notifications/NotificationBell.jsx";

const RED = "#e11d2e";
const AUTO_REFRESH_MS = 30000;
const LS_LOGO = "ra_admin_logo";
const LS_MODE = "ra_mode";
const LS_AUTO_REFRESH = "ra_participant_auto_refresh";

function readStorage(key, fallback = "") {
  try {
    if (typeof window === "undefined") return fallback;
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmt2(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function safeDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function safeDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function initials(name = "") {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function statusTone(completion) {
  const safe = num(completion, 0);
  if (safe >= 100) return "Completed";
  if (safe >= 60) return "In Progress";
  if (safe > 0) return "Started";
  return "Pending";
}

function getLogoSrc() {
  return readStorage(LS_LOGO, "") || `${import.meta.env.BASE_URL}logo.png`;
}

export default function ParticipantDashboard({ onLogout = () => {} }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [certBusy, setCertBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [mode, setMode] = useState(() => readStorage(LS_MODE, "light"));
  const [activeTab, setActiveTab] = useState("overview");
  const [autoRefresh, setAutoRefresh] = useState(
    () => readStorage(LS_AUTO_REFRESH, "1") !== "0",
  );
  const [logoSrc, setLogoSrc] = useState(() => getLogoSrc());

  useEffect(() => {
    writeStorage(LS_MODE, mode);
  }, [mode]);

  useEffect(() => {
    writeStorage(LS_AUTO_REFRESH, autoRefresh ? "1" : "0");
  }, [autoRefresh]);

  useEffect(() => {
    setLogoSrc(getLogoSrc());
  }, []);

  const loadDashboard = useCallback(
    async (kind = "initial", { silent = false } = {}) => {
      try {
        if (!silent) setErr("");
        if (kind === "initial") setLoading(true);
        else setRefreshing(true);

        const res = await api.meParticipant();
        setData(res || null);
        setLastUpdated(new Date().toISOString());
        return res || null;
      } catch (e) {
        const msg = e?.message || "Failed to load dashboard";
        if (!silent) setErr(msg);
        return null;
      } finally {
        if (kind === "initial") setLoading(false);
        else setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadDashboard("initial");
  }, [loadDashboard]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const timer = setInterval(() => {
      loadDashboard("refresh", { silent: true });
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timer);
  }, [autoRefresh, loadDashboard]);

  async function openCertificate() {
    try {
      setErr("");
      setCertBusy(true);
      await api.openParticipantCertificate();
    } catch (e) {
      setErr(e?.message || "Failed to open certificate");
    } finally {
      setCertBusy(false);
    }
  }

  const participant = data?.participant || null;
  const profile = participant?.userId || {};
  const group = participant?.groupId || {};
  const event = data?.event || participant?.eventId || null;
  const academy =
    data?.academy || participant?.academyId || event?.academyId || null;
  const certificateAvailable =
    data?.certificateAvailable !== false && !!participant?._id;

  const summary = useMemo(() => {
    const scoresRaw = Array.isArray(data?.scores) ? data.scores : [];
    const awardsRaw = Array.isArray(data?.awards) ? data.awards : [];

    const scores = [...scoresRaw]
      .map((s, index) => ({
        ...s,
        _rowKey:
          s?._id ||
          `${s?.activityId?._id || s?.activityId?.name || "activity"}-${
            s?.judgeUserId?._id || s?.judgeUserId?.name || "judge"
          }-${s?.createdAt || index}`,
        numericValue: num(s?.value, 0),
        activityName: s?.activityId?.name || "Untitled Activity",
        judgeName: s?.judgeUserId?.name || "—",
        createdLabel: safeDateTime(s?.createdAt),
      }))
      .sort((a, b) => {
        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        return bTime - aTime;
      });

    const awards = [...awardsRaw].map((a, index) => ({
      ...a,
      _rowKey: a?._id || `${a?.title || "award"}-${a?.type || "type"}-${index}`,
    }));

    const total = data?.total == null ? null : num(data.total, 0);
    const bestScore = scores.length
      ? Math.max(...scores.map((s) => s.numericValue))
      : null;
    const lowestScore = scores.length
      ? Math.min(...scores.map((s) => s.numericValue))
      : null;
    const avgScore = scores.length
      ? scores.reduce((a, s) => a + s.numericValue, 0) / scores.length
      : null;

    const sortedScores = [...scores].sort(
      (a, b) => b.numericValue - a.numericValue,
    );

    const bestItem = sortedScores[0] || null;
    const lowestItem = sortedScores.length
      ? sortedScores[sortedScores.length - 1]
      : null;

    const uniqueActivities = new Set(
      scores.map((s) => s?.activityId?._id || s?.activityName).filter(Boolean),
    ).size;

    const judgedBy = new Set(
      scores.map((s) => s?.judgeUserId?._id || s?.judgeName).filter(Boolean),
    ).size;

    const expectedActivities = num(data?.expectedActivities, 0);
    const completion =
      expectedActivities > 0
        ? Math.min(
            100,
            Math.round((uniqueActivities / expectedActivities) * 100),
          )
        : scores.length
          ? 100
          : 0;

    const activitySummaryMap = new Map();
    for (const s of scores) {
      const key = s?.activityId?._id || s?.activityName || "activity";
      const prev = activitySummaryMap.get(key) || {
        key,
        name: s?.activityName || "Untitled Activity",
        attempts: 0,
        total: 0,
        best: null,
        latest: null,
        latestAt: null,
      };
      prev.attempts += 1;
      prev.total += s.numericValue;
      prev.best =
        prev.best == null
          ? s.numericValue
          : Math.max(prev.best, s.numericValue);

      const t = new Date(s?.createdAt || 0).getTime();
      const latestT = new Date(prev.latestAt || 0).getTime();
      if (!prev.latestAt || t >= latestT) {
        prev.latest = s.numericValue;
        prev.latestAt = s?.createdAt || null;
      }

      activitySummaryMap.set(key, prev);
    }

    const activityCards = [...activitySummaryMap.values()]
      .map((item) => ({
        ...item,
        average:
          item.attempts > 0 ? Number(item.total) / Number(item.attempts) : null,
      }))
      .sort((a, b) => (b.best ?? 0) - (a.best ?? 0));

    const scoreTrend = [...scores]
      .sort((a, b) => {
        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        return aTime - bTime;
      })
      .map((s, idx) => ({
        idx: idx + 1,
        value: s.numericValue,
        label: s?.activityName || `Score ${idx + 1}`,
      }));

    const recentItems = [...scores]
      .sort((a, b) => {
        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 6);

    const topAwards = awards.slice(0, 4);

    return {
      name: profile?.name || "—",
      email: profile?.email || "—",
      phone: profile?.phone || participant?.phone || "—",
      groupName: group?.name || "—",
      groupLevel: group?.level || "",
      age: participant?.age ?? "—",
      bibNo: participant?.bibNo ?? "—",
      total: total == null ? "—" : fmt2(total),
      totalNumber: total,
      scores,
      awards,
      sortedScores,
      activityCards,
      scoreTrend,
      recentItems,
      topAwards,
      best: bestScore == null ? "—" : fmt2(bestScore),
      average: avgScore == null ? "—" : fmt2(avgScore),
      lowest: lowestScore == null ? "—" : fmt2(lowestScore),
      bestItem,
      lowestItem,
      uniqueActivities,
      judgedBy,
      completion,
      rank: data?.rank ?? participant?.rank ?? null,
      eventName: event?.name || data?.eventName || "General Event",
      eventDate:
        event?.startDate ||
        event?.date ||
        data?.eventDate ||
        participant?.eventDate ||
        null,
      category: participant?.category || data?.category || "—",
      academyName: academy?.name || "Rebel Angels",
      participantId: participant?._id || "—",
      joinedAt:
        participant?.createdAt || profile?.createdAt || data?.createdAt || null,
      expectedActivities,
      completionTone: statusTone(completion),
      avatarText: initials(profile?.name || "Participant") || "P",
    };
  }, [academy, data, event, group, participant, profile]);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "scores", label: "Scores" },
    { key: "activities", label: "Activities" },
    { key: "awards", label: "Awards" },
  ];

  return (
    <div className={mode === "dark" ? "raDark" : ""} style={page}>
      <StyleTag />
      <div className="raBgOrbs" />

      <div style={topBar}>
        <div className="raTopIdentity">
          <div style={logoWrap}>
            <img
              src={logoSrc}
              alt="Rebel Angels"
              style={logo}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = `${import.meta.env.BASE_URL}logo.png`;
              }}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={title}>Participant Dashboard</div>
            <div style={subtitle}>
              {summary.academyName} · Gymnastics Scoring · {summary.eventName}
            </div>
          </div>
        </div>

        <div className="raActionWrap">
          <NotificationBell panelWidth={360} maxItems={8} />

          <button
            type="button"
            className="raBtn"
            onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
          >
            {mode === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>

          <button
            type="button"
            className={`raBtn ${autoRefresh ? "raBtnActive" : ""}`}
            onClick={() => setAutoRefresh((v) => !v)}
            title="Toggle auto refresh"
          >
            {autoRefresh ? "⏱ Auto Refresh On" : "⏱ Auto Refresh Off"}
          </button>

          <button
            type="button"
            className="raBtn"
            onClick={() => loadDashboard("refresh")}
            disabled={refreshing || loading}
            title="Refresh dashboard"
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>

          {certificateAvailable ? (
            <button
              type="button"
              className="raBtnPrimary"
              onClick={openCertificate}
              disabled={certBusy}
              title="Open certificate"
            >
              {certBusy ? "Opening..." : "📄 Certificate"}
            </button>
          ) : (
            <button
              type="button"
              className="raBtnDisabled"
              disabled
              title="Certificate not available yet"
            >
              📄 Certificate
            </button>
          )}

          <button type="button" className="raBtnDanger" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      {!!err && (
        <div className="raErr">
          <div className="raErrRow">
            <div>
              <b>Oops:</b> {err}
            </div>
            <button
              type="button"
              className="raBtnMini"
              onClick={() => loadDashboard("refresh")}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="raShell">
          <div className="raSkeletonHero" />
          <div className="raSkeletonGrid">
            <div className="raSkeletonCard" />
            <div className="raSkeletonCard" />
            <div className="raSkeletonCard" />
            <div className="raSkeletonCard" />
          </div>
          <div className="raSkeletonWide" />
        </div>
      ) : !data ? (
        <div className="raCard raCardPad">
          <div className="raEmpty">{err || "No data available."}</div>
        </div>
      ) : (
        <>
          <div className="raHeroCard raCard">
            <div className="raHeroLeft">
              <div className="raHeroIdentity">
                <div className="raAvatar">{summary.avatarText}</div>

                <div style={{ minWidth: 0 }}>
                  <div className="raHeroEyebrow">Welcome back</div>
                  <div className="raHeroTitle">{summary.name}</div>
                  <div className="raHeroSub">
                    Group: {summary.groupName}{" "}
                    {summary.groupLevel ? `(${summary.groupLevel})` : ""}
                  </div>
                </div>
              </div>

              <div className="raHeroMeta">
                <span className="raBadge">Age: {summary.age}</span>
                <span className="raBadge">BIB: {summary.bibNo}</span>
                <span className="raBadge">Scores: {summary.scores.length}</span>
                <span className="raBadge">Awards: {summary.awards.length}</span>
                <span className="raBadge">{summary.completionTone}</span>
                {summary.rank != null ? (
                  <span className="raBadge">Rank: #{summary.rank}</span>
                ) : null}
              </div>

              <div className="raHeroMiniGrid">
                <MiniInfo
                  label="Participant ID"
                  value={String(summary.participantId)}
                />
                <MiniInfo label="Category" value={summary.category} />
                <MiniInfo
                  label="Event Date"
                  value={safeDate(summary.eventDate)}
                />
                <MiniInfo label="Joined" value={safeDate(summary.joinedAt)} />
              </div>
            </div>

            <div className="raHeroRight">
              <div className="raHeroScoreLabel">Current Total</div>
              <div className="raHeroScore">{summary.total}</div>
              <div className="raHeroUpdated">
                Updated: {safeDateTime(lastUpdated)}
              </div>

              <div className="raHeroRightStats">
                <div className="raHeroRightStat">
                  <span>Rank</span>
                  <b>{summary.rank != null ? `#${summary.rank}` : "—"}</b>
                </div>
                <div className="raHeroRightStat">
                  <span>Activities</span>
                  <b>{summary.uniqueActivities}</b>
                </div>
                <div className="raHeroRightStat">
                  <span>Judges</span>
                  <b>{summary.judgedBy}</b>
                </div>
              </div>
            </div>
          </div>

          <div className="raKpiRow">
            <MetricCard
              label="Best Score"
              value={summary.best}
              sub={summary.bestItem?.activityName || "Highest score achieved"}
            />
            <MetricCard
              label="Average Score"
              value={summary.average}
              sub="Mean across all score entries"
            />
            <MetricCard
              label="Lowest Score"
              value={summary.lowest}
              sub={summary.lowestItem?.activityName || "Lowest recorded score"}
            />
            <MetricCard
              label="Completion"
              value={`${summary.completion}%`}
              sub={
                summary.expectedActivities > 0
                  ? `${summary.uniqueActivities}/${summary.expectedActivities} activities`
                  : "Scoring progress"
              }
            />
          </div>

          <div className="raQuickStrip">
            <QuickChip label="Email" value={summary.email} />
            <QuickChip label="Phone" value={summary.phone} />
            <QuickChip label="Academy" value={summary.academyName} />
            <QuickChip label="Event" value={summary.eventName} />
          </div>

          <div className="raTabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`raTab ${activeTab === tab.key ? "raTabActive" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <>
              <div className="raSummaryGrid">
                <div className="raCard raCardPad">
                  <SectionHead
                    title="Profile Summary"
                    sub="Participant profile and event details"
                    right={
                      <span className="raPill">Total: {summary.total}</span>
                    }
                  />

                  <div className="raKpiGrid">
                    <Kpi label="Name" value={summary.name} />
                    <Kpi label="Email" value={summary.email} />
                    <Kpi label="Phone" value={summary.phone} />
                    <Kpi
                      label="Group"
                      value={`${summary.groupName}${summary.groupLevel ? ` (${summary.groupLevel})` : ""}`}
                    />
                    <Kpi label="Category" value={summary.category} />
                    <Kpi label="Age" value={String(summary.age)} />
                    <Kpi label="BIB No" value={String(summary.bibNo)} />
                    <Kpi label="Academy" value={summary.academyName} />
                    <Kpi label="Event" value={summary.eventName} />
                    <Kpi
                      label="Event Date"
                      value={safeDate(summary.eventDate)}
                    />
                    <Kpi
                      label="Activities"
                      value={String(summary.uniqueActivities)}
                    />
                    <Kpi label="Judges" value={String(summary.judgedBy)} />
                  </div>

                  <div className="raDivider" />

                  <div className="raProgressWrap">
                    <div className="raProgressTop">
                      <div className="raMiniTitle">Progress</div>
                      <div className="raMiniValue">{summary.completion}%</div>
                    </div>
                    <ProgressBar value={summary.completion} />
                  </div>

                  <div className="raDivider" />

                  <div className="raRow raBetween">
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      Certificate is generated from your current approved
                      results.
                    </div>

                    {certificateAvailable ? (
                      <button
                        type="button"
                        className="raLinkBtn"
                        onClick={openCertificate}
                        disabled={certBusy}
                      >
                        {certBusy ? "Opening..." : "Open Certificate PDF →"}
                      </button>
                    ) : (
                      <span className="raMutedText">
                        Certificate not available yet
                      </span>
                    )}
                  </div>
                </div>

                <div className="raCard raCardPad">
                  <SectionHead
                    title="Performance Insights"
                    sub="Quick analytical snapshot"
                  />

                  <div className="raStats">
                    <StatRow
                      label="Top Activity"
                      value={summary.bestItem?.activityName || "—"}
                    />
                    <StatRow label="Top Score" value={summary.best} />
                    <StatRow
                      label="Lowest Activity"
                      value={summary.lowestItem?.activityName || "—"}
                    />
                    <StatRow label="Lowest Score" value={summary.lowest} />
                    <StatRow
                      label="Awards Earned"
                      value={String(summary.awards.length)}
                    />
                    <StatRow
                      label="Current Rank"
                      value={summary.rank != null ? `#${summary.rank}` : "—"}
                    />
                    <StatRow
                      label="Auto Refresh"
                      value={autoRefresh ? "Enabled" : "Disabled"}
                    />
                    <StatRow label="Status" value={summary.completionTone} />
                  </div>

                  <div className="raHint">
                    Tip: Review your scores regularly and contact coach/admin if
                    any activity appears missing.
                  </div>
                </div>
              </div>

              <div className="raOverviewBottom">
                <div className="raCard raCardPad">
                  <SectionHead
                    title="Recent Score Activity"
                    sub="Latest recorded score entries"
                    right={
                      <span className="raPill">
                        {summary.recentItems.length} recent
                      </span>
                    }
                  />

                  {summary.recentItems.length ? (
                    <div className="raTimeline">
                      {summary.recentItems.map((s) => (
                        <div className="raTimelineItem" key={s._rowKey}>
                          <div className="raTimelineDot" />
                          <div className="raTimelineBody">
                            <div className="raTimelineTop">
                              <div className="raTimelineTitle">
                                {s.activityName}
                              </div>
                              <div className="raScorePill">
                                {fmt2(s.numericValue)}
                              </div>
                            </div>
                            <div className="raTimelineMeta">
                              Judge: {s.judgeName} · {s.createdLabel}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="raEmpty">No recent score activity.</div>
                  )}
                </div>

                <div className="raCard raCardPad">
                  <SectionHead title="Highlights" sub="Quick spotlight cards" />

                  <div className="raHighlightGrid">
                    <HighlightCard
                      title="Top Activity"
                      value={summary.bestItem?.activityName || "—"}
                      sub={`Best: ${summary.best}`}
                    />
                    <HighlightCard
                      title="Lowest Activity"
                      value={summary.lowestItem?.activityName || "—"}
                      sub={`Lowest: ${summary.lowest}`}
                    />
                    <HighlightCard
                      title="Award Count"
                      value={String(summary.awards.length)}
                      sub="Recognitions earned so far"
                    />
                    <HighlightCard
                      title="Completion Status"
                      value={summary.completionTone}
                      sub={`${summary.completion}% progress`}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "scores" && (
            <div className="raBottomGridFull">
              <div className="raCard raCardPad">
                <SectionHead
                  title="Scores"
                  sub="Sorted by highest score first"
                  right={
                    <span className="raPill">
                      {summary.sortedScores.length} items
                    </span>
                  }
                />

                {summary.sortedScores.length ? (
                  <div className="raList">
                    {summary.sortedScores.map((s, index) => (
                      <div className="raListItem raScoreRow" key={s._rowKey}>
                        <div className="raScoreIndex">{index + 1}</div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="raListTitle">{s.activityName}</div>
                          <div className="raListSub">
                            Judge: {s.judgeName}
                            {s?.createdAt
                              ? ` · ${safeDateTime(s.createdAt)}`
                              : ""}
                          </div>
                        </div>

                        <div className="raScorePill">
                          {fmt2(s.numericValue)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="raEmpty">No scores yet.</div>
                )}
              </div>

              <div className="raCard raCardPad">
                <SectionHead
                  title="Score Trend Snapshot"
                  sub="Chronological score sequence"
                />

                {summary.scoreTrend.length ? (
                  <div className="raTrendList">
                    {summary.scoreTrend.map((item) => {
                      const pct =
                        summary.best !== "—" &&
                        num(summary.bestItem?.numericValue, 0) > 0
                          ? Math.max(
                              8,
                              Math.round(
                                (num(item.value, 0) /
                                  num(summary.bestItem?.numericValue, 1)) *
                                  100,
                              ),
                            )
                          : 12;

                      return (
                        <div
                          className="raTrendRow"
                          key={`${item.idx}-${item.label}`}
                        >
                          <div className="raTrendLabel">
                            <span className="raTrendNo">{item.idx}</span>
                            <span className="raTrendName">{item.label}</span>
                          </div>

                          <div className="raTrendBarWrap">
                            <div
                              className="raTrendBar"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>

                          <div className="raTrendValue">{fmt2(item.value)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="raEmpty">No trend data yet.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "activities" && (
            <div className="raActivitiesGrid">
              {summary.activityCards.length ? (
                summary.activityCards.map((item) => (
                  <div className="raCard raCardPad" key={item.key}>
                    <div className="raActivityTop">
                      <div>
                        <div className="raCardTitle">{item.name}</div>
                        <div className="raCardSub">
                          {item.attempts} score entr
                          {item.attempts === 1 ? "y" : "ies"}
                        </div>
                      </div>
                      <div className="raTag">🤸</div>
                    </div>

                    <div className="raActivityStats">
                      <MiniMetric label="Best" value={fmt2(item.best)} />
                      <MiniMetric label="Average" value={fmt2(item.average)} />
                      <MiniMetric label="Latest" value={fmt2(item.latest)} />
                    </div>

                    <div className="raDivider" />

                    <div className="raMutedText">
                      Last updated: {safeDateTime(item.latestAt)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="raCard raCardPad">
                  <div className="raEmpty">
                    No activity summary available yet.
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "awards" && (
            <div className="raBottomGridFull">
              <div className="raCard raCardPad">
                <SectionHead
                  title="Awards"
                  sub="Your achievements and recognitions"
                  right={
                    <span className="raPill">
                      {summary.awards.length} items
                    </span>
                  }
                />

                {summary.awards.length ? (
                  <div className="raList">
                    {summary.awards.map((a) => (
                      <div className="raListItem" key={a._rowKey}>
                        <div style={{ minWidth: 0 }}>
                          <div className="raListTitle">{a?.title || "—"}</div>
                          <div className="raListSub">
                            {a?.type || "Award"}
                            {a?.createdAt
                              ? ` · ${safeDateTime(a.createdAt)}`
                              : ""}
                          </div>
                        </div>
                        <div className="raTag">🎖️</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="raEmpty">No awards yet.</div>
                )}
              </div>

              <div className="raCard raCardPad">
                <SectionHead
                  title="Award Highlights"
                  sub="Spotlight recognitions"
                />

                {summary.topAwards.length ? (
                  <div className="raHighlightGrid">
                    {summary.topAwards.map((a) => (
                      <HighlightCard
                        key={a._rowKey}
                        title={a?.title || "Award"}
                        value={a?.type || "Recognition"}
                        sub={a?.createdAt ? safeDate(a.createdAt) : "—"}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="raEmpty">No award highlights yet.</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionHead({ title, sub, right = null }) {
  return (
    <div className="raCardHead">
      <div>
        <div className="raCardTitle">{title}</div>
        {sub ? <div className="raCardSub">{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="raCard raCardPad">
      <div className="raMetricLabel">{label}</div>
      <div className="raMetricValue">{value}</div>
      <div className="raMetricSub">{sub}</div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="raKpi">
      <div className="raKpiLabel">{label}</div>
      <div className="raKpiValue" title={String(value)}>
        {value}
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="raStatRow">
      <div className="raStatLabel">{label}</div>
      <div className="raStatValue">{value}</div>
    </div>
  );
}

function ProgressBar({ value = 0 }) {
  const safe = Math.max(0, Math.min(100, num(value, 0)));
  return (
    <div className="raProgress">
      <div className="raProgressFill" style={{ width: `${safe}%` }} />
    </div>
  );
}

function MiniInfo({ label, value }) {
  return (
    <div className="raMiniInfo">
      <div className="raMiniInfoLabel">{label}</div>
      <div className="raMiniInfoValue" title={String(value)}>
        {value}
      </div>
    </div>
  );
}

function QuickChip({ label, value }) {
  return (
    <div className="raQuickChip">
      <span>{label}</span>
      <b title={String(value)}>{value}</b>
    </div>
  );
}

function HighlightCard({ title, value, sub }) {
  return (
    <div className="raHighlightCard">
      <div className="raHighlightTitle">{title}</div>
      <div className="raHighlightValue" title={String(value)}>
        {value}
      </div>
      <div className="raHighlightSub">{sub}</div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="raMiniMetric">
      <div className="raMiniMetricLabel">{label}</div>
      <div className="raMiniMetricValue">{value}</div>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  padding: 20,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  maxWidth: 1400,
  margin: "0 auto",
  position: "relative",
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 14,
  position: "relative",
  zIndex: 2,
};

const logoWrap = {
  width: 58,
  height: 58,
  borderRadius: 18,
  background: "rgba(255,255,255,0.85)",
  border: "1px solid rgba(17,24,39,0.08)",
  boxShadow: "0 18px 40px rgba(17,24,39,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(10px)",
  flexShrink: 0,
};

const logo = { height: 42, width: "auto" };
const title = { fontSize: 24, fontWeight: 950, lineHeight: 1.1 };
const subtitle = { fontSize: 12, opacity: 0.72, marginTop: 4 };

function StyleTag() {
  return (
    <style>{`
      :root{
        --bg0: radial-gradient(1200px 500px at 20% 0%, rgba(225,29,46,0.10), transparent 60%),
               radial-gradient(900px 400px at 90% 10%, rgba(17,24,39,0.08), transparent 55%),
               #f8fafc;
        --card: rgba(255,255,255,0.88);
        --card2: rgba(255,255,255,0.72);
        --txt: #0b1220;
        --muted: rgba(11,18,32,0.72);
        --border: rgba(17,24,39,0.10);
        --shadow: 0 18px 55px rgba(17,24,39,0.10);
        --red: ${RED};
        --pill: rgba(255,241,242,0.92);
        --pillBorder: rgba(225,29,46,0.22);
        --track: rgba(225,29,46,0.12);
        --successTrack: rgba(225,29,46,0.12);
      }

      .raDark{
        --bg0: radial-gradient(1200px 500px at 20% 0%, rgba(225,29,46,0.16), transparent 60%),
               radial-gradient(900px 400px at 90% 10%, rgba(255,255,255,0.06), transparent 55%),
               #0b1220;
        --card: rgba(17,24,39,0.74);
        --card2: rgba(17,24,39,0.56);
        --txt: rgba(255,255,255,0.92);
        --muted: rgba(255,255,255,0.70);
        --border: rgba(255,255,255,0.10);
        --shadow: 0 24px 70px rgba(0,0,0,0.35);
        --pill: rgba(225,29,46,0.12);
        --pillBorder: rgba(225,29,46,0.25);
        --track: rgba(255,255,255,0.08);
        --successTrack: rgba(255,255,255,0.08);
      }

      html, body, #root {
        background: var(--bg0);
      }

      body{
        background: var(--bg0);
        color: var(--txt);
      }

      .raBgOrbs{
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 0;
      }

      .raTopIdentity{
        display:flex;
        align-items:center;
        gap:12px;
        min-width:0;
      }

      .raActionWrap{
        display:flex;
        gap:10px;
        align-items:center;
        flex-wrap:wrap;
      }

      .raCard{
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 22px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(14px);
        position: relative;
        z-index: 1;
      }

      .raCardPad{ padding: 16px; }

      .raHeroCard{
        padding: 18px;
        display:grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(260px, .8fr);
        gap: 16px;
        align-items:center;
        margin-bottom: 14px;
      }

      @media(max-width: 920px){
        .raHeroCard{ grid-template-columns: 1fr; }
      }

      .raHeroIdentity{
        display:flex;
        align-items:center;
        gap:14px;
        min-width:0;
      }

      .raAvatar{
        width:68px;
        height:68px;
        border-radius:20px;
        display:flex;
        align-items:center;
        justify-content:center;
        background: linear-gradient(135deg, rgba(225,29,46,.18), rgba(225,29,46,.32));
        color: var(--red);
        font-weight: 950;
        font-size: 24px;
        border: 1px solid var(--pillBorder);
        flex-shrink:0;
      }

      .raHeroEyebrow{
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: var(--muted);
        font-weight: 900;
      }

      .raHeroTitle{
        font-size: 28px;
        line-height: 1.1;
        font-weight: 950;
        color: var(--txt);
        margin-top: 6px;
        word-break: break-word;
      }

      .raHeroSub{
        margin-top: 8px;
        font-size: 13px;
        color: var(--muted);
        font-weight: 700;
      }

      .raHeroMeta{
        display:flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
      }

      .raHeroMiniGrid{
        display:grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap:10px;
        margin-top:14px;
      }

      @media(max-width: 1100px){
        .raHeroMiniGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media(max-width: 560px){
        .raHeroMiniGrid{ grid-template-columns: 1fr; }
      }

      .raMiniInfo{
        background: var(--card2);
        border:1px solid var(--border);
        border-radius:16px;
        padding:10px 12px;
        min-width:0;
      }

      .raMiniInfoLabel{
        font-size:11px;
        color: var(--muted);
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .04em;
      }

      .raMiniInfoValue{
        margin-top: 6px;
        font-size: 13px;
        font-weight: 900;
        color: var(--txt);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .raHeroRight{
        min-width: 0;
        text-align: right;
        display:flex;
        flex-direction:column;
        gap:10px;
        align-items:flex-end;
      }

      @media(max-width: 920px){
        .raHeroRight{
          text-align:left;
          align-items:flex-start;
        }
      }

      .raHeroScoreLabel{
        font-size: 12px;
        color: var(--muted);
        font-weight: 900;
      }

      .raHeroScore{
        font-size: 38px;
        font-weight: 950;
        color: var(--red);
        line-height: 1.1;
        margin-top: 2px;
      }

      .raHeroUpdated{
        font-size: 12px;
        color: var(--muted);
      }

      .raHeroRightStats{
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap:10px;
        width:100%;
        margin-top: 4px;
      }

      .raHeroRightStat{
        border:1px solid var(--border);
        background: var(--card2);
        border-radius:16px;
        padding:10px 12px;
        text-align:center;
      }

      .raHeroRightStat span{
        display:block;
        font-size:11px;
        color: var(--muted);
        font-weight:800;
      }

      .raHeroRightStat b{
        display:block;
        margin-top:6px;
        font-size:15px;
        color: var(--txt);
      }

      @media(max-width: 520px){
        .raHeroRightStats{ grid-template-columns: 1fr; }
      }

      .raCardHead{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }

      .raCardTitle{
        font-weight: 950;
        font-size: 16px;
        color: var(--txt);
      }

      .raCardSub{
        margin-top: 4px;
        font-size: 12px;
        color: var(--muted);
      }

      .raKpiRow{
        display:grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 14px;
      }

      @media(max-width: 1080px){
        .raKpiRow{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media(max-width: 640px){
        .raKpiRow{ grid-template-columns: 1fr; }
      }

      .raMetricLabel{
        font-size: 12px;
        color: var(--muted);
        font-weight: 900;
      }

      .raMetricValue{
        font-size: 24px;
        font-weight: 950;
        color: var(--txt);
        margin-top: 8px;
      }

      .raMetricSub{
        font-size: 12px;
        color: var(--muted);
        margin-top: 6px;
      }

      .raQuickStrip{
        display:grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 14px;
      }

      @media(max-width: 1080px){
        .raQuickStrip{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media(max-width: 640px){
        .raQuickStrip{ grid-template-columns: 1fr; }
      }

      .raQuickChip{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
        min-width:0;
        border:1px solid var(--border);
        background: var(--card);
        border-radius:18px;
        padding:12px 14px;
        box-shadow: var(--shadow);
      }

      .raQuickChip span{
        font-size:12px;
        color:var(--muted);
        font-weight:900;
        flex-shrink:0;
      }

      .raQuickChip b{
        font-size:13px;
        color:var(--txt);
        font-weight:950;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .raTabs{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-bottom:14px;
      }

      .raTab{
        height:40px;
        padding:0 14px;
        border-radius:999px;
        border:1px solid var(--border);
        background: rgba(255,255,255,0.72);
        color: var(--txt);
        cursor:pointer;
        font-weight:900;
      }

      .raTabActive{
        border-color: rgba(225,29,46,0.30);
        background: rgba(255,241,242,0.92);
        color: var(--red);
      }

      .raSummaryGrid{
        display:grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 14px;
        align-items: start;
      }

      .raOverviewBottom{
        display:grid;
        grid-template-columns: 1.35fr 1fr;
        gap:14px;
        margin-top:14px;
        align-items:start;
      }

      .raBottomGridFull{
        display:grid;
        grid-template-columns: 1.25fr .9fr;
        gap:14px;
        align-items:start;
      }

      .raActivitiesGrid{
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap:14px;
      }

      @media(max-width: 1200px){
        .raActivitiesGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media(max-width: 980px){
        .raSummaryGrid,
        .raOverviewBottom,
        .raBottomGridFull,
        .raActivitiesGrid{
          grid-template-columns: 1fr;
        }
      }

      .raBadge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding: 8px 12px;
        border-radius: 999px;
        background: var(--pill);
        border: 1px solid var(--pillBorder);
        color: var(--txt);
        font-weight: 950;
        font-size: 12px;
      }

      .raPill{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,0.55);
        border: 1px solid var(--border);
        color: var(--txt);
        font-weight: 950;
        font-size: 12px;
      }

      .raRow{ display:flex; align-items:center; gap: 10px; }
      .raBetween{ justify-content:space-between; flex-wrap:wrap; }
      .raDivider{ height: 1px; background: var(--border); margin: 14px 0; }

      .raKpiGrid{
        display:grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      @media(max-width: 920px){
        .raKpiGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media(max-width: 520px){
        .raKpiGrid{ grid-template-columns: 1fr; }
      }

      .raKpi{
        background: var(--card2);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 12px;
        min-width: 0;
      }

      .raKpiLabel{
        font-size: 12px;
        color: var(--muted);
        font-weight: 800;
      }

      .raKpiValue{
        margin-top: 6px;
        font-size: 14px;
        font-weight: 950;
        color: var(--txt);
        overflow:hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .raStats{
        margin-top: 12px;
        border: 1px solid var(--border);
        border-radius: 18px;
        overflow:hidden;
        background: var(--card2);
      }

      .raStatRow{
        display:flex;
        justify-content:space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--border);
      }

      .raStatRow:last-child{ border-bottom:none; }

      .raStatLabel{
        color: var(--muted);
        font-size: 12px;
        font-weight: 800;
      }

      .raStatValue{
        color: var(--txt);
        font-size: 12px;
        font-weight: 950;
        text-align:right;
      }

      .raHint{
        margin-top: 12px;
        font-size: 12px;
        color: var(--muted);
      }

      .raList{
        display:flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 6px;
      }

      .raListItem{
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: var(--card2);
      }

      .raScoreRow{
        display:grid;
        grid-template-columns: 44px minmax(0,1fr) auto;
      }

      @media(max-width: 560px){
        .raScoreRow{
          grid-template-columns: 36px minmax(0,1fr);
        }
        .raScoreRow .raScorePill{
          grid-column: 2 / 3;
          justify-self: start;
          margin-top: 8px;
        }
      }

      .raScoreIndex{
        width:34px;
        height:34px;
        border-radius:12px;
        display:flex;
        align-items:center;
        justify-content:center;
        border:1px solid var(--border);
        background: rgba(255,255,255,.55);
        color: var(--txt);
        font-size:12px;
        font-weight:950;
      }

      .raListTitle{
        color: var(--txt);
        font-weight: 950;
        font-size: 13px;
        overflow:hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .raListSub{
        color: var(--muted);
        font-size: 12px;
        margin-top: 2px;
      }

      .raScorePill{
        min-width: 74px;
        height: 34px;
        padding: 0 10px;
        border-radius: 999px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        font-weight: 950;
        color: var(--red);
        border: 1px solid var(--pillBorder);
        background: var(--pill);
        flex-shrink: 0;
      }

      .raTag{
        width: 36px;
        height: 36px;
        border-radius: 14px;
        display:flex;
        align-items:center;
        justify-content:center;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.55);
        flex-shrink: 0;
      }

      .raLinkBtn{
        border: none;
        background: transparent;
        padding: 0;
        margin: 0;
        font: inherit;
        font-weight: 900;
        color: var(--red);
        cursor: pointer;
      }

      .raLinkBtn:hover{
        text-decoration: underline;
      }

      .raLinkBtn:disabled{
        opacity: .7;
        cursor: not-allowed;
        text-decoration: none;
      }

      .raBtn, .raBtnPrimary, .raBtnDanger, .raBtnDisabled, .raBtnMini{
        height: 40px;
        padding: 0 14px;
        border-radius: 14px;
        cursor: pointer;
        font-weight: 950;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.85);
        color: var(--txt);
      }

      .raBtnMini{
        height: 34px;
        padding: 0 12px;
        border-radius: 12px;
      }

      .raBtnActive{
        border-color: rgba(225,29,46,0.30);
        color: var(--red);
        background: rgba(255,241,242,0.92);
      }

      .raBtnPrimary{
        border-color: rgba(225,29,46,0.30);
        background: rgba(255,241,242,0.92);
        color: var(--red);
        display:inline-flex;
        align-items:center;
        justify-content:center;
      }

      .raBtnDanger{
        border-color: rgba(225,29,46,0.30);
        background: rgba(225,29,46,0.12);
        color: var(--red);
      }

      .raBtnDisabled{
        opacity: .55;
        cursor: not-allowed;
        background: rgba(148,163,184,0.15);
      }

      .raBtn:hover, .raBtnPrimary:hover, .raBtnDanger:hover, .raBtnMini:hover, .raTab:hover{
        box-shadow: 0 14px 34px rgba(2,8,23,0.10);
      }

      .raBtn:disabled, .raBtnPrimary:disabled{
        opacity:.7;
        cursor:not-allowed;
      }

      .raErr{
        margin-top: 12px;
        margin-bottom: 12px;
        padding: 12px 14px;
        border-radius: 16px;
        border: 1px solid rgba(225,29,46,0.22);
        background: rgba(255,241,242,0.92);
        color: var(--red);
        font-weight: 850;
        position: relative;
        z-index: 1;
      }

      .raErrRow{
        display:flex;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
      }

      .raEmpty{
        margin-top: 12px;
        padding: 14px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--card2);
        color: var(--muted);
        text-align:center;
        font-weight: 850;
      }

      .raMutedText{
        color: var(--muted);
        font-size: 12px;
        font-weight: 800;
      }

      .raShell{
        display:grid;
        gap: 14px;
        margin-top: 12px;
      }

      .raSkeletonHero,
      .raSkeletonWide,
      .raSkeletonCard{
        border-radius: 22px;
        border: 1px solid var(--border);
        background: linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0.40), rgba(255,255,255,0.22));
        background-size: 220% 100%;
        animation: raShimmer 1.2s infinite linear;
      }

      .raSkeletonHero{ height: 220px; }
      .raSkeletonWide{ height: 260px; }

      .raSkeletonGrid{
        display:grid;
        grid-template-columns: repeat(4, minmax(0,1fr));
        gap:14px;
      }

      @media(max-width: 1080px){
        .raSkeletonGrid{ grid-template-columns: repeat(2, minmax(0,1fr)); }
      }

      @media(max-width: 640px){
        .raSkeletonGrid{ grid-template-columns: 1fr; }
      }

      .raSkeletonCard{ height: 140px; }

      .raDark .raSkeletonHero,
      .raDark .raSkeletonWide,
      .raDark .raSkeletonCard{
        background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06));
        background-size: 220% 100%;
      }

      .raProgressWrap{
        display:flex;
        flex-direction:column;
        gap:10px;
      }

      .raProgressTop{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
      }

      .raMiniTitle{
        font-size:12px;
        font-weight:900;
        color:var(--muted);
      }

      .raMiniValue{
        font-size:12px;
        font-weight:950;
        color:var(--txt);
      }

      .raProgress{
        width:100%;
        height:12px;
        border-radius:999px;
        background:var(--successTrack);
        overflow:hidden;
        border:1px solid var(--border);
      }

      .raProgressFill{
        height:100%;
        border-radius:999px;
        background: linear-gradient(90deg, rgba(225,29,46,0.72), rgba(225,29,46,1));
      }

      .raTimeline{
        display:flex;
        flex-direction:column;
        gap:12px;
      }

      .raTimelineItem{
        display:grid;
        grid-template-columns: 18px minmax(0,1fr);
        gap:12px;
        align-items:flex-start;
      }

      .raTimelineDot{
        width:12px;
        height:12px;
        border-radius:999px;
        margin-top:8px;
        background: var(--red);
        box-shadow: 0 0 0 6px rgba(225,29,46,0.10);
      }

      .raTimelineBody{
        border:1px solid var(--border);
        background: var(--card2);
        border-radius:18px;
        padding:12px;
      }

      .raTimelineTop{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
        flex-wrap:wrap;
      }

      .raTimelineTitle{
        font-weight:950;
        color:var(--txt);
        font-size:13px;
      }

      .raTimelineMeta{
        margin-top:6px;
        font-size:12px;
        color:var(--muted);
      }

      .raHighlightGrid{
        display:grid;
        grid-template-columns: repeat(2, minmax(0,1fr));
        gap:12px;
      }

      @media(max-width: 560px){
        .raHighlightGrid{ grid-template-columns: 1fr; }
      }

      .raHighlightCard{
        border:1px solid var(--border);
        background: var(--card2);
        border-radius:18px;
        padding:14px;
        min-width:0;
      }

      .raHighlightTitle{
        font-size:12px;
        color:var(--muted);
        font-weight:900;
      }

      .raHighlightValue{
        margin-top:8px;
        font-size:18px;
        font-weight:950;
        color:var(--txt);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .raHighlightSub{
        margin-top:6px;
        font-size:12px;
        color:var(--muted);
      }

      .raTrendList{
        display:flex;
        flex-direction:column;
        gap:12px;
      }

      .raTrendRow{
        display:grid;
        grid-template-columns: minmax(140px, 220px) minmax(0, 1fr) 70px;
        gap:12px;
        align-items:center;
      }

      @media(max-width: 640px){
        .raTrendRow{
          grid-template-columns: 1fr;
          gap:8px;
        }
      }

      .raTrendLabel{
        display:flex;
        gap:10px;
        align-items:center;
        min-width:0;
      }

      .raTrendNo{
        width:28px;
        height:28px;
        border-radius:10px;
        border:1px solid var(--border);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:11px;
        font-weight:950;
        flex-shrink:0;
        background: var(--card2);
      }

      .raTrendName{
        font-size:13px;
        font-weight:900;
        color:var(--txt);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .raTrendBarWrap{
        height:12px;
        border-radius:999px;
        overflow:hidden;
        border:1px solid var(--border);
        background: var(--track);
      }

      .raTrendBar{
        height:100%;
        border-radius:999px;
        background: linear-gradient(90deg, rgba(225,29,46,0.65), rgba(225,29,46,1));
      }

      .raTrendValue{
        font-size:13px;
        font-weight:950;
        color:var(--red);
        text-align:right;
      }

      @media(max-width: 640px){
        .raTrendValue{ text-align:left; }
      }

      .raActivityTop{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
      }

      .raActivityStats{
        display:grid;
        grid-template-columns: repeat(3, minmax(0,1fr));
        gap:10px;
        margin-top:14px;
      }

      @media(max-width: 560px){
        .raActivityStats{ grid-template-columns: 1fr; }
      }

      .raMiniMetric{
        border:1px solid var(--border);
        background: var(--card2);
        border-radius:16px;
        padding:10px 12px;
      }

      .raMiniMetricLabel{
        font-size:11px;
        color:var(--muted);
        font-weight:900;
        text-transform:uppercase;
      }

      .raMiniMetricValue{
        margin-top:6px;
        font-size:15px;
        font-weight:950;
        color:var(--txt);
      }

      @keyframes raShimmer{
        0%{ background-position: 0% 0%; }
        100%{ background-position: 220% 0%; }
      }
    `}</style>
  );
}
