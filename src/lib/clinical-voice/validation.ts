import {
  clamp01,
  clampRate,
  DEFAULT_CLINICAL_VOICE_PARAMS,
  isClinicalBreathing,
  isClinicalEnergy,
  isClinicalProsody,
} from "./defaults";
import type { ClinicalVoiceParams } from "./types";

export type ClinicalVoiceValidation =
  | { ok: true; value: ClinicalVoiceParams }
  | { ok: false; error: string };

/**
 * Validate / sanitize a partial clinical params patch.
 * Unknown keys ignored; out-of-range numbers clamped; bad enums rejected.
 */
export function validateClinicalVoiceParams(
  input: unknown,
  base: ClinicalVoiceParams = DEFAULT_CLINICAL_VOICE_PARAMS,
): ClinicalVoiceValidation {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "clinical params must be an object" };
  }
  const raw = input as Record<string, unknown>;
  const next: ClinicalVoiceParams = { ...base };

  if ("speech_rate" in raw) {
    const n = Number(raw.speech_rate);
    if (!Number.isFinite(n)) {
      return { ok: false, error: "speech_rate must be a number" };
    }
    next.speech_rate = clampRate(n);
  }
  if ("pitch" in raw) {
    const n = Number(raw.pitch);
    if (!Number.isFinite(n)) {
      return { ok: false, error: "pitch must be a number" };
    }
    next.pitch = clampRate(n);
  }
  if ("energy" in raw) {
    if (!isClinicalEnergy(raw.energy)) {
      return {
        ok: false,
        error: "energy must be low|moderate|high|labile",
      };
    }
    next.energy = raw.energy;
  }
  if ("prosody" in raw) {
    if (!isClinicalProsody(raw.prosody)) {
      return {
        ok: false,
        error:
          "prosody must be flat|measured|anxious_edge|pressured|fragmented|labile",
      };
    }
    next.prosody = raw.prosody;
  }
  if ("breathing" in raw) {
    if (!isClinicalBreathing(raw.breathing)) {
      return {
        ok: false,
        error: "breathing must be calm|short|deep|irregular|held",
      };
    }
    next.breathing = raw.breathing;
  }
  if ("hesitation_frequency" in raw) {
    const n = Number(raw.hesitation_frequency);
    if (!Number.isFinite(n)) {
      return { ok: false, error: "hesitation_frequency must be a number" };
    }
    next.hesitation_frequency = clamp01(n);
  }
  if ("speaker_boost" in raw) {
    const n = Number(raw.speaker_boost);
    if (!Number.isFinite(n)) {
      return { ok: false, error: "speaker_boost must be a number" };
    }
    next.speaker_boost = clamp01(n);
  }
  if ("emotion_modulation" in raw) {
    if (typeof raw.emotion_modulation !== "boolean") {
      return { ok: false, error: "emotion_modulation must be boolean" };
    }
    next.emotion_modulation = raw.emotion_modulation;
  }
  if ("pronunciation_ar" in raw) {
    next.pronunciation_ar = sanitizePronunciation(raw.pronunciation_ar);
  }
  if ("pronunciation_en" in raw) {
    next.pronunciation_en = sanitizePronunciation(raw.pronunciation_en);
  }

  return { ok: true, value: next };
}

function sanitizePronunciation(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const trimmed = v.trim().slice(0, 240);
  return trimmed.length ? trimmed : null;
}

/** Extract clinical params from a DB row that may predate the CVP columns. */
export function clinicalParamsFromRow(
  row: Partial<ClinicalVoiceParams> | null | undefined,
): ClinicalVoiceParams {
  const validated = validateClinicalVoiceParams(
    row ?? {},
    DEFAULT_CLINICAL_VOICE_PARAMS,
  );
  return validated.ok ? validated.value : DEFAULT_CLINICAL_VOICE_PARAMS;
}
