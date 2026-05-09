import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import ForceChangePassword from "./pages/Auth/ForceChangePassword.jsx";

import LeaderboardPublic from "./pages/Public/LeaderboardPublic.jsx";
import LeaderboardTV from "./pages/Public/LeaderboardTV.jsx";
import AcademyRegister from "./pages/Public/AcademyRegister.jsx";
import AcademyActivate from "./pages/Public/AcademyActivate.jsx";

import SuperAdminDashboard from "./pages/SuperAdmin/SuperAdminDashboard.jsx";
import AdminDashboard from "./pages/Admin/AdminDashboard.jsx";

import ParentDashboard from "./pages/Parent/ParentDashboard.jsx";
import JudgeDashboard from "./pages/Judge/Dashboard.jsx";
import ParticipantDashboard from "./pages/Participant/Dashboard.jsx";
import NotificationsPage from "./pages/Common/NotificationsPage.jsx";

import EmailSettings from "./pages/SuperAdmin/EmailSettings.jsx";
import EmailLogs from "./pages/SuperAdmin/EmailLogs.jsx";
import EmailTemplates from "./pages/SuperAdmin/EmailTemplates.jsx";

import BulkEmail from "./pages/Admin/BulkEmail.jsx";

import OnboardingShell from "./onboarding/OnboardingShell.jsx";
import { NotificationsProvider } from "./pages/Components/notifications/NotificationsProvider.jsx";

import { api, AUTH_EVENT } from "./lib/api.js";
import { getToken, getUser, setAuth, clearAuth } from "./lib/auth.js";
import {
  disconnectSocket,
  getSocket,
  refreshSocketAuth,
  autoJoinSocketRooms,
} from "./lib/socket.js";

const APP_AUTH_CHANGED_EVENT = "ra:app:auth-changed";

function ProtectedArea({ token, user, userId, role, children }) {
  return (
    <NotificationsProvider>
      <OnboardingShell role={token && user ? role : null} userId={userId}>
        {children}
      </OnboardingShell>
    </NotificationsProvider>
  );
}

