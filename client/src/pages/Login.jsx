import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { setAuth, clearSelectedAcademy } from "../lib/auth.js";
import { refreshSocketAuth } from "../lib/socket.js";
import "./Login.css";

const LS_LOGO = "ra_admin_logo";
const LS_LOGIN_KIND = "ra_login_media_kind";
const LS_LOGIN_IMAGE = "ra_login_media_image";
const LS_LOGIN_VIDEO_MIME = "ra_login_media_video_mime";

const IDB_NAME = "ra_media_db";
const IDB_STORE = "blobs";
const IDB_LOGIN_VIDEO_KEY = "login_media_video";

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

const FALLBACK_SIDE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#g)"/>
      <circle cx="930" cy="180" r="140" fill="rgba(225,29,46,0.18)"/>
      <circle cx="220" cy="720" r="180" fill="rgba(255,255,255,0.06)"/>
      <text x="80" y="160" fill="#ffffff" font-family="Arial, sans-serif" font-size="46" font-weight="700">
        Rebel Angels
      </text>
      <text x="80" y="220" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="28">
        Elite Scoring Platform
      </text>
      <rect x="80" y="300" width="220" height="70" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>
      <rect x="330" y="300" width="220" height="70" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>
      <rect x="580" y="300" width="220" height="70" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>
      <rect x="80" y="400" width="220" height="70" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>
      <text x="112" y="344" fill="#fff" font-family="Arial, sans-serif" font-size="24">Multi Academy</text>
      <text x="375" y="344" fill="#fff" font-family="Arial, sans-serif" font-size="24">Live Judging</text>
      <text x="624" y="344" fill="#fff" font-family="Arial, sans-serif" font-size="24">Leaderboards</text>
      <text x="122" y="444" fill="#fff" font-family="Arial, sans-serif" font-size="24">Certificates</text>
    </svg>
  `);

function assetUrl(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${clean}`;
}

