/**
 * Longitudinal HCE memory (Phase D — Layer 13).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HceMemoryState, LongitudinalSummary } from "@/lib/hce/types";
import { defaultHceState } from "@/lib/hce/state";

export async function hydrateLongitudinalMemory(
  writer: SupabaseClient,
  longitudinalGroupId: string | null | undefined,
  currentState: HceMemoryState,
): Promise<HceMemoryState> {
  if (!longitudinalGroupId) return currentState;

  const { data: rows } = await writer
    .from("case_memory")
    .select("memory, updated_at")
    .eq("longitudinal_group_id", longitudinalGroupId)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (!rows?.length) return currentState;

  const summaries: string[] = [];
  const themes: string[] = [];
  let lastTone: LongitudinalSummary["last_session_tone"] = "neutral";
  let endedWell = true;

  for (const row of rows) {
    const hce = (row.memory as { hce?: HceMemoryState })?.hce;
    if (!hce) continue;
    if (hce.longitudinal?.emotional_carryover) {
      summaries.push(hce.longitudinal.emotional_carryover);
    }
    if (hce.longitudinal?.recurring_themes) {
      themes.push(...hce.longitudinal.recurring_themes);
    }
    lastTone = hce.relationship?.last_tone ?? lastTone;
    endedWell = hce.longitudinal?.last_session_ended_well ?? endedWell;
  }

  const longitudinal: LongitudinalSummary = {
    session_count: rows.length,
    last_session_tone: lastTone,
    last_session_ended_well: endedWell,
    recurring_themes: [...new Set(themes)].slice(0, 8),
    emotional_carryover:
      summaries[0] ??
      (endedWell
        ? "Prior session ended with reasonable rapport."
        : "Prior session may have ended with strain."),
    last_updated_at: new Date().toISOString(),
  };

  return {
    ...currentState,
    longitudinal,
    relationship: {
      ...currentState.relationship,
      last_tone: lastTone,
      alliance: endedWell
        ? Math.min(95, currentState.relationship.alliance + 5)
        : Math.max(15, currentState.relationship.alliance - 8),
    },
  };
}

export function buildLongitudinalCarryover(
  state: HceMemoryState,
  sessionEndedWell: boolean,
): LongitudinalSummary {
  const emotional = state.emotional_episodic
    .slice(-3)
    .map((e) => `${e.feeling} (${e.trigger})`)
    .join("; ");

  const themes = [
    ...new Set(
      state.episodic
        .slice(-6)
        .flatMap((e) => e.topics),
    ),
  ].slice(0, 6);

  return {
    session_count: (state.longitudinal?.session_count ?? 0) + 1,
    last_session_tone: state.relationship.last_tone,
    last_session_ended_well: sessionEndedWell,
    recurring_themes: themes,
    emotional_carryover:
      emotional ||
      `Alliance ${state.relationship.alliance}; trust ${state.internal.trust}.`,
    last_updated_at: new Date().toISOString(),
  };
}

export function mergeLongitudinalIntoState(
  state: HceMemoryState,
  summary: LongitudinalSummary,
): HceMemoryState {
  return { ...state, longitudinal: summary };
}

export function defaultLongitudinalFromState(state: HceMemoryState): HceMemoryState {
  if (state.longitudinal) return state;
  return {
    ...state,
    longitudinal: {
      session_count: 0,
      last_session_tone: "neutral",
      last_session_ended_well: true,
      recurring_themes: [],
      emotional_carryover: "",
      last_updated_at: new Date().toISOString(),
    },
  };
}
