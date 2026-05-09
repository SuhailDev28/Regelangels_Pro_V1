export function normalizeScoreNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return String(num);
}

export function calculateJudgeTotal(scores = {}) {
  const execution = Number(scores.execution || 0);
  const difficulty = Number(scores.difficulty || 0);
  const artistry = Number(scores.artistry || 0);
  const deductions = Number(scores.deductions || 0);

  const total = execution + difficulty + artistry - deductions;
  return Number.isFinite(total) ? Number(total.toFixed(2)) : 0;
}

export function validateJudgeScore(scores = {}) {
  const execution = Number(scores.execution);
  const difficulty = Number(scores.difficulty);
  const artistry = Number(scores.artistry);
  const deductions = Number(scores.deductions || 0);

  const errors = {};

  if (!Number.isFinite(execution)) errors.execution = "Execution is required";
  if (!Number.isFinite(difficulty))
    errors.difficulty = "Difficulty is required";
  if (!Number.isFinite(artistry)) errors.artistry = "Artistry is required";
  if (!Number.isFinite(deductions))
    errors.deductions = "Deductions must be a valid number";

  if (Number.isFinite(execution) && (execution < 0 || execution > 10)) {
    errors.execution = "Execution must be between 0 and 10";
  }

  if (Number.isFinite(difficulty) && (difficulty < 0 || difficulty > 10)) {
    errors.difficulty = "Difficulty must be between 0 and 10";
  }

  if (Number.isFinite(artistry) && (artistry < 0 || artistry > 10)) {
    errors.artistry = "Artistry must be between 0 and 10";
  }

  if (Number.isFinite(deductions) && deductions < 0) {
    errors.deductions = "Deductions cannot be negative";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
