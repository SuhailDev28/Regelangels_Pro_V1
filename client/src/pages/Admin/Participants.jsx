import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api.js";
import { UI } from "./ui.js";
import {
  getUser,
  isSuperAdmin,
  getEffectiveAcademy,
  getSelectedAcademy,
  setSelectedAcademy,
} from "../../lib/auth.js";

/**
 * Participants.jsx — MULTI ACADEMY / ENTERPRISE / FULL RESPONSIVE
 * ------------------------------------------------------------------
 * ✅ Desktop table
 * ✅ Tablet compact cards
 * ✅ Mobile stacked cards
 * ✅ Multi-academy integration
 * ✅ Super admin academy switcher
 * ✅ Normal admin academy locked to assigned academy
 * ✅ Bulk enroll / bulk remove
 * ✅ CSV import + sample download + report export
 * ✅ Event enrollment modal
 * ✅ Filters sidebar
 * ✅ Portal-safe ComboSelect
 * ✅ Pagination
 * ✅ Confirm modal
 * ✅ Create / Edit / Delete profile / Full delete
 * ✅ Academy-aware requests
 * ✅ Fixed academy empty dropdown issue
 * ✅ Fixed remove enrollment by participant profile id
 * ✅ Professional SVG icon system
 * ✅ Safer academy resolution
 * ✅ Safer age validation
 * ✅ Accurate bulk enroll/remove success tracking
 * ✅ CSV import skips invalid rows
 * ✅ Fixed StyleTag error
 * ✅ Safer parent user reuse logic
 * ✅ Participant email optional
 * ✅ Parent email optional
 * ✅ Internal generated participant emails hidden in UI
 */

const PAGE_SIZE = 10;
const DESKTOP_TABLE_COLS =
  "52px 60px 1.1fr 1.35fr 1.25fr .95fr .8fr 70px 90px 180px 360px";

/* ------------------------------------------------------------------ */
/* SVG ICONS */
/* ------------------------------------------------------------------ */

