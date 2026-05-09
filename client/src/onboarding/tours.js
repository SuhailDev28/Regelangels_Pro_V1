// client/src/onboarding/tours.js

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  JUDGE: "JUDGE",
  PARTICIPANT: "PARTICIPANT",
};

export const TOUR_IDS = {
  SUPER_ADMIN_MAIN: "SUPER_ADMIN_MAIN",
  ADMIN_MAIN: "ADMIN_MAIN",
  JUDGE_MAIN: "JUDGE_MAIN",
  PARTICIPANT_MAIN: "PARTICIPANT_MAIN",
};

export const TOUR_CONFIG = {
  [TOUR_IDS.SUPER_ADMIN_MAIN]: {
    role: ROLES.SUPER_ADMIN,
    title: "Super Admin Training",
    description:
      "Learn how to manage academies, analytics, and platform-wide operations.",
    steps: [
      {
        target: '[data-tour="superadmin-academy-switcher"]',
        content:
          "Use this academy switcher to view data for a specific academy or manage the whole platform.",
        route: "/super-admin",
        disableBeacon: true,
      },
      {
        target: '[data-tour="superadmin-kpis"]',
        content:
          "These KPI cards give you a high-level summary of academies, users, events, revenue, and activity.",
        route: "/super-admin",
      },
      {
        target: '[data-tour="superadmin-academies"]',
        content:
          "This section helps you create, edit, activate, or review academies registered in the platform.",
        route: "/super-admin",
      },
      {
        target: '[data-tour="superadmin-finance"]',
        content:
          "Monitor finance and performance trends here across all academies.",
        route: "/super-admin",
      },
      {
        target: '[data-tour="superadmin-settings"]',
        content:
          "Global platform settings, system preferences, and operational controls are managed here.",
        route: "/super-admin",
      },
    ],
  },

  [TOUR_IDS.ADMIN_MAIN]: {
    role: ROLES.ADMIN,
    title: "Admin Training",
    description:
      "Learn how to configure your academy, add participants, assign judges, and run events.",
    steps: [
      {
        target: '[data-tour="admin-dashboard-home"]',
        content:
          "This is your admin workspace. From here you manage setup, participants, judges, events, and results.",
        route: "/admin",
        disableBeacon: true,
      },
      {
        target: '[data-tour="admin-setup-tab"]',
        content:
          "Start with Setup. Create groups and activities before adding participants or launching events.",
        route: "/admin",
      },
      {
        target: '[data-tour="admin-participants-tab"]',
        content:
          "Go here to add participants manually or import them with CSV.",
        route: "/admin",
      },
      {
        target: '[data-tour="admin-events-tab"]',
        content:
          "Create and manage events here. Event status usually moves from Draft to Live to Closed.",
        route: "/admin",
      },
      {
        target: '[data-tour="admin-assignments-tab"]',
        content:
          "Use Assignments to map judges to event groups and activities.",
        route: "/admin",
      },
      {
        target: '[data-tour="admin-awards-tab"]',
        content:
          "Generate certificates, awards, and participant recognition from this section.",
        route: "/admin",
      },
      {
        target: '[data-tour="admin-settings-tab"]',
        content:
          "Use Settings to update theme, branding, login media, and replay this training any time.",
        route: "/admin",
      },
    ],
  },

  [TOUR_IDS.JUDGE_MAIN]: {
    role: ROLES.JUDGE,
    title: "Judge Training",
    description:
      "Learn how to view assignments, score participants, save drafts, and finalize scores.",
    steps: [
      {
        target: '[data-tour="judge-home"]',
        content:
          "This is your judge dashboard. You will see only the events and activities assigned to you.",
        route: "/judge",
        disableBeacon: true,
      },
      {
        target: '[data-tour="judge-assigned-events"]',
        content: "Review your assigned events here before starting scoring.",
        route: "/judge",
      },
      {
        target: '[data-tour="judge-score-entry"]',
        content:
          "Enter scores carefully here. Save lets you continue later, while Finalize locks the score.",
        route: "/judge",
      },
      {
        target: '[data-tour="judge-finalize-action"]',
        content:
          "Only finalize when you are fully sure. Finalized scores should not be changed casually.",
        route: "/judge",
      },
      {
        target: '[data-tour="judge-live-status"]',
        content:
          "This section shows whether your scores are affecting the live leaderboard in real time.",
        route: "/judge",
      },
    ],
  },

  [TOUR_IDS.PARTICIPANT_MAIN]: {
    role: ROLES.PARTICIPANT,
    title: "Participant Training",
    description:
      "Learn how to view your profile, events, results, and certificates.",
    steps: [
      {
        target: '[data-tour="participant-home"]',
        content:
          "This is your participant dashboard where you can track events and performance.",
        route: "/participant",
        disableBeacon: true,
      },
      {
        target: '[data-tour="participant-profile"]',
        content: "Your profile information is shown here.",
        route: "/participant",
      },
      {
        target: '[data-tour="participant-events"]',
        content: "Check the events you are enrolled in from this section.",
        route: "/participant",
      },
      {
        target: '[data-tour="participant-results"]',
        content:
          "See your ranking, score breakdown, and event performance here.",
        route: "/participant",
      },
      {
        target: '[data-tour="participant-certificates"]',
        content: "Download your certificates and awards from this section.",
        route: "/participant",
      },
    ],
  },
};

export function getTourIdForRole(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return TOUR_IDS.SUPER_ADMIN_MAIN;
    case ROLES.ADMIN:
      return TOUR_IDS.ADMIN_MAIN;
    case ROLES.JUDGE:
      return TOUR_IDS.JUDGE_MAIN;
    case ROLES.PARTICIPANT:
      return TOUR_IDS.PARTICIPANT_MAIN;
    default:
      return null;
  }
}
