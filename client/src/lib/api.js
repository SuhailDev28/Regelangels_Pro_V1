// client/src/lib/api.js
import {
  clearAuth,
  getAcademyScopedHeaders,
  getSelectedAcademy,
} from "./auth.js";

import { getAccessToken } from "./tokenStore.js";

const base = String(import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

export const AUTH_EVENT = "ra:auth:required";
export const NETWORK_EVENT = "ra:network:error";

/* -------------------------------------------------------
 * NETWORK / TIMEOUT DEFAULTS
 * ----------------------------------------------------- */
const DEFAULT_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 150000;
const DOWNLOAD_TIMEOUT_MS = 45000;

/* -------------------------------------------------------
 * EVENTS / BASIC HELPERS
 * ----------------------------------------------------- */
function emitAuthRequired(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail }));
  } catch {
    // ignore
  }
}

function isOptionsObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function emitNetworkError(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(NETWORK_EVENT, { detail }));
  } catch {
    // ignore
  }
}

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isAbortError(err) {
  return (
    err?.name === "AbortError" ||
    err?.code === "ABORT_ERR" ||
    String(err?.message || "")
      .trim()
      .toLowerCase()
      .includes("aborted")
  );
}

function isOfflineNow() {
  try {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  } catch {
    return false;
  }
}

function isOfflineError(err) {
  if (!err) return false;

  if (err.code === "NETWORK_OFFLINE") return true;
  if (err.status === 0 && isOfflineNow()) return true;

  const msg = String(err.message || "")
    .trim()
    .toLowerCase();

  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("network error")
  );
}

function normalizeMessage(data) {
  if (isObject(data)) {
    return String(
      data.message || data.error || data.detail || data.msg || "",
    ).trim();
  }
  if (typeof data === "string") {
    return data.trim();
  }
  return "";
}

function isAuthFailure(res, data) {
  if (res?.status === 401) return true;

  const m = normalizeMessage(data).toLowerCase();
  if (!m) return false;

  return (
    m.includes("missing token") ||
    m.includes("invalid token") ||
    m.includes("jwt") ||
    m.includes("unauthorized") ||
    m.includes("token expired") ||
    m.includes("expired token") ||
    m.includes("no token") ||
    m.includes("authentication required") ||
    m.includes("login required")
  );
}

function extractErrorMessage(data) {
  if (isObject(data)) {
    return (
      data.message || data.error || data.detail || data.msg || "Request failed"
    );
  }

  if (typeof data === "string") {
    const trimmed = data.trim();
    return trimmed ? trimmed.slice(0, 240) : "Request failed";
  }

  return "Request failed";
}

function buildUrl(path) {
  const safePath = String(path || "");
  if (!safePath) return base;
  if (/^https?:\/\//i.test(safePath)) return safePath;
  if (!safePath.startsWith("/")) return `${base}/${safePath}`;
  return `${base}${safePath}`;
}

function splitPathAndQuery(path = "") {
  const raw = String(path || "");
  const idx = raw.indexOf("?");
  if (idx === -1) return { pathname: raw, search: "" };
  return {
    pathname: raw.slice(0, idx),
    search: raw.slice(idx + 1),
  };
}

function qs(obj = {}) {
  const parts = Object.entries(obj || {})
    .filter(([, v]) => {
      if (v === undefined || v === null) return false;
      if (typeof v === "string" && v.trim() === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    })
    .flatMap(([k, v]) => {
      if (Array.isArray(v)) {
        return v.map(
          (item) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`,
        );
      }
      return `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;
    });

  return parts.length ? `?${parts.join("&")}` : "";
}

function mergePathWithParams(path, params) {
  const { pathname, search } = splitPathAndQuery(path);
  const merged = new URLSearchParams(search || "");

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;

    merged.delete(k);

    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item !== undefined && item !== null && String(item).trim() !== "") {
          merged.append(k, String(item));
        }
      });
      return;
    }

    merged.set(k, String(v));
  });

  const query = merged.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function hasHeader(headers, key) {
  const lower = String(key || "").toLowerCase();
  return Object.keys(headers || {}).some(
    (k) => String(k).toLowerCase() === lower,
  );
}

function shouldAttachJsonContentType(body) {
  if (body === undefined || body === null) return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return false;
  if (typeof Blob !== "undefined" && body instanceof Blob) return false;
  if (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer)
    return false;
  return true;
}

function shouldClearAuthForPath(path = "") {
  const p = String(path || "");
  return (
    p.startsWith("/admin") ||
    p.startsWith("/judge") ||
    p.startsWith("/participant") ||
    p.startsWith("/super-admin") ||
    p.startsWith("/auth/me") ||
    p.startsWith("/parent") ||
    p.startsWith("/notifications")
  );
}

function shouldAttachAcademyScope(path = "") {
  const p = String(path || "");
  return (
    p.startsWith("/admin") ||
    p.startsWith("/judge") ||
    p.startsWith("/participant") ||
    p.startsWith("/super-admin") ||
    p.startsWith("/parent") ||
    p.startsWith("/notifications")
  );
}

function createNetworkError(err, path = "", timeoutMs = DEFAULT_TIMEOUT_MS) {
  let message = "Network error. Please check server/API connection.";
  let code = "NETWORK_ERROR";

  if (isAbortError(err)) {
    message = `Request timeout after ${timeoutMs}ms`;
    code = "REQUEST_TIMEOUT";
  } else if (isOfflineNow()) {
    message = "You are offline. Please check your internet connection.";
    code = "NETWORK_OFFLINE";
  } else if (String(err?.message || "").trim()) {
    message = String(err.message).trim();
  }

  const e = new Error(message);
  e.status = 0;
  e.code = code;
  e.path = path;
  e.cause = err;

  emitNetworkError({
    path,
    code,
    message,
    offline: isOfflineNow(),
    timeoutMs,
  });

  return e;
}

function normalizeAcademyQueryArg(value) {
  if (value === undefined || value === null) return undefined;

  if (isObject(value)) {
    const direct =
      value.academyId?._id ||
      value.academyId?.id ||
      value.academyId ||
      value._id ||
      value.id ||
      "";

    const normalized = String(direct || "").trim();
    return normalized || undefined;
  }

  const v = String(value || "").trim();
  return v || undefined;
}

function readSelectedAcademyId() {
  try {
    const scoped = getSelectedAcademy?.();
    return normalizeAcademyQueryArg(
      scoped?._id || scoped?.id || scoped?.academyId || "",
    );
  } catch {
    return undefined;
  }
}

function withAcademyQuery(query = {}, academyId = "") {
  const aid = normalizeAcademyQueryArg(academyId) || readSelectedAcademyId();
  if (!aid) return { ...(query || {}) };
  return { ...(query || {}), academyId: aid };
}

function withOptionalActivity(query = {}, activityId = "") {
  const v = String(activityId || "").trim();
  if (!v) return { ...(query || {}) };
  return { ...(query || {}), activityId: v };
}