function SvgIcon({
  children,
  size = 18,
  stroke = "currentColor",
  strokeWidth = 1.85,
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

const IconUsers = (p) => (
  <SvgIcon {...p}>
    <path d="M16.5 19a4.5 4.5 0 0 0-9 0" />
    <circle cx="12" cy="9" r="3.2" />
    <path d="M19.2 19a3.8 3.8 0 0 0-2.9-3.7" />
    <path d="M7.7 15.3A3.8 3.8 0 0 0 4.8 19" />
  </SvgIcon>
);

const IconSearch = (p) => (
  <SvgIcon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </SvgIcon>
);

const IconPlus = (p) => (
  <SvgIcon {...p}>
    <path d="M12 5v14M5 12h14" />
  </SvgIcon>
);

const IconEdit = (p) => (
  <SvgIcon {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
  </SvgIcon>
);

const IconTrash = (p) => (
  <SvgIcon {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </SvgIcon>
);

const IconBan = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5 5l14 14" />
  </SvgIcon>
);

const IconCheckCircle = (p) => (
  <SvgIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.3 2.3L15.8 9.3" />
  </SvgIcon>
);

const IconUpload = (p) => (
  <SvgIcon {...p}>
    <path d="M12 16V6" />
    <path d="m8 10 4-4 4 4" />
    <path d="M4 20h16" />
  </SvgIcon>
);

const IconDownload = (p) => (
  <SvgIcon {...p}>
    <path d="M12 4v10" />
    <path d="m8 11 4 4 4-4" />
    <path d="M4 20h16" />
  </SvgIcon>
);

const IconClose = (p) => (
  <SvgIcon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </SvgIcon>
);

const IconFilter = (p) => (
  <SvgIcon {...p}>
    <path d="M4 6h16" />
    <path d="M7 12h10" />
    <path d="M10 18h4" />
  </SvgIcon>
);

const IconCalendar = (p) => (
  <SvgIcon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M16 3v4M8 3v4M3 9h18" />
  </SvgIcon>
);

const IconBadge = (p) => (
  <SvgIcon {...p}>
    <path d="M12 3l2.4 4.8 5.3.8-3.8 3.7.9 5.2L12 15l-4.8 2.5.9-5.2L4.3 8.6l5.3-.8L12 3Z" />
  </SvgIcon>
);

const IconTicket = (p) => (
  <SvgIcon {...p}>
    <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
    <path d="M9 6v12" />
  </SvgIcon>
);

const IconUserCard = (p) => (
  <SvgIcon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <circle cx="9" cy="11" r="2.2" />
    <path d="M6.4 15a3.4 3.4 0 0 1 5.2 0" />
    <path d="M14 10h4M14 14h3" />
  </SvgIcon>
);

const IconShieldOff = (p) => (
  <SvgIcon {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8.1-7 10-4-1.9-7-5.5-7-10V6l7-3Z" />
    <path d="M5 5l14 14" />
  </SvgIcon>
);

const IconChevronDown = (p) => (
  <SvgIcon {...p}>
    <path d="m6 9 6 6 6-6" />
  </SvgIcon>
);

const IconReset = (p) => (
  <SvgIcon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 3v6h6" />
  </SvgIcon>
);

const IconBuilding = (p) => (
  <SvgIcon {...p}>
    <path d="M4 21h16" />
    <path d="M7 21V6l5-3 5 3v15" />
    <path d="M9 9h.01M9 12h.01M9 15h.01M12 9h.01M12 12h.01M12 15h.01M15 9h.01M15 12h.01M15 15h.01" />
  </SvgIcon>
);

function money(v, currency = "QAR") {
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currency || "QAR").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${String(currency || "QAR").toUpperCase()} ${n.toFixed(2)}`;
  }
}

function formatDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

function getPaymentTone(status) {
  const s = String(status || "PENDING").toUpperCase();
  if (s === "PAID") {
    return {
      bg: "rgba(16,185,129,.12)",
      color: "#047857",
      border: "rgba(16,185,129,.24)",
    };
  }
  if (s === "FAILED") {
    return {
      bg: "rgba(239,68,68,.12)",
      color: "#b91c1c",
      border: "rgba(239,68,68,.24)",
    };
  }
  if (s === "REFUNDED") {
    return {
      bg: "rgba(99,102,241,.12)",
      color: "#4338ca",
      border: "rgba(99,102,241,.24)",
    };
  }
  if (s === "CANCELLED") {
    return {
      bg: "rgba(100,116,139,.12)",
      color: "#334155",
      border: "rgba(100,116,139,.24)",
    };
  }
  return {
    bg: "rgba(245,158,11,.12)",
    color: "#b45309",
    border: "rgba(245,158,11,.24)",
  };
}

function PaymentStatusBadge({ status }) {
  const tone = getPaymentTone(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: "currentColor",
          display: "inline-block",
        }}
      />
      {String(status || "PENDING").toUpperCase()}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* MAIN */
/* ------------------------------------------------------------------ */

export default function Participants() {
  const currentUser = useMemo(() => getUser?.() || null, []);
  const superAdmin = useMemo(() => !!isSuperAdmin?.(), []);
  const initialAcademyId = useMemo(() => {
    const selected = getSelectedAcademy?.();
    const effective = getEffectiveAcademy?.();
    return normalizeId(
      selected?._id || selected || effective?._id || effective || "",
    );
  }, []);

  const [academies, setAcademies] = useState([]);
  const [academyId, setAcademyId] = useState(initialAcademyId);

  const [groups, setGroups] = useState([]);
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Participant@12345");
  const [groupId, setGroupId] = useState("");
  const [age, setAge] = useState("");
  const [bibNo, setBibNo] = useState("");
  const [parentEmail, setParentEmail] = useState("");

  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 250);

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [fGroupName, setFGroupName] = useState("");
  const [fLevel, setFLevel] = useState("");
  const [fAge, setFAge] = useState("");
  const [fBib, setFBib] = useState("");

  const [eventId, setEventId] = useState("");
  const [enrolledSet, setEnrolledSet] = useState(new Set());
  const [fEnrolledOnly, setFEnrolledOnly] = useState(false);
  const [eventBusy, setEventBusy] = useState(false);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRow, setAssignRow] = useState(null);
  const [assignEventId, setAssignEventId] = useState("");
  const [assignEnrolled, setAssignEnrolled] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editGroupId, setEditGroupId] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editBibNo, setEditBibNo] = useState("");
  const [editParentEmail, setEditParentEmail] = useState("");

  const [confirmBox, setConfirmBox] = useState(null);
  const [paymentsMap, setPaymentsMap] = useState({});
  const [paymentBusyId, setPaymentBusyId] = useState("");

  const fileRef = useRef(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importReport, setImportReport] = useState([]);
  const [defaultCsvPassword, setDefaultCsvPassword] =
    useState("Participant@12345");

  function getEnrollmentParticipantId(x) {
    if (typeof x?.participantId === "string")
      return normalizeId(x.participantId);
    if (x?.participantId?._id) return normalizeId(x.participantId._id);
    if (typeof x?.participantProfileId === "string")
      return normalizeId(x.participantProfileId);
    if (x?.participant?._id) return normalizeId(x.participant._id);
    if (x?.participantProfile?._id)
      return normalizeId(x.participantProfile._id);
    return "";
  }

  function getPaymentForParticipant(participantId) {
    return paymentsMap[normalizeId(participantId)] || null;
  }

  async function loadPaymentsForEvent(currentEventId) {
    if (!currentEventId || !api.adminPayments) {
      setPaymentsMap({});
      return;
    }

    try {
      const listRaw = await api.adminPayments(
        { eventId: currentEventId, limit: 500 },
        academyId ? { academyId } : undefined,
      );

      const list = Array.isArray(listRaw)
        ? listRaw
        : Array.isArray(listRaw?.items)
          ? listRaw.items
          : Array.isArray(listRaw?.rows)
            ? listRaw.rows
            : [];

      const map = {};

      for (const p of list) {
        const participantKey = normalizeId(
          p?.participantId?.id ||
            p?.participantId?._id ||
            p?.participantId ||
            "",
        );
        if (!participantKey) continue;

        const prev = map[participantKey];
        if (!prev) {
          map[participantKey] = p;
          continue;
        }

        const prevUpdated = new Date(
          prev.updatedAt || prev.createdAt || 0,
        ).getTime();
        const nextUpdated = new Date(p.updatedAt || p.createdAt || 0).getTime();

        if (nextUpdated >= prevUpdated) {
          map[participantKey] = p;
        }
      }

      setPaymentsMap(map);
    } catch {
      setPaymentsMap({});
    }
  }

  const selectedEventDoc = useMemo(() => {
    if (!eventId) return null;
    return (
      (events || []).find((e) => normalizeId(e._id) === normalizeId(eventId)) ||
      null
    );
  }, [events, eventId]);

  async function markParticipantPaid(participantRow) {
    const participantId = normalizeId(participantRow?._id);
    if (!participantId || !eventId) return;

    const existing =
      getPaymentForParticipant(participantId) || participantRow?.payment;
    const eventFee = Number(selectedEventDoc?.registrationFee || 0);

    try {
      setPaymentBusyId(participantId);
      setErr("");
      setMsg("");

      if (existing?._id || existing?.id) {
        await api.updatePaymentStatus(
          existing._id || existing.id,
          {
            paymentStatus: "PAID",
            paidAt: new Date().toISOString(),
          },
          academyId ? { academyId } : undefined,
        );
      } else {
        await api.createPayment(
          {
            participantId,
            userId:
              participantRow?.userId?._id ||
              participantRow?.userId?.id ||
              undefined,
            eventId,
            amount: eventFee,
            currency: "QAR",
            paymentMethod: "CASH",
            paymentStatus: "PAID",
            paidAt: new Date().toISOString(),
            notes: "Created from Participants quick payment action",
          },
          academyId ? { academyId } : undefined,
        );
      }

      await loadPaymentsForEvent(eventId);
      setMsg("Payment marked as paid.");
    } catch (e) {
      setErr(e?.message || "Failed to update payment");
    } finally {
      setPaymentBusyId("");
    }
  }

  const academyOptions = useMemo(() => {
    const list = Array.isArray(academies) ? academies : [];
    return list
      .map((a) => ({
        value: normalizeId(a?._id || a?.id || ""),
        label:
          a?.name || a?.academyName || a?.title || a?.code || "Unnamed Academy",
      }))
      .filter((x) => x.value && x.label);
  }, [academies]);

  const selectedAcademyName = useMemo(() => {
    if (!academyId) return "";
    return (
      academyOptions.find((x) => x.value === academyId)?.label ||
      currentUser?.academyName ||
      currentUser?.academy?.name ||
      "Selected Academy"
    );
  }, [academyOptions, academyId, currentUser]);

  async function loadUsersForAcademy(scopeAcademyId) {
    const params = scopeAcademyId ? { academyId: scopeAcademyId } : {};

    if (typeof api.users === "function") {
      const raw = await api.users(params);
      return Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.rows)
            ? raw.rows
            : [];
    }

    throw new Error("Users API is not available");
  }

  async function resolveOrCreateParentUserId(
    cleanParentEmail,
    participantName = "",
  ) {
    if (!cleanParentEmail) return null;

    const finalAcademyId = normalizeAcademyValue(academyId);
    let resolvedParentUserId = null;

    try {
      const existingParent = await api.findUserByEmail?.(cleanParentEmail, {
        academyId: finalAcademyId,
        role: "PARENT",
      });
      resolvedParentUserId = pickParentUserIdFromApiResponse(existingParent);
      if (resolvedParentUserId) return resolvedParentUserId;
    } catch {
      // ignore
    }

    try {
      const users = await loadUsersForAcademy(finalAcademyId);
      const loadedMatch = findUserByEmailFromLoadedRows(
        users,
        cleanParentEmail,
      );
      resolvedParentUserId = pickParentUserIdFromApiResponse(loadedMatch);
      if (resolvedParentUserId) return resolvedParentUserId;
    } catch {
      // ignore
    }

    const parentTempPassword =
      import.meta.env.VITE_DEFAULT_PARENT_PASS || "Parent@12345";

    const parentUser = await api.createUser({
      name: cleanParentEmail.split("@")[0] || "Parent",
      email: cleanParentEmail,
      password: parentTempPassword,
      role: "PARENT",
      academyId: finalAcademyId,
      sendWelcomeEmail: true,
      mustChangePassword: true,
      welcomeMeta: {
        loginEmail: cleanParentEmail,
        temporaryPassword: parentTempPassword,
        parentEmail: cleanParentEmail,
        linkedParticipant: participantName || "",
      },
    });

    resolvedParentUserId = pickParentUserIdFromApiResponse(parentUser);
    if (!resolvedParentUserId) {
      throw new Error("Parent user created but missing id in response");
    }

    return resolvedParentUserId;
  }

  async function load(targetAcademyId) {
    setLoading(true);
    setErr("");

    try {
      let academyList = [];

      if (api.academies) {
        try {
          const loadedAcademies = await api.academies();
          academyList = Array.isArray(loadedAcademies)
            ? loadedAcademies
            : loadedAcademies
              ? [loadedAcademies]
              : [];
        } catch {
          academyList = [];
        }
      }

      let resolvedAcademyId = normalizeId(
        targetAcademyId ||
          academyId ||
          getSelectedAcademy?.()?._id ||
          getSelectedAcademy?.() ||
          getEffectiveAcademy?.()?._id ||
          getEffectiveAcademy?.() ||
          currentUser?.academyId?._id ||
          currentUser?.academyId ||
          currentUser?.academy?._id ||
          currentUser?.academy ||
          "",
      );

      if (!superAdmin) {
        if (!academyList.length && resolvedAcademyId) {
          academyList = [
            {
              _id: resolvedAcademyId,
              name:
                currentUser?.academyName ||
                currentUser?.academy?.name ||
                "Assigned Academy",
            },
          ];
        }
      } else if (!resolvedAcademyId && academyList?.[0]) {
        resolvedAcademyId = normalizeId(
          academyList[0]?._id || academyList[0]?.id || "",
        );
      }

      setAcademies(academyList);

      if (resolvedAcademyId && resolvedAcademyId !== academyId) {
        setAcademyId(resolvedAcademyId);

        if (superAdmin && setSelectedAcademy) {
          const selectedAcademyObj =
            academyList.find(
              (x) =>
                normalizeId(x?._id || x?.id || "") ===
                normalizeId(resolvedAcademyId),
            ) || resolvedAcademyId;
          setSelectedAcademy(selectedAcademyObj);
        }
      }

      const academyPayload = resolvedAcademyId
        ? { academyId: resolvedAcademyId }
        : {};

      const participantPayload =
        resolvedAcademyId || eventId
          ? {
              ...(resolvedAcademyId ? { academyId: resolvedAcademyId } : {}),
              ...(eventId ? { eventId } : {}),
            }
          : {};

      const [gs, ps, evs] = await Promise.all([
        api.groups ? api.groups(academyPayload) : Promise.resolve([]),
        api.participants
          ? api.participants(participantPayload)
          : Promise.resolve([]),
        api.events ? api.events(academyPayload) : Promise.resolve([]),
      ]);

      const groupsSafe = Array.isArray(gs)
        ? gs
        : Array.isArray(gs?.items)
          ? gs.items
          : Array.isArray(gs?.rows)
            ? gs.rows
            : [];

      const participantsSafe = Array.isArray(ps)
        ? ps
        : Array.isArray(ps?.items)
          ? ps.items
          : Array.isArray(ps?.rows)
            ? ps.rows
            : [];

      const eventsSafe = Array.isArray(evs)
        ? evs
        : Array.isArray(evs?.items)
          ? evs.items
          : Array.isArray(evs?.rows)
            ? evs.rows
            : [];

      setGroups(groupsSafe);
      setRows(participantsSafe);
      setEvents(eventsSafe);

      const initialPaymentMap = {};
      for (const row of participantsSafe) {
        if (row?.payment) {
          initialPaymentMap[normalizeId(row._id)] = row.payment;
        }
      }
      setPaymentsMap(initialPaymentMap);

      const validGroupIds = new Set(groupsSafe.map((g) => normalizeId(g?._id)));
      const validEventIds = new Set(eventsSafe.map((e) => normalizeId(e?._id)));

      setGroupId((prev) => {
        if (prev && validGroupIds.has(normalizeId(prev))) return prev;
        return groupsSafe?.[0]?._id || "";
      });

      setEventId((prev) => {
        if (prev && validEventIds.has(normalizeId(prev))) return prev;
        return eventsSafe?.[0]?._id || "";
      });

      setAssignEventId((prev) => {
        if (prev && validEventIds.has(normalizeId(prev))) return prev;
        return eventsSafe?.[0]?._id || "";
      });
    } catch (e) {
      setErr(e?.message || "Failed to load participants");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(academyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!eventId || !api.eventEnrollments) {
          if (alive) {
            setEnrolledSet(new Set());
            setPaymentsMap({});
          }
          return;
        }

        const listRaw = await api.eventEnrollments(
          eventId,
          academyId ? { academyId } : undefined,
        );

        const list = Array.isArray(listRaw)
          ? listRaw
          : Array.isArray(listRaw?.items)
            ? listRaw.items
            : Array.isArray(listRaw?.rows)
              ? listRaw.rows
              : [];

        const ids = new Set(
          list.map(getEnrollmentParticipantId).filter(Boolean).map(normalizeId),
        );

        if (alive) setEnrolledSet(ids);

        await loadPaymentsForEvent(eventId);
      } catch {
        if (alive) {
          setEnrolledSet(new Set());
          setPaymentsMap({});
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [eventId, academyId]);

  useEffect(() => {
    clearSelection();
    setPage(1);
    setAssignOpen(false);
    setEditOpen(false);
    setImportOpen(false);
    setEnrolledSet(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academyId]);

  function toggleSelected(id) {
    const normalized = normalizeId(id);
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(normalized)) n.delete(normalized);
      else n.add(normalized);
      return n;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function runBatched(items, batchSize, worker) {
    const out = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      const res = await Promise.allSettled(chunk.map(worker));
      out.push(...res);
    }
    return out;
  }

  const levels = useMemo(() => {
    const set = new Set();
    (groups || []).forEach((g) => {
      const lv = String(g.level || "").trim();
      if (lv) set.add(lv);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [groups]);

  const groupOptionsFull = useMemo(() => {
    return (groups || [])
      .map((g) => {
        const n = String(g.name || "").trim();
        const lv = String(g.level || "").trim();
        const academyName = getAcademyNameFromEntity(g, academies);
        return {
          value: g._id,
          label: `${n}${lv ? ` (${lv})` : ""}${superAdmin && academyName ? ` · ${academyName}` : ""}`,
          name: n,
          level: lv,
        };
      })
      .sort((a, b) => (a.name + a.level).localeCompare(b.name + b.level));
  }, [groups, academies, superAdmin]);

  const groupNameOptionsUnique = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const g of groups || []) {
      const nm = String(g.name || "").trim();
      if (!nm) continue;
      const key = nm.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ value: key, label: nm });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [groups]);

  const selectedEventName = useMemo(() => {
    if (!eventId) return "";
    return (
      (events || []).find((e) => normalizeId(e._id) === normalizeId(eventId))
        ?.name || "Selected"
    );
  }, [events, eventId]);

  const assignEventName = useMemo(() => {
    if (!assignEventId) return "";
    return (
      (events || []).find(
        (e) => normalizeId(e._id) === normalizeId(assignEventId),
      )?.name || "Selected"
    );
  }, [events, assignEventId]);

  const filtered = useMemo(() => {
    const s = qDebounced.trim().toLowerCase();
    const levelFilter = String(fLevel || "")
      .trim()
      .toLowerCase();
    const bibFilter = String(fBib || "")
      .trim()
      .toLowerCase();
    const ageFilter = String(fAge || "").trim();
    const groupNameFilter = String(fGroupName || "")
      .trim()
      .toLowerCase();

    return (rows || []).filter((r) => {
      if (academyId && superAdmin) {
        const rowAcademyId = normalizeId(
          r?.academyId?._id ||
            r?.academyId ||
            r?.groupId?.academyId?._id ||
            r?.groupId?.academyId ||
            r?.academy?._id ||
            r?.academy,
        );
        if (rowAcademyId && rowAcademyId !== normalizeId(academyId))
          return false;
      }

      if (s) {
        const n = String(r.userId?.name || "").toLowerCase();
        const em = String(displayParticipantEmail(r)).toLowerCase();
        const pem = String(
          r.parentEmail || r.parentUserId?.email || r.parent?.email || "",
        ).toLowerCase();
        const g = String(r.groupId?.name || "").toLowerCase();
        const lv = String(r.groupId?.level || "").toLowerCase();
        const b = String(r.bibNo || "").toLowerCase();
        const a = String(r.age ?? "").toLowerCase();
        const ac = String(
          getAcademyNameFromEntity(r, academies) || "",
        ).toLowerCase();

        const okSearch = [n, em, pem, g, lv, b, a, ac].some((x) =>
          x.includes(s),
        );

        if (!okSearch) return false;
      }

      if (groupNameFilter) {
        const gname = String(r.groupId?.name || "")
          .trim()
          .toLowerCase();
        if (gname !== groupNameFilter) return false;
      }

      if (levelFilter) {
        const lv = String(r.groupId?.level || "")
          .trim()
          .toLowerCase();
        if (lv !== levelFilter) return false;
      }

      if (ageFilter !== "") {
        const ageNum = Number(ageFilter);
        if (Number.isNaN(ageNum)) return false;
        const rowAge =
          r.age === undefined || r.age === null ? null : Number(r.age);
        if (rowAge !== ageNum) return false;
      }

      if (bibFilter) {
        const b = String(r.bibNo || "").toLowerCase();
        if (!b.includes(bibFilter)) return false;
      }

      if (fEnrolledOnly) {
        if (!eventId) return false;
        if (!enrolledSet.has(normalizeId(r._id))) return false;
      }

      return true;
    });
  }, [
    rows,
    qDebounced,
    fGroupName,
    fLevel,
    fAge,
    fBib,
    fEnrolledOnly,
    eventId,
    enrolledSet,
    academyId,
    academies,
    superAdmin,
  ]);

  const filteredIds = useMemo(
    () => (filtered || []).map((r) => normalizeId(r._id)),
    [filtered],
  );

  const allFilteredSelected = useMemo(() => {
    if (!filteredIds.length) return false;
    for (const id of filteredIds) if (!selectedIds.has(id)) return false;
    return true;
  }, [filteredIds, selectedIds]);

  function toggleSelectAllFiltered() {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      const all = allFilteredSelected;
      if (all) {
        for (const id of filteredIds) n.delete(id);
      } else {
        for (const id of filteredIds) n.add(id);
      }
      return n;
    });
  }

  useEffect(() => {
    clearSelection();
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, fGroupName, fLevel, fAge, fBib, qDebounced, fEnrolledOnly]);

  function clearFilters() {
    setFGroupName("");
    setFLevel("");
    setFAge("");
    setFBib("");
    setFEnrolledOnly(false);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function createParticipant() {
    setMsg("");
    setErr("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanParentEmail = parentEmail.trim().toLowerCase();
    const parsedAge = toOptionalAge(age);

    if (!academyId) return setErr("Please select an academy");
    if (!cleanName) return setErr("Name is required");

    // ✅ Participant email is optional.
    // Backend User model usually still requires email, so we generate an internal one below.
    if (cleanEmail && !isEmail(cleanEmail)) {
      return setErr("Please enter a valid participant email");
    }

    // ✅ Parent email is optional.
    if (cleanParentEmail && !isEmail(cleanParentEmail)) {
      return setErr("Please enter a valid parent email");
    }

    if (!password || password.length < 6) {
      return setErr("Password must be at least 6 characters");
    }
    if (!groupId) return setErr("Please select a group");
    if (age !== "" && parsedAge === undefined) {
      return setErr("Age must be a valid number");
    }

    try {
      setBusy(true);

      const finalAcademyId = normalizeAcademyValue(academyId);
      const finalParticipantEmail =
        cleanEmail || makeInternalParticipantEmail(cleanName);

      const u = await api.createUser({
        name: cleanName,
        email: finalParticipantEmail,
        password,
        role: "PARTICIPANT",
        academyId: finalAcademyId,
        sendWelcomeEmail: !!cleanEmail,
        mustChangePassword: true,
        welcomeMeta: {
          loginEmail: cleanEmail || "",
          temporaryPassword: password,
          linkedParticipant: cleanName,
          parentEmail: cleanParentEmail || "",
          generatedEmail: cleanEmail ? false : true,
          internalEmail: cleanEmail ? "" : finalParticipantEmail,
        },
      });

      const userId = u?.id || u?._id || u?.user?._id;
      if (!userId) throw new Error("User created but missing id in response");

      const resolvedParentUserId = cleanParentEmail
        ? await resolveOrCreateParentUserId(cleanParentEmail, cleanName)
        : null;

      await api.createParticipantProfile({
        userId,
        groupId,
        academyId: finalAcademyId,
        age: parsedAge,
        bibNo: (bibNo || "").trim(),
        parentUserId: resolvedParentUserId || null,
        parentEmail: cleanParentEmail || "",
        participantEmail: cleanEmail || "",
        internalEmail: cleanEmail ? "" : finalParticipantEmail,
        emailGenerated: cleanEmail ? false : true,
      });

      setName("");
      setEmail("");
      setAge("");
      setBibNo("");
      setParentEmail("");
      setPassword("Participant@12345");

      setMsg("Participant created successfully.");
      await load(academyId);
    } catch (e) {
      setErr(e?.message || "Failed to create participant");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(r) {
    if (!r) return;
    setEditRow(r);
    setEditGroupId(r.groupId?._id || "");
    setEditAge(r.age ?? "");
    setEditBibNo(r.bibNo ?? "");
    setEditParentEmail(
      r.parentEmail || r.parentUserId?.email || r.parent?.email || "",
    );
    setEditOpen(true);
    setMsg("");
    setErr("");
  }

  async function saveEdit() {
    if (!editRow?._id) return;
    if (!editGroupId) return setErr("Group is required");
    if (!academyId) return setErr("Academy is required");

    const parsedAge = toOptionalAge(editAge);
    const cleanParentEmail = String(editParentEmail || "")
      .trim()
      .toLowerCase();

    if (editAge !== "" && parsedAge === undefined) {
      return setErr("Age must be a valid number");
    }

    if (cleanParentEmail && !isEmail(cleanParentEmail)) {
      return setErr("Please enter a valid parent email");
    }

    try {
      setBusy(true);
      setErr("");

      const resolvedParentUserId = cleanParentEmail
        ? await resolveOrCreateParentUserId(
            cleanParentEmail,
            editRow?.userId?.name || "",
          )
        : null;

      await api.updateParticipantProfile(editRow._id, {
        academyId,
        groupId: editGroupId,
        age: parsedAge,
        bibNo: (editBibNo || "").trim(),
        parentUserId: resolvedParentUserId || null,
        parentEmail: cleanParentEmail || "",
      });

      setEditOpen(false);
      setEditRow(null);
      setEditParentEmail("");
      setMsg("Participant updated successfully.");
      await load(academyId);
    } catch (e) {
      setErr(e?.message || "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function enrollToEvent(r) {
    if (!eventId) return setErr("Please select an event");
    if (!r?._id) return;

    try {
      setEventBusy(true);
      setErr("");
      await api.enrollParticipant(
        eventId,
        r._id,
        academyId ? { academyId } : undefined,
      );
      setEnrolledSet((prev) => {
        const n = new Set(prev);
        n.add(normalizeId(r._id));
        return n;
      });
      setMsg("Participant enrolled successfully.");
    } catch (e) {
      setErr(e?.message || "Failed to enroll");
    } finally {
      setEventBusy(false);
    }
  }

  async function removeFromEvent(r) {
    if (!eventId) return setErr("Please select an event");
    if (!r?._id) return;

    try {
      setEventBusy(true);
      setErr("");
      if (api.removeEnrollmentByParticipant) {
        await api.removeEnrollmentByParticipant(
          eventId,
          r._id,
          academyId ? { academyId } : undefined,
        );
      } else {
        await api.removeEnrollment(
          eventId,
          r._id,
          academyId ? { academyId } : undefined,
        );
      }
      setEnrolledSet((prev) => {
        const n = new Set(prev);
        n.delete(normalizeId(r._id));
        return n;
      });
      setMsg("Participant removed from event.");
    } catch (e) {
      setErr(e?.message || "Failed to remove from event");
    } finally {
      setEventBusy(false);
    }
  }

  async function bulkEnrollSelected() {
    if (!eventId) return setErr("Please select an event");
    const ids = Array.from(selectedIds);
    if (!ids.length) return setErr("No participants selected");

    setConfirmBox({
      title: `Enroll ${ids.length} participant(s) to "${selectedEventName}"?`,
      body: "This will enroll all selected participants to the selected event.",
      yesText: "Enroll Selected",
      tone: "warn",
      onYes: async () => {
        try {
          setEventBusy(true);
          setErr("");
          setMsg("");

          const results = await runBatched(ids, 10, (pid) =>
            api.enrollParticipant(
              eventId,
              pid,
              academyId ? { academyId } : undefined,
            ),
          );

          let ok = 0;
          let fail = 0;
          const successIds = [];

          results.forEach((r, i) => {
            if (r.status === "fulfilled") {
              ok++;
              successIds.push(ids[i]);
            } else {
              fail++;
            }
          });

          setEnrolledSet((prev) => {
            const n = new Set(prev);
            successIds.forEach((id) => n.add(normalizeId(id)));
            return n;
          });

          setMsg(`Bulk enroll completed. Success: ${ok}, Failed: ${fail}`);
        } catch (e) {
          setErr(e?.message || "Bulk enroll failed");
        } finally {
          setEventBusy(false);
        }
      },
    });
  }

  async function bulkRemoveSelected() {
    if (!eventId) return setErr("Please select an event");
    const ids = Array.from(selectedIds);
    if (!ids.length) return setErr("No participants selected");

    setConfirmBox({
      title: `Remove ${ids.length} participant(s) from "${selectedEventName}"?`,
      body: "This will remove enrollments for all selected participants from the selected event.",
      yesText: "Remove Selected",
      tone: "danger",
      onYes: async () => {
        try {
          setEventBusy(true);
          setErr("");
          setMsg("");

          const remover = api.removeEnrollmentByParticipant
            ? (pid) =>
                api.removeEnrollmentByParticipant(
                  eventId,
                  pid,
                  academyId ? { academyId } : undefined,
                )
            : (pid) =>
                api.removeEnrollment(
                  eventId,
                  pid,
                  academyId ? { academyId } : undefined,
                );

          const results = await runBatched(ids, 10, remover);

          let ok = 0;
          let fail = 0;
          const successIds = [];

          results.forEach((r, i) => {
            if (r.status === "fulfilled") {
              ok++;
              successIds.push(ids[i]);
            } else {
              fail++;
            }
          });

          setEnrolledSet((prev) => {
            const n = new Set(prev);
            successIds.forEach((id) => n.delete(normalizeId(id)));
            return n;
          });

          if (fEnrolledOnly) clearSelection();
          setMsg(`Bulk remove completed. Success: ${ok}, Failed: ${fail}`);
        } catch (e) {
          setErr(e?.message || "Bulk remove failed");
        } finally {
          setEventBusy(false);
        }
      },
    });
  }

  async function openAssignEnrollment(r) {
    if (!r?._id) return;
    setErr("");
    setMsg("");

    setAssignRow(r);
    const preferred = eventId || assignEventId || events?.[0]?._id || "";
    setAssignEventId(preferred);
    setAssignEnrolled(false);
    setAssignOpen(true);
  }

  async function refreshAssignStatus(pickedEventId, participantProfileId) {
    if (!pickedEventId || !participantProfileId || !api.eventEnrollments) {
      setAssignEnrolled(false);
      return;
    }

    try {
      setAssignBusy(true);
      const listRaw = await api.eventEnrollments(
        pickedEventId,
        academyId ? { academyId } : undefined,
      );

      const list = Array.isArray(listRaw)
        ? listRaw
        : Array.isArray(listRaw?.items)
          ? listRaw.items
          : Array.isArray(listRaw?.rows)
            ? listRaw.rows
            : [];

      const ids = new Set(
        list
          .map((x) => {
            if (typeof x?.participantId === "string") return x.participantId;
            if (x?.participantId?._id) return x.participantId._id;
            if (typeof x?.participantProfileId === "string")
              return x.participantProfileId;
            if (x?.participant?._id) return x.participant._id;
            if (x?.participantProfile?._id) return x.participantProfile._id;
            return null;
          })
          .filter(Boolean)
          .map(normalizeId),
      );

      setAssignEnrolled(ids.has(normalizeId(participantProfileId)));
    } catch {
      setAssignEnrolled(false);
    } finally {
      setAssignBusy(false);
    }
  }

  useEffect(() => {
    if (!assignOpen) return;
    refreshAssignStatus(assignEventId, assignRow?._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignOpen, assignEventId, assignRow?._id, academyId]);

  async function assignEnroll() {
    if (!assignRow?._id) return;
    if (!assignEventId) return setErr("Please select an event");

    try {
      setAssignBusy(true);
      setErr("");
      await api.enrollParticipant(
        assignEventId,
        assignRow._id,
        academyId ? { academyId } : undefined,
      );
      setAssignEnrolled(true);
      setMsg(`Participant enrolled to "${assignEventName}".`);

      if (normalizeId(assignEventId) === normalizeId(eventId)) {
        setEnrolledSet((prev) => {
          const n = new Set(prev);
          n.add(normalizeId(assignRow._id));
          return n;
        });
      }
    } catch (e) {
      setErr(e?.message || "Failed to enroll");
    } finally {
      setAssignBusy(false);
    }
  }

  async function assignRemove() {
    if (!assignRow?._id) return;
    if (!assignEventId) return setErr("Please select an event");

    try {
      setAssignBusy(true);
      setErr("");
      if (api.removeEnrollmentByParticipant) {
        await api.removeEnrollmentByParticipant(
          assignEventId,
          assignRow._id,
          academyId ? { academyId } : undefined,
        );
      } else {
        await api.removeEnrollment(
          assignEventId,
          assignRow._id,
          academyId ? { academyId } : undefined,
        );
      }
      setAssignEnrolled(false);
      setMsg(`Participant removed from "${assignEventName}".`);

      if (normalizeId(assignEventId) === normalizeId(eventId)) {
        setEnrolledSet((prev) => {
          const n = new Set(prev);
          n.delete(normalizeId(assignRow._id));
          return n;
        });
      }
    } catch (e) {
      setErr(e?.message || "Failed to remove from event");
    } finally {
      setAssignBusy(false);
    }
  }

  function deleteProfile(r) {
    if (!r?._id) return;

    setConfirmBox({
      title: "Delete participant profile?",
      body: "This deletes only the participant profile. The user account will remain active.",
      yesText: "Delete Profile",
      tone: "warn",
      onYes: async () => {
        try {
          setBusy(true);
          setErr("");
          await api.deleteParticipantProfile(
            r._id,
            academyId ? { academyId } : undefined,
          );
          setMsg("Participant profile deleted successfully.");
          await load(academyId);
        } catch (e) {
          setErr(e?.message || "Failed to delete profile");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function deleteFull(r) {
    if (!r?._id) return;

    setConfirmBox({
      title: "Full delete participant?",
      body: "This will delete the profile and deactivate/delete the user. This cannot be undone.",
      yesText: "Full Delete",
      tone: "danger",
      onYes: async () => {
        try {
          setBusy(true);
          setErr("");
          await api.deleteParticipantFull(
            r._id,
            academyId ? { academyId } : undefined,
          );
          setMsg("Participant fully deleted.");
          await load(academyId);
        } catch (e) {
          setErr(e?.message || "Failed to full delete");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function openImport() {
    setImportRows([]);
    setImportErrors([]);
    setImportReport([]);
    setImportOpen(true);
    setErr("");
    setMsg("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function closeImport() {
    if (importBusy) return;
    setImportOpen(false);
  }

  function findGroupIdByNameAndLevel(groupName, level) {
    const gn = String(groupName || "")
      .trim()
      .toLowerCase();
    const lv = String(level || "")
      .trim()
      .toLowerCase();
    if (!gn) return null;

    const exact = (groups || []).find((g) => {
      const gName = String(g.name || "")
        .trim()
        .toLowerCase();
      const gLevel = String(g.level || "")
        .trim()
        .toLowerCase();
      if (lv) return gName === gn && gLevel === lv;
      return gName === gn;
    });
    if (exact?._id) return exact._id;

    const byName = (groups || []).find(
      (g) =>
        String(g.name || "")
          .trim()
          .toLowerCase() === gn,
    );
    return byName?._id || null;
  }

  function validateImportRows(parsed) {
    const errors = [];
    const seenEmail = new Set();

    parsed.forEach((r, idx) => {
      const line = idx + 2;
      const pname = (r.name || "").trim();
      const pemail = (r.email || "").trim().toLowerCase();
      const parentEmail = (r.parentEmail || "").trim().toLowerCase();
      const group = (r.group || "").trim();
      const level = (r.level || "").trim();

      if (!pname) {
        errors.push({ line, field: "name", message: "Name is required" });
      }

      // ✅ Participant email is optional.
      if (pemail && !isEmail(pemail)) {
        errors.push({
          line,
          field: "email",
          message: "Invalid email format",
        });
      }

      // ✅ Parent email is optional.
      if (parentEmail && !isEmail(parentEmail)) {
        errors.push({
          line,
          field: "parentEmail",
          message: "Invalid parent email format",
        });
      }

      if (pemail) {
        if (seenEmail.has(pemail)) {
          errors.push({
            line,
            field: "email",
            message: "Duplicate email in CSV",
          });
        }
        seenEmail.add(pemail);
      }

      const gid = findGroupIdByNameAndLevel(group, level);
      if (!gid) {
        errors.push({
          line,
          field: "group",
          message: `Group not found: "${group}"${level ? ` (${level})` : ""}`,
        });
      }

      if (
        r.age !== undefined &&
        r.age !== null &&
        String(r.age).trim() !== ""
      ) {
        const n = Number(r.age);
        if (Number.isNaN(n) || n < 0 || n > 99) {
          errors.push({
            line,
            field: "age",
            message: "Age must be a number (0-99)",
          });
        }
      }
    });

    return errors;
  }

  async function onPickCsvFile(file) {
    try {
      setErr("");
      setMsg("");
      setImportReport([]);
      setImportErrors([]);
      setImportRows([]);
      if (!file) return;

      const text = await file.text();
      const parsed = parseCsv(text);

      if (!parsed.length) throw new Error("CSV is empty");

      const rawHeaders = Object.keys(parsed[0]).map((h) =>
        String(h || "")
          .trim()
          .toLowerCase(),
      );

      if (!rawHeaders.includes("name") || !rawHeaders.includes("group")) {
        throw new Error(
          'CSV headers must include: "name,group" (optional: email,parentEmail,level,age,bibNo,password)',
        );
      }

      const normalized = parsed.map((row) => {
        const out = {};
        Object.keys(row).forEach((k) => {
          out[String(k).trim().toLowerCase()] = row[k];
        });
        return {
          name: String(out.name ?? "").trim(),
          email: String(out.email ?? "").trim(),
          parentemail: String(out.parentemail ?? out.parentEmail ?? "").trim(),
          group: String(out.group ?? "").trim(),
          level: String(out.level ?? "").trim(),
          age: out.age ?? "",
          bibno: out.bibno ?? out.bibNo ?? "",
          password: String(out.password ?? "").trim(),
        };
      });

      const finalRows = normalized.map((r) => ({
        name: r.name,
        email: String(r.email || "").toLowerCase(),
        parentEmail: String(r.parentemail || "").toLowerCase(),
        group: r.group,
        level: r.level,
        age: r.age,
        bibNo: String(r.bibno || "").trim(),
        password: r.password || "",
      }));

      const errs = validateImportRows(finalRows);
      setImportRows(finalRows);
      setImportErrors(errs);

      if (errs.length === 0) {
        setMsg(`CSV loaded. Ready to import (${finalRows.length} rows).`);
      } else {
        setErr(
          `CSV has ${errs.length} issue(s). Fix them or proceed (invalid rows will be skipped).`,
        );
      }
    } catch (e) {
      setErr(e?.message || "Failed to parse CSV");
    }
  }

  async function runImport() {
    if (!academyId) return setErr("Please select an academy");
    if (!importRows.length) return setErr("No CSV rows loaded");
    if (!groups.length) return setErr("Groups not loaded yet");

    setImportBusy(true);
    setErr("");
    setMsg("");
    setImportReport([]);

    const invalidLines = new Set(importErrors.map((e) => e.line));
    const report = [];

    for (let i = 0; i < importRows.length; i++) {
      const r = importRows[i];
      const line = i + 2;

      if (invalidLines.has(line)) {
        report.push({
          line,
          name: r.name,
          email: r.email,
          group: r.group,
          level: r.level,
          status: "FAILED",
          message: "Skipped because this row has validation errors",
        });
        continue;
      }

      const gid = findGroupIdByNameAndLevel(r.group, r.level);
      const usePass = (r.password || "").trim() || defaultCsvPassword;
      const cleanParentEmail = String(r.parentEmail || "")
        .trim()
        .toLowerCase();

      try {
        const cleanParticipantEmail = String(r.email || "")
          .trim()
          .toLowerCase();

        const finalParticipantEmail =
          cleanParticipantEmail ||
          makeInternalParticipantEmail(r.name.trim(), line);

        const u = await api.createUser({
          name: r.name.trim(),
          email: finalParticipantEmail,
          password: usePass,
          role: "PARTICIPANT",
          academyId: normalizeAcademyValue(academyId),
          sendWelcomeEmail: !!cleanParticipantEmail,
          mustChangePassword: true,
          welcomeMeta: {
            loginEmail: cleanParticipantEmail || "",
            temporaryPassword: usePass,
            linkedParticipant: r.name.trim(),
            parentEmail: cleanParentEmail || "",
            generatedEmail: cleanParticipantEmail ? false : true,
            internalEmail: cleanParticipantEmail ? "" : finalParticipantEmail,
          },
        });

        const userId = u?.id || u?._id || u?.user?._id;
        if (!userId) throw new Error("User created but missing id");

        const resolvedParentUserId = cleanParentEmail
          ? await resolveOrCreateParentUserId(cleanParentEmail, r.name.trim())
          : null;

        await api.createParticipantProfile({
          userId,
          groupId: gid,
          academyId: normalizeAcademyValue(academyId),
          age: toOptionalAge(r.age),
          bibNo: (r.bibNo || "").trim(),
          parentUserId: resolvedParentUserId || null,
          parentEmail: cleanParentEmail || "",
          participantEmail: cleanParticipantEmail || "",
          internalEmail: cleanParticipantEmail ? "" : finalParticipantEmail,
          emailGenerated: cleanParticipantEmail ? false : true,
        });

        report.push({
          line,
          name: r.name,
          email: cleanParticipantEmail || "",
          group: r.group,
          level: r.level,
          status: "SUCCESS",
          message: cleanParticipantEmail
            ? ""
            : "Created with internal no-email login",
        });
      } catch (e) {
        report.push({
          line,
          name: r.name,
          email: r.email,
          group: r.group,
          level: r.level,
          status: "FAILED",
          message: (e?.message || "Failed").slice(0, 220),
        });
      }

      if ((i + 1) % 3 === 0) setImportReport([...report]);
    }

    setImportReport(report);
    setImportBusy(false);

    const okCount = report.filter((x) => x.status === "SUCCESS").length;
    const failCount = report.length - okCount;

    setMsg(`Import completed. Success: ${okCount}, Failed: ${failCount}`);
    await load(academyId);
  }

  function downloadImportReport() {
    if (!importReport.length) return;
    const csv = toCsv(importReport, [
      "line",
      "name",
      "email",
      "group",
      "level",
      "status",
      "message",
    ]);
    downloadTextFile(
      csv,
      `participants_import_report_${Date.now()}.csv`,
      "text/csv",
    );
  }

  function downloadSampleParticipantsCsv() {
    const sample = [
      {
        name: "Aisha Noor",
        email: "",
        parentEmail: "",
        group: "Group A",
        level: "Beginner",
        age: "8",
        bibNo: "A-101",
        password: "Participant@12345",
      },
      {
        name: "Mariam Ali",
        email: "mariam@example.com",
        parentEmail: "parentb@example.com",
        group: "Group B",
        level: "Intermediate",
        age: "10",
        bibNo: "B-205",
        password: "",
      },
    ];

    const headers = [
      "name",
      "email",
      "parentEmail",
      "group",
      "level",
      "age",
      "bibNo",
      "password",
    ];
    const csv = toCsv(sample, headers);
    downloadTextFile(csv, "participants_sample_import.csv", "text/csv");
  }

  const activeCount = useMemo(
    () => (rows || []).filter((r) => r.userId?.isActive !== false).length,
    [rows],
  );

  const inactiveCount = rows.length - activeCount;

  const chipGroupLabel = useMemo(() => {
    if (!fGroupName) return "";
    return (
      groupNameOptionsUnique.find((x) => x.value === fGroupName)?.label ||
      fGroupName
    );
  }, [fGroupName, groupNameOptionsUnique]);

  function handleAcademyChange(v) {
    if (!superAdmin) return;

    const normalized = normalizeId(v);
    setAcademyId(normalized);
    setGroupId(groups?.[0]?._id || "");
    setEventId("");
    setAssignEventId("");
    setFEnrolledOnly(false);
    clearSelection();

    if (setSelectedAcademy) {
      const picked =
        academies.find((a) => normalizeId(a?._id || a?.id) === normalized) ||
        normalized ||
        null;
      setSelectedAcademy(picked);
    }
  }

  function renderActionButtons(r) {
    const enrolled = !!eventId && enrolledSet.has(normalizeId(r._id));
    const payment = getPaymentForParticipant(r._id);
    const isPaid =
      String(payment?.paymentStatus || "").toUpperCase() === "PAID";
    const payBusy = paymentBusyId === normalizeId(r._id);

    return (
      <>
        <button
          className="raBtnSmall"
          type="button"
          onClick={() => openEdit(r)}
          disabled={busy}
        >
          <IconEdit size={14} />
          Edit
        </button>

        <button
          className="raBtnSmall"
          type="button"
          onClick={() => openAssignEnrollment(r)}
          disabled={assignBusy}
        >
          <IconTicket size={14} />
          Enrollment
        </button>

        {eventId ? (
          enrolled ? (
            <button
              className="raBtnSmallWarn"
              type="button"
              onClick={() => removeFromEvent(r)}
              disabled={eventBusy}
            >
              <IconBan size={14} />
              Remove
            </button>
          ) : (
            <button
              className="raBtnSmallAccent"
              type="button"
              onClick={() => enrollToEvent(r)}
              disabled={eventBusy}
            >
              <IconCheckCircle size={14} />
              Enroll
            </button>
          )
        ) : null}

        {eventId && enrolled && !isPaid ? (
          <button
            className="raBtnSmallAccent"
            type="button"
            onClick={() => markParticipantPaid(r)}
            disabled={payBusy}
          >
            <IconCheckCircle size={14} />
            {payBusy ? "Updating..." : "Mark Paid"}
          </button>
        ) : null}

        <button
          className="raBtnSmallWarn"
          type="button"
          onClick={() => deleteProfile(r)}
          disabled={busy}
        >
          <IconTrash size={14} />
          Profile
        </button>

        <button
          className="raBtnSmallDanger"
          type="button"
          onClick={() => deleteFull(r)}
          disabled={busy}
        >
          <IconShieldOff size={14} />
          Full Delete
        </button>
      </>
    );
  }

  return (
    <section style={UI.wrap}>
      <StyleTag />

      <div className="raTopbar">
        <div>
          <div className="raPageEyebrow">
            <span className="raEyebrowIcon">
              <IconUsers size={12} />
            </span>
            ADMIN PANEL
          </div>
          <h3 style={UI.h3}>Participants Management</h3>
          <div style={UI.sub}>
            Create, filter, enroll and manage participant profiles with
            academy-aware enterprise controls.
          </div>
        </div>

        <div className="raStats">
          <StatCard
            label="Total Participants"
            value={rows.length}
            icon={<IconUsers size={18} />}
          />
          <StatCard
            label="Active"
            value={activeCount}
            tone="live"
            icon={<IconCheckCircle size={18} />}
          />
          <StatCard
            label="Inactive"
            value={inactiveCount}
            tone="closed"
            icon={<IconBan size={18} />}
          />
          <StatCard
            label="Selected"
            value={selectedIds.size}
            tone="draft"
            icon={<IconBadge size={18} />}
          />
        </div>
      </div>

      {err ? <div style={UI.err}>{err}</div> : null}
      {msg ? <div style={UI.ok}>{msg}</div> : null}

      <div className="raAcademyBar">
        <div className="raAcademyBarInfo">
          <span className="raAcademyBadge">
            <IconBuilding size={14} />
            {selectedAcademyName || "No Academy Selected"}
          </span>
          <span className="raMiniText">
            Scope:{" "}
            <b>
              {superAdmin ? "Super Admin / Multi Academy" : "Assigned Academy"}
            </b>
          </span>
          {currentUser?.name ? (
            <span className="raMiniText">
              User: <b>{currentUser.name}</b>
            </span>
          ) : null}
        </div>

        <div className="raAcademySelector">
          <ComboSelect
            label="Academy"
            value={academyId}
            onChange={handleAcademyChange}
            placeholder="Select academy"
            allowClear={false}
            options={academyOptions}
            searchable={superAdmin}
            disabled={!superAdmin}
          />
        </div>
      </div>

      <div className="raLayout">
        <div className="raCard raCard2">
          <div className="raCardTitle">Add Participant</div>
          <div className="raCardSub">
            Creates the <b>User</b> first, then the <b>Participant Profile</b>{" "}
            inside the selected academy. Participant and parent emails are
            optional.
          </div>

          <div className="raGrid2" style={{ marginTop: 14 }}>
            <Field label="Name">
              <input
                className="raInput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Participant name"
              />
            </Field>

            <Field label="Email (optional)">
              <input
                className="raInput"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Leave empty if participant has no email"
              />
            </Field>

            <Field label="Password">
              <input
                className="raInput"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <ComboSelect
              label="Group"
              value={groupId}
              onChange={setGroupId}
              placeholder="Select group"
              allowClear={false}
              options={groupOptionsFull}
            />

            <Field label="Age (optional)">
              <input
                className="raInput"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 9"
                inputMode="numeric"
              />
            </Field>

            <Field label="BIB No (optional)">
              <input
                className="raInput"
                value={bibNo}
                onChange={(e) => setBibNo(e.target.value)}
                placeholder="e.g. A-12"
              />
            </Field>

            <Field label="Parent Email (optional)">
              <input
                className="raInput"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="parent@example.com"
              />
            </Field>
          </div>

          <div className="raFormFooter">
            <button
              className="raBtn"
              type="button"
              onClick={() => {
                setName("");
                setEmail("");
                setAge("");
                setBibNo("");
                setParentEmail("");
                setPassword("Participant@12345");
              }}
              disabled={busy}
            >
              <IconReset size={15} />
              Reset
            </button>

            <button
              className="raBtnPrimary"
              onClick={createParticipant}
              disabled={busy || !academyId}
            >
              <IconPlus size={15} />
              {busy ? "Creating..." : "Create Participant"}
            </button>
          </div>
        </div>

        <div className="raRightCol">
          <div className="raCard raCard2">
            <div className="raCardTopRow">
              <div>
                <div className="raCardTitle">Search & Filters</div>
                <div className="raCardSub">
                  Search by name, email, academy, group, level, BIB or age.
                </div>
              </div>

              <button
                className="raBtn raBtnGhost"
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <IconFilter size={14} />
                {filtersOpen ? "Hide Filters" : "Show Filters"}
              </button>
            </div>

            <div className="raSearchWrap" style={{ marginTop: 12 }}>
              <span className="raSearchIcon">
                <IconSearch size={15} />
              </span>
              <input
                className="raInput raInputSearch"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type to search..."
              />
            </div>

            <div className="raChips">
              {academyId ? (
                <Chip
                  label={`Academy: ${selectedAcademyName}`}
                  onClear={() => {}}
                  noClear
                />
              ) : null}
              {q ? (
                <Chip label={`Search: ${q}`} onClear={() => setQ("")} />
              ) : null}
              {eventId ? (
                <Chip
                  label={`Event: ${selectedEventName}`}
                  onClear={() => {
                    setEventId("");
                    setEnrolledSet(new Set());
                    setFEnrolledOnly(false);
                  }}
                />
              ) : null}
              {fEnrolledOnly ? (
                <Chip
                  label="Enrolled Only"
                  onClear={() => setFEnrolledOnly(false)}
                />
              ) : null}
              {fGroupName ? (
                <Chip
                  label={`Group: ${chipGroupLabel}`}
                  onClear={() => setFGroupName("")}
                />
              ) : null}
              {fLevel ? (
                <Chip
                  label={`Level: ${fLevel}`}
                  onClear={() => setFLevel("")}
                />
              ) : null}
              {fAge ? (
                <Chip label={`Age: ${fAge}`} onClear={() => setFAge("")} />
              ) : null}
              {fBib ? (
                <Chip label={`BIB: ${fBib}`} onClear={() => setFBib("")} />
              ) : null}
            </div>

            {filtersOpen ? (
              <div className="raFilterPanelSidebar" style={{ marginTop: 12 }}>
                <div className="raSidebarTitle">Filters Sidebar</div>

                <div className="raSidebarSection">
                  <ComboSelect
                    label="Event"
                    value={eventId}
                    onChange={(v) => {
                      setEventId(v);
                      setFEnrolledOnly(false);
                    }}
                    placeholder="Select Event"
                    allowClear={true}
                    clearLabel="No Event"
                    options={(events || []).map((ev) => ({
                      value: ev._id,
                      label: ev.name,
                    }))}
                  />
                </div>

                <div className="raSidebarSection">
                  <ComboSelect
                    label="Filter: Group"
                    value={fGroupName}
                    onChange={setFGroupName}
                    placeholder="All Groups"
                    clearLabel="All Groups"
                    options={groupNameOptionsUnique}
                  />
                </div>

                <div className="raSidebarSection">
                  <ComboSelect
                    label="Filter: Level"
                    value={fLevel}
                    onChange={setFLevel}
                    placeholder="All Levels"
                    clearLabel="All Levels"
                    options={levels.map((lv) => ({ value: lv, label: lv }))}
                  />
                </div>

                <div className="raSidebarSection">
                  <Field label="Filter: Age">
                    <input
                      className="raInput"
                      value={fAge}
                      onChange={(e) => setFAge(e.target.value)}
                      placeholder="e.g. 9"
                      inputMode="numeric"
                    />
                  </Field>
                </div>

                <div className="raSidebarSection">
                  <Field label="Filter: BIB No">
                    <input
                      className="raInput"
                      value={fBib}
                      onChange={(e) => setFBib(e.target.value)}
                      placeholder="e.g. A-12"
                    />
                  </Field>
                </div>

                <div className="raSidebarFooter">
                  <div className="raMiniText">
                    Showing <b>{filtered.length}</b> participant(s)
                  </div>

                  <button
                    className="raBtn"
                    type="button"
                    onClick={clearFilters}
                  >
                    <IconReset size={14} />
                    Clear Filters
                  </button>

                  <button
                    className="raBtn"
                    type="button"
                    disabled={!eventId}
                    onClick={() => setFEnrolledOnly((v) => !v)}
                    title={!eventId ? "Select an event first" : ""}
                  >
                    <IconTicket size={14} />
                    {fEnrolledOnly ? "Enrolled Applied" : "Enrolled Only"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="raMiniText" style={{ marginTop: 10 }}>
                Showing <b>{filtered.length}</b> participant(s)
              </div>
            )}
          </div>

          <div className="raCard raCard2">
            <div className="raCardTitle">Bulk & Import</div>
            <div className="raCardSub">
              Manage selection, event enrollment and CSV import inside the
              selected academy.
            </div>

            <div className="raSummaryList" style={{ marginTop: 14 }}>
              <div className="raSummaryItem">
                <span className="raSummaryLeft">
                  <IconBuilding size={14} />
                  Current academy
                </span>
                <b>{selectedAcademyName || "—"}</b>
              </div>
              <div className="raSummaryItem">
                <span className="raSummaryLeft">
                  <IconBadge size={14} />
                  Selected participants
                </span>
                <b>{selectedIds.size}</b>
              </div>
              <div className="raSummaryItem">
                <span className="raSummaryLeft">
                  <IconCalendar size={14} />
                  Current event
                </span>
                <b>{selectedEventName || "—"}</b>
              </div>
              <div className="raSummaryItem">
                <span className="raSummaryLeft">
                  <IconUsers size={14} />
                  Filtered rows
                </span>
                <b>{filtered.length}</b>
              </div>
            </div>

            <div className="raBulkActions">
              <button
                className="raBtn"
                type="button"
                onClick={clearSelection}
                disabled={!selectedIds.size}
              >
                <IconReset size={14} />
                Clear Selection
              </button>

              <button
                className="raBtnSmallAccentWide"
                type="button"
                disabled={!eventId || !selectedIds.size || eventBusy}
                onClick={bulkEnrollSelected}
                title={!eventId ? "Select an event first" : ""}
              >
                <IconCheckCircle size={14} />
                Bulk Enroll
              </button>

              <button
                className="raBtnWarn"
                type="button"
                disabled={!eventId || !selectedIds.size || eventBusy}
                onClick={bulkRemoveSelected}
                title={!eventId ? "Select an event first" : ""}
              >
                <IconBan size={14} />
                Bulk Remove
              </button>

              <button
                className="raBtnPrimary"
                type="button"
                onClick={openImport}
                disabled={!academyId}
              >
                <IconUpload size={14} />
                Import CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="raCard raTableCard" style={{ marginTop: 16 }}>
        <div className="raTableHeadBar">
          <div>
            <div className="raCardTitle">Participants Directory</div>
            <div className="raCardSub">
              Desktop table, tablet compact cards and mobile stacked cards.
            </div>
          </div>

          <div className="raRightMeta">
            <span className="raMiniText">
              Total: <b>{rows.length}</b>
            </span>
            <span className="raMiniText">
              Showing: <b>{filtered.length}</b>
            </span>
            <span className="raMiniText">
              Selected: <b>{selectedIds.size}</b>
            </span>
          </div>
        </div>

        <div className="raTableDesktop">
          <div className="raTableWrap">
            <div className="raTable">
              <div
                className="raThead raStickyHead"
                style={{ gridTemplateColumns: DESKTOP_TABLE_COLS }}
              >
                <div>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    title="Select all (filtered)"
                  />
                </div>
                <div>#</div>
                <div>Participant</div>
                <div>Email</div>
                <div>Parent</div>
                <div>Group</div>
                <div>Level</div>
                <div>Age</div>
                <div>BIB</div>
                <div>Enrollment / Payment</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>

              {paged.map((r, i) => (
                <div
                  key={r._id}
                  className="raTrow raRowHover"
                  style={{ gridTemplateColumns: DESKTOP_TABLE_COLS }}
                >
                  <div>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(normalizeId(r._id))}
                      onChange={() => toggleSelected(r._id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Select participant"
                    />
                  </div>

                  <div style={{ fontWeight: 900 }}>
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </div>

                  <div className="raNameCell">
                    <div className="raParticipantRow">
                      <span className="raPersonIcon">
                        <IconUserCard size={15} />
                      </span>
                      <div className="raMainTitleWrap">
                        <div style={{ fontWeight: 950 }}>
                          {r.userId?.name || "—"}
                        </div>
                        <div
                          className={`raStatus ${
                            r.userId?.isActive === false ? "off" : "on"
                          }`}
                        >
                          {r.userId?.isActive === false ? "Inactive" : "Active"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="raMono" style={{ minWidth: 0 }}>
                    {displayParticipantEmail(r)}
                  </div>

                  <div className="raMono" style={{ minWidth: 0 }}>
                    {r.parentEmail ||
                      r.parentUserId?.email ||
                      r.parent?.email ||
                      "—"}
                  </div>

                  <div style={{ fontWeight: 900 }}>
                    {r.groupId?.name || "—"}
                  </div>

                  <div style={{ opacity: 0.88, fontWeight: 850 }}>
                    {r.groupId?.level || "—"}
                  </div>

                  <div style={{ fontWeight: 900 }}>{r.age ?? "—"}</div>
                  <div style={{ fontWeight: 900 }}>{r.bibNo || "—"}</div>

                  <div>
                    {(() => {
                      const enrolled =
                        !!eventId && enrolledSet.has(normalizeId(r._id));
                      const payment =
                        getPaymentForParticipant(r._id) || r.payment || null;
                      const fallbackAmount = Number(
                        selectedEventDoc?.registrationFee || 0,
                      );

                      if (!eventId) {
                        return (
                          <span style={{ opacity: 0.65, color: "#475569" }}>
                            —
                          </span>
                        );
                      }

                      if (!enrolled) {
                        return (
                          <span className="raBadge raBadgeOff">
                            Not Enrolled
                          </span>
                        );
                      }

                      return (
                        <div style={{ display: "grid", gap: 8 }}>
                          <span className="raBadge raBadgeOn">Enrolled</span>

                          <PaymentStatusBadge
                            status={payment?.paymentStatus || "PENDING"}
                          />

                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: 12,
                              color: "#0f172a",
                            }}
                          >
                            {money(
                              payment?.amount ?? fallbackAmount,
                              payment?.currency || "QAR",
                            )}
                          </div>

                          <div
                            style={{
                              fontSize: 11,
                              color: "#64748b",
                              lineHeight: 1.3,
                            }}
                          >
                            {payment?.paidAt
                              ? formatDateTime(payment.paidAt)
                              : payment?.createdAt
                                ? formatDateTime(payment.createdAt)
                                : "Pending payment"}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="raInlineActions">
                    {renderActionButtons(r)}
                  </div>
                </div>
              ))}

              {!loading && paged.length === 0 ? (
                <div className="raEmpty">No participants found.</div>
              ) : null}
              {loading ? <div className="raEmpty">Loading…</div> : null}
            </div>
          </div>
        </div>

        <div className="raTabletList">
          {paged.map((r, i) => {
            const enrolled = !!eventId && enrolledSet.has(normalizeId(r._id));
            const payment =
              getPaymentForParticipant(r._id) || r.payment || null;
            const fallbackAmount = Number(
              selectedEventDoc?.registrationFee || 0,
            );

            return (
              <div key={r._id} className="raTabletCard">
                <div className="raTabletTop">
                  <div className="raTabletTitleWrap">
                    <div className="raTabletIndex">
                      #{(page - 1) * PAGE_SIZE + i + 1}
                    </div>
                    <div className="raMainTitle">{r.userId?.name || "—"}</div>
                    <div className="raSubText">
                      {displayParticipantEmail(r)}
                    </div>
                  </div>

                  <div className="raTabletTopRight">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(normalizeId(r._id))}
                      onChange={() => toggleSelected(r._id)}
                      aria-label="Select participant"
                    />
                  </div>
                </div>

                <div className="raTabletBottom">
                  <div className="raTabletMeta">
                    <div className="raTabletMetaItem">
                      <span>Group</span>
                      <b>{r.groupId?.name || "—"}</b>
                    </div>
                    <div className="raTabletMetaItem">
                      <span>Level</span>
                      <b>{r.groupId?.level || "—"}</b>
                    </div>
                    <div className="raTabletMetaItem">
                      <span>Parent</span>
                      <b>
                        {r.parentEmail ||
                          r.parentUserId?.email ||
                          r.parent?.email ||
                          "—"}
                      </b>
                    </div>
                    <div className="raTabletMetaItem">
                      <span>Age</span>
                      <b>{r.age ?? "—"}</b>
                    </div>
                    <div className="raTabletMetaItem">
                      <span>BIB</span>
                      <b>{r.bibNo || "—"}</b>
                    </div>
                    <div className="raTabletMetaItem">
                      <span>Status</span>
                      <b>
                        <span
                          className={`raStatus ${
                            r.userId?.isActive === false ? "off" : "on"
                          }`}
                        >
                          {r.userId?.isActive === false ? "Inactive" : "Active"}
                        </span>
                      </b>
                    </div>
                    <div className="raTabletMetaItem">
                      <span>Enrollment</span>
                      <b>
                        {!eventId ? (
                          "—"
                        ) : enrolled ? (
                          <span className="raBadge raBadgeOn">Enrolled</span>
                        ) : (
                          <span className="raBadge raBadgeOff">
                            Not Enrolled
                          </span>
                        )}
                      </b>
                    </div>
                    <div className="raTabletMetaItem">
                      <span>Payment</span>
                      <b>
                        {!eventId || !enrolled ? (
                          "—"
                        ) : (
                          <div style={{ display: "grid", gap: 6 }}>
                            <PaymentStatusBadge
                              status={payment?.paymentStatus || "PENDING"}
                            />
                            <span>
                              {money(
                                payment?.amount ?? fallbackAmount,
                                payment?.currency || "QAR",
                              )}
                            </span>
                          </div>
                        )}
                      </b>
                    </div>
                  </div>

                  <div className="raTabletActions">
                    {renderActionButtons(r)}
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && paged.length === 0 ? (
            <div className="raEmpty">No participants found.</div>
          ) : null}
          {loading ? <div className="raEmpty">Loading…</div> : null}
        </div>

        <div className="raMobileList">
          {paged.map((r, i) => {
            const enrolled = !!eventId && enrolledSet.has(normalizeId(r._id));
            const payment =
              getPaymentForParticipant(r._id) || r.payment || null;
            const fallbackAmount = Number(
              selectedEventDoc?.registrationFee || 0,
            );

            return (
              <div key={r._id} className="raMobileCard">
                <div className="raMobileHead">
                  <div className="raMobileHeadLeft">
                    <div className="raMobileIndex">
                      #{(page - 1) * PAGE_SIZE + i + 1}
                    </div>
                    <div className="raMainTitle">{r.userId?.name || "—"}</div>
                    <div className="raSubText">
                      {displayParticipantEmail(r)}
                    </div>
                  </div>

                  <label className="raCheckWrap">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(normalizeId(r._id))}
                      onChange={() => toggleSelected(r._id)}
                      aria-label="Select participant"
                    />
                  </label>
                </div>

                <div className="raMobileMetaGrid">
                  <div className="raMetaBox">
                    <span>Group</span>
                    <b>{r.groupId?.name || "—"}</b>
                  </div>

                  <div className="raMetaBox">
                    <span>Parent</span>
                    <b>
                      {r.parentEmail ||
                        r.parentUserId?.email ||
                        r.parent?.email ||
                        "—"}
                    </b>
                  </div>

                  <div className="raMetaBox">
                    <span>Level</span>
                    <b>{r.groupId?.level || "—"}</b>
                  </div>

                  <div className="raMetaBox">
                    <span>Age</span>
                    <b>{r.age ?? "—"}</b>
                  </div>

                  <div className="raMetaBox">
                    <span>BIB</span>
                    <b>{r.bibNo || "—"}</b>
                  </div>

                  <div className="raMetaBox">
                    <span>Status</span>
                    <b>
                      <span
                        className={`raStatus ${
                          r.userId?.isActive === false ? "off" : "on"
                        }`}
                      >
                        {r.userId?.isActive === false ? "Inactive" : "Active"}
                      </span>
                    </b>
                  </div>

                  <div className="raMetaBox">
                    <span>Enrollment</span>
                    <b>
                      {!eventId ? (
                        "—"
                      ) : enrolled ? (
                        <span className="raBadge raBadgeOn">Enrolled</span>
                      ) : (
                        <span className="raBadge raBadgeOff">Not Enrolled</span>
                      )}
                    </b>
                  </div>

                  <div className="raMetaBox">
                    <span>Payment</span>
                    <b>
                      {!eventId || !enrolled ? (
                        "—"
                      ) : (
                        <div style={{ display: "grid", gap: 6 }}>
                          <PaymentStatusBadge
                            status={payment?.paymentStatus || "PENDING"}
                          />
                          <span>
                            {money(
                              payment?.amount ?? fallbackAmount,
                              payment?.currency || "QAR",
                            )}
                          </span>
                        </div>
                      )}
                    </b>
                  </div>
                </div>

                <div className="raMobileActions">{renderActionButtons(r)}</div>
              </div>
            );
          })}

          {!loading && paged.length === 0 ? (
            <div className="raEmpty">No participants found.</div>
          ) : null}
          {loading ? <div className="raEmpty">Loading…</div> : null}
        </div>

        <div className="raPagination">
          <div className="raMiniText">
            Page <b>{page}</b> of <b>{totalPages}</b>
          </div>

          <div className="raPaginationBtns">
            <button
              className="raBtn"
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <button
              className="raBtn"
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {assignOpen ? (
        <div
          className="raModalOverlay"
          onMouseDown={() => setAssignOpen(false)}
        >
          <div
            className="raModal"
            style={{ maxWidth: 720 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="raModalHead">
              <div>
                <div className="raModalTitle">Assign / Edit Enrollment</div>
                <div className="raModalSub">
                  {assignRow?.userId?.name || "—"} ·{" "}
                  <span className="raMono">
                    {displayParticipantEmail(assignRow)}
                  </span>
                </div>
              </div>
              <button
                className="raIconClose"
                onClick={() => setAssignOpen(false)}
                aria-label="Close"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="raGrid2" style={{ marginTop: 14 }}>
              <ComboSelect
                label="Event"
                value={assignEventId}
                onChange={(v) => setAssignEventId(v)}
                placeholder="Select Event"
                allowClear={true}
                clearLabel="No Event"
                options={(events || []).map((ev) => ({
                  value: ev._id,
                  label: ev.name,
                }))}
              />

              <Field label="Status">
                <div className="raInfoField">
                  {!assignEventId ? (
                    <span style={{ opacity: 0.65 }}>Select an event</span>
                  ) : assignBusy ? (
                    <span style={{ opacity: 0.75 }}>Checking…</span>
                  ) : assignEnrolled ? (
                    <span className="raBadge raBadgeOn">Enrolled</span>
                  ) : (
                    <span className="raBadge raBadgeOff">Not Enrolled</span>
                  )}
                </div>
              </Field>
            </div>

            <div className="raModalFooterSplit">
              <div style={{ fontSize: 12, opacity: 0.75, color: "#334155" }}>
                {assignEventId ? (
                  <>
                    Selected: <b>{assignEventName}</b>
                  </>
                ) : (
                  "Choose an event to manage enrollment."
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="raBtn" onClick={() => setAssignOpen(false)}>
                  Close
                </button>

                {assignEnrolled ? (
                  <button
                    className="raBtnWarn"
                    type="button"
                    disabled={!assignEventId || assignBusy}
                    onClick={assignRemove}
                  >
                    <IconBan size={14} />
                    Remove
                  </button>
                ) : (
                  <button
                    className="raBtnPrimary"
                    type="button"
                    disabled={!assignEventId || assignBusy}
                    onClick={assignEnroll}
                  >
                    <IconCheckCircle size={14} />
                    Enroll
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="raModalOverlay" onMouseDown={() => setEditOpen(false)}>
          <div className="raModal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="raModalHead">
              <div>
                <div className="raModalTitle">Edit Participant</div>
                <div className="raModalSub">{editRow?.userId?.name || "—"}</div>
              </div>
              <button
                className="raIconClose"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="raGrid2" style={{ marginTop: 14 }}>
              <ComboSelect
                label="Group"
                value={editGroupId}
                onChange={setEditGroupId}
                placeholder="Select group"
                allowClear={false}
                options={groupOptionsFull}
              />

              <Field label="Age (optional)">
                <input
                  className="raInput"
                  value={editAge}
                  onChange={(e) => setEditAge(e.target.value)}
                  placeholder="e.g. 9"
                  inputMode="numeric"
                />
              </Field>

              <Field label="BIB No (optional)">
                <input
                  className="raInput"
                  value={editBibNo}
                  onChange={(e) => setEditBibNo(e.target.value)}
                  placeholder="e.g. A-12"
                  inputMode="text"
                />
              </Field>

              <Field label="Parent Email (optional)">
                <input
                  className="raInput"
                  value={editParentEmail}
                  onChange={(e) => setEditParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  inputMode="email"
                />
              </Field>
            </div>

            <div className="raModalActions">
              <button className="raBtn" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button
                className="raBtnPrimary"
                onClick={saveEdit}
                disabled={busy}
              >
                <IconEdit size={14} />
                {busy ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmBox ? (
        <div className="raModalOverlay" onMouseDown={() => setConfirmBox(null)}>
          <div
            className="raModal"
            style={{ maxWidth: 520 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="raModalHead">
              <div className="raModalTitle">{confirmBox.title}</div>
              <button
                className="raIconClose"
                onClick={() => setConfirmBox(null)}
                aria-label="Close"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="raConfirmText">{confirmBox.body}</div>

            <div className="raModalActions">
              <button
                className="raBtn"
                type="button"
                onClick={() => setConfirmBox(null)}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                className={
                  confirmBox.tone === "danger" ? "raBtnDanger" : "raBtnWarn"
                }
                type="button"
                disabled={busy}
                onClick={async () => {
                  const run = confirmBox.onYes;
                  setConfirmBox(null);
                  await run?.();
                }}
              >
                {confirmBox.tone === "danger" ? (
                  <IconShieldOff size={14} />
                ) : (
                  <IconTrash size={14} />
                )}
                {confirmBox.yesText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className="raModalOverlay" onMouseDown={closeImport}>
          <div
            className="raModal raImportModal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="raModalHead">
              <div>
                <div className="raModalTitle">Import Participants (CSV)</div>
                <div className="raModalSub">
                  Academy: <b>{selectedAcademyName || "—"}</b> · Required
                  headers: <b>name,group</b> (optional:
                  email,parentEmail,level,age,bibNo,password)
                </div>
              </div>
              <button
                className="raIconClose"
                onClick={closeImport}
                aria-label="Close"
              >
                <IconClose size={16} />
              </button>
            </div>

            <div className="raImportTop" style={{ marginTop: 14 }}>
              <div className="raCardMini">
                <div className="raLabel">
                  Default Password (if CSV password missing)
                </div>
                <input
                  className="raInput"
                  value={defaultCsvPassword}
                  onChange={(e) => setDefaultCsvPassword(e.target.value)}
                />
              </div>

              <div className="raCardMini">
                <div className="raLabel">Upload CSV</div>
                <input
                  ref={fileRef}
                  className="raInput"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => onPickCsvFile(e.target.files?.[0])}
                />
              </div>
            </div>

            <div className="raImportActionRow">
              <button
                className="raBtn"
                type="button"
                onClick={downloadSampleParticipantsCsv}
              >
                <IconDownload size={14} />
                Download Sample CSV
              </button>

              <div className="raMiniText">
                Use the sample file to match the correct import column format.
              </div>
            </div>

            {importErrors.length ? (
              <div className="raImportWarn" style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>
                  CSV Issues ({importErrors.length})
                </div>
                <div style={{ maxHeight: 140, overflow: "auto", fontSize: 12 }}>
                  {importErrors.slice(0, 120).map((x, idx) => (
                    <div key={idx} style={{ marginBottom: 6 }}>
                      <b>Line {x.line}</b> · {x.field}: {x.message}
                    </div>
                  ))}
                  {importErrors.length > 120 ? <div>…and more</div> : null}
                </div>
              </div>
            ) : null}

            {importRows.length ? (
              <div style={{ marginTop: 12 }}>
                <div
                  style={{ fontWeight: 950, marginBottom: 8, color: "#0f172a" }}
                >
                  Preview ({importRows.length} rows)
                </div>

                <div className="raImportTable">
                  <div className="raImportHead">
                    <div>#</div>
                    <div>Name</div>
                    <div>Email</div>
                    <div>Parent</div>
                    <div>Group</div>
                    <div>Level</div>
                    <div>Age</div>
                    <div>BIB</div>
                  </div>

                  {importRows.slice(0, 25).map((r, idx) => (
                    <div key={idx} className="raImportRow">
                      <div>{idx + 2}</div>
                      <div style={{ fontWeight: 900 }}>{r.name}</div>
                      <div style={{ opacity: 0.85 }}>{r.email || "—"}</div>
                      <div style={{ opacity: 0.85 }}>
                        {r.parentEmail || "—"}
                      </div>
                      <div>{r.group}</div>
                      <div style={{ opacity: 0.75 }}>{r.level || "—"}</div>
                      <div>{String(r.age).trim() === "" ? "—" : r.age}</div>
                      <div>{r.bibNo || "—"}</div>
                    </div>
                  ))}
                </div>

                {importRows.length > 25 ? (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      opacity: 0.7,
                      color: "#475569",
                    }}
                  >
                    Showing first 25 rows (import will include all).
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="raModalFooterSplit">
              <div style={{ fontSize: 12, opacity: 0.75, color: "#334155" }}>
                {importReport.length ? (
                  <>
                    Report:{" "}
                    <b>
                      {
                        importReport.filter((x) => x.status === "SUCCESS")
                          .length
                      }
                    </b>{" "}
                    success ·{" "}
                    <b>
                      {importReport.filter((x) => x.status === "FAILED").length}
                    </b>{" "}
                    failed
                  </>
                ) : (
                  "Tip: Group matching uses group name and optional level inside the selected academy."
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {importReport.length ? (
                  <button
                    className="raBtn"
                    type="button"
                    onClick={downloadImportReport}
                  >
                    <IconDownload size={14} />
                    Download Report CSV
                  </button>
                ) : null}

                <button
                  className="raBtn"
                  type="button"
                  onClick={closeImport}
                  disabled={importBusy}
                >
                  Close
                </button>

                <button
                  className="raBtnPrimary"
                  type="button"
                  onClick={runImport}
                  disabled={importBusy || !importRows.length || !academyId}
                >
                  <IconUpload size={14} />
                  {importBusy ? "Importing..." : "Run Import"}
                </button>
              </div>
            </div>

            {importReport.length ? (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{ fontWeight: 950, marginBottom: 8, color: "#0f172a" }}
                >
                  Import Results
                </div>
                <div className="raImportTable raImportTableResults">
                  <div className="raImportHead raImportHeadResults">
                    <div>Line</div>
                    <div>Email</div>
                    <div>Status</div>
                    <div>Message</div>
                  </div>

                  {importReport.slice(0, 80).map((r, idx) => (
                    <div key={idx} className="raImportRow raImportRowResults">
                      <div>{r.line}</div>
                      <div style={{ fontWeight: 900 }}>{r.email || "—"}</div>
                      <div
                        style={{
                          fontWeight: 950,
                          color: r.status === "SUCCESS" ? "green" : "#e11d2e",
                        }}
                      >
                        {r.status}
                      </div>
                      <div style={{ opacity: 0.85 }}>{r.message || "—"}</div>
                    </div>
                  ))}
                </div>
                {importReport.length > 80 ? (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      opacity: 0.7,
                      color: "#475569",
                    }}
                  >
                    Showing first 80 results.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* SMALL COMPONENTS */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, tone = "default", icon }) {
  return (
    <div className={`raStatCard ${tone}`}>
      <div className="raStatTop">
        <span className="raStatIcon">{icon}</span>
        <div className="raStatLabel">{label}</div>
      </div>
      <div className="raStatValue">{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="raLabel">{label}</div>
      {children}
    </div>
  );
}

function Chip({ label, onClear, noClear = false }) {
  return (
    <div className="raChip">
      <span className="raChipText">{label}</span>
      {!noClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear"
          className="raChipX"
        >
          <IconClose size={12} />
        </button>
      ) : null}
    </div>
  );
}

function useDebouncedValue(value, delay = 250) {
  const [v, setV] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return v;
}

function ComboSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchable = true,
  allowClear = true,
  clearLabel = "All",
  disabled = false,
}) {
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({
    left: 0,
    top: 0,
    width: 320,
    up: false,
    listMaxH: 260,
  });

  const safeOptions = Array.isArray(options) ? options : [];
  const selected = safeOptions.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return safeOptions;
    return safeOptions.filter((o) => String(o.label).toLowerCase().includes(s));
  }, [safeOptions, q]);

  function close() {
    setOpen(false);
    setQ("");
  }

  function pick(v) {
    if (disabled) return;
    onChange(v);
    close();
  }

  function computePos() {
    const el = btnRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const PANEL_W = Math.max(280, rect.width);
    const MARGIN = 8;

    const SEARCH_H = searchable ? 52 : 0;
    const FOOT_H = 54;
    const PAD_H = 24;
    const MIN_LIST = 160;

    const spaceDown = window.innerHeight - rect.bottom - MARGIN;
    const spaceUp = rect.top - MARGIN;
    const up = spaceDown < 280 && spaceUp > spaceDown;

    let left = rect.left;
    if (left + PANEL_W > window.innerWidth - MARGIN) {
      left = window.innerWidth - MARGIN - PANEL_W;
    }
    if (left < MARGIN) left = MARGIN;

    const top = up ? rect.top : rect.bottom;
    const available = (up ? spaceUp : spaceDown) - (SEARCH_H + FOOT_H + PAD_H);
    const listMaxH = Math.max(MIN_LIST, Math.floor(available));

    setPos({
      left,
      top,
      width: Math.min(PANEL_W, window.innerWidth - MARGIN * 2),
      up,
      listMaxH,
    });
  }

  useEffect(() => {
    if (!open || disabled) return;
    computePos();
    const t = setTimeout(() => inputRef.current?.focus?.(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, disabled]);

  useEffect(() => {
    if (!open || disabled) return;

    function onDown(e) {
      if (wrapRef.current && wrapRef.current.contains(e.target)) return;
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      close();
    }

    function onKey(e) {
      if (e.key === "Escape") close();
    }

    function onScroll() {
      computePos();
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", computePos);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", computePos);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, disabled]);

  const panel = (
    <div
      ref={panelRef}
      className={`raComboPanelFixed ${pos.up ? "up" : ""}`}
      style={{ left: pos.left, top: pos.top, width: pos.width }}
      role="listbox"
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {searchable ? (
        <input
          ref={inputRef}
          className="raInput"
          style={{ height: 42 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type to search…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const first = filtered?.[0];
              if (first) pick(first.value);
            }
          }}
        />
      ) : null}

      <div className="raComboList" style={{ maxHeight: pos.listMaxH }}>
        {allowClear ? (
          <button
            type="button"
            className={`raComboItem ${!value ? "active" : ""}`}
            onClick={() => pick("")}
          >
            <span className="main">{clearLabel}</span>
            <span className="meta">No filter</span>
          </button>
        ) : null}

        {allowClear ? <div className="raComboDivider" /> : null}

        {filtered.map((o) => (
          <button
            key={`${o.value}-${o.label}`}
            type="button"
            className={`raComboItem ${
              String(value) === String(o.value) ? "active" : ""
            }`}
            onClick={() => pick(o.value)}
          >
            <span className="main">{o.label}</span>
            <span className="meta">
              {String(value) === String(o.value) ? "Selected" : "Select"}
            </span>
          </button>
        ))}

        {!filtered.length ? (
          <div className="raComboEmpty">No results.</div>
        ) : null}
      </div>

      <div className="raComboFoot">
        <button className="raBtn" type="button" onClick={close}>
          Done
        </button>
      </div>
    </div>
  );

  const portalRoot = typeof document !== "undefined" ? document.body : null;

  return (
    <div ref={wrapRef} style={{ position: "relative", minWidth: 0 }}>
      {label ? <div className="raLabel">{label}</div> : null}

      <button
        ref={btnRef}
        type="button"
        className="raComboBtn"
        onClick={(e) => {
          if (disabled) return;
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className="raComboBtnLabel">
          {selected ? selected.label : placeholder}
        </span>
        <span className="raComboBtnChev">
          <IconChevronDown size={14} />
        </span>
      </button>

      {open && !disabled && portalRoot ? createPortal(panel, portalRoot) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* STYLES */
/* ------------------------------------------------------------------ */

function StyleTag() {
  const REDX = UI?.RED || "#e11d2e";
  return (
    <style>{`
      .raTopbar{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:16px;
        flex-wrap:wrap;
      }

      .raPageEyebrow{
        display:inline-flex;
        align-items:center;
        gap:8px;
        height:28px;
        padding:0 12px;
        border-radius:999px;
        background:rgba(255,241,242,0.95);
        border:1px solid rgba(225,29,46,0.18);
        color:${REDX} !important;
        font-size:11px;
        font-weight:900;
        letter-spacing:.08em;
      }

      .raEyebrowIcon{display:grid;place-items:center;}

      .raStats{
        display:grid;
        grid-template-columns:repeat(4, minmax(120px, 1fr));
        gap:12px;
        min-width:min(100%, 560px);
      }

      .raAcademyBar{
        margin-top:16px;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:16px;
        flex-wrap:wrap;
        padding:16px 18px;
        border-radius:22px;
        border:1px solid rgba(17,24,39,0.08);
        background:linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.98));
        box-shadow:0 14px 36px rgba(2,8,23,0.06);
      }

      .raAcademyBarInfo{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}

      .raAcademyBadge{
        display:inline-flex;
        align-items:center;
        gap:8px;
        min-height:36px;
        padding:0 14px;
        border-radius:999px;
        background:rgba(239,246,255,0.95);
        border:1px solid rgba(59,130,246,0.18);
        color:#1d4ed8 !important;
        font-size:12px;
        font-weight:950;
      }

      .raAcademySelector{min-width:min(100%, 360px);width:360px;max-width:100%;}

      @media (max-width:1000px){.raStats{grid-template-columns:repeat(2, minmax(120px, 1fr)); width:100%;}}
      @media (max-width:560px){.raStats{grid-template-columns:1fr 1fr; gap:10px;}}

      .raStatCard{
        padding:14px;
        border-radius:20px;
        border:1px solid rgba(17,24,39,0.08);
        background:linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,250,252,0.98));
        box-shadow:0 12px 30px rgba(2,8,23,0.06);
        color:#0f172a !important;
      }
      .raStatCard *{color:inherit !important;}
      .raStatCard.live{background:linear-gradient(180deg, rgba(236,253,245,0.98), rgba(240,253,250,0.98));border-color:rgba(16,185,129,0.18);}
      .raStatCard.draft{background:linear-gradient(180deg, rgba(255,251,235,0.98), rgba(254,252,232,0.98));border-color:rgba(245,158,11,0.18);}
      .raStatCard.closed{background:linear-gradient(180deg, rgba(255,241,242,0.98), rgba(255,245,245,0.98));border-color:rgba(225,29,46,0.18);}
      .raStatTop{display:flex;align-items:center;gap:10px;}
      .raStatIcon{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:rgba(15,23,42,0.04);color:${REDX};flex:0 0 auto;}
      .raStatLabel{font-size:12px; opacity:.72; font-weight:800;}
      .raStatValue{margin-top:8px; font-size:28px; line-height:1; font-weight:950; letter-spacing:-0.03em;}

      .raLayout{display:grid;grid-template-columns:minmax(650px, 1.55fr) minmax(340px, 0.95fr);gap:16px;align-items:start;margin-top:16px;}
      .raRightCol{display:grid; gap:16px;}
      @media (max-width:1100px){.raLayout{grid-template-columns:1fr;}}

      .raCard{background:linear-gradient(180deg, rgba(255,255,255,0.95), rgba(250,250,252,0.97));border:1px solid rgba(17,24,39,0.08);border-radius:24px;box-shadow:0 18px 52px rgba(2,8,23,0.07), inset 0 1px 0 rgba(255,255,255,0.55);backdrop-filter:blur(14px);color:#0f172a !important;}
      .raCard *, .raModal *, .raImportTable *, .raTabletCard *, .raMobileCard *{color:inherit;}
      .raCard2{padding:20px; overflow:hidden;}
      @media (max-width:640px){.raCard2{padding:16px; border-radius:20px;}}
      .raCardTitle{font-weight:950; font-size:17px; color:#0b1220 !important;}
      .raCardSub{margin-top:6px; font-size:12px; opacity:.72; font-weight:800; line-height:1.45; color:#475569 !important;}
      .raCardTopRow{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;}

      .raGrid2{display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:16px;}
      @media (max-width:900px){.raGrid2{grid-template-columns:1fr;}}
      .raLabel{font-size:12px; opacity:.75; margin-bottom:6px; font-weight:800; color:#475569 !important;}
      .raMiniText{font-size:12px; opacity:.85; font-weight:800; color:#475569 !important;}
      .raMono{font-variant-numeric:tabular-nums;font-feature-settings:"tnum";opacity:.96;color:#0f172a !important;white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.35;}

      .raInput{width:100%;box-sizing:border-box;min-height:48px;padding:12px 14px;border-radius:14px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.96);outline:none;font-weight:800;font-size:14px;color:#0f172a !important;}
      .raInput::placeholder{color:#94a3b8 !important;}
      .raInput:focus{border-color:rgba(225,29,46,0.35);box-shadow:0 0 0 6px rgba(225,29,46,0.12);}
      .raSearchWrap{position:relative;}
      .raSearchIcon{position:absolute;left:14px;top:50%;transform:translateY(-50%);opacity:.55;pointer-events:none;display:grid;place-items:center;color:#64748b;}
      .raInputSearch{padding-left:42px;}
      .raFormFooter{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;flex-wrap:wrap;}

      .raBtnPrimary,.raBtn,.raBtnWarn,.raBtnDanger,.raBtnSmallAccentWide{height:42px;padding:0 14px;border-radius:14px;font-weight:950;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;}
      .raBtnPrimary{padding:0 16px;border:1px solid rgba(225,29,46,0.28);background:linear-gradient(180deg, rgba(255,241,242,0.96), rgba(255,228,230,0.95));color:${REDX} !important;box-shadow:0 12px 26px rgba(225,29,46,0.08);}
      .raBtn{border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.98);color:#0f172a !important;}
      .raBtnGhost{background:rgba(255,255,255,0.84);}
      .raBtnWarn{border:1px solid rgba(245,158,11,0.28);background:rgba(255,251,235,0.98);color:#9a3412 !important;}
      .raBtnDanger{border:1px solid rgba(225,29,46,0.28);background:rgba(255,241,242,0.98);color:${REDX} !important;}
      .raBtnSmallAccentWide{border:1px solid rgba(16,185,129,0.20);background:rgba(236,253,245,0.98);color:#047857 !important;}

      .raBtnSmall,.raBtnSmallAccent,.raBtnSmallWarn,.raBtnSmallDanger{height:36px;padding:0 12px;border-radius:12px;font-weight:900;cursor:pointer;white-space:nowrap;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.98);display:inline-flex;align-items:center;justify-content:center;gap:7px;}
      .raBtnSmall{color:#0f172a !important;}
      .raBtnSmallAccent{border-color:rgba(16,185,129,0.20);background:rgba(236,253,245,0.98);color:#047857 !important;}
      .raBtnSmallWarn{border-color:rgba(245,158,11,0.24);background:rgba(255,251,235,0.98);color:#9a3412 !important;}
      .raBtnSmallDanger{border-color:rgba(225,29,46,0.24);background:rgba(255,241,242,0.98);color:${REDX} !important;}
      .raBtn:disabled,.raBtnPrimary:disabled,.raBtnWarn:disabled,.raBtnDanger:disabled,.raBtnSmall:disabled,.raBtnSmallAccent:disabled,.raBtnSmallWarn:disabled,.raBtnSmallDanger:disabled,.raBtnSmallAccentWide:disabled{opacity:.55;cursor:not-allowed;}

      .raFilterPanelSidebar{border-radius:20px;border:1px solid rgba(17,24,39,0.08);background:linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.97));padding:14px;display:grid;gap:12px;color:#0f172a !important;}
      .raSidebarTitle{font-size:13px;font-weight:950;color:#0b1220 !important;padding-bottom:4px;border-bottom:1px solid rgba(17,24,39,0.08);}
      .raSidebarSection{min-width:0;}
      .raSidebarFooter{display:grid;gap:10px;margin-top:4px;}
      .raChips{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;}
      .raChip{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:999px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.88);font-weight:900;font-size:12px;max-width:100%;color:#0f172a !important;}
      .raChipText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px;color:#0f172a !important;}
      .raChipX{width:26px;height:26px;border-radius:999px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.96);cursor:pointer;display:grid;place-items:center;color:#0f172a !important;}

      .raBadge{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:950;border:1px solid rgba(17,24,39,0.10);background:rgba(255,255,255,0.92);color:#0f172a !important;}
      .raBadgeOn{border-color:rgba(16,185,129,0.25);background:rgba(236,253,245,0.98);color:#047857 !important;}
      .raBadgeOff{border-color:rgba(148,163,184,0.35);background:rgba(248,250,252,0.98);color:#475569 !important;opacity:1;}

      .raSummaryList{display:grid; gap:10px;}
      .raSummaryItem{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:46px;padding:0 14px;border-radius:14px;background:rgba(248,250,252,0.95);border:1px solid rgba(17,24,39,0.07);font-size:13px;font-weight:800;color:#0f172a !important;}
      .raSummaryLeft{display:inline-flex;align-items:center;gap:8px;}
      .raSummaryItem span,.raSummaryItem b{color:#0f172a !important;}
      .raBulkActions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;}
      @media (max-width:640px){.raBulkActions{grid-template-columns:1fr;}}

      .raTableCard{padding:14px;}
      .raTableHeadBar{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
      .raRightMeta{display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;align-items:center;}
      .raTableDesktop{display:block;}
      .raTabletList{display:none;}
      .raMobileList{display:none;}
      .raTableWrap{overflow:auto;overflow-x:auto;border-radius:18px;border:1px solid rgba(17,24,39,0.08);max-height:72vh;background:rgba(255,255,255,0.78);}
      .raTable{min-width:1880px;overflow:hidden;color:#0f172a !important;}
      .raTable input[type="checkbox"],.raTabletList input[type="checkbox"],.raMobileList input[type="checkbox"]{accent-color:${REDX};}
      .raThead{display:grid;padding:13px 14px;background:rgba(248,250,252,0.98);border-bottom:1px solid rgba(17,24,39,0.08);font-weight:950;font-size:12px;color:#475569 !important;text-transform:uppercase;letter-spacing:.03em;align-items:start;}
      .raThead *{color:#475569 !important;}
      .raStickyHead{position:sticky; top:0; z-index:2; backdrop-filter:blur(10px);}
      .raTrow{display:grid;padding:14px 14px;background:rgba(255,255,255,0.94);border-bottom:1px solid rgba(17,24,39,0.06);align-items:start;color:#0f172a !important;}
      .raTrow *{color:inherit;}
      .raRowHover:hover{background:rgba(255,255,255,0.99);}
      .raInlineActions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;align-items:flex-start;}
      .raInlineActions > button{flex:0 0 auto;}
      .raParticipantRow{display:flex;align-items:flex-start;gap:10px;min-width:0;}
      .raPersonIcon{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:rgba(15,23,42,0.05);color:${REDX};flex:0 0 auto;}

      .raTabletCard,.raMobileCard{padding:16px;border:1px solid rgba(17,24,39,0.08);border-radius:18px;background:rgba(255,255,255,0.96);box-shadow:0 10px 24px rgba(2,8,23,0.05);color:#0f172a !important;}
      .raTabletCard + .raTabletCard,.raMobileCard + .raMobileCard{margin-top:12px;}
      .raTabletTop,.raMobileHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}
      .raTabletTitleWrap,.raMobileHeadLeft{min-width:0;flex:1;}
      .raTabletTopRight,.raCheckWrap{flex:0 0 auto;display:flex;align-items:flex-start;justify-content:center;}
      .raCheckWrap input{width:20px;height:20px;margin:0;}
      .raTabletIndex,.raMobileIndex{font-size:12px;opacity:.8;font-weight:900;margin-bottom:4px;color:#64748b !important;}
      .raTabletBottom{margin-top:14px;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:end;}
      .raTabletMeta{display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px 14px;}
      .raTabletMetaItem,.raMetaBox{display:flex;flex-direction:column;gap:4px;min-width:0;}
      .raTabletMetaItem span,.raMetaBox span{font-size:11px;opacity:.78;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:#64748b !important;}
      .raTabletMetaItem b,.raMetaBox b{font-size:13px;font-weight:900;word-break:break-word;color:#0f172a !important;}
      .raTabletActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
      .raMobileMetaGrid{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      .raMobileActions{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      .raNameCell,.raMainTitleWrap{display:flex;flex-direction:column;gap:6px;min-width:0;}
      .raMainTitle{font-weight:950;color:#0b1220 !important;word-break:break-word;line-height:1.15;}
      .raSubText{font-size:12px;opacity:.86;font-weight:700;word-break:break-word;line-height:1.35;color:#64748b !important;}
      .raStatus{width:fit-content;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:950;border:1px solid rgba(17,24,39,0.10);background:rgba(255,255,255,0.92);opacity:1;}
      .raStatus.on{border-color:rgba(16,185,129,0.25);background:rgba(236,253,245,0.96);color:#047857 !important;}
      .raStatus.off{border-color:rgba(225,29,46,0.22);background:rgba(255,241,242,0.96);color:${REDX} !important;}
      .raEmpty{padding:28px 18px;text-align:center;opacity:.95;background:rgba(255,255,255,0.7);color:#475569 !important;}
      .raPagination{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px;}
      .raPaginationBtns{display:flex; gap:10px;}

      .raModalOverlay{position:fixed;inset:0;background:rgba(2,8,23,0.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50;}
      .raModal{width:100%;max-width:900px;border-radius:22px;background:rgba(255,255,255,0.98);border:1px solid rgba(17,24,39,0.12);box-shadow:0 35px 90px rgba(2,8,23,0.20);backdrop-filter:blur(14px);padding:16px;max-height:86vh;overflow:auto;color:#0f172a !important;}
      .raModalHead{display:flex;justify-content:space-between;gap:12px;align-items:center;}
      .raModalTitle{font-weight:950;font-size:18px;color:#0f172a !important;}
      .raModalSub{margin-top:4px;font-size:12px;opacity:.82;font-weight:700;word-break:break-word;color:#64748b !important;}
      .raModalActions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px;flex-wrap:wrap;}
      .raModalFooterSplit{display:flex;justify-content:space-between;gap:10px;margin-top:16px;flex-wrap:wrap;align-items:center;}
      .raConfirmText{margin-top:10px;font-size:13px;opacity:.92;line-height:1.45;color:#334155 !important;}
      .raIconClose{width:38px;height:38px;border-radius:14px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.98);cursor:pointer;flex:0 0 auto;color:#0f172a !important;display:grid;place-items:center;}
      .raInfoField{min-height:46px;border-radius:14px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.95);display:flex;align-items:center;padding:0 14px;font-weight:950;gap:10px;color:#0f172a !important;}

      .raImportTop{display:grid; grid-template-columns:1fr 1fr; gap:12px;}
      @media(max-width:900px){.raImportTop{grid-template-columns:1fr;}}
      .raCardMini{padding:14px;border-radius:18px;border:1px solid rgba(17,24,39,0.10);background:rgba(255,255,255,0.82);color:#0f172a !important;}
      .raImportActionRow{margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;}
      .raImportWarn{padding:12px 14px;border-radius:16px;border:1px solid rgba(225,29,46,0.18);background:rgba(255,241,242,0.95);color:${REDX} !important;}
      .raImportTable{border:1px solid rgba(17,24,39,0.10);border-radius:16px;overflow:hidden;background:rgba(255,255,255,0.92);color:#0f172a !important;}
      .raImportHead,.raImportRow{display:grid;grid-template-columns:70px 1.1fr 1.3fr 1.2fr 1fr 0.8fr 0.6fr 0.8fr;gap:10px;padding:10px 12px;align-items:center;}
      .raImportHead{font-weight:950;font-size:12px;color:#475569 !important;background:rgba(255,255,255,0.98);border-bottom:1px solid rgba(17,24,39,0.08);}
      .raImportRow{font-size:12px;border-bottom:1px solid rgba(17,24,39,0.06);color:#0f172a !important;}
      .raImportRow:last-child{border-bottom:none;}
      .raImportTableResults .raImportHeadResults,.raImportTableResults .raImportRowResults{grid-template-columns:80px 1.3fr 120px 2fr;}

      .raComboBtn{width:100%;min-height:48px;border-radius:14px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.95);cursor:pointer;font-weight:900;padding:0 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;color:#0f172a !important;}
      .raComboBtn:hover{border-color:rgba(17,24,39,0.22);box-shadow:0 12px 28px rgba(2,8,23,0.08);}
      .raComboBtn:disabled{opacity:.65;cursor:not-allowed;background:rgba(248,250,252,0.95);box-shadow:none;}
      .raComboBtnLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.98;color:#0f172a !important;}
      .raComboBtnChev{opacity:.75;color:#475569 !important;display:grid;place-items:center;}
      .raComboPanelFixed{position:fixed;z-index:9999;border-radius:16px;border:1px solid rgba(17,24,39,0.12);background:rgba(255,255,255,0.995);box-shadow:0 24px 70px rgba(2,8,23,0.18);padding:10px;transform:translateY(8px);color:#0f172a !important;}
      .raComboPanelFixed.up{transform:translateY(-8px) translateY(-100%);}
      .raComboList{margin-top:10px;overflow:auto;border-radius:14px;border:1px solid rgba(17,24,39,0.08);background:rgba(255,255,255,0.92);overscroll-behavior:contain;-webkit-overflow-scrolling:touch;}
      .raComboItem{width:100%;text-align:left;padding:10px 12px;border:0;background:transparent;cursor:pointer;display:flex;justify-content:space-between;gap:10px;align-items:baseline;color:#0f172a !important;}
      .raComboItem:hover{background:rgba(2,8,23,0.04);}
      .raComboItem.active{background:rgba(255,241,242,0.70);box-shadow:inset 0 0 0 2px rgba(225,29,46,0.10);}
      .raComboDivider{height:1px; background:rgba(17,24,39,0.08);}
      .raComboEmpty{padding:12px;text-align:center;font-size:12px;opacity:.85;font-weight:900;color:#475569 !important;}
      .raComboFoot{margin-top:10px;display:flex;justify-content:flex-end;}
      .raComboItem .main{font-weight:950;color:#0f172a !important;}
      .raComboItem .meta{font-size:12px;opacity:.75;font-weight:900;white-space:nowrap;color:#64748b !important;}

      @media (max-width:1100px){.raTableDesktop{display:none;}.raTabletList{display:block;}}
      @media (max-width:860px){.raTabletBottom{grid-template-columns:1fr;align-items:start;}.raTabletMeta{grid-template-columns:repeat(2, minmax(0, 1fr));}.raTabletActions{justify-content:flex-start;}}
      @media (max-width:700px){.raTabletList{display:none;}.raMobileList{display:block;}}
      @media (max-width:640px){
        .raAcademyBar{padding:14px;border-radius:18px;}
        .raAcademyBarInfo,.raFormFooter,.raModalActions,.raModalFooterSplit{flex-direction:column;align-items:stretch;}
        .raAcademySelector{width:100%;min-width:0;}
        .raBtn,.raBtnPrimary,.raBtnWarn,.raBtnDanger,.raBtnSmallAccentWide{width:100%;}
        .raPagination{flex-direction:column;align-items:stretch;}
        .raPaginationBtns{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .raPaginationBtns .raBtn{width:100%;}
        .raBulkActions{grid-template-columns:1fr;}
        .raMobileActions{grid-template-columns:1fr;}
        .raRightMeta{width:100%;}
        .raImportActionRow{flex-direction:column;align-items:stretch;}
        .raImportHead,.raImportRow{grid-template-columns:60px 1fr 1fr 1fr 1fr 0.8fr 0.6fr 0.8fr;font-size:11px;}
        .raImportTableResults .raImportHeadResults,.raImportTableResults .raImportRowResults{grid-template-columns:70px 1fr 90px 1.5fr;}
      }
      @media (max-width:480px){
        .raStats{grid-template-columns:1fr;}
        .raMobileCard{padding:14px;}
        .raMobileMetaGrid{grid-template-columns:1fr; gap:10px;}
        .raMainTitle{font-size:15px;}
        .raSubText{font-size:11px;}
        .raBtnSmall,.raBtnSmallAccent,.raBtnSmallWarn,.raBtnSmallDanger{width:100%;height:40px;}
        .raImportHead,.raImportRow{grid-template-columns:50px 1fr 1fr 1fr 1fr 0.7fr 0.6fr 0.7fr;gap:8px;padding:8px 10px;}
        .raImportTableResults .raImportHeadResults,.raImportTableResults .raImportRowResults{grid-template-columns:60px 1fr 80px 1.3fr;gap:8px;padding:8px 10px;}
      }
      @media (prefers-reduced-motion: reduce){*{transition:none !important;}}
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */

function normalizeId(v) {
  return String(v || "").trim();
}

function toOptionalAge(v) {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) return undefined;
  return n;
}

function normalizeAcademyValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value?._id || value?.id || value?.academyId || "").trim();
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function makeInternalParticipantEmail(name = "participant", suffix = "") {
  const safeName =
    String(name || "participant")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 40) || "participant";

  const unique = `${Date.now()}${suffix ? `.${suffix}` : ""}`;
  return `${safeName}.${unique}@noemail.local`;
}

function displayParticipantEmail(row) {
  const realEmail = String(
    row?.participantEmail ||
      row?.profileEmail ||
      row?.email ||
      row?.userId?.realEmail ||
      "",
  ).trim();

  if (realEmail && !realEmail.endsWith("@noemail.local")) {
    return realEmail;
  }

  const userEmail = String(row?.userId?.email || "").trim();

  if (!userEmail || userEmail.endsWith("@noemail.local")) {
    return "—";
  }

  return userEmail;
}

function getAcademyNameFromEntity(entity, academies = []) {
  const raw =
    entity?.academyId?.name ||
    entity?.academy?.name ||
    entity?.groupId?.academyId?.name ||
    entity?.groupId?.academy?.name;

  if (raw) return raw;

  const aid = normalizeId(
    entity?.academyId?._id ||
      entity?.academyId ||
      entity?.academy?._id ||
      entity?.academy ||
      entity?.groupId?.academyId?._id ||
      entity?.groupId?.academyId ||
      entity?.groupId?.academy?._id ||
      entity?.groupId?.academy,
  );

  if (!aid) return "";

  return (
    academies.find((a) => normalizeId(a?._id || a?.id) === aid)?.name || ""
  );
}

function findUserByEmailFromLoadedRows(rows, email) {
  const target = String(email || "")
    .trim()
    .toLowerCase();
  if (!target) return null;

  for (const row of rows || []) {
    const userEmail = String(row?.email || row?.userId?.email || "")
      .trim()
      .toLowerCase();

    if (
      userEmail === target &&
      (row?.role === "PARENT" || row?.userId?.role === "PARENT")
    ) {
      return row?.userId || row || null;
    }
  }

  return null;
}

function pickParentUserIdFromApiResponse(payload) {
  return (
    payload?.id ||
    payload?._id ||
    payload?.user?._id ||
    payload?.user?.id ||
    null
  );
}

function parseCsv(text) {
  const rows = [];
  const lines = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      lines.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  if (cur.length) lines.push(cur);
  if (!lines.length) return [];

  const header = splitCsvLine(lines[0]).map((h) => String(h || "").trim());

  for (let li = 1; li < lines.length; li++) {
    const raw = lines[li];
    if (!raw || !raw.trim()) continue;
    const cols = splitCsvLine(raw);
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }

  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }

  out.push(cur);
  return out.map((s) => String(s ?? "").trim());
}

function toCsv(items, headers) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [];
  lines.push(headers.join(","));
  for (const it of items) {
    lines.push(headers.map((h) => esc(it[h])).join(","));
  }
  return lines.join("\n");
}

function downloadTextFile(text, filename, mime) {
  const blob = new Blob([text], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
