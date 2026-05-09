import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { UI } from "./ui.js";

/**
 * Settings.jsx — WOW FACTOR / ENTERPRISE STUDIO UPGRADE V3
 * ✅ Real Save All workflow
 * ✅ Revert unsaved changes
 * ✅ Global theme token generation from brand color
 * ✅ WordPress-like theme control behavior
 * ✅ Live preview before saving
 * ✅ Change Password
 * ✅ Upload Logo (server / Render Disk, fallback localStorage)
 * ✅ Theme Color + Presets + Hex validation
 * ✅ Font + Live preview + Custom font-family
 * ✅ Login page media: image OR video
 * ✅ Drag & drop uploads
 * ✅ Unsaved changes detection + beforeunload protection
 * ✅ Reset by section / reset all
 * ✅ Export / import settings JSON
 * ✅ Password strength + show/hide + checklist
 * ✅ Login page overlay text / overlay opacity / media fit
 * ✅ Optional sync to server (if API exists)
 * ✅ Storage usage estimator + usage meter
 * ✅ Stronger visual previews
 * ✅ Quick actions / premium UI / responsive layout
 * ✅ Auto-clearing flash messages
 * ✅ Safer server payload normalization
 * ✅ Better media mode switching
 * ✅ Image/video recommendations + validation
 * ✅ Preview refresh for server video / IndexedDB fallback
 */

const LS_LOGO = "ra_admin_logo";
const LS_ACCENT = "ra_admin_accent";
const LS_FONT = "ra_admin_font";

const LS_LOGIN_KIND = "ra_login_media_kind";
const LS_LOGIN_IMAGE = "ra_login_media_image";
const LS_LOGIN_VIDEO_MIME = "ra_login_media_video_mime";

const LS_LOGIN_OVERLAY_TITLE = "ra_login_overlay_title";
const LS_LOGIN_OVERLAY_SUBTITLE = "ra_login_overlay_subtitle";
const LS_LOGIN_OVERLAY_OPACITY = "ra_login_overlay_opacity";
const LS_LOGIN_MEDIA_FIT = "ra_login_media_fit";
const LS_LOGIN_VIDEO_AUTOPLAY = "ra_login_video_autoplay";
const LS_LOGIN_VIDEO_MUTED = "ra_login_video_muted";
const LS_LOGIN_VIDEO_LOOP = "ra_login_video_loop";

const LS_LAST_PASSWORD_CHANGE = "ra_settings_last_password_change";

const IDB_NAME = "ra_media_db";
const IDB_STORE = "blobs";
const IDB_LOGIN_VIDEO_KEY = "login_media_video";

const DEFAULT_ACCENT = "#e11d2e";
const DEFAULT_FONT =
  "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

const DEFAULT_SETTINGS = {
  accent: DEFAULT_ACCENT,
  font: DEFAULT_FONT,
  logoDataUrl: "",
  loginKind: "default",
  loginImage: "",
  loginVideoMime: "video/mp4",
  loginOverlayTitle: "Welcome Back",
  loginOverlaySubtitle: "Sign in to continue to the admin dashboard.",
  loginOverlayOpacity: 0.3,
  loginMediaFit: "cover",
  loginVideoAutoplay: true,
  loginVideoMuted: true,
  loginVideoLoop: true,
};

const THEME_PRESETS = [
  { name: "Rebel Red", color: "#e11d2e" },
  { name: "Royal Blue", color: "#2563eb" },
  { name: "Emerald", color: "#059669" },
  { name: "Purple", color: "#7c3aed" },
  { name: "Amber Gold", color: "#d97706" },
  { name: "Teal", color: "#0f766e" },
  { name: "Rose Pink", color: "#e11d87" },
  { name: "Slate Dark", color: "#334155" },
];