function AppShell({
  children,
  isOnline,
  isStandalone,
  installReady,
  onInstall,
}) {
  return (
    <>
      {!isOnline ? (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10000,
            background: "#991b1b",
            color: "#fff",
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          You are offline. Some cached pages may still work.
        </div>
      ) : null}

      {isStandalone ? (
        <div
          style={{
            position: "sticky",
            top: !isOnline ? 40 : 0,
            zIndex: 9999,
            background: "#111827",
            color: "#fff",
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            textAlign: "center",
            letterSpacing: ".2px",
          }}
        >
          App mode active
        </div>
      ) : null}

      {!isStandalone && installReady ? (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 88,
            zIndex: 10001,
          }}
        >
          <button
            type="button"
            onClick={onInstall}
            style={{
              border: 0,
              borderRadius: 999,
              padding: "12px 16px",
              background: "#e11d2e",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 14px 32px rgba(225,29,46,.28)",
            }}
          >
            Install App
          </button>
        </div>
      ) : null}

      {children}
    </>
  );
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);

  const [authState, setAuthState] = useState(() => ({
    token: getToken(),
    user: getUser(),
  }));

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator?.standalone === true
    );
  });

  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [installReady, setInstallReady] = useState(false);

  const syncAuthState = useCallback(() => {
    setAuthState({
      token: getToken(),
      user: getUser(),
    });
  }, []);

  const emitAuthChanged = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent(APP_AUTH_CHANGED_EVENT));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let alive = true;

    async function restoreSession() {
      try {
        const res = await api.refreshAuth();

        if (!alive) return;

        if (res?.accessToken && res?.user) {
          setAuth({
            accessToken: res.accessToken,
            user: res.user,
          });

          setAuthState({
            token: res.accessToken,
            user: res.user,
          });

          refreshSocketAuth();
        } else {
          syncAuthState();
        }
      } catch {
        syncAuthState();
      } finally {
        if (alive) setAuthReady(true);
      }
    }

    restoreSession();

    return () => {
      alive = false;
    };
  }, [syncAuthState]);

  const onLogout = useCallback(async () => {
    try {
      await api.logout?.();
    } catch {
      // ignore
    }

    disconnectSocket();
    clearAuth();

    setAuthState({
      token: null,
      user: null,
    });

    emitAuthChanged();
  }, [emitAuthChanged]);

  useEffect(() => {
    function onAuthRequired() {
      onLogout();
    }

    function onFocus() {
      syncAuthState();
    }

    function onStorage() {
      syncAuthState();
    }

    function onAppAuthChanged() {
      syncAuthState();
    }

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    function handleDisplayModeChange() {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.navigator?.standalone === true;
      setIsStandalone(!!standalone);
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setInstallPromptEvent(e);
      setInstallReady(true);
    }

    function handleAppInstalled() {
      setInstallPromptEvent(null);
      setInstallReady(false);
      setIsStandalone(true);
    }

    window.addEventListener(AUTH_EVENT, onAuthRequired);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener(APP_AUTH_CHANGED_EVENT, onAppAuthChanged);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const media = window.matchMedia?.("(display-mode: standalone)");
    media?.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener(AUTH_EVENT, onAuthRequired);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(APP_AUTH_CHANGED_EVENT, onAppAuthChanged);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      media?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, [syncAuthState, onLogout]);

  const onLoggedIn = useCallback(
    (u) => {
      const nextState = {
        token: getToken(),
        user: getUser() || u,
      };

      setAuthState(nextState);
      refreshSocketAuth();
      emitAuthChanged();
    },
    [emitAuthChanged],
  );

  useEffect(() => {
    if (!authReady) return;

    if (!authState.token || !authState.user) {
      disconnectSocket();
      return;
    }

    const socket = getSocket();

    if (socket.connected) {
      autoJoinSocketRooms();
    } else {
      socket.connect();
    }
  }, [authReady, authState.token, authState.user]);

  const triggerInstall = useCallback(async () => {
    try {
      if (!installPromptEvent) return;
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
    } catch (err) {
      console.error("PWA install prompt failed:", err);
    } finally {
      setInstallPromptEvent(null);
      setInstallReady(false);
    }
  }, [installPromptEvent]);

  const token = authState.token;
  const user = authState.user;
  const role = String(user?.role || "").toUpperCase() || null;
  const userId = user?._id || user?.id || user?.email || "guest";
  const mustChangePassword = !!user?.mustChangePassword;

  const homePath = useMemo(() => roleHomePath(user?.role), [user]);

  if (!authReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "radial-gradient(circle at top left, rgba(225,29,46,.16), transparent 34%), linear-gradient(135deg, #020617, #111827)",
          color: "#fff",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "min(420px, 92vw)",
            padding: 28,
            borderRadius: 28,
            background: "rgba(255,255,255,.08)",
            border: "1px solid rgba(255,255,255,.14)",
            boxShadow: "0 28px 80px rgba(0,0,0,.35)",
            textAlign: "center",
            backdropFilter: "blur(18px)",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              margin: "0 auto 18px",
              borderRadius: "50%",
              border: "5px solid rgba(255,255,255,.18)",
              borderTopColor: "#e11d2e",
              animation: "raSpin .85s linear infinite",
            }}
          />

          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
            Rebel Angels
          </div>

          <div style={{ fontSize: 14, opacity: 0.75, fontWeight: 600 }}>
            Restoring secure session...
          </div>

          <style>
            {`
            @keyframes raSpin {
              to { transform: rotate(360deg); }
            }
          `}
          </style>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppShell
        isOnline={isOnline}
        isStandalone={isStandalone}
        installReady={installReady}
        onInstall={triggerInstall}
      >
        <Routes>
          <Route
            path="/login"
            element={
              token && user ? (
                mustChangePassword ? (
                  <Navigate to="/force-change-password" replace />
                ) : (
                  <Navigate to={homePath} replace />
                )
              ) : (
                <Login onLoggedIn={onLoggedIn} />
              )
            }
          />

          <Route
            path="/forgot-password"
            element={
              token && user ? (
                mustChangePassword ? (
                  <Navigate to="/force-change-password" replace />
                ) : (
                  <Navigate to={homePath} replace />
                )
              ) : (
                <ForgotPassword />
              )
            }
          />

          <Route
            path="/reset-password"
            element={
              token && user ? (
                mustChangePassword ? (
                  <Navigate to="/force-change-password" replace />
                ) : (
                  <Navigate to={homePath} replace />
                )
              ) : (
                <ResetPassword />
              )
            }
          />

          <Route
            path="/force-change-password"
            element={
              token && user ? (
                mustChangePassword ? (
                  <ForceChangePassword />
                ) : (
                  <Navigate to={homePath} replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route path="/academy/register" element={<AcademyRegister />} />
          <Route path="/academy/activate" element={<AcademyActivate />} />
          <Route path="/leaderboard" element={<LeaderboardPublic />} />
          <Route path="/tv" element={<LeaderboardTV />} />

          <Route
            path="/*"
            element={
              <ProtectedArea
                token={token}
                user={user}
                userId={userId}
                role={role}
              >
                <Routes>
                  <Route
                    path="/super-admin"
                    element={guard(
                      user,
                      token,
                      "SUPER_ADMIN",
                      <SuperAdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/super-admin/email-settings"
                    element={guard(
                      user,
                      token,
                      "SUPER_ADMIN",
                      <EmailSettings onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/super-admin/email-logs"
                    element={guard(
                      user,
                      token,
                      "SUPER_ADMIN",
                      <EmailLogs onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/super-admin/email-templates"
                    element={guard(
                      user,
                      token,
                      "SUPER_ADMIN",
                      <EmailTemplates onLogout={onLogout} />,
                    )}
                  />

                  <Route
                    path="/admin"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/setup"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/events"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/participants"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/judges"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/assignments"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/alerts"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/notifications"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/leaderboard"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/awards"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/payments"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/settings"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <AdminDashboard onLogout={onLogout} />,
                    )}
                  />
                  <Route
                    path="/admin/bulk-email"
                    element={guard(
                      user,
                      token,
                      "ADMIN",
                      <BulkEmail onLogout={onLogout} />,
                    )}
                  />

                  <Route
                    path="/judge"
                    element={guard(
                      user,
                      token,
                      "JUDGE",
                      <JudgeDashboard onLogout={onLogout} />,
                    )}
                  />

                  <Route
                    path="/participant"
                    element={guard(
                      user,
                      token,
                      "PARTICIPANT",
                      <ParticipantDashboard onLogout={onLogout} />,
                    )}
                  />

                  <Route
                    path="/parent/dashboard"
                    element={guard(
                      user,
                      token,
                      "PARENT",
                      <ParentDashboard onLogout={onLogout} />,
                    )}
                  />

                  <Route
                    path="/notifications"
                    element={
                      token && user ? (
                        mustChangePassword ? (
                          <Navigate to="/force-change-password" replace />
                        ) : (
                          <NotificationsPage />
                        )
                      ) : (
                        <Navigate to="/login" replace />
                      )
                    }
                  />

                  <Route
                    path="/"
                    element={
                      token && user ? (
                        mustChangePassword ? (
                          <Navigate to="/force-change-password" replace />
                        ) : (
                          <Navigate to={homePath} replace />
                        )
                      ) : (
                        <Navigate to="/login" replace />
                      )
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ProtectedArea>
            }
          />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}

function roleHomePath(role) {
  const r = String(role || "").toUpperCase();

  if (r === "SUPER_ADMIN") return "/super-admin";
  if (r === "ADMIN") return "/admin";
  if (r === "JUDGE") return "/judge";
  if (r === "PARTICIPANT") return "/participant";
  if (r === "PARENT") return "/parent/dashboard";

  return "/login";
}

function guard(user, token, role, element) {
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;

  if (user?.mustChangePassword) {
    return <Navigate to="/force-change-password" replace />;
  }

  const userRole = String(user?.role || "").toUpperCase();
  const requiredRole = String(role || "").toUpperCase();

  if (userRole !== requiredRole) {
    return <Navigate to={roleHomePath(userRole)} replace />;
  }

  return element;
}
