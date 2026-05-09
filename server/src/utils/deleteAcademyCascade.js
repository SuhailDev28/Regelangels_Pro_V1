import mongoose from "mongoose";

function M(name) {
  return mongoose.models?.[name] || null;
}

function idString(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
}

export async function deleteAcademyCascade(academyId) {
  const session = await mongoose.startSession();

  try {
    const Academy = M("Academy");
    if (!Academy) {
      throw new Error("Academy model not found");
    }

    let removed = null;
    const deleted = {};

    const User = M("User");
    const Branch = M("Branch");
    const Participant = M("Participant");
    const Group = M("Group");
    const Activity = M("Activity");
    const Event = M("Event");
    const EventEnrollment = M("EventEnrollment");
    const Score = M("Score");
    const Award = M("Award");
    const Certificate = M("Certificate");
    const Alert = M("Alert");
    const Attendance = M("Attendance");
    const Payment = M("Payment");
    const Invoice = M("Invoice");
    const Fee = M("Fee");
    const JudgeAssignment = M("JudgeAssignment");
    const AcademyRegistration = M("AcademyRegistration");

    const deleteSet = async (Model, query, key, txSession = null) => {
      if (!Model) return;
      const q = Model.deleteMany(query);
      if (txSession) q.session(txSession);
      const r = await q;
      deleted[key] = r?.deletedCount || 0;
    };

    try {
      await session.withTransaction(async () => {
        removed = await Academy.findById(academyId).session(session);
        if (!removed) return;

        await deleteSet(User, { academyId }, "users", session);
        await deleteSet(Branch, { academyId }, "branches", session);
        await deleteSet(Participant, { academyId }, "participants", session);
        await deleteSet(Group, { academyId }, "groups", session);
        await deleteSet(Activity, { academyId }, "activities", session);
        await deleteSet(Event, { academyId }, "events", session);
        await deleteSet(
          EventEnrollment,
          { academyId },
          "eventEnrollments",
          session,
        );
        await deleteSet(Score, { academyId }, "scores", session);
        await deleteSet(Award, { academyId }, "awards", session);
        await deleteSet(Certificate, { academyId }, "certificates", session);
        await deleteSet(Alert, { academyId }, "alerts", session);
        await deleteSet(Attendance, { academyId }, "attendance", session);
        await deleteSet(Payment, { academyId }, "payments", session);
        await deleteSet(Invoice, { academyId }, "invoices", session);
        await deleteSet(Fee, { academyId }, "fees", session);
        await deleteSet(
          JudgeAssignment,
          { academyId },
          "judgeAssignments",
          session,
        );

        if (AcademyRegistration) {
          const r = await AcademyRegistration.deleteMany({
            $or: [{ academyId }, { academyId: String(academyId) }],
          }).session(session);
          deleted.academyRegistrations = r?.deletedCount || 0;
        }

        await Academy.deleteOne({ _id: academyId }).session(session);
        deleted.academies = 1;
      });

      if (!removed) {
        return {
          ok: false,
          status: 404,
          message: "Academy not found",
        };
      }

      return {
        ok: true,
        mode: "transaction",
        message: "Academy and all related MongoDB records deleted successfully",
        academyId: idString(removed?._id || academyId),
        deleted,
      };
    } catch {
      removed = await Academy.findById(academyId)
        .lean()
        .catch(() => null);

      if (!removed) {
        return {
          ok: false,
          status: 404,
          message: "Academy not found",
        };
      }

      const deleteDirect = async (Model, query, key) => {
        if (!Model) return;
        const r = await Model.deleteMany(query).catch(() => ({
          deletedCount: 0,
        }));
        deleted[key] = r?.deletedCount || 0;
      };

      await deleteDirect(User, { academyId }, "users");
      await deleteDirect(Branch, { academyId }, "branches");
      await deleteDirect(Participant, { academyId }, "participants");
      await deleteDirect(Group, { academyId }, "groups");
      await deleteDirect(Activity, { academyId }, "activities");
      await deleteDirect(Event, { academyId }, "events");
      await deleteDirect(EventEnrollment, { academyId }, "eventEnrollments");
      await deleteDirect(Score, { academyId }, "scores");
      await deleteDirect(Award, { academyId }, "awards");
      await deleteDirect(Certificate, { academyId }, "certificates");
      await deleteDirect(Alert, { academyId }, "alerts");
      await deleteDirect(Attendance, { academyId }, "attendance");
      await deleteDirect(Payment, { academyId }, "payments");
      await deleteDirect(Invoice, { academyId }, "invoices");
      await deleteDirect(Fee, { academyId }, "fees");
      await deleteDirect(JudgeAssignment, { academyId }, "judgeAssignments");

      if (AcademyRegistration) {
        const r = await AcademyRegistration.deleteMany({
          $or: [{ academyId }, { academyId: String(academyId) }],
        }).catch(() => ({ deletedCount: 0 }));
        deleted.academyRegistrations = r?.deletedCount || 0;
      }

      await Academy.deleteOne({ _id: academyId }).catch(() => null);
      deleted.academies = 1;

      return {
        ok: true,
        mode: "no-transaction-fallback",
        warn: "Mongo transactions not enabled (standalone).",
        message: "Academy and all related MongoDB records deleted successfully",
        academyId: idString(removed?._id || academyId),
        deleted,
      };
    }
  } finally {
    await session.endSession();
  }
}