const FONT_PRESETS = [
  { label: "System (Default)", value: DEFAULT_FONT },
  {
    label: "Inter",
    value:
      '"Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  },
  {
    label: "Poppins",
    value:
      '"Poppins", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  },
  {
    label: "Montserrat",
    value:
      '"Montserrat", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  },
  {
    label: "Raleway",
    value:
      '"Raleway", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  },
  {
    label: "Roboto",
    value: '"Roboto", system-ui, -apple-system, Segoe UI, Arial, sans-serif',
  },
  { label: "Arial", value: '"Arial", system-ui, sans-serif' },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
];

const FALLBACK_LOGO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="28" fill="#ffffff"/>
      <rect x="12" y="12" width="136" height="136" rx="24" fill="#f8fafc" stroke="#e2e8f0"/>
      <path d="M44 108V52l36-16 36 16v56" fill="none" stroke="#e11d2e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M63 108V78h34v30" fill="none" stroke="#0f172a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `);

function assetUrl(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${clean}`;
}

function getInitialSettings() {
  return sanitizeSettingsPayload({
    accent: readLs(LS_ACCENT, DEFAULT_ACCENT),
    font: readLs(LS_FONT, DEFAULT_FONT),
    logoDataUrl: readLs(LS_LOGO, ""),
    loginKind: readLs(LS_LOGIN_KIND, "default"),
    loginImage: readLs(LS_LOGIN_IMAGE, ""),
    loginVideoMime: readLs(LS_LOGIN_VIDEO_MIME, "video/mp4"),
    loginOverlayTitle: readLs(
      LS_LOGIN_OVERLAY_TITLE,
      DEFAULT_SETTINGS.loginOverlayTitle,
    ),
    loginOverlaySubtitle: readLs(
      LS_LOGIN_OVERLAY_SUBTITLE,
      DEFAULT_SETTINGS.loginOverlaySubtitle,
    ),
    loginOverlayOpacity: readLsNumber(
      LS_LOGIN_OVERLAY_OPACITY,
      DEFAULT_SETTINGS.loginOverlayOpacity,
    ),
    loginMediaFit: readLs(LS_LOGIN_MEDIA_FIT, DEFAULT_SETTINGS.loginMediaFit),
    loginVideoAutoplay: readLsBool(
      LS_LOGIN_VIDEO_AUTOPLAY,
      DEFAULT_SETTINGS.loginVideoAutoplay,
    ),
    loginVideoMuted: readLsBool(
      LS_LOGIN_VIDEO_MUTED,
      DEFAULT_SETTINGS.loginVideoMuted,
    ),
    loginVideoLoop: readLsBool(
      LS_LOGIN_VIDEO_LOOP,
      DEFAULT_SETTINGS.loginVideoLoop,
    ),
  });
}

export default function Settings() {
  const initialSettings = useMemo(() => getInitialSettings(), []);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [activeTab, setActiveTab] = useState("SECURITY");

  const [accent, setAccent] = useState(initialSettings.accent);
  const [font, setFont] = useState(initialSettings.font);
  const [logoDataUrl, setLogoDataUrl] = useState(initialSettings.logoDataUrl);
  const [loginKind, setLoginKind] = useState(initialSettings.loginKind);
  const [loginImage, setLoginImage] = useState(initialSettings.loginImage);
  const [loginVideoMime, setLoginVideoMime] = useState(
    initialSettings.loginVideoMime,
  );

  const [loginOverlayTitle, setLoginOverlayTitle] = useState(
    initialSettings.loginOverlayTitle,
  );
  const [loginOverlaySubtitle, setLoginOverlaySubtitle] = useState(
    initialSettings.loginOverlaySubtitle,
  );
  const [loginOverlayOpacity, setLoginOverlayOpacity] = useState(
    initialSettings.loginOverlayOpacity,
  );
  const [loginMediaFit, setLoginMediaFit] = useState(
    initialSettings.loginMediaFit,
  );
  const [loginVideoAutoplay, setLoginVideoAutoplay] = useState(
    initialSettings.loginVideoAutoplay,
  );
  const [loginVideoMuted, setLoginVideoMuted] = useState(
    initialSettings.loginVideoMuted,
  );
  const [loginVideoLoop, setLoginVideoLoop] = useState(
    initialSettings.loginVideoLoop,
  );

  const [savedSettings, setSavedSettings] = useState(initialSettings);

  const [loginVideoPreviewUrl, setLoginVideoPreviewUrl] = useState("");
  const previewUrlRef = useRef("");

  const [logoMeta, setLogoMeta] = useState(() =>
    getDataUrlMeta(initialSettings.logoDataUrl, "Stored logo"),
  );
  const [loginMediaMeta, setLoginMediaMeta] = useState(() =>
    getDataUrlMeta(initialSettings.loginImage, "Stored image"),
  );

  const [logoDragOver, setLogoDragOver] = useState(false);
  const [mediaDragOver, setMediaDragOver] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [importBusy, setImportBusy] = useState(false);
  const [serverSyncEnabled] = useState(
    !!(
      api?.adminUploadBrandingLogo ||
      api?.adminUploadLoginMedia ||
      api?.adminSaveBrandingSettings ||
      api?.adminGetBrandingSettings ||
      api?.saveSettings ||
      api?.adminSaveSettings ||
      api?.getSettings ||
      api?.adminGetSettings
    ),
  );

  const lastPasswordChanged = useMemo(
    () => readLs(LS_LAST_PASSWORD_CHANGE, ""),
    [],
  );

  const passwordChecks = useMemo(() => {
    const v = String(newPassword || "");
    return {
      length: v.length >= 8,
      upper: /[A-Z]/.test(v),
      lower: /[a-z]/.test(v),
      number: /\d/.test(v),
      special: /[^A-Za-z0-9]/.test(v),
    };
  }, [newPassword]);

  const passwordStrength = useMemo(() => {
    const passed = Object.values(passwordChecks).filter(Boolean).length;
    if (!newPassword) return { score: 0, label: "Empty", tone: "empty" };
    if (passed <= 2) return { score: 25, label: "Weak", tone: "weak" };
    if (passed === 3) return { score: 50, label: "Fair", tone: "fair" };
    if (passed === 4) return { score: 75, label: "Good", tone: "good" };
    return { score: 100, label: "Strong", tone: "strong" };
  }, [passwordChecks, newPassword]);

  const canChangePassword = useMemo(() => {
    if (!currentPassword || !newPassword || !confirmPassword) return false;
    if (newPassword.length < 8) return false;
    if (newPassword !== confirmPassword) return false;
    if (!Object.values(passwordChecks).every(Boolean)) return false;
    return true;
  }, [currentPassword, newPassword, confirmPassword, passwordChecks]);

  const currentSettings = useMemo(
    () =>
      sanitizeSettingsPayload({
        accent,
        font,
        logoDataUrl,
        loginKind,
        loginImage,
        loginVideoMime,
        loginOverlayTitle,
        loginOverlaySubtitle,
        loginOverlayOpacity,
        loginMediaFit,
        loginVideoAutoplay,
        loginVideoMuted,
        loginVideoLoop,
      }),
    [
      accent,
      font,
      logoDataUrl,
      loginKind,
      loginImage,
      loginVideoMime,
      loginOverlayTitle,
      loginOverlaySubtitle,
      loginOverlayOpacity,
      loginMediaFit,
      loginVideoAutoplay,
      loginVideoMuted,
      loginVideoLoop,
    ],
  );

  const isDirty = useMemo(
    () => !areSettingsEqual(currentSettings, savedSettings),
    [currentSettings, savedSettings],
  );

  const storageUsage = useMemo(() => {
    const totalStr =
      JSON.stringify({
        logoDataUrl,
        accent,
        font,
        loginKind,
        loginImage,
        loginVideoMime,
        loginOverlayTitle,
        loginOverlaySubtitle,
        loginOverlayOpacity,
        loginMediaFit,
        loginVideoAutoplay,
        loginVideoMuted,
        loginVideoLoop,
      }) || "";
    const bytes = new Blob([totalStr]).size;
    const kb = bytes / 1024;
    const mb = kb / 1024;
    const softLimitMB = 5;
    const usagePct = clamp((mb / softLimitMB) * 100, 0, 100);

    return {
      bytes,
      kb,
      mb,
      usagePct,
      text: mb >= 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(1)} KB`,
    };
  }, [
    logoDataUrl,
    accent,
    font,
    loginKind,
    loginImage,
    loginVideoMime,
    loginOverlayTitle,
    loginOverlaySubtitle,
    loginOverlayOpacity,
    loginMediaFit,
    loginVideoAutoplay,
    loginVideoMuted,
    loginVideoLoop,
  ]);

  const brandingScore = useMemo(() => {
    let score = 40;
    if (logoDataUrl) score += 15;
    if (accent && isHex(accent)) score += 15;
    if (font && font !== DEFAULT_FONT) score += 10;
    if (loginKind !== "default") score += 10;
    if (loginOverlayTitle?.trim()) score += 5;
    if (loginOverlaySubtitle?.trim()) score += 5;
    return clamp(score, 0, 100);
  }, [
    logoDataUrl,
    accent,
    font,
    loginKind,
    loginOverlayTitle,
    loginOverlaySubtitle,
  ]);

  useEffect(() => {
    applyRootVars(currentSettings);
  }, [currentSettings]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateVideoPreview() {
      if (loginKind === "video_url") {
        clearVideoPreview();
        return;
      }

      if (loginKind !== "video_idb") {
        clearVideoPreview();
        return;
      }

      try {
        const blob = await idbGetBlob(IDB_LOGIN_VIDEO_KEY);
        if (cancelled) return;

        if (blob) {
          setVideoPreviewFromBlob(blob);
          setLoginMediaMeta({
            name: "Stored video",
            sizeMB: blob.size ? blob.size / (1024 * 1024) : 0,
            type: blob.type || loginVideoMime || "video/mp4",
          });
        } else {
          setLoginMediaMeta({ name: "", sizeMB: 0, type: "" });
          clearVideoPreview();
        }
      } catch {
        if (!cancelled) clearVideoPreview();
      }
    }

    hydrateVideoPreview();
    return () => {
      cancelled = true;
    };
  }, [loginKind, loginVideoMime]);

  useEffect(() => {
    return () => clearVideoPreview();
  }, []);

  useEffect(() => {
    if (!msg && !err) return;
    const t = window.setTimeout(() => {
      setMsg("");
      setErr("");
    }, 3500);
    return () => window.clearTimeout(t);
  }, [msg, err]);

  useEffect(() => {
    function handleBeforeUnload(e) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setMsg("");
        setErr("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function changePassword() {
    setErr("");
    setMsg("");

    if (!canChangePassword) {
      setErr(
        "Please complete all password requirements and make sure confirmation matches.",
      );
      return;
    }

    if (currentPassword === newPassword) {
      setErr("New password must be different from the current password.");
      return;
    }

    setBusy(true);
    try {
      if (typeof api?.changePassword === "function") {
        await api.changePassword({ currentPassword, newPassword });
      } else if (typeof api?.adminChangePassword === "function") {
        await api.adminChangePassword({ currentPassword, newPassword });
      } else if (typeof api?.meChangePassword === "function") {
        await api.meChangePassword({ currentPassword, newPassword });
      } else {
        throw new Error(
          "Password API not found. Add api.changePassword() or api.adminChangePassword() in lib/api.js",
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      writeLs(LS_LAST_PASSWORD_CHANGE, new Date().toISOString());
      setMsg("Password updated successfully.");
    } catch (e) {
      setErr(normalizeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPickLogo(file) {
    setErr("");
    setMsg("");
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErr("Please select an image file (PNG/JPG/SVG/WebP).");
      return;
    }

    const maxMB = 5;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxMB) {
      setErr(`Logo too large (${sizeMB.toFixed(1)}MB). Max ${maxMB}MB.`);
      return;
    }

    try {
      setSyncBusy(true);

      if (typeof api?.adminUploadBrandingLogo === "function") {
        const data = await api.adminUploadBrandingLogo(file);
        const logoUrl = data?.logoUrl || data?.url || data?.path || "";

        if (!logoUrl) {
          throw new Error("Server did not return a logo URL.");
        }

        setLogoDataUrl(logoUrl);
        setLogoMeta({
          name: file.name || "Uploaded logo",
          sizeMB,
          type: file.type || "image",
        });
        setMsg("Logo uploaded to server. Click Save All to publish it globally.");
        return;
      }

      const dataUrl = await readAsDataUrl(file);
      setLogoDataUrl(dataUrl);
      setLogoMeta({
        name: file.name || "",
        sizeMB,
        type: file.type || "",
      });
      setMsg("Logo selected locally. Add adminUploadBrandingLogo API to save globally.");
    } catch (e) {
      setErr(normalizeError(e));
    } finally {
      setSyncBusy(false);
    }
  }

  function resetLogo() {
    setLogoDataUrl("");
    setLogoMeta({ name: "", sizeMB: 0, type: "" });
    setMsg("Logo reset in editor. Click Save All to keep it.");
  }

  function resetAccent() {
    setAccent(DEFAULT_ACCENT);
    setMsg("Theme color reset in editor.");
  }

  function resetFont() {
    setFont(DEFAULT_FONT);
    setMsg("Font reset in editor.");
  }

  function resetLoginText() {
    setLoginOverlayTitle(DEFAULT_SETTINGS.loginOverlayTitle);
    setLoginOverlaySubtitle(DEFAULT_SETTINGS.loginOverlaySubtitle);
    setLoginOverlayOpacity(DEFAULT_SETTINGS.loginOverlayOpacity);
    setLoginMediaFit(DEFAULT_SETTINGS.loginMediaFit);
    setLoginVideoAutoplay(DEFAULT_SETTINGS.loginVideoAutoplay);
    setLoginVideoMuted(DEFAULT_SETTINGS.loginVideoMuted);
    setLoginVideoLoop(DEFAULT_SETTINGS.loginVideoLoop);
    setMsg("Login text and display options reset in editor.");
  }

  async function onPickLoginMedia(file) {
    setErr("");
    setMsg("");
    if (!file) return;

    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) {
      setErr("Please upload an image or video file.");
      return;
    }

    const maxMB = isVid ? 80 : 5;
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxMB) {
      setErr(`File too large (${sizeMB.toFixed(1)}MB). Max ${maxMB}MB.`);
      return;
    }

    try {
      setSyncBusy(true);

      if (typeof api?.adminUploadLoginMedia === "function") {
        const data = await api.adminUploadLoginMedia(file);
        const loginMediaUrl =
          data?.loginMediaUrl || data?.mediaUrl || data?.url || data?.path || "";
        const nextKind = data?.loginKind || (isVid ? "video_url" : "image_url");

        if (!loginMediaUrl) {
          throw new Error("Server did not return a login media URL.");
        }

        setLoginKind(nextKind);
        setLoginImage(loginMediaUrl);
        setLoginVideoMime(data?.loginMediaMime || file.type || "video/mp4");
        setLoginMediaMeta({
          name: file.name || "Uploaded media",
          sizeMB,
          type: file.type || "media",
        });

        clearVideoPreview();
        setMsg("Login media uploaded to server. Click Save All to publish it globally.");
        return;
      }

      if (isImg) {
        const dataUrl = await readAsDataUrl(file);
        setLoginKind("image_ls");
        setLoginImage(dataUrl);
        setLoginVideoMime("video/mp4");
        setLoginMediaMeta({
          name: file.name || "",
          sizeMB,
          type: file.type || "",
        });
        clearVideoPreview();
        setMsg("Login image selected locally. Add adminUploadLoginMedia API to save globally.");
        return;
      }

      await idbSetBlob(IDB_LOGIN_VIDEO_KEY, file);
      setLoginKind("video_idb");
      setLoginImage("");
      setLoginVideoMime(file.type || "video/mp4");
      setLoginMediaMeta({
        name: file.name || "",
        sizeMB,
        type: file.type || "",
      });

      setVideoPreviewFromBlob(file);
      setMsg("Login video selected locally. Add adminUploadLoginMedia API to save globally.");
    } catch (e) {
      setErr(normalizeError(e) || "Failed to upload media. Try a smaller MP4/WebM.");
    } finally {
      setSyncBusy(false);
    }
  }

  async function resetLoginMedia() {
    setErr("");
    setMsg("");

    setLoginKind("default");
    setLoginImage("");
    setLoginVideoMime("video/mp4");
    setLoginMediaMeta({ name: "", sizeMB: 0, type: "" });
    clearVideoPreview();

    setMsg("Login media reset in editor.");
  }

  async function resetAllSettings() {
    const ok = window.confirm(
      "Reset all branding and login settings to default?",
    );
    if (!ok) return;

    setErr("");
    setMsg("");

    setAccent(DEFAULT_SETTINGS.accent);
    setFont(DEFAULT_SETTINGS.font);
    setLogoDataUrl(DEFAULT_SETTINGS.logoDataUrl);
    setLoginKind(DEFAULT_SETTINGS.loginKind);
    setLoginImage(DEFAULT_SETTINGS.loginImage);
    setLoginVideoMime(DEFAULT_SETTINGS.loginVideoMime);
    setLoginOverlayTitle(DEFAULT_SETTINGS.loginOverlayTitle);
    setLoginOverlaySubtitle(DEFAULT_SETTINGS.loginOverlaySubtitle);
    setLoginOverlayOpacity(DEFAULT_SETTINGS.loginOverlayOpacity);
    setLoginMediaFit(DEFAULT_SETTINGS.loginMediaFit);
    setLoginVideoAutoplay(DEFAULT_SETTINGS.loginVideoAutoplay);
    setLoginVideoMuted(DEFAULT_SETTINGS.loginVideoMuted);
    setLoginVideoLoop(DEFAULT_SETTINGS.loginVideoLoop);
    setLogoMeta({ name: "", sizeMB: 0, type: "" });
    setLoginMediaMeta({ name: "", sizeMB: 0, type: "" });
    clearVideoPreview();

    setMsg("All branding and login settings reset in editor.");
  }

  async function saveAllSettings() {
    setErr("");
    setMsg("");

    const payload = sanitizeSettingsPayload(currentSettings);

    try {
      setSyncBusy(true);

      let saved = payload;
      if (typeof api?.adminSaveBrandingSettings === "function") {
        const data = await api.adminSaveBrandingSettings(payload);
        saved = sanitizeSettingsPayload(data?.settings || data || payload);
      } else if (typeof api?.adminSaveSettings === "function") {
        const data = await api.adminSaveSettings(payload);
        saved = sanitizeSettingsPayload(data?.settings || data || payload);
      } else if (typeof api?.saveSettings === "function") {
        const data = await api.saveSettings(payload);
        saved = sanitizeSettingsPayload(data?.settings || data || payload);
      }

      persistLocalSettings(saved);
      setSavedSettings(saved);
      setMsg(
        typeof api?.adminSaveBrandingSettings === "function"
          ? "All settings saved to server successfully."
          : "All settings saved locally successfully.",
      );
    } catch (e) {
      setErr(normalizeError(e));
    } finally {
      setSyncBusy(false);
    }
  }

  function revertUnsavedChanges() {
    setErr("");
    setMsg("");

    const s = sanitizeSettingsPayload(savedSettings);

    setAccent(s.accent);
    setFont(s.font);
    setLogoDataUrl(s.logoDataUrl);
    setLoginKind(s.loginKind);
    setLoginImage(s.loginImage);
    setLoginVideoMime(s.loginVideoMime);
    setLoginOverlayTitle(s.loginOverlayTitle);
    setLoginOverlaySubtitle(s.loginOverlaySubtitle);
    setLoginOverlayOpacity(s.loginOverlayOpacity);
    setLoginMediaFit(s.loginMediaFit);
    setLoginVideoAutoplay(s.loginVideoAutoplay);
    setLoginVideoMuted(s.loginVideoMuted);
    setLoginVideoLoop(s.loginVideoLoop);

    setLogoMeta(getDataUrlMeta(s.logoDataUrl, "Saved logo"));
    if ((s.loginKind === "image_ls" || s.loginKind === "image_url")) {
      setLoginMediaMeta(getDataUrlMeta(s.loginImage, "Saved image"));
    } else if ((s.loginKind === "video_idb" || s.loginKind === "video_url")) {
      setLoginMediaMeta({
        name: "Stored video",
        sizeMB: 0,
        type: s.loginVideoMime || "video/mp4",
      });
    } else {
      setLoginMediaMeta({ name: "", sizeMB: 0, type: "" });
    }

    setMsg("Unsaved changes reverted.");
  }

  async function syncSettingsToServer() {
    setErr("");
    setMsg("");

    if (!serverSyncEnabled) {
      setErr("No server settings API found in lib/api.js");
      return;
    }

    setSyncBusy(true);
    try {
      const payload = {
        ...sanitizeSettingsPayload(currentSettings),
      };

      let saved = payload;

      if (typeof api?.adminSaveBrandingSettings === "function") {
        const data = await api.adminSaveBrandingSettings(payload);
        saved = sanitizeSettingsPayload(data?.settings || data || payload);
      } else if (typeof api?.saveSettings === "function") {
        const data = await api.saveSettings(payload);
        saved = sanitizeSettingsPayload(data?.settings || data || payload);
      } else if (typeof api?.adminSaveSettings === "function") {
        const data = await api.adminSaveSettings(payload);
        saved = sanitizeSettingsPayload(data?.settings || data || payload);
      } else {
        throw new Error("Server save API missing.");
      }

      persistLocalSettings(saved);
      setSavedSettings(saved);
      setMsg("Settings saved locally and synced to server.");
    } catch (e) {
      setErr(normalizeError(e));
    } finally {
      setSyncBusy(false);
    }
  }

  async function loadSettingsFromServer() {
    setErr("");
    setMsg("");

    if (!serverSyncEnabled) {
      setErr("No server settings API found in lib/api.js");
      return;
    }

    setSyncBusy(true);
    try {
      let data = null;

      if (typeof api?.adminGetBrandingSettings === "function")
        data = await api.adminGetBrandingSettings();
      else if (typeof api?.getSettings === "function")
        data = await api.getSettings();
      else if (typeof api?.adminGetSettings === "function")
        data = await api.adminGetSettings();
      else throw new Error("Server load API missing.");

      const s = sanitizeSettingsPayload(data?.settings || data);
      if (!s || typeof s !== "object") {
        throw new Error("Server returned invalid settings payload.");
      }

      setAccent(s.accent);
      setFont(s.font);
      setLogoDataUrl(s.logoDataUrl);
      setLoginKind(s.loginKind);
      setLoginImage(s.loginImage);
      setLoginVideoMime(s.loginVideoMime);
      setLoginOverlayTitle(s.loginOverlayTitle);
      setLoginOverlaySubtitle(s.loginOverlaySubtitle);
      setLoginOverlayOpacity(s.loginOverlayOpacity);
      setLoginMediaFit(s.loginMediaFit);
      setLoginVideoAutoplay(s.loginVideoAutoplay);
      setLoginVideoMuted(s.loginVideoMuted);
      setLoginVideoLoop(s.loginVideoLoop);

      setSavedSettings(s);
      persistLocalSettings(s);

      setLogoMeta(getDataUrlMeta(s.logoDataUrl, "Server logo"));
      if ((s.loginKind === "image_ls" || s.loginKind === "image_url")) {
        setLoginMediaMeta(getDataUrlMeta(s.loginImage, "Server image"));
      } else if ((s.loginKind === "video_idb" || s.loginKind === "video_url")) {
        setLoginMediaMeta({
          name: "Server video",
          sizeMB: 0,
          type: s.loginVideoMime || "video/mp4",
        });
      } else {
        setLoginMediaMeta({ name: "", sizeMB: 0, type: "" });
      }

      setMsg("Settings loaded from server.");
    } catch (e) {
      setErr(normalizeError(e));
    } finally {
      setSyncBusy(false);
    }
  }

  function exportSettingsJson() {
    const data = {
      exportedAt: new Date().toISOString(),
      version: 3,
      note: "Video file blob in IndexedDB is not included in JSON export. Re-upload video after import if needed.",
      settings: sanitizeSettingsPayload(currentSettings),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin-settings-export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 1200);

    setMsg("Settings exported.");
  }

  async function importSettingsJson(file) {
    setErr("");
    setMsg("");
    if (!file) return;

    if (
      file.type !== "application/json" &&
      !String(file.name || "")
        .toLowerCase()
        .endsWith(".json")
    ) {
      setErr("Please select a valid JSON file.");
      return;
    }

    setImportBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const raw = parsed?.settings || parsed;
      const s = sanitizeSettingsPayload(raw);

      setAccent(s.accent);
      setFont(s.font);
      setLogoDataUrl(s.logoDataUrl);
      setLoginKind(s.loginKind);
      setLoginImage(s.loginImage);
      setLoginVideoMime(s.loginVideoMime);
      setLoginOverlayTitle(s.loginOverlayTitle);
      setLoginOverlaySubtitle(s.loginOverlaySubtitle);
      setLoginOverlayOpacity(s.loginOverlayOpacity);
      setLoginMediaFit(s.loginMediaFit);
      setLoginVideoAutoplay(s.loginVideoAutoplay);
      setLoginVideoMuted(s.loginVideoMuted);
      setLoginVideoLoop(s.loginVideoLoop);

      setLogoMeta(getDataUrlMeta(s.logoDataUrl, "Imported logo"));
      if ((s.loginKind === "image_ls" || s.loginKind === "image_url")) {
        setLoginMediaMeta(getDataUrlMeta(s.loginImage, "Imported image"));
      } else if ((s.loginKind !== "video_idb" && s.loginKind !== "video_url")) {
        setLoginMediaMeta({ name: "", sizeMB: 0, type: "" });
      }

      if ((s.loginKind !== "video_idb" && s.loginKind !== "video_url")) {
        clearVideoPreview();
      }

      setMsg(
        (s.loginKind === "video_idb" || s.loginKind === "video_url")
          ? "Settings imported into editor. Re-upload the video file if needed, then click Save All."
          : "Settings imported into editor. Click Save All to commit.",
      );
    } catch (e) {
      setErr(normalizeError(e));
    } finally {
      setImportBusy(false);
    }
  }

  function setVideoPreviewFromBlob(blob) {
    clearVideoPreview();
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setLoginVideoPreviewUrl(url);
  }

  function clearVideoPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setLoginVideoPreviewUrl("");
  }

  function applyThemePreset(color) {
    if (!isHex(color)) return;
    setAccent(color);
    setMsg("Theme preset applied in preview. Click Save All to keep it.");
  }

  function handleAccentInput(v) {
    setAccent(v);
    if (v && !isHex(v)) {
      setErr("Accent must be a valid hex color like #e11d2e");
    } else if (err && /Accent must be a valid hex color/i.test(err)) {
      setErr("");
    }
  }

  function getUnsavedBadge() {
    if (isDirty) return { text: "Unsaved changes", tone: "warn" };
    return { text: "All changes saved", tone: "ok" };
  }

  const saveBadge = getUnsavedBadge();

  return (
    <section className="raSettingsWrap" style={UI.card}>
      <StyleTag />

      <div className="raHero">
        <div className="raHeroGlow" />
        <div className="raHeroContent">
          <div className="raHeroLeft">
            <div className="raEyebrow">SETTINGS STUDIO</div>
            <h3 className="raHeroTitle">Admin Experience Control Center</h3>
            <div className="raHeroSub">
              Tune security, branding, login visuals, and advanced sync tools
              from one premium settings workspace.
            </div>

            <div className="raHeroPills">
              <StatusPill tone={saveBadge.tone}>{saveBadge.text}</StatusPill>
              <StatusPill tone="brand">Accent {accent}</StatusPill>
              <StatusPill tone="neutral">
                Storage {storageUsage.text}
              </StatusPill>
            </div>
          </div>

          <div className="raHeroRight">
            <div className="raQuickStatCard">
              <div className="raQuickStatLabel">Branding Score</div>
              <div className="raQuickStatValue">{brandingScore}%</div>
              <div className="raMiniProgress">
                <div
                  className="raMiniProgressFill"
                  style={{ width: `${brandingScore}%` }}
                />
              </div>
            </div>

            <div className="raQuickStatCard">
              <div className="raQuickStatLabel">Password Strength</div>
              <div className="raQuickStatValue">{passwordStrength.label}</div>
              <div className={`raToneDot ${passwordStrength.tone}`} />
            </div>
          </div>
        </div>
      </div>

      {(msg || err) && (
        <div className={`raFlash ${err ? "err" : "ok"}`}>{err || msg}</div>
      )}

      <div className="raStickyActions">
        <div className="raStickyActionsLeft">
          <div className="raStickyTitle">Theme Controller</div>
          <div className="raStickySub">
            Edit visually, then save all changes when ready.
          </div>
        </div>

        <div className="raStickyActionsRight">
          <button
            type="button"
            className="raBtn"
            onClick={revertUnsavedChanges}
            disabled={!isDirty}
            style={{ opacity: !isDirty ? 0.6 : 1 }}
          >
            Revert Changes
          </button>

          <button
            type="button"
            className="raBtnPrimary raBtnPrimarySolid"
            onClick={saveAllSettings}
            disabled={!isDirty}
            style={{ opacity: !isDirty ? 0.6 : 1 }}
          >
            Save All Changes
          </button>
        </div>
      </div>

      <div className="raTabs">
        {[
          { key: "SECURITY", label: "Security", icon: "🔐" },
          { key: "BRANDING", label: "Branding", icon: "🎨" },
          { key: "LOGIN", label: "Login Experience", icon: "🖥️" },
          { key: "ADVANCED", label: "Advanced", icon: "⚙️" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`raTab ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "SECURITY" ? (
        <div className="raSettingsGridSingle">
          <div className="raCardBox raFeatureBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Change Password</div>
                <div className="raBoxSub">
                  Update your admin password with enterprise-grade validation
                  and visual feedback.
                </div>
              </div>
              <div className="raCornerBadge">Security</div>
            </div>

            <div className="raSecurityLayout">
              <div className="raBoxForm">
                <PasswordField
                  label="Current Password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  show={showCurrentPassword}
                  onToggle={() => setShowCurrentPassword((v) => !v)}
                  placeholder="Current password"
                />

                <PasswordField
                  label="New Password"
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showNewPassword}
                  onToggle={() => setShowNewPassword((v) => !v)}
                  placeholder="New password"
                />

                <PasswordField
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  show={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((v) => !v)}
                  placeholder="Confirm new password"
                />

                <div className="raMetaStrip">
                  <b>Last changed:</b>{" "}
                  {lastPasswordChanged
                    ? new Date(lastPasswordChanged).toLocaleString()
                    : "Not recorded"}
                </div>
              </div>

              <div className="raSecurityPanel">
                <div className="raStrengthWrap">
                  <div className="raStrengthTop">
                    <span className="raLabel" style={{ marginBottom: 0 }}>
                      Password Strength
                    </span>
                    <b>{passwordStrength.label}</b>
                  </div>
                  <div className="raStrengthBar">
                    <div
                      className={`raStrengthFill ${passwordStrength.tone}`}
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>

                  <div className="raChecklist">
                    <ChecklistItem
                      ok={passwordChecks.length}
                      text="At least 8 characters"
                    />
                    <ChecklistItem
                      ok={passwordChecks.upper}
                      text="Uppercase letter"
                    />
                    <ChecklistItem
                      ok={passwordChecks.lower}
                      text="Lowercase letter"
                    />
                    <ChecklistItem ok={passwordChecks.number} text="Number" />
                    <ChecklistItem
                      ok={passwordChecks.special}
                      text="Special character"
                    />
                  </div>
                </div>

                <div className="raInfoCard">
                  <div className="raInfoCardTitle">Security Notes</div>
                  <ul className="raInfoList">
                    <li>Use a unique password for admin access.</li>
                    <li>Avoid reusing old credentials.</li>
                    <li>Prefer long passwords with mixed characters.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="raBoxFooter">
              <button
                type="button"
                className="raBtnPrimary"
                onClick={changePassword}
                disabled={!canChangePassword || busy}
                style={{ opacity: !canChangePassword || busy ? 0.6 : 1 }}
              >
                {busy ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "BRANDING" ? (
        <div className="raSettingsGrid">
          <div className="raCardBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Logo Studio</div>
                <div className="raBoxSub">
                  Upload a polished logo for admin navigation and visual brand
                  identity.
                </div>
              </div>
              <div className="raCornerBadge">Brand</div>
            </div>

            <div className="raLogoRow">
              <div className="raLogoPreview raLogoPreviewLarge">
                <img
                  src={logoDataUrl || assetUrl("logo.png")}
                  alt="Logo preview"
                  style={{ height: 64, width: "auto", display: "block" }}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_LOGO;
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="raLabel">Upload Logo</div>

                <DropZone
                  active={logoDragOver}
                  onDragOver={() => setLogoDragOver(true)}
                  onDragLeave={() => setLogoDragOver(false)}
                  onDrop={async (file) => {
                    setLogoDragOver(false);
                    await onPickLogo(file);
                  }}
                >
                  <input
                    className="raInput"
                    type="file"
                    accept="image/*"
                    onChange={(e) => onPickLogo(e.target.files?.[0])}
                  />
                  <div className="raHint">
                    Drag & drop or browse. PNG/SVG/WebP recommended. Max 2.5MB.
                  </div>
                </DropZone>

                {logoMeta?.name ? (
                  <div className="raFileMeta">
                    <b>{logoMeta.name}</b> · {logoMeta.type || "image"} ·{" "}
                    {logoMeta.sizeMB.toFixed(2)}MB
                  </div>
                ) : null}
              </div>
            </div>

            <div className="raBoxFooter">
              <button type="button" className="raBtn" onClick={resetLogo}>
                Reset Logo
              </button>
            </div>
          </div>

          <div className="raCardBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Theme Color Studio</div>
                <div className="raBoxSub">
                  Control highlight color, buttons, soft backgrounds, focus
                  states, borders, badges, and premium UI tone.
                </div>
              </div>
              <div className="raCornerBadge">Accent</div>
            </div>

            <div className="raAccentRow">
              <div className="raAccentSwatchWrap">
                <div
                  className="raAccentSwatch"
                  style={{
                    background: isHex(accent) ? accent : DEFAULT_ACCENT,
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 240 }}>
                <div className="raLabel">Accent Color</div>
                <input
                  className="raInput"
                  type="color"
                  value={isHex(accent) ? accent : DEFAULT_ACCENT}
                  onChange={(e) => handleAccentInput(e.target.value)}
                  style={{ height: 46, padding: 6 }}
                />
                <div className="raHint">
                  This now updates global theme tokens across the whole app.
                </div>
              </div>

              <div style={{ minWidth: 160 }}>
                <div className="raLabel">Hex</div>
                <input
                  className={`raInput ${accent && !isHex(accent) ? "raInputErr" : ""}`}
                  value={accent}
                  onChange={(e) => handleAccentInput(e.target.value)}
                  placeholder="#e11d2e"
                />
              </div>
            </div>

            <div className="raPresetGrid">
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="raPresetChip"
                  onClick={() => applyThemePreset(p.color)}
                >
                  <span
                    className="raPresetDot"
                    style={{ background: p.color }}
                  />
                  {p.name}
                </button>
              ))}
            </div>

            <div className="raThemePreviewCard">
              <div className="raThemePreviewTop">
                <div className="raThemePreviewBadge">Visual Preview</div>
                <button type="button" className="raPreviewBtn">
                  Sample Action
                </button>
              </div>

              <div className="raPreviewMetricRow">
                <div className="raPreviewMetricCard">
                  <span>Primary</span>
                  <b>{accent}</b>
                </div>
                <div className="raPreviewMetricCard">
                  <span>Surface</span>
                  <b>Theme Linked</b>
                </div>
                <div className="raPreviewMetricCard">
                  <span>Feel</span>
                  <b>WordPress Style Control</b>
                </div>
              </div>

              <div className="raThemePreviewText">
                Cards, buttons, chips, tabs, focus rings, hover surfaces, and
                soft panels will inherit the selected brand color across the
                app.
              </div>
            </div>

            <div className="raBoxFooter">
              <button type="button" className="raBtn" onClick={resetAccent}>
                Reset Color
              </button>
            </div>
          </div>

          <div className="raCardBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Typography Studio</div>
                <div className="raBoxSub">
                  Apply a stronger visual personality to the admin dashboard.
                </div>
              </div>
              <div className="raCornerBadge">Font</div>
            </div>

            <div className="raBoxForm">
              <Field label="Choose Font">
                <select
                  className="raInput"
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                >
                  {FONT_PRESETS.map((f) => (
                    <option key={f.label} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Custom font-family (optional)">
                <input
                  className="raInput"
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                  placeholder='e.g. "Inter", system-ui, sans-serif'
                />
              </Field>

              <div
                className="raFontPreview"
                style={{ fontFamily: font || DEFAULT_FONT }}
              >
                <div className="raFontPreviewTitle">Typography Preview</div>
                <div className="raFontPreviewHero">Rebel Angels Admin</div>
                <div className="raFontPreviewText">
                  The quick brown fox jumps over the lazy dog. 1234567890.
                </div>
              </div>
            </div>

            <div className="raBoxFooter">
              <button type="button" className="raBtn" onClick={resetFont}>
                Reset Font
              </button>
            </div>
          </div>

          <div className="raCardBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Brand Snapshot</div>
                <div className="raBoxSub">
                  Quick overview of the current branding state and readiness.
                </div>
              </div>
              <div className="raCornerBadge">Overview</div>
            </div>

            <div className="raSummaryGrid">
              <SummaryItem label="Accent" value={accent || DEFAULT_ACCENT} />
              <SummaryItem
                label="Font"
                value={truncateMiddle(font || DEFAULT_FONT, 34)}
              />
              <SummaryItem
                label="Logo"
                value={logoDataUrl ? "Custom logo loaded" : "Default logo"}
              />
              <SummaryItem label="Storage Used" value={storageUsage.text} />
              <SummaryItem
                label="Login Media"
                value={
                  loginKind === "default"
                    ? "Default asset"
                    : (loginKind === "image_ls" || loginKind === "image_url")
                      ? "Custom image"
                      : "Custom video"
                }
              />
              <SummaryItem label="Branding Score" value={`${brandingScore}%`} />
            </div>

            <div className="raBoxFooter">
              <button
                type="button"
                className="raBtn"
                onClick={resetAllSettings}
              >
                Reset All Branding
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "LOGIN" ? (
        <div className="raSettingsGrid">
          <div className="raCardBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Login Page Media</div>
                <div className="raBoxSub">
                  Replace the right-side login panel with image or video for a
                  premium first impression.
                </div>
              </div>
              <div className="raCornerBadge">Media</div>
            </div>

            <div className="raBoxForm">
              <Field label="Media Type">
                <select
                  className="raInput"
                  value={loginKind}
                  onChange={(e) => setLoginKind(e.target.value)}
                >
                  <option value="default">Default Media</option>
                  <option value="image_url">Image</option>
                  <option value="video_url">Video</option>
                </select>
              </Field>

              <div className="raLogoRow">
                <div className="raLogoPreview raLoginMediaPreview wow">
                  {(loginKind === "video_idb" || loginKind === "video_url") ? (
                    <video
                      key={loginVideoPreviewUrl || "no-video"}
                      src={loginKind === "video_url" ? loginImage : loginVideoPreviewUrl || ""}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: loginMediaFit,
                        display: "block",
                      }}
                      muted={loginVideoMuted}
                      autoPlay={loginVideoAutoplay}
                      loop={loginVideoLoop}
                      playsInline
                      controls
                    />
                  ) : (loginKind === "image_ls" || loginKind === "image_url") && loginImage ? (
                    <img
                      src={loginImage}
                      alt="Login media preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: loginMediaFit,
                        display: "block",
                      }}
                    />
                  ) : (
                    <img
                      src={assetUrl("loginside.jpg")}
                      alt="Default login media"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: loginMediaFit,
                        display: "block",
                      }}
                    />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 260 }}>
                  <div className="raLabel">Upload Image / Video</div>

                  <DropZone
                    active={mediaDragOver}
                    onDragOver={() => setMediaDragOver(true)}
                    onDragLeave={() => setMediaDragOver(false)}
                    onDrop={async (file) => {
                      setMediaDragOver(false);
                      await onPickLoginMedia(file);
                    }}
                  >
                    <input
                      className="raInput"
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => onPickLoginMedia(e.target.files?.[0])}
                    />
                    <div className="raHint">
                      Stored on server Render Disk when branding API is enabled.
                      PNG/WebP/MP4/WebM recommended.
                    </div>
                  </DropZone>

                  {loginMediaMeta?.name ? (
                    <div className="raFileMeta">
                      <b>{loginMediaMeta.name}</b> ·{" "}
                      {loginMediaMeta.type || "media"} ·{" "}
                      {loginMediaMeta.sizeMB.toFixed(2)}MB
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="raBoxFooter" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="raBtn"
                  onClick={resetLoginMedia}
                >
                  Reset Login Media
                </button>
              </div>
            </div>
          </div>

          <div className="raCardBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Overlay Content</div>
                <div className="raBoxSub">
                  Adjust title, subtitle, media behavior, and visual mood.
                </div>
              </div>
              <div className="raCornerBadge">Overlay</div>
            </div>

            <div className="raBoxForm">
              <Field label="Overlay Title">
                <input
                  className="raInput"
                  value={loginOverlayTitle}
                  onChange={(e) => setLoginOverlayTitle(e.target.value)}
                  placeholder="Welcome Back"
                />
              </Field>

              <Field label="Overlay Subtitle">
                <input
                  className="raInput"
                  value={loginOverlaySubtitle}
                  onChange={(e) => setLoginOverlaySubtitle(e.target.value)}
                  placeholder="Sign in to continue..."
                />
              </Field>

              <Field
                label={`Overlay Opacity (${loginOverlayOpacity.toFixed(2)})`}
              >
                <input
                  className="raInput"
                  type="range"
                  min="0"
                  max="0.85"
                  step="0.05"
                  value={loginOverlayOpacity}
                  onChange={(e) =>
                    setLoginOverlayOpacity(
                      clamp(Number(e.target.value), 0, 0.85),
                    )
                  }
                />
              </Field>

              <Field label="Media Fit">
                <select
                  className="raInput"
                  value={loginMediaFit}
                  onChange={(e) => setLoginMediaFit(e.target.value)}
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                </select>
              </Field>

              <div className="raSwitchGrid">
                <SwitchRow
                  label="Video autoplay"
                  checked={loginVideoAutoplay}
                  onChange={setLoginVideoAutoplay}
                />
                <SwitchRow
                  label="Video muted"
                  checked={loginVideoMuted}
                  onChange={setLoginVideoMuted}
                />
                <SwitchRow
                  label="Video loop"
                  checked={loginVideoLoop}
                  onChange={setLoginVideoLoop}
                />
              </div>
            </div>

            <div className="raBoxFooter">
              <button type="button" className="raBtn" onClick={resetLoginText}>
                Reset Display Options
              </button>
            </div>
          </div>

          <div className="raCardBox raSpan2">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Cinematic Login Preview</div>
                <div className="raBoxSub">
                  Live visual approximation of the login experience with overlay
                  content and theme integration.
                </div>
              </div>
              <div className="raCornerBadge">Preview</div>
            </div>

            <div className="raLoginMock">
              <div className="raLoginMockLeft">
                <div className="raLoginMockBrand">
                  <img
                    src={logoDataUrl || assetUrl("logo.png")}
                    alt="Brand"
                    style={{ height: 34, width: "auto" }}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = FALLBACK_LOGO;
                    }}
                  />
                </div>

                <div className="raLoginMockForm">
                  <div className="raLoginMockTitle">Admin Sign In</div>
                  <div className="raLoginMockInput" />
                  <div className="raLoginMockInput" />
                  <div className="raLoginMockButton" />
                </div>
              </div>

              <div className="raLoginMockRight">
                {((loginKind === "video_idb" && loginVideoPreviewUrl) || (loginKind === "video_url" && loginImage)) ? (
                  <video
                    src={loginKind === "video_url" ? loginImage : loginVideoPreviewUrl}
                    muted={loginVideoMuted}
                    autoPlay={loginVideoAutoplay}
                    loop={loginVideoLoop}
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: loginMediaFit,
                      position: "absolute",
                      inset: 0,
                    }}
                  />
                ) : (loginKind === "image_ls" || loginKind === "image_url") && loginImage ? (
                  <img
                    src={loginImage}
                    alt="Login media"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: loginMediaFit,
                      position: "absolute",
                      inset: 0,
                    }}
                  />
                ) : (
                  <img
                    src={assetUrl("loginside.jpg")}
                    alt="Default media"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: loginMediaFit,
                      position: "absolute",
                      inset: 0,
                    }}
                  />
                )}

                <div
                  className="raLoginMockOverlay"
                  style={{
                    background: `linear-gradient(180deg, rgba(15,23,42,${Math.max(
                      0.1,
                      loginOverlayOpacity * 0.65,
                    )}), rgba(15,23,42,${loginOverlayOpacity}))`,
                  }}
                />
                <div className="raLoginMockContent">
                  <div className="raLoginMockHeroTitle">
                    {loginOverlayTitle || "Welcome Back"}
                  </div>
                  <div className="raLoginMockHeroSub">
                    {loginOverlaySubtitle ||
                      "Sign in to continue to the admin dashboard."}
                  </div>

                  <div className="raMockBadgeRow">
                    <span className="raMockBadge">Accent Ready</span>
                    <span className="raMockBadge">
                      {loginKind === "video_idb"
                        ? "Video Login"
                        : (loginKind === "image_ls" || loginKind === "image_url")
                          ? "Image Login"
                          : "Default Login"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "ADVANCED" ? (
        <div className="raSettingsGrid">
          <div className="raCardBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Import / Export</div>
                <div className="raBoxSub">
                  Backup or restore settings using a structured JSON file.
                </div>
              </div>
              <div className="raCornerBadge">Backup</div>
            </div>

            <div className="raBoxForm">
              <div className="raBoxFooter raBoxFooterLeft">
                <button
                  type="button"
                  className="raBtn"
                  onClick={exportSettingsJson}
                >
                  Export Settings JSON
                </button>

                <label className="raBtn raBtnFile">
                  {importBusy ? "Importing..." : "Import Settings JSON"}
                  <input
                    type="file"
                    accept="application/json,.json"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      importSettingsJson(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="raInfoCard">
                <div className="raInfoCardTitle">What gets exported?</div>
                <div className="raInfoText">
                  Accent, font, logo, login media preferences, overlay text,
                  visual options, and playback behavior. IndexedDB video blobs
                  are not embedded in JSON export.
                </div>
              </div>
            </div>
          </div>

          <div className="raCardBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Storage Overview</div>
                <div className="raBoxSub">
                  Approximate browser-side storage used by local settings.
                </div>
              </div>
              <div className="raCornerBadge">Usage</div>
            </div>

            <div className="raSummaryGrid">
              <SummaryItem label="Estimated Usage" value={storageUsage.text} />
              <SummaryItem
                label="Login Media"
                value={
                  (loginKind === "video_idb" || loginKind === "video_url")
                    ? (loginKind === "video_url" ? "Server Video" : "IndexedDB Video")
                    : (loginKind === "image_ls" || loginKind === "image_url")
                      ? (loginKind === "image_url" ? "Server Image" : "localStorage Image")
                      : "Default Asset"
                }
              />
              <SummaryItem
                label="Server Sync"
                value={serverSyncEnabled ? "Available" : "Not Configured"}
              />
              <SummaryItem
                label="Dirty State"
                value={isDirty ? "Unsaved" : "Clean"}
              />
            </div>

            <div className="raUsageMeter">
              <div className="raUsageMeterTop">
                <span>Browser settings usage</span>
                <b>{storageUsage.usagePct.toFixed(0)}%</b>
              </div>
              <div className="raUsageBar">
                <div
                  className="raUsageFill"
                  style={{ width: `${storageUsage.usagePct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="raCardBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Server Sync</div>
                <div className="raBoxSub">
                  Sync local admin settings to the backend when API endpoints
                  exist.
                </div>
              </div>
              <div className="raCornerBadge">Sync</div>
            </div>

            <div className="raBoxFooter raBoxFooterLeft">
              <button
                type="button"
                className="raBtn"
                disabled={!serverSyncEnabled || syncBusy}
                onClick={loadSettingsFromServer}
              >
                {syncBusy ? "Working..." : "Load from Server"}
              </button>
              <button
                type="button"
                className="raBtnPrimary"
                disabled={!serverSyncEnabled || syncBusy}
                onClick={syncSettingsToServer}
              >
                {syncBusy ? "Working..." : "Sync to Server"}
              </button>
            </div>

            {!serverSyncEnabled ? (
              <div className="raHint" style={{ marginTop: 10 }}>
                Add one of these APIs in <b>src/lib/api.js</b>:
                <br />
                <code>api.saveSettings(payload)</code>,
                <code> api.adminSaveSettings(payload)</code>,
                <code> api.getSettings()</code>,
                <code> api.adminGetSettings()</code>
              </div>
            ) : null}
          </div>

          <div className="raCardBox">
            <div className="raBoxHeader">
              <div>
                <div className="raBoxTitle">Global Reset</div>
                <div className="raBoxSub">
                  Reset branding, login media, and visual settings back to
                  defaults.
                </div>
              </div>
              <div className="raCornerBadge">Reset</div>
            </div>

            <div className="raDangerPanel">
              <div className="raDangerTitle">High-impact action</div>
              <div className="raDangerText">
                This clears the custom visual identity and returns the admin
                experience to its default theme.
              </div>
            </div>

            <div className="raBoxFooter raBoxFooterLeft">
              <button
                type="button"
                className="raBtn raBtnDangerSoft"
                onClick={resetAllSettings}
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ---------------- Small Components ---------------- */

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="raLabel">{label}</div>
      {children}
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="raSummaryItem">
      <div className="raSummaryLabel">{label}</div>
      <div className="raSummaryValue">{value}</div>
    </div>
  );
}

function ChecklistItem({ ok, text }) {
  return (
    <div className={`raCheckItem ${ok ? "ok" : ""}`}>
      <span>{ok ? "✓" : "•"}</span>
      <span>{text}</span>
    </div>
  );
}

function SwitchRow({ label, checked, onChange }) {
  return (
    <label className="raSwitchRow">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="raLabel">{label}</div>
      <div className="raPasswordWrap">
        <input
          className="raInput"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button type="button" className="raPassBtn" onClick={onToggle}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function DropZone({ active, onDragOver, onDragLeave, onDrop, children }) {
  return (
    <div
      className={`raDropZone ${active ? "active" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        onDragLeave?.();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        onDrop?.(file);
      }}
    >
      {children}
    </div>
  );
}

function StatusPill({ tone = "neutral", children }) {
  return <div className={`raStatusPill ${tone}`}>{children}</div>;
}

/* ---------------- Helpers ---------------- */

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function normalizeError(err) {
  const text =
    typeof err === "string"
      ? err
      : err?.response?.data?.message || err?.message || "Something went wrong";

  if (/bad auth|authentication failed/i.test(text)) {
    return "Authentication failed. Please verify your current password.";
  }
  if (/unauthorized|forbidden/i.test(text)) {
    return "You are not authorized to perform this action.";
  }
  return String(text || "Something went wrong");
}

function isHex(v) {
  return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(String(v || "").trim());
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function truncateMiddle(text, max = 32) {
  const s = String(text || "");
  if (s.length <= max) return s;
  const left = Math.ceil((max - 3) / 2);
  const right = Math.floor((max - 3) / 2);
  return `${s.slice(0, left)}...${s.slice(-right)}`;
}

function readLs(key, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function readLsNumber(key, fallback = 0) {
  try {
    const v = localStorage.getItem(key);
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function readLsBool(key, fallback = false) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "true";
  } catch {
    return fallback;
  }
}

function writeLs(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function removeLs(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function sanitizeSettingsPayload(input) {
  const s = input && typeof input === "object" ? input : {};
  const logo = firstString(s.logoDataUrl, s.logoUrl, s.logoPath);
  const loginMedia = firstString(
    s.loginImage,
    s.loginMediaUrl,
    s.mediaUrl,
    s.loginMediaPath,
  );

  return {
    accent: isHex(s.accent) ? s.accent : DEFAULT_SETTINGS.accent,
    font: String(s.font || DEFAULT_SETTINGS.font),
    logoDataUrl: logo,
    loginKind: ["default", "image_ls", "video_idb", "image_url", "video_url"].includes(
      String(s.loginKind || ""),
    )
      ? String(s.loginKind)
      : DEFAULT_SETTINGS.loginKind,
    loginImage: loginMedia,
    loginVideoMime:
      firstString(s.loginVideoMime, s.loginMediaMime) ||
      DEFAULT_SETTINGS.loginVideoMime,
    loginOverlayTitle:
      typeof s.loginOverlayTitle === "string"
        ? s.loginOverlayTitle
        : DEFAULT_SETTINGS.loginOverlayTitle,
    loginOverlaySubtitle:
      typeof s.loginOverlaySubtitle === "string"
        ? s.loginOverlaySubtitle
        : DEFAULT_SETTINGS.loginOverlaySubtitle,
    loginOverlayOpacity: clamp(
      Number.isFinite(Number(s.loginOverlayOpacity))
        ? Number(s.loginOverlayOpacity)
        : DEFAULT_SETTINGS.loginOverlayOpacity,
      0,
      0.85,
    ),
    loginMediaFit: ["cover", "contain"].includes(String(s.loginMediaFit || ""))
      ? String(s.loginMediaFit)
      : DEFAULT_SETTINGS.loginMediaFit,
    loginVideoAutoplay:
      typeof s.loginVideoAutoplay === "boolean"
        ? s.loginVideoAutoplay
        : DEFAULT_SETTINGS.loginVideoAutoplay,
    loginVideoMuted:
      typeof s.loginVideoMuted === "boolean"
        ? s.loginVideoMuted
        : DEFAULT_SETTINGS.loginVideoMuted,
    loginVideoLoop:
      typeof s.loginVideoLoop === "boolean"
        ? s.loginVideoLoop
        : DEFAULT_SETTINGS.loginVideoLoop,
  };
}

function areSettingsEqual(a, b) {
  const aa = sanitizeSettingsPayload(a);
  const bb = sanitizeSettingsPayload(b);
  return JSON.stringify(aa) === JSON.stringify(bb);
}

function getDataUrlMeta(dataUrl, fallbackName = "Stored file") {
  if (!dataUrl || typeof dataUrl !== "string") {
    return { name: "", sizeMB: 0, type: "" };
  }

  if (!dataUrl.startsWith("data:")) {
    return { name: fallbackName, sizeMB: 0, type: getFileTypeFromUrl(dataUrl) };
  }

  try {
    const header = dataUrl.slice(0, dataUrl.indexOf(","));
    const mimeMatch = header.match(/^data:([^;]+);/i);
    const mime = mimeMatch?.[1] || "";
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const sizeBytes = estimateBase64Bytes(base64);
    return {
      name: fallbackName,
      sizeMB: sizeBytes / (1024 * 1024),
      type: mime,
    };
  } catch {
    return { name: fallbackName, sizeMB: 0, type: "" };
  }
}

function getFileTypeFromUrl(url) {
  const clean = String(url || "").split("?")[0].toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/.test(clean)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return "video";
  return "server file";
}

function estimateBase64Bytes(base64) {
  const cleaned = String(base64 || "").replace(/\s/g, "");
  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  return Math.max(0, (cleaned.length * 3) / 4 - padding);
}

function persistLocalSettings(settings) {
  const s = sanitizeSettingsPayload(settings);

  writeLs(LS_ACCENT, s.accent);
  writeLs(LS_FONT, s.font);

  if (s.logoDataUrl) writeLs(LS_LOGO, s.logoDataUrl);
  else removeLs(LS_LOGO);

  writeLs(LS_LOGIN_KIND, s.loginKind || "default");

  if (s.loginImage) writeLs(LS_LOGIN_IMAGE, s.loginImage);
  else removeLs(LS_LOGIN_IMAGE);

  if (s.loginVideoMime) writeLs(LS_LOGIN_VIDEO_MIME, s.loginVideoMime);
  else removeLs(LS_LOGIN_VIDEO_MIME);

  writeLs(LS_LOGIN_OVERLAY_TITLE, s.loginOverlayTitle || "");
  writeLs(LS_LOGIN_OVERLAY_SUBTITLE, s.loginOverlaySubtitle || "");
  writeLs(LS_LOGIN_OVERLAY_OPACITY, String(s.loginOverlayOpacity));
  writeLs(LS_LOGIN_MEDIA_FIT, s.loginMediaFit || "cover");
  writeLs(LS_LOGIN_VIDEO_AUTOPLAY, String(!!s.loginVideoAutoplay));
  writeLs(LS_LOGIN_VIDEO_MUTED, String(!!s.loginVideoMuted));
  writeLs(LS_LOGIN_VIDEO_LOOP, String(!!s.loginVideoLoop));
}

function applyRootVars(settings) {
  const s = sanitizeSettingsPayload(settings);
  const accent = isHex(s.accent) ? s.accent : DEFAULT_ACCENT;
  const root = document.documentElement;

  const palette = buildThemePalette(accent);

  root.style.setProperty("--ra-accent", palette.accent);
  root.style.setProperty("--ra-accent-rgb", palette.accentRgb);
  root.style.setProperty("--ra-accent-strong", palette.accentStrong);
  root.style.setProperty("--ra-accent-soft", palette.accentSoft);
  root.style.setProperty("--ra-accent-softest", palette.accentSoftest);
  root.style.setProperty("--ra-accent-border", palette.accentBorder);
  root.style.setProperty("--ra-accent-ring", palette.accentRing);
  root.style.setProperty("--ra-accent-contrast", palette.accentContrast);
  root.style.setProperty("--ra-accent-hover", palette.accentHover);
  root.style.setProperty("--ra-accent-active", palette.accentActive);

  root.style.setProperty("--ra-surface-tint", palette.surfaceTint);
  root.style.setProperty("--ra-panel-bg", palette.panelBg);
  root.style.setProperty("--ra-chip-bg", palette.chipBg);
  root.style.setProperty("--ra-chip-border", palette.chipBorder);
  root.style.setProperty("--ra-selection-bg", palette.selectionBg);

  root.style.setProperty("--ra-font", s.font || DEFAULT_FONT);
}

function buildThemePalette(hex) {
  const safe = normalizeHex(hex);
  const rgb = hexToRgb(safe);

  return {
    accent: safe,
    accentRgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    accentStrong: rgbToHex(mixRgb(rgb, { r: 0, g: 0, b: 0 }, 0.12)),
    accentSoft: rgba(rgb, 0.12),
    accentSoftest: rgba(rgb, 0.06),
    accentBorder: rgba(rgb, 0.26),
    accentRing: rgba(rgb, 0.18),
    accentContrast: getContrastText(rgb),
    accentHover: rgbToHex(mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.08)),
    accentActive: rgbToHex(mixRgb(rgb, { r: 0, g: 0, b: 0 }, 0.08)),
    surfaceTint: `linear-gradient(135deg, ${rgba(rgb, 0.08)}, rgba(255,255,255,0.96))`,
    panelBg: rgba(rgb, 0.045),
    chipBg: rgba(rgb, 0.1),
    chipBorder: rgba(rgb, 0.2),
    selectionBg: rgba(rgb, 0.16),
  };
}

function normalizeHex(hex) {
  const raw = String(hex || "").trim();
  if (!isHex(raw)) return DEFAULT_ACCENT;
  if (raw.length === 4) {
    return (
      "#" +
      raw
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    ).toLowerCase();
  }
  return raw.toLowerCase();
}

function hexToRgb(hex) {
  const v = normalizeHex(hex).replace("#", "");
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixRgb(a, b, amount = 0.5) {
  const t = clamp(amount, 0, 1);
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function rgba(rgb, alpha) {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1)})`;
}

function getContrastText(rgb) {
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.55 ? "#0f172a" : "#ffffff";
}

/* ---------------- IndexedDB helpers ---------------- */

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

async function idbSetBlob(key, blob) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
  });
}

async function idbGetBlob(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("IndexedDB read failed"));
  });
}

async function idbDel(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB delete failed"));
  });
}

/* ---------------- Styles ---------------- */

function StyleTag() {
  return (
    <style>{`
      .raSettingsWrap{
        position:relative;
        overflow:hidden;
        font-family:var(--ra-font, ${DEFAULT_FONT});
      }

      .raHero{
        position:relative;
        border-radius:28px;
        overflow:hidden;
        padding:20px;
        background:
          radial-gradient(850px 320px at 10% 0%, var(--ra-accent-soft), transparent 58%),
          radial-gradient(850px 380px at 100% 20%, rgba(59,130,246,0.08), transparent 60%),
          linear-gradient(135deg, rgba(255,255,255,0.92), rgba(248,250,252,0.96));
        border:1px solid rgba(17,24,39,0.08);
        box-shadow:0 18px 60px rgba(2,8,23,0.08);
      }

      .raHeroGlow{
        position:absolute;
        inset:-25% auto auto -10%;
        width:320px;
        height:320px;
        border-radius:999px;
        background:var(--ra-accent-soft);
        filter:blur(70px);
        opacity:.7;
        pointer-events:none;
      }

      .raHeroContent{
        position:relative;
        display:grid;
        grid-template-columns:1.5fr .9fr;
        gap:16px;
        align-items:center;
      }

      @media (max-width: 980px){
        .raHeroContent{ grid-template-columns:1fr; }
      }

      .raStickyActions{
        margin-top:14px;
        padding:14px 16px;
        border-radius:20px;
        border:1px solid var(--ra-accent-border);
        background:var(--ra-surface-tint);
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:14px;
        flex-wrap:wrap;
        box-shadow:0 14px 34px rgba(2,8,23,0.06);
      }

      .raStickyActionsLeft{ min-width:0; }
      .raStickyTitle{
        font-size:14px;
        font-weight:1000;
        color:#0b1220;
      }
      .raStickySub{
        margin-top:4px;
        font-size:12px;
        line-height:1.5;
        color:#475569;
        font-weight:800;
      }
      .raStickyActionsRight{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }

      .raHeroLeft{ min-width:0; }
      .raEyebrow{
        display:inline-flex;
        align-items:center;
        min-height:28px;
        padding:0 12px;
        border-radius:999px;
        background:var(--ra-chip-bg);
        border:1px solid var(--ra-chip-border);
        color:var(--ra-accent);
        font-size:11px;
        font-weight:1000;
        letter-spacing:.1em;
      }

      .raHeroTitle{
        margin:12px 0 0;
        font-size:28px;
        line-height:1.05;
        font-weight:1000;
        color:#0b1220;
      }

      .raHeroSub{
        margin-top:10px;
        font-size:13px;
        line-height:1.6;
        max-width:760px;
        color:#475569;
        font-weight:700;
      }

      .raHeroPills{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:16px;
      }

      .raStatusPill{
        padding:9px 12px;
        border-radius:999px;
        font-size:12px;
        font-weight:950;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.88);
        color:#0f172a;
      }
      .raStatusPill.ok{
        color:rgba(22,101,52,1);
        border-color:rgba(34,197,94,0.20);
        background:rgba(236,253,245,0.95);
      }
      .raStatusPill.warn{
        color:rgba(146,64,14,1);
        border-color:rgba(245,158,11,0.20);
        background:rgba(255,251,235,0.95);
      }
      .raStatusPill.brand{
        color:var(--ra-accent);
        border-color:var(--ra-chip-border);
        background:var(--ra-chip-bg);
      }
      .raStatusPill.neutral{
        color:#0f172a;
      }

      .raHeroRight{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
      }

      @media (max-width: 640px){
        .raHeroRight{ grid-template-columns:1fr; }
      }

      .raQuickStatCard{
        padding:16px;
        border-radius:22px;
        background:rgba(255,255,255,0.82);
        border:1px solid rgba(17,24,39,0.08);
        box-shadow:0 12px 30px rgba(2,8,23,0.06);
      }

      .raQuickStatLabel{
        font-size:12px;
        opacity:.72;
        font-weight:900;
        color:#64748b;
      }

      .raQuickStatValue{
        margin-top:8px;
        font-size:24px;
        font-weight:1000;
        color:#0b1220;
      }

      .raMiniProgress{
        margin-top:12px;
        height:8px;
        border-radius:999px;
        background:rgba(15,23,42,0.08);
        overflow:hidden;
      }

      .raMiniProgressFill{
        height:100%;
        border-radius:999px;
        background:linear-gradient(90deg, var(--ra-accent-hover), var(--ra-accent));
      }

      .raToneDot{
        margin-top:12px;
        width:14px;
        height:14px;
        border-radius:999px;
        background:#cbd5e1;
        box-shadow:0 0 0 6px rgba(15,23,42,0.04);
      }
      .raToneDot.weak{ background:#ef4444; }
      .raToneDot.fair{ background:#f59e0b; }
      .raToneDot.good{ background:#22c55e; }
      .raToneDot.strong{ background:#16a34a; }

      .raFlash{
        margin-top:14px;
        padding:12px 14px;
        border-radius:16px;
        font-weight:900;
        font-size:13px;
        border:1px solid rgba(17,24,39,0.10);
      }
      .raFlash.ok{
        color:rgba(22,101,52,0.96);
        border-color:rgba(34,197,94,0.20);
        background:rgba(236,253,245,0.92);
      }
      .raFlash.err{
        color:var(--ra-accent, #e11d2e);
        border-color:var(--ra-accent-border);
        background:rgba(255,241,242,0.94);
      }

      .raTabs{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:16px;
        margin-bottom:14px;
      }

      .raTab{
        min-height:42px;
        padding:0 14px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.92);
        font-weight:950;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        gap:8px;
        color:#0f172a;
        transition:.18s ease;
      }
      .raTab:hover{
        border-color:var(--ra-accent-border);
        background:var(--ra-accent-softest);
      }
      .raTab.active{
        color:var(--ra-accent);
        border-color:var(--ra-accent-border);
        background:var(--ra-chip-bg);
        box-shadow:0 10px 24px var(--ra-accent-soft);
      }

      .raSettingsGrid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
        margin-top:14px;
      }

      .raSettingsGridSingle{
        display:grid;
        grid-template-columns:1fr;
        gap:14px;
        margin-top:14px;
      }

      .raSpan2{
        grid-column:1 / -1;
      }

      @media (max-width: 980px){
        .raSettingsGrid{ grid-template-columns:1fr; }
        .raSpan2{ grid-column:auto; }
      }

      .raCardBox{
        border-radius:24px;
        border:1px solid rgba(17,24,39,0.10);
        background:linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.82));
        box-shadow:0 18px 50px rgba(2,8,23,0.08);
        backdrop-filter:blur(10px);
        padding:18px;
      }

      .raFeatureBox{
        background:
          radial-gradient(580px 200px at 100% 0%, var(--ra-accent-soft), transparent 55%),
          rgba(255,255,255,0.86);
      }

      .raBoxHeader{
        display:flex;
        justify-content:space-between;
        gap:14px;
        align-items:flex-start;
        flex-wrap:wrap;
      }

      .raCornerBadge{
        min-height:28px;
        padding:0 12px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.88);
        font-size:12px;
        font-weight:950;
        color:#475569;
        display:inline-flex;
        align-items:center;
      }

      .raBoxTitle{
        font-weight:1000;
        font-size:17px;
        color:#0b1220;
      }

      .raBoxSub{
        margin-top:6px;
        font-size:12px;
        opacity:0.74;
        line-height:1.55;
        color:#475569;
      }

      .raBoxForm{
        display:grid;
        gap:12px;
        margin-top:14px;
      }

      .raBoxFooter{
        display:flex;
        justify-content:flex-end;
        gap:10px;
        margin-top:16px;
        flex-wrap:wrap;
      }

      .raBoxFooterLeft{
        justify-content:flex-start;
      }

      .raLabel{
        font-size:12px;
        opacity:0.76;
        margin-bottom:6px;
        font-weight:850;
        color:#475569;
      }

      .raHint{
        margin-top:6px;
        font-size:12px;
        opacity:0.72;
        font-weight:700;
        line-height:1.45;
      }

      .raInput{
        width:100%;
        box-sizing:border-box;
        min-height:46px;
        padding:12px 14px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.92);
        outline:none;
        font-weight:800;
        font-size:14px;
        font-family:var(--ra-font, ${DEFAULT_FONT});
        color:#0f172a;
        transition:.18s ease;
      }

      .raInput:hover{
        border-color:var(--ra-accent-border);
      }

      .raInput:focus{
        border-color:var(--ra-accent-border);
        box-shadow:0 0 0 6px var(--ra-accent-ring);
      }

      .raInputErr{
        border-color:rgba(225,29,46,0.35) !important;
      }

      .raBtnPrimary{
        padding:12px 16px;
        border-radius:14px;
        border:1px solid var(--ra-accent-border);
        background:var(--ra-chip-bg);
        color:var(--ra-accent);
        font-weight:950;
        cursor:pointer;
        transition:.18s ease;
      }
      .raBtnPrimary:hover{
        transform:translateY(-1px);
        box-shadow:0 12px 24px var(--ra-accent-soft);
      }

      .raBtnPrimarySolid{
        background:var(--ra-accent);
        color:var(--ra-accent-contrast);
        border-color:var(--ra-accent);
      }
      .raBtnPrimarySolid:hover{
        background:var(--ra-accent-hover);
      }

      .raBtn{
        min-height:40px;
        padding:8px 14px;
        border-radius:12px;
        border:1px solid rgba(17,24,39,0.14);
        background:rgba(255,255,255,0.92);
        font-weight:950;
        cursor:pointer;
        color:#0f172a;
        transition:.18s ease;
      }
      .raBtn:hover{
        border-color:var(--ra-accent-border);
        background:var(--ra-accent-softest);
      }

      .raBtnFile{
        display:inline-flex;
        align-items:center;
      }

      .raBtnDangerSoft{
        border-color:rgba(225,29,46,0.20);
        background:rgba(255,241,242,0.92);
        color:var(--ra-accent);
      }

      .raLogoRow{
        display:flex;
        gap:12px;
        align-items:center;
        margin-top:12px;
        flex-wrap:wrap;
      }

      .raLogoPreview{
        width:92px;
        height:92px;
        border-radius:20px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.90);
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
        box-shadow:0 10px 24px rgba(2,8,23,0.06);
      }

      .raLogoPreviewLarge{
        width:104px;
        height:104px;
      }

      .raLoginMediaPreview{
        width:220px;
        height:130px;
      }

      .raLoginMediaPreview.wow{
        background:
          radial-gradient(220px 100px at 0% 0%, rgba(255,255,255,0.18), transparent 60%),
          rgba(15,23,42,0.95);
      }

      .raAccentRow{
        display:flex;
        gap:12px;
        align-items:flex-end;
        margin-top:12px;
        flex-wrap:wrap;
      }

      .raAccentSwatchWrap{
        width:64px;
        height:64px;
        border-radius:20px;
        background:rgba(255,255,255,0.90);
        border:1px solid rgba(17,24,39,0.10);
        display:grid;
        place-items:center;
        box-shadow:0 12px 28px rgba(2,8,23,0.08);
      }

      .raAccentSwatch{
        width:42px;
        height:42px;
        border-radius:16px;
        border:2px solid rgba(255,255,255,0.75);
        box-shadow:0 12px 20px rgba(2,8,23,0.12);
      }

      .raPasswordWrap{
        display:grid;
        grid-template-columns:1fr auto;
        gap:10px;
        align-items:center;
      }

      .raPassBtn{
        height:46px;
        padding:0 14px;
        border-radius:12px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.92);
        font-weight:900;
        cursor:pointer;
      }
      .raPassBtn:hover{
        border-color:var(--ra-accent-border);
        background:var(--ra-accent-softest);
      }

      .raSecurityLayout{
        display:grid;
        grid-template-columns:1.2fr .9fr;
        gap:14px;
        margin-top:12px;
      }

      @media(max-width:980px){
        .raSecurityLayout{ grid-template-columns:1fr; }
      }

      .raSecurityPanel{
        display:grid;
        gap:12px;
      }

      .raStrengthWrap{
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.74);
        box-shadow:inset 0 1px 0 rgba(255,255,255,0.7);
      }

      .raStrengthTop{
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:center;
        margin-bottom:10px;
      }

      .raStrengthBar{
        height:10px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(17,24,39,0.08);
      }

      .raStrengthFill{
        height:100%;
        border-radius:999px;
        background:linear-gradient(90deg, #ef4444, #f59e0b, #22c55e);
      }
      .raStrengthFill.weak{ background:linear-gradient(90deg, #ef4444, #f87171); }
      .raStrengthFill.fair{ background:linear-gradient(90deg, #f59e0b, #fbbf24); }
      .raStrengthFill.good{ background:linear-gradient(90deg, #22c55e, #4ade80); }
      .raStrengthFill.strong{ background:linear-gradient(90deg, #16a34a, #22c55e); }

      .raChecklist{
        margin-top:12px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
      }

      @media(max-width:760px){
        .raChecklist{ grid-template-columns:1fr; }
      }

      .raCheckItem{
        display:flex;
        gap:8px;
        align-items:center;
        font-size:12px;
        font-weight:800;
        opacity:.72;
        color:#475569;
      }

      .raCheckItem.ok{
        color:rgba(22,101,52,1);
        opacity:1;
      }

      .raMetaStrip{
        padding:10px 12px;
        border-radius:14px;
        border:1px dashed rgba(17,24,39,0.16);
        background:rgba(255,255,255,0.78);
        font-size:12px;
        font-weight:800;
      }

      .raInfoCard{
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.08);
        background:linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.85));
      }

      .raInfoCardTitle{
        font-size:13px;
        font-weight:950;
        color:#0b1220;
      }

      .raInfoText{
        margin-top:8px;
        font-size:13px;
        line-height:1.55;
        color:#475569;
        font-weight:700;
      }

      .raInfoList{
        margin:10px 0 0;
        padding-left:18px;
        color:#475569;
        font-size:13px;
        line-height:1.65;
        font-weight:700;
      }

      .raPresetGrid{
        margin-top:12px;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .raPresetChip{
        padding:8px 12px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:white;
        font-weight:900;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        gap:8px;
        color:#0f172a;
        transition:.18s ease;
      }
      .raPresetChip:hover{
        border-color:var(--ra-accent-border);
        background:var(--ra-accent-softest);
      }

      .raPresetDot{
        width:12px;
        height:12px;
        border-radius:999px;
        display:inline-block;
      }

      .raThemePreviewCard{
        margin-top:14px;
        border-radius:20px;
        border:1px solid rgba(17,24,39,0.08);
        background:
          radial-gradient(260px 120px at 0% 0%, var(--ra-accent-soft), transparent 60%),
          linear-gradient(135deg, rgba(255,241,242,0.25), rgba(255,255,255,0.92));
        padding:16px;
      }

      .raThemePreviewTop{
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:center;
        flex-wrap:wrap;
      }

      .raThemePreviewBadge{
        padding:8px 12px;
        border-radius:999px;
        font-size:12px;
        font-weight:950;
        color:var(--ra-accent);
        background:var(--ra-chip-bg);
        border:1px solid var(--ra-chip-border);
      }

      .raPreviewBtn{
        padding:10px 14px;
        border-radius:12px;
        font-weight:950;
        border:1px solid var(--ra-accent-border);
        background:var(--ra-accent);
        color:var(--ra-accent-contrast);
        box-shadow:0 12px 24px var(--ra-accent-soft);
      }

      .raPreviewMetricRow{
        margin-top:12px;
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:10px;
      }

      @media(max-width:760px){
        .raPreviewMetricRow{ grid-template-columns:1fr; }
      }

      .raPreviewMetricCard{
        padding:12px;
        border-radius:16px;
        background:rgba(255,255,255,0.80);
        border:1px solid rgba(17,24,39,0.08);
      }

      .raPreviewMetricCard span{
        display:block;
        font-size:11px;
        opacity:.68;
        font-weight:900;
        color:#64748b;
      }

      .raPreviewMetricCard b{
        display:block;
        margin-top:4px;
        font-size:14px;
        font-weight:1000;
        color:#0b1220;
      }

      .raThemePreviewText{
        margin-top:12px;
        font-size:13px;
        opacity:.82;
        font-weight:800;
        line-height:1.55;
        color:#475569;
      }

      .raFontPreview{
        border-radius:20px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.80);
        padding:16px;
      }

      .raFontPreviewTitle{
        font-size:14px;
        font-weight:950;
        color:#0b1220;
      }

      .raFontPreviewHero{
        margin-top:10px;
        font-size:28px;
        line-height:1.05;
        font-weight:1000;
        color:#0b1220;
      }

      .raFontPreviewText{
        margin-top:8px;
        font-size:14px;
        opacity:.82;
        line-height:1.55;
        color:#475569;
      }

      .raSummaryGrid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-top:12px;
      }

      @media(max-width:760px){
        .raSummaryGrid{ grid-template-columns:1fr; }
      }

      .raSummaryItem{
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.78);
        padding:12px;
      }

      .raSummaryLabel{
        font-size:11px;
        opacity:.68;
        font-weight:900;
        color:#64748b;
      }

      .raSummaryValue{
        margin-top:4px;
        font-size:13px;
        font-weight:950;
        color:#0b1220;
        word-break:break-word;
      }

      .raDropZone{
        padding:10px;
        border-radius:16px;
        border:1px dashed rgba(17,24,39,0.16);
        background:rgba(255,255,255,0.58);
        transition:.18s ease;
      }

      .raDropZone.active{
        border-color:var(--ra-accent-border);
        background:var(--ra-accent-softest);
        box-shadow:0 0 0 4px var(--ra-accent-ring);
      }

      .raFileMeta{
        margin-top:8px;
        font-size:12px;
        font-weight:850;
        opacity:.82;
        word-break:break-word;
        color:#475569;
      }

      .raSwitchGrid{
        display:grid;
        grid-template-columns:1fr 1fr 1fr;
        gap:10px;
      }

      @media(max-width:980px){
        .raSwitchGrid{ grid-template-columns:1fr; }
      }

      .raSwitchRow{
        min-height:46px;
        padding:10px 12px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.78);
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        font-size:13px;
        font-weight:900;
        color:#0f172a;
      }

      .raLoginMock{
        margin-top:14px;
        min-height:380px;
        border-radius:26px;
        overflow:hidden;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.92);
        display:grid;
        grid-template-columns:1fr 1.05fr;
        box-shadow:0 18px 44px rgba(2,8,23,0.10);
      }

      @media(max-width:980px){
        .raLoginMock{ grid-template-columns:1fr; min-height:auto; }
      }

      .raLoginMockLeft{
        padding:26px;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        background:linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98));
      }

      .raLoginMockBrand{
        display:flex;
        align-items:center;
      }

      .raLoginMockForm{
        max-width:340px;
      }

      .raLoginMockTitle{
        font-size:24px;
        font-weight:1000;
        color:#0b1220;
      }

      .raLoginMockInput{
        margin-top:12px;
        height:46px;
        border-radius:14px;
        background:rgba(15,23,42,0.06);
        border:1px solid rgba(15,23,42,0.08);
      }

      .raLoginMockButton{
        margin-top:14px;
        height:46px;
        border-radius:14px;
        background:var(--ra-accent);
        box-shadow:0 12px 28px var(--ra-accent-soft);
      }

      .raLoginMockRight{
        position:relative;
        min-height:380px;
        overflow:hidden;
        background:#0f172a;
      }

      .raLoginMockOverlay{
        position:absolute;
        inset:0;
      }

      .raLoginMockContent{
        position:absolute;
        inset:auto 24px 24px 24px;
        color:white;
        z-index:2;
      }

      .raLoginMockHeroTitle{
        font-size:34px;
        font-weight:1000;
        line-height:1.02;
        text-shadow:0 8px 24px rgba(0,0,0,0.28);
      }

      .raLoginMockHeroSub{
        margin-top:10px;
        font-size:14px;
        font-weight:800;
        max-width:440px;
        opacity:.96;
        line-height:1.5;
      }

      .raMockBadgeRow{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:14px;
      }

      .raMockBadge{
        display:inline-flex;
        align-items:center;
        min-height:30px;
        padding:0 12px;
        border-radius:999px;
        background:rgba(255,255,255,0.14);
        border:1px solid rgba(255,255,255,0.18);
        font-size:12px;
        font-weight:950;
      }

      .raDangerPanel{
        margin-top:14px;
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(225,29,46,0.16);
        background:rgba(255,241,242,0.72);
      }

      .raDangerTitle{
        font-size:13px;
        font-weight:950;
        color:#991b1b;
      }

      .raDangerText{
        margin-top:6px;
        font-size:13px;
        line-height:1.55;
        color:#7f1d1d;
        font-weight:700;
      }

      .raUsageMeter{
        margin-top:14px;
        padding:14px;
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.78);
      }

      .raUsageMeterTop{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        font-size:13px;
        font-weight:900;
        color:#0f172a;
      }

      .raUsageBar{
        margin-top:10px;
        height:10px;
        border-radius:999px;
        background:rgba(15,23,42,0.08);
        overflow:hidden;
      }

      .raUsageFill{
        height:100%;
        border-radius:999px;
        background:linear-gradient(90deg, var(--ra-accent-hover), var(--ra-accent));
      }

      code{
        background:rgba(15,23,42,0.06);
        padding:2px 6px;
        border-radius:8px;
        font-size:12px;
      }
    `}</style>
  );
}
