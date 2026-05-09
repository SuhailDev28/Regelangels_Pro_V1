import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  BadgeCheck,
  Bell,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Filter,
  HeartHandshake,
  Home,
  LayoutDashboard,
  LogOut,
  Medal,
  Menu,
  RefreshCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";

import { api } from "../../lib/api.js";
import NotificationBell from "../Components/notifications/NotificationBell.jsx";

const FALLBACK_RED = "#e11d2e";
const FALLBACK_DARK = "#090d18";
const FALLBACK_SOFT = "#64748b";

const LS_ADMIN_LOGO = "ra_admin_logo";
const LS_ADMIN_ACCENT = "ra_admin_accent";
const SETTINGS_UPDATED_EVENT = "ra:settings-updated";

export default function ParentDashboard({ onLogout }) {
  const navigate = useNavigate();
  const aliveRef = useRef(true);
  const deferredPromptRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [branding, setBranding] = useState({
    siteName: "Rebel Angels",
    tagline: "Parent Portal",
    logoUrl: "",
    logoUrlCandidates: [],
    primaryColor: FALLBACK_RED,
  });

  const [children, setChildren] = useState([]);
  const [events, setEvents] = useState([]);
  const [results, setResults] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [childFilter, setChildFilter] = useState("ALL");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [certificateBusyId, setCertificateBusyId] = useState("");
  const [paymentBusyId, setPaymentBusyId] = useState("");
  const [receiptBusyId, setReceiptBusyId] = useState("");
  const [installReady, setInstallReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageCssVars = useMemo(
    () => ({
      "--ra-red": branding.primaryColor || FALLBACK_RED,
      "--ra-dark": FALLBACK_DARK,
      "--ra-soft": FALLBACK_SOFT,
    }),
    [branding.primaryColor],
  );

  const safeChildren = useMemo(() => normalizeArray(children), [children]);
  const safeEvents = useMemo(() => normalizeArray(events), [events]);
  const safeResults = useMemo(() => normalizeArray(results), [results]);
  const safeCertificates = useMemo(
    () => normalizeArray(certificates),
    [certificates],
  );
  const safePayments = useMemo(() => normalizeArray(payments), [payments]);
  const safeNotifications = useMemo(
    () => normalizeArray(notifications),
    [notifications],
  );
  const safeBookings = useMemo(() => normalizeArray(bookings), [bookings]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      deferredPromptRef.current = e;
      setInstallReady(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    let active = true;

    function buildBrandingFromSettingsPayload(payload) {
      const data = unwrapSettingsPayload(payload);

      const localLogo = readBrowserStorage(LS_ADMIN_LOGO, "");
      const localAccent = readBrowserStorage(LS_ADMIN_ACCENT, "");

      const rawLogo =
        pickAssetUrl(
          findFirstDeepValue(data, [
            "logoDataUrl",
            "logoUrl",
            "logo",
            "appLogo",
            "brandLogo",
            "siteLogo",
            "headerLogo",
            "navbarLogo",
            "logoFile",
            "logoImage",
            "image",
            "imageUrl",
            "file",
            "fileUrl",
            "path",
            "url",
          ]),
        ) || localLogo;

      const siteName =
        findFirstDeepValue(data, [
          "siteName",
          "appName",
          "academyName",
          "brandName",
          "companyName",
          "name",
        ]) || "Rebel Angels";

      const tagline =
        findFirstDeepValue(data, [
          "tagline",
          "subtitle",
          "description",
          "siteTagline",
        ]) || "Parent Portal";

      const primaryColor =
        findFirstDeepValue(data, [
          "accent",
          "primaryColor",
          "accentColor",
          "brandColor",
          "themeColor",
          "mainColor",
        ]) ||
        localAccent ||
        FALLBACK_RED;

      const logoUrlCandidates = resolveAssetUrlCandidates(rawLogo);

      return {
        siteName: String(siteName || "Rebel Angels"),
        tagline: String(tagline || "Parent Portal"),
        logoUrl: logoUrlCandidates[0] || "",
        logoUrlCandidates,
        primaryColor: isValidCssColor(primaryColor)
          ? String(primaryColor)
          : FALLBACK_RED,
      };
    }

    async function loadBrandingFromAdminSettings() {
      try {
        const res = await getAdminBrandingSettings();

        if (!active) return;

        const nextBranding = buildBrandingFromSettingsPayload(res);
        setBranding(nextBranding);

        console.log("PARENT DASHBOARD BRANDING:", nextBranding);
      } catch (e) {
        console.warn("Parent branding settings failed:", e);

        if (!active) return;

        const fallbackBranding = buildBrandingFromSettingsPayload({});
        setBranding(fallbackBranding);
      }
    }

    function handleSettingsUpdated(e) {
      if (!active) return;

      const nextBranding = buildBrandingFromSettingsPayload(e?.detail || {});
      setBranding(nextBranding);
    }

    function handleStorageChange(e) {
      if (!active) return;

      if (![LS_ADMIN_LOGO, LS_ADMIN_ACCENT].includes(e?.key)) return;

      const nextBranding = buildBrandingFromSettingsPayload({});
      setBranding(nextBranding);
    }

    loadBrandingFromAdminSettings();

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      active = false;
      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const selectedChild = useMemo(() => {
    if (!selectedChildId) return null;
    return (
      safeChildren.find(
        (c) => normalizeId(getChildId(c)) === normalizeId(selectedChildId),
      ) || null
    );
  }, [safeChildren, selectedChildId]);

  const unreadNotificationsCount = useMemo(() => {
    return safeNotifications.filter((n) => !isNotificationRead(n)).length;
  }, [safeNotifications]);

  const totalDue = useMemo(() => {
    return safePayments.reduce((sum, p) => {
      const status = String(p?.paymentStatus || p?.status || "").toUpperCase();
      if (status === "PAID" || status === "SUCCESS") return sum;

      const explicitDue = toMoney(
        p?.amountDue ?? p?.dueAmount ?? p?.balance ?? p?.pendingAmount,
      );

      if (explicitDue > 0) return sum + explicitDue;

      return (
        sum +
        toMoney(
          p?.amount ?? p?.totalAmount ?? p?.invoiceAmount ?? p?.price ?? 0,
        )
      );
    }, 0);
  }, [safePayments]);

  const totalPaid = useMemo(() => {
    return safePayments.reduce((sum, p) => {
      const status = String(p?.paymentStatus || p?.status || "").toUpperCase();
      const amount = toMoney(
        p?.paidAmount ?? p?.amountPaid ?? p?.amount ?? p?.totalAmount ?? 0,
      );
      if (status === "PAID" || status === "SUCCESS") return sum + amount;
      return sum;
    }, 0);
  }, [safePayments]);

  const activeCertificatesCount = useMemo(() => {
    return safeCertificates.filter((c) => {
      const s = String(c?.status || "ACTIVE").toUpperCase();
      return s !== "REVOKED";
    }).length;
  }, [safeCertificates]);

  const medalsCount = useMemo(() => {
    return safeResults.filter((r) => String(r?.medal || r?.award || "").trim())
      .length;
  }, [safeResults]);

  const upcomingEvents = useMemo(() => {
    const now = startOfDay(new Date());
    return safeEvents
      .filter((e) => {
        const d = toDate(
          e?.startDate || e?.date || e?.eventDate || e?.startsAt || "",
        );
        return d ? d >= now : true;
      })
      .sort((a, b) => {
        const da = toDate(
          a?.startDate || a?.date || a?.eventDate || a?.startsAt || "",
        );
        const db = toDate(
          b?.startDate || b?.date || b?.eventDate || b?.startsAt || "",
        );
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
  }, [safeEvents]);

  const latestResults = useMemo(() => {
    return [...safeResults]
      .sort((a, b) => {
        const da = toDate(
          a?.createdAt || a?.updatedAt || a?.date || a?.eventDate || "",
        );
        const db = toDate(
          b?.createdAt || b?.updatedAt || b?.date || b?.eventDate || "",
        );
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      })
      .slice(0, 8);
  }, [safeResults]);

  const upcomingBookings = useMemo(() => {
    const now = startOfDay(new Date());
    return [...safeBookings]
      .filter((b) => {
        const d = toDate(
          b?.slotDate ||
            b?.date ||
            b?.bookingDate ||
            b?.startDate ||
            b?.startsAt ||
            "",
        );
        return d ? d >= now : true;
      })
      .sort((a, b) => {
        const da = toDate(
          a?.slotDate ||
            a?.date ||
            a?.bookingDate ||
            a?.startDate ||
            a?.startsAt ||
            "",
        );
        const db = toDate(
          b?.slotDate ||
            b?.date ||
            b?.bookingDate ||
            b?.startDate ||
            b?.startsAt ||
            "",
        );
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      })
      .slice(0, 8);
  }, [safeBookings]);

  const activityFeed = useMemo(() => {
    const items = [];

    for (const ev of safeEvents) {
      items.push({
        type: "EVENT",
        date: toDate(
          ev?.startDate || ev?.date || ev?.eventDate || ev?.startsAt,
        ),
        title: ev?.name || ev?.title || ev?.eventName || "Event",
        subtitle: ev?.venue || ev?.location || "Venue TBA",
        status: ev?.status || "UPCOMING",
      });
    }

    for (const cert of safeCertificates) {
      items.push({
        type: "CERTIFICATE",
        date: toDate(cert?.issuedAt || cert?.createdAt || cert?.date),
        title: cert?.title || cert?.certificateTitle || "Certificate",
        subtitle: cert?.participantName || cert?.childName || "Child",
        status: cert?.status || "ACTIVE",
      });
    }

    for (const res of safeResults) {
      items.push({
        type: "RESULT",
        date: toDate(
          res?.createdAt || res?.updatedAt || res?.date || res?.eventDate,
        ),
        title: res?.eventName || res?.title || "Result",
        subtitle: `${res?.participantName || res?.childName || "Child"}${
          res?.medal || res?.award ? ` · ${res?.medal || res?.award}` : ""
        }`,
        status:
          res?.rank || res?.position
            ? `Rank ${res?.rank || res?.position}`
            : "Published",
      });
    }

    for (const booking of safeBookings) {
      items.push({
        type: "BOOKING",
        date: toDate(
          booking?.slotDate ||
            booking?.date ||
            booking?.bookingDate ||
            booking?.createdAt,
        ),
        title:
          booking?.activityName ||
          booking?.title ||
          booking?.academyName ||
          "Booking",
        subtitle: `${booking?.childName || booking?.participantName || "Child"}${
          booking?.slotTime ? ` · ${booking.slotTime}` : ""
        }`,
        status: booking?.status || "BOOKED",
      });
    }

    for (const n of safeNotifications) {
      items.push({
        type: "NOTICE",
        date: toDate(n?.createdAt || n?.date),
        title: n?.title || "Notification",
        subtitle: n?.message || "New update",
        status: isNotificationRead(n) ? "READ" : "UNREAD",
      });
    }

    return items
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date - a.date;
      })
      .slice(0, 12);
  }, [
    safeEvents,
    safeCertificates,
    safeResults,
    safeBookings,
    safeNotifications,
  ]);

  const filteredChildren = useMemo(() => {
    const s = String(search || "")
      .trim()
      .toLowerCase();

    return safeChildren.filter((child) => {
      if (childFilter !== "ALL") {
        const cid = normalizeId(getChildId(child));
        if (cid !== normalizeId(childFilter)) return false;
      }

      if (selectedChildId) {
        const cid = normalizeId(getChildId(child));
        if (cid !== normalizeId(selectedChildId)) return false;
      }

      if (!s) return true;

      const hay = [
        child?.name,
        child?.participantName,
        child?.childName,
        child?.user?.name,
        child?.groupName,
        child?.group?.name,
        child?.groupId?.name,
        child?.level,
        child?.group?.level,
        child?.groupId?.level,
        child?.bibNo,
        child?.parentEmail,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");

      return hay.includes(s);
    });
  }, [safeChildren, search, childFilter, selectedChildId]);

  const filteredEvents = useMemo(() => {
    const s = String(search || "")
      .trim()
      .toLowerCase();

    return safeEvents.filter((ev) => {
      if (!matchChildScope(ev, childFilter, selectedChildId)) return false;
      if (!s) return true;

      const hay = [
        ev?.name,
        ev?.title,
        ev?.venue,
        ev?.location,
        ev?.status,
        ev?.eventName,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");

      return hay.includes(s);
    });
  }, [safeEvents, search, childFilter, selectedChildId]);

  const filteredResults = useMemo(() => {
    const s = String(search || "")
      .trim()
      .toLowerCase();

    return safeResults.filter((r) => {
      if (!matchChildScope(r, childFilter, selectedChildId)) return false;
      if (!s) return true;

      const hay = [
        r?.childName,
        r?.participantName,
        r?.eventName,
        r?.groupName,
        r?.level,
        r?.activityName,
        r?.apparatusName,
        r?.medal,
        r?.award,
        r?.rank,
        r?.position,
        r?.total,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");

      return hay.includes(s);
    });
  }, [safeResults, search, childFilter, selectedChildId]);

  const filteredCertificates = useMemo(() => {
    const s = String(search || "")
      .trim()
      .toLowerCase();

    return safeCertificates.filter((c) => {
      if (!matchChildScope(c, childFilter, selectedChildId)) return false;
      if (!s) return true;

      const hay = [
        c?.title,
        c?.certificateTitle,
        c?.serialNo,
        c?.certificateNo,
        c?.participantName,
        c?.childName,
        c?.eventName,
        c?.status,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");

      return hay.includes(s);
    });
  }, [safeCertificates, search, childFilter, selectedChildId]);

  const filteredPayments = useMemo(() => {
    const s = String(search || "")
      .trim()
      .toLowerCase();

    return safePayments.filter((p) => {
      if (!matchChildScope(p, childFilter, selectedChildId)) return false;
      if (!s) return true;

      const hay = [
        p?.title,
        p?.description,
        p?.invoiceNo,
        p?.reference,
        p?.status,
        p?.paymentStatus,
        p?.childName,
        p?.participantName,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");

      return hay.includes(s);
    });
  }, [safePayments, search, childFilter, selectedChildId]);

  const filteredBookings = useMemo(() => {
    const s = String(search || "")
      .trim()
      .toLowerCase();

    return safeBookings.filter((b) => {
      if (!matchChildScope(b, childFilter, selectedChildId)) return false;
      if (!s) return true;

      const hay = [
        b?.academyName,
        b?.activityName,
        b?.childName,
        b?.participantName,
        b?.slotTime,
        b?.slotLabel,
        b?.status,
        b?.paymentStatus,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");

      return hay.includes(s);
    });
  }, [safeBookings, search, childFilter, selectedChildId]);

  const spotlightStats = useMemo(() => {
    if (!selectedChild) return null;

    const cid = normalizeId(getChildId(selectedChild));

    const childResults = safeResults.filter((r) =>
      matchChildScope(r, cid, cid),
    );
    const childCertificates = safeCertificates.filter((c) =>
      matchChildScope(c, cid, cid),
    );
    const childEvents = safeEvents.filter((e) => matchChildScope(e, cid, cid));
    const childPayments = safePayments.filter((p) =>
      matchChildScope(p, cid, cid),
    );
    const childBookings = safeBookings.filter((b) =>
      matchChildScope(b, cid, cid),
    );

    return {
      results: childResults.length,
      certificates: childCertificates.length,
      events: childEvents.length,
      bookings: childBookings.length,
      due: childPayments.reduce((sum, p) => {
        const status = String(
          p?.paymentStatus || p?.status || "",
        ).toUpperCase();
        if (status === "PAID" || status === "SUCCESS") return sum;

        const due = toMoney(
          p?.amountDue ??
            p?.dueAmount ??
            p?.balance ??
            p?.pendingAmount ??
            p?.amount ??
            p?.totalAmount ??
            0,
        );

        return sum + due;
      }, 0),
    };
  }, [
    selectedChild,
    safeResults,
    safeCertificates,
    safeEvents,
    safePayments,
    safeBookings,
  ]);

  const refreshAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    if (aliveRef.current) {
      setErr("");
      setMsg("");
    }

    try {
      const aggregate = await readParentAggregateDashboard();

      if (aggregate) {
        const nextChildren = normalizeChildrenData(
          aggregate?.children || aggregate?.participants || [],
        );
        const nextEvents = normalizeEventData(
          aggregate?.events || aggregate?.upcomingEvents || [],
        );
        const nextResults = normalizeResultData(
          aggregate?.results || aggregate?.latestResults || [],
        );
        const nextCertificates = normalizeCertificateData(
          aggregate?.certificates || aggregate?.recentCertificates || [],
        );
        const nextPayments = normalizePaymentData(
          aggregate?.payments || aggregate?.pendingPayments || [],
        );
        const nextNotifications = normalizeNotificationData(
          aggregate?.notifications || aggregate?.alerts || [],
        );
        const nextBookings = normalizeBookingData(
          aggregate?.bookings || aggregate?.reservations || [],
        );

        if (!aliveRef.current) return;

        setChildren(nextChildren);
        setEvents(nextEvents);
        setResults(nextResults);
        setCertificates(nextCertificates);
        setPayments(nextPayments);
        setNotifications(nextNotifications);
        setBookings(nextBookings);

        syncSelectedChildState(
          nextChildren,
          setSelectedChildId,
          setChildFilter,
        );
      } else {
        const [
          childrenRaw,
          eventsRaw,
          resultsRaw,
          certsRaw,
          paymentsRaw,
          notificationsRaw,
          bookingsRaw,
        ] = await Promise.allSettled([
          readApiList(["getParentChildren", "/parent/children"]),
          readApiList(["getParentEvents", "/parent/events"]),
          readApiList(["getParentResults", "/parent/results"]),
          readApiList(["getParentCertificates", "/parent/certificates"]),
          readApiList(["getParentPayments", "/parent/payments"]),
          readApiList(["getParentNotifications", "/parent/notifications"]),
          readApiList(["getParentBookings", "/parent/bookings"]),
        ]);

        if (!aliveRef.current) return;

        const nextChildren =
          childrenRaw.status === "fulfilled" ? childrenRaw.value : [];
        const nextEvents =
          eventsRaw.status === "fulfilled" ? eventsRaw.value : [];
        const nextResults =
          resultsRaw.status === "fulfilled" ? resultsRaw.value : [];
        const nextCerts = certsRaw.status === "fulfilled" ? certsRaw.value : [];
        const nextPayments =
          paymentsRaw.status === "fulfilled" ? paymentsRaw.value : [];
        const nextNotifications =
          notificationsRaw.status === "fulfilled" ? notificationsRaw.value : [];
        const nextBookings =
          bookingsRaw.status === "fulfilled" ? bookingsRaw.value : [];

        const normalizedChildren = normalizeChildrenData(nextChildren);

        setChildren(normalizedChildren);
        setEvents(normalizeEventData(nextEvents));
        setResults(normalizeResultData(nextResults));
        setCertificates(normalizeCertificateData(nextCerts));
        setPayments(normalizePaymentData(nextPayments));
        setNotifications(normalizeNotificationData(nextNotifications));
        setBookings(normalizeBookingData(nextBookings));

        syncSelectedChildState(
          normalizedChildren,
          setSelectedChildId,
          setChildFilter,
        );
      }
    } catch (e) {
      if (!aliveRef.current) return;
      setErr(e?.message || "Failed to load parent dashboard");
    } finally {
      if (!aliveRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshAll(false);
  }, [refreshAll]);

  async function openCertificate(item) {
    try {
      setErr("");
      setMsg("");

      const busyKey = normalizeId(item?._id || item?.id || item?.serialNo);
      setCertificateBusyId(busyKey);

      const childId = normalizeId(
        item?.childId ||
          item?.participantId ||
          item?.participant ||
          item?.child ||
          item?.participantId?._id ||
          item?.childId?._id ||
          item?.participant?._id ||
          item?.child?._id ||
          "",
      );

      const eventId = normalizeId(
        item?.eventId ||
          item?.event ||
          item?.eventId?._id ||
          item?.event?._id ||
          "",
      );

      const safeItem = {
        ...item,
        eventId,
        childId,
        participantId: childId,
      };

      if (hasValidId(eventId) && hasValidId(childId)) {
        if (typeof api?.openPublicCertificatePdf === "function") {
          await api.openPublicCertificatePdf(eventId, childId);
          if (aliveRef.current) setMsg("Certificate opened.");
          return;
        }

        if (typeof api?.openCertificatePdf === "function") {
          await api.openCertificatePdf(eventId, childId);
          if (aliveRef.current) setMsg("Certificate opened.");
          return;
        }
      }

      if (typeof api?.openParentCertificate === "function") {
        await api.openParentCertificate(safeItem);
        if (aliveRef.current) setMsg("Certificate opened.");
        return;
      }

      if (typeof api?.openParticipantCertificate === "function") {
        await api.openParticipantCertificate();
        if (aliveRef.current) setMsg("Certificate opened.");
        return;
      }

      if (item?.downloadUrl) {
        window.open(item.downloadUrl, "_blank", "noopener,noreferrer");
        if (aliveRef.current) setMsg("Certificate opened.");
        return;
      }

      throw new Error("Certificate event/child ID is missing or invalid.");
    } catch (e) {
      if (aliveRef.current) {
        setErr(e?.message || "Failed to open certificate");
      }
    } finally {
      if (aliveRef.current) setCertificateBusyId("");
    }
  }

  async function handlePayment(item) {
    try {
      setErr("");
      setMsg("");

      const payId = normalizeId(
        item?._id || item?.id || item?.invoiceNo || item?.reference,
      );
      setPaymentBusyId(payId);

      const status = String(
        item?.paymentStatus || item?.status || "",
      ).toUpperCase();

      if (status === "PAID" || status === "SUCCESS") {
        if (aliveRef.current) setMsg("This payment is already completed.");
        return;
      }

      if (typeof api?.startParentPayment === "function") {
        const res = await api.startParentPayment(payId, item);
        handlePaymentResponse(res);
        return;
      }

      if (typeof api?.initiateParentPayment === "function") {
        const res = await api.initiateParentPayment(payId, item);
        handlePaymentResponse(res);
        return;
      }

      if (typeof api?.payParentPayment === "function") {
        const res = await api.payParentPayment(payId, item);
        handlePaymentResponse(res);
        return;
      }

      if (typeof api?.createParentPaymentSession === "function") {
        const res = await api.createParentPaymentSession(payId, item);
        handlePaymentResponse(res);
        return;
      }

      if (typeof api?.post === "function") {
        const res = await api.post(
          `/parent/payments/${encodeURIComponent(payId)}/pay`,
          item || {},
        );
        handlePaymentResponse(res);
        return;
      }

      throw new Error("Payment action route is not available");
    } catch (e) {
      if (aliveRef.current) {
        setErr(e?.message || "Failed to start payment");
      }
    } finally {
      if (aliveRef.current) setPaymentBusyId("");
    }
  }

  async function openReceipt(item) {
    try {
      setErr("");
      setMsg("");

      const receiptId = normalizeId(
        item?._id || item?.id || item?.invoiceNo || item?.reference,
      );
      setReceiptBusyId(receiptId);

      if (typeof api?.openParentReceipt === "function") {
        await api.openParentReceipt(receiptId);
        if (aliveRef.current) setMsg("Receipt opened.");
        return;
      }

      if (typeof api?.openParentPaymentReceipt === "function") {
        await api.openParentPaymentReceipt(receiptId);
        if (aliveRef.current) setMsg("Receipt opened.");
        return;
      }

      if (item?.receiptUrl) {
        window.open(item.receiptUrl, "_blank", "noopener,noreferrer");
        if (aliveRef.current) setMsg("Receipt opened.");
        return;
      }

      throw new Error("Receipt route is not available");
    } catch (e) {
      if (aliveRef.current) {
        setErr(e?.message || "Failed to open receipt");
      }
    } finally {
      if (aliveRef.current) setReceiptBusyId("");
    }
  }

  async function handleInstallApp() {
    try {
      const prompt = deferredPromptRef.current;
      if (!prompt) return;

      prompt.prompt();
      await prompt.userChoice;
      deferredPromptRef.current = null;
      setInstallReady(false);
    } catch {
      // ignore
    }
  }

  function handlePaymentResponse(res) {
    const url =
      res?.paymentUrl ||
      res?.checkoutUrl ||
      res?.redirectUrl ||
      res?.url ||
      res?.data?.paymentUrl ||
      res?.data?.checkoutUrl ||
      res?.data?.redirectUrl ||
      res?.data?.url;

    if (url) {
      window.location.href = url;
      return;
    }

    if (aliveRef.current) {
      setMsg("Payment initiated successfully.");
    }
  }

  const tabs = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "children", label: "Children", icon: UsersRound },
    { key: "events", label: "Events", icon: CalendarDays },
    { key: "bookings", label: "Bookings", icon: BadgeCheck },
    { key: "results", label: "Results", icon: Trophy },
    { key: "certificates", label: "Certificates", icon: FileText },
    { key: "payments", label: "Payments", icon: Wallet },
  ];

  if (loading) {
    return (
      <section className="raParentShell" style={pageCssVars}>
        <StyleTag />
        <div className="raLoadingView">
          <div className="raLoadingCard">
            <BrandLogoBox branding={branding} size="xl" />
            <div className="raLoadingRing" />
            <h2>Loading {branding.siteName}</h2>
            <p>
              Preparing parent dashboard, payments, certificates and results.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="raParentShell" style={pageCssVars}>
      <StyleTag />

      <div className="raAppFrame">
        <aside className={`raSidebar ${mobileMenuOpen ? "open" : ""}`}>
          <div className="raSidebarBrand">
            <BrandLogoBox branding={branding} size="lg" />
            <div>
              <h2>{branding.siteName}</h2>
              <p>{branding.tagline || "Parent Portal"}</p>
            </div>
          </div>

          <div className="raSideHero">
            <span>Family Portal</span>
            <b>Track your child’s complete academy journey.</b>
          </div>

          <nav className="raNavList">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`raNavBtn ${tab === item.key ? "active" : ""}`}
                  onClick={() => {
                    setTab(item.key);
                    setMobileMenuOpen(false);
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </nav>

          <div className="raSecureBox">
            <ShieldCheck size={18} />
            <span>Secure parent visibility enabled</span>
          </div>
        </aside>

        <main className="raMainPanel">
          <header className="raHeader">
            <div className="raHeaderLeft">
              <button
                type="button"
                className="raMenuBtn"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div>
                <span className="raEyebrow">Parent Dashboard</span>
                <h1>{branding.siteName} Family Portal</h1>
              </div>
            </div>

            <div className="raHeaderActions">
              <button
                className="raActionBtn"
                type="button"
                onClick={() => refreshAll(true)}
                disabled={refreshing}
              >
                <RefreshCcw size={16} />
                {refreshing ? "Refreshing" : "Refresh"}
              </button>

              {installReady ? (
                <button
                  className="raActionBtn primary"
                  type="button"
                  onClick={handleInstallApp}
                >
                  <Download size={16} />
                  Install
                </button>
              ) : null}

              <button
                className="raActionBtn"
                type="button"
                onClick={() => navigate("/notifications")}
              >
                <Bell size={16} />
                Notices
                {unreadNotificationsCount ? (
                  <span className="raCounter">{unreadNotificationsCount}</span>
                ) : null}
              </button>

              <NotificationBell panelWidth={380} maxItems={8} />

              <button
                className="raActionBtn danger"
                type="button"
                onClick={() => {
                  if (typeof onLogout === "function") onLogout();
                }}
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </header>

          <section className="raHeroPanel">
            <div className="raHeroContent">
              <div className="raHeroBadge">
                <Sparkles size={10} />
                {String(branding.siteName || "Academy").toUpperCase()} DASHBOARD
              </div>

              <h1>Everything parents need in one clean portal.</h1>
              <p>
                View children, upcoming bookings, academy events, published
                results, downloadable certificates, payment records and live
                notifications.
              </p>

              <div className="raHeroButtons">
                <button
                  className="raPrimaryBtn"
                  type="button"
                  onClick={() => setTab("bookings")}
                >
                  <BadgeCheck size={18} />
                  View Bookings
                </button>
                <button
                  className="raDarkBtn"
                  type="button"
                  onClick={() => setTab("results")}
                >
                  <Trophy size={18} />
                  Check Results
                </button>
                <button
                  className="raLightBtn"
                  type="button"
                  onClick={() => navigate("/notifications")}
                >
                  <Bell size={18} />
                  Notifications
                </button>
              </div>
            </div>

            <div className="raHeroBrandCard">
              <BrandLogoBox branding={branding} size="xxl" />
              <b>{branding.siteName}</b>
              <span>{branding.tagline || "Parent Portal"}</span>
            </div>
          </section>

          {err ? (
            <div className="raAlert error">
              <X size={16} />
              {err}
            </div>
          ) : null}

          {msg ? (
            <div className="raAlert success">
              <BadgeCheck size={16} />
              {msg}
            </div>
          ) : null}

          <section className="raStatsGrid">
            <StatCard
              title="Children"
              value={safeChildren.length}
              icon={<UsersRound size={20} />}
            />
            <StatCard
              title="Upcoming Events"
              value={upcomingEvents.length}
              icon={<CalendarDays size={20} />}
            />
            <StatCard
              title="Active Certificates"
              value={activeCertificatesCount}
              icon={<FileText size={20} />}
            />
            <StatCard
              title="Outstanding Due"
              value={`QAR ${formatMoney(totalDue)}`}
              icon={<Wallet size={20} />}
              danger
            />
          </section>

          <section className="raMiniStatsGrid">
            <MiniStat
              label="Total Paid"
              value={`QAR ${formatMoney(totalPaid)}`}
              icon={<CreditCard size={16} />}
            />
            <MiniStat
              label="Medal Records"
              value={medalsCount}
              icon={<Medal size={16} />}
            />
            <MiniStat
              label="Payment Records"
              value={safePayments.length}
              icon={<Wallet size={16} />}
            />
            <MiniStat
              label="Unread Notices"
              value={unreadNotificationsCount}
              icon={<Bell size={16} />}
            />
          </section>

          {selectedChild && spotlightStats ? (
            <section className="raFocusPanel">
              <div className="raFocusLeft">
                <Avatar name={getChildName(selectedChild)} size="xl" />
                <div>
                  <span>Focused Child</span>
                  <h3>{getChildName(selectedChild)}</h3>
                  <p>
                    {selectedChild?.groupName ||
                      selectedChild?.group?.name ||
                      selectedChild?.groupId?.name ||
                      "No group"}
                    {selectedChild?.level ||
                    selectedChild?.group?.level ||
                    selectedChild?.groupId?.level
                      ? ` · ${
                          selectedChild?.level ||
                          selectedChild?.group?.level ||
                          selectedChild?.groupId?.level
                        }`
                      : ""}
                    {selectedChild?.bibNo
                      ? ` · BIB ${selectedChild.bibNo}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="raFocusMetrics">
                <Metric label="Events" value={spotlightStats.events} />
                <Metric label="Results" value={spotlightStats.results} />
                <Metric
                  label="Certificates"
                  value={spotlightStats.certificates}
                />
                <Metric label="Bookings" value={spotlightStats.bookings} />
                <Metric
                  label="Due"
                  value={`QAR ${formatMoney(spotlightStats.due)}`}
                />
              </div>

              <button
                className="raActionBtn"
                type="button"
                onClick={() => setSelectedChildId("")}
              >
                <X size={15} />
                Clear
              </button>
            </section>
          ) : null}

          <section className="raToolsBar">
            <div className="raSearchField">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search children, events, bookings, results, certificates, invoices..."
              />
              {search ? (
                <button type="button" onClick={() => setSearch("")}>
                  <X size={16} />
                </button>
              ) : null}
            </div>

            <div className="raSelectField">
              <Filter size={17} />
              <select
                value={childFilter}
                onChange={(e) => setChildFilter(e.target.value)}
              >
                <option value="ALL">All Children</option>
                {safeChildren.map((c) => {
                  const cid = normalizeId(getChildId(c));
                  return (
                    <option key={cid} value={cid}>
                      {getChildName(c)}
                    </option>
                  );
                })}
              </select>
            </div>
          </section>

          <section className="raMobileTabs">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={tab === item.key ? "active" : ""}
                  onClick={() => setTab(item.key)}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </section>

          {tab === "overview" ? (
            <OverviewTab
              filteredChildren={filteredChildren}
              upcomingEvents={upcomingEvents}
              upcomingBookings={upcomingBookings}
              latestResults={latestResults}
              activityFeed={activityFeed}
              safeResults={safeResults}
              safeCertificates={safeCertificates}
              safeBookings={safeBookings}
              safePayments={safePayments}
              activeCertificatesCount={activeCertificatesCount}
              totalPaid={totalPaid}
              totalDue={totalDue}
              unreadNotificationsCount={unreadNotificationsCount}
              selectedChildId={selectedChildId}
              setSelectedChildId={setSelectedChildId}
              setTab={setTab}
            />
          ) : null}

          {tab === "children" ? (
            <ChildrenTab
              filteredChildren={filteredChildren}
              safeResults={safeResults}
              safeEvents={safeEvents}
              safeCertificates={safeCertificates}
              safeBookings={safeBookings}
              selectedChildId={selectedChildId}
              setSelectedChildId={setSelectedChildId}
            />
          ) : null}

          {tab === "events" ? (
            <EventsTab filteredEvents={filteredEvents} />
          ) : null}

          {tab === "bookings" ? (
            <BookingsTab filteredBookings={filteredBookings} />
          ) : null}

          {tab === "results" ? (
            <ResultsTab filteredResults={filteredResults} />
          ) : null}

          {tab === "certificates" ? (
            <CertificatesTab
              filteredCertificates={filteredCertificates}
              certificateBusyId={certificateBusyId}
              openCertificate={openCertificate}
            />
          ) : null}

          {tab === "payments" ? (
            <PaymentsTab
              filteredPayments={filteredPayments}
              paymentBusyId={paymentBusyId}
              receiptBusyId={receiptBusyId}
              handlePayment={handlePayment}
              openReceipt={openReceipt}
            />
          ) : null}

          <footer className="raFooterBadges">
            <span>
              <Smartphone size={14} />
              Responsive
            </span>
            <span>
              <ShieldCheck size={14} />
              Secure visibility
            </span>
            <span>
              <HeartHandshake size={14} />
              Admin branding
            </span>
            <span>
              <Bell size={14} />
              Notifications
            </span>
          </footer>
        </main>
      </div>
    </section>
  );
}

function OverviewTab({
  filteredChildren,
  upcomingEvents,
  upcomingBookings,
  latestResults,
  activityFeed,
  safeResults,
  safeCertificates,
  safeBookings,
  safePayments,
  activeCertificatesCount,
  totalPaid,
  totalDue,
  unreadNotificationsCount,
  selectedChildId,
  setSelectedChildId,
  setTab,
}) {
  return (
    <div className="raOverviewGrid">
      <Panel
        title="Children Summary"
        icon={<UsersRound size={18} />}
        action={
          <button
            className="raPanelAction"
            type="button"
            onClick={() => setTab("children")}
          >
            View all
          </button>
        }
      >
        {filteredChildren.length ? (
          <div className="raChildList">
            {filteredChildren.slice(0, 6).map((child, idx) => {
              const cid = normalizeId(getChildId(child));
              const childResults = safeResults.filter((r) =>
                matchChildScope(r, cid, cid),
              );
              const childCertificates = safeCertificates.filter((c) =>
                matchChildScope(c, cid, cid),
              );
              const childBookings = safeBookings.filter((b) =>
                matchChildScope(b, cid, cid),
              );

              return (
                <button
                  key={keyOf(child, idx)}
                  className={`raChildRow ${selectedChildId === cid ? "active" : ""}`}
                  type="button"
                  onClick={() =>
                    setSelectedChildId((prev) => (prev === cid ? "" : cid))
                  }
                >
                  <Avatar name={getChildName(child)} />
                  <div>
                    <b>{getChildName(child)}</b>
                    <span>
                      {child?.groupName ||
                        child?.group?.name ||
                        child?.groupId?.name ||
                        "No group"}
                      {child?.level ||
                      child?.group?.level ||
                      child?.groupId?.level
                        ? ` · ${child?.level || child?.group?.level || child?.groupId?.level}`
                        : ""}
                    </span>
                  </div>
                  <div className="raChildCounters">
                    <small>{childResults.length} Results</small>
                    <small>{childCertificates.length} Certs</small>
                    <small>{childBookings.length} Bookings</small>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyBox text="No children linked to this parent account." />
        )}
      </Panel>

      <Panel title="Upcoming Events" icon={<CalendarDays size={18} />}>
        {upcomingEvents.length ? (
          <div className="raTimeline">
            {upcomingEvents.slice(0, 6).map((ev, idx) => (
              <TimelineItem
                key={keyOf(ev, idx)}
                title={
                  ev?.name || ev?.title || ev?.eventName || "Untitled Event"
                }
                date={
                  ev?.startDate || ev?.date || ev?.eventDate || ev?.startsAt
                }
                location={ev?.venue || ev?.location || "Venue TBA"}
                status={ev?.status || "UPCOMING"}
              />
            ))}
          </div>
        ) : (
          <EmptyBox text="No upcoming events right now." />
        )}
      </Panel>

      <Panel title="Upcoming Bookings" icon={<BadgeCheck size={18} />}>
        {upcomingBookings.length ? (
          <div className="raCompactList">
            {upcomingBookings.map((b, idx) => (
              <CompactItem
                key={keyOf(b, idx)}
                title={b?.activityName || b?.title || "Booked Activity"}
                subtitle={`${b?.childName || b?.participantName || "Child"}${
                  b?.academyName ? ` · ${b.academyName}` : ""
                }${b?.slotTime ? ` · ${b.slotTime}` : ""}`}
                right={
                  <>
                    <StatusBadge value={b?.status || "BOOKED"} />
                    <span className="raDatePill">
                      {formatDate(
                        b?.slotDate ||
                          b?.date ||
                          b?.bookingDate ||
                          b?.startDate ||
                          b?.startsAt,
                      )}
                    </span>
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyBox text="No bookings found yet." />
        )}
      </Panel>

      <Panel title="Latest Results" icon={<Trophy size={18} />}>
        {latestResults.length ? (
          <div className="raCompactList">
            {latestResults.map((r, idx) => (
              <CompactItem
                key={keyOf(r, idx)}
                title={r?.eventName || r?.title || "Result"}
                subtitle={`${r?.childName || r?.participantName || "Child"} · ${
                  r?.activityName || r?.apparatusName || "Activity"
                }`}
                right={
                  <>
                    {r?.rank || r?.position ? (
                      <span className="raRankPill">
                        #{r?.rank || r?.position}
                      </span>
                    ) : null}
                    {r?.medal || r?.award ? (
                      <MedalBadge value={r?.medal || r?.award} />
                    ) : null}
                    {r?.total !== undefined && r?.total !== null ? (
                      <span className="raTotalPill">{r.total}</span>
                    ) : null}
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyBox text="No results available yet." />
        )}
      </Panel>

      <Panel title="Finance & Certificates" icon={<Wallet size={18} />}>
        <div className="raSummaryTiles">
          <SummaryTile
            label="Active Certificates"
            value={activeCertificatesCount}
            icon={<FileText size={16} />}
          />
          <SummaryTile
            label="Payment Records"
            value={safePayments.length}
            icon={<CreditCard size={16} />}
          />
          <SummaryTile
            label="Total Paid"
            value={`QAR ${formatMoney(totalPaid)}`}
            icon={<Wallet size={16} />}
          />
          <SummaryTile
            label="Outstanding Due"
            value={`QAR ${formatMoney(totalDue)}`}
            icon={<Wallet size={16} />}
            danger
          />
          <SummaryTile
            label="Unread Notices"
            value={unreadNotificationsCount}
            icon={<Bell size={16} />}
          />
        </div>
      </Panel>

      <Panel title="Recent Activity" icon={<Sparkles size={18} />}>
        {activityFeed.length ? (
          <div className="raActivityFeed">
            {activityFeed.map((item, idx) => (
              <div key={keyOf(item, idx)} className="raActivityRow">
                <span
                  className={`raTypeBadge ${String(item.type || "").toLowerCase()}`}
                >
                  {item.type}
                </span>
                <div>
                  <b>{item.title}</b>
                  <p>{item.subtitle || "—"}</p>
                </div>
                <div className="raActivityRight">
                  <span>{item.date ? formatDate(item.date) : "—"}</span>
                  <StatusBadge value={item.status || "INFO"} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBox text="No recent activity." />
        )}
      </Panel>
    </div>
  );
}

function ChildrenTab({
  filteredChildren,
  safeResults,
  safeEvents,
  safeCertificates,
  safeBookings,
  selectedChildId,
  setSelectedChildId,
}) {
  return (
    <Panel title="Children" icon={<UsersRound size={18} />}>
      {filteredChildren.length ? (
        <div className="raCardGrid">
          {filteredChildren.map((child, idx) => {
            const cid = normalizeId(getChildId(child));
            const childResults = safeResults.filter((r) =>
              matchChildScope(r, cid, cid),
            );
            const childEvents = safeEvents.filter((e) =>
              matchChildScope(e, cid, cid),
            );
            const childCertificates = safeCertificates.filter((c) =>
              matchChildScope(c, cid, cid),
            );
            const childBookings = safeBookings.filter((b) =>
              matchChildScope(b, cid, cid),
            );

            return (
              <div key={keyOf(child, idx)} className="raDetailCard">
                <div className="raDetailHead">
                  <div className="raIdentity">
                    <Avatar name={getChildName(child)} size="lg" />
                    <div>
                      <h3>{getChildName(child)}</h3>
                      <p>
                        {child?.groupName ||
                          child?.group?.name ||
                          child?.groupId?.name ||
                          "No group"}
                        {child?.level ||
                        child?.group?.level ||
                        child?.groupId?.level
                          ? ` · ${child?.level || child?.group?.level || child?.groupId?.level}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    className={`raActionBtn ${selectedChildId === cid ? "primary" : ""}`}
                    type="button"
                    onClick={() =>
                      setSelectedChildId((prev) => (prev === cid ? "" : cid))
                    }
                  >
                    {selectedChildId === cid ? "Focused" : "Focus"}
                  </button>
                </div>

                <div className="raInfoGrid">
                  <InfoItem label="Age" value={child?.age ?? "—"} />
                  <InfoItem label="BIB No" value={child?.bibNo || "—"} />
                  <InfoItem
                    label="Parent Email"
                    value={
                      child?.parentEmail ||
                      child?.parentUserId?.email ||
                      child?.parent?.email ||
                      "—"
                    }
                  />
                  <InfoItem
                    label="Status"
                    value={child?.isActive === false ? "Inactive" : "Active"}
                  />
                </div>

                <div className="raMetricStrip">
                  <Metric label="Events" value={childEvents.length} />
                  <Metric label="Results" value={childResults.length} />
                  <Metric label="Bookings" value={childBookings.length} />
                  <Metric
                    label="Certificates"
                    value={childCertificates.length}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyBox text="No children linked to this parent account. Please contact academy admin." />
      )}
    </Panel>
  );
}

function EventsTab({ filteredEvents }) {
  return (
    <Panel title="Events" icon={<CalendarDays size={18} />}>
      {filteredEvents.length ? (
        <div className="raCardGrid">
          {filteredEvents.map((ev, idx) => (
            <div key={keyOf(ev, idx)} className="raEventCard">
              <div className="raCardIcon">
                <CalendarDays size={20} />
              </div>
              <h3>
                {ev?.name || ev?.title || ev?.eventName || "Untitled Event"}
              </h3>
              <div className="raMetaStack">
                <span>
                  <CalendarDays size={14} />
                  {formatDate(
                    ev?.startDate || ev?.date || ev?.eventDate || ev?.startsAt,
                  )}
                </span>
                <span>
                  <Home size={14} />
                  {ev?.venue || ev?.location || "Venue TBA"}
                </span>
              </div>
              <div className="raCardFoot">
                <StatusBadge value={ev?.status || "UPCOMING"} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyBox text="No events found for the selected filter." />
      )}
    </Panel>
  );
}

function BookingsTab({ filteredBookings }) {
  return (
    <Panel title="Bookings" icon={<BadgeCheck size={18} />}>
      {filteredBookings.length ? (
        <div className="raCardGrid">
          {filteredBookings.map((b, idx) => (
            <div key={keyOf(b, idx)} className="raEventCard">
              <div className="raCardIcon">
                <BadgeCheck size={20} />
              </div>
              <h3>{b?.activityName || b?.title || "Booked Activity"}</h3>
              <div className="raMetaStack">
                <span>
                  <UserRound size={14} />
                  {b?.childName || b?.participantName || "Child"}
                </span>
                <span>
                  <CalendarDays size={14} />
                  {formatDate(
                    b?.slotDate ||
                      b?.date ||
                      b?.bookingDate ||
                      b?.startDate ||
                      b?.startsAt,
                  )}
                </span>
                <span>
                  <Home size={14} />
                  {b?.academyName || b?.venue || "Academy"}
                </span>
              </div>
              <div className="raCardFoot">
                <StatusBadge value={b?.status || "BOOKED"} />
                <StatusBadge value={b?.paymentStatus || "PENDING"} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyBox text="No bookings found for the selected filter." />
      )}
    </Panel>
  );
}

function ResultsTab({ filteredResults }) {
  return (
    <Panel title="Results" icon={<Trophy size={18} />}>
      {filteredResults.length ? (
        <>
          <div className="raSectionIntro">
            <div>
              <b>{filteredResults.length}</b> result record
              {filteredResults.length === 1 ? "" : "s"} found.
            </div>
            <span>
              View apparatus, rank, medal and total score for each child.
            </span>
          </div>

          <div className="raResultsTable">
            <div className="raResultsHead">
              <div>Child</div>
              <div>Event</div>
              <div>Group</div>
              <div>Activity</div>
              <div>Rank</div>
              <div>Medal</div>
              <div>Total</div>
            </div>
            {filteredResults.map((r, idx) => (
              <ResultTableRow key={keyOf(r, idx)} r={r} />
            ))}
          </div>

          <div className="raResultCards">
            {filteredResults.map((r, idx) => (
              <ResultCard key={keyOf(r, idx)} r={r} />
            ))}
          </div>
        </>
      ) : (
        <EmptyBox text="No results found for the selected filter." />
      )}
    </Panel>
  );
}

function ResultTableRow({ r }) {
  const childName = r?.childName || r?.participantName || "—";
  const eventName = r?.eventName || r?.eventTitle || "—";
  const groupName = r?.groupName || r?.level || "—";
  const activityName = r?.activityName || r?.apparatusName || "—";
  const rankValue = r?.rank ?? r?.position ?? null;
  const medalValue = r?.medal || r?.award || "";
  const totalValue = r?.total ?? r?.score ?? "—";

  return (
    <div className="raResultsRow">
      <div>
        <b>{childName}</b>
        <span>{r?.bibNo ? `BIB ${r.bibNo}` : "Child"}</span>
      </div>
      <div>
        <b>{eventName}</b>
        <span>
          {formatDate(r?.eventDate || r?.date || r?.createdAt || r?.updatedAt)}
        </span>
      </div>
      <div>
        <span className="raSoftPill">{groupName}</span>
      </div>
      <div>
        <span className="raSoftPill red">{activityName}</span>
      </div>
      <div>
        {rankValue ? (
          <span className="raRankPill">#{rankValue}</span>
        ) : (
          <span className="raMuted">—</span>
        )}
      </div>
      <div>
        {medalValue ? (
          <MedalBadge value={medalValue} />
        ) : (
          <span className="raMuted">—</span>
        )}
      </div>
      <div>
        <span className="raTotalPill">{totalValue}</span>
      </div>
    </div>
  );
}

function ResultCard({ r }) {
  const childName = r?.childName || r?.participantName || "—";
  const eventName = r?.eventName || r?.eventTitle || "—";
  const groupName = r?.groupName || r?.level || "—";
  const activityName = r?.activityName || r?.apparatusName || "—";
  const rankValue = r?.rank ?? r?.position ?? null;
  const medalValue = r?.medal || r?.award || "";
  const totalValue = r?.total ?? r?.score ?? "—";

  return (
    <div className="raResultCard">
      <div className="raResultTop">
        <div>
          <h3>{childName}</h3>
          <p>{eventName}</p>
        </div>
        <div className="raScoreBox">
          <span>Total</span>
          <b>{totalValue}</b>
        </div>
      </div>
      <div className="raInfoGrid">
        <InfoItem label="Group" value={groupName} />
        <InfoItem label="Activity" value={activityName} />
        <InfoItem label="Rank" value={rankValue ? `#${rankValue}` : "—"} />
        <InfoItem label="Medal" value={medalValue || "—"} />
      </div>
      <div className="raResultFoot">
        {medalValue ? (
          <MedalBadge value={medalValue} />
        ) : (
          <span className="raSoftPill">Participation</span>
        )}
        <span>
          {formatDate(r?.eventDate || r?.date || r?.createdAt || r?.updatedAt)}
        </span>
      </div>
    </div>
  );
}

function CertificatesTab({
  filteredCertificates,
  certificateBusyId,
  openCertificate,
}) {
  return (
    <Panel title="Certificates" icon={<FileText size={18} />}>
      {filteredCertificates.length ? (
        <div className="raCardGrid">
          {filteredCertificates.map((c, idx) => {
            const busyId = normalizeId(c?._id || c?.id || c?.serialNo);
            return (
              <div key={keyOf(c, idx)} className="raEventCard">
                <div className="raCardIcon">
                  <Award size={20} />
                </div>
                <h3>{c?.title || c?.certificateTitle || "Certificate"}</h3>
                <div className="raMetaStack">
                  <span>
                    <UserRound size={14} />
                    {c?.childName || c?.participantName || "Child"}
                  </span>
                  <span>
                    <CalendarDays size={14} />
                    {formatDate(c?.issuedAt || c?.createdAt || c?.date)}
                  </span>
                  <span>
                    <FileText size={14} />
                    Serial: {c?.serialNo || c?.certificateNo || "—"}
                  </span>
                </div>
                <div className="raCardFoot">
                  <StatusBadge value={c?.status || "ACTIVE"} />
                  <button
                    className="raPrimaryBtn small"
                    type="button"
                    onClick={() => openCertificate(c)}
                    disabled={certificateBusyId === busyId}
                  >
                    <ExternalLink size={15} />
                    {certificateBusyId === busyId ? "Opening" : "Open"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyBox text="No certificates found for the selected filter." />
      )}
    </Panel>
  );
}

function PaymentsTab({
  filteredPayments,
  paymentBusyId,
  receiptBusyId,
  handlePayment,
  openReceipt,
}) {
  return (
    <Panel title="Payments" icon={<Wallet size={18} />}>
      {filteredPayments.length ? (
        <>
          <div className="raPaymentsTable">
            <div className="raPaymentsHead">
              <div>Payment</div>
              <div>Child</div>
              <div>Status</div>
              <div>Amount</div>
              <div>Due</div>
              <div>Actions</div>
            </div>
            {filteredPayments.map((p, idx) => (
              <PaymentTableRow
                key={keyOf(p, idx)}
                p={p}
                idx={idx}
                paymentBusyId={paymentBusyId}
                receiptBusyId={receiptBusyId}
                handlePayment={handlePayment}
                openReceipt={openReceipt}
              />
            ))}
          </div>

          <div className="raPaymentCards">
            {filteredPayments.map((p, idx) => (
              <PaymentCard
                key={keyOf(p, idx)}
                p={p}
                idx={idx}
                paymentBusyId={paymentBusyId}
                receiptBusyId={receiptBusyId}
                handlePayment={handlePayment}
                openReceipt={openReceipt}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyBox text="No payments found for the selected filter." />
      )}
    </Panel>
  );
}

function PaymentTableRow({
  p,
  idx,
  paymentBusyId,
  receiptBusyId,
  handlePayment,
  openReceipt,
}) {
  const amount = toMoney(p?.amount ?? p?.paidAmount ?? p?.totalAmount ?? 0);
  const due = toMoney(p?.amountDue ?? p?.dueAmount ?? p?.balance ?? 0);
  const rowId = normalizeId(
    p?._id || p?.id || p?.invoiceNo || p?.reference || idx,
  );
  const status = String(
    p?.paymentStatus || p?.status || "PENDING",
  ).toUpperCase();
  const canPay = status !== "PAID" && status !== "SUCCESS";

  return (
    <div className="raPaymentsRow">
      <div>
        <b>{p?.title || p?.description || p?.invoiceNo || "Payment"}</b>
        <span>{p?.invoiceNo || p?.reference || "—"}</span>
      </div>
      <div>{p?.childName || p?.participantName || "—"}</div>
      <div>
        <StatusBadge value={p?.paymentStatus || p?.status || "PENDING"} />
      </div>
      <div>QAR {formatMoney(amount)}</div>
      <div>QAR {formatMoney(due)}</div>
      <div className="raRowActions">
        <button
          className="raPrimaryBtn small"
          type="button"
          onClick={() => handlePayment(p)}
          disabled={!canPay || paymentBusyId === rowId}
        >
          <Wallet size={15} />
          {paymentBusyId === rowId ? "Starting" : "Pay"}
        </button>
        <button
          className="raActionBtn small"
          type="button"
          onClick={() => openReceipt(p)}
          disabled={receiptBusyId === rowId}
        >
          <ExternalLink size={15} />
          {receiptBusyId === rowId ? "Opening" : "Receipt"}
        </button>
      </div>
    </div>
  );
}

function PaymentCard({
  p,
  idx,
  paymentBusyId,
  receiptBusyId,
  handlePayment,
  openReceipt,
}) {
  const amount = toMoney(p?.amount ?? p?.paidAmount ?? p?.totalAmount ?? 0);
  const due = toMoney(p?.amountDue ?? p?.dueAmount ?? p?.balance ?? 0);
  const rowId = normalizeId(
    p?._id || p?.id || p?.invoiceNo || p?.reference || idx,
  );
  const status = String(
    p?.paymentStatus || p?.status || "PENDING",
  ).toUpperCase();
  const canPay = status !== "PAID" && status !== "SUCCESS";

  return (
    <div className="raDetailCard">
      <div className="raPaymentCardTop">
        <div>
          <h3>{p?.title || p?.description || p?.invoiceNo || "Payment"}</h3>
          <p>{p?.childName || p?.participantName || "—"}</p>
        </div>
        <StatusBadge value={p?.paymentStatus || p?.status || "PENDING"} />
      </div>
      <div className="raInfoGrid">
        <InfoItem label="Amount" value={`QAR ${formatMoney(amount)}`} />
        <InfoItem label="Due" value={`QAR ${formatMoney(due)}`} />
        <InfoItem label="Invoice" value={p?.invoiceNo || "—"} />
        <InfoItem label="Reference" value={p?.reference || "—"} />
      </div>
      <div className="raRowActions stretch">
        <button
          className="raPrimaryBtn"
          type="button"
          onClick={() => handlePayment(p)}
          disabled={!canPay || paymentBusyId === rowId}
        >
          <Wallet size={15} />
          {paymentBusyId === rowId ? "Starting" : "Pay Now"}
        </button>
        <button
          className="raActionBtn"
          type="button"
          onClick={() => openReceipt(p)}
          disabled={receiptBusyId === rowId}
        >
          <ExternalLink size={15} />
          {receiptBusyId === rowId ? "Opening" : "Receipt"}
        </button>
      </div>
    </div>
  );
}

/* -------------------- API helpers -------------------- */

async function getAdminBrandingSettings() {
  try {
    // ✅ Parent/public users must only call public settings.
    // ❌ Do not call /admin/settings from Parent Dashboard.
    if (typeof api?.get === "function") {
      return await api.get("/public/settings");
    }

    if (typeof api?.getPublicSettings === "function") {
      return await api.getPublicSettings();
    }

    return {};
  } catch (e) {
    // ✅ Silent fallback: localStorage logo/accent will still work.
    console.warn("Public branding settings failed:", e?.message || e);
    return {};
  }
}

async function readParentAggregateDashboard() {
  try {
    if (typeof api?.getParentDashboard === "function") {
      const res = await api.getParentDashboard();
      return res?.data || res;
    }
  } catch {
    // fallback below
  }

  try {
    if (typeof api?.get === "function") {
      const res = await api.get("/parent/dashboard");
      return res?.data || res;
    }
  } catch {
    return null;
  }

  return null;
}

async function readApiList([methodName, fallbackPath]) {
  try {
    if (typeof api?.[methodName] === "function") {
      const res = await api[methodName]();
      return normalizeApiPayload(res);
    }
  } catch {
    // fallback below
  }

  if (typeof api?.get === "function" && fallbackPath) {
    const res = await api.get(fallbackPath);
    return normalizeApiPayload(res);
  }

  return [];
}

function normalizeApiPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.children)) return payload.children;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.certificates)) return payload.certificates;
  if (Array.isArray(payload?.payments)) return payload.payments;
  if (Array.isArray(payload?.notifications)) return payload.notifications;
  if (Array.isArray(payload?.bookings)) return payload.bookings;
  if (payload?.data && Array.isArray(payload.data)) return payload.data;
  if (payload?.data?.items && Array.isArray(payload.data.items))
    return payload.data.items;
  return [];
}

function normalizeChildrenData(list) {
  return normalizeArray(list).map((c) => ({
    ...c,
    _id: normalizeId(c?._id || c?.id || c?.participantId || c?.childId),
    childId: normalizeId(c?.childId || c?._id || c?.id || c?.participantId),
    participantId: normalizeId(c?.participantId || c?._id || c?.id),
    name:
      c?.name || c?.participantName || c?.childName || c?.user?.name || "Child",
    childName:
      c?.childName || c?.name || c?.participantName || c?.user?.name || "Child",
  }));
}

function normalizeEventData(list) {
  return normalizeArray(list).map((e) => ({
    ...e,
    childId: normalizeId(
      e?.childId || e?.participantId || e?.child?._id || e?.participant?._id,
    ),
    childName:
      e?.childName ||
      e?.participantName ||
      e?.participant?.name ||
      e?.child?.name ||
      "",
  }));
}

function normalizeResultData(list) {
  return normalizeArray(list).map((r) => ({
    ...r,
    childId: normalizeId(
      r?.childId || r?.participantId || r?.participant?._id || r?.child?._id,
    ),
    childName:
      r?.childName ||
      r?.participantName ||
      r?.participant?.name ||
      r?.child?.name ||
      "",
  }));
}

function normalizeCertificateData(list) {
  return normalizeArray(list).map((c) => ({
    ...c,
    childId: normalizeId(
      c?.childId || c?.participantId || c?.participant?._id || c?.child?._id,
    ),
    childName:
      c?.childName ||
      c?.participantName ||
      c?.participant?.name ||
      c?.child?.name ||
      "",
  }));
}

function normalizePaymentData(list) {
  return normalizeArray(list).map((p) => ({
    ...p,
    childId: normalizeId(
      p?.childId || p?.participantId || p?.participant?._id || p?.child?._id,
    ),
    childName:
      p?.childName ||
      p?.participantName ||
      p?.participant?.name ||
      p?.child?.name ||
      "",
  }));
}

function normalizeNotificationData(list) {
  return normalizeArray(list).map((n) => ({
    ...n,
    childId: normalizeId(
      n?.childId || n?.participantId || n?.participant?._id || n?.child?._id,
    ),
    childName:
      n?.childName ||
      n?.participantName ||
      n?.participant?.name ||
      n?.child?.name ||
      "",
  }));
}

function normalizeBookingData(list) {
  return normalizeArray(list).map((b) => ({
    ...b,
    childId: normalizeId(
      b?.childId || b?.participantId || b?.participant?._id || b?.child?._id,
    ),
    childName:
      b?.childName ||
      b?.participantName ||
      b?.participant?.name ||
      b?.child?.name ||
      "",
  }));
}

function syncSelectedChildState(
  nextChildren,
  setSelectedChildId,
  setChildFilter,
) {
  const firstChildId = normalizeId(getChildId(nextChildren?.[0]));

  setSelectedChildId((prev) => {
    if (!prev) return "";
    const exists = nextChildren.some(
      (c) => normalizeId(getChildId(c)) === normalizeId(prev),
    );
    return exists ? prev : "";
  });

  setChildFilter((prev) => {
    if (prev === "ALL") return "ALL";
    const exists = nextChildren.some(
      (c) => normalizeId(getChildId(c)) === normalizeId(prev),
    );
    return exists ? prev : firstChildId || "ALL";
  });
}

/* -------------------- Components -------------------- */

function BrandLogoBox({ branding, size = "md" }) {
  const [candidateIndex, setCandidateIndex] = useState(0);

  const candidates = useMemo(() => {
    const list = Array.isArray(branding?.logoUrlCandidates)
      ? branding.logoUrlCandidates
      : [];
    return [...new Set([branding?.logoUrl, ...list].filter(Boolean))];
  }, [branding?.logoUrl, branding?.logoUrlCandidates]);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidates.join("|")]);

  const logoUrl = candidates[candidateIndex] || "";

  return (
    <div className={`raLogoBox ${size}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={branding?.siteName || "Brand logo"}
          onError={() => {
            console.warn("Parent dashboard logo failed:", logoUrl);
            setCandidateIndex((idx) => idx + 1);
          }}
        />
      ) : (
        <span>{getBrandInitials(branding?.siteName)}</span>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, danger = false }) {
  return (
    <div className={`raStatCard ${danger ? "danger" : ""}`}>
      <div className="raStatIcon">{icon}</div>
      <span>{title}</span>
      <b>{value}</b>
    </div>
  );
}

function MiniStat({ label, value, icon }) {
  return (
    <div className="raMiniStat">
      <span>
        {icon}
        {label}
      </span>
      <b>{value}</b>
    </div>
  );
}

function Panel({ title, icon, action, children }) {
  return (
    <section className="raPanel">
      <div className="raPanelHead">
        <div className="raPanelTitle">
          <span>{icon}</span>
          {title}
        </div>
        {action || null}
      </div>
      <div className="raPanelBody">{children}</div>
    </section>
  );
}

function EmptyBox({ text }) {
  return (
    <div className="raEmpty">
      <Sparkles size={24} />
      <span>{text}</span>
    </div>
  );
}

function SummaryTile({ label, value, icon, danger = false }) {
  return (
    <div className={`raSummaryTile ${danger ? "danger" : ""}`}>
      <span>
        {icon}
        {label}
      </span>
      <b>{value}</b>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="raInfoItem">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="raMetric">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Avatar({ name, size = "" }) {
  return <div className={`raAvatar ${size}`}>{initials(name)}</div>;
}

function CompactItem({ title, subtitle, right }) {
  return (
    <div className="raCompactItem">
      <div>
        <b>{title}</b>
        <p>{subtitle}</p>
      </div>
      <div className="raCompactRight">{right}</div>
    </div>
  );
}

function TimelineItem({ title, date, location, status }) {
  return (
    <div className="raTimelineItem">
      <div className="raTimelineRail">
        <span />
      </div>
      <div className="raTimelineCard">
        <div className="raTimelineTop">
          <b>{title}</b>
          <StatusBadge value={status} />
        </div>
        <div className="raMetaLine">
          <span>
            <CalendarDays size={13} />
            {formatDate(date)}
          </span>
          <span>
            <Home size={13} />
            {location}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ value }) {
  return (
    <span className={`raStatus ${statusTone(value)}`}>
      {String(value || "INFO")}
    </span>
  );
}

function MedalBadge({ value }) {
  return (
    <span className={`raMedal ${medalTone(value)}`}>
      <Medal size={13} />
      {value}
    </span>
  );
}

/* -------------------- Helpers -------------------- */

function normalizeArray(v) {
  return Array.isArray(v) ? v : [];
}
function normalizeId(v) {
  if (!v) return "";

  if (typeof v === "object") {
    return String(
      v._id ||
        v.id ||
        v.value ||
        v.eventId ||
        v.participantId ||
        v.childId ||
        "",
    ).trim();
  }

  return String(v).trim();
}

function hasValidId(v) {
  const id = normalizeId(v);
  return (
    !!id && id !== "[object Object]" && id !== "undefined" && id !== "null"
  );
}

function getChildId(item) {
  return (
    item?._id ||
    item?.id ||
    item?.participantId?._id ||
    item?.participantId ||
    item?.childId?._id ||
    item?.childId ||
    item?.child?._id ||
    item?.child ||
    ""
  );
}

function getChildName(item) {
  return (
    item?.name ||
    item?.participantName ||
    item?.childName ||
    item?.user?.name ||
    item?.participant?.name ||
    "Child"
  );
}

function matchChildScope(item, childFilter, selectedChildId) {
  const scopedId = selectedChildId || childFilter;
  if (!scopedId || scopedId === "ALL") return true;

  const normalizedScoped = normalizeId(scopedId);

  const possibleIds = [
    item?.childId,
    item?.childId?._id,
    item?.participantId,
    item?.participantId?._id,
    item?.participant,
    item?.participant?._id,
    item?.child,
    item?.child?._id,
    item?.userId,
    item?.userId?._id,
    item?.participantUserId,
    item?.participantUserId?._id,
    item?.childUserId,
    item?.childUserId?._id,
    item?._id,
    item?.id,
  ].map((x) => normalizeId(x));

  return possibleIds.some((id) => id === normalizedScoped);
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDate(v) {
  const d = toDate(v);
  if (!d) return "Date TBA";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toMoney(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(v) {
  return Number(v || 0).toFixed(2);
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "RA";
  return parts.map((x) => x[0]?.toUpperCase()).join("");
}

function getBrandInitials(name) {
  const parts = String(name || "Rebel Angels")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "RA";
  return parts.map((x) => x[0]?.toUpperCase()).join("");
}

function readBrowserStorage(key, fallback = "") {
  try {
    if (typeof window === "undefined") return fallback;
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function unwrapSettingsPayload(payload) {
  const first = payload?.data || payload || {};
  return (
    first?.settings ||
    first?.appSettings ||
    first?.publicSettings ||
    first?.brandingSettings ||
    first?.branding ||
    first?.brand ||
    first?.data?.settings ||
    first?.data?.appSettings ||
    first?.data?.publicSettings ||
    first?.data?.brandingSettings ||
    first?.data?.branding ||
    first?.data?.brand ||
    first?.data ||
    first ||
    {}
  );
}

function findFirstDeepValue(source, keys) {
  const wanted = new Set(keys.map((k) => String(k).toLowerCase()));
  const queue = [source];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (wanted.has(String(key).toLowerCase()) && value) return value;
      if (value && typeof value === "object") queue.push(value);
    }
  }

  return "";
}

function pickAssetUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return (
      value.url ||
      value.path ||
      value.src ||
      value.fileUrl ||
      value.location ||
      value.secure_url ||
      value.filename ||
      value.name ||
      ""
    );
  }
  return "";
}

function resolveAssetUrlCandidates(url) {
  const raw = String(url || "").trim();
  if (!raw) return [];
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return [raw];

  const apiBase = String(import.meta.env.VITE_API_BASE || "")
    .replace(/\/api\/?$/i, "")
    .replace(/\/+$/, "");

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const clean = raw
    .replace(/^public[\/]/i, "")
    .replace(/^server[\/]/i, "")
    .replace(/^src[\/]/i, "")
    .replace(/^client[\/]/i, "")
    .replace(/\\\\/g, "/")
    .replace(/^\/+/, "");

  const paths = [
    clean,
    clean.startsWith("uploads/") ? clean : `uploads/${clean}`,
    clean.startsWith("api/uploads/") ? clean : `api/uploads/${clean}`,
  ];

  const bases = [apiBase, origin].filter(Boolean);
  const candidates = [];

  for (const base of bases) {
    for (const path of paths) candidates.push(`${base}/${path}`);
  }

  candidates.push(`/${clean}`);
  if (!clean.startsWith("uploads/")) candidates.push(`/uploads/${clean}`);

  return [...new Set(candidates)];
}

function isValidCssColor(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return true;
  if (/^rgb(a)?\(/i.test(v)) return true;
  if (/^hsl(a)?\(/i.test(v)) return true;
  if (/^[a-z]+$/i.test(v)) return true;
  return false;
}

function keyOf(item, idx) {
  return normalizeId(item?._id || item?.id || item?.serialNo || idx);
}

function isNotificationRead(item) {
  return !!(
    item?.isRead === true ||
    item?.read === true ||
    item?.seen === true ||
    String(item?.status || "").toUpperCase() === "READ"
  );
}

function statusTone(status) {
  const s = String(status || "").toUpperCase();
  if (
    [
      "LIVE",
      "ACTIVE",
      "PAID",
      "SUCCESS",
      "READ",
      "BOOKED",
      "CONFIRMED",
      "APPROVED",
      "COMPLETED",
    ].includes(s)
  )
    return "success";
  if (
    [
      "DRAFT",
      "PENDING",
      "UPCOMING",
      "UNREAD",
      "PROCESSING",
      "PARTIAL",
    ].includes(s)
  )
    return "warn";
  if (
    [
      "CLOSED",
      "FAILED",
      "REVOKED",
      "INACTIVE",
      "CANCELLED",
      "CANCELED",
    ].includes(s)
  )
    return "danger";
  return "neutral";
}

function medalTone(value) {
  const s = String(value || "").toLowerCase();
  if (s.includes("gold") || s.includes("1st")) return "gold";
  if (s.includes("silver") || s.includes("2nd")) return "silver";
  if (s.includes("bronze") || s.includes("3rd")) return "bronze";
  if (s.includes("participation")) return "participation";
  return "default";
}

/* -------------------- Styles -------------------- */

function StyleTag() {
  return (
    <style>{`
      :root{
        --ra-red:${FALLBACK_RED};
        --ra-dark:${FALLBACK_DARK};
        --ra-soft:${FALLBACK_SOFT};
        --ra-border:rgba(15,23,42,.09);
        --ra-shadow:0 24px 70px rgba(2,8,23,.10);
        --ra-radius:28px;
      }

      *{box-sizing:border-box}

      .raParentShell{
        min-height:100vh;
        background:
          radial-gradient(circle at top left, color-mix(in srgb, var(--ra-red) 20%, transparent), transparent 31%),
          radial-gradient(circle at 92% 8%, rgba(15,23,42,.13), transparent 28%),
          linear-gradient(135deg,#fff 0%,#f8fafc 45%,#eef2f7 100%);
        color:var(--ra-dark);
        padding:18px;
      }

      .raAppFrame{
        width:min(1580px,100%);
        margin:0 auto;
        display:grid;
        grid-template-columns:300px minmax(0,1fr);
        gap:18px;
        align-items:start;
      }

      .raSidebar{
        position:sticky;
        top:18px;
        min-height:calc(100vh - 36px);
        border-radius:34px;
        padding:16px;
        background:linear-gradient(180deg,#0b1020,#070a12);
        color:#fff;
        box-shadow:0 28px 80px rgba(2,8,23,.22);
        overflow:hidden;
      }

      .raSidebar:before{
        content:"";
        position:absolute;
        inset:-140px auto auto -120px;
        width:280px;
        height:280px;
        border-radius:999px;
        background:color-mix(in srgb, var(--ra-red) 42%, transparent);
        filter:blur(4px);
      }

      .raSidebar > *{position:relative;z-index:1;}

      .raSidebarBrand{
        display:flex;
        align-items:center;
        gap:12px;
        padding:10px;
      }

      .raSidebarBrand h2{
        margin:0;
        font-size:18px;
        line-height:1.1;
        letter-spacing:-.035em;
        font-weight:950;
      }

      .raSidebarBrand p{
        margin:4px 0 0;
        font-size:12px;
        color:rgba(255,255,255,.68);
        font-weight:800;
      }

      .raLogoBox{
        width:46px;
        height:46px;
        border-radius:18px;
        background:#fff;
        display:grid;
        place-items:center;
        overflow:hidden;
        color:var(--ra-red);
        font-weight:950;
        box-shadow:0 18px 38px rgba(0,0,0,.14);
        flex:0 0 auto;
      }

      .raLogoBox.lg{width:56px;height:56px;border-radius:21px;}
      .raLogoBox.xl{width:70px;height:70px;border-radius:26px;}
      .raLogoBox.xxl{width:104px;height:104px;border-radius:34px;}

      .raLogoBox img{
        width:100%;
        height:100%;
        object-fit:contain;
        padding:7px;
        display:block;
        background:#fff;
      }

      .raLogoBox.xxl img{padding:10px;}

      .raSideHero{
        margin:18px 0 16px;
        padding:18px;
        border-radius:26px;
        background:linear-gradient(135deg,color-mix(in srgb, var(--ra-red) 92%, #000),var(--ra-red));
        box-shadow:0 20px 45px color-mix(in srgb, var(--ra-red) 26%, transparent);
      }

      .raSideHero span{
        display:block;
        font-size:11px;
        letter-spacing:.12em;
        text-transform:uppercase;
        opacity:.76;
        font-weight:950;
      }

      .raSideHero b{
        display:block;
        margin-top:8px;
        font-size:20px;
        line-height:1.15;
        letter-spacing:-.045em;
        font-weight:950;
      }

      .raNavList{display:grid;gap:8px;}

      .raNavBtn{
        width:100%;
        min-height:48px;
        border:none;
        border-radius:18px;
        background:rgba(255,255,255,.055);
        color:rgba(255,255,255,.72);
        display:grid;
        grid-template-columns:24px 1fr 18px;
        align-items:center;
        gap:10px;
        padding:0 13px;
        text-align:left;
        font-size:14px;
        font-weight:900;
        cursor:pointer;
        transition:.18s ease;
      }

      .raNavBtn:hover{background:rgba(255,255,255,.1);color:#fff;}
      .raNavBtn.active{background:#fff;color:var(--ra-red);box-shadow:0 16px 30px rgba(0,0,0,.16);}
      .raNavBtn svg:last-child{justify-self:end;opacity:.62;}

      .raSecureBox{
        margin-top:14px;
        min-height:54px;
        border-radius:20px;
        background:rgba(255,255,255,.08);
        color:rgba(255,255,255,.78);
        display:flex;
        align-items:center;
        gap:10px;
        padding:13px;
        font-size:12px;
        font-weight:900;
      }

      .raMainPanel{display:grid;gap:16px;min-width:0;}

      .raHeader{
        position:sticky;
        top:18px;
        z-index:40;
        min-height:76px;
        border-radius:28px;
        border:1px solid rgba(255,255,255,.74);
        background:rgba(255,255,255,.82);
        backdrop-filter:blur(22px);
        box-shadow:0 18px 45px rgba(2,8,23,.06);
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:14px;
      }

      .raHeaderLeft{display:flex;align-items:center;gap:12px;min-width:0;}
      .raEyebrow{display:block;color:var(--ra-red);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.1em;}
      .raHeader h1{margin:3px 0 0;font-size:22px;line-height:1.1;letter-spacing:-.045em;font-weight:950;color:var(--ra-dark);}

      .raMenuBtn{
        display:none;
        width:44px;
        height:44px;
        border:none;
        border-radius:16px;
        background:#fff5f5;
        color:var(--ra-red);
        place-items:center;
        cursor:pointer;
      }

      .raHeaderActions{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap;}

      .raActionBtn,.raPrimaryBtn,.raDarkBtn,.raLightBtn{
        min-height:40px;
        border-radius:15px;
        border:1px solid var(--ra-border);
        padding:0 14px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        font-size:13px;
        font-weight:950;
        cursor:pointer;
        white-space:nowrap;
        transition:.18s ease;
      }

      .raActionBtn{background:#fff;color:var(--ra-dark);}
      .raActionBtn.primary,.raPrimaryBtn{background:linear-gradient(180deg,color-mix(in srgb, var(--ra-red) 78%, #ff6470),var(--ra-red));color:#fff;border-color:color-mix(in srgb, var(--ra-red) 24%, transparent);box-shadow:0 16px 30px color-mix(in srgb, var(--ra-red) 22%, transparent);}
      .raDarkBtn{background:linear-gradient(180deg,#172033,#070a12);color:#fff;border-color:rgba(15,23,42,.18);}
      .raLightBtn{background:#fff5f5;color:var(--ra-red);border-color:color-mix(in srgb, var(--ra-red) 18%, transparent);}
      .raActionBtn.danger{background:#fff5f5;color:var(--ra-red);border-color:color-mix(in srgb, var(--ra-red) 18%, transparent);}
      .raActionBtn.small,.raPrimaryBtn.small{min-height:34px;border-radius:13px;padding:0 11px;font-size:12px;}
      .raActionBtn:hover,.raPrimaryBtn:hover,.raDarkBtn:hover,.raLightBtn:hover{transform:translateY(-1px);box-shadow:0 14px 28px rgba(2,8,23,.09);}
      .raActionBtn:disabled,.raPrimaryBtn:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none;}

      .raCounter{min-width:20px;height:20px;border-radius:999px;background:var(--ra-red);color:#fff;display:inline-grid;place-items:center;padding:0 6px;font-size:11px;font-weight:950;}

      .raHeroPanel{
        display:grid;
        grid-template-columns:minmax(0,1fr) 280px;
        gap:16px;
        border-radius:34px;
        background:linear-gradient(135deg,#0b1020,#090d18 62%,color-mix(in srgb, var(--ra-red) 62%, #080b12));
        color:#fff;
        padding:24px;
        box-shadow:var(--ra-shadow);
        overflow:hidden;
        position:relative;
      }

      .raHeroPanel:after{
        content:"";
        position:absolute;
        right:-120px;
        top:-120px;
        width:320px;
        height:320px;
        border-radius:999px;
        background:rgba(255,255,255,.08);
      }

      .raHeroPanel > *{position:relative;z-index:1;}
      .raHeroBadge{min-height:34px;padding:0 13px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:950;letter-spacing:.08em;}
      .raHeroContent h2{max-width:800px;margin:16px 0 0;font-size:clamp(36px,5vw,66px);line-height:.92;letter-spacing:-.07em;font-weight:950;}
      .raHeroContent p{max-width:820px;margin:16px 0 0;color:rgba(255,255,255,.72);font-size:15px;line-height:1.72;font-weight:750;}
      .raHeroButtons{margin-top:22px;display:flex;flex-wrap:wrap;gap:10px;}
      .raHeroButtons .raPrimaryBtn,.raHeroButtons .raDarkBtn,.raHeroButtons .raLightBtn{min-height:48px;padding:0 18px;border-radius:17px;font-size:14px;}

      .raHeroBrandCard{
        align-self:stretch;
        border-radius:28px;
        background:rgba(255,255,255,.11);
        border:1px solid rgba(255,255,255,.14);
        display:grid;
        place-items:center;
        align-content:center;
        gap:10px;
        text-align:center;
        padding:20px;
      }

      .raHeroBrandCard b{font-size:22px;font-weight:950;letter-spacing:-.04em;}
      .raHeroBrandCard span{font-size:12px;color:rgba(255,255,255,.7);font-weight:850;}

      .raAlert{min-height:48px;padding:12px 14px;border-radius:18px;display:flex;align-items:center;gap:9px;font-size:13px;font-weight:900;}
      .raAlert.error{background:#fff5f5;color:var(--ra-red);border:1px solid color-mix(in srgb, var(--ra-red) 16%, transparent);}
      .raAlert.success{background:#f0fdf4;color:#047857;border:1px solid rgba(16,185,129,.18);}

      .raStatsGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
      .raStatCard{min-height:128px;border-radius:26px;background:#fff;border:1px solid var(--ra-border);box-shadow:0 14px 34px rgba(2,8,23,.045);padding:17px;display:grid;align-content:start;}
      .raStatCard.danger{background:linear-gradient(180deg,#fff5f5,#fff);border-color:color-mix(in srgb, var(--ra-red) 14%, transparent);}
      .raStatIcon{width:44px;height:44px;border-radius:17px;background:#fff5f5;color:var(--ra-red);display:grid;place-items:center;margin-bottom:14px;}
      .raStatCard span{font-size:12px;color:var(--ra-soft);font-weight:900;}
      .raStatCard b{margin-top:7px;font-size:28px;line-height:1.05;font-weight:950;color:var(--ra-dark);}

      .raMiniStatsGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
      .raMiniStat{min-height:66px;border-radius:20px;background:#fff;border:1px solid var(--ra-border);padding:13px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .raMiniStat span{display:flex;align-items:center;gap:8px;color:var(--ra-soft);font-size:12px;font-weight:900;min-width:0;}
      .raMiniStat span svg{color:var(--ra-red);}
      .raMiniStat b{font-size:17px;font-weight:950;text-align:right;color:var(--ra-dark);}

      .raFocusPanel{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:14px;border-radius:28px;background:#fff;border:1px solid color-mix(in srgb, var(--ra-red) 14%, transparent);box-shadow:0 14px 34px rgba(2,8,23,.04);padding:16px;}
      .raFocusLeft{display:flex;align-items:center;gap:13px;min-width:0;}
      .raFocusLeft span{color:var(--ra-red);font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;}
      .raFocusLeft h3{margin:3px 0 0;font-size:20px;font-weight:950;color:var(--ra-dark);}
      .raFocusLeft p{margin:4px 0 0;color:var(--ra-soft);font-size:13px;font-weight:800;}
      .raFocusMetrics{display:grid;grid-template-columns:repeat(5,minmax(82px,1fr));gap:8px;}

      .raToolsBar{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:12px;}
      .raSearchField,.raSelectField{min-height:54px;border-radius:20px;background:#fff;border:1px solid var(--ra-border);display:flex;align-items:center;gap:10px;padding:0 15px;color:var(--ra-soft);box-shadow:0 10px 24px rgba(2,8,23,.025);}
      .raSearchField input{width:100%;border:none;outline:none;background:transparent;color:var(--ra-dark);font-size:14px;font-weight:800;}
      .raSearchField button{width:30px;height:30px;border:none;border-radius:999px;background:#f8fafc;color:var(--ra-soft);display:grid;place-items:center;cursor:pointer;}
      .raSelectField select{width:100%;border:none;outline:none;background:transparent;color:var(--ra-dark);font-size:14px;font-weight:900;}

      .raMobileTabs{display:none;}
      .raOverviewGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;}
      .raPanel{border-radius:28px;background:#fff;border:1px solid var(--ra-border);box-shadow:0 14px 34px rgba(2,8,23,.045);overflow:hidden;}
      .raPanelHead{min-height:66px;padding:16px 18px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .raPanelTitle{display:flex;align-items:center;gap:10px;font-size:17px;color:var(--ra-dark);font-weight:950;}
      .raPanelTitle span{width:36px;height:36px;border-radius:15px;background:#fff5f5;color:var(--ra-red);display:grid;place-items:center;}
      .raPanelAction{border:none;background:#fff5f5;color:var(--ra-red);height:34px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:950;cursor:pointer;}
      .raPanelBody{padding:16px 18px 18px;}

      .raEmpty{min-height:132px;border-radius:20px;border:1px dashed rgba(15,23,42,.16);background:#f8fafc;color:var(--ra-soft);display:grid;place-items:center;align-content:center;gap:8px;text-align:center;padding:18px;font-size:13px;font-weight:850;}
      .raEmpty svg{color:var(--ra-red);}

      .raChildList,.raCompactList,.raTimeline,.raSummaryTiles,.raActivityFeed{display:grid;gap:10px;}
      .raChildRow{width:100%;border:1px solid var(--ra-border);background:#fff;border-radius:20px;min-height:84px;padding:12px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;text-align:left;cursor:pointer;transition:.16s ease;}
      .raChildRow:hover,.raChildRow.active{border-color:color-mix(in srgb, var(--ra-red) 20%, transparent);background:#fff8f8;}
      .raChildRow b{display:block;color:var(--ra-dark);font-size:14px;font-weight:950;}
      .raChildRow span{display:block;margin-top:4px;color:var(--ra-soft);font-size:12px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .raChildCounters{display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
      .raChildCounters small{font-size:11px;font-weight:900;color:#475569;background:#f8fafc;border:1px solid rgba(15,23,42,.06);padding:4px 8px;border-radius:999px;}

      .raAvatar{width:42px;height:42px;border-radius:16px;background:linear-gradient(180deg,#fff5f5,#ffe4e8);color:var(--ra-red);display:grid;place-items:center;font-weight:950;flex:0 0 auto;}
      .raAvatar.lg{width:54px;height:54px;border-radius:20px;font-size:16px;}
      .raAvatar.xl{width:64px;height:64px;border-radius:24px;font-size:18px;}

      .raTimelineItem{display:grid;grid-template-columns:22px 1fr;gap:10px;}
      .raTimelineRail{display:grid;justify-items:center;padding-top:17px;position:relative;}
      .raTimelineRail:after{content:"";width:2px;background:#eef2f7;position:absolute;top:32px;bottom:-12px;}
      .raTimelineRail span{width:12px;height:12px;border-radius:999px;background:var(--ra-red);box-shadow:0 0 0 6px color-mix(in srgb, var(--ra-red) 10%, transparent);z-index:1;}
      .raTimelineCard,.raCompactItem{border:1px solid var(--ra-border);border-radius:20px;background:#fff;padding:13px;}
      .raTimelineTop{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;}
      .raTimelineTop b,.raCompactItem b{display:block;color:var(--ra-dark);font-size:14px;font-weight:950;}
      .raMetaLine{margin-top:9px;display:flex;gap:10px;flex-wrap:wrap;color:var(--ra-soft);font-size:12px;font-weight:800;}
      .raMetaLine span{display:inline-flex;align-items:center;gap:6px;}

      .raCompactItem{min-height:74px;display:flex;justify-content:space-between;align-items:center;gap:12px;}
      .raCompactItem p{margin:5px 0 0;color:var(--ra-soft);font-size:12px;font-weight:800;line-height:1.45;}
      .raCompactRight{display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-end;}

      .raSummaryTile{min-height:64px;padding:12px 13px;border-radius:19px;border:1px solid var(--ra-border);background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .raSummaryTile.danger{background:#fff5f5;border-color:color-mix(in srgb, var(--ra-red) 14%, transparent);}
      .raSummaryTile span{display:flex;align-items:center;gap:8px;color:var(--ra-soft);font-size:12px;font-weight:900;}
      .raSummaryTile span svg{color:var(--ra-red);}
      .raSummaryTile b{color:var(--ra-dark);font-size:17px;font-weight:950;text-align:right;}

      .raActivityRow{min-height:76px;border-radius:20px;border:1px solid var(--ra-border);background:#fff;display:grid;grid-template-columns:104px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;}
      .raActivityRow b{display:block;color:var(--ra-dark);font-size:14px;font-weight:950;}
      .raActivityRow p{margin:5px 0 0;color:var(--ra-soft);font-size:12px;font-weight:800;line-height:1.45;}
      .raActivityRight{text-align:right;display:grid;gap:6px;justify-items:end;color:var(--ra-soft);font-size:12px;font-weight:850;}

      .raTypeBadge{min-height:31px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:950;border:1px solid rgba(15,23,42,.08);background:#f8fafc;color:#475569;}
      .raTypeBadge.event{background:#eff6ff;color:#1d4ed8;border-color:rgba(59,130,246,.15);}
      .raTypeBadge.certificate{background:#ecfdf5;color:#047857;border-color:rgba(16,185,129,.15);}
      .raTypeBadge.result{background:#fff7ed;color:#c2410c;border-color:rgba(245,158,11,.15);}
      .raTypeBadge.booking{background:#eef2ff;color:#4338ca;border-color:rgba(99,102,241,.15);}
      .raTypeBadge.notice{background:#fff5f5;color:var(--ra-red);border-color:color-mix(in srgb, var(--ra-red) 15%, transparent);}

      .raCardGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
      .raDetailCard,.raEventCard,.raResultCard{border-radius:24px;border:1px solid var(--ra-border);background:#fff;box-shadow:0 10px 24px rgba(2,8,23,.035);padding:16px;min-width:0;}
      .raDetailHead,.raIdentity,.raPaymentCardTop,.raResultTop{display:flex;gap:12px;align-items:flex-start;}
      .raDetailHead,.raPaymentCardTop,.raResultTop{justify-content:space-between;}
      .raIdentity{align-items:center;min-width:0;}
      .raIdentity h3,.raEventCard h3,.raPaymentCardTop h3,.raResultTop h3{margin:0;color:var(--ra-dark);font-size:16px;font-weight:950;line-height:1.25;}
      .raIdentity p,.raPaymentCardTop p,.raResultTop p{margin:5px 0 0;color:var(--ra-soft);font-size:12px;font-weight:800;line-height:1.45;}

      .raInfoGrid{margin-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
      .raInfoItem{min-height:62px;border-radius:17px;border:1px solid rgba(15,23,42,.07);background:#f8fafc;padding:11px;display:grid;align-content:center;}
      .raInfoItem span{color:var(--ra-soft);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.04em;}
      .raInfoItem b{margin-top:5px;color:var(--ra-dark);font-size:13px;font-weight:950;word-break:break-word;}

      .raMetricStrip{margin-top:14px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
      .raMetric{min-height:62px;border-radius:17px;border:1px solid rgba(15,23,42,.07);background:#fff;padding:10px;display:grid;align-content:center;}
      .raMetric span{color:var(--ra-soft);font-size:11px;font-weight:900;}
      .raMetric b{margin-top:5px;color:var(--ra-dark);font-size:17px;font-weight:950;}

      .raCardIcon{width:44px;height:44px;border-radius:18px;background:#fff5f5;color:var(--ra-red);display:grid;place-items:center;margin-bottom:14px;}
      .raMetaStack{margin-top:12px;display:grid;gap:8px;color:var(--ra-soft);font-size:12px;font-weight:800;}
      .raMetaStack span{display:flex;align-items:center;gap:7px;min-width:0;}
      .raCardFoot{margin-top:15px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}

      .raSectionIntro{margin-bottom:12px;min-height:52px;border-radius:20px;background:#f8fafc;border:1px solid rgba(15,23,42,.07);padding:12px 14px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;color:var(--ra-soft);font-size:13px;font-weight:850;}
      .raSectionIntro b{color:var(--ra-red);font-weight:950;}

      .raResultsTable,.raPaymentsTable{border:1px solid var(--ra-border);border-radius:22px;overflow:hidden;background:#fff;}
      .raResultsHead,.raResultsRow{display:grid;grid-template-columns:1.1fr 1.25fr .75fr .9fr .55fr .8fr .55fr;gap:12px;align-items:center;padding:14px;}
      .raPaymentsHead,.raPaymentsRow{display:grid;grid-template-columns:1.25fr .9fr .7fr .7fr .7fr 1.05fr;gap:12px;align-items:center;padding:14px;}
      .raResultsHead,.raPaymentsHead{background:#f8fafc;color:var(--ra-soft);font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid rgba(15,23,42,.08);}
      .raResultsRow,.raPaymentsRow{border-bottom:1px solid rgba(15,23,42,.06);color:var(--ra-dark);font-size:13px;font-weight:850;}
      .raResultsRow:last-child,.raPaymentsRow:last-child{border-bottom:none;}
      .raResultsRow b,.raPaymentsRow b{display:block;color:var(--ra-dark);font-size:13px;font-weight:950;line-height:1.25;}
      .raResultsRow span,.raPaymentsRow span{margin-top:4px;}
      .raMuted{color:#94a3b8;font-weight:950;}

      .raDatePill,.raRankPill,.raTotalPill,.raSoftPill{min-height:30px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:950;white-space:nowrap;}
      .raDatePill,.raSoftPill{background:#f8fafc;color:#475569;border:1px solid rgba(15,23,42,.08);}
      .raSoftPill.red{background:#fff5f5;color:var(--ra-red);border-color:color-mix(in srgb, var(--ra-red) 14%, transparent);}
      .raRankPill{background:#fff7ed;color:#b45309;border:1px solid rgba(245,158,11,.16);}
      .raTotalPill{background:var(--ra-dark);color:#fff;border:1px solid var(--ra-dark);}

      .raStatus{min-height:30px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:950;white-space:nowrap;border:1px solid rgba(15,23,42,.08);background:#f8fafc;color:#475569;}
      .raStatus.success{background:#f0fdf4;color:#15803d;border-color:rgba(34,197,94,.18);}
      .raStatus.warn{background:#fff7ed;color:#b45309;border-color:rgba(245,158,11,.16);}
      .raStatus.danger{background:#fff5f5;color:var(--ra-red);border-color:color-mix(in srgb, var(--ra-red) 16%, transparent);}
      .raStatus.neutral{background:#f8fafc;color:#475569;border-color:rgba(15,23,42,.08);}

      .raMedal{min-height:30px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:12px;font-weight:950;white-space:nowrap;border:1px solid rgba(15,23,42,.08);background:#fff;color:var(--ra-dark);}
      .raMedal.gold{background:#fff7d6;border-color:rgba(234,179,8,.22);color:#a16207;}
      .raMedal.silver{background:#f8fafc;border-color:rgba(148,163,184,.24);color:#475569;}
      .raMedal.bronze{background:#fff1e8;border-color:rgba(234,88,12,.18);color:#c2410c;}
      .raMedal.participation{background:#f0fdf4;border-color:rgba(34,197,94,.18);color:#15803d;}
      .raMedal.default{background:#fff5f5;border-color:color-mix(in srgb, var(--ra-red) 16%, transparent);color:var(--ra-red);}

      .raRowActions{display:flex;gap:8px;flex-wrap:wrap;}
      .raRowActions.stretch .raActionBtn,.raRowActions.stretch .raPrimaryBtn{flex:1 1 auto;}
      .raResultCards,.raPaymentCards{display:none;}
      .raScoreBox{min-width:86px;padding:10px 12px;border-radius:17px;background:var(--ra-dark);color:#fff;display:grid;justify-items:end;}
      .raScoreBox span{font-size:11px;font-weight:800;opacity:.75;}
      .raScoreBox b{margin-top:5px;font-size:22px;line-height:1;font-weight:950;}
      .raResultFoot{margin-top:14px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--ra-soft);font-size:12px;font-weight:850;}

      .raFooterBadges{display:flex;flex-wrap:wrap;gap:9px;padding-bottom:8px;}
      .raFooterBadges span{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--ra-border);background:#fff;color:#475569;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:900;}
      .raFooterBadges svg{color:var(--ra-red);}

      .raLoadingView{min-height:calc(100vh - 36px);display:grid;place-items:center;}
      .raLoadingCard{width:min(460px,100%);border-radius:34px;border:1px solid var(--ra-border);background:#fff;box-shadow:var(--ra-shadow);padding:30px;display:grid;justify-items:center;text-align:center;}
      .raLoadingRing{margin-top:18px;width:44px;height:44px;border-radius:999px;border:4px solid #ffe4e8;border-top-color:var(--ra-red);animation:raSpin 1s linear infinite;}
      .raLoadingCard h2{margin:16px 0 0;color:var(--ra-dark);font-size:20px;font-weight:950;}
      .raLoadingCard p{margin:8px 0 0;color:var(--ra-soft);font-size:13px;font-weight:800;line-height:1.6;}
      @keyframes raSpin{to{transform:rotate(360deg);}}

      @media (max-width:1280px){
        .raAppFrame{grid-template-columns:270px minmax(0,1fr);}
        .raHeroPanel{grid-template-columns:1fr;}
        .raHeroBrandCard{display:none;}
        .raStatsGrid,.raMiniStatsGrid{grid-template-columns:repeat(2,minmax(0,1fr));}
        .raFocusPanel{grid-template-columns:1fr;}
        .raFocusMetrics{grid-template-columns:repeat(5,minmax(0,1fr));}
      }

      @media (max-width:1080px){
        .raParentShell{padding:12px;}
        .raAppFrame{grid-template-columns:1fr;}
        .raSidebar{display:none;position:relative;top:auto;min-height:auto;border-radius:28px;}
        .raSidebar.open{display:block;}
        .raMenuBtn{display:grid;}
        .raHeader{position:relative;top:auto;}
        .raOverviewGrid,.raCardGrid{grid-template-columns:1fr;}
        .raResultsTable,.raPaymentsTable{display:none;}
        .raResultCards,.raPaymentCards{display:grid;gap:12px;}
      }

      @media (max-width:820px){
        .raHeader{align-items:flex-start;flex-direction:column;}
        .raHeaderActions{width:100%;justify-content:stretch;}
        .raHeaderActions .raActionBtn{flex:1 1 auto;}
        .raHeroPanel{padding:20px;border-radius:28px;}
        .raHeroContent h2{font-size:38px;}
        .raHeroButtons{display:grid;grid-template-columns:1fr;}
        .raHeroButtons .raPrimaryBtn,.raHeroButtons .raDarkBtn,.raHeroButtons .raLightBtn{width:100%;}
        .raStatsGrid,.raMiniStatsGrid,.raFocusMetrics,.raToolsBar{grid-template-columns:1fr;}
        .raMobileTabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;}
        .raMobileTabs::-webkit-scrollbar{display:none;}
        .raMobileTabs button{min-height:40px;padding:0 13px;border-radius:999px;border:1px solid var(--ra-border);background:#fff;color:#475569;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:950;white-space:nowrap;cursor:pointer;}
        .raMobileTabs button.active{background:#fff5f5;color:var(--ra-red);border-color:color-mix(in srgb, var(--ra-red) 16%, transparent);}
        .raChildRow{grid-template-columns:auto minmax(0,1fr);}
        .raChildCounters{grid-column:1 / -1;flex-direction:row;justify-content:flex-start;flex-wrap:wrap;align-items:center;}
        .raActivityRow{grid-template-columns:1fr;}
        .raActivityRight{justify-items:start;text-align:left;}
        .raCompactItem{align-items:flex-start;flex-direction:column;}
        .raCompactRight{justify-content:flex-start;}
        .raMetricStrip{grid-template-columns:repeat(2,minmax(0,1fr));}
      }

      @media (max-width:560px){
        .raParentShell{padding:10px;}
        .raHeader h1{font-size:18px;}
        .raHeroContent h2{font-size:32px;}
        .raDetailHead,.raResultTop,.raPaymentCardTop{flex-direction:column;}
        .raInfoGrid,.raMetricStrip{grid-template-columns:1fr;}
        .raScoreBox{width:100%;justify-items:start;}
        .raPanelBody{padding:14px;}
        .raPanelHead{padding:14px 14px 0;}
      }

      @media (prefers-reduced-motion:reduce){
        .raLoadingRing{animation:none;}
        .raActionBtn,.raPrimaryBtn,.raDarkBtn,.raLightBtn,.raChildRow{transition:none;}
        .raActionBtn:hover,.raPrimaryBtn:hover,.raDarkBtn:hover,.raLightBtn:hover{transform:none;}
      }
    `}</style>
  );
}
