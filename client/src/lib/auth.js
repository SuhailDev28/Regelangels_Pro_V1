// client/src/lib/auth.js
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
} from "./tokenStore.js";

const USER_KEY = "gym_user";
const SELECTED_ACADEMY_KEY = "gym_selected_academy";

const LEGACY_TOKEN_KEYS = ["gym_token", "ra_token", "token"];
const LEGACY_USER_KEYS = [
  "ra_user",
  "user",
  "kidgage_user",
  "judge_user",
  "auth_user",
];

let socketRefreshTimer = null;

/* =========================
 * Internal storage helpers
 * ========================= */

function hasWindow() {
  return typeof window !== "undefined";
}

function ssGet(key) {
  try {
    if (!hasWindow()) return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function ssSet(key, value) {
  try {
    if (!hasWindow()) return;
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function ssRemove(key) {
  try {
    if (!hasWindow()) return;
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function lsRemove(key) {
  try {
    if (!hasWindow()) return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function normalizeId(v) {
  return String(v || "").trim();
}

function toBool(v, fallback = false) {
  if (typeof v === "boolean") return v;

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }

  return fallback;
}

function notifyAuthChanged() {
  try {
    if (!hasWindow()) return;
    window.dispatchEvent(
      new CustomEvent("ra:auth-changed", {
        detail: {
          userId: getUserId(),
          role: getRole(),
          academyId: getAcademyId(),
          ts: Date.now(),
        },
      }),
    );
  } catch {
    // ignore
  }
}

function scheduleSocketRefresh() {
  try {
    if (!hasWindow()) return;

    window.clearTimeout(socketRefreshTimer);

    socketRefreshTimer = window.setTimeout(async () => {
      try {
        const mod = await import("./socket.js");

        if (typeof mod?.refreshSocketAuth === "function") {
          mod.refreshSocketAuth();
        }
      } catch {
        // ignore
      }
    }, 0);
  } catch {
    // ignore
  }
}

function syncAuthState() {
  notifyAuthChanged();
  scheduleSocketRefresh();
}

function cleanupLegacySharedStorage() {
  for (const k of LEGACY_TOKEN_KEYS) {
    ssRemove(k);
    lsRemove(k);
  }

  for (const k of LEGACY_USER_KEYS) {
    lsRemove(k);
  }

  // Keep active user and selected academy tab-scoped only.
  lsRemove(USER_KEY);
  lsRemove(SELECTED_ACADEMY_KEY);
}

cleanupLegacySharedStorage();

/* =========================
 * TOKEN — TAB SAFE
 * ========================= */

export const getToken = () => getAccessToken();

export const setToken = (token) => {
  setAccessToken(token || null);

  for (const k of LEGACY_TOKEN_KEYS) {
    ssRemove(k);
    lsRemove(k);
  }

  syncAuthState();
};

export const clearToken = () => {
  clearAccessToken();

  for (const k of LEGACY_TOKEN_KEYS) {
    ssRemove(k);
    lsRemove(k);
  }

  syncAuthState();
};

export const isLoggedIn = () => !!getAccessToken();

/* =========================
 * ACADEMY NORMALIZATION
 * ========================= */

function normalizeAcademy(academy = {}) {
  const id =
    academy?._id ||
    academy?.id ||
    academy?.academyId ||
    academy?.academy_id ||
    academy?.value ||
    null;

  const name =
    academy?.academyName ||
    academy?.name ||
    academy?.label ||
    academy?.title ||
    "";

  const code = academy?.academyCode || academy?.code || "";
  const logoUrl = academy?.academyLogo || academy?.logoUrl || "";

  return {
    ...academy,
    _id: id,
    id,
    academyId: id,
    name,
    academyName: name,
    code,
    academyCode: code,
    logoUrl,
    academyLogo: logoUrl,
    email: academy?.email || "",
    phone: academy?.phone || "",
    address: academy?.address || "",
    primaryColor: academy?.primaryColor || "",
    secondaryColor: academy?.secondaryColor || "",
    status: academy?.status || "",
    notes: academy?.notes || "",
    branches: Array.isArray(academy?.branches) ? academy.branches : [],
  };
}

function academyFromUserLike(u = {}) {
  const nested = u?.academy || u?.academyRef || null;

  if (nested && typeof nested === "object") {
    return normalizeAcademy({
      ...nested,
      _id:
        nested?._id ||
        nested?.id ||
        nested?.academyId ||
        u?.academyId ||
        u?.academy_id ||
        null,
      academyName: nested?.academyName || nested?.name || u?.academyName || "",
      academyCode: nested?.academyCode || nested?.code || u?.academyCode || "",
      academyLogo:
        nested?.academyLogo || nested?.logoUrl || u?.academyLogo || "",
      primaryColor: nested?.primaryColor || u?.primaryColor || "",
      secondaryColor: nested?.secondaryColor || u?.secondaryColor || "",
      status: nested?.status || u?.academyStatus || u?.status || "",
      email: nested?.email || u?.academyEmail || "",
      phone: nested?.phone || u?.academyPhone || "",
      address: nested?.address || u?.academyAddress || "",
      notes: nested?.notes || "",
    });
  }

  if (
    u?.academyId ||
    u?.academy_id ||
    u?.academyName ||
    u?.academyCode ||
    u?.academyLogo
  ) {
    return normalizeAcademy({
      _id: u?.academyId || u?.academy_id || null,
      id: u?.academyId || u?.academy_id || null,
      academyId: u?.academyId || u?.academy_id || null,
      academyName: u?.academyName || "",
      academyCode: u?.academyCode || "",
      academyLogo: u?.academyLogo || "",
      primaryColor: u?.primaryColor || "",
      secondaryColor: u?.secondaryColor || "",
      status: u?.academyStatus || "",
      email: u?.academyEmail || "",
      phone: u?.academyPhone || "",
      address: u?.academyAddress || "",
    });
  }

  return null;
}

/* =========================
 * USER
 * ========================= */

function normalizeUser(u = {}) {
  const id = u?._id || u?.id || u?.userId || null;
  const role = normalizeRole(u?.role);
  const academy = academyFromUserLike(u);

  return {
    ...u,
    _id: id,
    id,
    userId: id,
    role,
    academy: academy || u?.academy || null,

    academyId:
      academy?._id ||
      academy?.id ||
      academy?.academyId ||
      u?.academyId ||
      u?.academy?._id ||
      u?.academy?.id ||
      u?.academy_id ||
      null,

    academyName:
      academy?.academyName ||
      academy?.name ||
      u?.academyName ||
      u?.academy?.name ||
      u?.academy?.academyName ||
      "",

    academyCode:
      academy?.academyCode ||
      academy?.code ||
      u?.academyCode ||
      u?.academy?.code ||
      u?.academy?.academyCode ||
      "",

    academyLogo:
      academy?.academyLogo ||
      academy?.logoUrl ||
      u?.academyLogo ||
      u?.academy?.logoUrl ||
      u?.academy?.academyLogo ||
      "",

    mustChangePassword: toBool(u?.mustChangePassword, false),
    passwordChangedAt: u?.passwordChangedAt || null,
    tempPasswordIssuedAt: u?.tempPasswordIssuedAt || null,
    isActive: typeof u?.isActive === "boolean" ? u.isActive : true,
  };
}

export const getUser = () => {
  try {
    const raw = ssGet(USER_KEY);

    if (!raw) return null;

    const parsed = safeJsonParse(raw);

    if (!parsed || typeof parsed !== "object") {
      ssRemove(USER_KEY);
      return null;
    }

    return normalizeUser(parsed);
  } catch {
    ssRemove(USER_KEY);
    return null;
  }
};

export const setUser = (u) => {
  if (!u || typeof u !== "object") {
    ssRemove(USER_KEY);
    syncAuthState();
    return;
  }

  const normalized = normalizeUser(u);
  ssSet(USER_KEY, JSON.stringify(normalized));

  for (const k of LEGACY_USER_KEYS) {
    lsRemove(k);
  }

  syncAuthState();
};

export const clearUser = () => {
  ssRemove(USER_KEY);
  lsRemove(USER_KEY);

  for (const k of LEGACY_USER_KEYS) {
    ssRemove(k);
    lsRemove(k);
  }

  syncAuthState();
};

export const patchUser = (patch = {}) => {
  const current = getUser() || {};
  const next = normalizeUser({ ...current, ...patch });
  setUser(next);
  return next;
};

export const needsPasswordChange = () => !!getUser()?.mustChangePassword;

/* =========================
 * ROLE HELPERS
 * ========================= */

export const getRole = () => normalizeRole(getUser()?.role);

export const isSuperAdmin = () => getRole() === "SUPER_ADMIN";
export const isAdmin = () => getRole() === "ADMIN";
export const isJudge = () => getRole() === "JUDGE";
export const isParticipant = () => getRole() === "PARTICIPANT";
export const isParent = () => getRole() === "PARENT";

/* =========================
 * USER / ACADEMY HELPERS
 * ========================= */

export const getUserAcademy = () => {
  const u = getUser();
  const academy = academyFromUserLike(u || {});
  return academy ? normalizeAcademy(academy) : null;
};

export const getUserAcademyId = () =>
  getUser()?.academyId || getUserAcademy()?._id || null;

export const getAcademyName = () =>
  getUser()?.academyName || getUserAcademy()?.academyName || "";

export const getAcademyCode = () =>
  getUser()?.academyCode || getUserAcademy()?.academyCode || "";

export const getAcademyLogo = () =>
  getUser()?.academyLogo || getUserAcademy()?.academyLogo || "";

export const getUserId = () =>
  normalizeId(getUser()?._id || getUser()?.id || getUser()?.userId || "");

export const getUserEmail = () =>
  String(getUser()?.email || "")
    .trim()
    .toLowerCase();

/* =========================
 * SUPER ADMIN SELECTED ACADEMY
 * ========================= */

export const getSelectedAcademy = () => {
  try {
    const raw = ssGet(SELECTED_ACADEMY_KEY);

    if (!raw) return null;

    const parsed = safeJsonParse(raw);

    if (!parsed || typeof parsed !== "object") {
      ssRemove(SELECTED_ACADEMY_KEY);
      return null;
    }

    return normalizeAcademy(parsed);
  } catch {
    ssRemove(SELECTED_ACADEMY_KEY);
    return null;
  }
};

export const getSelectedAcademyId = () => {
  const a = getSelectedAcademy();
  return a?._id || a?.id || a?.academyId || null;
};

export const setSelectedAcademy = (academy) => {
  if (!academy) {
    ssRemove(SELECTED_ACADEMY_KEY);
    syncAuthState();
    return;
  }

  if (typeof academy === "string") {
    const normalized = normalizeAcademy({
      _id: academy,
      id: academy,
      academyId: academy,
    });

    ssSet(SELECTED_ACADEMY_KEY, JSON.stringify(normalized));
    syncAuthState();
    return;
  }

  if (typeof academy !== "object") {
    ssRemove(SELECTED_ACADEMY_KEY);
    syncAuthState();
    return;
  }

  const normalized = normalizeAcademy(academy);
  ssSet(SELECTED_ACADEMY_KEY, JSON.stringify(normalized));
  syncAuthState();
};

export const clearSelectedAcademy = () => {
  ssRemove(SELECTED_ACADEMY_KEY);
  syncAuthState();
};

/* =========================
 * EFFECTIVE ACADEMY HELPERS
 * ========================= */

export const getEffectiveAcademy = () => {
  const user = getUser();

  if (!user) return null;

  const role = normalizeRole(user.role);

  if (role === "SUPER_ADMIN") {
    const selected = getSelectedAcademy();

    if (selected?._id || selected?.id || selected?.academyId) {
      const id = selected?._id || selected?.id || selected?.academyId;

      return {
        _id: id,
        id,
        academyId: id,
        academyName: selected?.academyName || selected?.name || "",
        academyCode: selected?.academyCode || selected?.code || "",
        academyLogo: selected?.academyLogo || selected?.logoUrl || "",
        name: selected?.academyName || selected?.name || "",
        code: selected?.academyCode || selected?.code || "",
        logoUrl: selected?.academyLogo || selected?.logoUrl || "",
        status: selected?.status || "",
        source: "selected",
        academy: normalizeAcademy(selected),
      };
    }
  }

  const own = getUserAcademy();
  const id = own?._id || own?.id || own?.academyId || user?.academyId || null;

  return {
    _id: id,
    id,
    academyId: id,
    academyName: own?.academyName || own?.name || user?.academyName || "",
    academyCode: own?.academyCode || own?.code || user?.academyCode || "",
    academyLogo: own?.academyLogo || own?.logoUrl || user?.academyLogo || "",
    name: own?.academyName || own?.name || user?.academyName || "",
    code: own?.academyCode || own?.code || user?.academyCode || "",
    logoUrl: own?.academyLogo || own?.logoUrl || user?.academyLogo || "",
    status: own?.status || "",
    source: "user",
    academy: own ? normalizeAcademy(own) : null,
  };
};

export const getEffectiveAcademyObject = () =>
  getEffectiveAcademy()?.academy || null;

export const getAcademyId = () => {
  const a = getEffectiveAcademy();
  return a?._id || a?.id || a?.academyId || null;
};

export const hasAcademyScope = () => !!getAcademyId();

/* =========================
 * REQUEST HELPERS
 * ========================= */

export const getAcademyScopedHeaders = (extra = {}) => {
  const headers = { ...extra };
  const academyId = getAcademyId();
  const role = getRole();

  if (role === "SUPER_ADMIN" && academyId) {
    headers["x-academy-id"] = String(academyId);
  }

  return headers;
};

/* =========================
 * AUTH
 * ========================= */

export const clearAuth = () => {
  clearAccessToken();

  for (const k of LEGACY_TOKEN_KEYS) {
    ssRemove(k);
    lsRemove(k);
  }

  ssRemove(USER_KEY);
  lsRemove(USER_KEY);

  ssRemove(SELECTED_ACADEMY_KEY);
  lsRemove(SELECTED_ACADEMY_KEY);

  for (const k of LEGACY_USER_KEYS) {
    ssRemove(k);
    lsRemove(k);
  }

  syncAuthState();
};

export const setAuth = ({ token, accessToken, user, selectedAcademy } = {}) => {
  const finalToken = accessToken || token || "";

  if (finalToken) {
    setAccessToken(finalToken);

    for (const k of LEGACY_TOKEN_KEYS) {
      ssRemove(k);
      lsRemove(k);
    }
  }

  if (user && typeof user === "object") {
    const normalizedUser = normalizeUser(user);
    ssSet(USER_KEY, JSON.stringify(normalizedUser));

    for (const k of LEGACY_USER_KEYS) {
      ssRemove(k);
      lsRemove(k);
    }
  }

  if (selectedAcademy) {
    const normalizedAcademy = normalizeAcademy(selectedAcademy);
    ssSet(SELECTED_ACADEMY_KEY, JSON.stringify(normalizedAcademy));
  }

  syncAuthState();
};

export const getAuthSnapshot = () => ({
  token: getToken(),
  user: getUser(),
  role: getRole(),
  userId: getUserId(),
  academyId: getAcademyId(),
  effectiveAcademy: getEffectiveAcademy(),
  selectedAcademy: getSelectedAcademy(),
  loggedIn: isLoggedIn(),
});

/* =========================
 * BACKWARD-COMPATIBLE ALIASES
 * ========================= */

export const getSelectedAcademyObject = getSelectedAcademy;
export const getEffectiveAcademyId = getAcademyId;
export const getScopedAcademyId = getAcademyId;