function sanitizeSettingsPayload(payload = {}) {
  const src = isObject(payload) ? payload : {};

  const accent = String(src.accent || "").trim();
  const font = String(src.font || "").trim();
  const loginKind = String(src.loginKind || "").trim();
  const loginMediaFit = String(src.loginMediaFit || "").trim();

  const allowedLoginKinds = [
    "default",
    "image_ls",
    "video_idb",
    "image_url",
    "video_url",
  ];

  return {
    ...(accent ? { accent } : {}),
    ...(font ? { font } : {}),

    // Legacy browser/local branding support
    ...(typeof src.logoDataUrl === "string"
      ? { logoDataUrl: src.logoDataUrl }
      : {}),
    ...(typeof src.loginImage === "string"
      ? { loginImage: src.loginImage }
      : {}),
    ...(typeof src.loginVideoMime === "string"
      ? { loginVideoMime: src.loginVideoMime }
      : {}),

    // Server/Render Disk branding support
    ...(typeof src.logoUrl === "string" ? { logoUrl: src.logoUrl } : {}),
    ...(typeof src.logoPath === "string" ? { logoPath: src.logoPath } : {}),
    ...(typeof src.logoMime === "string" ? { logoMime: src.logoMime } : {}),
    ...(typeof src.loginMediaUrl === "string"
      ? { loginMediaUrl: src.loginMediaUrl }
      : {}),
    ...(typeof src.loginMediaPath === "string"
      ? { loginMediaPath: src.loginMediaPath }
      : {}),
    ...(typeof src.loginMediaMime === "string"
      ? { loginMediaMime: src.loginMediaMime }
      : {}),

    ...(typeof src.loginOverlayTitle === "string"
      ? { loginOverlayTitle: src.loginOverlayTitle }
      : {}),
    ...(typeof src.loginOverlaySubtitle === "string"
      ? { loginOverlaySubtitle: src.loginOverlaySubtitle }
      : {}),

    ...(allowedLoginKinds.includes(loginKind) ? { loginKind } : {}),
    ...(["cover", "contain"].includes(loginMediaFit) ? { loginMediaFit } : {}),

    ...(Number.isFinite(Number(src.loginOverlayOpacity))
      ? { loginOverlayOpacity: Number(src.loginOverlayOpacity) }
      : {}),

    ...(typeof src.loginVideoAutoplay === "boolean"
      ? { loginVideoAutoplay: src.loginVideoAutoplay }
      : {}),
    ...(typeof src.loginVideoMuted === "boolean"
      ? { loginVideoMuted: src.loginVideoMuted }
      : {}),
    ...(typeof src.loginVideoLoop === "boolean"
      ? { loginVideoLoop: src.loginVideoLoop }
      : {}),
  };
}

function normalizeLoginArgs(
  emailOrPayload,
  passwordArg = "",
  academyCodeArg = "",
) {
  if (isObject(emailOrPayload)) {
    return {
      email: String(emailOrPayload.email || "").trim(),
      password: String(emailOrPayload.password || ""),
      academyCode: String(emailOrPayload.academyCode || "").trim(),
    };
  }

  return {
    email: String(emailOrPayload || "").trim(),
    password: String(passwordArg || ""),
    academyCode: String(academyCodeArg || "").trim(),
  };
}

function normalizeNotificationSendPayload(payload = {}) {
  const body = isObject(payload) ? { ...payload } : {};

  if (body.recipientEmail !== undefined) {
    body.recipientEmail = String(body.recipientEmail || "")
      .trim()
      .toLowerCase();
  }

  if (body.recipientUserId !== undefined) {
    body.recipientUserId = String(body.recipientUserId || "").trim();
  }

  if (body.title !== undefined) {
    body.title = String(body.title || "").trim();
  }

  if (body.message !== undefined) {
    body.message = String(body.message || "").trim();
  }

  if (body.type !== undefined) {
    body.type = String(body.type || "").trim();
  }

  if (body.actionUrl !== undefined) {
    body.actionUrl = String(body.actionUrl || "").trim();
  }

  return body;
}

function withTimeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => {
      controller.abort(
        new DOMException("Request aborted due to timeout", "AbortError"),
      );
    },
    Math.max(1000, Number(timeoutMs || DEFAULT_TIMEOUT_MS)),
  );

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

/* -------------------------------------------------------
 * FETCH HELPERS
 * ----------------------------------------------------- */
async function fetchWithAuth(path, options = {}) {
  const token = getAccessToken?.();
  let headers = {
    ...(options.headers || {}),
  };

  if (shouldAttachAcademyScope(path)) {
    headers = getAcademyScopedHeaders(headers);
  }

  if (token && !hasHeader(headers, "Authorization")) {
    headers.Authorization = `Bearer ${token}`;
  }

  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const { signal, cleanup } = withTimeoutSignal(timeoutMs);

  try {
    return await fetch(buildUrl(path), {
      ...options,
      headers,
      signal,
      credentials: "include",
    });
  } catch (err) {
    throw createNetworkError(err, path, timeoutMs);
  } finally {
    cleanup();
  }
}

async function fetchPublic(path, options = {}) {
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const { signal, cleanup } = withTimeoutSignal(timeoutMs);

  try {
    return await fetch(buildUrl(path), {
      ...options,
      signal,
      credentials: "include",
    });
  } catch (err) {
    throw createNetworkError(err, path, timeoutMs);
  } finally {
    cleanup();
  }
}

async function parseResponse(res) {
  if (!res) return null;
  if (res.status === 204 || res.status === 205) return null;

  const contentType = String(
    res.headers.get("content-type") || "",
  ).toLowerCase();

  if (contentType.includes("application/json")) {
    return await res.json().catch(() => null);
  }

  return await res.text().catch(() => "");
}
async function handleAuthFailureIfNeeded(path, res, data) {
  if (!isAuthFailure(res, data)) return false;

  if (shouldClearAuthForPath(path)) {
    try {
      clearAuth?.();
    } catch {
      // ignore
    }
  }

  emitAuthRequired({
    path,
    status: res?.status || 401,
    message: extractErrorMessage(data),
  });

  const e = new Error(extractErrorMessage(data) || "Unauthorized");
  e.status = res?.status || 401;
  e.code = "AUTH_REQUIRED";
  e.response = { status: res?.status || 401, data };
  throw e;
}

/* -------------------------------------------------------
 * CORE REQUEST HELPERS
 * ----------------------------------------------------- */
async function request(
  path,
  {
    method = "GET",
    body,
    headers,
    params,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  const finalPath = mergePathWithParams(path, params);

  const finalHeaders = {
    ...(headers || {}),
  };

  if (
    shouldAttachJsonContentType(body) &&
    !hasHeader(finalHeaders, "Content-Type")
  ) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const res = await fetchWithAuth(finalPath, {
    method,
    headers: finalHeaders,
    timeoutMs,
    body:
      body === undefined
        ? undefined
        : shouldAttachJsonContentType(body)
          ? JSON.stringify(body)
          : body,
  });

  const data = await parseResponse(res);

  if (res.status === 401) {
    await handleAuthFailureIfNeeded(finalPath, res, data);
  }

  await handleAuthFailureIfNeeded(finalPath, res, data);

  if (!res.ok) {
    const e = new Error(extractErrorMessage(data));
    e.status = res.status;
    e.data = data;
    e.response = { status: res.status, data };
    throw e;
  }

  return data;
}

async function requestPublic(
  path,
  {
    method = "GET",
    body,
    headers,
    params,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  const finalPath = mergePathWithParams(path, params);

  const finalHeaders = {
    ...(headers || {}),
  };

  if (
    shouldAttachJsonContentType(body) &&
    !hasHeader(finalHeaders, "Content-Type")
  ) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const res = await fetchPublic(finalPath, {
    method,
    headers: finalHeaders,
    timeoutMs,
    body:
      body === undefined
        ? undefined
        : shouldAttachJsonContentType(body)
          ? JSON.stringify(body)
          : body,
  });

  const data = await parseResponse(res);

  if (!res.ok) {
    const e = new Error(extractErrorMessage(data));
    e.status = res.status;
    e.data = data;
    e.response = { status: res.status, data };
    throw e;
  }

  return data;
}

async function requestForm(
  path,
  {
    method = "POST",
    formData,
    headers,
    params,
    timeoutMs = UPLOAD_TIMEOUT_MS,
  } = {},
) {
  const finalPath = mergePathWithParams(path, params);

  const res = await fetchWithAuth(finalPath, {
    method,
    headers: { ...(headers || {}) },
    timeoutMs,
    body: formData,
  });

  const data = await parseResponse(res);

  await handleAuthFailureIfNeeded(finalPath, res, data);

  if (!res.ok) {
    const e = new Error(extractErrorMessage(data));
    e.status = res.status;
    e.data = data;
    e.response = { status: res.status, data };
    throw e;
  }

  return data;
}

async function requestBlob(
  path,
  {
    method = "GET",
    headers,
    body,
    params,
    timeoutMs = DOWNLOAD_TIMEOUT_MS,
  } = {},
) {
  const finalPath = mergePathWithParams(path, params);

  const res = await fetchWithAuth(finalPath, {
    method,
    headers: { ...(headers || {}) },
    timeoutMs,
    body,
  });

  if (!res.ok) {
    let data = null;
    try {
      data = await parseResponse(res);
    } catch {
      // ignore
    }

    await handleAuthFailureIfNeeded(finalPath, res, data);

    const e = new Error(extractErrorMessage(data) || "Download failed");
    e.status = res.status;
    e.data = data;
    e.response = { status: res.status, data };
    throw e;
  }

  return await res.blob();
}

async function requestPublicBlob(
  path,
  {
    method = "GET",
    headers,
    body,
    params,
    timeoutMs = DOWNLOAD_TIMEOUT_MS,
  } = {},
) {
  const finalPath = mergePathWithParams(path, params);

  const res = await fetchPublic(finalPath, {
    method,
    headers: { ...(headers || {}) },
    timeoutMs,
    body,
  });

  if (!res.ok) {
    let data = null;
    try {
      data = await parseResponse(res);
    } catch {
      // ignore
    }

    const e = new Error(extractErrorMessage(data) || "Download failed");
    e.status = res.status;
    e.data = data;
    e.response = { status: res.status, data };
    throw e;
  }

  return await res.blob();
}

function downloadBlob(blob, filename) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const safeName = String(filename || "download").trim() || "download";
  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } finally {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 2000);
  }
}

