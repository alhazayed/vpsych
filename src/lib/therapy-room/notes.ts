/**
 * Private notebook formats — never fed into patient reply generation.
 */

import type { NoteFormat } from "./types";

export const NOTE_FORMAT_LABELS: Record<NoteFormat, string> = {
  soap: "SOAP",
  dap: "DAP",
  birp: "BIRP",
  free: "Free text",
  voice: "Voice note",
};

export const NOTE_FORMAT_TEMPLATES: Record<Exclude<NoteFormat, "voice">, string> = {
  soap: "S:\nO:\nA:\nP:\n",
  dap: "D:\nA:\nP:\n",
  birp: "B:\nI:\nR:\nP:\n",
  free: "",
};

export function templateForFormat(format: NoteFormat): string {
  if (format === "voice") return "";
  return NOTE_FORMAT_TEMPLATES[format];
}

/** Hard invariant: private notes must never be attached to patient prompts. */
export function assertNotesExcludedFromPatientContext(
  patientPromptParts: string[],
  noteBodies: string[],
): boolean {
  const joined = patientPromptParts.join("\n");
  for (const note of noteBodies) {
    const trimmed = note.trim();
    if (trimmed.length >= 12 && joined.includes(trimmed)) {
      return false;
    }
  }
  return true;
}
