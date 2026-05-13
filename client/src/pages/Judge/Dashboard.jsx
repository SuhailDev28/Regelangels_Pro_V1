import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../../lib/api.js";
import {
  getSocket,
  joinJudgeScoringRooms,
  leaveJudgeScoringRooms,
} from "../../lib/socket.js";
import {
  getToken,
  clearToken,
  clearUser,
  getEffectiveAcademy,
} from "../../lib/auth.js";
import PWAInstallButton from "../../components/PWAInstallButton.jsx";

const RED = "#e11d2e";
const SAVE_DEBOUNCE_MS = 1200;
const LS_DRAFTS_KEY = "ra_judge_score_drafts_v2";
const LS_JUDGE_ONBOARDING_KEY = "ra_judge_onboarding_v1";
const LS_LOGO = "ra_admin_logo";

const STATUS_OPTIONS = [
  { value: "SCORED", label: "Scored" },
  { value: "ABSENT", label: "Absent" },
  { value: "DQ", label: "Disqualified" },
  { value: "RETRY", label: "Retry" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const SPECIAL_STATUSES = ["ABSENT", "DQ", "RETRY", "WITHDRAWN"];
const LIVE_EVENT_STATUSES = ["LIVE", "SCORING"];

const ONBOARDING_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Judge Dashboard",
    text: "This screen is where you select your event, open an assigned activity, enter scores, send help requests, and finalize the activity when all participants are complete.",
    anchor: "jd-step-top",
    placement: "bottom",
  },
  {
    id: "event",
    title: "1. Select your event",
    text: "Choose the event you are judging. The dashboard loads your assignments and participants for that event.",
    anchor: "jd-step-event",
    placement: "bottom",
  },
  {
    id: "activity",
    title: "2. Select an activity",
    text: "Pick the activity you are currently judging. Scores are always saved per activity.",
    anchor: "jd-step-activity",
    placement: "bottom",
  },
  {
    id: "filters",
    title: "3. Filter the participant list",
    text: "Use the Group list, Level list, status filters, and search to narrow the participant list quickly during live judging.",
    anchor: "jd-step-filters",
    placement: "bottom",
  },
  {
    id: "scoring",
    title: "4. Enter scores",
    text: "Choose a status, type the score, and the row auto-saves. Press Enter to save and move to the next participant.",
    anchor: "jd-step-table",
    placement: "top",
  },
  {
    id: "help",
    title: "5. Request help",
    text: "Use Help when you need admin, technical, participant, or scoring support. The event and activity context are included automatically.",
    anchor: "jd-step-help",
    placement: "bottom",
  },
  {
    id: "finalize",
    title: "6. Finalize the activity",
    text: "Finalize only after all participants are completed. Once finalized, score inputs become read-only.",
    anchor: "jd-step-finalize",
    placement: "bottom",
  },
];

function isBrowserOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

function getStoredJudgeUser() {
  if (typeof window === "undefined") return null;

  const keys = [
    "gym_user",
    "ra_user",
    "user",
    "kidgage_user",
    "judge_user",
    "auth_user",
  ];

  for (const key of keys) {
    try {
      const fromSession = sessionStorage.getItem(key);
      if (fromSession) return JSON.parse(fromSession);

      const fromLocal = localStorage.getItem(key);
      if (fromLocal) return JSON.parse(fromLocal);
    } catch {
      // ignore
    }
  }

  return null;
}

