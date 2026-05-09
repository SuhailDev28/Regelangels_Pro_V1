// client/src/lib/tokenStore.js

const ACCESS_TOKEN_KEY = "gym_access_token";

/**
 * Tab-safe token store:
 * - memory for fast access
 * - sessionStorage for refresh survival
 * - no localStorage, so different tabs can use different accounts
 */
let accessToken = null;

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

function cleanupLegacyTokens() {
  const legacyKeys = [
    "gym_token",
    "ra_token",
    "token",
    "accessToken",
    "access_token",
  ];

  for (const key of legacyKeys) {
    lsRemove(key);
  }
}

cleanupLegacyTokens();

export function setAccessToken(token) {
  accessToken = token || null;

  if (accessToken) {
    ssSet(ACCESS_TOKEN_KEY, accessToken);
  } else {
    ssRemove(ACCESS_TOKEN_KEY);
  }

  cleanupLegacyTokens();
}

export function getAccessToken() {
  if (accessToken) return accessToken;

  const stored = ssGet(ACCESS_TOKEN_KEY);

  if (stored) {
    accessToken = stored;
    return accessToken;
  }

  return null;
}

export function clearAccessToken() {
  accessToken = null;
  ssRemove(ACCESS_TOKEN_KEY);
  cleanupLegacyTokens();
}

export function hasAccessToken() {
  return !!getAccessToken();
}
