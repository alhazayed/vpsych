/**
 * The case's own 5 Ps — what the trainee's formulation is compared with.
 *
 * Read from the course's frozen case snapshot (Case Engine output), so it
 * adds no second clinical brain: every line already exists in the snapshot
 * the patient is played from. Admin-only: it reveals the hidden case.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { FIVE_PS, type FivePKey } from "@/lib/types";

export type CaseFormulationKey = Record<FivePKey, string[]>;

const MAX_ITEMS = 8;
const MAX_ITEM = 220;

function clip(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= MAX_ITEM ? t : `${t.slice(0, MAX_ITEM - 1)}…`;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? clip(v) : null;
}

function list<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function push(out: string[], value: string | null | undefined) {
  if (!value) return;
  if (out.length >= MAX_ITEMS) return;
  if (!out.includes(value)) out.push(value);
}

/** String values of a free-form history object, one line each. */
function historyLines(v: unknown): string[] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    const s = str(value);
    if (s) lines.push(`${key.replace(/_/g, " ")}: ${s}`);
  }
  return lines;
}

/**
 * Build the case's 5 Ps from its snapshot. Each P is a short list of facts;
 * an empty list means the case does not author that P.
 */
export function buildCaseFormulationKey(
  snapshot:
    | (Partial<
        Pick<
          CaseInstanceSnapshot,
          | "clinical_core"
          | "randomized_context"
          | "primary_diagnosis"
          | "comorbidities"
          | "severity"
          | "human_personality"
        >
      >)
    | null
    | undefined,
): CaseFormulationKey {
  const key = Object.fromEntries(FIVE_PS.map((p) => [p, [] as string[]])) as CaseFormulationKey;
  if (!snapshot) return key;
  const core = snapshot.clinical_core ?? ({} as CaseInstanceSnapshot["clinical_core"]);
  const formulation = core.formulation;
  const context = snapshot.randomized_context;

  // Presenting: what brings them now.
  const diagnosis = str(snapshot.primary_diagnosis?.name);
  const severity = str(snapshot.severity ?? core.severity);
  push(key.presenting, diagnosis ? (severity ? `${diagnosis} (${severity})` : diagnosis) : null);
  for (const c of list<{ name?: unknown }>(snapshot.comorbidities)) {
    const name = str(c.name);
    push(key.presenting, name ? `with ${name}` : null);
  }
  for (const s of list<{ description?: unknown }>(core.symptom_profile).slice(0, 5)) {
    push(key.presenting, str(s.description));
  }
  push(key.presenting, str(core.onset_duration));

  // Predisposing: long-standing vulnerability.
  for (const line of historyLines(core.case_file?.psychiatric_history).slice(0, 3)) {
    push(key.predisposing, line);
  }
  for (const b of list<{ statement?: unknown; salience?: unknown }>(
    formulation?.belief_system?.core_beliefs,
  )) {
    const statement = str(b.statement);
    push(key.predisposing, statement ? `Core belief: "${statement}"` : null);
  }
  const personality = snapshot.human_personality;
  if (personality?.attachment_style) {
    push(
      key.predisposing,
      clip(
        `Attachment: ${String(personality.attachment_style).replace(/_/g, " ")}${
          personality.attachment_notes ? ` (${personality.attachment_notes})` : ""
        }`,
      ),
    );
  }
  push(key.predisposing, str(personality?.temperament));

  // Precipitating: what set this episode off.
  push(key.precipitating, str(context?.recent_stressor));
  push(key.precipitating, str(context?.financial_situation));
  push(key.precipitating, str(context?.relationship_detail));
  push(key.precipitating, str(context?.occupation_variant));

  // Perpetuating: what keeps it going.
  for (const s of list<{ if_condition?: unknown; then_pattern?: unknown; coping_bias?: unknown }>(
    formulation?.schemas,
  )) {
    const rule =
      str(s.if_condition) && str(s.then_pattern)
        ? `Rule: "${clip(`${s.if_condition}, ${s.then_pattern}`)}"`
        : null;
    push(key.perpetuating, rule);
    const coping = str(s.coping_bias);
    push(key.perpetuating, coping ? `Coping: ${coping.replace(/_/g, " ")}` : null);
  }
  for (const d of list<{ distortion_kind?: unknown }>(formulation?.distortions)) {
    const kind = str(d.distortion_kind);
    push(key.perpetuating, kind ? `Thinking pattern: ${kind.replace(/_/g, " ")}` : null);
  }
  for (const d of list<{ mechanism?: unknown }>(formulation?.defense_mechanisms)) {
    const m = str(d.mechanism);
    push(key.perpetuating, m ? `Defence: ${m.replace(/_/g, " ")}` : null);
  }
  if (personality?.coping_style) {
    push(
      key.perpetuating,
      `Coping style: ${String(personality.coping_style).replace(/_/g, " ")}`,
    );
  }

  // Protective: what helps.
  for (const f of list<{ label?: unknown }>(core.protective_factors)) {
    push(key.protective, str(f.label));
  }
  for (const v of list<{ label?: unknown }>(formulation?.values)) {
    const label = str(v.label);
    push(key.protective, label ? `Values: ${label}` : null);
  }

  return key;
}

/** True when the case authors nothing at all to compare against. */
export function isEmptyFormulationKey(key: CaseFormulationKey): boolean {
  return FIVE_PS.every((p) => key[p].length === 0);
}
