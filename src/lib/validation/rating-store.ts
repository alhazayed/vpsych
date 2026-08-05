/**
 * In-memory rating store for PAS/LAS until DB-backed study tables ship.
 * Adequate for protocol dry-runs and admin dashboard aggregation.
 */

import type {
  LearnerRatingForm,
  PsychiatristRatingForm,
} from "@/lib/validation/types";

const PAS_STORE: PsychiatristRatingForm[] = [];
const LAS_STORE: LearnerRatingForm[] = [];

export function appendPsychiatristRating(form: PsychiatristRatingForm): void {
  PAS_STORE.push(form);
  if (PAS_STORE.length > 5000) PAS_STORE.splice(0, PAS_STORE.length - 5000);
}

export function appendLearnerRating(form: LearnerRatingForm): void {
  LAS_STORE.push(form);
  if (LAS_STORE.length > 5000) LAS_STORE.splice(0, LAS_STORE.length - 5000);
}

export function listPsychiatristRatings(): PsychiatristRatingForm[] {
  return [...PAS_STORE];
}

export function listLearnerRatings(): LearnerRatingForm[] {
  return [...LAS_STORE];
}

export function clearValidationRatings(): void {
  PAS_STORE.length = 0;
  LAS_STORE.length = 0;
}