export default function Login({ onLoggedIn }) {
  const navigate = useNavigate();

  const [rolePick, setRolePick] = useState("ADMIN");

  // ✅ Demo login details removed
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [academyCode, setAcademyCode] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [needAcademyCode, setNeedAcademyCode] = useState(false);
  const [academyOptions, setAcademyOptions] = useState([]);

  const particles = useMemo(() => makeParticles(16), []);

  const [kind, setKind] = useState("default");
  const [img, setImg] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoMime, setVideoMime] = useState("video/mp4");

  useEffect(() => {
    let alive = true;
    let urlToRevoke = "";

    async function loadMedia() {
      try {
        const k = localStorage.getItem(LS_LOGIN_KIND) || "default";
        const m = localStorage.getItem(LS_LOGIN_VIDEO_MIME) || "video/mp4";
        const image = localStorage.getItem(LS_LOGIN_IMAGE) || "";

        if (!alive) return;

        setKind(k);
        setVideoMime(m);
        setImg(image);

        if (k === "video_idb") {
          const blob = await idbGetBlob(IDB_LOGIN_VIDEO_KEY);
          if (!alive) return;

          if (blob) {
            const url = URL.createObjectURL(blob);
            urlToRevoke = url;
            setVideoUrl(url);
          } else {
            setVideoUrl("");
            setKind("default");
          }
        } else {
          setVideoUrl("");
        }
      } catch {
        // ignore media load failures
      }
    }

    loadMedia();

    return () => {
      alive = false;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, []);

  function roleHomePath(role) {
    const r = String(role || "").toUpperCase();
    if (r === "SUPER_ADMIN") return "/super-admin";
    if (r === "ADMIN") return "/admin";
    if (r === "JUDGE") return "/judge";
    if (r === "PARTICIPANT") return "/participant";
    if (r === "PARENT") return "/parent/dashboard";
    return "/login";
  }

  async function submit(e) {
    e.preventDefault();
    if (loading) return;

    setErr("");
    setLoading(true);

    try {
      setNeedAcademyCode(false);
      setAcademyOptions([]);

      const cleanEmail = String(email || "")
        .trim()
        .toLowerCase();
      const cleanPassword = String(password || "");
      const cleanAcademyCode = String(academyCode || "")
        .trim()
        .toUpperCase();

      if (!cleanEmail) {
        throw new Error("Email is required");
      }

      if (!cleanPassword) {
        throw new Error("Password is required");
      }

      const body = await api.login(cleanEmail, cleanPassword, cleanAcademyCode);

      const token =
        body?.token || body?.accessToken || body?.data?.token || null;

      const user = body?.user || body?.data?.user || null;

      const mustChangePassword =
        !!body?.mustChangePassword || !!user?.mustChangePassword;

      if (!token || !user) {
        throw new Error("Invalid login response");
      }

      setAuth({
        accessToken: token,
        user: {
          ...user,
          mustChangePassword,
        },
      });

      clearSelectedAcademy();
      refreshSocketAuth();

      onLoggedIn?.({
        ...user,
        mustChangePassword,
      });

      if (mustChangePassword) {
        navigate("/force-change-password", { replace: true });
        return;
      }

      navigate(roleHomePath(user?.role), { replace: true });
    } catch (e2) {
      const status = e2?.status || e2?.response?.status;
      const data = e2?.response?.data || e2?.data || null;
      const msg = data?.message || e2?.message || "Login failed";

      if (status === 409 && data?.requireAcademyCode) {
        setNeedAcademyCode(true);
        setAcademyOptions(Array.isArray(data?.academies) ? data.academies : []);
        setErr(msg);
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleRoleChange(nextRole) {
    setRolePick(nextRole);
    setErr("");
    setNeedAcademyCode(false);
    setAcademyOptions([]);
    setAcademyCode("");

    // ✅ Do not auto-fill demo credentials
    setEmail("");
    setPassword("");
  }

  function applyAcademyOption(opt) {
    const code = String(opt?.academyCode || "")
      .trim()
      .toUpperCase();
    if (!code) return;

    setAcademyCode(code);
    setErr("");
  }

  const logoSrc =
    (typeof localStorage !== "undefined" && localStorage.getItem(LS_LOGO)) ||
    assetUrl("logo.png");

  const rightMedia = (
    <>
      {kind === "video_idb" && videoUrl ? (
        <video
          key={`${videoUrl}-${videoMime}`}
          src={videoUrl}
          className="ra-image"
          muted
          autoPlay
          loop
          playsInline
        />
      ) : kind === "image_ls" && img ? (
        <img
          src={img}
          alt="Login media"
          className="ra-image"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = FALLBACK_SIDE_IMAGE;
          }}
        />
      ) : (
        <img
          src={assetUrl("loginside.jpg")}
          alt="Gymnastics"
          className="ra-image"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = FALLBACK_SIDE_IMAGE;
          }}
        />
      )}

      <div className="ra-right-overlay" />
      <div className="ra-right-badge">Elite Scoring Platform</div>

      <div className="ra-right-content">
        <div className="ra-kicker">REBEL ANGELS</div>
        <h2 className="ra-right-title">Gymnastics All In One Platform</h2>
        <p className="ra-right-text">
          Commercial competition dashboard for academies, judges, participants,
          parents, events, live scoring, alerts, awards, and leaderboard
          control.
        </p>

        <div className="ra-feature-grid">
          <div className="ra-feature-pill">Multi Academy</div>
          <div className="ra-feature-pill">Live judging</div>
          <div className="ra-feature-pill">Leaderboards</div>
          <div className="ra-feature-pill">Certificates</div>
        </div>
      </div>
    </>
  );

  return (
    <div className="ra-page">
      <div className="ra-bg-glow ra-bg-glow-a" aria-hidden="true" />
      <div className="ra-bg-glow ra-bg-glow-b" aria-hidden="true" />

      <div className="ra-particles" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="ra-particle"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              opacity: p.opacity,
            }}
          />
        ))}
      </div>

      <div className="ra-shell">
        <div className="ra-left">
          <div className="ra-card ra-border-anim ra-glow-pulse">
            <div className="ra-brand-row">
              <div className="ra-logo-wrap">
                <img
                  src={logoSrc}
                  alt="Rebel Angels"
                  className="ra-logo"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_LOGO;
                  }}
                />
              </div>

              <div className="ra-brand-copy">
                <div className="ra-kicker ra-kicker-left">
                  Administration Portal
                </div>
                <h1 className="ra-title">Rebel Angels Scoring System</h1>
                <p className="ra-subtitle">
                  Secure access for Super Admin, Admin, Judge, Participant, and
                  Parent accounts
                </p>
              </div>
            </div>

            <div
              className="ra-role-chips"
              role="tablist"
              aria-label="Quick role pick"
            >
              <button
                type="button"
                className={`ra-role-chip ${
                  rolePick === "SUPER_ADMIN" ? "is-active" : ""
                }`}
                onClick={() => handleRoleChange("SUPER_ADMIN")}
              >
                Super Admin
              </button>

              <button
                type="button"
                className={`ra-role-chip ${
                  rolePick === "ADMIN" ? "is-active" : ""
                }`}
                onClick={() => handleRoleChange("ADMIN")}
              >
                Admin
              </button>

              <button
                type="button"
                className={`ra-role-chip ${
                  rolePick === "JUDGE" ? "is-active" : ""
                }`}
                onClick={() => handleRoleChange("JUDGE")}
              >
                Judge
              </button>

              <button
                type="button"
                className={`ra-role-chip ${
                  rolePick === "PARTICIPANT" ? "is-active" : ""
                }`}
                onClick={() => handleRoleChange("PARTICIPANT")}
              >
                Participant
              </button>

              <button
                type="button"
                className={`ra-role-chip ${
                  rolePick === "PARENT" ? "is-active" : ""
                }`}
                onClick={() => handleRoleChange("PARENT")}
              >
                Parent
              </button>
            </div>

            <form onSubmit={submit} className="ra-form">
              <div className="ra-field-grid">
                <div className="ra-field">
                  <label className="ra-label">Sign in as</label>
                  <select
                    className="ra-control"
                    value={rolePick}
                    onChange={(e) => handleRoleChange(e.target.value)}
                  >
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="JUDGE">Judge</option>
                    <option value="PARTICIPANT">Participant</option>
                    <option value="PARENT">Parent</option>
                  </select>
                </div>

                <div className="ra-field">
                  <label className="ra-label">Email</label>
                  <input
                    className="ra-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="ra-field-grid">
                <div className="ra-field">
                  <label className="ra-label">Password</label>
                  <div className="ra-password-wrap">
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="ra-control ra-password-field"
                      autoComplete="current-password"
                    />

                    <button
                      type="button"
                      className="ra-eye-btn"
                      onClick={() => setShowPass((s) => !s)}
                      aria-label={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <div className="ra-field">
                  <label className="ra-label">
                    Academy Code {needAcademyCode ? "(Required)" : "(Optional)"}
                  </label>
                  <input
                    className="ra-control"
                    value={academyCode}
                    onChange={(e) =>
                      setAcademyCode(String(e.target.value || "").toUpperCase())
                    }
                    placeholder="e.g. RAGA"
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div className="ra-row-between">
                <span />

                <button
                  type="button"
                  className="ra-forgot-btn"
                  onClick={() => navigate("/forgot-password")}
                >
                  Forgot Password?
                </button>
              </div>

              {needAcademyCode && academyOptions.length > 0 ? (
                <div
                  style={{
                    marginTop: 10,
                    marginBottom: 8,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(225,29,46,0.16)",
                    background: "rgba(225,29,46,0.05)",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    Select Academy Code
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    {academyOptions.map((a) => (
                      <button
                        key={`${a.academyId}-${a.academyCode}`}
                        type="button"
                        onClick={() => applyAcademyOption(a)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(17,24,39,0.08)",
                          background: "white",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span>
                          <strong>{a.academyName || "Academy"}</strong>
                        </span>
                        <span style={{ opacity: 0.75, fontWeight: 700 }}>
                          {a.academyCode || ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {err ? <div className="ra-error">{err}</div> : null}

              <button type="submit" className="ra-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="ra-spinner" /> Signing in...
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <span className="ra-submit-arrow">→</span>
                  </>
                )}
              </button>

              <a href="/academy/register" className="ra-register-btn">
                Register Academy
              </a>

              <div className="ra-register-note">
                New academy onboarding requires super admin approval before app
                activation.
              </div>
            </form>
          </div>
        </div>

        <div className="ra-right">
          <div className="ra-image-frame">{rightMedia}</div>
        </div>
      </div>
    </div>
  );
}

/* IndexedDB read */
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

async function idbGetBlob(key) {
  const db = await idbOpen();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("IndexedDB read failed"));
  });
}

/* Icons */
function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />
      <path
        d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6 0 9.5 7 9.5 7a17.6 17.6 0 0 1-3.2 4.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 6.2A17 17 0 0 0 2.5 12s3.5 7 9.5 7c1.2 0 2.3-.2 3.3-.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9A3 3 0 0 0 14.1 14.1"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function makeParticles(n = 12) {
  const arr = [];

  for (let i = 0; i < n; i++) {
    arr.push({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 6 + Math.random() * 18,
      dur: 10 + Math.random() * 14,
      delay: -(Math.random() * 10),
      opacity: 0.12 + Math.random() * 0.18,
    });
  }

  return arr;
}
