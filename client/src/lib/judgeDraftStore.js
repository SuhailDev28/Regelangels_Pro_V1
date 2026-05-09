const DB_NAME = "ra_judge_pwa_db";
const DB_VERSION = 2;
const STORE_NAME = "score_drafts";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }

      const store = db.createObjectStore(STORE_NAME, { keyPath: "localId" });
      store.createIndex("status", "status", { unique: false });
      store.createIndex("updatedAt", "updatedAt", { unique: false });
      store.createIndex("judgeId", "judgeId", { unique: false });
      store.createIndex("participantId", "participantId", { unique: false });
      store.createIndex("eventId", "eventId", { unique: false });
      store.createIndex("activityId", "activityId", { unique: false });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function makeLocalId({ judgeId, eventId, activityId, participantId }) {
  return `${judgeId || "judge"}_${eventId || "event"}_${activityId || "activity"}_${participantId || "participant"}`;
}

export async function saveJudgeDraft(payload) {
  const record = {
    localId:
      payload.localId ||
      makeLocalId({
        judgeId: payload.judgeId,
        eventId: payload.eventId,
        activityId: payload.activityId,
        participantId: payload.participantId,
      }),
    judgeId: payload.judgeId,
    eventId: payload.eventId,
    activityId: payload.activityId,
    participantId: payload.participantId,
    participantName: payload.participantName || "",
    academyId: payload.academyId || null,
    scores: payload.scores || {},
    notes: payload.notes || "",
    status: payload.status || "PENDING_SYNC",
    submitted: !!payload.submitted,
    updatedAt: new Date().toISOString(),
  };

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, "readwrite");
    const store = t.objectStore(STORE_NAME);
    const req = store.put(record);

    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

export async function getJudgeDrafts() {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, "readonly");
    const store = t.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const rows = Array.isArray(req.result) ? req.result : [];
      rows.sort((a, b) =>
        String(b.updatedAt).localeCompare(String(a.updatedAt)),
      );
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingJudgeDrafts() {
  const all = await getJudgeDrafts();
  return all.filter((x) => x.status === "PENDING_SYNC");
}

export async function getJudgeDraftByKeys({
  judgeId,
  eventId,
  activityId,
  participantId,
}) {
  const localId = makeLocalId({ judgeId, eventId, activityId, participantId });
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, "readonly");
    const store = t.objectStore(STORE_NAME);
    const req = store.get(localId);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function markJudgeDraftSynced(localId) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, "readwrite");
    const store = t.objectStore(STORE_NAME);
    const getReq = store.get(localId);

    getReq.onsuccess = () => {
      const row = getReq.result;
      if (!row) return resolve(null);

      row.status = "SYNCED";
      row.updatedAt = new Date().toISOString();

      const putReq = store.put(row);
      putReq.onsuccess = () => resolve(row);
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteJudgeDraft(localId) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, "readwrite");
    const store = t.objectStore(STORE_NAME);
    const req = store.delete(localId);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function clearSyncedDrafts() {
  const all = await getJudgeDrafts();
  const synced = all.filter((x) => x.status === "SYNCED");

  await Promise.all(synced.map((x) => deleteJudgeDraft(x.localId)));
  return true;
}

export function buildJudgeDraftKey({
  judgeId,
  eventId,
  activityId,
  participantId,
}) {
  return makeLocalId({ judgeId, eventId, activityId, participantId });
}