function openBlobInNewTab(blob) {
  if (typeof window === "undefined") return false;

  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");

  if (!w) {
    window.location.href = url;
  }

  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, 15000);

  return true;
}

/* -------------------------------------------------------
 * JUDGE / CERTIFICATE HELPERS
 * ----------------------------------------------------- */
async function ensureJudgeEventId(passedEventId) {
  const eid = String(passedEventId || "").trim();
  if (eid) return eid;

  const js = await request("/judge/me/assignments");
  const pick = js?.eventId ? String(js.eventId) : "";

  if (!pick) {
    throw new Error(
      "No event found for judge (ask admin to create LIVE event + assignments).",
    );
  }

  return pick;
}

function resolveCertificateArgs(arg1, arg2) {
  const a = String(arg1 || "").trim();
  const b = String(arg2 || "").trim();

  if (a && b) {
    return { mode: "event", eventId: a, participantId: b };
  }

  if (a && !b) {
    return { mode: "legacy", participantId: a };
  }

  throw new Error("Missing participantId");
}

function getCertificatePath(arg1, arg2) {
  const info = resolveCertificateArgs(arg1, arg2);

  if (info.mode === "event") {
    return `/admin/events/${info.eventId}/certificate/${info.participantId}.pdf`;
  }

  return `/admin/certificate/${info.participantId}.pdf`;
}

function getCertificateFilename(arg1, arg2) {
  const info = resolveCertificateArgs(arg1, arg2);

  if (info.mode === "event") {
    return `certificate-${info.eventId}-${info.participantId}.pdf`;
  }

  return `certificate-${info.participantId}.pdf`;
}

function getParticipantCertificatePath() {
  return "/participant/me/certificate/open";
}

function getParentReceiptFilename(paymentId = "") {
  const safe = String(paymentId || "receipt").trim() || "receipt";
  return `payment-receipt-${safe}.pdf`;
}

/* -------------------------------------------------------
 * API
 * ----------------------------------------------------- */
