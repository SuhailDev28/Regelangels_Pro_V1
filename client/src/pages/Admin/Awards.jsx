// client/src/pages/Admin/Awards.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api.js";

const RED = "#e11d2e";
const SERIAL_PREFIX = "RA";

const CERTIFICATE_PRESETS = [
  "Participation Award",
  "Excellence Award",
  "Best Performance",
  "Star Performer",
  "Outstanding Progress",
  "Special Recognition",
];

const MEDAL_PRESETS = [
  "Gold Medal",
  "Silver Medal",
  "Bronze Medal",
  "Best Performance",
  "Champion Award",
  "Special Recognition",
];

export default function Awards() {
  const [participants, setParticipants] = useState([]);
  const [events, setEvents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [history, setHistory] = useState([]);
  const [certificateRows, setCertificateRows] = useState([]);

  const [eventId, setEventId] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [type, setType] = useState("MEDAL");
  const [title, setTitle] = useState("Gold Medal");
  const [subTab, setSubTab] = useState("ISSUE"); // ISSUE | CERTS | HISTORY | BULK

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [formErr, setFormErr] = useState({});

  const [loading, setLoading] = useState(true);
  const [eventLoading, setEventLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [certLoading, setCertLoading] = useState(false);

  const [participantQ, setParticipantQ] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [historyQ, setHistoryQ] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("");
  const [preventDuplicates, setPreventDuplicates] = useState(true);
  const [historySort, setHistorySort] = useState("NEWEST");

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const pdfUrlRef = useRef("");

  const [tplLoading, setTplLoading] = useState(false);
  const [tplUrl, setTplUrl] = useState("");
  const tplUrlRef = useRef("");
  const [tplInfo, setTplInfo] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkQ, setBulkQ] = useState("");
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkMode, setBulkMode] = useState("DOWNLOAD"); // DOWNLOAD | ISSUE | ZIP_EVENT | ZIP_GROUP
  const [bulkIssueTitle, setBulkIssueTitle] = useState("Participation Award");
  const [bulkIssueType, setBulkIssueType] = useState("CERTIFICATE");
  const [bulkProgress, setBulkProgress] = useState({
    current: 0,
    total: 0,
    label: "",
  });

  const [verifySerialInput, setVerifySerialInput] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);

  // preview-only
  const [signatoryName, setSignatoryName] = useState("Authorized Signatory");
  const [certificateNote, setCertificateNote] = useState("");
  const [showQrPlaceholder, setShowQrPlaceholder] = useState(true);
  const [showSerialNumber, setShowSerialNumber] = useState(true);

  // enterprise ui / dialogs
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    text: "",
    confirmText: "Confirm",
    tone: "danger",
    onConfirm: null,
  });

  const [reasonModal, setReasonModal] = useState({
    open: false,
    title: "Reason",
    placeholder: "Enter reason",
    value: "Revoked by admin",
    confirmText: "Submit",
    onConfirm: null,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyViewItem, setHistoryViewItem] = useState(null);

  const mountedRef = useRef(true);
  const toastTimerRef = useRef(null);

  const activePresets =
    type === "CERTIFICATE" ? CERTIFICATE_PRESETS : MEDAL_PRESETS;
  const bulkPresets =
    bulkIssueType === "CERTIFICATE" ? CERTIFICATE_PRESETS : MEDAL_PRESETS;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

      try {
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      } catch {}

      try {
        if (tplUrlRef.current) URL.revokeObjectURL(tplUrlRef.current);
      } catch {}
    };
  }, []);

  useEffect(() => {
    const defaults =
      type === "CERTIFICATE" ? CERTIFICATE_PRESETS : MEDAL_PRESETS;
    if (!defaults.includes(title)) setTitle(defaults[0]);
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const defaults =
      bulkIssueType === "CERTIFICATE" ? CERTIFICATE_PRESETS : MEDAL_PRESETS;
    if (!defaults.includes(bulkIssueTitle)) setBulkIssueTitle(defaults[0]);
  }, [bulkIssueType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    loadTemplateInfo();
  }, []);

  useEffect(() => {
    loadEventData(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function toast(text, kind = "ok") {
    setMsg("");
    setErr("");

    if (kind === "err") setErr(text);
    else setMsg(text);

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setMsg("");
      setErr("");
    }, 3000);
  }

  function setNewPdfUrl(next) {
    try {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    } catch {}
    pdfUrlRef.current = next || "";
    setPdfUrl(next || "");
  }

  function setNewTplUrl(next) {
    try {
      if (tplUrlRef.current) URL.revokeObjectURL(tplUrlRef.current);
    } catch {}
    tplUrlRef.current = next || "";
    setTplUrl(next || "");
  }

  function showConfirm({
    title: modalTitle,
    text,
    confirmText = "Confirm",
    tone = "danger",
    onConfirm,
  }) {
    setConfirmState({
      open: true,
      title: modalTitle,
      text,
      confirmText,
      tone,
      onConfirm,
    });
  }

  function closeConfirm() {
    setConfirmState({
      open: false,
      title: "",
      text: "",
      confirmText: "Confirm",
      tone: "danger",
      onConfirm: null,
    });
  }

  function showReasonModal({
    title: modalTitle,
    placeholder = "Enter reason",
    defaultValue = "",
    confirmText = "Submit",
    onConfirm,
  }) {
    setReasonModal({
      open: true,
      title: modalTitle,
      placeholder,
      value: defaultValue,
      confirmText,
      onConfirm,
    });
  }

  function closeReasonModal() {
    setReasonModal({
      open: false,
      title: "Reason",
      placeholder: "Enter reason",
      value: "Revoked by admin",
      confirmText: "Submit",
      onConfirm: null,
    });
  }

  async function loadInitial() {
    setLoading(true);
    setErr("");

    try {
      const [ps, evs] = await Promise.all([
        api.participants(),
        api.adminEvents ? api.adminEvents() : api.events(),
      ]);

      const participantRows = Array.isArray(ps) ? ps : [];
      const eventRows = Array.isArray(evs) ? evs : [];

      if (!mountedRef.current) return;

      setParticipants(participantRows);
      setEvents(eventRows);
      setEventId((prev) => prev || eventRows?.[0]?._id || "");
      setParticipantId("");
    } catch (e) {
      if (!mountedRef.current) return;
      setErr(e?.message || "Failed to load awards page");
      setParticipants([]);
      setEvents([]);
      setEventId("");
      setParticipantId("");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function loadCertificateRecords(targetEventId) {
    if (!targetEventId || !api.certificateRecords) {
      setCertificateRows([]);
      return;
    }

    setCertLoading(true);
    try {
      const rows = await api.certificateRecords({
        eventId: targetEventId,
        limit: 300,
      });
      if (mountedRef.current) {
        setCertificateRows(Array.isArray(rows) ? rows : []);
      }
    } catch {
      if (mountedRef.current) setCertificateRows([]);
    } finally {
      if (mountedRef.current) setCertLoading(false);
    }
  }

  async function loadEventData(targetEventId) {
    const eid = String(targetEventId || "").trim();

    if (!eid) {
      setEnrollments([]);
      setHistory([]);
      setCertificateRows([]);
      setParticipantId("");
      setSelectedIds(new Set());
      return;
    }

    setEventLoading(true);
    setNewPdfUrl("");

    try {
      const [ens, hist] = await Promise.all([
        api.eventEnrollments ? api.eventEnrollments(eid) : Promise.resolve([]),
        api.awardsHistory ? api.awardsHistory(300, eid) : Promise.resolve([]),
      ]);

      if (!mountedRef.current) return;

      const enrollmentRows = Array.isArray(ens) ? ens : [];
      const historyRows = Array.isArray(hist) ? hist : [];

      setEnrollments(enrollmentRows);
      setHistory(historyRows);
      setSelectedIds(new Set());

      const enrolledIds = new Set(
        enrollmentRows
          .map((x) => x?.participantId?._id || x?.participantId)
          .filter(Boolean)
          .map(String),
      );

      setParticipantId((prev) => {
        if (prev && enrolledIds.has(String(prev))) return prev;
        return String(
          enrollmentRows?.[0]?.participantId?._id ||
            enrollmentRows?.[0]?.participantId ||
            "",
        );
      });

      await loadCertificateRecords(eid);
    } catch (e) {
      if (!mountedRef.current) return;
      setEnrollments([]);
      setHistory([]);
      setCertificateRows([]);
      setParticipantId("");
      setSelectedIds(new Set());
      toast(e?.message || "Failed to load event data", "err");
    } finally {
      if (mountedRef.current) setEventLoading(false);
    }
  }

  async function refreshHistory() {
    if (!eventId || !api.awardsHistory) return;

    setHistoryLoading(true);
    try {
      const hist = await api.awardsHistory(300, eventId);
      if (mountedRef.current) setHistory(Array.isArray(hist) ? hist : []);
      await loadCertificateRecords(eventId);
    } catch {
      // ignore
    } finally {
      if (mountedRef.current) setHistoryLoading(false);
    }
  }

  async function loadTemplateInfo() {
    try {
      if (!api.getCertificateTemplateInfo) return;
      const info = await api.getCertificateTemplateInfo();
      if (mountedRef.current) setTplInfo(info || null);
    } catch {
      // ignore
    }
  }

  const enrollmentParticipantIds = useMemo(
    () =>
      new Set(
        (enrollments || [])
          .map((x) => x?.participantId?._id || x?.participantId)
          .filter(Boolean)
          .map(String),
      ),
    [enrollments],
  );

  const enrolledParticipants = useMemo(() => {
    if (!eventId) return [];
    return (participants || []).filter((p) =>
      enrollmentParticipantIds.has(String(p?._id)),
    );
  }, [participants, enrollmentParticipantIds, eventId]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const p of enrolledParticipants) {
      const g = p?.groupId;
      if (g?._id && !map.has(g._id)) map.set(g._id, g);
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || "")),
    );
  }, [enrolledParticipants]);

  const filteredParticipants = useMemo(() => {
    const s = participantQ.trim().toLowerCase();

    return (enrolledParticipants || []).filter((p) => {
      if (groupFilter && p?.groupId?._id !== groupFilter) return false;
      if (!s) return true;

      const values = [
        p?.userId?.name,
        p?.userId?.email,
        p?.groupId?.name,
        p?.groupId?.level,
        p?.bibNo,
      ]
        .map((x) => String(x || "").toLowerCase())
        .filter(Boolean);

      return values.some((x) => x.includes(s));
    });
  }, [enrolledParticipants, participantQ, groupFilter]);

  useEffect(() => {
    if (!filteredParticipants.length) {
      setParticipantId("");
      return;
    }

    setParticipantId((prev) => {
      if (
        prev &&
        filteredParticipants.some((p) => String(p?._id) === String(prev))
      ) {
        return prev;
      }
      return String(filteredParticipants[0]?._id || "");
    });
  }, [filteredParticipants]);

  const selected = useMemo(
    () =>
      participants.find((p) => String(p?._id) === String(participantId)) ||
      null,
    [participants, participantId],
  );

  const selectedEvent = useMemo(
    () => events.find((e) => String(e?._id) === String(eventId)) || null,
    [events, eventId],
  );

  const selectedEnrollment = useMemo(
    () =>
      (enrollments || []).find((x) => {
        const pid = x?.participantId?._id || x?.participantId;
        return String(pid) === String(participantId);
      }) || null,
    [enrollments, participantId],
  );

  const currentDuplicate = useMemo(() => {
    const cleanTitle = String(title || "")
      .trim()
      .toLowerCase();
    return (
      (history || []).find((h) => {
        const pid = h?.participantId?._id || h?.participantId;
        return (
          String(pid) === String(participantId) &&
          String(h?.type || "").toUpperCase() ===
            String(type || "").toUpperCase() &&
          String(h?.title || "")
            .trim()
            .toLowerCase() === cleanTitle
        );
      }) || null
    );
  }, [history, participantId, type, title]);

  const historyFiltered = useMemo(() => {
    const s = historyQ.trim().toLowerCase();

    const filtered = (history || []).filter((h) => {
      const hType = String(h?.type || "").toUpperCase();
      if (historyTypeFilter && hType !== historyTypeFilter) return false;

      if (!s) return true;

      const values = [
        h?.participantId?.userId?.name,
        h?.participantId?.userId?.email,
        h?.participantId?.groupId?.name,
        h?.participantId?.groupId?.level,
        h?.title,
        h?.type,
        h?.eventId?.name,
      ]
        .map((x) => String(x || "").toLowerCase())
        .filter(Boolean);

      return values.some((x) => x.includes(s));
    });

    const sorted = [...filtered].sort((a, b) => {
      const da = new Date(a?.createdAt || 0).getTime();
      const db = new Date(b?.createdAt || 0).getTime();

      if (historySort === "OLDEST") return da - db;
      if (historySort === "TITLE") {
        return String(a?.title || "").localeCompare(String(b?.title || ""));
      }
      return db - da;
    });

    return sorted;
  }, [history, historyQ, historyTypeFilter, historySort]);

  const bulkList = useMemo(() => {
    const s = bulkQ.trim().toLowerCase();

    return (enrolledParticipants || []).filter((p) => {
      if (bulkGroupId && p?.groupId?._id !== bulkGroupId) return false;
      if (!s) return true;

      const values = [
        p?.userId?.name,
        p?.userId?.email,
        p?.groupId?.name,
        p?.groupId?.level,
        p?.bibNo,
      ]
        .map((x) => String(x || "").toLowerCase())
        .filter(Boolean);

      return values.some((x) => x.includes(s));
    });
  }, [enrolledParticipants, bulkQ, bulkGroupId]);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (!prev.size) return prev;
      const valid = new Set(
        enrolledParticipants.map((p) => String(p?._id)).filter(Boolean),
      );
      const next = new Set([...prev].filter((id) => valid.has(String(id))));
      return next.size === prev.size ? prev : next;
    });
  }, [enrolledParticipants]);

  const eventStats = useMemo(() => {
    const medals = (history || []).filter(
      (h) => String(h?.type || "").toUpperCase() === "MEDAL",
    ).length;
    const certs = (history || []).filter(
      (h) => String(h?.type || "").toUpperCase() === "CERTIFICATE",
    ).length;

    return {
      enrolled: enrolledParticipants.length,
      issued: history.length,
      medals,
      certificates: certs,
      groups: new Set(
        enrolledParticipants.map((p) => p?.groupId?._id).filter(Boolean),
      ).size,
      serials: certificateRows.length,
      revokedSerials: certificateRows.filter((x) => x?.isRevoked).length,
    };
  }, [history, enrolledParticipants, certificateRows]);

  const selectedCertificate = useMemo(
    () =>
      certificateRows.find(
        (row) =>
          String(row?.participantId?._id || row?.participantId) ===
          String(participantId),
      ) || null,
    [certificateRows, participantId],
  );

  const selectedCount = selectedIds.size;
  const allFilteredSelected =
    bulkList.length > 0 &&
    bulkList.every((p) => selectedIds.has(String(p._id)));

  const participantName = selected?.userId?.name || "Participant Name";
  const groupName = selected?.groupId?.name || "Group";
  const level = selected?.groupId?.level || "";
  const bibNo = selected?.bibNo || "—";
  const eventName = selectedEvent?.name || "Selected Event";
  const serialNo = selectedCertificate?.serialNo || buildSerial(selected?._id);

  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  const issueDisabled =
    !participantId ||
    !eventId ||
    issuing ||
    (preventDuplicates && !!currentDuplicate);

  const hasParticipants = participants.length > 0;
  const hasEvents = events.length > 0;

  function validateForm() {
    const next = {};
    if (!eventId) next.eventId = "Event is required.";
    if (!participantId) next.participantId = "Participant is required.";
    if (!String(title || "").trim()) next.title = "Title is required.";
    if (participantId && !enrollmentParticipantIds.has(String(participantId))) {
      next.participantId = "Participant is not enrolled in the selected event.";
    }
    setFormErr(next);
    return Object.keys(next).length === 0;
  }

  function buildSerial(pid) {
    const safeEvent =
      String(eventId || "")
        .slice(-4)
        .toUpperCase() || "EVT";
    const safePid =
      String(pid || "")
        .slice(-6)
        .toUpperCase() || "PART";
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}${String(date.getDate()).padStart(2, "0")}`;
    return `${SERIAL_PREFIX}-${safeEvent}-${safePid}-${stamp}`;
  }

  function formatParticipantLabel(p) {
    const name = p?.userId?.name || "Unnamed participant";
    const email = p?.userId?.email || "";
    const group = p?.groupId?.name || "No group";
    const levelText = p?.groupId?.level ? ` (${p.groupId.level})` : "";
    const bib = p?.bibNo ? ` · BIB ${p.bibNo}` : "";
    return `${name} — ${group}${levelText}${bib}${email ? ` — ${email}` : ""}`;
  }

  function formatEventLabel(ev) {
    const name = ev?.name || "Unnamed Event";
    const status = ev?.status ? ` (${ev.status})` : "";
    return `${name}${status}`;
  }

  function goToAdjacentParticipant(direction) {
    if (!filteredParticipants.length) return;
    const idx = filteredParticipants.findIndex(
      (p) => String(p?._id) === String(participantId),
    );
    if (idx === -1) {
      setParticipantId(String(filteredParticipants[0]?._id || ""));
      return;
    }
    const nextIdx = Math.max(
      0,
      Math.min(filteredParticipants.length - 1, idx + direction),
    );
    setParticipantId(String(filteredParticipants[nextIdx]?._id || ""));
  }

  function pickRandomParticipant() {
    if (!filteredParticipants.length) return;
    const idx = Math.floor(Math.random() * filteredParticipants.length);
    setParticipantId(String(filteredParticipants[idx]?._id || ""));
  }

  async function issueCore(mode = "NORMAL") {
    if (!validateForm()) {
      toast("Please fix the validation errors.", "err");
      return;
    }

    if (preventDuplicates && currentDuplicate) {
      toast(
        "This award already exists for this participant in the selected event.",
        "err",
      );
      return;
    }

    setIssuing(true);
    setMsg("");
    setErr("");

    try {
      await api.issueAward({
        eventId,
        participantId,
        type,
        title: String(title || "").trim(),
      });

      toast("Award issued successfully ✅", "ok");
      await refreshHistory();

      if (mode === "NEXT") goToAdjacentParticipant(1);

      if (type === "CERTIFICATE" || mode === "OPEN_CERT") {
        await loadCertificatePdf(eventId, participantId);
        if (mountedRef.current) setSubTab("CERTS");
      }
    } catch (e) {
      toast(e?.message || "Failed to issue award", "err");
    } finally {
      if (mountedRef.current) setIssuing(false);
    }
  }

  async function loadCertificatePdf(
    targetEventId = eventId,
    targetParticipantId = participantId,
  ) {
    if (!targetEventId) return toast("Select event first.", "err");
    if (!targetParticipantId) return toast("Select participant first.", "err");

    setPdfLoading(true);
    setErr("");

    try {
      if (!api.certificatePdfBlob) {
        throw new Error("api.certificatePdfBlob missing in src/lib/api.js");
      }

      const blob = await api.certificatePdfBlob(
        targetEventId,
        targetParticipantId,
      );
      const url = URL.createObjectURL(blob);
      setNewPdfUrl(url);
      toast("Certificate PDF loaded ✅", "ok");
    } catch (e) {
      setNewPdfUrl("");
      toast(e?.message || "Failed to load certificate PDF", "err");
    } finally {
      if (mountedRef.current) setPdfLoading(false);
    }
  }

  async function downloadCertificate() {
    if (!eventId) return toast("Select event first.", "err");
    if (!selected?._id) return toast("Select participant first.", "err");

    try {
      if (!api.downloadCertificatePdf) {
        throw new Error("api.downloadCertificatePdf missing in src/lib/api.js");
      }
      await api.downloadCertificatePdf(eventId, selected._id);
      toast("Download started ✅", "ok");
    } catch (e) {
      toast(e?.message || "Download failed", "err");
    }
  }

  async function downloadEventZip() {
    if (!eventId) return toast("Select event first.", "err");
    try {
      await api.downloadEventCertificatesZip(
        eventId,
        selectedEvent?.name || "event",
      );
      toast("Event ZIP download started ✅", "ok");
    } catch (e) {
      toast(e?.message || "Event ZIP export failed", "err");
    }
  }

  async function downloadGroupZip() {
    if (!eventId) return toast("Select event first.", "err");
    if (!bulkGroupId) return toast("Select a group first.", "err");
    try {
      const grp = groups.find((g) => String(g._id) === String(bulkGroupId));
      await api.downloadGroupCertificatesZip(
        bulkGroupId,
        eventId,
        grp?.name || "group",
      );
      toast("Group ZIP download started ✅", "ok");
    } catch (e) {
      toast(e?.message || "Group ZIP export failed", "err");
    }
  }

  function askRevokeSelectedCertificate() {
    const serial = selectedCertificate?.serialNo;
    if (!serial) {
      toast("No certificate serial found for selected participant.", "err");
      return;
    }

    showReasonModal({
      title: "Revoke Certificate",
      placeholder: "Reason for revocation",
      defaultValue: "Revoked by admin",
      confirmText: "Revoke",
      onConfirm: async (reason) => {
        try {
          await api.revokeCertificate(serial, reason || "Revoked by admin");
          toast("Certificate revoked ✅", "ok");
          await loadCertificateRecords(eventId);
        } catch (e) {
          toast(e?.message || "Failed to revoke certificate", "err");
        }
      },
    });
  }

  async function verifySelectedCertificate() {
    const token =
      selectedCertificate?.meta?.token || selectedCertificate?.token || "";
    if (token && api.buildCertificateVerifyUrl) {
      window.open(
        api.buildCertificateVerifyUrl(token),
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    if (selectedCertificate?.serialNo) {
      setVerifySerialInput(selectedCertificate.serialNo);
      toast("Token not available. Use serial lookup below.", "err");
      return;
    }

    toast("No certificate verification data found.", "err");
  }

  async function findCertificateBySerial() {
    const serial = String(verifySerialInput || "").trim();
    if (!serial) return toast("Enter certificate serial number.", "err");
    if (!api.certificateBySerial) {
      return toast("Certificate lookup API missing.", "err");
    }

    setVerifyBusy(true);
    try {
      const row = await api.certificateBySerial(serial);
      const token = row?.meta?.token || row?.token || "";
      if (token && api.buildCertificateVerifyUrl) {
        window.open(
          api.buildCertificateVerifyUrl(token),
          "_blank",
          "noopener,noreferrer",
        );
      } else {
        toast(
          "Certificate found, but no verification token was returned.",
          "ok",
        );
      }
    } catch (e) {
      toast(e?.message || "Certificate lookup failed", "err");
    } finally {
      if (mountedRef.current) setVerifyBusy(false);
    }
  }

  function openInNewTab() {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }

  async function loadTemplatePdf() {
    setTplLoading(true);
    setErr("");

    try {
      if (!api.certificateTemplatePdfBlob) {
        throw new Error(
          "api.certificateTemplatePdfBlob missing in src/lib/api.js",
        );
      }

      const blob = await api.certificateTemplatePdfBlob();
      const url = URL.createObjectURL(blob);
      setNewTplUrl(url);
      await loadTemplateInfo();
      toast("Template PDF loaded ✅", "ok");
    } catch (e) {
      setNewTplUrl("");
      toast(e?.message || "No template found (upload one).", "err");
    } finally {
      if (mountedRef.current) setTplLoading(false);
    }
  }

  async function uploadTemplatePdf(file) {
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast("Please upload a PDF file only.", "err");
      return;
    }

    setTplLoading(true);
    setErr("");

    try {
      if (!api.uploadCertificateTemplatePdf) {
        throw new Error(
          "api.uploadCertificateTemplatePdf missing in src/lib/api.js",
        );
      }

      await api.uploadCertificateTemplatePdf(file);
      toast("Template uploaded ✅", "ok");
      await loadTemplatePdf();
    } catch (e) {
      toast(e?.message || "Template upload failed", "err");
    } finally {
      if (mountedRef.current) setTplLoading(false);
    }
  }

  async function downloadTemplatePdf() {
    try {
      if (!api.downloadCertificateTemplatePdf) {
        throw new Error(
          "api.downloadCertificateTemplatePdf missing in src/lib/api.js",
        );
      }
      await api.downloadCertificateTemplatePdf();
      toast("Template download started ✅", "ok");
    } catch (e) {
      toast(e?.message || "Template download failed", "err");
    }
  }

  function askDeleteHistoryItem(id) {
    if (!id || !api.deleteAward) return;

    showConfirm({
      title: "Delete Award Record",
      text: "This will permanently remove the selected award history item.",
      confirmText: "Delete",
      tone: "danger",
      onConfirm: async () => {
        try {
          await api.deleteAward(id);
          toast("Award deleted ✅", "ok");
          await refreshHistory();
        } catch (e) {
          toast(e?.message || "Failed to delete award", "err");
        }
      },
    });
  }

  function askRevokeCertificateRecord(serialNo) {
    if (!serialNo) return;

    showReasonModal({
      title: "Revoke Certificate Record",
      placeholder: "Reason for revocation",
      defaultValue: "Revoked by admin",
      confirmText: "Revoke",
      onConfirm: async (reason) => {
        try {
          await api.revokeCertificate(serialNo, reason || "Revoked by admin");
          toast("Certificate revoked ✅", "ok");
          await loadCertificateRecords(eventId);
        } catch (e) {
          toast(e?.message || "Failed to revoke certificate", "err");
        }
      },
    });
  }

  function askRestoreCertificateRecord(serialNo) {
    if (!serialNo) return;

    showConfirm({
      title: "Reactivate Certificate",
      text: "This certificate record will be marked active again.",
      confirmText: "Reactivate",
      tone: "primary",
      onConfirm: async () => {
        try {
          await api.restoreCertificate(serialNo);
          toast("Certificate reactivated ✅", "ok");
          await loadCertificateRecords(eventId);
        } catch (e) {
          toast(e?.message || "Failed to reactivate certificate", "err");
        }
      },
    });
  }

  function askDeleteCertificateRecord(serialNo) {
    if (!serialNo) return;

    showConfirm({
      title: "Delete Certificate Registry Record",
      text: "This will permanently delete the certificate registry record.",
      confirmText: "Delete",
      tone: "danger",
      onConfirm: async () => {
        try {
          await api.deleteCertificateRecord(serialNo);
          toast("Certificate record deleted ✅", "ok");
          await loadCertificateRecords(eventId);
        } catch (e) {
          toast(e?.message || "Failed to delete certificate record", "err");
        }
      },
    });
  }

  function exportHistoryCsv() {
    const rows = (historyFiltered || []).map((h) => ({
      participant: h?.participantId?.userId?.name || "",
      email: h?.participantId?.userId?.email || "",
      group: h?.participantId?.groupId?.name || "",
      level: h?.participantId?.groupId?.level || "",
      event: h?.eventId?.name || selectedEvent?.name || "",
      type: h?.type || "",
      title: h?.title || "",
      issuedAt: h?.createdAt ? new Date(h.createdAt).toLocaleString() : "",
    }));

    const headers = [
      "participant",
      "email",
      "group",
      "level",
      "event",
      "type",
      "title",
      "issuedAt",
    ];

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map(
            (k) =>
              `"${String(r[k] ?? "")
                .replace(/"/g, '""')
                .replace(/\n/g, " ")}"`,
          )
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `awards-history-${String(selectedEvent?.name || "event")
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }, 1000);
  }

  function toggleSelected(id) {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected)
        bulkList.forEach((p) => next.delete(String(p._id)));
      else bulkList.forEach((p) => next.add(String(p._id)));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function selectGroupInBulk(groupIdToSelect) {
    const ids = bulkList
      .filter((p) => String(p?.groupId?._id || "") === String(groupIdToSelect))
      .map((p) => String(p?._id));
    setSelectedIds(new Set(ids));
  }

  async function bulkDownloadCertificates() {
    if (!eventId) return toast("Select event first.", "err");
    if (!api.certificatePdfBlob) {
      return toast("api.certificatePdfBlob missing in src/lib/api.js", "err");
    }
    if (!selectedCount) return toast("Select participants first.", "err");

    setBulkBusy(true);
    setErr("");

    try {
      const ids = Array.from(selectedIds);
      setBulkProgress({
        current: 0,
        total: ids.length,
        label: "Preparing downloads",
      });
      toast(`Starting bulk download (${ids.length})…`, "ok");

      for (let i = 0; i < ids.length; i += 1) {
        const pid = ids[i];
        const p = enrolledParticipants.find(
          (x) => String(x?._id) === String(pid),
        );
        const safeName = String(p?.userId?.name || `participant_${i + 1}`)
          .replace(/[^\w\- ]+/g, "")
          .trim()
          .replace(/\s+/g, "_");

        setBulkProgress({
          current: i + 1,
          total: ids.length,
          label: `Downloading ${safeName || pid}`,
        });

        // eslint-disable-next-line no-await-in-loop
        const blob = await api.certificatePdfBlob(eventId, pid);
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `certificate_${safeName || pid}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
          } catch {}
        }, 1500);

        // eslint-disable-next-line no-await-in-loop
        await sleep(350);
      }

      toast("Bulk download completed ✅", "ok");
    } catch (e) {
      toast(e?.message || "Bulk download failed", "err");
    } finally {
      if (mountedRef.current) {
        setBulkBusy(false);
        setBulkProgress({ current: 0, total: 0, label: "" });
      }
    }
  }

  async function bulkIssueAwards() {
    if (!eventId) return toast("Select event first.", "err");
    if (!selectedCount) return toast("Select participants first.", "err");

    setBulkBusy(true);
    setErr("");

    try {
      const ids = Array.from(selectedIds);
      let issued = 0;
      let skipped = 0;

      setBulkProgress({
        current: 0,
        total: ids.length,
        label: "Issuing awards",
      });

      for (let i = 0; i < ids.length; i += 1) {
        const pid = ids[i];
        const p = enrolledParticipants.find(
          (x) => String(x?._id) === String(pid),
        );
        const duplicate = (history || []).find((h) => {
          const hPid = h?.participantId?._id || h?.participantId;
          return (
            String(hPid) === String(pid) &&
            String(h?.type || "").toUpperCase() ===
              String(bulkIssueType || "").toUpperCase() &&
            String(h?.title || "")
              .trim()
              .toLowerCase() ===
              String(bulkIssueTitle || "")
                .trim()
                .toLowerCase()
          );
        });

        setBulkProgress({
          current: i + 1,
          total: ids.length,
          label: `Processing ${p?.userId?.name || `participant ${i + 1}`}`,
        });

        if (preventDuplicates && duplicate) {
          skipped += 1;
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        await api.issueAward({
          eventId,
          participantId: pid,
          type: bulkIssueType,
          title: String(bulkIssueTitle || "").trim(),
        });

        issued += 1;

        // eslint-disable-next-line no-await-in-loop
        await sleep(180);
      }

      await refreshHistory();
      toast(`Bulk issue done ✅ Issued: ${issued}, Skipped: ${skipped}`, "ok");
    } catch (e) {
      toast(e?.message || "Bulk issue failed", "err");
    } finally {
      if (mountedRef.current) {
        setBulkBusy(false);
        setBulkProgress({ current: 0, total: 0, label: "" });
      }
    }
  }

  function openHistoryView(item) {
    setHistoryViewItem(item || null);
    setDrawerOpen(true);
  }

  return (
    <div style={wrap}>
      <StyleTag />

      <div className="awHeader">
        <div>
          <div className="awTitle">Awards & Certificates</div>
          <div className="awSub">
            Enterprise awards workspace with verification, certificate registry,
            bulk operations, ZIP export, template tools, and audit-ready
            history.
          </div>
        </div>

        <div className="awHeaderRight">
          <div className="awHeaderPill">
            Events: <b>{events.length}</b>
          </div>
          <div className="awHeaderPill">
            Enrolled: <b>{enrolledParticipants.length}</b>
          </div>
          <div className="awHeaderPill">
            Revoked: <b>{eventStats.revokedSerials}</b>
          </div>
        </div>
      </div>

      {(msg || err) && (
        <div className={`awToast ${err ? "awToastErr" : "awToastOk"}`}>
          {err || msg}
        </div>
      )}

      {loading ? (
        <div className="awCard">Loading awards page…</div>
      ) : !hasEvents ? (
        <div className="awCard">
          <div className="awEmptyTitle">No events found</div>
          <div className="awEmptySub">
            Create an event first. This awards module works per event.
          </div>
        </div>
      ) : !hasParticipants ? (
        <div className="awCard">
          <div className="awEmptyTitle">No participants found</div>
          <div className="awEmptySub">
            Add participants first, then enroll them in an event.
          </div>
        </div>
      ) : (
        <>
          <div className="awCard awCompactBar">
            <div className="awCompactGrid">
              <div>
                <div className="awLabel">Select Event</div>
                <select
                  className={`awSelect ${formErr.eventId ? "awFieldErr" : ""}`}
                  value={eventId}
                  onChange={(e) => {
                    setEventId(e.target.value);
                    setNewPdfUrl("");
                    setFormErr((p) => ({ ...p, eventId: "" }));
                  }}
                >
                  {events.map((ev) => (
                    <option key={ev._id} value={ev._id}>
                      {formatEventLabel(ev)}
                    </option>
                  ))}
                </select>
                {formErr.eventId ? (
                  <div className="awErrorTxt">{formErr.eventId}</div>
                ) : null}
              </div>

              <div className="awTabWrap">
                <div className="awLabel">Section</div>
                <div className="awSubTabs">
                  <button
                    type="button"
                    className={`awSubTab ${
                      subTab === "ISSUE" ? "awSubTabActive" : ""
                    }`}
                    onClick={() => setSubTab("ISSUE")}
                  >
                    Issue
                  </button>
                  <button
                    type="button"
                    className={`awSubTab ${
                      subTab === "CERTS" ? "awSubTabActive" : ""
                    }`}
                    onClick={() => setSubTab("CERTS")}
                  >
                    Certificates
                  </button>
                  <button
                    type="button"
                    className={`awSubTab ${
                      subTab === "HISTORY" ? "awSubTabActive" : ""
                    }`}
                    onClick={() => setSubTab("HISTORY")}
                  >
                    History
                  </button>
                  <button
                    type="button"
                    className={`awSubTab ${
                      subTab === "BULK" ? "awSubTabActive" : ""
                    }`}
                    onClick={() => setSubTab("BULK")}
                  >
                    Bulk
                  </button>
                </div>
              </div>
            </div>

            <div className="awStatsRow awStatsRowSeven">
              <StatCard label="Enrolled" value={eventStats.enrolled} />
              <StatCard label="Awards Issued" value={eventStats.issued} />
              <StatCard label="Certificates" value={eventStats.certificates} />
              <StatCard label="Medals" value={eventStats.medals} />
              <StatCard label="Groups" value={eventStats.groups} />
              <StatCard label="Serials" value={eventStats.serials} />
              <StatCard label="Revoked" value={eventStats.revokedSerials} />
            </div>
          </div>

          {subTab === "ISSUE" ? (
            <div className="awSectionGrid">
              <div className="awCard">
                <div className="awTitleSm">Issue Award</div>
                <div className="awSubSm">
                  Select an enrolled participant, choose award type, and issue
                  awards with duplicate protection.
                </div>

                <div className="awRow2" style={{ marginTop: 16 }}>
                  <div>
                    <div className="awLabel">Filter by Group</div>
                    <select
                      className="awSelect"
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                    >
                      <option value="">All Groups</option>
                      {groups.map((g) => (
                        <option key={g._id} value={g._id}>
                          {g.name}
                          {g.level ? ` (${g.level})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="awLabel">Search Participant</div>
                    <input
                      className="awInput"
                      value={participantQ}
                      onChange={(e) => setParticipantQ(e.target.value)}
                      placeholder="Name / email / BIB / group"
                    />
                  </div>
                </div>

                <div className="awLabel" style={{ marginTop: 18 }}>
                  Select Participant
                </div>
                <select
                  className={`awSelect ${
                    formErr.participantId ? "awFieldErr" : ""
                  }`}
                  value={participantId}
                  onChange={(e) => {
                    setParticipantId(e.target.value);
                    setNewPdfUrl("");
                    setFormErr((p) => ({ ...p, participantId: "" }));
                  }}
                  disabled={eventLoading || !filteredParticipants.length}
                >
                  {!filteredParticipants.length ? (
                    <option value="">No enrolled participants found</option>
                  ) : null}

                  {filteredParticipants.map((p) => (
                    <option key={p._id} value={p._id}>
                      {formatParticipantLabel(p)}
                    </option>
                  ))}
                </select>
                {formErr.participantId ? (
                  <div className="awErrorTxt">{formErr.participantId}</div>
                ) : null}

                <div className="awQuickNav">
                  <button
                    type="button"
                    className="awBtn"
                    onClick={() => goToAdjacentParticipant(-1)}
                    disabled={!filteredParticipants.length}
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    className="awBtn"
                    onClick={pickRandomParticipant}
                    disabled={!filteredParticipants.length}
                  >
                    Random
                  </button>
                  <button
                    type="button"
                    className="awBtn"
                    onClick={() => goToAdjacentParticipant(1)}
                    disabled={!filteredParticipants.length}
                  >
                    Next →
                  </button>
                </div>

                <div className="awLabel" style={{ marginTop: 18 }}>
                  Award Type
                </div>
                <div className="awChips">
                  <button
                    type="button"
                    className={`awChip ${type === "MEDAL" ? "awChipActive" : ""}`}
                    onClick={() => {
                      setType("MEDAL");
                      setNewPdfUrl("");
                    }}
                  >
                    🏅 Medal
                  </button>

                  <button
                    type="button"
                    className={`awChip ${
                      type === "CERTIFICATE" ? "awChipActive" : ""
                    }`}
                    onClick={() => setType("CERTIFICATE")}
                  >
                    📄 Certificate
                  </button>
                </div>

                <div className="awLabel" style={{ marginTop: 18 }}>
                  Title Presets
                </div>
                <div className="awPresetWrap">
                  {activePresets.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`awPreset ${
                        title === item ? "awPresetActive" : ""
                      }`}
                      onClick={() => {
                        setTitle(item);
                        setFormErr((p) => ({ ...p, title: "" }));
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="awLabel" style={{ marginTop: 18 }}>
                  Title
                </div>
                <input
                  className={`awInput ${formErr.title ? "awFieldErr" : ""}`}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setFormErr((p) => ({ ...p, title: "" }));
                  }}
                  placeholder="Participation Award / Excellence / Gold Medal"
                />
                {formErr.title ? (
                  <div className="awErrorTxt">{formErr.title}</div>
                ) : null}

                <label className="awCheckRow">
                  <input
                    type="checkbox"
                    checked={preventDuplicates}
                    onChange={(e) => setPreventDuplicates(e.target.checked)}
                  />
                  <span>Prevent duplicates</span>
                </label>

                {currentDuplicate && preventDuplicates ? (
                  <div className="awWarnBox">
                    Duplicate detected: this participant already has the same
                    <b> {type}</b> titled <b>“{title}”</b> in this event.
                  </div>
                ) : null}

                <div className="awPrimaryGroup">
                  <button
                    className="awPrimaryBtn awPrimaryBtnInline"
                    type="button"
                    onClick={() => issueCore("NORMAL")}
                    disabled={issueDisabled}
                  >
                    {issuing ? "Issuing…" : "Issue Award"}
                  </button>

                  <button
                    className="awPrimaryBtn awPrimaryBtnInline"
                    type="button"
                    onClick={() => issueCore("NEXT")}
                    disabled={issueDisabled}
                  >
                    {issuing ? "Issuing…" : "Issue & Next"}
                  </button>

                  <button
                    className="awPrimaryBtn awPrimaryBtnInline"
                    type="button"
                    onClick={() => issueCore("OPEN_CERT")}
                    disabled={issueDisabled}
                  >
                    {issuing ? "Issuing…" : "Issue & Open Certificate"}
                  </button>
                </div>
              </div>

              <div className="awCard">
                <div className="awTitleSm">Selected Participant</div>
                <div className="awSubSm">
                  Summary, enrollment status, and live preview for the current
                  selection.
                </div>

                <div className="awInfoCard">
                  <div className="awInfoName">{participantName}</div>
                  <div className="awInfoEvent">{eventName}</div>

                  <div className="awParticipantMeta awParticipantMetaWide">
                    <MiniInfo
                      label="Enrollment"
                      value={selectedEnrollment ? "Enrolled" : "Not Enrolled"}
                      tone={selectedEnrollment ? "ok" : "warn"}
                    />
                    <MiniInfo label="Group" value={groupName || "—"} />
                    <MiniInfo label="Level" value={level || "—"} />
                    <MiniInfo label="BIB" value={bibNo} />
                    <MiniInfo label="Award Type" value={type} />
                    <MiniInfo label="Title" value={title || "—"} clamp />
                    <MiniInfo label="Serial" value={serialNo || "—"} clamp />
                    <MiniInfo
                      label="Verification"
                      value={
                        selectedCertificate?.isRevoked
                          ? "Revoked"
                          : selectedCertificate
                            ? "Active"
                            : "Pending"
                      }
                    />
                  </div>
                </div>

                <div className="awMiniPreviewWrap">
                  <div className="awLabel" style={{ marginBottom: 10 }}>
                    Live Preview
                  </div>

                  {type === "MEDAL" ? (
                    <MedalPreviewCard
                      participantName={participantName}
                      eventName={eventName}
                      title={title}
                      groupLine={`${groupName}${level ? ` · ${level}` : ""}`}
                      bibNo={bibNo}
                    />
                  ) : (
                    <CertificateCard
                      title={title}
                      participantName={participantName}
                      groupLine={`${groupName}${level ? ` · ${level}` : ""}`}
                      dateLabel={dateLabel}
                      eventName={eventName}
                      bibNo={bibNo}
                      signatoryName={signatoryName}
                      note={certificateNote}
                      showQrPlaceholder={showQrPlaceholder}
                      showSerialNumber={showSerialNumber}
                      serialNo={serialNo}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {subTab === "CERTS" ? (
            <div className="awSectionGrid">
              <div className="awCard">
                <div className="awTitleSm">Certificate Center</div>
                <div className="awSubSm">
                  Preview, generate, download, verify, revoke, and manage
                  certificate output.
                </div>

                <div className="awPreviewShell" style={{ marginTop: 16 }}>
                  <div className="awPreviewTop">
                    <div>
                      <div className="awPreviewTitle">
                        {type === "CERTIFICATE"
                          ? "Live Certificate Preview"
                          : "Medal Preview"}
                      </div>
                      <div className="awPreviewSub">
                        Preview updates with selected event, participant, group,
                        level and BIB.
                      </div>
                    </div>
                    <div className="awPreviewBadge">
                      {type === "CERTIFICATE" ? "CERTIFICATE" : "MEDAL"}
                    </div>
                  </div>

                  {type === "CERTIFICATE" ? (
                    <CertificateCard
                      title={title}
                      participantName={participantName}
                      groupLine={`${groupName}${level ? ` · ${level}` : ""}`}
                      dateLabel={dateLabel}
                      eventName={eventName}
                      bibNo={bibNo}
                      signatoryName={signatoryName}
                      note={certificateNote}
                      showQrPlaceholder={showQrPlaceholder}
                      showSerialNumber={showSerialNumber}
                      serialNo={serialNo}
                    />
                  ) : (
                    <MedalPreviewCard
                      participantName={participantName}
                      eventName={eventName}
                      title={title}
                      groupLine={`${groupName}${level ? ` · ${level}` : ""}`}
                      bibNo={bibNo}
                      large
                    />
                  )}
                </div>

                <div className="awActions" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="awBtn"
                    onClick={() => loadCertificatePdf(eventId, selected?._id)}
                    disabled={!selected?._id || !eventId || pdfLoading}
                  >
                    {pdfLoading ? "Generating…" : "Generate PDF Preview"}
                  </button>

                  <button
                    type="button"
                    className="awBtn"
                    onClick={downloadCertificate}
                    disabled={!selected?._id || !eventId}
                  >
                    Download PDF
                  </button>

                  <button
                    type="button"
                    className="awBtn"
                    onClick={openInNewTab}
                    disabled={!pdfUrl}
                  >
                    Open in New Tab
                  </button>

                  <button
                    type="button"
                    className="awBtn"
                    onClick={verifySelectedCertificate}
                    disabled={!selectedCertificate}
                  >
                    Verify
                  </button>

                  <button
                    type="button"
                    className="awBtn awBtnDanger"
                    onClick={askRevokeSelectedCertificate}
                    disabled={
                      !selectedCertificate || selectedCertificate?.isRevoked
                    }
                  >
                    Revoke
                  </button>
                </div>

                <div className="awPdfBox" style={{ marginTop: 16 }}>
                  <div className="awPdfHead">
                    <div className="awPdfHeadTitle">
                      PDF Preview (Generated)
                    </div>
                    <div className="awPdfHeadSub">
                      Event-based fetch with selected event + participant.
                    </div>
                  </div>

                  {pdfUrl ? (
                    <iframe
                      title="Certificate PDF Preview"
                      className="awIframe"
                      src={pdfUrl}
                    />
                  ) : (
                    <div className="awPdfEmpty">
                      Click <b>Generate PDF Preview</b> to load the certificate
                      PDF here.
                    </div>
                  )}
                </div>
              </div>

              <div className="awCard">
                <div className="awTitleSm">Certificate Options</div>
                <div className="awSubSm">
                  Preview-only controls for signatory, note, serial, QR
                  placeholder, lookup, and template management.
                </div>

                <div className="awFormStack" style={{ marginTop: 16 }}>
                  <div>
                    <div className="awLabel">Signatory Name</div>
                    <input
                      className="awInput"
                      value={signatoryName}
                      onChange={(e) => setSignatoryName(e.target.value)}
                      placeholder="Authorized Signatory"
                    />
                  </div>

                  <div>
                    <div className="awLabel">Certificate Note</div>
                    <textarea
                      className="awTextarea"
                      value={certificateNote}
                      onChange={(e) => setCertificateNote(e.target.value)}
                      placeholder="Optional note / subtitle / special recognition details"
                    />
                  </div>

                  <label className="awCheckRow">
                    <input
                      type="checkbox"
                      checked={showSerialNumber}
                      onChange={(e) => setShowSerialNumber(e.target.checked)}
                    />
                    <span>Show serial number in preview</span>
                  </label>

                  <label className="awCheckRow">
                    <input
                      type="checkbox"
                      checked={showQrPlaceholder}
                      onChange={(e) => setShowQrPlaceholder(e.target.checked)}
                    />
                    <span>Show QR placeholder in preview</span>
                  </label>
                </div>

                <div className="awLookupBox">
                  <div className="awLabel">Verify by Serial</div>
                  <div className="awLookupRow">
                    <input
                      className="awInput"
                      value={verifySerialInput}
                      onChange={(e) => setVerifySerialInput(e.target.value)}
                      placeholder="Enter certificate serial number"
                    />
                    <button
                      type="button"
                      className="awBtn"
                      onClick={findCertificateBySerial}
                      disabled={verifyBusy}
                    >
                      {verifyBusy ? "Checking…" : "Find"}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="awCollapseBtn"
                  onClick={() => setTemplateOpen((v) => !v)}
                  style={{ marginTop: 18 }}
                >
                  {templateOpen
                    ? "Hide Template Manager"
                    : "Show Template Manager"}
                </button>

                {templateOpen ? (
                  <div className="awTplCard" style={{ marginTop: 14 }}>
                    <div className="awTplTop">
                      <div>
                        <div className="awTplTitle">
                          Certificate Template (PDF)
                        </div>
                        <div className="awTplSub">
                          Upload an A4 landscape PDF to use as certificate
                          background/layout.
                        </div>
                      </div>

                      <div className="awTplStatus">
                        {tplInfo?.filename ? (
                          <>
                            <span className="dotOk" /> Saved
                          </>
                        ) : (
                          <>
                            <span className="dotWarn" /> Not uploaded
                          </>
                        )}
                      </div>
                    </div>

                    {tplInfo?.filename ? (
                      <div className="awTplMeta">
                        <div>
                          <b>File:</b> {tplInfo.filename}
                        </div>
                        {tplInfo.updatedAt ? (
                          <div>
                            <b>Updated:</b>{" "}
                            {new Date(tplInfo.updatedAt).toLocaleString()}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="awTplMeta">
                        No template uploaded yet. Upload a PDF to enable
                        template preview.
                      </div>
                    )}

                    <div className="awTplActions">
                      <label className="awFileBtn">
                        {tplLoading ? "Uploading…" : "Upload Template PDF"}
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            uploadTemplatePdf(file);
                            e.target.value = "";
                          }}
                          disabled={tplLoading}
                          style={{ display: "none" }}
                        />
                      </label>

                      <button
                        type="button"
                        className="awBtn"
                        onClick={loadTemplatePdf}
                        disabled={tplLoading}
                      >
                        {tplLoading ? "Loading…" : "Preview Template"}
                      </button>

                      <button
                        type="button"
                        className="awBtn"
                        onClick={downloadTemplatePdf}
                        disabled={!tplInfo?.filename}
                      >
                        Download Template
                      </button>
                    </div>

                    <div className="awTplPreview">
                      {tplUrl ? (
                        <iframe
                          title="Template PDF Preview"
                          className="awIframeTpl"
                          src={tplUrl}
                        />
                      ) : (
                        <div className="awTplEmpty">
                          Click <b>Preview Template</b> after uploading.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="awCollapsedHint">
                    Template controls are hidden to keep this screen lighter.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {subTab === "HISTORY" ? (
            <div className="awSectionGrid">
              <div className="awCard awSpanAll">
                <div className="awHistoryTop">
                  <div>
                    <div className="awTitleSm">Award History</div>
                    <div className="awSubSm">
                      Search, filter, export, review and delete award records.
                    </div>
                  </div>

                  <div className="awHistoryActions">
                    <input
                      className="awInput awHistorySearch"
                      value={historyQ}
                      onChange={(e) => setHistoryQ(e.target.value)}
                      placeholder="Search history..."
                    />
                    <select
                      className="awSelect awHistoryType"
                      value={historyTypeFilter}
                      onChange={(e) => setHistoryTypeFilter(e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="MEDAL">Medals</option>
                      <option value="CERTIFICATE">Certificates</option>
                    </select>

                    <select
                      className="awSelect awHistoryType"
                      value={historySort}
                      onChange={(e) => setHistorySort(e.target.value)}
                    >
                      <option value="NEWEST">Newest</option>
                      <option value="OLDEST">Oldest</option>
                      <option value="TITLE">Title A-Z</option>
                    </select>

                    <button
                      type="button"
                      className="awBtn"
                      onClick={refreshHistory}
                      disabled={historyLoading}
                    >
                      {historyLoading ? "Refreshing…" : "Refresh"}
                    </button>
                    <button
                      type="button"
                      className="awBtn"
                      onClick={exportHistoryCsv}
                      disabled={!historyFiltered.length}
                    >
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="awHistoryList">
                  {!historyFiltered.length ? (
                    <div className="awHistoryEmpty awRichEmpty">
                      <div className="awRichEmptyIcon">🏆</div>
                      <div className="awRichEmptyTitle">
                        No awards found for this event yet
                      </div>
                      <div className="awRichEmptySub">
                        Issue the first award for <b>{eventName}</b> to populate
                        history.
                      </div>
                    </div>
                  ) : (
                    historyFiltered.map((h) => {
                      const pid = h?.participantId;
                      const badgeType = String(h?.type || "").toUpperCase();

                      return (
                        <div
                          className="awHistoryRow"
                          key={h?._id || `${h?.title}-${h?.createdAt}`}
                        >
                          <div className="awHistoryMain">
                            <div className="awHistoryTopLine">
                              <div className="awHistoryName">
                                {pid?.userId?.name || "—"}
                              </div>
                              <span
                                className={`awHistoryBadge ${
                                  badgeType === "CERTIFICATE" ? "cert" : "medal"
                                }`}
                              >
                                {badgeType || "—"}
                              </span>
                            </div>

                            <div className="awHistoryMeta">
                              {h?.eventId?.name || eventName} ·{" "}
                              {pid?.groupId?.name || "—"}
                              {pid?.groupId?.level
                                ? ` (${pid.groupId.level})`
                                : ""}{" "}
                              · {pid?.userId?.email || "—"}
                            </div>

                            <div className="awHistoryTitle">
                              {h?.title || "—"}
                            </div>
                          </div>

                          <div className="awHistorySide">
                            <div className="awHistoryDate">
                              {h?.createdAt
                                ? new Date(h.createdAt).toLocaleString()
                                : "—"}
                            </div>
                            <div className="awHistorySideBtns">
                              <button
                                type="button"
                                className="awBtn"
                                onClick={() => openHistoryView(h)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="awDeleteBtn"
                                onClick={() => askDeleteHistoryItem(h?._id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="awCertRegistry">
                  <div className="awTitleSm">Certificate Registry</div>
                  <div className="awSubSm">
                    Serial records, verification status and revocation state for
                    this event.
                  </div>

                  <div className="awRegistryList">
                    {certLoading ? (
                      <div className="awCollapsedHint">
                        Loading certificate records…
                      </div>
                    ) : !certificateRows.length ? (
                      <div className="awCollapsedHint">
                        No certificate records found for this event.
                      </div>
                    ) : (
                      certificateRows.map((row) => (
                        <div
                          className="awRegistryRow"
                          key={row._id || row.serialNo}
                        >
                          <div className="awRegistryMain">
                            <div className="awRegistrySerial">
                              {row.serialNo || "—"}
                            </div>
                            <div className="awRegistryMeta">
                              {row.participantName ||
                                row?.participantId?.userId?.name ||
                                "—"}{" "}
                              · {row.eventName || eventName} ·{" "}
                              {row.title || "—"}
                            </div>
                          </div>

                          <div className="awRegistryActions">
                            <span
                              className={`awRegistryPill ${
                                row.isRevoked ? "revoked" : "active"
                              }`}
                            >
                              {row.isRevoked ? "Revoked" : "Active"}
                            </span>

                            {row.isRevoked ? (
                              <button
                                type="button"
                                className="awBtn"
                                onClick={() =>
                                  askRestoreCertificateRecord(row.serialNo)
                                }
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="awBtn awBtnDanger"
                                onClick={() =>
                                  askRevokeCertificateRecord(row.serialNo)
                                }
                              >
                                Revoke
                              </button>
                            )}

                            <button
                              type="button"
                              className="awBtn awBtnDanger"
                              onClick={() =>
                                askDeleteCertificateRecord(row.serialNo)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {subTab === "BULK" ? (
            <div className="awSectionGrid">
              <div className="awCard">
                <div className="awTitleSm">Bulk Workspace</div>
                <div className="awSubSm">
                  Select enrolled participants and download certificates, export
                  ZIPs, or issue awards in bulk.
                </div>

                <div className="awInlineFilters">
                  <div>
                    <div className="awLabel">Search</div>
                    <input
                      className="awInput"
                      value={bulkQ}
                      onChange={(e) => setBulkQ(e.target.value)}
                      placeholder="Search name / email / group / BIB"
                    />
                  </div>

                  <div>
                    <div className="awLabel">Filter by Group</div>
                    <select
                      className="awSelect"
                      value={bulkGroupId}
                      onChange={(e) => setBulkGroupId(e.target.value)}
                    >
                      <option value="">All Groups</option>
                      {groups.map((g) => (
                        <option key={g._id} value={g._id}>
                          {g.name}
                          {g.level ? ` (${g.level})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="awGroupShortcuts">
                  {groups.slice(0, 8).map((g) => (
                    <button
                      key={g._id}
                      type="button"
                      className="awPreset"
                      onClick={() => {
                        setBulkGroupId(g._id);
                        setTimeout(() => selectGroupInBulk(g._id), 0);
                      }}
                    >
                      Select {g.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="awPreset"
                    onClick={() => {
                      setBulkGroupId("");
                      clearSelection();
                    }}
                  >
                    Clear Group Selection
                  </button>
                </div>

                <div className="awBulkBar">
                  <div className="awBulkCount">
                    Event: <b>{eventName}</b> · Showing <b>{bulkList.length}</b>{" "}
                    · Selected <b>{selectedCount}</b>
                  </div>

                  <div className="awBulkBtns">
                    <button
                      type="button"
                      className="awBtn"
                      onClick={toggleSelectAllFiltered}
                      disabled={bulkBusy || !bulkList.length}
                    >
                      {allFilteredSelected
                        ? "Unselect Filtered"
                        : "Select Filtered"}
                    </button>

                    <button
                      type="button"
                      className="awBtn"
                      onClick={clearSelection}
                      disabled={bulkBusy || !selectedCount}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {bulkBusy && bulkProgress.total > 0 ? (
                  <div className="awProgressCard">
                    <div className="awProgressTop">
                      <div className="awProgressLabel">
                        {bulkProgress.label || "Processing"}
                      </div>
                      <div className="awProgressCount">
                        {bulkProgress.current}/{bulkProgress.total}
                      </div>
                    </div>
                    <div className="awProgressBar">
                      <div
                        className="awProgressFill"
                        style={{
                          width: `${Math.max(
                            6,
                            Math.round(
                              (bulkProgress.current / bulkProgress.total) * 100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="awBulkListInline">
                  {!bulkList.length ? (
                    <div className="awBulkEmpty awRichEmpty">
                      <div className="awRichEmptyIcon">📄</div>
                      <div className="awRichEmptyTitle">
                        No participants match the filter
                      </div>
                      <div className="awRichEmptySub">
                        Adjust the search or group filter to see enrolled
                        participants here.
                      </div>
                    </div>
                  ) : (
                    bulkList.map((p) => {
                      const id = String(p._id);
                      const checked = selectedIds.has(id);

                      return (
                        <label
                          key={id}
                          className={`awBulkRow ${checked ? "awBulkRowOn" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelected(id)}
                            disabled={bulkBusy}
                            style={{ width: 18, height: 18 }}
                          />

                          <div style={{ minWidth: 0 }}>
                            <div className="awBulkName">
                              {p?.userId?.name || "—"}
                            </div>
                            <div className="awBulkMeta">
                              {p?.userId?.email || "—"} ·{" "}
                              {p?.groupId?.name || "—"}
                              {p?.groupId?.level
                                ? ` (${p.groupId.level})`
                                : ""}{" "}
                              · BIB {p?.bibNo || "—"}
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="awCard">
                <div className="awTitleSm">Bulk Actions</div>
                <div className="awSubSm">
                  Choose download, ZIP export, or issue mode for selected
                  participants.
                </div>

                <div className="awLabel" style={{ marginTop: 16 }}>
                  Mode
                </div>
                <div className="awChips">
                  <button
                    type="button"
                    className={`awChip ${bulkMode === "DOWNLOAD" ? "awChipActive" : ""}`}
                    onClick={() => setBulkMode("DOWNLOAD")}
                  >
                    ⬇️ Download Certificates
                  </button>
                  <button
                    type="button"
                    className={`awChip ${bulkMode === "ISSUE" ? "awChipActive" : ""}`}
                    onClick={() => setBulkMode("ISSUE")}
                  >
                    🏆 Issue Awards
                  </button>
                  <button
                    type="button"
                    className={`awChip ${
                      bulkMode === "ZIP_EVENT" ? "awChipActive" : ""
                    }`}
                    onClick={() => setBulkMode("ZIP_EVENT")}
                  >
                    🗜️ Event ZIP
                  </button>
                  <button
                    type="button"
                    className={`awChip ${
                      bulkMode === "ZIP_GROUP" ? "awChipActive" : ""
                    }`}
                    onClick={() => setBulkMode("ZIP_GROUP")}
                  >
                    🗜️ Group ZIP
                  </button>
                </div>

                {bulkMode === "ISSUE" ? (
                  <>
                    <div className="awLabel" style={{ marginTop: 18 }}>
                      Award Type
                    </div>
                    <div className="awChips">
                      <button
                        type="button"
                        className={`awChip ${
                          bulkIssueType === "MEDAL" ? "awChipActive" : ""
                        }`}
                        onClick={() => setBulkIssueType("MEDAL")}
                      >
                        🏅 Medal
                      </button>
                      <button
                        type="button"
                        className={`awChip ${
                          bulkIssueType === "CERTIFICATE" ? "awChipActive" : ""
                        }`}
                        onClick={() => setBulkIssueType("CERTIFICATE")}
                      >
                        📄 Certificate
                      </button>
                    </div>

                    <div className="awLabel" style={{ marginTop: 18 }}>
                      Title Presets
                    </div>
                    <div className="awPresetWrap">
                      {bulkPresets.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`awPreset ${
                            bulkIssueTitle === item ? "awPresetActive" : ""
                          }`}
                          onClick={() => setBulkIssueTitle(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>

                    <div className="awLabel" style={{ marginTop: 18 }}>
                      Title
                    </div>
                    <input
                      className="awInput"
                      value={bulkIssueTitle}
                      onChange={(e) => setBulkIssueTitle(e.target.value)}
                      placeholder="Bulk issue title"
                    />
                  </>
                ) : null}

                <div className="awBulkActionBox">
                  <div className="awBulkSummaryLine">
                    Selected Participants: <b>{selectedCount}</b>
                  </div>
                  <div className="awBulkSummaryLine">
                    Event: <b>{eventName}</b>
                  </div>
                  {bulkMode === "ISSUE" ? (
                    <div className="awBulkSummaryLine">
                      Action: <b>{bulkIssueType}</b> — <b>{bulkIssueTitle}</b>
                    </div>
                  ) : bulkMode === "ZIP_EVENT" ? (
                    <div className="awBulkSummaryLine">
                      Action: <b>Download full event ZIP</b>
                    </div>
                  ) : bulkMode === "ZIP_GROUP" ? (
                    <div className="awBulkSummaryLine">
                      Action: <b>Download selected group ZIP</b>
                    </div>
                  ) : (
                    <div className="awBulkSummaryLine">
                      Action: <b>Download Certificates</b>
                    </div>
                  )}
                </div>

                {bulkMode === "DOWNLOAD" ? (
                  <button
                    type="button"
                    className="awPrimaryBtn awPrimaryBtnSolo"
                    onClick={bulkDownloadCertificates}
                    disabled={bulkBusy || !selectedCount}
                  >
                    {bulkBusy ? "Downloading…" : "⬇️ Download Selected"}
                  </button>
                ) : bulkMode === "ISSUE" ? (
                  <button
                    type="button"
                    className="awPrimaryBtn awPrimaryBtnSolo"
                    onClick={bulkIssueAwards}
                    disabled={
                      bulkBusy ||
                      !selectedCount ||
                      !String(bulkIssueTitle).trim()
                    }
                  >
                    {bulkBusy ? "Processing…" : "🏆 Issue Selected"}
                  </button>
                ) : bulkMode === "ZIP_EVENT" ? (
                  <button
                    type="button"
                    className="awPrimaryBtn awPrimaryBtnSolo"
                    onClick={downloadEventZip}
                    disabled={bulkBusy || !eventId}
                  >
                    {bulkBusy ? "Preparing…" : "🗜️ Download Event ZIP"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="awPrimaryBtn awPrimaryBtnSolo"
                    onClick={downloadGroupZip}
                    disabled={bulkBusy || !eventId || !bulkGroupId}
                  >
                    {bulkBusy ? "Preparing…" : "🗜️ Download Group ZIP"}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        text={confirmState.text}
        confirmText={confirmState.confirmText}
        tone={confirmState.tone}
        onClose={closeConfirm}
        onConfirm={async () => {
          const fn = confirmState.onConfirm;
          closeConfirm();
          if (typeof fn === "function") await fn();
        }}
      />

      <ReasonModal
        open={reasonModal.open}
        title={reasonModal.title}
        value={reasonModal.value}
        placeholder={reasonModal.placeholder}
        confirmText={reasonModal.confirmText}
        onChange={(next) =>
          setReasonModal((prev) => ({
            ...prev,
            value: next,
          }))
        }
        onClose={closeReasonModal}
        onConfirm={async () => {
          const fn = reasonModal.onConfirm;
          const value = String(reasonModal.value || "").trim();
          closeReasonModal();
          if (typeof fn === "function") await fn(value);
        }}
      />

      <HistoryDrawer
        open={drawerOpen}
        item={historyViewItem}
        onClose={() => {
          setDrawerOpen(false);
          setHistoryViewItem(null);
        }}
      />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="awStatCard">
      <div className="awStatLabel">{label}</div>
      <div className="awStatValue">{value}</div>
    </div>
  );
}

function MiniInfo({ label, value, tone = "", clamp = false }) {
  return (
    <div className="awMiniCard">
      <div className="awMiniLabel">{label}</div>
      <div className={`awMiniValue ${tone} ${clamp ? "awClamp2" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function CertificateCard({
  title,
  participantName,
  groupLine,
  dateLabel,
  eventName,
  bibNo,
  signatoryName,
  note,
  showQrPlaceholder,
  showSerialNumber,
  serialNo,
}) {
  return (
    <div className="certWrap">
      <div className="certDots certDotsTop" aria-hidden="true" />
      <div className="certDots certDotsBottom" aria-hidden="true" />

      <div className="certCorner certTL" aria-hidden="true">
        🤸‍♀️
      </div>
      <div className="certCorner certTR" aria-hidden="true">
        🤸
      </div>
      <div className="certCorner certBL" aria-hidden="true">
        🤸‍♂️
      </div>
      <div className="certCorner certBR" aria-hidden="true">
        🤸‍♀️
      </div>

      <div className="certStars" aria-hidden="true">
        ★ ★ ★ ★ ★
      </div>

      <div className="certTitleBig">GYMNASTIC</div>
      <div className="certTitleSub">
        {(title || "Participation Award").toUpperCase()}
      </div>

      <div className="certPresented">Presented to</div>
      <div className="certName">{participantName}</div>
      <div className="certNameLine" />

      <div className="certDesc">
        For outstanding performance, commitment, and dedication in training.
      </div>

      <div className="certEvent">{eventName}</div>
      {note ? <div className="certNote">{note}</div> : null}

      <div className="certMetaRow">
        <div className="certMetaCol">
          <div className="certLine" />
          <div className="certMetaLabel">Date</div>
          <div className="certMetaValue">{dateLabel}</div>
        </div>
        <div className="certMetaCol">
          <div className="certLine" />
          <div className="certMetaLabel">BIB No</div>
          <div className="certMetaValue">{bibNo}</div>
        </div>
      </div>

      <div className="certMetaRow certMetaRowBottom">
        <div className="certMetaCol">
          <div className="certLine" />
          <div className="certMetaLabel">Signatory</div>
          <div className="certMetaValue">{signatoryName || "Authorized"}</div>
        </div>
        <div className="certMetaCol">
          <div className="certLine" />
          <div className="certMetaLabel">Group</div>
          <div className="certMetaValue">{groupLine}</div>
        </div>
      </div>

      <div className="certFooter">
        {showSerialNumber ? <span className="certPill">{serialNo}</span> : null}
        <span className="certPill">Rebel Angels · Gymnastics Scoring</span>
        {showQrPlaceholder ? (
          <span className="certPill certQrPill">QR</span>
        ) : null}
      </div>
    </div>
  );
}

function MedalPreviewCard({
  participantName,
  eventName,
  title,
  groupLine,
  bibNo,
  large = false,
}) {
  const medalEmoji = /gold/i.test(title)
    ? "🥇"
    : /silver/i.test(title)
      ? "🥈"
      : /bronze/i.test(title)
        ? "🥉"
        : "🏅";

  return (
    <div className={`awMedalCard ${large ? "large" : ""}`}>
      <div className="awMedalTop">
        <div className="awMedalIcon">{medalEmoji}</div>
        <div>
          <div className="awMedalTitle">{title || "Award"}</div>
          <div className="awMedalEvent">{eventName}</div>
        </div>
      </div>

      <div className="awMedalName">{participantName}</div>

      <div className="awMedalMetaRow">
        <span className="awMedalPill">{groupLine}</span>
        <span className="awMedalPill">BIB {bibNo}</span>
      </div>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  text,
  confirmText,
  tone = "danger",
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="awModalBackdrop" onClick={onClose}>
      <div className="awModal" onClick={(e) => e.stopPropagation()}>
        <div className="awModalTitle">{title || "Confirm action"}</div>
        <div className="awModalText">{text || "Are you sure?"}</div>

        <div className="awModalActions">
          <button type="button" className="awBtn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`awBtn ${tone === "danger" ? "awBtnDanger" : "awBtnPrimarySoft"}`}
            onClick={onConfirm}
          >
            {confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonModal({
  open,
  title,
  value,
  placeholder,
  confirmText,
  onChange,
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="awModalBackdrop" onClick={onClose}>
      <div className="awModal" onClick={(e) => e.stopPropagation()}>
        <div className="awModalTitle">{title || "Enter reason"}</div>
        <div className="awModalText">Provide a short reason to continue.</div>

        <textarea
          className="awTextarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Reason"}
          style={{ marginTop: 14 }}
        />

        <div className="awModalActions">
          <button type="button" className="awBtn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="awBtn awBtnDanger"
            onClick={onConfirm}
          >
            {confirmText || "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryDrawer({ open, item, onClose }) {
  if (!open || !item) return null;

  const participant = item?.participantId;
  const badgeType = String(item?.type || "").toUpperCase();

  return (
    <div className="awDrawerBackdrop" onClick={onClose}>
      <div className="awDrawer" onClick={(e) => e.stopPropagation()}>
        <div className="awDrawerTop">
          <div>
            <div className="awDrawerTitle">Award Record</div>
            <div className="awDrawerSub">
              Detailed event-level award information.
            </div>
          </div>
          <button type="button" className="awBtn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="awDrawerGrid">
          <MiniInfo
            label="Participant"
            value={participant?.userId?.name || "—"}
          />
          <MiniInfo
            label="Email"
            value={participant?.userId?.email || "—"}
            clamp
          />
          <MiniInfo label="Group" value={participant?.groupId?.name || "—"} />
          <MiniInfo label="Level" value={participant?.groupId?.level || "—"} />
          <MiniInfo label="Type" value={badgeType || "—"} />
          <MiniInfo label="Title" value={item?.title || "—"} clamp />
          <MiniInfo
            label="Issued At"
            value={
              item?.createdAt ? new Date(item.createdAt).toLocaleString() : "—"
            }
          />
          <MiniInfo label="Event" value={item?.eventId?.name || "—"} clamp />
        </div>
      </div>
    </div>
  );
}

function StyleTag() {
  return (
    <style>{`
      .awHeader{
        margin-bottom:16px;
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        gap:12px;
        flex-wrap:wrap;
      }
      .awHeaderRight{
        display:flex;
        gap:10px;
        align-items:center;
        flex-wrap:wrap;
      }
      .awTitle{
        font-weight:950;
        font-size:20px;
        color:#0b1220;
      }
      .awSub{
        margin-top:6px;
        font-size:12px;
        opacity:.72;
      }
      .awTitleSm{
        font-weight:950;
        font-size:16px;
        color:#0b1220;
      }
      .awSubSm{
        margin-top:4px;
        font-size:12px;
        opacity:.72;
        font-weight:800;
      }

      .awHeaderPill{
        padding:10px 14px;
        border-radius:999px;
        background:rgba(255,241,242,0.7);
        border:1px solid rgba(225,29,46,0.18);
        color:${RED};
        font-weight:950;
      }

      .awToast{
        margin-bottom:14px;
        padding:12px 14px;
        border-radius:16px;
        font-weight:900;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.70);
      }
      .awToastOk{
        color:rgba(22,101,52,0.95);
        border-color:rgba(34,197,94,0.20);
        background:rgba(236,253,245,0.85);
      }
      .awToastErr{
        color:${RED};
        border-color:rgba(225,29,46,0.18);
        background:rgba(255,241,242,0.90);
      }

      .awCard{
        background:rgba(255,255,255,0.92);
        border:1px solid rgba(17,24,39,0.10);
        border-radius:22px;
        padding:20px;
        box-shadow:0 18px 52px rgba(2,8,23,0.08);
      }

      .awCompactBar{
        margin-bottom:16px;
      }

      .awCompactGrid{
        display:grid;
        grid-template-columns:340px 1fr;
        gap:18px;
        align-items:end;
      }
      @media(max-width:900px){
        .awCompactGrid{ grid-template-columns:1fr; }
      }

      .awStatsRow{
        margin-top:16px;
        display:grid;
        grid-template-columns:repeat(5,1fr);
        gap:10px;
      }
      .awStatsRowSeven{
        grid-template-columns:repeat(7,1fr);
      }
      @media(max-width:1250px){
        .awStatsRowSeven{ grid-template-columns:repeat(4,1fr); }
      }
      @media(max-width:900px){
        .awStatsRowSeven{ grid-template-columns:repeat(2,1fr); }
      }

      .awStatCard{
        border-radius:16px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.82);
        padding:12px;
      }
      .awStatLabel{
        font-size:12px;
        font-weight:900;
        opacity:.72;
      }
      .awStatValue{
        margin-top:6px;
        font-size:22px;
        font-weight:1000;
        color:${RED};
      }

      .awTabWrap{ min-width:0; }

      .awSubTabs{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
      }
      .awSubTab{
        height:42px;
        padding:0 16px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.12);
        background:white;
        font-weight:950;
        cursor:pointer;
      }
      .awSubTabActive{
        border-color:${RED};
        background:rgba(255,241,242,0.88);
        color:${RED};
      }

      .awSectionGrid{
        display:grid;
        grid-template-columns:1.15fr .85fr;
        gap:16px;
      }
      .awSpanAll{ grid-column:1 / -1; }
      @media(max-width:1100px){
        .awSectionGrid{ grid-template-columns:1fr; }
        .awSpanAll{ grid-column:auto; }
      }

      .awLabel{
        font-weight:900;
        font-size:13px;
        margin-bottom:8px;
      }

      .awSelect,.awInput,.awTextarea{
        width:100%;
        padding:12px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:white;
        font-weight:800;
        outline:none;
      }
      .awTextarea{
        min-height:96px;
        resize:vertical;
        font-family:inherit;
      }
      .awSelect:focus,.awInput:focus,.awTextarea:focus{
        border-color:rgba(225,29,46,0.28);
        box-shadow:0 0 0 4px rgba(225,29,46,0.08);
      }

      .awFieldErr{
        border-color:rgba(225,29,46,0.42) !important;
        box-shadow:0 0 0 4px rgba(225,29,46,0.08);
      }
      .awErrorTxt{
        margin-top:6px;
        color:${RED};
        font-size:12px;
        font-weight:900;
      }

      .awRow2{
        display:grid;
        grid-template-columns:1fr 1.15fr;
        gap:12px;
      }
      @media(max-width:760px){
        .awRow2{ grid-template-columns:1fr; }
      }

      .awQuickNav{
        margin-top:12px;
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }

      .awParticipantMeta{
        margin-top:12px;
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:10px;
      }
      @media(max-width:760px){
        .awParticipantMeta{ grid-template-columns:repeat(2,1fr); }
      }

      .awMiniCard{
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.80);
        padding:10px;
      }
      .awMiniLabel{
        font-size:11px;
        font-weight:900;
        opacity:.7;
      }
      .awMiniValue{
        margin-top:4px;
        font-size:13px;
        font-weight:950;
      }
      .awMiniValue.ok{ color:rgba(22,101,52,0.95); }
      .awMiniValue.warn{ color:rgba(180,83,9,0.95); }

      .awClamp2{
        display:-webkit-box;
        -webkit-line-clamp:2;
        -webkit-box-orient:vertical;
        overflow:hidden;
      }

      .awInfoCard{
        margin-top:16px;
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.10);
        background:linear-gradient(135deg, rgba(255,241,242,0.35), rgba(255,255,255,0.95));
        padding:14px;
      }
      .awInfoName{
        font-size:20px;
        font-weight:1000;
        color:#0b1220;
      }
      .awInfoEvent{
        margin-top:6px;
        font-size:13px;
        font-weight:900;
        color:rgba(14,116,144,0.95);
      }
      .awMiniPreviewWrap{ margin-top:16px; }

      .awChips{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      .awChip{
        padding:10px 14px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.12);
        background:white;
        cursor:pointer;
        font-weight:900;
      }
      .awChipActive{
        border-color:${RED};
        background:rgba(255,241,242,0.85);
        color:${RED};
      }

      .awPresetWrap{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }
      .awPreset{
        padding:8px 12px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:white;
        font-weight:900;
        cursor:pointer;
      }
      .awPresetActive{
        border-color:${RED};
        color:${RED};
        background:rgba(255,241,242,0.78);
      }

      .awCheckRow{
        margin-top:14px;
        display:flex;
        align-items:center;
        gap:10px;
        font-weight:900;
      }

      .awWarnBox{
        margin-top:12px;
        padding:12px 14px;
        border-radius:16px;
        border:1px solid rgba(245,158,11,0.25);
        background:rgba(255,251,235,0.88);
        color:rgba(146,64,14,0.98);
        font-weight:900;
      }

      .awPrimaryGroup{
        margin-top:18px;
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
      }
      @media(max-width:900px){
        .awPrimaryGroup{ grid-template-columns:1fr; }
      }
      .awPrimaryBtn{
        height:46px;
        border-radius:16px;
        border:1px solid rgba(225,29,46,0.30);
        background:rgba(255,241,242,0.95);
        color:${RED};
        font-weight:950;
        cursor:pointer;
      }
      .awPrimaryBtn:disabled{
        opacity:.6;
        cursor:not-allowed;
      }
      .awPrimaryBtnSolo{
        width:100%;
        margin-top:16px;
      }

      .awActions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      .awBtn{
        height:40px;
        padding:0 14px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.92);
        font-weight:900;
        cursor:pointer;
      }
      .awBtnDanger{
        border-color:rgba(225,29,46,0.28);
        color:${RED};
        background:rgba(255,241,242,0.88);
      }
      .awBtnPrimarySoft{
        border-color:rgba(14,116,144,0.20);
        color:rgba(14,116,144,1);
        background:rgba(240,249,255,0.95);
      }
      .awBtn:disabled{
        opacity:.6;
        cursor:not-allowed;
      }

      .awCollapseBtn{
        height:42px;
        padding:0 16px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.92);
        font-weight:950;
        cursor:pointer;
      }
      .awCollapsedHint{
        margin-top:14px;
        padding:12px 14px;
        border-radius:16px;
        border:1px dashed rgba(17,24,39,0.16);
        background:rgba(255,255,255,0.65);
        font-weight:900;
        opacity:.75;
      }
      .awFormStack{
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      .awLookupBox{
        margin-top:16px;
        padding:14px;
        border-radius:16px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.78);
      }
      .awLookupRow{
        display:grid;
        grid-template-columns:1fr auto;
        gap:10px;
        align-items:center;
      }

      .awPreviewShell{
        border-radius:22px;
        border:1px solid rgba(17,24,39,0.10);
        background:linear-gradient(135deg, rgba(255,241,242,0.45), rgba(255,255,255,0.9));
        padding:14px;
      }
      .awPreviewTop{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
        flex-wrap:wrap;
        margin-bottom:12px;
      }
      .awPreviewTitle{
        font-weight:950;
        font-size:14px;
        color:#0b1220;
      }
      .awPreviewSub{
        margin-top:4px;
        font-size:12px;
        opacity:.72;
        font-weight:800;
      }
      .awPreviewBadge{
        padding:8px 12px;
        border-radius:999px;
        border:1px solid rgba(225,29,46,0.18);
        background:rgba(255,241,242,0.75);
        color:${RED};
        font-weight:950;
        letter-spacing:.6px;
        font-size:12px;
      }

      .awTplCard{
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.86);
        padding:12px;
      }
      .awTplTop{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
        flex-wrap:wrap;
      }
      .awTplTitle{ font-weight:950; font-size:13px; }
      .awTplSub{ margin-top:4px; font-size:12px; opacity:.72; font-weight:800; }
      .awTplStatus{
        display:flex;
        align-items:center;
        gap:8px;
        padding:8px 10px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        font-weight:950;
        font-size:12px;
        background:rgba(255,255,255,0.80);
      }
      .dotOk{
        width:10px;
        height:10px;
        border-radius:999px;
        background:rgba(34,197,94,0.95);
      }
      .dotWarn{
        width:10px;
        height:10px;
        border-radius:999px;
        background:rgba(245,158,11,0.95);
      }
      .awTplMeta{
        margin-top:10px;
        padding:10px 12px;
        border-radius:14px;
        border:1px dashed rgba(17,24,39,0.16);
        background:rgba(255,255,255,0.75);
        font-weight:850;
        font-size:12px;
        opacity:.85;
      }
      .awTplActions{
        margin-top:10px;
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      .awFileBtn{
        height:40px;
        padding:0 14px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.12);
        background:rgba(255,255,255,0.92);
        font-weight:950;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
      }
      .awTplPreview{
        margin-top:10px;
        border-radius:14px;
        border:1px solid rgba(17,24,39,0.10);
        overflow:hidden;
        background:rgba(255,255,255,0.92);
      }
      .awIframeTpl{
        width:100%;
        height:260px;
        border:0;
        display:block;
        background:white;
      }
      .awTplEmpty{
        padding:12px 14px;
        font-weight:900;
        opacity:.75;
      }

      .certWrap{
        position:relative;
        border-radius:18px;
        background:rgba(255,255,255,0.96);
        border:1px solid rgba(17,24,39,0.10);
        overflow:hidden;
        padding:18px 16px 16px;
        box-shadow:0 18px 50px rgba(2,8,23,0.10);
      }
      .certDots{
        height:18px;
        background-size:24px 18px;
        background-repeat:repeat-x;
        opacity:.9;
      }
      .certDotsTop{
        position:absolute;
        left:0;
        right:0;
        top:0;
        background-image:
          radial-gradient(circle at 10px 9px, rgba(225,29,46,0.95) 0 6px, transparent 7px),
          radial-gradient(circle at 34px 9px, rgba(16,185,129,0.90) 0 6px, transparent 7px),
          radial-gradient(circle at 58px 9px, rgba(59,130,246,0.90) 0 6px, transparent 7px),
          radial-gradient(circle at 82px 9px, rgba(245,158,11,0.95) 0 6px, transparent 7px),
          radial-gradient(circle at 106px 9px, rgba(168,85,247,0.90) 0 6px, transparent 7px);
      }
      .certDotsBottom{
        position:absolute;
        left:0;
        right:0;
        bottom:0;
        background-image:
          radial-gradient(circle at 10px 9px, rgba(225,29,46,0.95) 0 6px, transparent 7px),
          radial-gradient(circle at 34px 9px, rgba(16,185,129,0.90) 0 6px, transparent 7px),
          radial-gradient(circle at 58px 9px, rgba(59,130,246,0.90) 0 6px, transparent 7px),
          radial-gradient(circle at 82px 9px, rgba(245,158,11,0.95) 0 6px, transparent 7px),
          radial-gradient(circle at 106px 9px, rgba(168,85,247,0.90) 0 6px, transparent 7px);
      }
      .certCorner{
        position:absolute;
        font-size:26px;
        opacity:.75;
        filter:saturate(1.15);
      }
      .certTL{ top:20px; left:14px; }
      .certTR{ top:20px; right:14px; }
      .certBL{ bottom:22px; left:14px; }
      .certBR{ bottom:22px; right:14px; }

      .certStars{
        text-align:center;
        font-weight:950;
        letter-spacing:2px;
        color:rgba(245,158,11,0.95);
        margin-top:6px;
        margin-bottom:10px;
      }
      .certTitleBig{
        text-align:center;
        font-weight:1000;
        font-size:38px;
        letter-spacing:1px;
        color:${RED};
        line-height:1;
      }
      .certTitleSub{
        text-align:center;
        font-weight:950;
        font-size:18px;
        letter-spacing:1px;
        color:rgba(14,116,144,0.95);
        margin-top:6px;
      }
      .certPresented{
        text-align:center;
        margin-top:12px;
        font-weight:900;
        opacity:.75;
        font-size:12px;
      }
      .certName{
        text-align:center;
        margin-top:10px;
        font-weight:1000;
        font-size:28px;
        color:rgba(245,158,11,0.95);
      }
      .certNameLine{
        height:1px;
        width:min(520px, 88%);
        margin:8px auto 0;
        background:rgba(17,24,39,0.18);
      }
      .certDesc{
        text-align:center;
        margin-top:10px;
        font-weight:900;
        font-size:12px;
        opacity:.8;
      }
      .certEvent{
        text-align:center;
        margin-top:8px;
        color:rgba(14,116,144,0.95);
        font-weight:950;
        font-size:13px;
      }
      .certNote{
        margin-top:8px;
        text-align:center;
        font-size:12px;
        font-weight:850;
        opacity:.78;
      }
      .certMetaRow{
        margin-top:16px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:16px;
        padding:0 10px 8px;
      }
      .certMetaRowBottom{ margin-top:6px; }
      .certMetaCol{ text-align:center; }
      .certLine{
        height:1px;
        background:rgba(17,24,39,0.18);
        margin-bottom:8px;
      }
      .certMetaLabel{
        font-size:11px;
        font-weight:950;
        opacity:.7;
      }
      .certMetaValue{
        margin-top:4px;
        font-size:12px;
        font-weight:950;
        opacity:.85;
      }
      .certFooter{
        margin-top:10px;
        display:flex;
        justify-content:center;
        gap:8px;
        flex-wrap:wrap;
        padding-bottom:10px;
      }
      .certPill{
        padding:8px 12px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.86);
        font-weight:950;
        font-size:12px;
        opacity:.85;
      }
      .certQrPill{
        min-width:44px;
        text-align:center;
      }

      .awMedalCard{
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.10);
        background:linear-gradient(135deg, rgba(255,251,235,0.95), rgba(255,255,255,0.98));
        padding:16px;
        box-shadow:0 18px 50px rgba(2,8,23,0.08);
      }
      .awMedalCard.large{ min-height:300px; }
      .awMedalTop{
        display:flex;
        align-items:center;
        gap:12px;
      }
      .awMedalIcon{
        font-size:42px;
        line-height:1;
      }
      .awMedalTitle{
        font-size:20px;
        font-weight:1000;
        color:${RED};
      }
      .awMedalEvent{
        margin-top:4px;
        font-size:13px;
        font-weight:900;
        color:rgba(14,116,144,0.95);
      }
      .awMedalName{
        margin-top:18px;
        font-size:28px;
        font-weight:1000;
        color:#0b1220;
      }
      .awMedalMetaRow{
        margin-top:18px;
        display:flex;
        flex-wrap:wrap;
        gap:10px;
      }
      .awMedalPill{
        padding:10px 14px;
        border-radius:999px;
        border:1px solid rgba(17,24,39,0.10);
        background:white;
        font-weight:950;
      }

      .awPdfBox{
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.85);
        overflow:hidden;
      }
      .awPdfHead{
        padding:12px 14px;
        border-bottom:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.92);
      }
      .awPdfHeadTitle{
        font-weight:950;
        font-size:13px;
      }
      .awPdfHeadSub{
        margin-top:4px;
        font-size:12px;
        opacity:.7;
        font-weight:800;
      }
      .awIframe{
        width:100%;
        height:520px;
        border:0;
        display:block;
        background:white;
      }
      .awPdfEmpty{
        padding:16px;
        font-weight:900;
        opacity:.8;
      }

      .awHistoryTop{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
        flex-wrap:wrap;
        margin-bottom:14px;
      }
      .awHistoryActions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        align-items:center;
      }
      .awHistorySearch{
        width:240px;
        max-width:100%;
      }
      .awHistoryType{
        width:160px;
      }
      .awHistoryList{
        display:flex;
        flex-direction:column;
        gap:10px;
      }
      .awHistoryRow{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
        padding:12px;
        border-radius:16px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.70);
      }
      .awHistoryMain{ min-width:0; }
      .awHistoryTopLine{
        display:flex;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
      }
      .awHistoryName{
        font-weight:950;
        font-size:14px;
      }
      .awHistoryBadge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:5px 10px;
        border-radius:999px;
        font-size:11px;
        font-weight:950;
        border:1px solid transparent;
      }
      .awHistoryBadge.cert{
        background:rgba(219,234,254,0.9);
        color:rgba(29,78,216,1);
        border-color:rgba(96,165,250,0.35);
      }
      .awHistoryBadge.medal{
        background:rgba(255,251,235,0.95);
        color:rgba(146,64,14,1);
        border-color:rgba(245,158,11,0.35);
      }
      .awHistoryMeta{
        margin-top:4px;
        font-size:12px;
        opacity:.72;
        font-weight:850;
      }
      .awHistoryTitle{
        margin-top:6px;
        font-weight:900;
        color:${RED};
      }
      .awHistorySide{
        text-align:right;
        min-width:200px;
      }
      .awHistoryDate{
        font-size:12px;
        opacity:.72;
        font-weight:850;
      }
      .awHistorySideBtns{
        margin-top:8px;
        display:flex;
        gap:8px;
        justify-content:flex-end;
        flex-wrap:wrap;
      }
      .awDeleteBtn{
        height:36px;
        padding:0 12px;
        border-radius:12px;
        border:1px solid rgba(225,29,46,0.22);
        background:rgba(255,241,242,0.9);
        color:${RED};
        font-weight:950;
        cursor:pointer;
      }
      .awHistoryEmpty{
        padding:18px;
        border-radius:16px;
        border:1px dashed rgba(17,24,39,0.16);
        text-align:center;
        font-weight:900;
        opacity:.75;
      }

      .awRichEmpty{
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        text-align:center;
      }
      .awRichEmptyIcon{
        font-size:32px;
        line-height:1;
      }
      .awRichEmptyTitle{
        margin-top:10px;
        font-size:16px;
        font-weight:950;
        color:#0b1220;
      }
      .awRichEmptySub{
        margin-top:6px;
        font-size:13px;
        opacity:.75;
        font-weight:850;
      }

      .awCertRegistry{ margin-top:18px; }
      .awRegistryList{
        margin-top:12px;
        display:flex;
        flex-direction:column;
        gap:10px;
      }
      .awRegistryRow{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
        padding:12px;
        border-radius:16px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.72);
      }
      @media(max-width:900px){
        .awRegistryRow{
          flex-direction:column;
          align-items:flex-start;
        }
      }
      .awRegistryMain{ min-width:0; }
      .awRegistryActions{
        display:flex;
        align-items:center;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }
      .awRegistrySerial{
        font-weight:1000;
        color:${RED};
        font-size:16px;
      }
      .awRegistryMeta{
        margin-top:4px;
        font-size:12px;
        opacity:.75;
        font-weight:850;
      }
      .awRegistryPill{
        padding:7px 10px;
        border-radius:999px;
        font-size:11px;
        font-weight:950;
      }
      .awRegistryPill.active{
        background:rgba(236,253,245,1);
        color:rgba(22,101,52,1);
        border:1px solid rgba(34,197,94,0.2);
      }
      .awRegistryPill.revoked{
        background:rgba(255,241,242,1);
        color:${RED};
        border:1px solid rgba(225,29,46,0.18);
      }

      .awInlineFilters{
        display:grid;
        grid-template-columns:1.4fr 1fr;
        gap:12px;
        margin-top:16px;
      }
      @media(max-width:900px){
        .awInlineFilters{ grid-template-columns:1fr; }
      }

      .awGroupShortcuts{
        margin-top:12px;
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .awBulkBar{
        margin-top:12px;
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
        flex-wrap:wrap;
        padding:10px 12px;
        border-radius:16px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.75);
      }
      .awBulkCount{
        font-weight:900;
        opacity:.8;
      }
      .awBulkBtns{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        align-items:center;
      }

      .awProgressCard{
        margin-top:12px;
        padding:12px;
        border-radius:16px;
        border:1px solid rgba(17,24,39,0.08);
        background:rgba(255,255,255,0.82);
      }
      .awProgressTop{
        display:flex;
        justify-content:space-between;
        gap:10px;
        align-items:center;
        flex-wrap:wrap;
      }
      .awProgressLabel{
        font-weight:900;
        font-size:12px;
      }
      .awProgressCount{
        font-weight:950;
        color:${RED};
      }
      .awProgressBar{
        margin-top:10px;
        height:10px;
        border-radius:999px;
        background:rgba(17,24,39,0.08);
        overflow:hidden;
      }
      .awProgressFill{
        height:100%;
        border-radius:999px;
        background:linear-gradient(90deg, rgba(225,29,46,0.92), rgba(14,116,144,0.92));
      }

      .awBulkListInline{
        margin-top:12px;
        border-radius:18px;
        border:1px solid rgba(17,24,39,0.10);
        overflow:hidden;
        background:rgba(255,255,255,0.70);
        max-height:540px;
        overflow:auto;
      }
      .awBulkRow{
        display:flex;
        gap:12px;
        align-items:flex-start;
        padding:12px 14px;
        border-bottom:1px solid rgba(17,24,39,0.06);
        cursor:pointer;
      }
      .awBulkRow:last-child{ border-bottom:none; }
      .awBulkRowOn{
        background:rgba(255,241,242,0.55);
        box-shadow:inset 0 0 0 1px rgba(225,29,46,0.10);
      }
      .awBulkName{ font-weight:950; }
      .awBulkMeta{
        margin-top:3px;
        font-size:12px;
        opacity:.75;
        font-weight:800;
      }
      .awBulkEmpty{
        padding:16px;
        font-weight:900;
        opacity:.75;
        text-align:center;
      }

      .awBulkActionBox{
        margin-top:16px;
        padding:14px;
        border-radius:16px;
        border:1px solid rgba(17,24,39,0.10);
        background:rgba(255,255,255,0.78);
      }
      .awBulkSummaryLine{
        font-weight:900;
        margin-bottom:6px;
      }
      .awBulkSummaryLine:last-child{ margin-bottom:0; }

      .awModalBackdrop,
      .awDrawerBackdrop{
        position:fixed;
        inset:0;
        background:rgba(2,8,23,0.45);
        backdrop-filter:blur(4px);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:2000;
        padding:18px;
      }
      .awModal{
        width:min(520px, 100%);
        background:white;
        border-radius:24px;
        border:1px solid rgba(17,24,39,0.10);
        box-shadow:0 30px 80px rgba(2,8,23,0.25);
        padding:20px;
      }
      .awModalTitle{
        font-size:18px;
        font-weight:1000;
        color:#0b1220;
      }
      .awModalText{
        margin-top:8px;
        font-size:13px;
        font-weight:850;
        opacity:.75;
      }
      .awModalActions{
        margin-top:16px;
        display:flex;
        justify-content:flex-end;
        gap:10px;
        flex-wrap:wrap;
      }

      .awDrawer{
        width:min(760px, 100%);
        max-height:min(88vh, 900px);
        overflow:auto;
        background:white;
        border-radius:24px;
        border:1px solid rgba(17,24,39,0.10);
        box-shadow:0 30px 80px rgba(2,8,23,0.25);
        padding:20px;
      }
      .awDrawerTop{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
        flex-wrap:wrap;
      }
      .awDrawerTitle{
        font-size:18px;
        font-weight:1000;
        color:#0b1220;
      }
      .awDrawerSub{
        margin-top:6px;
        font-size:12px;
        opacity:.74;
        font-weight:850;
      }
      .awDrawerGrid{
        margin-top:16px;
        display:grid;
        grid-template-columns:repeat(2,1fr);
        gap:10px;
      }
      @media(max-width:760px){
        .awDrawerGrid{ grid-template-columns:1fr; }
      }
    `}</style>
  );
}

const wrap = {
  padding: 18,
  fontFamily: "system-ui",
  maxWidth: 1440,
  margin: "0 auto",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
