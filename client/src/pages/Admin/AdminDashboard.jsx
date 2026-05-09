// client/src/pages/Admin/AdminDashboard.jsx
// ✅ PHASE 2 — FINAL ENTERPRISE ADMIN DASHBOARD SHELL
// ✅ Enterprise admin dashboard shell
// ✅ KPI cards + quick navigation + API health + recent activity
// ✅ Working onboarding start/reset with force-remount
// ✅ Global search passed into child admin modules
// ✅ Responsive sidebar + mobile shell
// ✅ SUPER_ADMIN academy scope support
// ✅ Safe stats loading + refresh controls
// ✅ Production-safe command palette
// ✅ FIXED: super admin sees scoped admin shell until dedicated console is intentionally used
// ✅ FIXED: academy scope selection refreshes dashboard counts
// ✅ FIXED: safer child component fallback handling
// ✅ FIXED: sidebar scroll works correctly on tablet and mobile
// ✅ NEW: Notification bell integrated
// ✅ NEW: Notifications module integrated into sidebar + dashboard shell
// ✅ NEW: Bulk Email module integrated into sidebar + dashboard shell
// ✅ NEW: Live unread notification badge integrated from NotificationsProvider

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, AUTH_EVENT } from "../../lib/api.js";
import {
  getUser,
  getRole,
  getToken,
  isSuperAdmin,
  getEffectiveAcademy,
  getSelectedAcademy,
  setSelectedAcademy,
  clearSelectedAcademy,
  patchUser,
} from "../../lib/auth.js";

import Judges from "./Judges.jsx";
import Participants from "./Participants.jsx";
import Assignments from "./Assignments.jsx";
import Leaderboard from "./Leaderboard.jsx";
import Awards from "./Awards.jsx";
import Setup from "./Setup.jsx";
import Alerts from "./Alerts.jsx";
import Settings from "./Settings.jsx";
import Events from "./Events.jsx";
import Payments from "./Payments.jsx";
import Notifications from "./Notifications.jsx";
import BulkEmail from "./BulkEmail.jsx";
import NotificationBell from "../Components/notifications/NotificationBell.jsx";
import { useNotifications } from "../../hooks/useNotifications.js";

const RED = "var(--ra-accent, #e11d2e)";
const LS_TAB = "ra_admin_tab";
const LS_THEME = "ra_admin_theme";
const LS_ACCENT = "ra_admin_accent";
const LS_FONT = "ra_admin_font";
const LS_SIDEBAR = "ra_admin_sidebar_collapsed";

const ADMIN_ONBOARDING_KEY = "ra_onboarding_admin_dashboard_v4";

const ADMIN_ONBOARDING_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Admin Dashboard",
    text: "This dashboard is your control center for setup, events, participants, judges, assignments, alerts, notifications, bulk email, leaderboard, awards, payments, and settings.",
    target: '[data-tour="admin-main-top"]',
    placement: "bottom",
  },
  {
    id: "search",
    title: "Global Search",
    text: "Use this search to pass keywords into admin modules like participants and judges.",
    target: "#ra-admin-global-search",
    placement: "bottom",
  },
  {
    id: "quick-actions",
    title: "Quick Actions",
    text: "Open the command palette for fast navigation, refresh, theme toggle, notifications, bulk email, and tutorial restart.",
    target: '[data-tour="admin-quick-actions"]',
    placement: "bottom",
  },
  {
    id: "sidebar-nav",
    title: "Sidebar Navigation",
    text: "Use the sidebar to move between all admin modules. It also shows live system status and quick stats.",
    target: '[data-tour="admin-sidebar-nav"]',
    placement: "right",
  },
  {
    id: "dashboard-stats",
    title: "Overview Stats",
    text: "These KPIs summarize participants, judges, events, assignments, and notifications for the current academy scope.",
    target: '[data-tour="admin-hero-stats"]',
    placement: "bottom",
  },
  {
    id: "content-area",
    title: "Content Area",
    text: "This is where the selected admin module opens. Search text from the top bar is passed into supported modules.",
    target: '[data-tour="admin-content-area"]',
    placement: "top",
  },
];

const UI_SYNC_EVENTS = {
  ALERT_CREATED: "ra:alert:created",
  ALERT_RESOLVED: "ra:alert:resolved",
  ALERT_DELETED: "ra:alert:deleted",
  NOTIFICATION_CREATED: "ra:notification:created",
  NOTIFICATION_READ: "ra:notification:read",
  NOTIFICATION_UNREAD: "ra:notification:unread",
  NOTIFICATION_READ_ALL: "ra:notification:read-all",
  NOTIFICATION_DELETED: "ra:notification:deleted",
};

function dispatchAdminUiSync(eventName, detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  } catch {
    // ignore
  }
}

function getOnboardingState() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_ONBOARDING_KEY) || "{}");
  } catch {
    return {};
  }
}

function setOnboardingState(next) {
  try {
    const current = getOnboardingState();
    localStorage.setItem(
      ADMIN_ONBOARDING_KEY,
      JSON.stringify({ ...current, ...(next || {}) }),
    );
  } catch {
    // ignore
  }
}

function clearOnboardingState() {
  try {
    localStorage.removeItem(ADMIN_ONBOARDING_KEY);
  } catch {
    // ignore
  }
}

/* =========================================================
   ICONS
========================================================= */

function SvgIcon({
  children,
  size = 18,
  stroke = "currentColor",
  strokeWidth = 1.6,
  fill = "none",
  style,
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", ...style }}
    >
      {children}
    </svg>
  );
}

const IconDashboard = (p) => (
  <SvgIcon {...p}>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="5" rx="2" />
    <rect x="13" y="10" width="8" height="11" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
  </SvgIcon>
);

const IconSetup = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="3.3" />
    <path d="M19.2 12a7.2 7.2 0 0 0-.08-1l2-1.56-2-3.44-2.43.8a7.8 7.8 0 0 0-1.74-1l-.37-2.53h-4l-.37 2.53a7.8 7.8 0 0 0-1.74 1l-2.43-.8-2 3.44 2 1.56a7.2 7.2 0 0 0 0 2l-2 1.56 2 3.44 2.43-.8a7.8 7.8 0 0 0 1.74 1l.37 2.53h4l.37-2.53a7.8 7.8 0 0 0 1.74-1l2.43.8 2-3.44-2-1.56c.05-.33.08-.66.08-1Z" />
  </SvgIcon>
);

const IconCalendar = (p) => (
  <SvgIcon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M16 3v4M8 3v4M3 9h18" />
  </SvgIcon>
);

const IconUsers = (p) => (
  <SvgIcon {...p}>
    <path d="M16.5 19a4.5 4.5 0 0 0-9 0" />
    <circle cx="12" cy="9" r="3.2" />
    <path d="M19.2 19a3.8 3.8 0 0 0-2.9-3.7" />
    <path d="M7.7 15.3A3.8 3.8 0 0 0 4.8 19" />
  </SvgIcon>
);

const IconJudge = (p) => (
  <SvgIcon {...p}>
    <path d="M14 4 4 14" />
    <path d="m13 5 6 6" />
    <path d="M11 7 17 13" />
    <path d="M3 21h7" />
    <path d="M13 14 8 19" />
  </SvgIcon>
);

const IconAssignments = (p) => (
  <SvgIcon {...p}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
    <path d="M11 7h2a3 3 0 0 1 3 3v3" />
    <path d="M13 17h-2a3 3 0 0 1-3-3v-3" />
  </SvgIcon>
);

const IconAlert = (p) => (
  <SvgIcon {...p}>
    <path d="M12 3 21 19H3L12 3Z" />
    <path d="M12 9v4" />
    <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
  </SvgIcon>
);

const IconTrophy = (p) => (
  <SvgIcon {...p}>
    <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
    <path d="M16 5h3v1a3 3 0 0 1-3 3" />
    <path d="M8 5H5v1a3 3 0 0 0 3 3" />
    <path d="M12 11v3" />
    <path d="M9 20h6" />
    <path d="M10 14h4l1 6H9l1-6Z" />
  </SvgIcon>
);

const IconAward = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="8" r="4.5" />
    <path d="M9.5 12.8 8 21l4-2 4 2-1.5-8.2" />
  </SvgIcon>
);

const IconSettings = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="3.3" />
    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
  </SvgIcon>
);

const IconSearch = (p) => (
  <SvgIcon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </SvgIcon>
);

const IconMoon = (p) => (
  <SvgIcon {...p}>
    <path d="M20 14.5A7.5 7.5 0 1 1 9.5 4 6.2 6.2 0 0 0 20 14.5Z" />
  </SvgIcon>
);

const IconSun = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
  </SvgIcon>
);

const IconLogout = (p) => (
  <SvgIcon {...p}>
    <path d="M15 17 20 12 15 7" />
    <path d="M20 12H9" />
    <path d="M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
  </SvgIcon>
);

const IconOnline = (p) => (
  <SvgIcon {...p}>
    <path d="M5 12a7 7 0 0 1 14 0" />
    <path d="M8 12a4 4 0 0 1 8 0" />
    <circle cx="12" cy="16" r="1.4" fill="currentColor" stroke="none" />
  </SvgIcon>
);

const IconRefresh = (p) => (
  <SvgIcon {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </SvgIcon>
);

const IconClock = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </SvgIcon>
);

const IconActivity = (p) => (
  <SvgIcon {...p}>
    <path d="M3 12h4l2-5 4 10 2-5h6" />
  </SvgIcon>
);

const IconFolder = (p) => (
  <SvgIcon {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </SvgIcon>
);

const IconMenu = (p) => (
  <SvgIcon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </SvgIcon>
);

const IconClose = (p) => (
  <SvgIcon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </SvgIcon>
);

const IconChevronLeft = (p) => (
  <SvgIcon {...p}>
    <path d="M15 18 9 12l6-6" />
  </SvgIcon>
);

const IconChevronRight = (p) => (
  <SvgIcon {...p}>
    <path d="m9 18 6-6-6-6" />
  </SvgIcon>
);

const IconCommand = (p) => (
  <SvgIcon {...p}>
    <path d="M8 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm14 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 22a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm14 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path d="M5 8v8M19 8v8M8 5h8M8 19h8" />
  </SvgIcon>
);

const IconBuilding = (p) => (
  <SvgIcon {...p}>
    <path d="M4 21h16" />
    <path d="M6 21V7l6-3 6 3v14" />
    <path d="M9 10h.01M12 10h.01M15 10h.01M9 14h.01M12 14h.01M15 14h.01" />
  </SvgIcon>
);

const IconBell = (p) => (
  <SvgIcon {...p}>
    <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
    <path d="M9 17a3 3 0 0 0 6 0" />
  </SvgIcon>
);

/* =========================================================
   NAV
========================================================= */

const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    hint: "Executive overview and system status",
    shortcut: "⌘1 / Ctrl+1",
  },
  {
    key: "setup",
    label: "Setup",
    hint: "Groups, activities and core structure",
    shortcut: "⌘2 / Ctrl+2",
  },
  {
    key: "events",
    label: "Events",
    hint: "Competition and event lifecycle",
    shortcut: "⌘3 / Ctrl+3",
  },
  {
    key: "participants",
    label: "Participants",
    hint: "Athlete records and enrollment",
    shortcut: "⌘4 / Ctrl+4",
  },
  {
    key: "judges",
    label: "Judges",
    hint: "Judge accounts and management",
    shortcut: "⌘5 / Ctrl+5",
  },
  {
    key: "assignments",
    label: "Assignments",
    hint: "Judge and activity mapping",
    shortcut: "⌘6 / Ctrl+6",
  },
  {
    key: "alerts",
    label: "Alerts",
    hint: "Issues, warnings and live notices",
    shortcut: "⌘7 / Ctrl+7",
  },
  {
    key: "notifications",
    label: "Notifications",
    hint: "Inbox, broadcast and notification control",
    shortcut: "N",
  },
  {
    key: "bulk-email",
    label: "Bulk Email",
    hint: "Send email to parents, participants, roles or events",
    shortcut: "Email",
  },
  {
    key: "leaderboard",
    label: "Leaderboard",
    hint: "Scoring, ranks and standings",
    shortcut: "⌘8 / Ctrl+8",
  },
  {
    key: "awards",
    label: "Awards",
    hint: "Awards, medals and certificates",
    shortcut: "⌘9 / Ctrl+9",
  },
  {
    key: "payments",
    label: "Payments",
    hint: "Payment records, collections and status control",
    shortcut: "Payments",
  },
  {
    key: "settings",
    label: "Settings",
    hint: "Theme, branding and preferences",
    shortcut: "⌘0 / Ctrl+0",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function NavIcon({ keyName, size = 18 }) {
  const props = { size };
  if (keyName === "dashboard") return <IconDashboard {...props} />;
  if (keyName === "setup") return <IconSetup {...props} />;
  if (keyName === "events") return <IconCalendar {...props} />;
  if (keyName === "participants") return <IconUsers {...props} />;
  if (keyName === "judges") return <IconJudge {...props} />;
  if (keyName === "assignments") return <IconAssignments {...props} />;
  if (keyName === "alerts") return <IconAlert {...props} />;
  if (keyName === "notifications") return <IconBell {...props} />;
  if (keyName === "bulk-email") return <IconBell {...props} />;
  if (keyName === "leaderboard") return <IconTrophy {...props} />;
  if (keyName === "awards") return <IconAward {...props} />;
  if (keyName === "payments") return <IconActivity {...props} />;
  if (keyName === "settings") return <IconSettings {...props} />;
  if (keyName === "building") return <IconBuilding {...props} />;
  if (keyName === "refresh") return <IconRefresh {...props} />;
  if (keyName === "moon") return <IconMoon {...props} />;
  if (keyName === "sun") return <IconSun {...props} />;
  if (keyName === "logout") return <IconLogout {...props} />;
  if (keyName === "command") return <IconCommand {...props} />;
  return <IconFolder {...props} />;
}

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.notifications)) return data.notifications;
  return [];
}