export const api = {
  /* =========================
   * EXPOSE LOW-LEVEL HELPERS
   * ========================= */
  base,
  buildUrl,
  qs,
  request,
  requestPublic,
  requestBlob,
  requestPublicBlob,
  requestForm,
  downloadBlob,
  openBlobInNewTab,
  isOfflineError,
  isAbortError,

  /* =========================
   * GENERIC HELPERS
   * ========================= */
  get: (path, options = {}) => request(path, { method: "GET", ...options }),
  post: (path, body, options = {}) =>
    request(path, { method: "POST", body, ...options }),
  put: (path, body, options = {}) =>
    request(path, { method: "PUT", body, ...options }),
  patch: (path, body, options = {}) =>
    request(path, { method: "PATCH", body, ...options }),
  delete: (path, options = {}) =>
    request(path, { method: "DELETE", ...options }),

  publicGet: (path, options = {}) =>
    requestPublic(path, { method: "GET", ...options }),
  publicPost: (path, body, options = {}) =>
    requestPublic(path, { method: "POST", body, ...options }),

  /* =========================
   * PUBLIC (NO LOGIN)
   * ========================= */
  publicGroups: (academyId) =>
    requestPublic(`/public/groups${qs({ academyId })}`),

  publicTotalsByGroup: (groupId) =>
    requestPublic(`/public/totals/group/${groupId}`),

  publicEvents: (academyId) =>
    requestPublic(`/public/events${qs({ academyId })}`),

  publicEventLeaderboard: (eventId) =>
    requestPublic(`/public/events/${eventId}/leaderboard`),

  publicCertificatePdfBlob: (eventId, participantId) =>
    requestPublicBlob(
      `/public/events/${eventId}/certificate/${participantId}.pdf`,
    ),

  async downloadPublicCertificatePdf(eventId, participantId) {
    const blob = await requestPublicBlob(
      `/public/events/${eventId}/certificate/${participantId}.pdf`,
    );
    downloadBlob(blob, `certificate-${eventId}-${participantId}.pdf`);
    return true;
  },

  async openPublicCertificatePdf(eventId, participantId) {
    const blob = await requestPublicBlob(
      `/public/events/${eventId}/certificate/${participantId}.pdf`,
    );
    openBlobInNewTab(blob);
    return true;
  },

  verifyCertificateToken: (token) =>
    requestPublic(`/public/verify-certificate${qs({ t: token })}`),

  /* =========================
   * AUTH
   * ========================= */

  refreshAuth: () => {
    throw new Error(
      "Refresh auth is disabled for tab-isolated judge/admin sessions.",
    );
  },

  logout: () =>
    requestPublic("/auth/logout", {
      method: "POST",
    }),

  login: (emailOrPayload, passwordArg = "", academyCodeArg = "") => {
    const { email, password, academyCode } = normalizeLoginArgs(
      emailOrPayload,
      passwordArg,
      academyCodeArg,
    );

    return request("/auth/login", {
      method: "POST",
      body: {
        email,
        password,
        ...(String(academyCode || "").trim()
          ? { academyCode: String(academyCode).trim().toUpperCase() }
          : {}),
      },
    });
  },

  forgotPassword: (email) =>
    requestPublic("/auth/forgot-password", {
      method: "POST",
      body: { email },
    }),

  resetPassword: (token, password) =>
    requestPublic("/auth/reset-password", {
      method: "POST",
      body: { token, password },
    }),

  /* =========================
   * PASSWORD / SETTINGS
   * ========================= */
  changePassword: (payload) =>
    request("/auth/change-password", {
      method: "POST",
      body: payload,
    }),

  adminChangePassword: (payload) =>
    request("/admin/change-password", {
      method: "POST",
      body: payload,
    }),

  meChangePassword: (payload) =>
    request("/auth/me/change-password", {
      method: "POST",
      body: payload,
    }),

  saveSettings: (payload) =>
    request("/admin/settings", {
      method: "PUT",
      body: sanitizeSettingsPayload(payload),
    }),

  adminSaveSettings: (payload) =>
    request("/admin/settings", {
      method: "PUT",
      body: sanitizeSettingsPayload(payload),
    }),

  getSettings: () => request("/admin/settings"),
  adminGetSettings: () => request("/admin/settings"),

  getPublicBrandingSettings: async () => {
    const paths = [
      "/branding/public/settings",
      "/public/settings",
      "/public/admin-settings",
      "/settings/public",
    ];

    let lastErr = null;

    for (const path of paths) {
      try {
        return await requestPublic(path, {
          method: "GET",
          timeoutMs: DEFAULT_TIMEOUT_MS,
        });
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr || new Error("Failed to load public branding settings");
  },

  adminGetBrandingSettings: () => request("/admin/settings"),

  adminSaveBrandingSettings: (payload) =>
    request("/admin/settings", {
      method: "PUT",
      body: sanitizeSettingsPayload(payload),
    }),

  adminUploadBrandingLogo: (file, academyId = "") => {
    if (!file) throw new Error("Missing logo file");

    const fd = new FormData();
    fd.append("file", file);

    return requestForm("/admin/settings/logo", {
      method: "POST",
      formData: fd,
      params: withAcademyQuery({}, academyId),
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });
  },

  adminUploadLoginMedia: (file, academyId = "") => {
    if (!file) throw new Error("Missing login media file");

    const fd = new FormData();
    fd.append("file", file);

    return requestForm("/admin/settings/login-media", {
      method: "POST",
      formData: fd,
      params: withAcademyQuery({}, academyId),
      timeoutMs: UPLOAD_TIMEOUT_MS,
    });
  },

  /* =========================
   * SUPER ADMIN / ACADEMIES
   * ========================= */
  superAdminAcademies: (query = {}, options = {}) =>
    request("/super-admin/academies", {
      params: query,
      ...(isOptionsObject(options) ? options : {}),
    }),

  adminAcademies: (query = {}, options = {}) =>
    request("/admin/academies", {
      params: query,
      ...(isOptionsObject(options) ? options : {}),
    }),

  academies: (query = {}, options = {}) =>
    request("/admin/academies", {
      params: query,
      ...(isOptionsObject(options) ? options : {}),
    }),

  getAcademies: async (queryOrOptions = {}, maybeOptions = {}) => {
    const query = isOptionsObject(queryOrOptions) ? queryOrOptions : {};
    const options = isOptionsObject(maybeOptions) ? maybeOptions : {};

    try {
      return await request("/admin/academies", {
        params: query,
        ...options,
      });
    } catch (err) {
      try {
        return await request("/super-admin/academies", {
          params: query,
          ...options,
        });
      } catch {
        throw err;
      }
    }
  },

  /* =========================
   * ADMIN: ACADEMY PROFILE
   * ========================= */
  academyProfile: async () => {
    try {
      return await request("/admin/academy-profile");
    } catch (err1) {
      try {
        return await request("/admin/profile");
      } catch (_err2) {
        try {
          return await request("/auth/me");
        } catch {
          throw err1;
        }
      }
    }
  },

  updateAcademyProfile: async (payload) => {
    try {
      return await request("/admin/academy-profile", {
        method: "PUT",
        body: payload,
      });
    } catch (err1) {
      try {
        return await request("/admin/profile", {
          method: "PUT",
          body: payload,
        });
      } catch {
        throw err1;
      }
    }
  },

  assignSuperAdminAcademy: async (userId, academyId) => {
    const res = await fetch(
      `${base}/super-admin/users/${userId}/assign-academy`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ academyId }),
      },
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || "Failed to assign academy");
    }

    return data;
  },

  /* =========================
   * ADMIN: GROUPS
   * ========================= */
  groups: (academyId = "") =>
    request("/admin/groups", {
      params: withAcademyQuery({}, academyId),
    }),

  createGroup: (payload) =>
    request("/admin/groups", { method: "POST", body: payload }),

  updateGroup: (id, payload) =>
    request(`/admin/groups/${id}`, { method: "PUT", body: payload }),

  deleteGroup: (id) => request(`/admin/groups/${id}`, { method: "DELETE" }),

  /* =========================
   * ADMIN: ACTIVITIES
   * ========================= */
  activities: (academyId = "") =>
    request("/admin/activities", {
      params: withAcademyQuery({}, academyId),
    }),

  createActivity: (payload) =>
    request("/admin/activities", { method: "POST", body: payload }),

  updateActivity: (id, payload) =>
    request(`/admin/activities/${id}`, { method: "PUT", body: payload }),

  deleteActivity: (id) =>
    request(`/admin/activities/${id}`, { method: "DELETE" }),

  /* =========================
   * ADMIN: EVENTS
   * ========================= */
  adminEvents: (academyId = "") =>
    request("/admin/events", {
      params: withAcademyQuery({}, academyId),
    }),

  createEvent: (payload) =>
    request("/admin/events", { method: "POST", body: payload }),

  updateEvent: (id, payload) =>
    request(`/admin/events/${id}`, { method: "PUT", body: payload }),

  deleteEvent: (id) => request(`/admin/events/${id}`, { method: "DELETE" }),

  events: (academyId = "") =>
    request("/admin/events", {
      params: withAcademyQuery({}, academyId),
    }),

  /* =========================
   * ADMIN: EVENT ENROLLMENTS
   * ========================= */
  eventEnrollments: (eventId, academyId = "") =>
    request(`/admin/events/${eventId}/enrollments`, {
      params: withAcademyQuery({}, academyId),
    }),

  getEventEnrollments: (eventId, academyId = "") =>
    request(`/admin/events/${eventId}/enrollments`, {
      params: withAcademyQuery({}, academyId),
    }),

  addEventEnrollments: (eventId, payload, academyId = "") =>
    request(`/admin/events/${eventId}/enrollments`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body: payload,
    }),

  createEventEnrollments: (eventId, payload, academyId = "") =>
    request(`/admin/events/${eventId}/enrollments`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body: payload,
    }),

  deleteEventEnrollment: (eventId, enrollmentId, academyId = "") =>
    request(`/admin/events/${eventId}/enrollments/${enrollmentId}`, {
      method: "DELETE",
      params: withAcademyQuery({}, academyId),
    }),

  enrollParticipant: (eventId, participantId, academyId = "") => {
    if (!eventId) throw new Error("Missing eventId");
    if (!participantId) throw new Error("Missing participantId");

    return request(`/admin/events/${eventId}/enrollments`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body: { participantIds: [participantId] },
    });
  },

  removeEnrollment: (eventId, enrollmentId, academyId = "") => {
    if (!eventId) throw new Error("Missing eventId");
    if (!enrollmentId) throw new Error("Missing enrollmentId");

    return request(`/admin/events/${eventId}/enrollments/${enrollmentId}`, {
      method: "DELETE",
      params: withAcademyQuery({}, academyId),
    });
  },

  removeEnrollmentByParticipant: async (
    eventId,
    participantId,
    academyArg = "",
  ) => {
    if (!eventId) throw new Error("Missing eventId");
    if (!participantId) throw new Error("Missing participantId");

    return request(`/admin/events/${eventId}/enrollments/${participantId}`, {
      method: "DELETE",
      params: withAcademyQuery({}, academyArg),
    });
  },

  /* =========================
   * ADMIN: USERS
   * ========================= */
  users: (query = {}) => {
    const academyArg = isObject(query) ? query.academyId : query;
    return request("/admin/users", {
      params: withAcademyQuery(isObject(query) ? query : {}, academyArg),
    });
  },

  getUsers: (query = {}) => {
    const academyArg = isObject(query) ? query.academyId : query;
    return request("/admin/users", {
      params: withAcademyQuery(isObject(query) ? query : {}, academyArg),
    });
  },

  findUserByEmail: (email, query = {}) =>
    request("/admin/users/find-by-email", {
      params: {
        email: String(email || "")
          .trim()
          .toLowerCase(),
        ...(query || {}),
      },
    }),

  createUser: (payload) =>
    request("/admin/users", { method: "POST", body: payload }),

  updateUser: (id, payload) =>
    request(`/admin/users/${id}`, { method: "PUT", body: payload }),

  deactivateUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),

  judges: (academyId = "") =>
    request("/admin/judges", {
      params: withAcademyQuery({}, academyId),
    }),

  getJudges: (academyId = "") =>
    request("/admin/judges", {
      params: withAcademyQuery({}, academyId),
    }),

  /* =========================
   * ADMIN: PARTICIPANTS
   * ========================= */
  participants: (query = {}) => {
    const academyArg = isObject(query) ? query.academyId : query;

    return request("/admin/participants", {
      params: withAcademyQuery(isObject(query) ? query : {}, academyArg),
    });
  },

  getParticipants: (query = {}) => {
    const academyArg = isObject(query) ? query.academyId : query;

    return request("/admin/participants", {
      params: withAcademyQuery(isObject(query) ? query : {}, academyArg),
    });
  },

  createParticipantProfile: (payload) =>
    request("/admin/participants/profile", { method: "POST", body: payload }),

  updateParticipantProfile: (id, payload) =>
    request(`/admin/participants/profile/${id}`, {
      method: "PATCH",
      body: payload,
    }),

  deleteParticipantProfile: (id, academyId = "") =>
    request(`/admin/participants/${id}`, {
      method: "DELETE",
      params: withAcademyQuery({}, academyId),
    }),

  deleteParticipantFull: (id, academyId = "") =>
    request(`/admin/participants/${id}/full`, {
      method: "DELETE",
      params: withAcademyQuery({}, academyId),
    }),

  downloadParticipantsSampleCsv: async () => {
    const blob = await requestBlob("/admin/participants/sample-csv");
    downloadBlob(blob, "participants-sample.csv");
    return true;
  },

  importParticipantsCsv: async (file, academyId = "") => {
    if (!file) throw new Error("Missing CSV file");

    const fd = new FormData();
    fd.append("file", file);

    return requestForm("/admin/participants/import-csv", {
      method: "POST",
      formData: fd,
      params: withAcademyQuery({}, academyId),
    });
  },

  exportParticipantsReport: async (query = {}) => {
    const academyArg = isObject(query) ? query.academyId : query;

    const blob = await requestBlob("/admin/participants/export", {
      params: withAcademyQuery(isObject(query) ? query : {}, academyArg),
    });

    downloadBlob(blob, "participants-report.csv");
    return true;
  },

  /* =========================
   * ADMIN: ASSIGNMENTS
   * ========================= */
  judgeAssignments: (eventId, academyId = "") =>
    request("/admin/judge-assignments", {
      params: withAcademyQuery({ eventId }, academyId),
    }),

  getAssignments: (eventId, academyId = "") =>
    request("/admin/judge-assignments", {
      params: withAcademyQuery({ eventId }, academyId),
    }),

  assignJudge: (payload) =>
    request("/admin/judge-assignments", { method: "POST", body: payload }),

  replaceJudgeAssignments: (payload) =>
    request("/admin/judge-assignments/replace", {
      method: "PUT",
      body: payload,
    }),

  deleteAssignment: (id) =>
    request(`/admin/judge-assignments/${id}`, { method: "DELETE" }),

  /* =========================
   * TOTALS
   * ========================= */
  totalsByGroup: (groupId, academyId = "") =>
    request(`/admin/totals/group/${groupId}`, {
      params: withAcademyQuery({}, academyId),
    }),

  /* =========================
   * ADMIN: EVENT LEADERBOARD
   * ========================= */
  eventLeaderboard: (eventId, academyId = "") =>
    request(`/admin/events/${eventId}/leaderboard`, {
      params: withAcademyQuery({}, academyId),
    }),

  /* =========================
   * RESULTS PUBLISH
   * ========================= */
  publishEventResults: (eventId, academyId = "", body = {}) =>
    request(`/admin/results/events/${eventId}/publish`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body,
    }),

  publishEventActivityResults: (
    eventId,
    activityId,
    academyId = "",
    body = {},
  ) =>
    request(
      `/admin/results/events/${eventId}/activities/${activityId}/publish`,
      {
        method: "POST",
        params: withAcademyQuery({}, academyId),
        body,
      },
    ),

  getPublishedResultsStatus: (query = {}, academyId = "") =>
    request("/admin/results/publish-status", {
      params: withAcademyQuery(query, academyId),
    }),

  /* =========================
   * AWARDS
   * ========================= */
  issueAward: (payload) =>
    request("/admin/awards", { method: "POST", body: payload }),

  awardsHistory: (limit = 50, eventId, academyId = "") =>
    request("/admin/awards", {
      params: withAcademyQuery({ limit, eventId }, academyId),
    }),

  awards: (limit = 50, eventId, academyId = "") =>
    request("/admin/awards", {
      params: withAcademyQuery({ limit, eventId }, academyId),
    }),

  getAwards: (limit = 50, eventId, academyId = "") =>
    request("/admin/awards", {
      params: withAcademyQuery({ limit, eventId }, academyId),
    }),

  deleteAward: (id) => request(`/admin/awards/${id}`, { method: "DELETE" }),

  resetScoresByGroup: (groupId, eventId, academyId = "") =>
    request(`/admin/groups/${groupId}/reset-scores`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body: eventId ? { eventId } : {},
    }),

  /* =========================
   * ADMIN: PAYMENTS
   * ========================= */
  getPaymentsByEnrollment: (enrollmentId, academyId = "") =>
    request("/admin/payments", {
      params: withAcademyQuery({ enrollmentId }, academyId),
    }),

  adminPayments: (query = {}, academyId = "") =>
    request("/admin/payments", {
      params: withAcademyQuery(query, academyId),
    }),

  getPayments: (query = {}, academyId = "") =>
    request("/admin/payments", {
      params: withAcademyQuery(query, academyId),
    }),

  getPayment: (id, academyId = "") =>
    request(`/admin/payments/${id}`, {
      params: withAcademyQuery({}, academyId),
    }),

  createPayment: (payload, academyId = "") =>
    request("/admin/payments", {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body: payload,
    }),

  createAdminPayment: (payload, academyId = "") =>
    request("/admin/payments", {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body: payload,
    }),

  updatePaymentStatus: (id, payload, academyId = "") =>
    request(`/admin/payments/${id}`, {
      method: "PUT",
      params: withAcademyQuery({}, academyId),
      body: payload,
    }),

  markPaymentPaid: (id, academyId = "") =>
    request(`/admin/payments/${id}/mark-paid`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
    }),

  bulkUpdatePaymentsStatus: (paymentIds, paymentStatus, academyId = "") =>
    request("/admin/payments/bulk-status", {
      method: "PUT",
      params: withAcademyQuery({}, academyId),
      body: { paymentIds, paymentStatus },
    }),

  deletePayment: (id, academyId = "") =>
    request(`/admin/payments/${id}`, {
      method: "DELETE",
      params: withAcademyQuery({}, academyId),
    }),
  bulkDeletePayments: async (ids = [], academyId = "") => {
    return request("/admin/payments/bulk/delete", {
      method: "DELETE",
      body: {
        ids,
        academyId,
      },
    });
  },
  paymentsSummary: (query = {}, academyId = "") =>
    request("/admin/payments/summary", {
      params: withAcademyQuery(query, academyId),
    }),

  exportPaymentsReport: async (query = {}) => {
    const academyArg = isObject(query) ? query.academyId : query;

    const blob = await requestBlob("/admin/payments/export", {
      params: withAcademyQuery(isObject(query) ? query : {}, academyArg),
    });

    downloadBlob(blob, "payments-report.csv");
    return true;
  },

  exportPaymentsCsv: async (query = {}) => {
    const academyArg = isObject(query) ? query.academyId : query;

    const blob = await requestBlob("/admin/payments/export", {
      params: withAcademyQuery(isObject(query) ? query : {}, academyArg),
    });

    downloadBlob(blob, "payments-report.csv");
    return true;
  },

  /* =========================
   * CERTIFICATE PDF / ZIP
   * ========================= */
  certificatePdfBlob: (arg1, arg2) =>
    requestBlob(getCertificatePath(arg1, arg2)),

  async downloadCertificatePdf(arg1, arg2) {
    const blob = await requestBlob(getCertificatePath(arg1, arg2));
    downloadBlob(blob, getCertificateFilename(arg1, arg2));
    return true;
  },

  async openCertificatePdf(arg1, arg2) {
    const blob = await requestBlob(getCertificatePath(arg1, arg2));
    openBlobInNewTab(blob);
    return true;
  },

  legacyCertificatePdfBlob: (participantId) =>
    requestBlob(`/admin/certificate/${participantId}.pdf`),

  async downloadLegacyCertificatePdf(participantId) {
    const blob = await requestBlob(`/admin/certificate/${participantId}.pdf`);
    downloadBlob(blob, `certificate-${participantId}.pdf`);
    return true;
  },

  async openLegacyCertificatePdf(participantId) {
    const blob = await requestBlob(`/admin/certificate/${participantId}.pdf`);
    openBlobInNewTab(blob);
    return true;
  },

  eventCertificatesZipBlob: (eventId) =>
    requestBlob(`/admin/events/${eventId}/certificates.zip`),

  async downloadEventCertificatesZip(eventId, eventName = "") {
    if (!eventId) throw new Error("Missing eventId");

    const blob = await requestBlob(`/admin/events/${eventId}/certificates.zip`);
    const suffix = String(eventName || eventId)
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .replace(/\s+/g, "_");

    downloadBlob(blob, `certificates-${suffix || eventId}.zip`);
    return true;
  },

  groupCertificatesZipBlob: (groupId, eventId) =>
    requestBlob(`/admin/groups/${groupId}/certificates.zip`, {
      params: { eventId },
    }),

  async downloadGroupCertificatesZip(groupId, eventId, groupName = "") {
    if (!groupId) throw new Error("Missing groupId");
    if (!eventId) throw new Error("Missing eventId");

    const blob = await requestBlob(
      `/admin/groups/${groupId}/certificates.zip`,
      {
        params: { eventId },
      },
    );

    const suffix = String(groupName || groupId)
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .replace(/\s+/g, "_");

    downloadBlob(blob, `certificates-group-${suffix || groupId}.zip`);
    return true;
  },

  async downloadLegacyGroupCertificatesZip(groupId) {
    if (!groupId) throw new Error("Missing groupId");

    const blob = await requestBlob(`/admin/certificates/group/${groupId}.zip`);
    downloadBlob(blob, `certificates-group-${groupId}.zip`);
    return true;
  },

  /* =========================
   * CERTIFICATE RECORDS / VERIFY
   * ========================= */
  certificateRecords: (query = {}) =>
    request("/admin/certificates", { params: query }),

  certificateBySerial: (serialNo) =>
    request(`/admin/certificates/${encodeURIComponent(serialNo)}`),

  revokeCertificate: (serialNo, reason = "") =>
    request(`/admin/certificates/${encodeURIComponent(serialNo)}/revoke`, {
      method: "POST",
      body: { reason },
    }),

  restoreCertificate: (serialNo) =>
    request(`/admin/certificates/${encodeURIComponent(serialNo)}/restore`, {
      method: "POST",
    }),

  revokeCertificateRecord: (serialNo, reason = "") =>
    request(`/admin/certificates/${encodeURIComponent(serialNo)}/revoke`, {
      method: "POST",
      body: { reason },
    }),

  restoreCertificateRecord: (serialNo) =>
    request(`/admin/certificates/${encodeURIComponent(serialNo)}/restore`, {
      method: "POST",
    }),

  deleteCertificateRecord: (serialNo) =>
    request(`/admin/certificates/${encodeURIComponent(serialNo)}`, {
      method: "DELETE",
    }),

  buildCertificateVerifyUrl: (token) => {
    if (!token) throw new Error("Missing verification token");
    return buildUrl(`/public/verify-certificate${qs({ t: token })}`);
  },

  /* =========================
   * CERTIFICATE TEMPLATE
   * ========================= */
  getCertificateTemplateInfo: () => request("/admin/cert-template/info"),

  async uploadCertificateTemplatePdf(file) {
    if (!file) throw new Error("Missing file");
    if (file.type !== "application/pdf") {
      throw new Error("Only PDF allowed");
    }

    const fd = new FormData();
    fd.append("file", file);

    return requestForm("/admin/cert-template/upload", {
      method: "POST",
      formData: fd,
    });
  },

  certificateTemplatePdfBlob: () => requestBlob("/admin/cert-template/pdf"),

  async downloadCertificateTemplatePdf() {
    const blob = await requestBlob("/admin/cert-template/pdf");
    downloadBlob(blob, "certificate-template.pdf");
    return true;
  },

  async openCertificateTemplatePdf() {
    const blob = await requestBlob("/admin/cert-template/pdf");
    openBlobInNewTab(blob);
    return true;
  },

  deleteCertificateTemplate: () =>
    request("/admin/cert-template/delete", { method: "DELETE" }),

  /* =========================
   * JUDGE
   * ========================= */
  myEvents: (academyId = "") =>
    request("/judge/me/events", {
      params: withAcademyQuery({}, academyId),
    }),

  judgeEvents: (academyId = "") =>
    request("/judge/me/events", {
      params: withAcademyQuery({}, academyId),
    }),

  myEventAssignments: (eventId, academyId = "") =>
    request(`/judge/events/${eventId}/assignments`, {
      params: withAcademyQuery({}, academyId),
    }),

  judgeEventParticipants: (eventId, activityId = "", academyId = "") =>
    request(`/judge/events/${eventId}/participants`, {
      params: withAcademyQuery(withOptionalActivity({}, activityId), academyId),
    }),

  upsertEventScore: (eventId, payload, academyId = "") =>
    request(`/judge/events/${eventId}/score`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body: payload,
    }),

  createJudgeEventAlert: (eventId, payload, academyId = "") =>
    request(`/judge/events/${eventId}/alerts`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body: payload,
    }),

  judgeEventScores: (eventId, activityId = "", academyId = "") =>
    request(`/judge/events/${eventId}/scores`, {
      params: withAcademyQuery(withOptionalActivity({}, activityId), academyId),
    }),

  myEventScores: (eventId, activityId = "", academyId = "") =>
    request(`/judge/events/${eventId}/scores`, {
      params: withAcademyQuery(withOptionalActivity({}, activityId), academyId),
    }),

  judgeScores: (eventId, activityId = "", academyId = "") =>
    request(`/judge/events/${eventId}/scores`, {
      params: withAcademyQuery(withOptionalActivity({}, activityId), academyId),
    }),

  finalizeJudgeActivity: (eventId, activityId, payload = {}, academyId = "") =>
    request(`/judge/events/${eventId}/activities/${activityId}/finalize`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body: payload,
    }),

  finalizeEventActivityScores: (
    eventId,
    activityId,
    payload = {},
    academyId = "",
  ) =>
    request(`/judge/events/${eventId}/activities/${activityId}/finalize`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body: payload,
    }),

  myAssignments: (eventId, academyId = "") =>
    request("/judge/me/assignments", {
      params: withAcademyQuery({ eventId }, academyId),
    }),

  judgeParticipants: (eventId, academyId = "") =>
    request("/judge/participants", {
      params: withAcademyQuery({ eventId }, academyId),
    }),

  async upsertScore(payload = {}, academyId = "") {
    const eventId = await ensureJudgeEventId(payload.eventId);
    const body = { ...payload };
    delete body.eventId;

    return request(`/judge/events/${eventId}/score`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body,
    });
  },

  async createJudgeAlert(payload = {}, academyId = "") {
    const eventId = await ensureJudgeEventId(payload.eventId);
    const body = { ...payload };
    delete body.eventId;

    return request(`/judge/events/${eventId}/alerts`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body,
    });
  },

  /* =========================
   * PARTICIPANT
   * ========================= */
  meParticipant: () => request("/participant/me"),

  getParticipantNotifications: (query = {}) =>
    request("/participant/notifications", { params: query }),

  getParticipantUnreadNotificationCount: () =>
    request("/participant/notifications/unread-count"),

  markParticipantNotificationRead: (id) =>
    request(`/participant/notifications/${id}/read`, { method: "PUT" }),

  markParticipantNotificationUnread: (id) =>
    request(`/participant/notifications/${id}/unread`, { method: "PUT" }),

  markAllParticipantNotificationsRead: () =>
    request("/participant/notifications/read-all", { method: "PUT" }),

  deleteParticipantNotification: (id) =>
    request(`/participant/notifications/${id}`, { method: "DELETE" }),

  participantCertificatePdfBlob: () =>
    requestBlob(getParticipantCertificatePath()),

  async downloadParticipantCertificatePdf() {
    const blob = await requestBlob(getParticipantCertificatePath());
    downloadBlob(blob, "my-certificate.pdf");
    return true;
  },

  async openParticipantCertificate() {
    const blob = await requestBlob(getParticipantCertificatePath());
    openBlobInNewTab(blob);
    return true;
  },

  /* =========================
   * ADMIN ALERTS
   * ========================= */
  adminAlerts: (params = {}) => request("/admin/alerts", { params }),

  alerts: (params = {}) => request("/admin/alerts", { params }),

  getAlerts: (params = {}) => request("/admin/alerts", { params }),

  createAdminAlert: (payload) =>
    request("/admin/alerts", {
      method: "POST",
      body: payload,
    }),

  resolveAlert: (id) =>
    request(`/admin/alerts/${id}/resolve`, { method: "POST" }),

  deleteAlert: (id) => request(`/admin/alerts/${id}`, { method: "DELETE" }),

  /* =========================
   * NOTIFICATIONS
   * Common notification center for Admin / Judge / Parent / Participant
   * Backend route: /api/notifications
   * ========================= */

  notifications: (params = {}) =>
    request("/notifications", {
      params,
    }),

  getNotifications: (params = {}) =>
    request("/notifications", {
      params,
    }),

  listNotifications: (params = {}) =>
    request("/notifications", {
      params,
    }),

  notificationUnreadCount: () => request("/notifications/unread-count"),

  getUnreadNotificationsCount: () => request("/notifications/unread-count"),

  getNotificationUnreadCount: () => request("/notifications/unread-count"),

  unreadNotifications: () => request("/notifications/unread-count"),

  notificationMarkRead: (id) =>
    request(`/notifications/${id}/read`, {
      method: "PATCH",
    }),

  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, {
      method: "PATCH",
    }),

  markCommonNotificationRead: (id) =>
    request(`/notifications/${id}/read`, {
      method: "PATCH",
    }),

  notificationMarkUnread: (id) =>
    request(`/notifications/${id}/unread`, {
      method: "PATCH",
    }),

  markNotificationUnread: (id) =>
    request(`/notifications/${id}/unread`, {
      method: "PATCH",
    }),

  markCommonNotificationUnread: (id) =>
    request(`/notifications/${id}/unread`, {
      method: "PATCH",
    }),

  notificationMarkAllRead: () =>
    request("/notifications/read-all", {
      method: "PATCH",
    }),

  markAllNotificationsRead: () =>
    request("/notifications/read-all", {
      method: "PATCH",
    }),

  markAllCommonNotificationsRead: () =>
    request("/notifications/read-all", {
      method: "PATCH",
    }),

  notificationMarkAllReadAlias: () =>
    request("/notifications/mark-all-read", {
      method: "PATCH",
    }),

  notificationBulkRead: (ids = []) =>
    request("/notifications/bulk-read", {
      method: "PATCH",
      body: {
        ids: Array.isArray(ids) ? ids : [],
      },
    }),

  bulkReadNotifications: (ids = []) =>
    request("/notifications/bulk-read", {
      method: "PATCH",
      body: {
        ids: Array.isArray(ids) ? ids : [],
      },
    }),

  deleteNotification: (id) =>
    request(`/notifications/${id}`, {
      method: "DELETE",
    }),

  notificationDelete: (id) =>
    request(`/notifications/${id}`, {
      method: "DELETE",
    }),

  deleteCommonNotification: (id) =>
    request(`/notifications/${id}`, {
      method: "DELETE",
    }),

  /*
   * Admin notification send/broadcast.
   * Keep these only if your backend has:
   * /admin/notifications/send
   * /admin/notifications/broadcast
   */
  adminSendNotification: (payload) =>
    request("/admin/notifications/send", {
      method: "POST",
      body: normalizeNotificationSendPayload(payload),
    }),

  adminBroadcastNotification: (payload) =>
    request("/admin/notifications/broadcast", {
      method: "POST",
      body: payload,
    }),

  sendNotification: (payload) =>
    request("/admin/notifications/send", {
      method: "POST",
      body: normalizeNotificationSendPayload(payload),
    }),

  broadcastNotification: (payload) =>
    request("/admin/notifications/broadcast", {
      method: "POST",
      body: payload,
    }),

  adminNotificationHistory: (params = {}) =>
    request("/admin/notifications/history", {
      params,
    }),

  getAdminNotificationHistory: (params = {}) =>
    request("/admin/notifications/history", {
      params,
    }),
  /* =========================
   * PARENT
   * ========================= */
  getParentDashboard: (query = {}) =>
    request("/parent/dashboard", { params: query }),

  getParentChildren: (query = {}) =>
    request("/parent/children", { params: query }),

  getParentEvents: (query = {}) => request("/parent/events", { params: query }),

  getParentResults: (query = {}) =>
    request("/parent/results", { params: query }),

  getParentCertificates: (query = {}) =>
    request("/parent/certificates", { params: query }),

  getParentPayments: (query = {}) =>
    request("/parent/payments", { params: query }),

  getParentBookings: (query = {}) =>
    request("/parent/bookings", { params: query }),

  getParentNotifications: (query = {}) =>
    request("/parent/notifications", { params: query }),

  getParentUnreadNotificationCount: () =>
    request("/parent/notifications/unread-count"),

  markParentNotificationRead: (id) =>
    request(`/parent/notifications/${id}/read`, { method: "POST" }),

  markParentNotificationUnread: (id) =>
    request(`/parent/notifications/${id}/unread`, { method: "POST" }),

  markAllParentNotificationsRead: () =>
    request("/parent/notifications/read-all", { method: "POST" }),

  deleteParentNotification: (id) =>
    request(`/parent/notifications/${id}`, { method: "DELETE" }),

  createParentPaymentSession: (paymentId, payload = {}) =>
    request(`/parent/payments/${paymentId}/pay`, {
      method: "POST",
      body: payload,
    }),

  payParentPayment: (paymentId, payload = {}) =>
    request(`/parent/payments/${paymentId}/pay`, {
      method: "POST",
      body: payload,
    }),

  startParentPayment: (paymentId, payload = {}) =>
    request(`/parent/payments/${paymentId}/pay`, {
      method: "POST",
      body: payload,
    }),

  initiateParentPayment: (paymentId, payload = {}) =>
    request(`/parent/payments/${paymentId}/pay`, {
      method: "POST",
      body: payload,
    }),

  getParentPaymentReceiptBlob: (paymentId) =>
    requestBlob(`/parent/payments/${paymentId}/receipt`),

  async downloadParentPaymentReceipt(paymentId) {
    const blob = await requestBlob(`/parent/payments/${paymentId}/receipt`);
    downloadBlob(blob, getParentReceiptFilename(paymentId));
    return true;
  },

  async openParentPaymentReceipt(paymentId) {
    const blob = await requestBlob(`/parent/payments/${paymentId}/receipt`);
    openBlobInNewTab(blob);
    return true;
  },

  async openParentReceipt(paymentId) {
    const blob = await requestBlob(`/parent/payments/${paymentId}/receipt`);
    openBlobInNewTab(blob);
    return true;
  },

  async downloadParentReceipt(paymentId) {
    const blob = await requestBlob(`/parent/payments/${paymentId}/receipt`);
    downloadBlob(blob, getParentReceiptFilename(paymentId));
    return true;
  },

  async openParentCertificate(item = {}) {
    const eventId = String(
      item?.eventId?._id ||
        item?.eventId ||
        item?.event?._id ||
        item?.event ||
        "",
    ).trim();

    const participantId = String(
      item?.childId ||
        item?.participantId?._id ||
        item?.participantId ||
        item?.child?._id ||
        item?.child ||
        "",
    ).trim();

    if (!eventId || !participantId) {
      throw new Error("Missing eventId or participantId for certificate");
    }

    const blob = await requestPublicBlob(
      `/public/events/${eventId}/certificate/${participantId}.pdf`,
    );
    openBlobInNewTab(blob);
    return true;
  },

  markParentNotificationReadLegacy: (id) =>
    request(`/parent/notifications/${id}/read`, { method: "POST" }),

  markAllParentNotificationsReadLegacy: () =>
    request("/parent/notifications/read-all", { method: "POST" }),

  /* =========================
   * ADMIN PAYMENT EMAILS
   * ========================= */
  sendPaymentDocumentEmail: (paymentId, body, academyId = "") =>
    request(`/admin/payments/${paymentId}/send-document-email`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body,
    }),

  sendPaymentsReportEmail: (body, academyId = "") =>
    request(`/admin/payments/reports/send-email`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body,
    }),

  /* =========================
   * EMAIL
   * ========================= */
  getEmailSettings: (options = {}) =>
    request("/admin/email/settings", {
      ...(isOptionsObject(options) ? options : {}),
    }),

  updateEmailSettings: (payload, options = {}) =>
    request("/admin/email/settings", {
      method: "PUT",
      body: payload,
      ...(isOptionsObject(options) ? options : {}),
    }),

  verifyEmailSettings: (payloadOrOptions = {}, maybeOptions = {}) => {
    const optionsOnly =
      isOptionsObject(payloadOrOptions) &&
      (payloadOrOptions.headers ||
        payloadOrOptions.params ||
        payloadOrOptions.timeoutMs) &&
      !Object.prototype.hasOwnProperty.call(payloadOrOptions, "academyId") &&
      !Object.prototype.hasOwnProperty.call(payloadOrOptions, "host") &&
      !Object.prototype.hasOwnProperty.call(payloadOrOptions, "port") &&
      !Object.prototype.hasOwnProperty.call(payloadOrOptions, "username") &&
      !Object.prototype.hasOwnProperty.call(payloadOrOptions, "password") &&
      !Object.prototype.hasOwnProperty.call(payloadOrOptions, "fromEmail");

    const payload = optionsOnly ? {} : payloadOrOptions || {};
    const options = optionsOnly
      ? payloadOrOptions
      : isOptionsObject(maybeOptions)
        ? maybeOptions
        : {};

    return request("/admin/email/verify", {
      method: "POST",
      body: payload,
      ...options,
    });
  },

  testEmailSettings: (payload, options = {}) =>
    request("/admin/email/test", {
      method: "POST",
      body: {
        to: payload?.to,
        cc: payload?.cc || [],
        bcc: payload?.bcc || [],
        subject: payload?.subject,
        html: payload?.html,
        text: payload?.text,
        message: payload?.message || payload?.text || payload?.html,
        template: payload?.template || "",
        data: payload?.data || {},
      },
      ...(isOptionsObject(options) ? options : {}),
    }),

  sendEmail: (payload, options = {}) =>
    request("/admin/email/test", {
      method: "POST",
      body: {
        to: Array.isArray(payload?.to) ? payload.to[0] : payload?.to,
        cc: payload?.cc || [],
        bcc: payload?.bcc || [],
        subject: payload?.subject,
        html: payload?.html,
        text: payload?.text,
        message: payload?.message || payload?.text || payload?.html,
        template: payload?.template || "",
        data: payload?.data || {},
      },
      ...(isOptionsObject(options) ? options : {}),
    }),

  sendBulkEmail: (payload, options = {}) =>
    request("/admin/email/bulk", {
      method: "POST",
      body: {
        mode: payload?.mode || "manual",
        emails: Array.isArray(payload?.emails) ? payload.emails : [],
        role: payload?.role || "",
        eventId: payload?.eventId || "",
        subject: payload?.subject || "",
        html: payload?.html || "",
        text: payload?.text || "",
        template: payload?.template || "",
        data: payload?.data || {},
        cc: Array.isArray(payload?.cc) ? payload.cc : [],
        bcc: Array.isArray(payload?.bcc) ? payload.bcc : [],
        chunkSize: Number(payload?.chunkSize || 50),
      },
      ...(isOptionsObject(options) ? options : {}),
    }),

  previewEmail: (payload, options = {}) =>
    request("/admin/email/templates/preview", {
      method: "POST",
      body: {
        subject: payload?.subject || "",
        html: payload?.html || "",
        text: payload?.text || "",
        template: payload?.template || "",
        data: payload?.data || {},
      },
      ...(isOptionsObject(options) ? options : {}),
    }),

  previewEmailTemplate: (payload, options = {}) =>
    request("/admin/email/templates/preview", {
      method: "POST",
      body: {
        subject: payload?.subject || "",
        html: payload?.html || "",
        text: payload?.text || "",
        template: payload?.template || "",
        data: payload?.data || {},
      },
      ...(isOptionsObject(options) ? options : {}),
    }),

  getEmailLogs: (params = {}, options = {}) =>
    request("/admin/email/logs", {
      params,
      ...(isOptionsObject(options) ? options : {}),
    }),

  getEmailLogById: (id, options = {}) =>
    request(`/admin/email/logs/${id}`, {
      ...(isOptionsObject(options) ? options : {}),
    }),

  getEmailHistorySummary: (options = {}) =>
    request("/admin/email/logs", {
      ...(isOptionsObject(options) ? options : {}),
      params: {
        limit: 1,
        ...((isOptionsObject(options) && options.params) || {}),
      },
    }),

  /* =========================
   * GROUP RESULT PUBLISH
   * ========================= */
  publishGroupResults: (groupId, academyId = "", body = {}) =>
    request(`/admin/groups/${groupId}/publish-results`, {
      method: "POST",
      params: withAcademyQuery({}, academyId),
      body,
    }),

  /* =========================
   * EMAIL TEMPLATES
   * ========================= */
  getEmailTemplates: (query = {}, academyId = "") => {
    const params = { ...(isObject(query) ? query : {}) };
    const resolvedAcademyId = normalizeAcademyQueryArg(
      academyId || params.academyId,
    );

    if (resolvedAcademyId) {
      params.academyId = resolvedAcademyId;
    } else {
      delete params.academyId;
    }

    return request("/admin/email/templates", { params });
  },

  getEmailTemplateById: (id, query = {}, academyId = "") => {
    const params = { ...(isObject(query) ? query : {}) };
    const resolvedAcademyId = normalizeAcademyQueryArg(
      academyId || params.academyId,
    );

    if (resolvedAcademyId) {
      params.academyId = resolvedAcademyId;
    } else {
      delete params.academyId;
    }

    return request(`/admin/email/templates/${id}`, { params });
  },

  createEmailTemplate: (payload = {}, academyId = "") => {
    const resolvedAcademyId = normalizeAcademyQueryArg(
      academyId || payload?.academyId,
    );

    const params = resolvedAcademyId ? { academyId: resolvedAcademyId } : {};

    return request("/admin/email/templates", {
      method: "POST",
      params,
      body: payload,
    });
  },

  updateEmailTemplate: (id, payload = {}, academyId = "") => {
    const resolvedAcademyId = normalizeAcademyQueryArg(
      academyId || payload?.academyId,
    );

    const params = resolvedAcademyId ? { academyId: resolvedAcademyId } : {};

    return request(`/admin/email/templates/${id}`, {
      method: "PUT",
      params,
      body: payload,
    });
  },

  toggleEmailTemplate: (id, payload = {}, academyId = "") => {
    const resolvedAcademyId = normalizeAcademyQueryArg(
      academyId || payload?.academyId,
    );

    const params = resolvedAcademyId ? { academyId: resolvedAcademyId } : {};

    return request(`/admin/email/templates/${id}/toggle`, {
      method: "PATCH",
      params,
      body: payload,
    });
  },

  deleteEmailTemplate: (id, query = {}, academyId = "") => {
    const params = { ...(isObject(query) ? query : {}) };
    const resolvedAcademyId = normalizeAcademyQueryArg(
      academyId || params.academyId,
    );

    if (resolvedAcademyId) {
      params.academyId = resolvedAcademyId;
    } else {
      delete params.academyId;
    }

    return request(`/admin/email/templates/${id}`, {
      method: "DELETE",
      params,
    });
  },
};
export default api;
