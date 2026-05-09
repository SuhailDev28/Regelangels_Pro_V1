// ✅ FULL CODE — server/src/controllers/public.controller.js
// NOTE: You must point this to your existing totals logic.
// If you already have an admin controller that calculates totals,
// import/reuse that function to avoid duplication.

import Group from "../models/Group.js";

// ✅ Option 1: reuse a service if you have it:
import { buildTotalsForGroup } from "../services/totals.service.js";

// If you DON'T have totals.service.js, then:
// - copy the same calculation used by /admin/totals/group/:groupId
// - and expose it as buildTotalsForGroup(groupId)

export async function publicGroups(req, res, next) {
  try {
    const groups = await Group.find({}, { name: 1, level: 1 }).sort({ name: 1 });
    res.json(groups);
  } catch (e) {
    next(e);
  }
}

export async function publicTotalsByGroup(req, res, next) {
  try {
    const { groupId } = req.params;
    const totals = await buildTotalsForGroup(groupId);
    res.json(totals);
  } catch (e) {
    next(e);
  }
}