function safeLower(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function firstOf(...fns) {
  for (const fn of fns) {
    if (typeof fn === "function") return fn;
  }
  return null;
}

function tabToComponent(tab) {
  if (tab === "setup") return Setup;
  if (tab === "events") return Events;
  if (tab === "participants") return Participants;
  if (tab === "judges") return Judges;
  if (tab === "assignments") return Assignments;
  if (tab === "alerts") return Alerts;
  if (tab === "notifications") return Notifications;
  if (tab === "bulk-email") return BulkEmail;
  if (tab === "leaderboard") return Leaderboard;
  if (tab === "awards") return Awards;
  if (tab === "payments") return Payments;
  if (tab === "settings") return Settings;
  return null;
}

function tabToTitle(tab) {
  const found = NAV_ITEMS.find((x) => x.key === tab);
  return found?.label || "Dashboard";
}

function academyIdOf(academy) {
  return academy?._id || academy?.id || academy?.academyId || "";
}

function academyNameOf(academy) {
  return academy?.academyName || academy?.name || "";
}

function academyCodeOf(academy) {
  return academy?.academyCode || academy?.code || "";
}

function academyLogoOf(academy) {
  return academy?.academyLogo || academy?.logoUrl || "";
}

const EMPTY_STATS = {
  participants: 0,
  judges: 0,
  events: 0,
  assignments: 0,
  alertsOpen: 0,
  notifications: 0,
  notificationsUnread: 0,
  awards: 0,
  groups: 0,
  activities: 0,
  activeEvents: 0,
  archivedEvents: 0,
};

const EMPTY_HEALTH = {
  participants: "idle",
  judges: "idle",
  events: "idle",
  assignments: "idle",
  alerts: "idle",
  notifications: "idle",
};

/* =========================================================
   MAIN
========================================================= */

export default function AdminDashboard({ onLogout }) {
  const { unread: liveUnread = 0, loadUnread } = useNotifications();

  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem(LS_TAB) || "dashboard";
    } catch {
      return "dashboard";
    }
  });

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_THEME);
      if (saved === "light" || saved === "dark") return saved;
      const prefersDark = window.matchMedia?.(
        "(prefers-color-scheme: dark)",
      )?.matches;
      return prefersDark ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_SIDEBAR) === "1";
    } catch {
      return false;
    }
  });

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    try {
      return window.innerWidth <= 1100;
    } catch {
      return false;
    }
  });

  const [q, setQ] = useState("");
  const [clock, setClock] = useState(new Date());
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const [sessionUser, setSessionUser] = useState(() => getUser());
  const [role, setRoleState] = useState(() => getRole());
  const [effectiveAcademy, setEffectiveAcademyState] = useState(() =>
    getEffectiveAcademy(),
  );
  const [selectedAcademyState, setSelectedAcademyState] = useState(() =>
    getSelectedAcademy(),
  );
  const [sessionReady, setSessionReady] = useState(() => {
    return !!getToken?.() && !!getUser?.();
  });

  const [academyList, setAcademyList] = useState([]);
  const [academyBusy, setAcademyBusy] = useState(false);
  const [academyErr, setAcademyErr] = useState("");

  const [stats, setStats] = useState(EMPTY_STATS);
  const [statsBusy, setStatsBusy] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQ, setCommandQ] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [apiHealth, setApiHealth] = useState(EMPTY_HEALTH);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [onboardingRunId, setOnboardingRunId] = useState(0);
  const [onboardingRect, setOnboardingRect] = useState(null);

  const commandInputRef = useRef(null);
  const loadStatsSeqRef = useRef(0);
  const statsRefreshTimerRef = useRef(null);

  const superAdminMode = useMemo(() => {
    return String(role || "").toUpperCase() === "SUPER_ADMIN" || isSuperAdmin();
  }, [role]);

  const selectedAcademy = useMemo(() => {
    return selectedAcademyState || getSelectedAcademy();
  }, [selectedAcademyState]);

  const onboardingStep = useMemo(() => {
    return ADMIN_ONBOARDING_STEPS[onboardingIndex] || null;
  }, [onboardingIndex]);

  const syncSessionContext = useCallback(() => {
    const user = getUser();
    setSessionUser(user);
    setRoleState(getRole());
    setEffectiveAcademyState(getEffectiveAcademy());
    setSelectedAcademyState(getSelectedAcademy());
    setSessionReady(!!getToken?.() && !!user);
  }, []);

  const loadAcademyProfile = useCallback(async () => {
    try {
      const currentUser = getUser?.() || null;
      if (!currentUser) return;

      const next = patchUser({
        academyName:
          currentUser?.academyName ||
          currentUser?.academy?.name ||
          currentUser?.name ||
          "",
        academyCode:
          currentUser?.academyCode || currentUser?.academy?.code || "",
        academyLogo:
          currentUser?.academyLogo ||
          currentUser?.academy?.logoUrl ||
          currentUser?.logoUrl ||
          "",
      });

      setSessionUser(next);
      setEffectiveAcademyState(getEffectiveAcademy());
      setSessionReady(!!getToken?.() && !!next);
    } catch {
      // ignore
    }
  }, []);

  const loadSuperAdminAcademies = useCallback(async () => {
    if (!superAdminMode) return;
    setAcademyBusy(true);
    setAcademyErr("");

    try {
      const rows =
        typeof api.superAdminAcademies === "function"
          ? await api.superAdminAcademies()
          : await api.get("/super-admin/academies");

      const arr = Array.isArray(rows) ? rows : rows?.rows || rows?.items || [];
      setAcademyList(arr);
    } catch (e) {
      setAcademyList([]);
      setAcademyErr(e?.message || "Failed to load academies");
    } finally {
      setAcademyBusy(false);
    }
  }, [superAdminMode]);

  const loadStats = useCallback(async () => {
    const seq = ++loadStatsSeqRef.current;

    if (superAdminMode && !academyIdOf(selectedAcademy)) {
      if (seq !== loadStatsSeqRef.current) return;

      setStats(EMPTY_STATS);
      setApiHealth(EMPTY_HEALTH);
      setRecentActivity([
        {
          icon: "building",
          title: "Academy scope required",
          text: "Select an academy to load scoped administration data.",
          tone: "warn",
        },
      ]);
      setLastRefresh(new Date());
      setStatsBusy(false);
      return;
    }

    setStatsBusy(true);

    const academyId =
      academyIdOf(selectedAcademy) ||
      effectiveAcademy?.academyId ||
      sessionUser?.academyId ||
      sessionUser?.academy?._id ||
      "";

    const scopedQuery = academyId
      ? `?academyId=${encodeURIComponent(academyId)}`
      : "";

    const participantsFn = firstOf(api?.participants, api?.getParticipants);
    const judgesFn = firstOf(api?.judges, api?.getJudges);
    const eventsFn = firstOf(api?.adminEvents, api?.events, api?.getEvents);
    const assignmentsFn = firstOf(api?.judgeAssignments, api?.getAssignments);
    const alertsFn = firstOf(api?.adminAlerts, api?.alerts, api?.getAlerts);
    const awardsFn = firstOf(api?.awardsHistory, api?.awards, api?.getAwards);
    const groupsFn = firstOf(api?.groups);
    const activitiesFn = firstOf(api?.activities);
    const notificationsFn = firstOf(api?.notifications);

    const result = {
      participants: [],
      judges: [],
      events: [],
      assignments: [],
      alerts: [],
      notifications: [],
      awards: [],
      groups: [],
      activities: [],
    };

    const nextHealth = {
      participants: "missing",
      judges: "missing",
      events: "missing",
      assignments: "missing",
      alerts: "missing",
      notifications: "missing",
    };

    async function runMaybeScoped(fn, fallbackPath = "") {
      if (typeof fn === "function") {
        try {
          return toArray(await fn(scopedQuery));
        } catch {
          try {
            return toArray(await fn());
          } catch {
            // continue
          }
        }
      }

      if (fallbackPath) {
        try {
          return toArray(await api.get(`${fallbackPath}${scopedQuery}`));
        } catch {
          try {
            return toArray(await api.get(fallbackPath));
          } catch {
            return [];
          }
        }
      }

      return [];
    }

    const jobs = [
      {
        key: "participants",
        fn: participantsFn,
        run: async () => runMaybeScoped(participantsFn, "/admin/participants"),
      },
      {
        key: "judges",
        fn: judgesFn,
        run: async () => runMaybeScoped(judgesFn, "/admin/judges"),
      },
      {
        key: "events",
        fn: eventsFn,
        run: async () => runMaybeScoped(eventsFn, "/admin/events"),
      },
      {
        key: "assignments",
        fn: assignmentsFn,
        run: async () => {
          try {
            const scopedEventList = await runMaybeScoped(
              eventsFn,
              "/admin/events",
            );
            if (scopedEventList.length && typeof assignmentsFn === "function") {
              const eventId =
                scopedEventList.find((x) => safeLower(x?.status) === "live")
                  ?._id ||
                scopedEventList[0]?._id ||
                scopedEventList[0]?.id;

              if (eventId) {
                return toArray(await assignmentsFn(eventId));
              }
            }
          } catch {
            // ignore
          }

          try {
            return runMaybeScoped(assignmentsFn, "/admin/judge-assignments");
          } catch {
            return [];
          }
        },
      },
      {
        key: "alerts",
        fn: alertsFn,
        run: async () => {
          try {
            if (typeof alertsFn === "function") {
              return toArray(
                await alertsFn(
                  `${scopedQuery ? `${scopedQuery}&` : "?"}status=OPEN&limit=500`,
                ),
              );
            }
          } catch {
            // ignore
          }

          try {
            return toArray(
              await api.get(
                `/admin/alerts${
                  scopedQuery
                    ? `${scopedQuery}&status=OPEN&limit=500`
                    : "?status=OPEN&limit=500"
                }`,
              ),
            );
          } catch {
            try {
              return runMaybeScoped(alertsFn, "/admin/alerts");
            } catch {
              return [];
            }
          }
        },
      },
      {
        key: "notifications",
        fn: notificationsFn,
        run: async () => runMaybeScoped(notificationsFn, "/notifications"),
      },
      {
        key: "awards",
        fn: awardsFn,
        run: async () => runMaybeScoped(awardsFn, "/admin/awards"),
      },
      {
        key: "groups",
        fn: groupsFn,
        run: async () => runMaybeScoped(groupsFn, "/admin/groups"),
      },
      {
        key: "activities",
        fn: activitiesFn,
        run: async () => runMaybeScoped(activitiesFn, "/admin/activities"),
      },
    ];

    const settled = await Promise.allSettled(
      jobs.map(async (job) => {
        if (!job.fn && job.key !== "assignments") {
          return { key: job.key, data: [], ok: false, missing: true };
        }
        try {
          const data = await job.run();
          return { key: job.key, data, ok: true, missing: false };
        } catch {
          return { key: job.key, data: [], ok: false, missing: false };
        }
      }),
    );

    if (seq !== loadStatsSeqRef.current) return;

    for (const item of settled) {
      if (item.status !== "fulfilled") continue;
      const { key, data, ok, missing } = item.value;
      result[key] = Array.isArray(data) ? data : [];
      if (key in nextHealth) {
        nextHealth[key] = missing ? "missing" : ok ? "ok" : "error";
      }
    }

    const openAlerts = result.alerts.filter((x) => {
      const s = safeLower(x?.status || "open");
      return !s || s === "open" || s === "active" || s === "pending";
    });

    const unreadNotifications = result.notifications.filter((x) => {
      return !(
        x?.isRead === true ||
        x?.read === true ||
        safeLower(x?.status) === "read" ||
        x?.seen === true
      );
    });

    const activeEvents = result.events.filter((e) => {
      const s = safeLower(e?.status);
      return (
        e?.isActive === true || s === "active" || s === "live" || s === "open"
      );
    }).length;

    const archivedEvents = result.events.filter((e) => {
      const s = safeLower(e?.status);
      return e?.archived === true || s === "archived" || s === "closed";
    }).length;

    setStats({
      participants: result.participants.length,
      judges: result.judges.length,
      events: result.events.length,
      assignments: result.assignments.length,
      alertsOpen: openAlerts.length,
      notifications: result.notifications.length,
      notificationsUnread: unreadNotifications.length,
      awards: result.awards.length,
      groups: result.groups.length,
      activities: result.activities.length,
      activeEvents,
      archivedEvents,
    });

    setApiHealth(nextHealth);
    setLastRefresh(new Date());

    setRecentActivity([
      {
        icon: "participants",
        title: "Participants synchronized",
        text: `${result.participants.length} participant records loaded.`,
        tone: "default",
      },
      {
        icon: "judges",
        title: "Judges synchronized",
        text: `${result.judges.length} judge accounts available.`,
        tone: "default",
      },
      {
        icon: "events",
        title: "Event registry checked",
        text: `${result.events.length} events found, ${activeEvents} active.`,
        tone: activeEvents > 0 ? "ok" : "warn",
      },
      {
        icon: "alerts",
        title: "Alert channel reviewed",
        text: `${openAlerts.length} open alerts require attention.`,
        tone: openAlerts.length > 0 ? "danger" : "ok",
      },
      {
        icon: "notifications",
        title: "Notification center checked",
        text: `${liveUnread} unread of ${result.notifications.length} total notifications.`,
        tone: liveUnread > 0 ? "warn" : "ok",
      },
      {
        icon: "assignments",
        title: "Assignments loaded",
        text: `${result.assignments.length} assignment mappings in system.`,
        tone: result.assignments.length > 0 ? "default" : "warn",
      },
    ]);

    setStatsBusy(false);
  }, [
    selectedAcademy,
    superAdminMode,
    effectiveAcademy,
    sessionUser,
    liveUnread,
  ]);
  const scheduleStatsRefresh = useCallback(
    (delay = 180) => {
      window.clearTimeout(statsRefreshTimerRef.current);

      statsRefreshTimerRef.current = window.setTimeout(async () => {
        try {
          await loadUnread?.();
        } catch {
          // ignore
        }

        try {
          await loadStats();
        } catch {
          // ignore
        }
      }, delay);
    },
    [loadStats, loadUnread],
  );

  const handleSelectAcademy = useCallback((academy) => {
    const normalized = {
      academyId: academyIdOf(academy),
      academyName: academyNameOf(academy),
      academyCode: academyCodeOf(academy),
      academyLogo: academyLogoOf(academy),
      _id: academyIdOf(academy),
      id: academyIdOf(academy),
      name: academyNameOf(academy),
      code: academyCodeOf(academy),
      logoUrl: academyLogoOf(academy),
    };

    setSelectedAcademy(normalized);
    setSelectedAcademyState(normalized);
    setEffectiveAcademyState({
      academyId: normalized.academyId,
      academyName: normalized.academyName,
      academyCode: normalized.academyCode,
      academyLogo: normalized.academyLogo,
      source: "selected",
    });
    setSessionReady(!!getToken?.() && !!getUser?.());
  }, []);

  const handleClearAcademyScope = useCallback(() => {
    clearSelectedAcademy();
    setSelectedAcademyState(null);
    setEffectiveAcademyState(getEffectiveAcademy());
    setSessionReady(!!getToken?.() && !!getUser?.());
  }, []);

  const updateOnboardingTarget = useCallback(() => {
    if (!onboardingOpen || !onboardingStep?.target) {
      setOnboardingRect(null);
      return;
    }

    const el = document.querySelector(onboardingStep.target);
    if (!el) {
      setOnboardingRect(null);
      return;
    }

    const r = el.getBoundingClientRect();
    setOnboardingRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      right: r.right,
      bottom: r.bottom,
    });
  }, [onboardingOpen, onboardingStep]);

  const openOnboardingAt = useCallback((index = 0) => {
    const max = ADMIN_ONBOARDING_STEPS.length - 1;
    const safeIndex = Math.max(0, Math.min(index, max));

    setCommandOpen(false);
    setMobileSidebarOpen(false);
    setTab("dashboard");
    setOnboardingRect(null);

    setOnboardingOpen(false);
    setOnboardingIndex(safeIndex);
    setOnboardingRunId((n) => n + 1);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setOnboardingIndex(safeIndex);
        setOnboardingOpen(true);
      });
    });
  }, []);

  const startOnboarding = useCallback(
    (index = 0) => {
      setOnboardingState({
        completed: false,
        dismissed: false,
        lastStartedAt: Date.now(),
      });
      openOnboardingAt(index);
    },
    [openOnboardingAt],
  );

  const resetOnboarding = useCallback(() => {
    clearOnboardingState();
    startOnboarding(0);
  }, [startOnboarding]);

  const dismissOnboarding = useCallback(() => {
    setOnboardingState({
      dismissed: true,
      completed: false,
      lastDismissedAt: Date.now(),
    });
    setOnboardingOpen(false);
    setOnboardingIndex(0);
    setOnboardingRect(null);
  }, []);

  const finishOnboarding = useCallback(() => {
    setOnboardingState({
      completed: true,
      dismissed: false,
      lastCompletedAt: Date.now(),
    });
    setOnboardingOpen(false);
    setOnboardingIndex(0);
    setOnboardingRect(null);
  }, []);

  useEffect(() => {
    syncSessionContext();
  }, [syncSessionContext]);

  useEffect(() => {
    if (!sessionReady) return;
    if (superAdminMode) {
      loadSuperAdminAcademies();
    } else {
      loadAcademyProfile();
    }
  }, [
    sessionReady,
    superAdminMode,
    loadSuperAdminAcademies,
    loadAcademyProfile,
  ]);

  useEffect(() => {
    if (!sessionReady) return;
    loadUnread?.();
  }, [sessionReady, loadUnread]);

  useEffect(() => {
    function onFocus() {
      syncSessionContext();
    }

    function onStorage() {
      syncSessionContext();
    }

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [syncSessionContext]);

  useEffect(() => {
    function onAuthRequired() {
      setCommandOpen(false);
      setMobileSidebarOpen(false);
      onLogout?.();
    }
    window.addEventListener(AUTH_EVENT, onAuthRequired);
    return () => window.removeEventListener(AUTH_EVENT, onAuthRequired);
  }, [onLogout]);

  useEffect(() => {
    try {
      const accent = localStorage.getItem(LS_ACCENT);
      const font = localStorage.getItem(LS_FONT);
      if (accent) {
        document.documentElement.style.setProperty("--ra-accent", accent);
      }
      if (font) {
        document.documentElement.style.setProperty("--ra-font", font);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const validTabs = new Set(NAV_ITEMS.map((x) => x.key));
      if (!validTabs.has(tab)) {
        setTab("dashboard");
        localStorage.setItem(LS_TAB, "dashboard");
        return;
      }
      localStorage.setItem(LS_TAB, tab);
    } catch {
      // ignore
    }
  }, [tab]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_THEME, theme);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_SIDEBAR, sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth <= 1100;
      setIsMobile(mobile);
      if (!mobile) setMobileSidebarOpen(false);
    }

    function onOnline() {
      setIsOnline(true);
    }

    function onOffline() {
      setIsOnline(false);
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      const meta = e.ctrlKey || e.metaKey;
      const key = String(e.key || "").toLowerCase();

      if (meta && key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }

      if (meta && key === "j") {
        e.preventDefault();
        const el = document.getElementById("ra-admin-global-search");
        if (el) el.focus();
      }

      if (meta && key === "b") {
        e.preventDefault();
        if (isMobile) setMobileSidebarOpen((v) => !v);
        else setSidebarCollapsed((v) => !v);
      }

      if (e.key === "Escape") {
        if (onboardingOpen) {
          dismissOnboarding();
          return;
        }
        if (isMobile) setMobileSidebarOpen(false);
        setCommandOpen(false);
      }

      if (meta && key === "1") {
        e.preventDefault();
        setTab("dashboard");
      }
      if (meta && key === "2") {
        e.preventDefault();
        setTab("setup");
      }
      if (meta && key === "3") {
        e.preventDefault();
        setTab("events");
      }
      if (meta && key === "4") {
        e.preventDefault();
        setTab("participants");
      }
      if (meta && key === "5") {
        e.preventDefault();
        setTab("judges");
      }
      if (meta && key === "6") {
        e.preventDefault();
        setTab("assignments");
      }
      if (meta && key === "7") {
        e.preventDefault();
        setTab("alerts");
      }
      if (key === "n" && !meta && !e.altKey && !e.shiftKey) {
        const activeTag = safeLower(document.activeElement?.tagName);
        if (
          activeTag !== "input" &&
          activeTag !== "textarea" &&
          activeTag !== "select"
        ) {
          e.preventDefault();
          setTab("notifications");
        }
      }
      if (meta && key === "8") {
        e.preventDefault();
        setTab("leaderboard");
      }
      if (meta && key === "9") {
        e.preventDefault();
        setTab("awards");
      }
      if (meta && key === "0") {
        e.preventDefault();
        setTab("settings");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissOnboarding, isMobile, onboardingOpen]);

  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = mobileSidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen, isMobile]);

  useEffect(() => {
    if (!commandOpen) return;
    const t = window.setTimeout(() => commandInputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [commandOpen]);

  useEffect(() => {
    if (!sessionReady) return;
    let alive = true;

    (async () => {
      await loadStats();
      if (!alive) return;
    })();

    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") loadStats();
    }, 12000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [loadStats, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
    loadStats();
  }, [sessionReady, selectedAcademy, effectiveAcademy, loadStats]);

  useEffect(() => {
    if (!sessionReady) return;

    const state = getOnboardingState();
    if (state?.completed || state?.dismissed) return;

    const t = window.setTimeout(() => {
      startOnboarding(0);
    }, 500);

    return () => window.clearTimeout(t);
  }, [sessionReady, startOnboarding]);

  useEffect(() => {
    if (!onboardingOpen) return;

    updateOnboardingTarget();

    const handle = () => updateOnboardingTarget();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);

    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        updateOnboardingTarget();
      });
    });

    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
      window.cancelAnimationFrame(raf);
    };
  }, [onboardingOpen, onboardingIndex, tab, updateOnboardingTarget]);

  useEffect(() => {
    function pushRecentActivity(
      title,
      text,
      tone = "default",
      icon = "alerts",
    ) {
      setRecentActivity((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return [{ icon, title, text, tone }, ...safePrev].slice(0, 8);
      });
    }

    function onAlertCreated(e) {
      const detail = e?.detail || {};
      const createdNotification =
        detail?.createdNotification === true ||
        detail?.notificationCreated === true ||
        detail?.createNotification === true;

      setStats((prev) => ({
        ...prev,
        alertsOpen: Number(prev?.alertsOpen || 0) + 1,
        notifications:
          Number(prev?.notifications || 0) + (createdNotification ? 1 : 0),
        notificationsUnread:
          Number(prev?.notificationsUnread || 0) +
          (createdNotification ? 1 : 0),
      }));

      pushRecentActivity(
        "Judge help request received",
        detail?.message || "A new live alert was raised by a judge.",
        "warn",
        "alerts",
      );

      scheduleStatsRefresh(120);
    }

    function onAlertResolved(e) {
      const detail = e?.detail || {};

      setStats((prev) => ({
        ...prev,
        alertsOpen: Math.max(0, Number(prev?.alertsOpen || 0) - 1),
      }));

      pushRecentActivity(
        "Alert resolved",
        detail?.message || "An alert was resolved.",
        "ok",
        "alerts",
      );

      scheduleStatsRefresh(120);
    }

    function onAlertDeleted() {
      setStats((prev) => ({
        ...prev,
        alertsOpen: Math.max(0, Number(prev?.alertsOpen || 0) - 1),
      }));

      scheduleStatsRefresh(120);
    }

    function onNotificationCreated(e) {
      const detail = e?.detail || {};

      setStats((prev) => ({
        ...prev,
        notifications: Number(prev?.notifications || 0) + 1,
        notificationsUnread: Number(prev?.notificationsUnread || 0) + 1,
      }));

      pushRecentActivity(
        "Notification created",
        detail?.title || detail?.message || "A new notification was created.",
        "warn",
        "notifications",
      );

      scheduleStatsRefresh(100);
    }

    function onNotificationRead() {
      setStats((prev) => ({
        ...prev,
        notificationsUnread: Math.max(
          0,
          Number(prev?.notificationsUnread || 0) - 1,
        ),
      }));

      scheduleStatsRefresh(100);
    }

    function onNotificationUnread() {
      setStats((prev) => ({
        ...prev,
        notificationsUnread: Number(prev?.notificationsUnread || 0) + 1,
      }));

      scheduleStatsRefresh(100);
    }

    function onNotificationReadAll() {
      setStats((prev) => ({
        ...prev,
        notificationsUnread: 0,
      }));

      scheduleStatsRefresh(100);
    }

    function onNotificationDeleted() {
      setStats((prev) => ({
        ...prev,
        notifications: Math.max(0, Number(prev?.notifications || 0) - 1),
      }));

      scheduleStatsRefresh(100);
    }

    window.addEventListener(UI_SYNC_EVENTS.ALERT_CREATED, onAlertCreated);
    window.addEventListener(UI_SYNC_EVENTS.ALERT_RESOLVED, onAlertResolved);
    window.addEventListener(UI_SYNC_EVENTS.ALERT_DELETED, onAlertDeleted);
    window.addEventListener(
      UI_SYNC_EVENTS.NOTIFICATION_CREATED,
      onNotificationCreated,
    );
    window.addEventListener(
      UI_SYNC_EVENTS.NOTIFICATION_READ,
      onNotificationRead,
    );
    window.addEventListener(
      UI_SYNC_EVENTS.NOTIFICATION_UNREAD,
      onNotificationUnread,
    );
    window.addEventListener(
      UI_SYNC_EVENTS.NOTIFICATION_READ_ALL,
      onNotificationReadAll,
    );
    window.addEventListener(
      UI_SYNC_EVENTS.NOTIFICATION_DELETED,
      onNotificationDeleted,
    );

    return () => {
      window.removeEventListener(UI_SYNC_EVENTS.ALERT_CREATED, onAlertCreated);
      window.removeEventListener(
        UI_SYNC_EVENTS.ALERT_RESOLVED,
        onAlertResolved,
      );
      window.removeEventListener(UI_SYNC_EVENTS.ALERT_DELETED, onAlertDeleted);
      window.removeEventListener(
        UI_SYNC_EVENTS.NOTIFICATION_CREATED,
        onNotificationCreated,
      );
      window.removeEventListener(
        UI_SYNC_EVENTS.NOTIFICATION_READ,
        onNotificationRead,
      );
      window.removeEventListener(
        UI_SYNC_EVENTS.NOTIFICATION_UNREAD,
        onNotificationUnread,
      );
      window.removeEventListener(
        UI_SYNC_EVENTS.NOTIFICATION_READ_ALL,
        onNotificationReadAll,
      );
      window.removeEventListener(
        UI_SYNC_EVENTS.NOTIFICATION_DELETED,
        onNotificationDeleted,
      );
      window.clearTimeout(statsRefreshTimerRef.current);
    };
  }, [scheduleStatsRefresh]);

  const academyName =
    effectiveAcademy?.academyName ||
    selectedAcademy?.academyName ||
    selectedAcademy?.name ||
    sessionUser?.academyName ||
    sessionUser?.academy?.name ||
    "Academy";

  const academyCode =
    effectiveAcademy?.academyCode ||
    selectedAcademy?.academyCode ||
    selectedAcademy?.code ||
    sessionUser?.academyCode ||
    sessionUser?.academy?.code ||
    "";

  const academyLogo =
    effectiveAcademy?.academyLogo ||
    selectedAcademy?.academyLogo ||
    selectedAcademy?.logoUrl ||
    sessionUser?.academyLogo ||
    sessionUser?.academy?.logoUrl ||
    "";

  const academySubtitle = useMemo(() => {
    if (superAdminMode) {
      return academyIdOf(selectedAcademy)
        ? "Super Admin · Scoped Academy View"
        : "Super Admin · Global Session";
    }
    return "Academy Administration Workspace";
  }, [superAdminMode, selectedAcademy]);

  const academyScopeText = useMemo(() => {
    if (superAdminMode) {
      return academyIdOf(selectedAcademy)
        ? `Scoped to ${academyName}${academyCode ? ` (${academyCode})` : ""}`
        : "No academy selected";
    }
    return academyCode ? `Code: ${academyCode}` : "Academy scoped session";
  }, [superAdminMode, selectedAcademy, academyName, academyCode]);

  const currentTitle = useMemo(() => tabToTitle(tab), [tab]);
  const Active = useMemo(() => tabToComponent(tab), [tab]);

  const useFullSuperAdminDashboard = useMemo(() => {
    return false;
  }, []);

  const T = useMemo(() => {
    const light = {
      pageBg:
        "radial-gradient(900px 380px at 8% 0%, rgba(225,29,46,0.06), transparent 56%), radial-gradient(700px 320px at 100% 0%, rgba(8,47,73,0.05), transparent 50%), linear-gradient(180deg, #f6f8fb 0%, #edf2f7 100%)",
      sideBg: "rgba(255,255,255,0.86)",
      sideBorder: "rgba(15,23,42,0.08)",
      mainCard: "rgba(255,255,255,0.82)",
      mainBorder: "rgba(15,23,42,0.08)",
      panel: "rgba(255,255,255,0.92)",
      text: "#0f172a",
      sub: "rgba(15,23,42,0.64)",
      soft: "rgba(15,23,42,0.045)",
      btnBg: "rgba(255,255,255,0.94)",
      btnBorder: "rgba(15,23,42,0.10)",
      inputBg: "rgba(255,255,255,0.92)",
      inputBorder: "rgba(15,23,42,0.11)",
      shadow: "0 14px 40px rgba(15,23,42,0.08)",
      contentShadow: "0 18px 48px rgba(15,23,42,0.08)",
      logoBg: "rgba(255,255,255,0.92)",
      logoBorder: "rgba(15,23,42,0.06)",
      ok: "#059669",
      warn: "#d97706",
      overlay: "rgba(15,23,42,0.26)",
      danger: "#dc2626",
      commandBg: "rgba(255,255,255,0.98)",
    };

    const dark = {
      pageBg:
        "radial-gradient(900px 380px at 8% 0%, rgba(225,29,46,0.14), transparent 56%), radial-gradient(700px 320px at 100% 0%, rgba(8,47,73,0.14), transparent 50%), linear-gradient(180deg, #020617 0%, #09111f 100%)",
      sideBg: "rgba(12,18,32,0.88)",
      sideBorder: "rgba(148,163,184,0.14)",
      mainCard: "rgba(12,18,32,0.78)",
      mainBorder: "rgba(148,163,184,0.16)",
      panel: "rgba(15,23,42,0.88)",
      text: "rgba(255,255,255,0.94)",
      sub: "rgba(255,255,255,0.62)",
      soft: "rgba(255,255,255,0.05)",
      btnBg: "rgba(2,6,23,0.52)",
      btnBorder: "rgba(148,163,184,0.18)",
      inputBg: "rgba(2,6,23,0.56)",
      inputBorder: "rgba(148,163,184,0.18)",
      shadow: "0 16px 44px rgba(0,0,0,0.34)",
      contentShadow: "0 18px 54px rgba(0,0,0,0.40)",
      logoBg: "rgba(2,6,23,0.58)",
      logoBorder: "rgba(148,163,184,0.14)",
      ok: "#10b981",
      warn: "#f59e0b",
      overlay: "rgba(2,6,23,0.58)",
      danger: "#f87171",
      commandBg: "rgba(12,18,32,0.98)",
    };

    return theme === "dark" ? dark : light;
  }, [theme]);

  const dateText = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-QA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(clock);
    } catch {
      return clock.toDateString();
    }
  }, [clock]);

  const timeText = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-QA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(clock);
    } catch {
      return clock.toLocaleTimeString();
    }
  }, [clock]);

  const refreshText = useMemo(() => {
    if (!lastRefresh) return "Not synced yet";
    try {
      return `Last sync: ${new Intl.DateTimeFormat("en-QA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(lastRefresh)}`;
    } catch {
      return `Last sync: ${lastRefresh.toLocaleTimeString()}`;
    }
  }, [lastRefresh]);

  const compactRail = sidebarCollapsed && !isMobile;
  const sidebarWidth = isMobile ? 0 : compactRail ? 86 : 298;

  const commandItems = useMemo(() => {
    const items = [
      ...NAV_ITEMS.map((x) => ({
        type: "nav",
        key: x.key,
        label: x.label,
        icon: x.key,
        hint: x.hint,
        meta: x.shortcut,
        action: () => {
          setTab(x.key);
          setCommandOpen(false);
          setCommandQ("");
          if (isMobile) setMobileSidebarOpen(false);
        },
      })),
      {
        type: "action",
        key: "tutorial",
        label: "Restart Tutorial",
        icon: "command",
        hint: "Open the admin onboarding tutorial again from the beginning",
        meta: "Help",
        action: () => {
          resetOnboarding();
          setCommandOpen(false);
          setCommandQ("");
        },
      },
      ...(superAdminMode
        ? [
            {
              type: "action",
              key: "academy-scope",
              label: academyIdOf(selectedAcademy)
                ? `Clear academy scope (${academyName})`
                : "Academy scope not selected",
              icon: "building",
              hint: academyIdOf(selectedAcademy)
                ? "Return to unscoped super-admin session"
                : "Select an academy from the sidebar to scope data",
              meta: "Academy",
              action: async () => {
                if (academyIdOf(selectedAcademy)) {
                  handleClearAcademyScope();
                }
                setCommandOpen(false);
                setCommandQ("");
              },
            },
          ]
        : []),
      {
        type: "action",
        key: "refresh",
        label: "Refresh dashboard data",
        icon: "refresh",
        hint: "Reload counts, health and summaries",
        meta: "Manual refresh",
        action: async () => {
          await loadStats();
          setCommandOpen(false);
          setCommandQ("");
        },
      },
      {
        type: "action",
        key: "theme",
        label:
          theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        icon: theme === "dark" ? "sun" : "moon",
        hint: "Toggle workspace appearance",
        meta: "Theme",
        action: () => {
          setTheme((t) => (t === "dark" ? "light" : "dark"));
          setCommandOpen(false);
          setCommandQ("");
        },
      },
      {
        type: "action",
        key: "logout",
        label: "Logout",
        icon: "logout",
        hint: "Exit administrator session",
        meta: "Session",
        action: () => {
          setCommandOpen(false);
          setCommandQ("");
          onLogout?.();
        },
      },
    ];

    const s = safeLower(commandQ);
    if (!s) return items;

    return items.filter((x) =>
      [x.label, x.hint, x.meta, x.key].some((v) => safeLower(v).includes(s)),
    );
  }, [
    academyName,
    commandQ,
    handleClearAcademyScope,
    isMobile,
    loadStats,
    onLogout,
    resetOnboarding,
    selectedAcademy,
    superAdminMode,
    theme,
  ]);

  function handleSelectTab(nextTab) {
    setTab(nextTab);
    if (isMobile) setMobileSidebarOpen(false);
  }

  function renderMiniCommandIcon(name) {
    return <NavIcon keyName={name} size={18} />;
  }

  function renderDashboardHome() {
    if (superAdminMode && !academyIdOf(selectedAcademy)) {
      return (
        <div style={{ display: "grid", gap: 14 }}>
          <PanelCard
            T={T}
            title="Select Academy Scope"
            sub="Choose an academy from the sidebar to load scoped administration data for dashboard modules."
          >
            <div style={{ display: "grid", gap: 12 }}>
              <div style={emptyState(T)}>
                No academy selected. Super Admin session is active without a
                scoped academy.
              </div>

              <div style={superAdminAcademyGrid}>
                {academyList.slice(0, 6).map((a) => (
                  <button
                    key={a._id || a.id}
                    type="button"
                    onClick={() => handleSelectAcademy(a)}
                    style={academyQuickCard(T)}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span style={academyQuickIcon(T)}>
                        <IconBuilding size={16} />
                      </span>
                      <div style={{ textAlign: "left", minWidth: 0 }}>
                        <div style={{ fontWeight: 900, color: T.text }}>
                          {a.name || a.academyName || "Academy"}
                        </div>
                        <div style={{ fontSize: 12, color: T.sub }}>
                          {a.code || a.academyCode || ""}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </PanelCard>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={overviewGrid(compactRail)} data-tour="admin-hero-stats">
          <BigStat
            icon={<IconUsers size={26} />}
            label="Participants"
            value={stats.participants}
            hint="Registered athletes"
            T={T}
            theme={theme}
          />
          <BigStat
            icon={<IconJudge size={26} />}
            label="Judges"
            value={stats.judges}
            hint="Scoring staff"
            T={T}
            theme={theme}
          />
          <BigStat
            icon={<IconCalendar size={26} />}
            label="Events"
            value={stats.events}
            hint={`${stats.activeEvents} active / ${stats.archivedEvents} archived`}
            T={T}
            theme={theme}
          />
          <BigStat
            icon={<IconAssignments size={26} />}
            label="Assignments"
            value={stats.assignments}
            hint="Judge allocations"
            T={T}
            theme={theme}
          />
        </div>

        <div
          style={dashboardPanelGrid(compactRail)}
          className="ra-dashboard-panels"
        >
          <PanelCard
            T={T}
            title="Quick Navigation"
            sub="Open the most-used modules directly from the admin command center."
          >
            <div style={quickCardsGrid}>
              {NAV_ITEMS.filter((x) => x.key !== "dashboard")
                .slice(0, 10)
                .map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelectTab(item.key)}
                    style={quickNavCard(T, tab === item.key)}
                  >
                    <div style={quickNavTop}>
                      <span style={quickNavIconBox(T)}>
                        <NavIcon keyName={item.key} size={18} />
                      </span>
                      <span style={quickNavTitle(T)}>{item.label}</span>
                    </div>
                    <div style={quickNavHint(T)}>{item.hint}</div>
                  </button>
                ))}
            </div>
          </PanelCard>

          <PanelCard
            T={T}
            title="System Snapshot"
            sub="Live operational indicators for the current administration session."
          >
            <div style={snapshotList}>
              <SnapshotRow
                label="Open alerts"
                value={stats.alertsOpen}
                T={T}
                tone={stats.alertsOpen > 0 ? "warn" : "ok"}
              />
              <SnapshotRow
                label="Unread notifications"
                value={liveUnread}
                T={T}
                tone={liveUnread > 0 ? "warn" : "ok"}
              />
              <SnapshotRow
                label="Configured awards"
                value={stats.awards}
                T={T}
              />
              <SnapshotRow label="Groups" value={stats.groups} T={T} />
              <SnapshotRow label="Activities" value={stats.activities} T={T} />
              <SnapshotRow
                label="Appearance"
                value={theme === "dark" ? "Dark" : "Light"}
                T={T}
              />
              <SnapshotRow
                label="Network"
                value={isOnline ? "Online" : "Offline"}
                T={T}
                tone={isOnline ? "ok" : "danger"}
              />
              <SnapshotRow
                label="Academy"
                value={
                  academyCode ? `${academyName} (${academyCode})` : academyName
                }
                T={T}
              />
            </div>
          </PanelCard>
        </div>

        <div
          style={dashboardBottomGrid(compactRail)}
          className="ra-dashboard-panels"
        >
          <PanelCard
            T={T}
            title="Recent Activity"
            sub="Operational telemetry generated from the latest synchronization."
          >
            <div style={{ display: "grid", gap: 10 }}>
              {recentActivity.length ? (
                recentActivity.map((item, idx) => (
                  <RecentActivityRow key={idx} item={item} T={T} />
                ))
              ) : (
                <div style={emptyState(T)}>No recent activity yet.</div>
              )}
            </div>
          </PanelCard>

          <PanelCard
            T={T}
            title="API Health"
            sub="Connection visibility for dashboard data sources."
          >
            <div style={{ display: "grid", gap: 10 }}>
              <HealthRow
                label="Participants API"
                state={apiHealth.participants}
                T={T}
              />
              <HealthRow label="Judges API" state={apiHealth.judges} T={T} />
              <HealthRow label="Events API" state={apiHealth.events} T={T} />
              <HealthRow
                label="Assignments API"
                state={apiHealth.assignments}
                T={T}
              />
              <HealthRow label="Alerts API" state={apiHealth.alerts} T={T} />
              <HealthRow
                label="Notifications API"
                state={apiHealth.notifications}
                T={T}
              />
            </div>
          </PanelCard>
        </div>
      </div>
    );
  }

  if (useFullSuperAdminDashboard) {
    return null;
  }

  return (
    <div style={page(T, isMobile)}>
      <StyleVars />

      {isMobile && mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setMobileSidebarOpen(false)}
          style={mobileOverlay(T)}
        />
      ) : null}

      {commandOpen ? (
        <div
          style={commandOverlay(T)}
          onMouseDown={() => setCommandOpen(false)}
        >
          <div style={commandCard(T)} onMouseDown={(e) => e.stopPropagation()}>
            <div style={commandTop(T)}>
              <span style={commandLeadingIcon(T)}>
                <IconCommand size={16} />
              </span>
              <input
                ref={commandInputRef}
                value={commandQ}
                onChange={(e) => setCommandQ(e.target.value)}
                placeholder="Search sections and quick actions..."
                style={commandInput(T)}
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                style={commandClose(T)}
                aria-label="Close command palette"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div style={commandListWrap(T)}>
              {commandItems.length ? (
                commandItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.action}
                    style={commandItem(T)}
                  >
                    <div style={commandItemLeft}>
                      <div style={commandItemIcon(T)}>
                        {renderMiniCommandIcon(item.icon)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={commandItemTitle(T)}>{item.label}</div>
                        <div style={commandItemHint(T)}>{item.hint}</div>
                      </div>
                    </div>
                    <div style={commandMeta(T)}>{item.meta}</div>
                  </button>
                ))
              ) : (
                <div style={commandEmpty(T)}>No results found.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div style={shell(sidebarWidth, isMobile)}>
        <aside
          style={sidebar(T, {
            compactRail,
            mobileOpen: mobileSidebarOpen,
            isMobile,
            width: sidebarWidth,
          })}
        >
          <div style={sidebarTopRow(compactRail)}>
            <div style={brandBlock(compactRail)}>
              <div style={logoWrap(T, compactRail)}>
                <img
                  src={
                    academyLogo ||
                    (typeof localStorage !== "undefined" &&
                      localStorage.getItem("ra_admin_logo")) ||
                    "/logo.png"
                  }
                  alt={academyName}
                  style={logo(compactRail)}
                />
              </div>

              {!compactRail ? (
                <div style={{ minWidth: 0 }}>
                  <div style={sideEyebrow}>
                    {superAdminMode
                      ? "Super Admin Console"
                      : "Administration Console"}
                  </div>
                  <div style={academyNameText(T)}>{academyName}</div>
                  <div style={sideSub(T)}>{academySubtitle}</div>
                </div>
              ) : null}
            </div>

            <div style={sidebarControls}>
              <button
                type="button"
                onClick={() =>
                  isMobile
                    ? setMobileSidebarOpen(false)
                    : setSidebarCollapsed((v) => !v)
                }
                style={iconBtn(T, compactRail)}
                title={
                  isMobile
                    ? "Close menu"
                    : compactRail
                      ? "Expand sidebar"
                      : "Collapse sidebar"
                }
                aria-label={
                  isMobile
                    ? "Close sidebar"
                    : compactRail
                      ? "Expand sidebar"
                      : "Collapse sidebar"
                }
              >
                {isMobile ? (
                  <IconClose size={16} />
                ) : compactRail ? (
                  <IconChevronRight size={16} />
                ) : (
                  <IconChevronLeft size={16} />
                )}
              </button>
            </div>
          </div>

          {!compactRail ? (
            <>
              <div style={sideInfoWrap}>
                <div style={sidePill(T, isOnline ? T.ok : T.danger)}>
                  <IconOnline size={13} />
                  {isOnline ? "System Online" : "Offline"}
                </div>
                <div style={sidePill(T)}>
                  <IconCalendar size={13} />
                  {dateText}
                </div>
                <div style={sidePill(T)}>
                  <IconClock size={13} />
                  {timeText}
                </div>
                <div style={sidePill(T, stats.alertsOpen > 0 ? T.warn : T.ok)}>
                  <IconAlert size={13} />
                  Open Alerts: {stats.alertsOpen}
                </div>
                <div style={sidePill(T, liveUnread > 0 ? T.warn : T.ok)}>
                  <IconBell size={13} />
                  Unread Notifications: {liveUnread}
                </div>
                <div style={sidePill(T)}>
                  <IconBuilding size={13} />
                  {academyScopeText}
                </div>
              </div>

              <div style={sectionLabel(T)}>Navigation</div>
            </>
          ) : null}

          <div style={sideNav(compactRail)} data-tour="admin-sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <SideTab
                key={item.key}
                compact={compactRail}
                label={item.label}
                icon={<NavIcon keyName={item.key} size={18} />}
                active={tab === item.key}
                onClick={() => handleSelectTab(item.key)}
                badge={
                  item.key === "alerts"
                    ? stats.alertsOpen
                    : item.key === "notifications"
                      ? liveUnread
                      : undefined
                }
                theme={theme}
              />
            ))}
          </div>

          {!compactRail && superAdminMode ? (
            <>
              <div style={sectionLabel(T)}>Academy Scope</div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 10,
                  borderRadius: 16,
                  background: T.soft,
                  border: `1px solid ${T.sideBorder}`,
                }}
              >
                <select
                  value={academyIdOf(selectedAcademy)}
                  onChange={(e) => {
                    const id = e.target.value;
                    const picked = academyList.find(
                      (x) => String(academyIdOf(x)) === String(id),
                    );
                    if (picked) handleSelectAcademy(picked);
                    else handleClearAcademyScope();
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${T.inputBorder}`,
                    background: T.inputBg,
                    color: T.text,
                    fontWeight: 800,
                    outline: "none",
                  }}
                >
                  <option value="">Select academy scope</option>
                  {academyList.map((a) => (
                    <option key={academyIdOf(a)} value={academyIdOf(a)}>
                      {academyNameOf(a)}{" "}
                      {academyCodeOf(a) ? `(${academyCodeOf(a)})` : ""}
                    </option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={loadSuperAdminAcademies}
                    disabled={academyBusy}
                    style={sideActionBtn(T, false)}
                  >
                    <IconRefresh size={14} />
                    {academyBusy ? "Loading..." : "Reload"}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAcademyScope}
                    style={sideActionBtn(T, false)}
                  >
                    <IconClose size={14} />
                    Clear Scope
                  </button>
                </div>

                {academyErr ? (
                  <div
                    style={{ fontSize: 12, color: T.danger, fontWeight: 800 }}
                  >
                    {academyErr}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {!compactRail ? (
            <>
              <div style={sectionLabel(T)}>Overview</div>

              <div style={miniStatsGrid}>
                <MiniStat
                  icon={<IconUsers size={16} />}
                  label="Participants"
                  value={stats.participants}
                  T={T}
                />
                <MiniStat
                  icon={<IconJudge size={16} />}
                  label="Judges"
                  value={stats.judges}
                  T={T}
                />
                <MiniStat
                  icon={<IconCalendar size={16} />}
                  label="Events"
                  value={stats.events}
                  T={T}
                />
                <MiniStat
                  icon={<IconAssignments size={16} />}
                  label="Assignments"
                  value={stats.assignments}
                  T={T}
                />
              </div>

              <div style={sectionLabel(T)}>Quick Actions</div>
              <div style={quickSideActions}>
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  style={sideActionBtn(T, false)}
                >
                  <IconCommand size={16} />
                  <span>Quick Actions</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab("notifications")}
                  style={sideActionBtn(T, false)}
                >
                  <IconBell size={16} />
                  <span>Open Notifications</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab("bulk-email")}
                  style={sideActionBtn(T, false)}
                >
                  <IconBell size={16} />
                  <span>Open Bulk Email</span>
                </button>

                <button
                  type="button"
                  onClick={loadStats}
                  disabled={statsBusy}
                  style={sideActionBtn(T, false)}
                >
                  {statsBusy ? (
                    <IconActivity size={16} />
                  ) : (
                    <IconRefresh size={16} />
                  )}
                  <span>{statsBusy ? "Refreshing..." : "Refresh Counts"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => startOnboarding(0)}
                  style={sideActionBtn(T, false)}
                >
                  <IconCommand size={16} />
                  <span>Start Tutorial</span>
                </button>

                <button
                  type="button"
                  onClick={resetOnboarding}
                  style={sideActionBtn(T, false)}
                >
                  <IconRefresh size={16} />
                  <span>Reset Tutorial</span>
                </button>
              </div>
            </>
          ) : (
            <div style={collapsedQuickStats}>
              <CollapsedStat
                value={stats.participants}
                icon={<IconUsers size={15} />}
              />
              <CollapsedStat
                value={stats.judges}
                icon={<IconJudge size={15} />}
              />
              <CollapsedStat
                value={stats.events}
                icon={<IconCalendar size={15} />}
              />
              <CollapsedStat
                value={stats.assignments}
                icon={<IconAssignments size={15} />}
              />
            </div>
          )}

          <div
            style={{
              marginTop: "auto",
              display: "grid",
              gap: compactRail ? 8 : 10,
            }}
          >
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              style={sideActionBtn(T, compactRail)}
              title={
                theme === "dark"
                  ? "Switch to Light Mode"
                  : "Switch to Dark Mode"
              }
            >
              {theme === "dark" ? (
                <IconMoon size={16} />
              ) : (
                <IconSun size={16} />
              )}
              {!compactRail ? (
                <span>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={onLogout}
              style={sideLogoutBtn(T, compactRail)}
              title="Logout"
            >
              {compactRail ? (
                <IconLogout size={16} />
              ) : (
                <>
                  <IconLogout size={16} />
                  Logout
                </>
              )}
            </button>
          </div>
        </aside>

        <main style={mainWrap(compactRail)}>
          {isMobile ? (
            <div style={mobileBar(T)}>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                style={mobileMenuBtn(T)}
                aria-label="Open sidebar"
              >
                <IconMenu size={18} />
              </button>

              <div style={mobileBarTitle(T)}>
                <div style={{ fontWeight: 950 }}>{currentTitle}</div>
                <div style={{ fontSize: 10, opacity: 0.72 }}>{academyName}</div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <NotificationBell panelWidth={360} maxItems={5} />
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  style={mobileMenuBtn(T)}
                  aria-label="Open quick actions"
                >
                  <IconCommand size={16} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTheme((t) => (t === "dark" ? "light" : "dark"))
                  }
                  style={mobileMenuBtn(T)}
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <IconMoon size={16} />
                  ) : (
                    <IconSun size={16} />
                  )}
                </button>
              </div>
            </div>
          ) : null}

          <div
            className="ra-admin-main-top"
            style={mainTop(T, compactRail)}
            data-tour="admin-main-top"
          >
            <div>
              <div style={mainEyebrow}>
                {superAdminMode
                  ? "Enterprise Super Administration"
                  : "Enterprise Administration"}
              </div>
              <div style={mainTitle(T)}>{currentTitle}</div>
              <div style={mainSub(T)}>
                {superAdminMode
                  ? `Managing ${
                      academyIdOf(selectedAcademy)
                        ? `${academyName}${academyCode ? ` (${academyCode})` : ""}`
                        : "global super-admin session"
                    }.`
                  : `Centralized administration workspace for ${academyName}${
                      academyCode ? ` (${academyCode})` : ""
                    }.`}
              </div>

              <div style={statusStripWrap}>
                <div style={statusStrip(T, isOnline ? T.ok : T.danger)}>
                  <IconOnline size={13} />
                  {isOnline ? "Online" : "Offline"}
                </div>
                <div style={statusStrip(T)}>
                  <IconRefresh size={13} />
                  {refreshText}
                </div>
                <div style={statusStrip(T)}>
                  <IconClock size={13} />
                  Current Time: <strong>{timeText}</strong>
                </div>
                <div style={statusStrip(T)}>
                  <IconBuilding size={13} />
                  {academyScopeText}
                </div>
              </div>
            </div>

            <div style={mainTopActions} data-tour="admin-quick-actions">
              <div
                style={searchWrap(T)}
                role="search"
                aria-label="Admin search"
              >
                <span style={searchLeading(T)}>
                  <IconSearch size={15} />
                </span>
                <input
                  id="ra-admin-global-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search participants, judges, bib, email..."
                  style={searchInput(T)}
                />
                {q ? (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    style={clearBtn(T)}
                    aria-label="Clear search"
                  >
                    <IconClose size={14} />
                  </button>
                ) : (
                  <span style={searchHint(T)}>⌘/Ctrl + J</span>
                )}
              </div>

              <NotificationBell />

              <button
                type="button"
                onClick={() => handleSelectTab("notifications")}
                style={topQuickBtn(T)}
              >
                <IconBell size={15} />
                Notifications
                {liveUnread > 0 ? (
                  <span style={smallBadge(theme)}>{liveUnread}</span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab("bulk-email")}
                style={topQuickBtn(T)}
              >
                <IconBell size={15} />
                Bulk Email
              </button>

              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                style={topQuickBtn(T)}
              >
                <IconCommand size={15} />
                Quick Actions
              </button>

              <button
                type="button"
                onClick={() => startOnboarding(0)}
                style={topQuickBtn(T)}
              >
                <IconCommand size={15} />
                Start Tutorial
              </button>

              <button
                type="button"
                onClick={resetOnboarding}
                style={topQuickBtn(T)}
              >
                <IconRefresh size={15} />
                Reset Tutorial
              </button>

              <button
                type="button"
                onClick={loadStats}
                disabled={statsBusy}
                style={topQuickBtn(T)}
              >
                {statsBusy ? (
                  <IconActivity size={15} />
                ) : (
                  <IconRefresh size={15} />
                )}
                {statsBusy ? "Refreshing" : "Refresh"}
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab("alerts")}
                style={topQuickBtn(T)}
              >
                <IconAlert size={15} />
                Alerts
                {stats.alertsOpen > 0 ? (
                  <span style={smallBadge(theme)}>{stats.alertsOpen}</span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab("leaderboard")}
                style={topQuickBtn(T)}
              >
                <IconTrophy size={15} />
                Leaderboard
              </button>
            </div>
          </div>

          {tab !== "dashboard" ? (
            <div
              style={heroStatsGrid(compactRail)}
              data-tour="admin-hero-stats"
            >
              <BigStat
                icon={<IconUsers size={26} />}
                label="Participants"
                value={stats.participants}
                hint="Registered athletes"
                T={T}
                theme={theme}
              />
              <BigStat
                icon={<IconJudge size={26} />}
                label="Judges"
                value={stats.judges}
                hint="Scoring staff"
                T={T}
                theme={theme}
              />
              <BigStat
                icon={<IconCalendar size={26} />}
                label="Events"
                value={stats.events}
                hint="Configured competitions"
                T={T}
                theme={theme}
              />
              <BigStat
                icon={<IconAssignments size={26} />}
                label="Assignments"
                value={stats.assignments}
                hint="Judge allocations"
                T={T}
                theme={theme}
              />
            </div>
          ) : null}

          {q ? (
            <div style={activeSearchBar(T)}>
              <span>Active Search:</span>
              <strong style={{ wordBreak: "break-word" }}>{q}</strong>
              <button
                type="button"
                onClick={() => setQ("")}
                style={pillXBtn(T)}
              >
                <IconClose size={12} />
              </button>
            </div>
          ) : null}

          <div
            style={contentCard(T, compactRail)}
            data-tour="admin-content-area"
          >
            {tab === "dashboard" ? (
              renderDashboardHome()
            ) : Active ? (
              <Active
                searchQuery={q}
                onAlertCreated={(detail) =>
                  dispatchAdminUiSync(UI_SYNC_EVENTS.ALERT_CREATED, detail)
                }
                onAlertResolved={(detail) =>
                  dispatchAdminUiSync(UI_SYNC_EVENTS.ALERT_RESOLVED, detail)
                }
                onAlertDeleted={(detail) =>
                  dispatchAdminUiSync(UI_SYNC_EVENTS.ALERT_DELETED, detail)
                }
                onNotificationCreated={(detail) =>
                  dispatchAdminUiSync(
                    UI_SYNC_EVENTS.NOTIFICATION_CREATED,
                    detail,
                  )
                }
                onNotificationRead={(detail) =>
                  dispatchAdminUiSync(UI_SYNC_EVENTS.NOTIFICATION_READ, detail)
                }
                onNotificationUnread={(detail) =>
                  dispatchAdminUiSync(
                    UI_SYNC_EVENTS.NOTIFICATION_UNREAD,
                    detail,
                  )
                }
                onNotificationsReadAll={(detail) =>
                  dispatchAdminUiSync(
                    UI_SYNC_EVENTS.NOTIFICATION_READ_ALL,
                    detail,
                  )
                }
                onNotificationDeleted={(detail) =>
                  dispatchAdminUiSync(
                    UI_SYNC_EVENTS.NOTIFICATION_DELETED,
                    detail,
                  )
                }
              />
            ) : (
              <div style={emptyState(T)}>Module not available.</div>
            )}
          </div>
        </main>
      </div>

      {onboardingOpen && onboardingStep ? (
        <AdminOnboardingOverlay
          key={`admin-tour-${onboardingRunId}-${onboardingIndex}-${onboardingStep.id}`}
          step={onboardingStep}
          stepIndex={onboardingIndex}
          total={ADMIN_ONBOARDING_STEPS.length}
          rect={onboardingRect}
          onClose={dismissOnboarding}
          onBack={() => setOnboardingIndex((v) => (v > 0 ? v - 1 : v))}
          onNext={() => {
            if (onboardingIndex >= ADMIN_ONBOARDING_STEPS.length - 1) {
              finishOnboarding();
            } else {
              setOnboardingIndex((v) => v + 1);
            }
          }}
        />
      ) : null}
    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function SideTab({ label, icon, active, onClick, badge, theme, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={sideTabBtn(active, theme, compact)}
      aria-current={active ? "page" : undefined}
      title={label}
    >
      <span style={sideTabIconWrap(active, compact)}>{icon}</span>
      {!compact ? (
        <span style={{ fontWeight: 900, flex: 1, textAlign: "left" }}>
          {label}
        </span>
      ) : null}
      {typeof badge === "number" && badge > 0 ? (
        <span style={badgePill(theme, compact)}>{badge}</span>
      ) : null}
    </button>
  );
}

function MiniStat({ icon, label, value, T }) {
  return (
    <div style={miniStatCard(T)}>
      <div style={miniStatIcon(T)}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: T.sub, fontWeight: 800 }}>
          {label}
        </div>
        <div style={{ fontSize: 18, fontWeight: 950, color: T.text }}>
          {Number(value || 0).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function CollapsedStat({ value, icon }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 4,
        padding: "7px 4px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(148,163,184,0.10)",
        fontSize: 11,
        fontWeight: 900,
        minHeight: 48,
      }}
      title={String(value || 0)}
    >
      <span style={{ lineHeight: 1 }}>{icon}</span>
      <span>{Number(value || 0).toLocaleString()}</span>
    </div>
  );
}

function BigStat({ icon, label, value, hint, T, theme }) {
  return (
    <div style={bigStatCard(T, theme)}>
      <div style={bigStatTop}>
        <div style={bigStatIcon(T, theme)}>{icon}</div>
        <div>
          <div style={bigStatLabel(T)}>{label}</div>
          <div style={bigStatValue(T)}>
            {Number(value || 0).toLocaleString()}
          </div>
        </div>
      </div>
      <div style={bigStatHint(T)}>{hint}</div>
    </div>
  );
}

function PanelCard({ title, sub, children, T }) {
  return (
    <div style={quickPanel(T)}>
      <div>
        <div style={quickPanelTitle(T)}>{title}</div>
        <div style={quickPanelSub(T)}>{sub}</div>
      </div>
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

function SnapshotRow({ label, value, T, tone = "default" }) {
  const color =
    tone === "ok"
      ? T.ok
      : tone === "warn"
        ? T.warn
        : tone === "danger"
          ? T.danger
          : T.text;

  return (
    <div style={snapshotRow(T)}>
      <span style={{ color: T.sub, fontWeight: 800 }}>{label}</span>
      <strong style={{ color, fontWeight: 950 }}>{value}</strong>
    </div>
  );
}

function HealthRow({ label, state, T }) {
  const map = {
    ok: { text: "Connected", color: T.ok },
    error: { text: "Error", color: T.danger },
    missing: { text: "Unavailable", color: T.warn },
    idle: { text: "Idle", color: T.sub },
  };

  const current = map[state] || map.idle;

  return (
    <div style={snapshotRow(T)}>
      <span style={{ color: T.sub, fontWeight: 800 }}>{label}</span>
      <strong style={{ color: current.color, fontWeight: 950 }}>
        {current.text}
      </strong>
    </div>
  );
}

function RecentActivityRow({ item, T }) {
  const toneColor =
    item.tone === "ok"
      ? T.ok
      : item.tone === "warn"
        ? T.warn
        : item.tone === "danger"
          ? T.danger
          : T.text;

  const iconKey =
    item.icon === "participants"
      ? "participants"
      : item.icon === "judges"
        ? "judges"
        : item.icon === "events"
          ? "events"
          : item.icon === "alerts"
            ? "alerts"
            : item.icon === "notifications"
              ? "notifications"
              : item.icon === "building"
                ? "building"
                : "assignments";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "42px minmax(0,1fr)",
        gap: 10,
        alignItems: "flex-start",
        padding: 12,
        borderRadius: 16,
        background: T.soft,
        border: `1px solid ${T.btnBorder}`,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          display: "grid",
          placeItems: "center",
          borderRadius: 14,
          background: T.btnBg,
          border: `1px solid ${T.btnBorder}`,
          color: toneColor,
        }}
      >
        <NavIcon keyName={iconKey} size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 950, color: toneColor, fontSize: 14 }}>
          {item.title}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: T.sub,
            lineHeight: 1.45,
          }}
        >
          {item.text}
        </div>
      </div>
    </div>
  );
}

function AdminOnboardingOverlay({
  step,
  stepIndex,
  total,
  rect,
  onClose,
  onBack,
  onNext,
}) {
  const cardWidth = 360;
  const gap = 16;

  let top = window.innerHeight / 2 - 120;
  let left = window.innerWidth / 2 - cardWidth / 2;

  if (rect) {
    if (step.placement === "right") {
      top = rect.top + rect.height / 2 - 120;
      left = rect.right + gap;
    } else if (step.placement === "left") {
      top = rect.top + rect.height / 2 - 120;
      left = rect.left - cardWidth - gap;
    } else if (step.placement === "top") {
      top = rect.top - 220 - gap;
      left = rect.left + rect.width / 2 - cardWidth / 2;
    } else {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - cardWidth / 2;
    }
  }

  top = Math.max(16, Math.min(top, window.innerHeight - 240));
  left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2,6,23,0.58)",
        }}
      />

      {rect ? (
        <div
          style={{
            position: "absolute",
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 18,
            boxShadow: "0 0 0 9999px rgba(2,6,23,0.58)",
            border: "2px solid rgba(225,29,46,0.95)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          top,
          left,
          width: cardWidth,
          maxWidth: "calc(100vw - 32px)",
          background: "rgba(255,255,255,0.98)",
          border: "1px solid rgba(15,23,42,0.10)",
          borderRadius: 22,
          boxShadow: "0 30px 80px rgba(2,8,23,0.35)",
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: RED,
              }}
            >
              Admin Tutorial
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 18,
                fontWeight: 950,
                color: "#0f172a",
              }}
            >
              {step.title}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "rgba(15,23,42,0.78)",
            lineHeight: 1.55,
          }}
        >
          {step.text}
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              style={{
                width: i === stepIndex ? 22 : 8,
                height: 8,
                borderRadius: 999,
                background:
                  i === stepIndex
                    ? "rgba(225,29,46,0.92)"
                    : "rgba(15,23,42,0.15)",
                transition: "all 160ms ease",
              }}
            />
          ))}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "rgba(15,23,42,0.58)",
            }}
          >
            Step {stepIndex + 1} of {total}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onBack}
              disabled={stepIndex === 0}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.10)",
                background: "#fff",
                cursor: stepIndex === 0 ? "not-allowed" : "pointer",
                opacity: stepIndex === 0 ? 0.5 : 1,
                fontWeight: 900,
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={onNext}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(225,29,46,0.24)",
                background: "rgba(225,29,46,0.94)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              {stepIndex >= total - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StyleVars() {
  return (
    <style>{`
      :root{
        --ra-accent: #e11d2e;
        --ra-font: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }

      html, body, #root{
        font-family: var(--ra-font);
        min-height: 100%;
      }

      *{
        box-sizing: border-box;
      }

      aside{
        -webkit-overflow-scrolling: touch;
      }

      aside::-webkit-scrollbar{
        width: 8px;
      }

      aside::-webkit-scrollbar-thumb{
        background: rgba(148,163,184,0.35);
        border-radius: 999px;
      }

      @media (max-width: 1100px){
        .ra-admin-main-top{
          flex-direction: column !important;
          align-items: stretch !important;
        }
      }

      @media (max-width: 900px){
        .ra-dashboard-panels{
          grid-template-columns: 1fr !important;
        }
      }

      @media (max-width: 720px){
        .ra-admin-main-top{
          padding: 14px !important;
          border-radius: 20px !important;
        }
      }
    `}</style>
  );
}

/* =========================================================
   STYLES
========================================================= */

const page = (T, isMobile) => ({
  minHeight: "100vh",
  padding: isMobile ? 12 : 18,
  maxWidth: 1680,
  margin: "0 auto",
  background: T.pageBg,
  color: T.text,
  fontFamily: "var(--ra-font, system-ui)",
});

const shell = (sidebarWidth, isMobile) => ({
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : `${sidebarWidth}px minmax(0,1fr)`,
  gap: isMobile ? 12 : 16,
  transition: "grid-template-columns 180ms ease",
});

const mobileOverlay = (T) => ({
  position: "fixed",
  inset: 0,
  background: T.overlay,
  border: "none",
  zIndex: 50,
  cursor: "pointer",
});

const commandOverlay = (T) => ({
  position: "fixed",
  inset: 0,
  background: T.overlay,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "10vh 16px 16px",
  zIndex: 90,
});

const commandCard = (T) => ({
  width: "min(780px, 100%)",
  borderRadius: 22,
  border: `1px solid ${T.mainBorder}`,
  background: T.commandBg,
  boxShadow: T.contentShadow,
  overflow: "hidden",
  backdropFilter: "blur(18px)",
});

const commandTop = (T) => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 14,
  borderBottom: `1px solid ${T.mainBorder}`,
  background: T.mainCard,
});

const commandLeadingIcon = (T) => ({
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  color: T.sub,
  background: T.soft,
  border: `1px solid ${T.btnBorder}`,
  flexShrink: 0,
});

const commandInput = (T) => ({
  border: "none",
  outline: "none",
  background: "transparent",
  color: T.text,
  fontWeight: 900,
  fontSize: 15,
  width: "100%",
});

const commandClose = (T) => ({
  width: 36,
  height: 36,
  borderRadius: 12,
  border: `1px solid ${T.btnBorder}`,
  background: T.btnBg,
  color: T.text,
  cursor: "pointer",
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
});

const commandListWrap = (T) => ({
  maxHeight: "min(62vh, 620px)",
  overflow: "auto",
  padding: 10,
  display: "grid",
  gap: 8,
  background: T.commandBg,
});

const commandItem = (T) => ({
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: 12,
  borderRadius: 16,
  border: `1px solid ${T.btnBorder}`,
  background: T.btnBg,
  cursor: "pointer",
  textAlign: "left",
});

const commandItemLeft = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const commandItemIcon = (T) => ({
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: T.soft,
  border: `1px solid ${T.btnBorder}`,
  flexShrink: 0,
  color: RED,
});

const commandItemTitle = (T) => ({
  color: T.text,
  fontWeight: 950,
  fontSize: 14,
});

const commandItemHint = (T) => ({
  color: T.sub,
  fontWeight: 700,
  fontSize: 12,
  marginTop: 3,
});

const commandMeta = (T) => ({
  color: T.sub,
  fontWeight: 900,
  fontSize: 11,
  whiteSpace: "nowrap",
});

const commandEmpty = (T) => ({
  padding: 18,
  textAlign: "center",
  color: T.sub,
  fontWeight: 900,
});

const sidebar = (T, { compactRail, mobileOpen, isMobile, width }) => ({
  background: T.sideBg,
  border: `1px solid ${T.sideBorder}`,
  borderRadius: isMobile ? 0 : 24,
  padding: compactRail ? 8 : 14,
  boxShadow: T.shadow,
  backdropFilter: "blur(16px)",
  display: "flex",
  flexDirection: "column",
  gap: compactRail ? 8 : 12,

  minHeight: isMobile ? "100dvh" : "calc(100vh - 36px)",
  height: isMobile ? "100dvh" : "calc(100vh - 36px)",
  maxHeight: isMobile ? "100dvh" : "calc(100vh - 36px)",

  position: isMobile ? "fixed" : "sticky",
  top: isMobile ? 0 : 18,
  left: isMobile ? 0 : "auto",
  bottom: isMobile ? 0 : "auto",

  width: isMobile ? "min(88vw, 340px)" : width,
  maxWidth: "100%",
  zIndex: isMobile ? 60 : 5,

  transform: isMobile
    ? mobileOpen
      ? "translateX(0)"
      : "translateX(-105%)"
    : "translateX(0)",
  transition: "transform 180ms ease, width 180ms ease, padding 180ms ease",

  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
});

const sidebarTopRow = (compactRail) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: compactRail ? "center" : "space-between",
  gap: 8,
});

const brandBlock = (compactRail) => ({
  display: "flex",
  alignItems: "center",
  gap: compactRail ? 0 : 12,
  justifyContent: compactRail ? "center" : "flex-start",
  minWidth: 0,
  flex: 1,
});

const sidebarControls = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const iconBtn = (T, compactRail) => ({
  width: compactRail ? 32 : 36,
  height: compactRail ? 32 : 36,
  borderRadius: compactRail ? 11 : 12,
  border: `1px solid ${T.btnBorder}`,
  background: T.btnBg,
  color: T.text,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
});

const logoWrap = (T, compactRail) => ({
  width: compactRail ? 50 : 66,
  height: compactRail ? 50 : 66,
  borderRadius: compactRail ? 14 : 18,
  background: T.logoBg,
  border: `1px solid ${T.logoBorder}`,
  boxShadow: "0 10px 24px rgba(17,24,39,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});

const logo = (compactRail) => ({
  height: compactRail ? 34 : 46,
  width: "auto",
  objectFit: "contain",
});

const sideEyebrow = {
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: RED,
};

const sideSub = (T) => ({
  fontSize: 11,
  color: T.sub,
  marginTop: 3,
});

const academyNameText = (T) => ({
  color: T.text,
  fontWeight: 950,
  fontSize: 18,
  lineHeight: 1.05,
  marginTop: 2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const sideInfoWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const sidePill = (T, color) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 999,
  background: T.soft,
  border: `1px solid ${T.sideBorder}`,
  color: color || T.sub,
  fontWeight: 900,
  fontSize: 11,
});

const sectionLabel = (T) => ({
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: T.sub,
  marginTop: 2,
});

const sideNav = (compactRail) => ({
  display: "grid",
  gap: compactRail ? 6 : 8,
});

const sideTabBtn = (active, theme, compact) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: compact ? "center" : "flex-start",
  gap: compact ? 0 : 10,
  width: "100%",
  minHeight: compact ? 44 : 46,
  padding: compact ? "10px 6px" : "11px 13px",
  borderRadius: 12,
  border: active
    ? "1px solid rgba(225,29,46,0.16)"
    : theme === "dark"
      ? "1px solid rgba(148,163,184,0.08)"
      : "1px solid rgba(15,23,42,0.05)",
  background: active
    ? "rgba(225,29,46,0.06)"
    : theme === "dark"
      ? "rgba(2,6,23,0.18)"
      : "rgba(255,255,255,0.72)",
  color: active ? RED : theme === "dark" ? "rgba(255,255,255,0.94)" : "#111827",
  fontWeight: 900,
  cursor: "pointer",
  textAlign: "left",
  boxShadow: "none",
  transition: "all 160ms ease",
  position: "relative",
});

const sideTabIconWrap = (active, compact) => ({
  width: compact ? 28 : 30,
  height: compact ? 28 : 30,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: active ? "rgba(225,29,46,0.10)" : "transparent",
  flexShrink: 0,
});

const miniStatsGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const miniStatCard = (T) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: 10,
  borderRadius: 14,
  background: T.soft,
  border: `1px solid ${T.sideBorder}`,
});

const miniStatIcon = (T) => ({
  width: 32,
  height: 32,
  borderRadius: 10,
  background: T.btnBg,
  border: `1px solid ${T.btnBorder}`,
  display: "grid",
  placeItems: "center",
  color: RED,
  flexShrink: 0,
});

const quickSideActions = {
  display: "grid",
  gap: 8,
};

const collapsedQuickStats = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 6,
};

const sideActionBtn = (T, compact) => ({
  padding: compact ? "10px 6px" : "12px 14px",
  borderRadius: compact ? 12 : 14,
  border: `1px solid ${T.btnBorder}`,
  background: T.btnBg,
  color: T.text,
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: compact ? 40 : 44,
});

const sideLogoutBtn = (T, compact) => ({
  padding: compact ? "10px 6px" : "12px 14px",
  borderRadius: compact ? 12 : 14,
  border: `1px solid rgba(225,29,46,0.18)`,
  background:
    "linear-gradient(135deg, rgba(225,29,46,0.10), rgba(225,29,46,0.04))",
  color: T.text,
  fontWeight: 900,
  cursor: "pointer",
  minHeight: compact ? 40 : 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
});

const mainWrap = (compactRail) => ({
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: compactRail ? 12 : 14,
  transition: "all 180ms ease",
});

const mobileBar = (T) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  background: T.mainCard,
  border: `1px solid ${T.mainBorder}`,
  borderRadius: 18,
  padding: 10,
  boxShadow: T.shadow,
});

const mobileMenuBtn = (T) => ({
  width: 42,
  height: 42,
  borderRadius: 14,
  border: `1px solid ${T.btnBorder}`,
  background: T.btnBg,
  color: T.text,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
});

const mobileBarTitle = (T) => ({
  flex: 1,
  textAlign: "center",
  fontSize: 16,
  fontWeight: 950,
  color: T.text,
});

const mainTop = (T, compactRail) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
  background: T.mainCard,
  border: `1px solid ${T.mainBorder}`,
  borderRadius: compactRail ? 22 : 24,
  padding: compactRail ? "15px 16px" : "16px 18px",
  boxShadow: T.shadow,
  backdropFilter: "blur(16px)",
  transition: "all 180ms ease",
});

const mainEyebrow = {
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: RED,
};

const mainTitle = (T) => ({
  fontSize: 24,
  fontWeight: 950,
  color: T.text,
  lineHeight: 1.06,
  marginTop: 4,
});

const mainSub = (T) => ({
  marginTop: 6,
  fontSize: 12,
  color: T.sub,
  maxWidth: 760,
  lineHeight: 1.5,
});

const statusStripWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const statusStrip = (T, color) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 999,
  background: T.soft,
  border: `1px solid ${T.btnBorder}`,
  color: color || T.sub,
  fontWeight: 900,
  fontSize: 11,
});

const mainTopActions = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
};

const searchWrap = (T) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 12px",
  borderRadius: 14,
  border: `1px solid ${T.inputBorder}`,
  background: T.inputBg,
  minWidth: 280,
  maxWidth: "100%",
  backdropFilter: "blur(10px)",
});

const searchLeading = (T) => ({
  width: 18,
  height: 18,
  color: T.sub,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
});

const searchInput = (T) => ({
  border: "none",
  outline: "none",
  background: "transparent",
  color: T.text,
  fontWeight: 800,
  width: "min(230px, 42vw)",
  fontSize: 13,
});

const searchHint = (T) => ({
  fontSize: 11,
  fontWeight: 900,
  color: T.sub,
  padding: "4px 8px",
  borderRadius: 8,
  border: `1px solid ${T.btnBorder}`,
  background: T.soft,
  whiteSpace: "nowrap",
});

const clearBtn = (T) => ({
  width: 28,
  height: 28,
  border: `1px solid ${T.btnBorder}`,
  background: "transparent",
  color: T.text,
  borderRadius: 10,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
});

const topQuickBtn = (T) => ({
  padding: "9px 13px",
  borderRadius: 14,
  border: `1px solid ${T.btnBorder}`,
  background: T.btnBg,
  color: T.text,
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 42,
});

const smallBadge = (theme) => ({
  minWidth: 20,
  height: 20,
  padding: "0 6px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 950,
  color: RED,
  background:
    theme === "dark" ? "rgba(225,29,46,0.16)" : "rgba(255,241,242,0.98)",
  border: "1px solid rgba(225,29,46,0.22)",
});

const heroStatsGrid = (compactRail) => ({
  display: "grid",
  gridTemplateColumns: compactRail
    ? "repeat(auto-fit, minmax(220px, 1fr))"
    : "repeat(auto-fit, minmax(250px, 1fr))",
  gap: compactRail ? 14 : 16,
  transition: "all 180ms ease",
});

const overviewGrid = (compactRail) => ({
  display: "grid",
  gridTemplateColumns: compactRail
    ? "repeat(auto-fit, minmax(220px, 1fr))"
    : "repeat(auto-fit, minmax(250px, 1fr))",
  gap: compactRail ? 14 : 16,
});

const bigStatCard = (T, theme) => ({
  background:
    theme === "dark" ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.98)",
  border: `1px solid ${
    theme === "dark" ? "rgba(148,163,184,0.14)" : "rgba(226,232,240,0.95)"
  }`,
  borderRadius: 18,
  padding: "18px 20px",
  minHeight: 124,
  width: "100%",
  boxShadow:
    theme === "dark"
      ? "0 8px 22px rgba(0,0,0,0.22)"
      : "0 6px 18px rgba(15,23,42,0.04)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  transition: "all 180ms ease",
});

const bigStatTop = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const bigStatIcon = (T, theme) => ({
  width: 70,
  height: 70,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  color: RED,
  background:
    theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.03)",
  border: `1px solid ${
    theme === "dark" ? "rgba(148,163,184,0.14)" : "rgba(15,23,42,0.08)"
  }`,
  flexShrink: 0,
});

const bigStatLabel = (T) => ({
  fontSize: 14,
  fontWeight: 900,
  color: T.sub,
  lineHeight: 1.1,
  marginBottom: 4,
});

const bigStatValue = (T) => ({
  fontSize: 44,
  fontWeight: 950,
  color: T.text,
  lineHeight: 0.95,
  letterSpacing: "-0.04em",
});

const bigStatHint = (T) => ({
  marginTop: 12,
  fontSize: 13,
  color: T.sub,
  fontWeight: 600,
});

const dashboardPanelGrid = (compactRail) => ({
  display: "grid",
  gridTemplateColumns: compactRail ? "1.1fr 0.9fr" : "1.15fr 0.85fr",
  gap: 14,
});

const dashboardBottomGrid = (compactRail) => ({
  display: "grid",
  gridTemplateColumns: compactRail ? "1.1fr 0.9fr" : "1.1fr 0.9fr",
  gap: 14,
});

const quickPanel = (T) => ({
  background: T.mainCard,
  border: `1px solid ${T.mainBorder}`,
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
  minWidth: 0,
});

const quickPanelTitle = (T) => ({
  color: T.text,
  fontWeight: 950,
  fontSize: 16,
});

const quickPanelSub = (T) => ({
  color: T.sub,
  fontWeight: 700,
  fontSize: 12,
  marginTop: 4,
  lineHeight: 1.45,
});

const quickCardsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const quickNavCard = (T, active) => ({
  border: active
    ? "1px solid rgba(225,29,46,0.18)"
    : `1px solid ${T.btnBorder}`,
  background: active
    ? "linear-gradient(135deg, rgba(225,29,46,0.08), rgba(255,255,255,0.06))"
    : T.btnBg,
  borderRadius: 18,
  padding: 14,
  cursor: "pointer",
  textAlign: "left",
  minHeight: 108,
});

const quickNavTop = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const quickNavIconBox = (T) => ({
  width: 38,
  height: 38,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  border: `1px solid ${T.btnBorder}`,
  background: T.soft,
  color: RED,
  flexShrink: 0,
});

const quickNavTitle = (T) => ({
  color: T.text,
  fontWeight: 950,
  fontSize: 14,
});

const quickNavHint = (T) => ({
  color: T.sub,
  fontWeight: 700,
  fontSize: 12,
  marginTop: 10,
  lineHeight: 1.45,
});

const snapshotList = {
  display: "grid",
  gap: 10,
};

const snapshotRow = (T) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 16,
  background: T.soft,
  border: `1px solid ${T.btnBorder}`,
});

const activeSearchBar = (T) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  alignSelf: "flex-start",
  padding: "9px 12px",
  borderRadius: 999,
  background: T.mainCard,
  border: `1px solid ${T.mainBorder}`,
  color: T.text,
  fontSize: 12,
  fontWeight: 800,
  boxShadow: T.shadow,
  flexWrap: "wrap",
  maxWidth: "100%",
});

const pillXBtn = (T) => ({
  width: 22,
  height: 22,
  border: "none",
  outline: "none",
  background: "transparent",
  color: T.text,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
});

const contentCard = (T, compactRail) => ({
  background: T.panel,
  border: `1px solid ${T.mainBorder}`,
  borderRadius: compactRail ? 18 : 20,
  padding: compactRail ? 12 : 14,
  boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
  minWidth: 0,
  overflow: "hidden",
  transition: "all 180ms ease",
});

const badgePill = (theme, compact) => ({
  minWidth: compact ? 16 : 24,
  height: compact ? 16 : 20,
  padding: compact ? "0 4px" : "0 8px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: compact ? 9 : 12,
  fontWeight: 950,
  color: RED,
  background:
    theme === "dark" ? "rgba(225,29,46,0.16)" : "rgba(255,241,242,0.98)",
  border: "1px solid rgba(225,29,46,0.22)",
  position: compact ? "absolute" : "static",
  top: compact ? 3 : "auto",
  right: compact ? 3 : "auto",
});

const emptyState = (T) => ({
  minHeight: 160,
  display: "grid",
  placeItems: "center",
  borderRadius: 18,
  border: `1px dashed ${T.btnBorder}`,
  color: T.sub,
  fontWeight: 900,
  background: T.soft,
  textAlign: "center",
  padding: 18,
});

const superAdminAcademyGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const academyQuickCard = (T) => ({
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${T.btnBorder}`,
  background: T.btnBg,
  cursor: "pointer",
  textAlign: "left",
});

const academyQuickIcon = (T) => ({
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: T.soft,
  border: `1px solid ${T.btnBorder}`,
  color: RED,
});
