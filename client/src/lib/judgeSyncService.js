import { api } from "./api.js";
import {
  getPendingJudgeDrafts,
  markJudgeDraftSynced,
} from "./judgeDraftStore.js";

let syncInFlight = false;

export async function syncJudgeDraftQueue() {
  if (syncInFlight) return { ok: true, skipped: true };
  if (!navigator.onLine) return { ok: false, offline: true };

  syncInFlight = true;

  try {
    const pending = await getPendingJudgeDrafts();
    if (!pending.length) return { ok: true, count: 0, failed: [] };

    const payload = pending.map((item) => ({
      localId: item.localId,
      judgeId: item.judgeId,
      eventId: item.eventId,
      activityId: item.activityId,
      participantId: item.participantId,
      academyId: item.academyId,
      participantName: item.participantName,
      scores: item.scores,
      notes: item.notes,
      submitted: item.submitted,
      updatedAt: item.updatedAt,
    }));

    const res = await api.post("/judge/sync", { drafts: payload });

    const syncedIds = Array.isArray(res?.syncedIds) ? res.syncedIds : [];
    const failed = Array.isArray(res?.failed) ? res.failed : [];

    await Promise.all(syncedIds.map((id) => markJudgeDraftSynced(id)));

    return {
      ok: true,
      count: syncedIds.length,
      failed,
    };
  } catch (err) {
    return {
      ok: false,
      message: err?.message || "Sync failed",
      failed: [],
    };
  } finally {
    syncInFlight = false;
  }
}

export function installJudgeSyncListeners() {
  const onOnline = () => {
    syncJudgeDraftQueue().catch(() => {});
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      syncJudgeDraftQueue().catch(() => {});
    }
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
