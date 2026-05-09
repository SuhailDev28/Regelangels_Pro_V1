import React, { useEffect, useMemo, useState } from "react";
import { getUser } from "../../lib/auth.js";
import {
  getJudgeDraftByKeys,
  saveJudgeDraft,
} from "../../lib/judgeDraftStore.js";
import {
  installJudgeSyncListeners,
  syncJudgeDraftQueue,
} from "../../lib/judgeSyncService.js";
import { calculateJudgeTotal, validateJudgeScore } from "./JudgeMobileUtils.js";

const shellStyle = {
  minHeight: "100vh",
  background: "#f3f4f6",
  padding: 14,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 8px 30px rgba(0,0,0,.06)",
  marginBottom: 14,
};

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  fontSize: 18,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  outline: "none",
};

const errorStyle = {
  marginTop: 6,
  color: "#dc2626",
  fontSize: 13,
  fontWeight: 600,
};

export default function JudgeMobileScoring({
  participant,
  eventId,
  activityId,
  academyId,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}) {
  const user = useMemo(() => getUser?.() || {}, []);
  const judgeId = user?._id || user?.id || "";
  const participantId = participant?._id || participant?.id || "";

  const [scores, setScores] = useState({
    execution: "",
    difficulty: "",
    artistry: "",
    deductions: "",
  });
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    return installJudgeSyncListeners();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function restoreDraft() {
      if (!judgeId || !eventId || !activityId || !participantId) {
        if (mounted) setRestoring(false);
        return;
      }

      setRestoring(true);

      try {
        const draft = await getJudgeDraftByKeys({
          judgeId,
          eventId,
          activityId,
          participantId,
        });

        if (!mounted) return;

        if (draft) {
          setScores({
            execution: draft?.scores?.execution ?? "",
            difficulty: draft?.scores?.difficulty ?? "",
            artistry: draft?.scores?.artistry ?? "",
            deductions: draft?.scores?.deductions ?? "",
          });
          setNotes(draft?.notes || "");
          setStatus(
            draft?.submitted
              ? "Previous finalized draft restored"
              : "Previous draft restored",
          );
        } else {
          setScores({
            execution: "",
            difficulty: "",
            artistry: "",
            deductions: "",
          });
          setNotes("");
          setStatus("Ready");
        }
      } catch {
        if (mounted) setStatus("Draft restore failed");
      } finally {
        if (mounted) setRestoring(false);
      }
    }

    restoreDraft();

    return () => {
      mounted = false;
    };
  }, [judgeId, eventId, activityId, participantId]);

  const total = useMemo(() => calculateJudgeTotal(scores), [scores]);

  const updateField = (key, value) => {
    setScores((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const buildPayload = (submitted = false) => ({
    judgeId,
    eventId,
    activityId,
    academyId,
    participantId,
    participantName: participant?.name || participant?.fullName || "",
    scores: {
      execution: Number(scores.execution || 0),
      difficulty: Number(scores.difficulty || 0),
      artistry: Number(scores.artistry || 0),
      deductions: Number(scores.deductions || 0),
      total,
    },
    notes,
    submitted,
  });

  const saveDraft = async () => {
    if (!judgeId || !eventId || !activityId || !participantId) {
      setStatus("Missing judge or participant context");
      return;
    }

    setBusy(true);

    try {
      await saveJudgeDraft(buildPayload(false));
      setStatus(navigator.onLine ? "Draft saved" : "Draft saved offline");
    } catch {
      setStatus("Save failed");
    } finally {
      setBusy(false);
    }
  };

  const finalizeScore = async () => {
    if (!judgeId || !eventId || !activityId || !participantId) {
      setStatus("Missing judge or participant context");
      return;
    }

    const validation = validateJudgeScore(scores);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      setStatus("Fix validation errors before finalizing");
      return;
    }

    setBusy(true);

    try {
      await saveJudgeDraft(buildPayload(true));
      const result = await syncJudgeDraftQueue();

      if (result?.ok) {
        if (Array.isArray(result.failed) && result.failed.length) {
          setStatus("Partially synced. Some drafts still pending.");
        } else {
          setStatus("Finalized and synced");
        }
      } else {
        setStatus("Saved offline, pending sync");
      }
    } catch {
      setStatus("Finalize failed");
    } finally {
      setBusy(false);
    }
  };

  if (!participantId) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            No participant selected
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
          Participant
        </div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          {participant?.name || participant?.fullName || "Participant"}
        </div>
        <div style={{ marginTop: 8, color: "#6b7280", fontSize: 14 }}>
          Event: {eventId} · Activity: {activityId}
        </div>
        <div style={{ marginTop: 8, color: "#6b7280", fontSize: 14 }}>
          {restoring
            ? "Restoring draft..."
            : `${navigator.onLine ? "Online" : "Offline"} · ${status}`}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 800, marginBottom: 14 }}>Score Entry</div>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <input
              style={inputStyle}
              inputMode="decimal"
              placeholder="Execution"
              value={scores.execution}
              onChange={(e) => updateField("execution", e.target.value)}
            />
            {fieldErrors.execution ? (
              <div style={errorStyle}>{fieldErrors.execution}</div>
            ) : null}
          </div>

          <div>
            <input
              style={inputStyle}
              inputMode="decimal"
              placeholder="Difficulty"
              value={scores.difficulty}
              onChange={(e) => updateField("difficulty", e.target.value)}
            />
            {fieldErrors.difficulty ? (
              <div style={errorStyle}>{fieldErrors.difficulty}</div>
            ) : null}
          </div>

          <div>
            <input
              style={inputStyle}
              inputMode="decimal"
              placeholder="Artistry"
              value={scores.artistry}
              onChange={(e) => updateField("artistry", e.target.value)}
            />
            {fieldErrors.artistry ? (
              <div style={errorStyle}>{fieldErrors.artistry}</div>
            ) : null}
          </div>

          <div>
            <input
              style={inputStyle}
              inputMode="decimal"
              placeholder="Deductions"
              value={scores.deductions}
              onChange={(e) => updateField("deductions", e.target.value)}
            />
            {fieldErrors.deductions ? (
              <div style={errorStyle}>{fieldErrors.deductions}</div>
            ) : null}
          </div>

          <textarea
            style={{ ...inputStyle, minHeight: 96, resize: "vertical" }}
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
          Calculated Total
        </div>
        <div style={{ fontSize: 34, fontWeight: 900, color: "#e11d2e" }}>
          {Number(total).toFixed(2)}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "grid", gap: 10 }}>
          <button
            onClick={saveDraft}
            disabled={busy || restoring}
            style={{
              border: 0,
              borderRadius: 14,
              padding: "16px 18px",
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {busy ? "Working..." : "Save Draft"}
          </button>

          <button
            onClick={finalizeScore}
            disabled={busy || restoring}
            style={{
              border: 0,
              borderRadius: 14,
              padding: "16px 18px",
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
              background: "#e11d2e",
              color: "#fff",
            }}
          >
            {busy ? "Submitting..." : "Finalize Score"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 14,
          }}
        >
          <button
            onClick={onPrev}
            disabled={!hasPrev || busy}
            style={{
              border: "1px solid #d1d5db",
              background: "#fff",
              borderRadius: 14,
              padding: "14px 16px",
              fontWeight: 800,
              cursor: hasPrev ? "pointer" : "not-allowed",
              opacity: hasPrev ? 1 : 0.55,
            }}
          >
            Previous
          </button>

          <button
            onClick={onNext}
            disabled={!hasNext || busy}
            style={{
              border: 0,
              background: "#111827",
              color: "#fff",
              borderRadius: 14,
              padding: "14px 16px",
              fontWeight: 800,
              cursor: hasNext ? "pointer" : "not-allowed",
              opacity: hasNext ? 1 : 0.55,
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