export default function Dashboard({ onLogout }) {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [asg, setAsg] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [activityId, setActivityId] = useState("");

  const [scoreMap, setScoreMap] = useState({});
  const [finalizedMap, setFinalizedMap] = useState({});
  const [notice, setNotice] = useState(null);
  const [activeHelpAlert, setActiveHelpAlert] = useState(null);
  const [liveNotice, setLiveNotice] = useState(null);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshingScores, setRefreshingScores] = useState(false);

  const [groupFilter, setGroupFilter] = useState("ALL");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [helpOpen, setHelpOpen] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [helpCategory, setHelpCategory] = useState("ADMIN");
  const [helpPriority, setHelpPriority] = useState("HIGH");
  const [helpSending, setHelpSending] = useState(false);

  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const [isOnline, setIsOnline] = useState(() => isBrowserOnline());

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [onboardingRunId, setOnboardingRunId] = useState(0);

  const inputRefs = useRef({});
  const syncTimerRef = useRef(null);
  const liveRefreshTimerRef = useRef(null);

  const selectedAcademy = useMemo(() => {
    try {
      return getEffectiveAcademy?.() || null;
    } catch {
      return null;
    }
  }, []);

  const myJudgeUserId = useMemo(() => {
    const tokenUser = getStoredJudgeUser();
    return String(
      tokenUser?._id || tokenUser?.id || tokenUser?.userId || "",
    ).trim();
  }, []);

  const hasOpenHelpAlert = useMemo(() => {
    return (
      !!activeHelpAlert &&
      String(activeHelpAlert?.status || "").toUpperCase() !== "RESOLVED"
    );
  }, [activeHelpAlert]);
  const getSocketInstance = useCallback(() => {
    try {
      return getSocket?.() || null;
    } catch {
      return null;
    }
  }, []);

  const onboardingUserKey = useMemo(() => {
    const academyId =
      selectedAcademy?.academyId ||
      selectedAcademy?._id ||
      selectedAcademy?.id ||
      "global";
    return `judge::${academyId}`;
  }, [selectedAcademy]);

  const showToast = useCallback((text, type = "ok") => {
    setMsg("");
    setErr("");
    if (type === "err") setErr(text);
    else setMsg(text);

    if (typeof window !== "undefined") {
      window.clearTimeout(window.__ra_toast);
      window.__ra_toast = window.setTimeout(() => {
        setMsg("");
        setErr("");
      }, 2200);
    }
  }, []);

  function setInputRef(key, node) {
    if (!key) return;
    if (node) inputRefs.current[key] = node;
    else delete inputRefs.current[key];
  }

  function handleMissingToken() {
    showToast("Session expired. Please login again.", "err");
  }

  function hardLogout() {
    try {
      clearToken?.();
      clearUser?.();
    } catch {
      // ignore
    }
    onLogout?.();
  }

  function pickDefaultEventId(list = []) {
    const arr = (list || []).slice();
    const live = arr.find((x) =>
      LIVE_EVENT_STATUSES.includes(String(x?.status || "").toUpperCase()),
    );
    if (live?._id) return String(live._id);

    arr.sort((a, b) => {
      const da = new Date(a?.createdAt || a?.startDate || 0).getTime();
      const db = new Date(b?.createdAt || b?.startDate || 0).getTime();
      return db - da;
    });
    return arr?.[0]?._id ? String(arr[0]._id) : "";
  }

  function normalizeAssignments({
    rows = [],
    legacy = null,
    forcedEventId = "",
  }) {
    const actsMap = new Map();
    const groupsMap = new Map();

    const legacyActs = new Map(
      (legacy?.activities || []).map((a) => [String(a._id), a]),
    );
    const legacyGroups = new Map(
      (legacy?.groups || []).map((g) => [String(g._id), g]),
    );

    for (const r of rows || []) {
      const a = r?.activityId;
      const g = r?.groupId;

      if (a && typeof a === "object" && a._id) {
        actsMap.set(String(a._id), a);
      } else if (a && typeof a === "string") {
        const found = legacyActs.get(String(a));
        actsMap.set(
          String(found?._id || a),
          found || {
            _id: String(a),
            name: "Activity",
            maxScore: 10,
            allowDecimal: true,
          },
        );
      }

      if (g && typeof g === "object" && g._id) {
        groupsMap.set(String(g._id), g);
      } else if (g && typeof g === "string") {
        const found = legacyGroups.get(String(g));
        groupsMap.set(
          String(found?._id || g),
          found || { _id: String(g), name: "Group", level: "" },
        );
      }
    }

    return {
      activityIds: Array.from(actsMap.values()),
      groupIds: Array.from(groupsMap.values()),
      assignments: rows,
      eventId: forcedEventId,
    };
  }

  async function loadFallbackFromLegacy() {
    if (typeof api.myAssignments !== "function") return null;
    const legacy = await api.myAssignments();
    if (!legacy) return null;
    const legacyEvents = Array.isArray(legacy?.events) ? legacy.events : [];
    const activeEventId =
      String(legacy?.eventId || "") || pickDefaultEventId(legacyEvents);
    return { events: legacyEvents, eventId: activeEventId, legacy };
  }

  function storageKey(eventIdArg, activityIdArg) {
    return `${String(eventIdArg || "")}:${String(activityIdArg || "")}`;
  }

  function safeReadDrafts() {
    try {
      return JSON.parse(localStorage.getItem(LS_DRAFTS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveDraftToStorage(eventIdArg, activityIdArg, participantId, draft) {
    const key = storageKey(eventIdArg, activityIdArg);
    const all = safeReadDrafts();
    all[key] = all[key] || {};
    if (draft == null) delete all[key][String(participantId)];
    else all[key][String(participantId)] = draft;
    localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify(all));
  }

  function loadDraftsFromStorage(eventIdArg, activityIdArg) {
    const all = safeReadDrafts();
    return all[storageKey(eventIdArg, activityIdArg)] || {};
  }

  function clearDraftsForScope(eventIdArg, activityIdArg) {
    const all = safeReadDrafts();
    delete all[storageKey(eventIdArg, activityIdArg)];
    localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify(all));
  }

  function getOnboardingStore() {
    try {
      const raw = localStorage.getItem(LS_JUDGE_ONBOARDING_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function getOnboardingState() {
    const store = getOnboardingStore();
    return store?.[onboardingUserKey] || {};
  }

  function setOnboardingState(nextState = {}) {
    try {
      const store = getOnboardingStore();
      store[onboardingUserKey] = {
        ...(store?.[onboardingUserKey] || {}),
        ...nextState,
        updatedAt: Date.now(),
      };
      localStorage.setItem(LS_JUDGE_ONBOARDING_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }

  function clearOnboardingState() {
    try {
      const store = getOnboardingStore();
      delete store[onboardingUserKey];
      localStorage.setItem(LS_JUDGE_ONBOARDING_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }

  function openOnboardingAt(index = 0) {
    const safeIndex = Math.max(0, Math.min(index, ONBOARDING_STEPS.length - 1));
    setOnboardingOpen(false);
    setOnboardingIndex(safeIndex);

    window.setTimeout(() => {
      setOnboardingRunId((n) => n + 1);
      setOnboardingIndex(safeIndex);
      setOnboardingOpen(true);
    }, 40);
  }

  function startOnboarding(fromIndex = 0) {
    setOnboardingState({
      dismissed: false,
      completed: false,
      lastStartedAt: Date.now(),
    });
    openOnboardingAt(fromIndex);
  }

  function finishOnboarding() {
    setOnboardingState({
      completed: true,
      dismissed: false,
      lastCompletedAt: Date.now(),
    });
    setOnboardingOpen(false);
    setOnboardingIndex(0);
  }

  function dismissOnboarding() {
    setOnboardingState({
      dismissed: true,
      completed: false,
      lastDismissedAt: Date.now(),
    });
    setOnboardingOpen(false);
  }

  function resetOnboarding() {
    clearOnboardingState();
    startOnboarding(0);
  }

  function normalizeScoreRows(raw, drafts = {}) {
    const next = {};
    const rows = Array.isArray(raw?.rows)
      ? raw.rows
      : Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : [];

    for (const s of rows) {
      const pid = String(s?.participantId?._id || s?.participantId || "");
      if (!pid) continue;
      next[pid] = {
        participantId: pid,
        scoreId: s?._id || "",
        value:
          s?.value !== undefined && s?.value !== null
            ? String(s.value)
            : s?.score !== undefined && s?.score !== null
              ? String(s.score)
              : "",
        status: String(s?.status || "SCORED").toUpperCase(),
        comment: s?.comment || "",
        isSaved: true,
        dirty: false,
        saving: false,
        error: "",
        lastSavedAt: s?.updatedAt || s?.createdAt || null,
        source: "server",
      };
    }

    Object.entries(drafts || {}).forEach(([participantId, draft]) => {
      next[String(participantId)] = {
        ...(next[String(participantId)] || {
          participantId: String(participantId),
          scoreId: "",
          lastSavedAt: null,
        }),
        value: draft?.value ?? next[String(participantId)]?.value ?? "",
        status:
          draft?.status || next[String(participantId)]?.status || "SCORED",
        comment: draft?.comment || next[String(participantId)]?.comment || "",
        dirty: true,
        saving: false,
        error: draft?.error || "",
        isSaved: false,
        source: "draft",
      };
    });

    return next;
  }

  function mergeScoreRowsWithoutOverwritingDirty(current = {}, incoming = {}) {
    const merged = { ...incoming };

    for (const [participantId, currentRow] of Object.entries(current || {})) {
      if (!currentRow?.dirty && !currentRow?.saving) continue;

      merged[String(participantId)] = {
        ...(incoming[String(participantId)] || {}),
        ...currentRow,
        participantId: String(participantId),
        source: currentRow.source || "draft",
      };
    }

    return merged;
  }

  function isActivityFinalized(activityIdArg) {
    return Boolean(finalizedMap[String(activityIdArg)]);
  }

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      handleMissingToken();
    }
  }, []);

  useEffect(() => {
    const state = getOnboardingState();
    if (state?.completed || state?.dismissed) return;
    if (!getToken()) return;

    const t = window.setTimeout(() => {
      openOnboardingAt(0);
    }, 500);

    return () => window.clearTimeout(t);
  }, [onboardingUserKey]);

  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setLoading(false);
        handleMissingToken();
        return;
      }

      setLoading(true);
      setErr("");
      try {
        const getEvents =
          typeof api.judgeEvents === "function"
            ? api.judgeEvents
            : typeof api.myEvents === "function"
              ? api.myEvents
              : null;

        if (!getEvents) {
          throw new Error("Missing api.myEvents() in src/lib/api.js");
        }

        let es = (await getEvents()) || [];
        if (!Array.isArray(es) || !es.length) {
          const fb = await loadFallbackFromLegacy();
          if (fb?.events?.length) {
            es = fb.events;
            setEvents(es);
            setEventId(fb.eventId || pickDefaultEventId(es));
            return;
          }
        }

        setEvents(Array.isArray(es) ? es : []);
        setEventId(pickDefaultEventId(Array.isArray(es) ? es : []) || "");
      } catch (e) {
        const m = e?.message || "Failed to load events";
        setErr(m);
        if (e?.status === 401 || String(m).toLowerCase().includes("token")) {
          hardLogout();
          handleMissingToken();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadScores = useCallback(
    async (eventIdArg, activityIdArg, quiet = false) => {
      if (!eventIdArg || !activityIdArg) {
        setScoreMap({});
        return;
      }
      if (!getToken()) return;

      if (!quiet) setRefreshingScores(true);
      try {
        let res;
        if (typeof api.judgeEventScores === "function") {
          res = await api.judgeEventScores(eventIdArg, activityIdArg);
        } else if (typeof api.myEventScores === "function") {
          res = await api.myEventScores(eventIdArg, activityIdArg);
        } else if (typeof api.judgeScores === "function") {
          res = await api.judgeScores(eventIdArg, activityIdArg);
        } else {
          res = [];
        }

        const drafts = loadDraftsFromStorage(eventIdArg, activityIdArg);
        const normalized = normalizeScoreRows(res, drafts);

        setScoreMap((prev) =>
          mergeScoreRowsWithoutOverwritingDirty(prev, normalized),
        );

        const finalizeInfo =
          res?.finalized ||
          res?.meta?.finalized ||
          res?.activityFinalized ||
          res?.isFinalized ||
          false;

        setFinalizedMap((prev) => ({
          ...prev,
          [String(activityIdArg)]: Boolean(finalizeInfo),
        }));
      } catch (e) {
        const m = e?.message || "Failed to load saved scores";
        if (!quiet || isBrowserOnline()) showToast(m, "err");
        if (e?.status === 401 || String(m).toLowerCase().includes("token")) {
          hardLogout();
          handleMissingToken();
        }
      } finally {
        if (!quiet) setRefreshingScores(false);
      }
    },
    [showToast],
  );

  const selectedEvent = useMemo(
    () => (events || []).find((e) => String(e._id) === String(eventId)) || null,
    [events, eventId],
  );

  const selectedActivity = useMemo(
    () =>
      asg?.activityIds?.find((x) => String(x._id) === String(activityId)) ||
      null,
    [asg, activityId],
  );

  const syncDirtyDrafts = useCallback(
    async (eventIdArg, activityIdArg) => {
      if (!eventIdArg || !activityIdArg || !getToken()) return;
      if (!isBrowserOnline()) return;

      if (finalizedMap[String(activityIdArg)]) {
        await loadScores(eventIdArg, activityIdArg, true);
        return;
      }

      const drafts = loadDraftsFromStorage(eventIdArg, activityIdArg);
      const entries = Object.entries(drafts || {});
      if (!entries.length) return;

      const activityMeta =
        asg?.activityIds?.find(
          (a) => String(a?._id) === String(activityIdArg),
        ) ||
        selectedActivity ||
        null;

      const maxScore = Number(activityMeta?.maxScore ?? 10);
      // ✅ Always allow decimal scores for judging (example: 8.6, 9.1, 7.75).
      const allowDecimal = true;

      for (const [participantId, draft] of entries) {
        const status = String(draft?.status || "SCORED").toUpperCase();
        let numericValue = null;

        if (!SPECIAL_STATUSES.includes(status)) {
          if (
            draft?.value === "" ||
            draft?.value === null ||
            draft?.value === undefined
          ) {
            continue;
          }

          const n = Number(draft.value);
          if (Number.isNaN(n)) continue;
          if (n < 0 || n > maxScore) continue;

          numericValue = n;
        }

        try {
          const payload = {
            participantId,
            activityId: activityIdArg,
            value: numericValue,
            status,
            comment: draft?.comment || "",
          };

          if (typeof api.upsertEventScore === "function") {
            await api.upsertEventScore(eventIdArg, payload);
          } else if (typeof api.upsertScore === "function") {
            await api.upsertScore({ eventId: eventIdArg, ...payload });
          } else if (typeof api.saveScore === "function") {
            await api.saveScore({
              eventId: eventIdArg,
              participantId,
              activityId: activityIdArg,
              score: numericValue,
              status,
              comment: payload.comment,
            });
          } else {
            throw new Error("Missing score save API in src/lib/api.js");
          }

          saveDraftToStorage(eventIdArg, activityIdArg, participantId, null);

          setScoreMap((prev) => ({
            ...prev,
            [String(participantId)]: {
              ...(prev[String(participantId)] || {}),
              participantId: String(participantId),
              value:
                draft?.value !== undefined && draft?.value !== null
                  ? String(draft.value)
                  : "",
              status,
              comment: draft?.comment || "",
              error: "",
              saving: false,
              dirty: false,
              isSaved: true,
              lastSavedAt: Date.now(),
              source: "server",
            },
          }));
        } catch (e) {
          setScoreMap((prev) => ({
            ...prev,
            [String(participantId)]: {
              ...(prev[String(participantId)] || {}),
              participantId: String(participantId),
              value:
                draft?.value !== undefined && draft?.value !== null
                  ? String(draft.value)
                  : "",
              status,
              comment: draft?.comment || "",
              saving: false,
              dirty: true,
              isSaved: false,
              error: e?.message || "Sync failed",
              source: "draft",
            },
          }));
        }
      }

      await loadScores(eventIdArg, activityIdArg, true);
    },
    [asg, selectedActivity, finalizedMap, loadScores],
  );

  const loadAssignmentsAndParticipants = useCallback(async () => {
    if (!eventId) return;
    if (!getToken()) {
      setLoading(false);
      handleMissingToken();
      return;
    }

    setLoading(true);
    setErr("");
    try {
      if (typeof api.myEventAssignments !== "function") {
        throw new Error(
          "api.myEventAssignments(eventId) is missing in src/lib/api.js",
        );
      }
      if (typeof api.judgeEventParticipants !== "function") {
        throw new Error(
          "api.judgeEventParticipants(eventId) is missing in src/lib/api.js",
        );
      }

      const rows = (await api.myEventAssignments(eventId)) || [];
      let legacy = null;

      if (
        Array.isArray(rows) &&
        rows.length &&
        (typeof rows[0]?.activityId === "string" ||
          typeof rows[0]?.groupId === "string") &&
        typeof api.myAssignments === "function"
      ) {
        legacy = await api.myAssignments(eventId);
      }

      const normalized = normalizeAssignments({
        rows: Array.isArray(rows) ? rows : [],
        legacy,
        forcedEventId: eventId,
      });

      setAsg(normalized);

      const firstAct = normalized?.activityIds?.[0]?._id
        ? String(normalized.activityIds[0]._id)
        : "";

      setActivityId((prev) =>
        prev &&
        normalized.activityIds.some((a) => String(a._id) === String(prev))
          ? prev
          : firstAct,
      );

      setGroupFilter("ALL");
      setLevelFilter("ALL");
      setStatusFilter("ALL");

      const ps = (await api.judgeEventParticipants(eventId)) || [];
      setParticipants(Array.isArray(ps) ? ps : []);
    } catch (e) {
      setAsg(null);
      setParticipants([]);
      setActivityId("");
      setGroupFilter("ALL");
      setLevelFilter("ALL");
      const m = e?.message || "Failed to load judge dashboard";
      setErr(m);
      if (e?.status === 401 || String(m).toLowerCase().includes("token")) {
        hardLogout();
        handleMissingToken();
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadAssignmentsAndParticipants();
  }, [loadAssignmentsAndParticipants]);

  useEffect(() => {
    loadScores(eventId, activityId);
  }, [eventId, activityId, loadScores]);

  useEffect(() => {
    if (!eventId || !activityId || !getToken()) return;
    window.clearInterval(syncTimerRef.current);
    syncTimerRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible" && isBrowserOnline()) {
        loadScores(eventId, activityId, true);
      }
    }, 15000);
    return () => window.clearInterval(syncTimerRef.current);
  }, [eventId, activityId, loadScores]);

  useEffect(() => {
    async function onOnline() {
      setIsOnline(true);
      if (eventId && activityId) {
        showToast("Connection restored. Syncing drafts…", "ok");
        await syncDirtyDrafts(eventId, activityId);
      }
    }

    function onOffline() {
      setIsOnline(false);
      showToast(
        "You are offline. Drafts will sync when internet returns.",
        "err",
      );
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [eventId, activityId, syncDirtyDrafts, showToast]);

  const assignedGroups = useMemo(() => {
    const map = new Map();

    for (const g of asg?.groupIds || []) {
      const name = String(g?.name || "Group").trim();
      if (!name) continue;

      const key = name.toLowerCase();

      if (!map.has(key)) {
        map.set(key, { _id: key, name });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [asg]);

  const assignedLevels = useMemo(() => {
    const set = new Set();

    for (const g of asg?.groupIds || []) {
      const lv = String(g?.level || "").trim();
      if (lv) set.add(lv);
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [asg]);

  useEffect(() => {
    if (!getToken()) return;
    if (!eventId) return;

    const academyId = String(
      selectedAcademy?.academyId ||
        selectedAcademy?._id ||
        selectedAcademy?.id ||
        selectedEvent?.academyId ||
        selectedEvent?.academy?._id ||
        "",
    ).trim();

    joinJudgeScoringRooms({
      eventId,
      academyId,
      includeLeaderboard: true,
    });

    return () => {
      leaveJudgeScoringRooms({
        eventId,
        includeLeaderboard: true,
      });
    };
  }, [eventId, selectedAcademy, selectedEvent]);

  useEffect(() => {
    const sock = getSocketInstance();
    if (!sock?.on) return;
    if (!eventId) return;

    function academyMatches(payloadAcademyId) {
      const mine = String(
        selectedAcademy?.academyId ||
          selectedAcademy?._id ||
          selectedAcademy?.id ||
          selectedEvent?.academyId ||
          selectedEvent?.academy?._id ||
          "",
      ).trim();

      if (!mine) return true;
      return String(payloadAcademyId || "").trim() === mine;
    }

    function eventMatches(payloadEventId) {
      return (
        String(payloadEventId || "").trim() === String(eventId || "").trim()
      );
    }

    function activityMatches(payloadActivityId) {
      if (!payloadActivityId) return true;
      return (
        String(payloadActivityId || "").trim() ===
        String(activityId || "").trim()
      );
    }

    function scheduleQuietScoreRefresh(delay = 450) {
      window.clearTimeout(liveRefreshTimerRef.current);

      liveRefreshTimerRef.current = window.setTimeout(() => {
        if (!eventId || !activityId) return;
        if (document.visibilityState !== "visible") return;
        if (!isBrowserOnline()) return;

        loadScores(eventId, activityId, true);
      }, delay);
    }

    function handleJudgeScoreSaved(payload = {}) {
      if (!academyMatches(payload?.academyId)) return;
      if (!eventMatches(payload?.eventId)) return;
      if (!activityMatches(payload?.activityId)) return;

      const participantId = String(payload?.participantId || "").trim();

      if (participantId) {
        setScoreMap((prev) => {
          const current = prev[participantId] || {
            participantId,
            value: "",
            status: "SCORED",
            comment: "",
            isSaved: false,
            dirty: false,
            saving: false,
            error: "",
            lastSavedAt: null,
          };

          // Do not overwrite the input while the judge is still typing/editing.
          // This prevents typing "10" from jumping back to the older saved "1".
          if (current.dirty || current.saving) {
            return prev;
          }

          return {
            ...prev,
            [participantId]: {
              ...current,
              status: String(payload?.status || current.status || "SCORED")
                .trim()
                .toUpperCase(),
              value:
                payload?.value !== undefined && payload?.value !== null
                  ? String(payload.value)
                  : current.value,
              saving: false,
              dirty: false,
              isSaved: true,
              error: "",
              lastSavedAt: Date.now(),
              source: "server",
            },
          };
        });
      }

      setLiveNotice({
        type: "ok",
        title: "Score saved",
        message: "Your score was synced live.",
      });
    }

    function handleActivityFinalized(payload = {}) {
      if (!academyMatches(payload?.academyId)) return;
      if (!eventMatches(payload?.eventId)) return;

      const payloadActivityId = String(payload?.activityId || "").trim();

      if (payloadActivityId) {
        setFinalizedMap((prev) => ({
          ...prev,
          [payloadActivityId]: true,
        }));
      }

      if (!payloadActivityId || payloadActivityId === String(activityId)) {
        setLiveNotice({
          type: "ok",
          title: "Activity finalized",
          message: "This activity is now locked for scoring.",
        });

        if (activityId) {
          clearDraftsForScope(eventId, activityId);
        }

        scheduleQuietScoreRefresh(250);
      }
    }

    function handleLeaderboardUpdate(payload = {}) {
      if (!academyMatches(payload?.academyId)) return;
      if (!eventMatches(payload?.eventId)) return;
      if (!activityMatches(payload?.activityId)) return;

      scheduleQuietScoreRefresh(650);
    }

    sock.on("judge:score.saved", handleJudgeScoreSaved);
    sock.on("judge:activity.finalized", handleActivityFinalized);
    sock.on("leaderboard:update", handleLeaderboardUpdate);
    sock.on("admin:score-updated", handleLeaderboardUpdate);
    sock.on("admin:activity-finalized", handleActivityFinalized);

    return () => {
      window.clearTimeout(liveRefreshTimerRef.current);

      sock.off?.("judge:score.saved", handleJudgeScoreSaved);
      sock.off?.("judge:activity.finalized", handleActivityFinalized);
      sock.off?.("leaderboard:update", handleLeaderboardUpdate);
      sock.off?.("admin:score-updated", handleLeaderboardUpdate);
      sock.off?.("admin:activity-finalized", handleActivityFinalized);
    };
  }, [
    getSocketInstance,
    selectedAcademy,
    selectedEvent,
    eventId,
    activityId,
    loadScores,
  ]);

  useEffect(() => {
    const sock = getSocketInstance();
    if (!sock?.on) return;

    function academyMatches(payloadAcademyId) {
      const mine = String(
        selectedAcademy?.academyId ||
          selectedAcademy?._id ||
          selectedAcademy?.id ||
          "",
      ).trim();

      if (!mine) return true;
      return String(payloadAcademyId || "").trim() === mine;
    }

    function judgeMatches(payloadJudgeId, payloadAlert) {
      const directId = String(payloadJudgeId || "").trim();
      const nestedId = String(
        payloadAlert?.judge?.id ||
          payloadAlert?.judge?._id ||
          payloadAlert?.judgeId ||
          "",
      ).trim();

      if (!myJudgeUserId) return true;
      return directId === myJudgeUserId || nestedId === myJudgeUserId;
    }

    function handleAlertCreated(payload = {}) {
      const alert = payload?.alert || payload;
      if (!academyMatches(payload?.academyId || alert?.academyId)) return;
      if (!judgeMatches(payload?.judgeId, alert)) return;

      setActiveHelpAlert(alert);
      setLiveNotice({
        type: "info",
        title: "Help request sent",
        message: "Admin was notified live.",
      });
    }

    function handleAlertResolved(payload = {}) {
      const alert = payload?.alert || payload;

      if (!academyMatches(payload?.academyId || alert?.academyId)) return;
      if (!judgeMatches(payload?.judgeId, alert)) return;

      setActiveHelpAlert((prev) => ({
        ...(prev || {}),
        ...(alert || {}),
        status: "RESOLVED",
        resolvedAt:
          alert?.resolvedAt || payload?.resolvedAt || new Date().toISOString(),
      }));

      setLiveNotice({
        type: "ok",
        title: "Help request resolved",
        message: "Admin marked your request as resolved.",
      });

      showToast("Admin resolved your help request ✅", "ok");
    }

    function handleAdminNotice(payload = {}) {
      if (!academyMatches(payload?.academyId)) return;

      setNotice({
        title: payload?.title || "Admin Notice",
        message: payload?.message || "",
      });
    }

    sock.on("alert:created", handleAlertCreated);
    sock.on("alert:resolved", handleAlertResolved);
    sock.on("notification:new", handleAdminNotice);
    sock.on("judge:notice", handleAdminNotice);

    return () => {
      sock.off?.("alert:created", handleAlertCreated);
      sock.off?.("alert:resolved", handleAlertResolved);
      sock.off?.("notification:new", handleAdminNotice);
      sock.off?.("judge:notice", handleAdminNotice);
    };
  }, [getSocketInstance, myJudgeUserId, selectedAcademy, showToast]);

  useEffect(() => {
    if (!asg) return;
    if (groupFilter === "ALL") return;
    const ok = assignedGroups.some(
      (g) => String(g.name).toLowerCase() === String(groupFilter).toLowerCase(),
    );
    if (!ok) setGroupFilter("ALL");
  }, [asg, assignedGroups, groupFilter]);

  useEffect(() => {
    if (levelFilter === "ALL") return;
    const ok = assignedLevels.some((lv) => String(lv) === String(levelFilter));
    if (!ok) setLevelFilter("ALL");
  }, [assignedLevels, levelFilter]);

  const filteredParticipants = useMemo(() => {
    const s = q.trim().toLowerCase();
    let base = participants || [];

    const allowed = new Set((asg?.groupIds || []).map((g) => String(g._id)));
    if (allowed.size) {
      base = base.filter((p) => allowed.has(String(p.groupId?._id || "")));
    }

    if (groupFilter !== "ALL") {
      base = base.filter(
        (p) =>
          String(p.groupId?.name || "")
            .trim()
            .toLowerCase() === String(groupFilter).trim().toLowerCase(),
      );
    }

    if (levelFilter !== "ALL") {
      base = base.filter(
        (p) =>
          String(p.groupId?.level || "").trim() === String(levelFilter).trim(),
      );
    }

    if (statusFilter !== "ALL") {
      base = base.filter((p) => {
        const row = scoreMap[String(p._id)];
        const st = String(row?.status || "UNSCORED").toUpperCase();

        if (statusFilter === "UNSCORED") {
          return !row?.value && !["ABSENT", "DQ", "WITHDRAWN"].includes(st);
        }

        return st === statusFilter;
      });
    }

    if (!s) return base;

    return base.filter((p) => {
      const row = scoreMap[String(p._id)] || {};
      const name = (p.userId?.name || "").toLowerCase();
      const group = (p.groupId?.name || "").toLowerCase();
      const level = (p.groupId?.level || "").toLowerCase();
      const bib = String(p.bibNo || "").toLowerCase();
      const status = String(row?.status || "").toLowerCase();

      return [name, group, level, bib, status].some((x) => x.includes(s));
    });
  }, [participants, q, asg, groupFilter, levelFilter, statusFilter, scoreMap]);

  const scopedParticipants = useMemo(() => {
    let base = participants || [];
    const allowed = new Set((asg?.groupIds || []).map((g) => String(g._id)));

    if (allowed.size) {
      base = base.filter((p) => allowed.has(String(p.groupId?._id || "")));
    }

    if (groupFilter !== "ALL") {
      base = base.filter(
        (p) =>
          String(p.groupId?.name || "")
            .trim()
            .toLowerCase() === String(groupFilter).trim().toLowerCase(),
      );
    }

    if (levelFilter !== "ALL") {
      base = base.filter(
        (p) =>
          String(p.groupId?.level || "").trim() === String(levelFilter).trim(),
      );
    }

    return base;
  }, [participants, asg, groupFilter, levelFilter]);

  const participantIdsInScope = useMemo(
    () => scopedParticipants.map((p) => String(p._id)),
    [scopedParticipants],
  );

  const progress = useMemo(() => {
    const rows = participantIdsInScope.map((id) => scoreMap[id] || null);
    const total = participantIdsInScope.length;
    let saved = 0;
    let pending = 0;
    let absent = 0;
    let dq = 0;
    let retry = 0;
    let withdrawn = 0;
    let errors = 0;

    rows.forEach((r) => {
      if (!r) {
        pending += 1;
        return;
      }

      const st = String(r.status || "SCORED").toUpperCase();

      if (r.error) errors += 1;
      if (st === "ABSENT") absent += 1;
      else if (st === "DQ") dq += 1;
      else if (st === "RETRY") retry += 1;
      else if (st === "WITHDRAWN") withdrawn += 1;

      if (r.isSaved && (r.value !== "" || SPECIAL_STATUSES.includes(st))) {
        saved += 1;
      } else {
        pending += 1;
      }
    });

    const percent = total ? Math.round((saved / total) * 100) : 0;

    return {
      total,
      saved,
      pending,
      percent,
      absent,
      dq,
      retry,
      withdrawn,
      errors,
    };
  }, [participantIdsInScope, scoreMap]);

  const draftCount = useMemo(() => {
    return Object.values(scoreMap || {}).filter((row) => row?.dirty).length;
  }, [scoreMap]);

  const missingParticipants = useMemo(() => {
    return scopedParticipants.filter((p) => {
      const r = scoreMap[String(p._id)];
      if (!r) return true;

      const st = String(r.status || "SCORED").toUpperCase();
      if (SPECIAL_STATUSES.includes(st)) return false;

      return !r.isSaved || r.value === "";
    });
  }, [scopedParticipants, scoreMap]);

  const groupLabel = useMemo(() => {
    if (groupFilter === "ALL") return "All Groups";
    return groupFilter;
  }, [groupFilter]);

  const levelLabel = useMemo(() => {
    if (levelFilter === "ALL") return "All Levels";
    return levelFilter;
  }, [levelFilter]);

  const currentActivityLocked = isActivityFinalized(activityId);
  const showGroupColumn = useMemo(() => groupFilter === "ALL", [groupFilter]);

  const onboardingStep = onboardingOpen
    ? ONBOARDING_STEPS[onboardingIndex] || null
    : null;

  useEffect(() => {
    if (!onboardingOpen || !onboardingStep?.anchor) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(onboardingStep.anchor);
      if (el?.scrollIntoView) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [onboardingOpen, onboardingStep]);

  async function sendHelp() {
    try {
      if (!getToken()) {
        handleMissingToken();
        return;
      }

      if (hasOpenHelpAlert) {
        showToast("You already have an active help request.", "err");
        return;
      }

      setHelpSending(true);
      setErr("");

      if (!eventId) throw new Error("Select an event first");
      if (!activityId) {
        throw new Error("Select an activity before requesting help");
      }

      const academyId = String(
        selectedAcademy?.academyId ||
          selectedAcademy?._id ||
          selectedAcademy?.id ||
          selectedEvent?.academyId ||
          selectedEvent?.academy?._id ||
          "",
      ).trim();

      const academyName =
        selectedAcademy?.academyName ||
        selectedAcademy?.name ||
        selectedEvent?.academyName ||
        selectedEvent?.academy?.name ||
        "";

      const payload = {
        eventId,
        activityId,
        judgeId: myJudgeUserId || undefined,
        message: helpText.trim() || "Judge requested assistance",
        priority: helpPriority,
        category: helpCategory,
        createNotification: true,
        meta: {
          page: "JudgeDashboard",
          source: "judge_dashboard_help",
          groupFilter,
          levelFilter,
          academyId,
          academyName,
          eventName: selectedEvent?.name || selectedEvent?.title || "",
          activityName: selectedActivity?.name || "",
          maxScore: selectedActivity?.maxScore ?? 10,
          requestedAt: new Date().toISOString(),
        },
      };

      let created = null;

      if (typeof api.createJudgeEventAlert === "function") {
        created = await api.createJudgeEventAlert(eventId, payload);
      } else if (typeof api.createJudgeAlert === "function") {
        created = await api.createJudgeAlert(payload);
      } else if (typeof api.createAdminAlert === "function") {
        created = await api.createAdminAlert(payload);
      } else {
        throw new Error("Missing alert API in src/lib/api.js");
      }

      if (created?.id || created?._id) {
        setActiveHelpAlert(created);
      } else {
        setActiveHelpAlert({
          ...payload,
          status: "OPEN",
          createdAt: new Date().toISOString(),
        });
      }

      setHelpOpen(false);
      setHelpText("");
      setHelpCategory("ADMIN");
      setHelpPriority("HIGH");
      setLiveNotice({
        type: "info",
        title: "Help request sent",
        message: "Waiting for admin response…",
      });

      showToast("Help request sent ✅", "ok");
    } catch (e) {
      const m = e?.message || "Failed to send help request";
      showToast(m, "err");
      if (e?.status === 401 || String(m).toLowerCase().includes("token")) {
        hardLogout();
        handleMissingToken();
      }
    } finally {
      setHelpSending(false);
    }
  }

  async function finalizeActivity() {
    try {
      if (!eventId) throw new Error("Select event first");
      if (!activityId) throw new Error("Select activity first");
      if (missingParticipants.length) {
        throw new Error("There are still pending participants");
      }

      setFinalizing(true);

      if (typeof api.finalizeJudgeActivity === "function") {
        await api.finalizeJudgeActivity(eventId, activityId);
      } else if (typeof api.finalizeEventActivityScores === "function") {
        await api.finalizeEventActivityScores(eventId, activityId);
      } else {
        throw new Error("Missing finalize API in src/lib/api.js");
      }

      setFinalizedMap((prev) => ({ ...prev, [String(activityId)]: true }));
      setFinalizeOpen(false);
      clearDraftsForScope(eventId, activityId);
      showToast("Activity finalized successfully", "ok");
      loadScores(eventId, activityId, true);
    } catch (e) {
      const m = e?.message || "Failed to finalize activity";
      showToast(m, "err");
    } finally {
      setFinalizing(false);
    }
  }

  function moveFocus(participantId, delta = 1) {
    const ids = filteredParticipants.map((p) => String(p._id));
    const idx = ids.indexOf(String(participantId));
    if (idx < 0) return;

    const nextId = ids[idx + delta];
    if (!nextId) return;

    const key = `${String(activityId)}:${nextId}`;
    const el = inputRefs.current[key];
    if (el?.focus) {
      el.focus();
      el.select?.();
    }
  }

  function updateScoreState(participantId, updater) {
    setScoreMap((prev) => {
      const current = prev[String(participantId)] || {
        participantId: String(participantId),
        value: "",
        status: "SCORED",
        comment: "",
        isSaved: false,
        dirty: false,
        saving: false,
        error: "",
        lastSavedAt: null,
      };

      const nextRow =
        typeof updater === "function"
          ? updater(current)
          : { ...current, ...updater };

      saveDraftToStorage(
        eventId,
        activityId,
        participantId,
        nextRow.dirty
          ? {
              value: nextRow.value,
              status: nextRow.status,
              comment: nextRow.comment,
              error: nextRow.error,
            }
          : null,
      );

      return { ...prev, [String(participantId)]: nextRow };
    });
  }

  return (
    <>
      <StyleTag />

      <div className="jdWrap">
        <div className="jdTop" id="jd-step-top">
          <div className="jdBrand">
            <div className="jdLogo">
              <img
                src={
                  (typeof localStorage !== "undefined" &&
                    localStorage.getItem(LS_LOGO)) ||
                  `${import.meta.env.BASE_URL}logo.png`
                }
                alt="Logo"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = `${import.meta.env.BASE_URL}logo.png`;
                }}
              />
            </div>

            <div className="jdBrandText">
              <div className="jdTitle">Judge Dashboard</div>
              <div className="jdSub">
                <span className={`jdDot ${isOnline ? "" : "jdDotOff"}`} />
                Event{" "}
                <b>
                  {selectedEvent?.name ||
                    selectedEvent?.title ||
                    (eventId ? "Selected" : "None")}
                </b>
                <span className="jdSep">•</span>
                Activities <b>{asg?.activityIds?.length ?? 0}</b>
                <span className="jdSep">•</span>
                Groups <b>{asg?.groupIds?.length ?? 0}</b>
                <span className="jdSep">•</span>
                <span className="jdPillMini">{groupLabel}</span>
                <span className="jdPillMini jdLevelPill">{levelLabel}</span>
                {selectedAcademy?.academyName || selectedAcademy?.name ? (
                  <span className="jdAcademyPill">
                    {selectedAcademy?.academyName || selectedAcademy?.name}
                  </span>
                ) : null}
                {currentActivityLocked ? (
                  <span className="jdLockPill">Locked</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="jdActions">
            <PWAInstallButton
              label="Install Judge App"
              className="jdBtn jdBtnPrimary"
            />

            <button
              className="jdBtn jdBtnGhost"
              type="button"
              onClick={() => loadScores(eventId, activityId, false)}
              disabled={!activityId || !getToken()}
            >
              {refreshingScores ? "Refreshing…" : "Refresh"}
            </button>

            <button
              className="jdBtn jdBtnGhost"
              type="button"
              onClick={resetOnboarding}
            >
              Tutorial
            </button>

            <button
              className="jdBtn jdBtnGhost"
              id="jd-step-help"
              type="button"
              onClick={() => setHelpOpen(true)}
              disabled={!getToken() || hasOpenHelpAlert}
              title={
                hasOpenHelpAlert
                  ? "You already have an active help request"
                  : "Request help"
              }
            >
              {hasOpenHelpAlert ? "🟡 Help Active" : "🆘 Help"}
            </button>

            <button
              className="jdBtn jdBtnPrimary"
              id="jd-step-finalize"
              type="button"
              onClick={() => setFinalizeOpen(true)}
              disabled={!activityId || currentActivityLocked || !getToken()}
            >
              {currentActivityLocked ? "Finalized" : "Finalize Activity"}
            </button>

            <button
              className="jdBtn jdBtnDanger"
              type="button"
              onClick={hardLogout}
            >
              Logout
            </button>
          </div>
        </div>

        {(msg || err) && (
          <div className={`jdToast ${err ? "jdToastErr" : "jdToastOk"}`}>
            <span className="jdToastDot" />
            <div className="jdToastText">{err || msg}</div>
          </div>
        )}

        {notice || liveNotice || activeHelpAlert ? (
          <div className="jdNoticeBar">
            <strong>
              {liveNotice?.title ||
                notice?.title ||
                (activeHelpAlert
                  ? String(activeHelpAlert?.status || "").toUpperCase() ===
                    "RESOLVED"
                    ? "Help Request Resolved"
                    : "Help Request Active"
                  : "Admin Notice")}
            </strong>

            <span>
              {liveNotice?.message ||
                notice?.message ||
                (activeHelpAlert
                  ? String(activeHelpAlert?.status || "").toUpperCase() ===
                    "RESOLVED"
                    ? `Resolved at ${
                        activeHelpAlert?.resolvedAt
                          ? new Date(
                              activeHelpAlert.resolvedAt,
                            ).toLocaleString()
                          : "just now"
                      }.`
                    : `Request open for ${
                        activeHelpAlert?.activity?.name ||
                        selectedActivity?.name ||
                        "selected activity"
                      }.`
                  : "")}
            </span>

            {activeHelpAlert ? (
              <span className="jdSummaryPill">
                Status:{" "}
                <b>{String(activeHelpAlert?.status || "OPEN").toUpperCase()}</b>
              </span>
            ) : null}
          </div>
        ) : null}

        {activeHelpAlert ? (
          <div className="jdCard jdPad" style={{ marginTop: 14 }}>
            <div className="jdHeadRow">
              <div>
                <div className="jdCardTitle">Latest Help Request</div>
                <div className="jdCardSub">
                  Live status synced with Alerts Center and admin notification
                  flow.
                </div>
              </div>

              <div className="jdPills">
                <span
                  className={`jdPill ${
                    String(activeHelpAlert?.status || "").toUpperCase() ===
                    "RESOLVED"
                      ? "jdPillLocked"
                      : ""
                  }`}
                >
                  {String(activeHelpAlert?.status || "OPEN").toUpperCase()}
                </span>
              </div>
            </div>

            <div className="jdModalMeta" style={{ marginTop: 12 }}>
              <span className="jdTag">Activity</span>
              <b>
                {activeHelpAlert?.activity?.name ||
                  activeHelpAlert?.meta?.activityName ||
                  selectedActivity?.name ||
                  "Not selected"}
              </b>

              <span className="jdTag">Priority</span>
              <b>
                {String(activeHelpAlert?.priority || helpPriority || "HIGH")}
              </b>

              <span className="jdTag">Created</span>
              <b>
                {activeHelpAlert?.createdAt
                  ? new Date(activeHelpAlert.createdAt).toLocaleString()
                  : "—"}
              </b>

              {activeHelpAlert?.resolvedAt ? (
                <>
                  <span className="jdTag">Resolved</span>
                  <b>{new Date(activeHelpAlert.resolvedAt).toLocaleString()}</b>
                </>
              ) : null}
            </div>

            <div className="jdGoodBox" style={{ marginTop: 14 }}>
              {activeHelpAlert?.message || "Judge requested assistance."}
            </div>
          </div>
        ) : null}

        <div
          className="jdCard jdPad"
          id="jd-step-event"
          style={{ marginTop: 14 }}
        >
          <div className="jdHeadRow">
            <div>
              <div className="jdCardTitle">Select Event</div>
              <div className="jdCardSub">Scores are saved per event</div>
            </div>

            <div style={{ minWidth: 280, flex: 1, maxWidth: 520 }}>
              <select
                className="jdSelect"
                value={eventId}
                onChange={(e) => setEventId(String(e.target.value))}
                disabled={!getToken()}
              >
                <option value="">— Select Event —</option>
                {(events || []).map((ev) => (
                  <option key={ev._id} value={ev._id}>
                    {(ev.name || ev.title || "Event") +
                      ` [${String(ev.status || "DRAFT").toUpperCase()}]`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="jdCard jdPad" style={{ marginTop: 14 }}>
            <div className="jdSkeletonTitle" />
            <div className="jdSkeletonLine" />
            <div className="jdSkeletonLine" />
          </div>
        ) : null}

        {!loading && eventId && !asg ? (
          <div className="jdCard jdPad" style={{ marginTop: 14 }}>
            <div className="jdCardTitle">No Assignment Found</div>
            <div className="jdCardSub">
              Ask admin to assign groups and activities for this event.
            </div>
          </div>
        ) : null}

        {!loading && asg ? (
          <>
            <div className="jdStatsGrid" style={{ marginTop: 14 }}>
              <div className="jdStatCard">
                <div className="jdStatLabel">Completion</div>
                <div className="jdStatValue">{progress.percent}%</div>
                <div className="jdProgressTrack">
                  <div
                    className="jdProgressFill"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="jdStatHint">
                  {progress.saved} / {progress.total} completed across filtered
                  participants
                </div>
              </div>

              <div className="jdStatCard">
                <div className="jdStatLabel">Pending</div>
                <div className="jdStatValue">{progress.pending}</div>
                <div className="jdStatHint">Missing or unsaved rows</div>
              </div>

              <div className="jdStatCard">
                <div className="jdStatLabel">Special Status</div>
                <div className="jdStatMiniRow">
                  <span>
                    Absent <b>{progress.absent}</b>
                  </span>
                  <span>
                    DQ <b>{progress.dq}</b>
                  </span>
                  <span>
                    Retry <b>{progress.retry}</b>
                  </span>
                </div>
                <div className="jdStatHint">
                  Withdrawn: {progress.withdrawn}
                </div>
              </div>

              <div className="jdStatCard">
                <div className="jdStatLabel">Sync</div>
                <div className="jdStatValueSmall">
                  {isOnline
                    ? refreshingScores
                      ? "Refreshing…"
                      : draftCount
                        ? `${draftCount} Draft${draftCount === 1 ? "" : "s"}`
                        : "Online"
                    : draftCount
                      ? `${draftCount} Draft${draftCount === 1 ? "" : "s"}`
                      : "Offline"}
                </div>
                <div className="jdStatHint">
                  {isOnline
                    ? draftCount
                      ? "Pending drafts will sync automatically"
                      : "Online saves go directly to server"
                    : "Offline scores are saved as local drafts"}
                </div>
              </div>
            </div>

            <div
              className="jdCard jdPad"
              id="jd-step-activity"
              style={{ marginTop: 14 }}
            >
              <div className="jdHeadRow">
                <div>
                  <div className="jdCardTitle">Select Activity</div>
                  <div className="jdCardSub">
                    Tap one activity to score · Max:{" "}
                    <b>{selectedActivity?.maxScore ?? 10}</b>
                  </div>
                </div>

                <div className="jdPills">
                  <span className="jdPill">
                    👧 Visible <b>{filteredParticipants.length}</b>
                  </span>
                  {currentActivityLocked ? (
                    <span className="jdPill jdPillLocked">🔒 Finalized</span>
                  ) : null}
                </div>
              </div>

              <div className="jdChips" style={{ marginTop: 12 }}>
                {(asg?.activityIds || []).map((a) => {
                  const active = String(a._id) === String(activityId);
                  const locked = isActivityFinalized(a._id);

                  return (
                    <button
                      key={a._id}
                      type="button"
                      className={`jdChip ${active ? "jdChipOn" : ""}`}
                      onClick={() => setActivityId(String(a._id))}
                      title={`Max score: ${a.maxScore ?? 10}`}
                      disabled={!getToken()}
                    >
                      <span className="jdChipName">{a.name || "Activity"}</span>
                      <span className="jdChipMax">max {a.maxScore ?? 10}</span>
                      {locked ? <span className="jdChipLock">🔒</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="jdCard jdPad"
              id="jd-step-filters"
              style={{ marginTop: 14 }}
            >
              <div className="jdHeadRow">
                <div>
                  <div className="jdCardTitle">Participants</div>
                  <div className="jdCardSub">
                    Enter saves automatically · Enter moves next · Shift+Enter
                    moves previous.
                  </div>
                </div>

                <div className="jdToolbarRight">
                  <div className="jdFilterRow">
                    <select
                      className="jdSelect jdSelectSmall"
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                    >
                      <option value="ALL">All Groups</option>
                      {assignedGroups.map((g) => (
                        <option key={g._id} value={g.name}>
                          {g.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="jdSelect jdSelectSmall"
                      value={levelFilter}
                      onChange={(e) => setLevelFilter(e.target.value)}
                    >
                      <option value="ALL">All Levels</option>
                      {assignedLevels.map((lv) => (
                        <option key={lv} value={lv}>
                          {lv}
                        </option>
                      ))}
                    </select>

                    <select
                      className="jdSelect jdSelectSmall"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="ALL">All Status</option>
                      <option value="SCORED">Scored</option>
                      <option value="UNSCORED">Unscored</option>
                      <option value="ABSENT">Absent</option>
                      <option value="DQ">Disqualified</option>
                      <option value="RETRY">Retry</option>
                      <option value="WITHDRAWN">Withdrawn</option>
                    </select>
                  </div>

                  <div className="jdSearchWrap">
                    <div className="jdSearchIcon" aria-hidden="true">
                      🔎
                    </div>
                    <input
                      className="jdInput"
                      placeholder="Search participant / group / level / bib…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      disabled={!getToken()}
                    />
                  </div>
                </div>
              </div>

              <div className="jdFilterSummary" style={{ marginTop: 12 }}>
                <span className="jdSummaryPill">
                  Group: <b>{groupLabel}</b>
                </span>
                <span className="jdSummaryPill">
                  Level: <b>{levelLabel}</b>
                </span>
                <span className="jdSummaryPill">
                  Status: <b>{statusFilter}</b>
                </span>
              </div>

              {!activityId ? (
                <div className="jdEmpty">
                  <div className="jdEmptyTitle">
                    Pick an activity to start scoring
                  </div>
                  <div className="jdEmptySub">
                    Scores save automatically as you enter them.
                  </div>
                </div>
              ) : null}

              {activityId && filteredParticipants.length === 0 ? (
                <div className="jdEmpty">
                  <div className="jdEmptyTitle">No participants found</div>
                  <div className="jdEmptySub">
                    Try another Group list, Level list, or search keyword.
                  </div>
                </div>
              ) : null}

              {activityId && filteredParticipants.length > 0 ? (
                <>
                  <div
                    className="jdTableWrap jdDesktopOnly"
                    id="jd-step-table"
                    style={{ marginTop: 14 }}
                  >
                    <table className="jdTable">
                      <thead>
                        <tr>
                          <th
                            style={{ width: showGroupColumn ? "30%" : "38%" }}
                          >
                            Participant
                          </th>
                          {showGroupColumn ? (
                            <th style={{ width: "20%" }}>Group</th>
                          ) : null}
                          <th
                            style={{ width: showGroupColumn ? "12%" : "16%" }}
                          >
                            Level
                          </th>
                          <th
                            style={{ width: showGroupColumn ? "14%" : "16%" }}
                          >
                            Status
                          </th>
                          <th
                            style={{ width: showGroupColumn ? "14%" : "16%" }}
                          >
                            Score
                          </th>
                          <th
                            style={{
                              width: showGroupColumn ? "10%" : "14%",
                              textAlign: "right",
                            }}
                          >
                            Sync
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredParticipants.map((p) => (
                          <ScoreRow
                            key={`${activityId}:${p._id}`}
                            eventId={eventId}
                            participant={p}
                            activity={selectedActivity}
                            activityId={activityId}
                            rowState={scoreMap[String(p._id)]}
                            onStateChange={updateScoreState}
                            onSaved={(payload) => {
                              updateScoreState(p._id, (cur) => ({
                                ...cur,
                                ...payload,
                                error: "",
                                saving: false,
                                dirty: false,
                                isSaved: true,
                                lastSavedAt: Date.now(),
                                source: "server",
                              }));
                              showToast("Saved ✅", "ok");
                            }}
                            onError={(payload) => {
                              updateScoreState(p._id, (cur) => ({
                                ...cur,
                                ...payload,
                                saving: false,
                                isSaved: false,
                              }));
                              if (payload?.error)
                                showToast(payload.error, "err");
                            }}
                            onTokenExpired={() => {
                              hardLogout();
                              showToast(
                                "Session expired. Please login again.",
                                "err",
                              );
                            }}
                            setInputRef={setInputRef}
                            moveFocus={moveFocus}
                            locked={currentActivityLocked}
                            showGroupColumn={showGroupColumn}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="jdMobileCards" style={{ marginTop: 14 }}>
                    {filteredParticipants.map((p) => (
                      <ScoreCard
                        key={`card-${activityId}:${p._id}`}
                        eventId={eventId}
                        participant={p}
                        activity={selectedActivity}
                        activityId={activityId}
                        rowState={scoreMap[String(p._id)]}
                        onStateChange={updateScoreState}
                        onSaved={(payload) => {
                          updateScoreState(p._id, (cur) => ({
                            ...cur,
                            ...payload,
                            error: "",
                            saving: false,
                            dirty: false,
                            isSaved: true,
                            lastSavedAt: Date.now(),
                            source: "server",
                          }));
                          showToast("Saved ✅", "ok");
                        }}
                        onError={(payload) => {
                          updateScoreState(p._id, (cur) => ({
                            ...cur,
                            ...payload,
                            saving: false,
                            isSaved: false,
                          }));
                          if (payload?.error) showToast(payload.error, "err");
                        }}
                        onTokenExpired={() => {
                          hardLogout();
                          showToast(
                            "Session expired. Please login again.",
                            "err",
                          );
                        }}
                        setInputRef={setInputRef}
                        moveFocus={moveFocus}
                        locked={currentActivityLocked}
                        showGroupColumn={showGroupColumn}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {helpOpen ? (
          <ModalShell onClose={() => !helpSending && setHelpOpen(false)}>
            <div className="jdModalTop">
              <div>
                <div className="jdModalTitle">Request Help</div>
                <div className="jdModalSub">
                  This notifies admin immediately. Event and activity are
                  included.
                </div>
              </div>

              <button
                className="jdX"
                type="button"
                onClick={() => setHelpOpen(false)}
                disabled={helpSending}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="jdModalBox">
              <div className="jdModalMeta">
                <span className="jdTag">Academy</span>
                <b>
                  {selectedAcademy?.academyName ||
                    selectedAcademy?.name ||
                    selectedEvent?.academyName ||
                    selectedEvent?.academy?.name ||
                    "Not selected"}
                </b>
                <span className="jdTag">Event</span>
                <b>
                  {selectedEvent?.name ||
                    selectedEvent?.title ||
                    "Not selected"}
                </b>
                <span className="jdTag">Activity</span>
                <b>{selectedActivity?.name || "Not selected"}</b>
                {showGroupColumn ? (
                  <>
                    <span className="jdTag">Group</span>
                    <b>{groupLabel}</b>
                  </>
                ) : null}
                <span className="jdTag">Level</span>
                <b>{levelLabel}</b>
              </div>

              <div className="jdInlineGrid" style={{ marginTop: 12 }}>
                <select
                  className="jdSelect"
                  value={helpCategory}
                  onChange={(e) => setHelpCategory(e.target.value)}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="SCORING">Scoring</option>
                  <option value="PARTICIPANT">Participant</option>
                </select>

                <select
                  className="jdSelect"
                  value={helpPriority}
                  onChange={(e) => setHelpPriority(e.target.value)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <textarea
                className="jdTextArea"
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="Describe the problem…"
                rows={5}
              />
            </div>

            <div className="jdModalActions">
              <button
                className="jdBtn jdBtnGhost"
                type="button"
                onClick={() => setHelpOpen(false)}
                disabled={helpSending}
              >
                Cancel
              </button>

              <button
                className="jdBtn jdBtnDanger"
                type="button"
                onClick={sendHelp}
                disabled={helpSending || hasOpenHelpAlert}
              >
                {helpSending ? "Sending…" : "Send to Admin"}
              </button>
            </div>
          </ModalShell>
        ) : null}

        {finalizeOpen ? (
          <ModalShell onClose={() => !finalizing && setFinalizeOpen(false)}>
            <div className="jdModalTop">
              <div>
                <div className="jdModalTitle">Finalize Activity</div>
                <div className="jdModalSub">
                  After finalization, score inputs become read-only.
                </div>
              </div>

              <button
                className="jdX"
                type="button"
                onClick={() => setFinalizeOpen(false)}
                disabled={finalizing}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="jdModalBox">
              <div className="jdModalMeta">
                <span className="jdTag">Activity</span>
                <b>{selectedActivity?.name || "Not selected"}</b>
                <span className="jdTag">Completion</span>
                <b>
                  {progress.saved}/{progress.total} filtered participants
                </b>
              </div>

              {missingParticipants.length ? (
                <div className="jdWarnBox" style={{ marginTop: 14 }}>
                  <div className="jdWarnTitle">Pending participants</div>
                  <div className="jdWarnSub">
                    These participants still have no final saved score/status:
                  </div>
                  <div className="jdWarnList">
                    {missingParticipants.slice(0, 12).map((p) => (
                      <span key={p._id} className="jdWarnItem">
                        {p.userId?.name || "Participant"}
                      </span>
                    ))}
                    {missingParticipants.length > 12 ? (
                      <span className="jdWarnItem">
                        +{missingParticipants.length - 12} more
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="jdGoodBox" style={{ marginTop: 14 }}>
                  All participants are complete. You can finalize this activity
                  now.
                </div>
              )}
            </div>

            <div className="jdModalActions">
              <button
                className="jdBtn jdBtnGhost"
                type="button"
                onClick={() => setFinalizeOpen(false)}
                disabled={finalizing}
              >
                Cancel
              </button>

              <button
                className="jdBtn jdBtnPrimary"
                type="button"
                onClick={finalizeActivity}
                disabled={finalizing || missingParticipants.length > 0}
              >
                {finalizing ? "Finalizing…" : "Finalize Now"}
              </button>
            </div>
          </ModalShell>
        ) : null}

        {onboardingOpen && onboardingStep ? (
          <JudgeOnboardingOverlay
            key={`judge-tour-${onboardingRunId}-${onboardingIndex}-${onboardingStep.id}`}
            step={onboardingStep}
            stepIndex={onboardingIndex}
            total={ONBOARDING_STEPS.length}
            onClose={dismissOnboarding}
            onBack={() => setOnboardingIndex((v) => (v > 0 ? v - 1 : v))}
            onNext={() => {
              if (onboardingIndex >= ONBOARDING_STEPS.length - 1) {
                finishOnboarding();
              } else {
                setOnboardingIndex((v) => v + 1);
              }
            }}
          />
        ) : null}
      </div>
    </>
  );
}

function ModalShell({ children, onClose }) {
  return (
    <div
      className="jdModalOverlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div className="jdModal" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function JudgeOnboardingOverlay({
  step,
  stepIndex,
  total,
  onClose,
  onBack,
  onNext,
}) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    function updateRect() {
      const el = document.getElementById(step?.anchor || "");
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect(r);
    }

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [step]);

  const cardStyle = useMemo(() => {
    if (!rect || typeof window === "undefined") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const width = Math.min(420, window.innerWidth - 24);
    const spacing = 14;
    const placement = step?.placement || "bottom";

    let top = rect.bottom + spacing;
    let left = rect.left;

    if (placement === "top") {
      top = Math.max(12, rect.top - 220);
      left = rect.left;
    }

    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
    if (left < 12) left = 12;

    if (top > window.innerHeight - 220) {
      top = Math.max(12, rect.top - 220);
    }

    return { top, left, width };
  }, [rect, step]);

  return (
    <div className="jdTourOverlay">
      {rect ? (
        <div
          className="jdTourFocus"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      ) : null}

      <div className="jdTourCard" style={cardStyle}>
        <div className="jdTourTop">
          <span className="jdTourStep">
            Step {stepIndex + 1} of {total}
          </span>
          <button className="jdTourX" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="jdTourTitle">{step?.title}</div>
        <div className="jdTourText">{step?.text}</div>

        <div className="jdTourActions">
          <button type="button" className="jdBtn jdBtnGhost" onClick={onClose}>
            Skip
          </button>

          <div className="jdTourRight">
            <button
              type="button"
              className="jdBtn jdBtnGhost"
              onClick={onBack}
              disabled={stepIndex === 0}
            >
              Back
            </button>

            <button
              type="button"
              className="jdBtn jdBtnPrimary"
              onClick={onNext}
            >
              {stepIndex === total - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildScoreHelpers({
  row,
  activity,
  locked,
  participantId,
  activityId,
  eventId,
  onStateChange,
  onSaved,
  onError,
  onTokenExpired,
  moveFocus,
}) {
  const maxScore = Number(activity?.maxScore ?? 10);
  // ✅ Always allow decimal scores for judging (example: 8.6, 9.1, 7.75).
  const allowDecimal = true;

  function validate(rawValue, statusValue) {
    const st = String(statusValue || "SCORED").toUpperCase();

    if (SPECIAL_STATUSES.includes(st)) {
      return { ok: true, value: null };
    }

    if (rawValue === "" || rawValue === null || rawValue === undefined) {
      return { ok: false, message: "Required" };
    }

    const n = Number(rawValue);
    if (Number.isNaN(n)) return { ok: false, message: "Enter a number" };
    if (n < 0) return { ok: false, message: "Minimum 0" };
    if (n > maxScore) return { ok: false, message: `Max ${maxScore}` };

    return { ok: true, value: n };
  }

  async function doSave(force = false) {
    if (row.saving || locked) return;

    if (!getToken()) {
      onTokenExpired?.();
      return;
    }

    const v = validate(row.value, row.status);
    if (!v.ok) {
      onError?.({ error: v.message, dirty: true, source: "draft" });
      return;
    }

    if (!row.dirty && !force) return;

    if (!isBrowserOnline()) {
      onStateChange(participantId, (cur) => ({
        ...cur,
        dirty: true,
        saving: false,
        isSaved: false,
        error: "",
        source: "draft",
      }));
      return;
    }

    onStateChange(participantId, (cur) => ({
      ...cur,
      saving: true,
      error: "",
    }));

    try {
      const payload = {
        participantId,
        activityId,
        value: v.value,
        status: String(row.status || "SCORED").toUpperCase(),
        comment: row.comment || "",
      };

      let res;
      if (typeof api.upsertEventScore === "function") {
        res = await api.upsertEventScore(eventId, payload);
      } else if (typeof api.upsertScore === "function") {
        res = await api.upsertScore({ eventId, ...payload });
      } else if (typeof api.saveScore === "function") {
        res = await api.saveScore({
          eventId,
          participantId,
          activityId,
          score: v.value,
          status: payload.status,
          comment: payload.comment,
        });
      } else {
        throw new Error("Missing score save API in src/lib/api.js");
      }

      onSaved?.({
        scoreId: res?._id || res?.scoreId || row.scoreId,
        value: row.value,
        status: payload.status,
        comment: row.comment,
      });
    } catch (e) {
      const m = e?.message || "Save failed";
      if (e?.status === 401 || String(m).toLowerCase().includes("token")) {
        clearToken?.();
        onTokenExpired?.();
        return;
      }
      onError?.({
        error: isBrowserOnline() ? m : "",
        dirty: true,
        source: "draft",
      });
    }
  }

  return { doSave, maxScore, allowDecimal, moveFocus };
}

function ScoreRow(props) {
  const {
    eventId,
    participant,
    activity,
    activityId,
    rowState,
    onStateChange,
    onSaved,
    onError,
    onTokenExpired,
    setInputRef,
    moveFocus,
    locked,
    showGroupColumn = true,
  } = props;

  const debounceRef = useRef(null);
  const participantId = String(participant._id);

  const row = rowState || {
    participantId,
    value: "",
    status: "SCORED",
    comment: "",
    saving: false,
    dirty: false,
    isSaved: false,
    error: "",
    lastSavedAt: null,
  };

  const inputKey = `${String(activityId)}:${participantId}`;

  const { doSave, maxScore, allowDecimal } = buildScoreHelpers({
    row,
    activity,
    locked,
    participantId,
    activityId,
    eventId,
    onStateChange,
    onSaved,
    onError,
    onTokenExpired,
    moveFocus,
  });

  useEffect(() => {
    if (!row.dirty || locked) return;

    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(
      () => doSave(false),
      SAVE_DEBOUNCE_MS,
    );

    return () => window.clearTimeout(debounceRef.current);
  }, [row.value, row.status, row.comment, row.dirty, locked]);

  const statusClass = row.error
    ? "jdStatusRowErr"
    : row.saving
      ? "jdStatusRowSaving"
      : row.isSaved
        ? "jdStatusRowSaved"
        : row.dirty
          ? "jdStatusRowDirty"
          : "";

  const isSpecial = SPECIAL_STATUSES.includes(
    String(row.status || "").toUpperCase(),
  );

  return (
    <tr className={`jdTr ${statusClass}`}>
      <td>
        <div className="jdName">{participant.userId?.name || "—"}</div>
        <div className="jdMini">
          BIB: {participant.bibNo || "—"}
          {participant.userId?.email ? ` · ${participant.userId.email}` : ""}
        </div>
      </td>

      {showGroupColumn ? (
        <td>
          <span className="jdBadge">{participant.groupId?.name || "—"}</span>
        </td>
      ) : null}

      <td>
        <span className="jdBadge jdLevelBadge">
          {participant.groupId?.level || "—"}
        </span>
      </td>

      <td>
        <select
          className="jdSelect jdSelectCell"
          value={row.status || "SCORED"}
          disabled={locked}
          onChange={(e) =>
            onStateChange(participantId, (cur) => ({
              ...cur,
              status: e.target.value,
              dirty: true,
              isSaved: false,
              error: "",
              source: "draft",
            }))
          }
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </td>

      <td>
        <div className="jdScoreCell">
          <input
            ref={(node) => setInputRef(inputKey, node)}
            className={`jdScoreInput ${row.error ? "jdInputErr" : ""}`}
            type="text"
            inputMode="decimal"
            step="0.01"
            min="0"
            max={maxScore}
            value={row.value}
            disabled={locked || isSpecial}
            onChange={(e) =>
              onStateChange(participantId, (cur) => ({
                ...cur,
                value: e.target.value,
                dirty: true,
                isSaved: false,
                error: "",
                source: "draft",
              }))
            }
            onBlur={() => doSave(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                doSave(true).then(() =>
                  moveFocus(participantId, e.shiftKey ? -1 : 1),
                );
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                moveFocus(participantId, 1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                moveFocus(participantId, -1);
              }
            }}
            placeholder={`0 – ${maxScore}`}
          />
          {row.error ? <div className="jdErrLine">{row.error}</div> : null}
        </div>
      </td>

      <td style={{ textAlign: "right" }}>
        <SyncStatus
          row={row}
          locked={locked}
          onSave={() => doSave(true)}
          disabled={
            locked || row.saving || !activityId || !eventId || !getToken()
          }
        />
      </td>
    </tr>
  );
}

function ScoreCard(props) {
  const {
    eventId,
    participant,
    activity,
    activityId,
    rowState,
    onStateChange,
    onSaved,
    onError,
    onTokenExpired,
    setInputRef,
    moveFocus,
    locked,
    showGroupColumn = true,
  } = props;

  const debounceRef = useRef(null);
  const participantId = String(participant._id);

  const row = rowState || {
    participantId,
    value: "",
    status: "SCORED",
    comment: "",
    saving: false,
    dirty: false,
    isSaved: false,
    error: "",
    lastSavedAt: null,
  };

  const inputKey = `${String(activityId)}:${participantId}`;

  const { doSave, maxScore, allowDecimal } = buildScoreHelpers({
    row,
    activity,
    locked,
    participantId,
    activityId,
    eventId,
    onStateChange,
    onSaved,
    onError,
    onTokenExpired,
    moveFocus,
  });

  useEffect(() => {
    if (!row.dirty || locked) return;

    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(
      () => doSave(false),
      SAVE_DEBOUNCE_MS,
    );

    return () => window.clearTimeout(debounceRef.current);
  }, [row.value, row.status, row.comment, row.dirty, locked]);

  const isSpecial = SPECIAL_STATUSES.includes(
    String(row.status || "").toUpperCase(),
  );

  return (
    <div className={`jdMobileCard ${row.error ? "jdMobileCardErr" : ""}`}>
      <div className="jdMobileTop">
        <div>
          <div className="jdName">{participant.userId?.name || "—"}</div>
          <div className="jdMini">
            BIB: {participant.bibNo || "—"}
            {participant.userId?.email ? ` · ${participant.userId.email}` : ""}
          </div>
        </div>

        <div className="jdMobileStatus">
          <StatusPill row={row} locked={locked} />
        </div>
      </div>

      <div className="jdMobileMeta">
        {showGroupColumn ? (
          <span className="jdBadge">{participant.groupId?.name || "—"}</span>
        ) : null}
        <span className="jdBadge jdLevelBadge">
          {participant.groupId?.level || "—"}
        </span>
      </div>

      <div className="jdMobileGrid">
        <div>
          <div className="jdFieldLabel">Status</div>
          <select
            className="jdSelect jdSelectCell"
            value={row.status || "SCORED"}
            disabled={locked}
            onChange={(e) =>
              onStateChange(participantId, (cur) => ({
                ...cur,
                status: e.target.value,
                dirty: true,
                isSaved: false,
                error: "",
                source: "draft",
              }))
            }
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="jdFieldLabel">Score</div>
          <input
            ref={(node) => setInputRef(inputKey, node)}
            className={`jdScoreInput ${row.error ? "jdInputErr" : ""}`}
            type="text"
            inputMode="decimal"
            step="0.01"
            min="0"
            max={maxScore}
            value={row.value}
            disabled={locked || isSpecial}
            onChange={(e) =>
              onStateChange(participantId, (cur) => ({
                ...cur,
                value: e.target.value,
                dirty: true,
                isSaved: false,
                error: "",
                source: "draft",
              }))
            }
            onBlur={() => doSave(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                doSave(true).then(() =>
                  moveFocus(participantId, e.shiftKey ? -1 : 1),
                );
              }
            }}
            placeholder={`0 – ${maxScore}`}
          />
          {row.error ? <div className="jdErrLine">{row.error}</div> : null}
        </div>
      </div>

      <div className="jdMobileActions">
        <button
          className="jdMiniBtn"
          onClick={() => doSave(true)}
          disabled={
            locked || row.saving || !activityId || !eventId || !getToken()
          }
          type="button"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function StatusPill({ row, locked }) {
  if (locked)
    return <span className="jdStatusPill jdStatusLocked">Locked</span>;
  if (row.saving) return <span className="jdStatusPill">Saving…</span>;
  if (row.dirty) {
    return (
      <span className="jdStatusPill jdStatusWarn">
        {isBrowserOnline() ? "Not saved" : "Draft"}
      </span>
    );
  }
  if (row.isSaved)
    return <span className="jdStatusPill jdStatusOk">Saved</span>;
  return <span className="jdStatusPill jdStatusMuted">—</span>;
}

function SyncStatus({ row, locked, onSave, disabled }) {
  return (
    <div className="jdStatus">
      <StatusPill row={row} locked={locked} />
      <button
        className="jdMiniBtn"
        onClick={onSave}
        disabled={disabled}
        type="button"
      >
        Save
      </button>
    </div>
  );
}

function StyleTag() {
  return (
    <style>{`
      :root{
        --ink:#0b1220;
        --muted:rgba(11,18,32,.70);
        --card:rgba(255,255,255,0.86);
        --line:rgba(17,24,39,0.10);
        --accent:${RED};
      }
      *{box-sizing:border-box}
      .jdWrap{
        padding:16px;
        max-width:1320px;
        margin:0 auto;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
        border-radius:22px;
        border:1px solid var(--line);
        background:
          radial-gradient(900px 420px at 10% 0%, rgba(225,29,46,0.10), rgba(225,29,46,0) 55%),
          radial-gradient(900px 420px at 92% 10%, rgba(59,130,246,0.08), rgba(59,130,246,0) 60%),
          linear-gradient(135deg, rgba(255,241,242,0.70), rgba(255,255,255,0.90) 45%, rgba(248,250,252,0.94));
        min-height:calc(100vh - 18px)
      }
      .jdTop{
        position:sticky;
        top:10px;
        z-index:5;
        display:flex;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
        align-items:center;
        padding:12px;
        border-radius:22px;
        background:rgba(255,255,255,0.72);
        border:1px solid var(--line);
        backdrop-filter:blur(14px);
        box-shadow:0 18px 52px rgba(2,8,23,0.10)
      }
      .jdBrand{display:flex;gap:12px;align-items:center;min-width:240px;flex:1 1 460px;}
      .jdBrandText{min-width:0}
      .jdLogo{width:54px;height:54px;border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,0.92);overflow:hidden}
      .jdLogo img{width:100%;height:100%;object-fit:cover}
      .jdTitle{font-weight:950;color:var(--ink);font-size:18px;line-height:1.15}
      .jdSub{margin-top:4px;font-size:12px;color:var(--muted);font-weight:850;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .jdDot{width:8px;height:8px;border-radius:999px;background:rgba(34,197,94,0.85);box-shadow:0 0 0 4px rgba(34,197,94,0.14);display:inline-block}
      .jdDotOff{background:rgba(225,29,46,0.90);box-shadow:0 0 0 4px rgba(225,29,46,0.12)}
      .jdSep{opacity:.6;font-weight:900}
      .jdPillMini,.jdLockPill,.jdAcademyPill{padding:6px 10px;border-radius:999px;border:1px solid rgba(225,29,46,0.18);background:rgba(255,241,242,0.70);color:var(--accent);font-weight:950}
      .jdLevelPill{background:rgba(254,242,242,.85)}
      .jdLockPill{background:rgba(241,245,249,.9);border-color:rgba(15,23,42,.12);color:#0f172a}
      .jdAcademyPill{background:rgba(239,246,255,.9);border-color:rgba(59,130,246,.18);color:#1d4ed8}
      .jdActions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      .jdBtn{min-height:40px;padding:10px 14px;border-radius:14px;border:1px solid rgba(17,24,39,0.14);background:rgba(255,255,255,0.90);font-weight:950;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
      .jdBtn:disabled{opacity:.6;cursor:not-allowed}
      .jdBtnGhost{background:rgba(255,255,255,0.92)}
      .jdBtnPrimary{background:rgba(225,29,46,.94);border-color:rgba(225,29,46,0.32);color:#fff}
      .jdBtnDanger{background:rgba(255,241,242,0.92);border-color:rgba(225,29,46,0.28);color:var(--accent)}
      .jdToast{margin-top:12px;display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,0.76);font-weight:900}
      .jdToastDot{width:10px;height:10px;border-radius:999px;margin-top:4px;background:rgba(34,197,94,0.90);box-shadow:0 0 0 4px rgba(34,197,94,0.12)}
      .jdToastErr .jdToastDot{background:rgba(225,29,46,0.90);box-shadow:0 0 0 4px rgba(225,29,46,0.12)}
      .jdToastOk{border-color:rgba(34,197,94,0.20);background:rgba(236,253,245,0.86)}
      .jdToastErr{border-color:rgba(225,29,46,0.22);background:rgba(255,241,242,0.92);color:var(--accent)}
      .jdNoticeBar{margin-top:12px;padding:12px 14px;border-radius:18px;background:rgba(255,251,235,.95);border:1px solid rgba(245,158,11,.22);display:flex;gap:10px;flex-wrap:wrap;align-items:center;color:#92400e;font-weight:900}
      .jdCard,.jdStatCard{background:var(--card);border:1px solid var(--line);border-radius:22px;box-shadow:0 22px 60px rgba(2,8,23,0.10);backdrop-filter:blur(14px)}
      .jdPad{padding:16px}
      .jdHeadRow{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}
      .jdCardTitle{font-weight:950;font-size:16px;color:var(--ink)}
      .jdCardSub{margin-top:6px;font-size:12px;color:var(--muted);font-weight:800}
      .jdPills{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
      .jdPill{padding:10px 12px;border-radius:999px;background:rgba(255,241,242,0.65);border:1px solid rgba(225,29,46,0.18);font-weight:950;color:var(--accent);white-space:nowrap}
      .jdPillLocked{background:rgba(241,245,249,.95);color:#0f172a;border-color:rgba(15,23,42,.12)}
      .jdPill b{color:var(--ink);margin-left:6px}
      .jdChips{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
      .jdChip{border-radius:999px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.92);padding:10px 12px;font-weight:950;cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .jdChipOn{border-color:rgba(225,29,46,0.32);background:rgba(255,241,242,0.78)}
      .jdChipMax{font-size:11px;font-weight:950;padding:6px 10px;border-radius:999px;color:var(--accent);border:1px solid rgba(225,29,46,0.18);background:rgba(255,241,242,0.70);white-space:nowrap}
      .jdChipLock{font-size:13px}
      .jdSearchWrap{min-width:260px;flex:1;max-width:520px;position:relative}
      .jdSearchIcon{position:absolute;left:12px;top:50%;transform:translateY(-50%);opacity:.7;font-size:14px}
      .jdInput,.jdSelect{width:100%;min-height:46px;padding:12px 14px;border-radius:14px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.92);outline:none;font-weight:850;font-size:14px}
      .jdInput{padding-left:38px}
      .jdInput:focus,.jdSelect:focus,.jdTextArea:focus,.jdScoreInput:focus{border-color:rgba(225,29,46,0.28);box-shadow:0 0 0 4px rgba(225,29,46,0.10)}
      .jdSelectSmall{min-width:160px;width:auto}
      .jdSelectCell{min-height:42px;padding:8px 12px}
      .jdToolbarRight{display:flex;gap:10px;flex:1;justify-content:flex-end;flex-wrap:wrap}
      .jdFilterRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .jdFilterSummary{display:flex;gap:10px;flex-wrap:wrap}
      .jdSummaryPill{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid rgba(17,24,39,0.10);background:rgba(255,255,255,0.88);font-weight:900;font-size:12px;color:rgba(11,18,32,.82)}
      .jdEmpty{margin-top:14px;padding:16px;border-radius:18px;border:1px dashed rgba(17,24,39,0.18);background:rgba(255,255,255,0.62)}
      .jdEmptyTitle{font-weight:950;color:var(--ink)}
      .jdEmptySub{margin-top:6px;font-size:12px;color:var(--muted);font-weight:800}
      .jdTableWrap{overflow:auto;border-radius:20px;border:1px solid rgba(17,24,39,0.10);background:rgba(255,255,255,0.55)}
      .jdTable{width:100%;border-collapse:separate;border-spacing:0;min-width:980px}
      .jdTable thead th{position:sticky;top:0;z-index:1;text-align:left;padding:12px;font-size:12px;font-weight:950;background:rgba(255,255,255,0.94);border-bottom:1px solid rgba(17,24,39,0.10);color:rgba(11,18,32,0.75);text-transform:uppercase;letter-spacing:.6px}
      .jdTable tbody td{padding:12px;vertical-align:top;border-bottom:1px solid rgba(17,24,39,0.08);background:rgba(255,255,255,0.78)}
      .jdTr:hover td{background:rgba(255,255,255,0.92)}
      .jdStatusRowErr td{background:rgba(255,241,242,0.92)}
      .jdStatusRowSaving td{background:rgba(239,246,255,.92)}
      .jdStatusRowSaved td{background:rgba(240,253,244,.82)}
      .jdStatusRowDirty td{background:rgba(255,251,235,.85)}
      .jdName{font-weight:950;color:var(--ink);word-break:break-word}
      .jdMini{margin-top:4px;font-size:12px;color:rgba(11,18,32,0.55);font-weight:800;word-break:break-word}
      .jdBadge{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(17,24,39,0.10);background:rgba(255,255,255,0.92);font-weight:950;font-size:12px;color:rgba(11,18,32,0.80);flex-wrap:wrap}
      .jdLevelBadge{background:rgba(255,241,242,0.78);border-color:rgba(225,29,46,0.18);color:var(--accent)}
      .jdScoreCell{min-width:160px}
      .jdScoreInput{width:100%;min-height:42px;border-radius:14px;border:1px solid rgba(17,24,39,0.14);padding:10px 12px;font-weight:950;font-size:15px;outline:none;background:rgba(255,255,255,0.96)}
      .jdInputErr{border-color:rgba(225,29,46,0.40)!important}
      .jdErrLine{margin-top:8px;color:var(--accent);font-weight:950;font-size:12px}
      .jdStatus{display:flex;justify-content:flex-end;gap:10px;align-items:center;flex-wrap:wrap}
      .jdStatusPill{padding:8px 10px;border-radius:999px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.92);font-weight:950;font-size:12px;color:rgba(11,18,32,0.75);white-space:nowrap}
      .jdStatusOk{border-color:rgba(34,197,94,0.20);background:rgba(236,253,245,0.92);color:rgba(22,101,52,0.95)}
      .jdStatusWarn{border-color:rgba(245,158,11,0.22);background:rgba(255,251,235,0.92);color:rgba(146,64,14,0.95)}
      .jdStatusLocked{border-color:rgba(15,23,42,.12);background:rgba(241,245,249,.95);color:#0f172a}
      .jdStatusMuted{opacity:.7}
      .jdMiniBtn{min-height:36px;padding:8px 12px;border-radius:14px;border:1px solid rgba(225,29,46,0.30);background:rgba(255,241,242,0.92);color:var(--accent);font-weight:950;cursor:pointer}
      .jdMiniBtn:disabled{opacity:.6;cursor:not-allowed}
      .jdModalOverlay{position:fixed;inset:0;background:rgba(2,8,23,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:18px}
      .jdModal{width:min(720px,100%);border-radius:22px;background:rgba(255,255,255,0.98);border:1px solid rgba(17,24,39,0.10);box-shadow:0 30px 80px rgba(2,8,23,0.30);padding:16px;max-height:90vh;overflow:auto}
      .jdModalTop{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
      .jdModalTitle{font-weight:950;font-size:18px;color:var(--ink)}
      .jdModalSub{margin-top:6px;font-size:12px;color:var(--muted);font-weight:800}
      .jdX{width:40px;height:40px;border-radius:14px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.92);cursor:pointer;font-weight:950;flex:0 0 auto}
      .jdModalBox{margin-top:12px}
      .jdModalMeta{font-size:12px;opacity:.9;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .jdTag{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(255,241,242,0.75);border:1px solid rgba(225,29,46,0.18);color:var(--accent);font-weight:950}
      .jdTextArea{width:100%;margin-top:10px;border-radius:16px;padding:12px;border:1px solid rgba(17,24,39,0.12);outline:none;font-weight:850;background:rgba(255,255,255,0.96)}
      .jdModalActions{margin-top:12px;display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
      .jdInlineGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .jdStatsGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .jdStatCard{padding:16px}
      .jdStatLabel{font-size:12px;font-weight:900;color:rgba(11,18,32,.65);text-transform:uppercase;letter-spacing:.5px}
      .jdStatValue{font-size:28px;font-weight:950;color:var(--ink);margin-top:6px}
      .jdStatValueSmall{font-size:20px;font-weight:950;color:var(--ink);margin-top:6px}
      .jdStatHint{margin-top:8px;font-size:12px;color:var(--muted);font-weight:800}
      .jdStatMiniRow{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-weight:900;color:rgba(11,18,32,.8)}
      .jdProgressTrack{margin-top:12px;height:10px;border-radius:999px;background:rgba(15,23,42,.08);overflow:hidden}
      .jdProgressFill{height:100%;border-radius:999px;background:linear-gradient(90deg, rgba(225,29,46,.95), rgba(251,113,133,.85))}
      .jdWarnBox,.jdGoodBox{padding:14px;border-radius:18px;font-weight:900}
      .jdWarnBox{background:rgba(255,251,235,.95);border:1px solid rgba(245,158,11,.24);color:#92400e}
      .jdGoodBox{background:rgba(236,253,245,.95);border:1px solid rgba(34,197,94,.18);color:#166534}
      .jdWarnTitle{font-size:14px}
      .jdWarnSub{margin-top:6px;font-size:12px;font-weight:800}
      .jdWarnList{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
      .jdWarnItem{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.85);border:1px solid rgba(245,158,11,.2);font-size:12px}
      .jdSkeletonTitle{height:16px;width:220px;border-radius:999px;background:rgba(2,8,23,0.08)}
      .jdSkeletonLine{margin-top:10px;height:12px;width:100%;border-radius:999px;background:rgba(2,8,23,0.06)}
      .jdDesktopOnly{display:block}
      .jdMobileCards{display:none}
      .jdMobileCard{border:1px solid rgba(17,24,39,0.10);background:rgba(255,255,255,0.82);border-radius:18px;padding:14px;box-shadow:0 14px 30px rgba(2,8,23,0.06);display:grid;gap:12px}
      .jdMobileCardErr{border-color:rgba(225,29,46,0.25);background:rgba(255,241,242,0.9)}
      .jdMobileTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .jdMobileStatus{display:flex;justify-content:flex-end}
      .jdMobileMeta{display:flex;gap:8px;flex-wrap:wrap}
      .jdMobileGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .jdMobileActions{display:flex;justify-content:flex-end}
      .jdFieldLabel{font-size:12px;font-weight:900;color:rgba(11,18,32,.65);margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px}
      .jdTourOverlay{position:fixed;inset:0;z-index:12000;background:rgba(2,8,23,0.60);pointer-events:auto}
      .jdTourFocus{position:fixed;border-radius:18px;box-shadow:0 0 0 9999px rgba(2,8,23,0.55);border:2px solid rgba(255,255,255,0.95);pointer-events:none;transition:all .18s ease}
      .jdTourCard{position:fixed;z-index:12001;background:rgba(255,255,255,0.98);border:1px solid rgba(17,24,39,0.10);border-radius:20px;box-shadow:0 26px 70px rgba(2,8,23,0.28);padding:16px}
      .jdTourTop{display:flex;justify-content:space-between;align-items:center;gap:10px}
      .jdTourStep{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(255,241,242,0.82);border:1px solid rgba(225,29,46,0.18);color:var(--accent);font-size:12px;font-weight:950}
      .jdTourX{width:34px;height:34px;border-radius:12px;border:1px solid rgba(17,24,39,0.12);background:#fff;cursor:pointer;font-weight:900}
      .jdTourTitle{margin-top:12px;font-size:18px;font-weight:950;color:var(--ink)}
      .jdTourText{margin-top:8px;font-size:13px;line-height:1.55;color:var(--muted);font-weight:800}
      .jdTourActions{margin-top:16px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
      .jdTourRight{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      @media (max-width:1200px){.jdStatsGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:980px){.jdTop{top:0;border-radius:18px}.jdInlineGrid,.jdMobileGrid{grid-template-columns:1fr}.jdToolbarRight{width:100%;justify-content:stretch}.jdSearchWrap{min-width:0;max-width:none;width:100%}.jdFilterRow{width:100%}.jdFilterRow .jdSelect{flex:1 1 180px}}
      @media (max-width:860px){.jdDesktopOnly{display:none}.jdMobileCards{display:grid;gap:12px}}
      @media (max-width:640px){.jdWrap{padding:12px;border-radius:16px}.jdPad{padding:14px}.jdActions{width:100%}.jdBtn{width:100%;justify-content:center}.jdBrand{min-width:0;width:100%}.jdLogo{width:48px;height:48px}.jdTitle{font-size:16px}.jdSelect,.jdInput,.jdTextArea{font-size:16px}.jdStatsGrid{grid-template-columns:1fr}.jdModal{padding:14px;border-radius:18px}.jdTourCard{left:12px !important;right:12px !important;width:auto !important;top:auto !important;bottom:12px !important}}
    `}</style>
  );
}
