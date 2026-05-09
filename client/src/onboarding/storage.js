// client/src/onboarding/storage.js

const KEY = "ra_onboarding_v1";

const EMPTY_USER_STATE = {
  completedTours: {},
  dismissedTours: {},
  progress: {},
  lastTourId: null,
  updatedAt: null,
};

function safeParse(v, fallback) {
  try {
    const parsed = JSON.parse(v);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function ensureObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

export function getAllOnboarding() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return ensureObject(safeParse(raw, {}), {});
  } catch {
    return {};
  }
}

export function setAllOnboarding(data) {
  try {
    const safeData = ensureObject(data, {});
    localStorage.setItem(KEY, JSON.stringify(safeData));
  } catch {
    // ignore
  }
}

export function makeUserKey({ userId, role }) {
  return `${String(role || "UNKNOWN")}::${String(userId || "guest")}`;
}

export function getUserOnboardingState({ userId, role }) {
  const all = ensureObject(getAllOnboarding(), {});
  const key = makeUserKey({ userId, role });
  const row = ensureObject(all[key], {});

  return {
    ...EMPTY_USER_STATE,
    ...row,
    completedTours: ensureObject(row.completedTours, {}),
    dismissedTours: ensureObject(row.dismissedTours, {}),
    progress: ensureObject(row.progress, {}),
  };
}

export function patchUserOnboardingState({ userId, role, patch }) {
  const all = ensureObject(getAllOnboarding(), {});
  const key = makeUserKey({ userId, role });
  const prev = getUserOnboardingState({ userId, role });
  const safePatch = ensureObject(patch, {});

  const next = {
    ...prev,
    ...safePatch,
    completedTours: {
      ...ensureObject(prev.completedTours, {}),
      ...ensureObject(safePatch.completedTours, {}),
    },
    dismissedTours: {
      ...ensureObject(prev.dismissedTours, {}),
      ...ensureObject(safePatch.dismissedTours, {}),
    },
    progress: {
      ...ensureObject(prev.progress, {}),
      ...ensureObject(safePatch.progress, {}),
    },
    updatedAt: new Date().toISOString(),
  };

  all[key] = next;
  setAllOnboarding(all);
  return next;
}

export function resetUserOnboardingState({ userId, role }) {
  const all = ensureObject(getAllOnboarding(), {});
  const key = makeUserKey({ userId, role });

  if (Object.prototype.hasOwnProperty.call(all, key)) {
    delete all[key];
  }

  setAllOnboarding(all);
}
