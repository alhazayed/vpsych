/**
 * Natural patient arrival / departure choreography.
 * No instant appearance — beats feel like a real outpatient visit.
 */

import type { ArrivalBeat, DepartureBeat } from "./types";

export const ARRIVAL_BEATS: ArrivalBeat[] = [
  { id: "knock", label: "Knock at the door", delayMs: 900 },
  { id: "open", label: "Door opens", delayMs: 1400 },
  { id: "enter", label: "Patient walks in", delayMs: 2200 },
  { id: "sit", label: "Patient sits", delayMs: 1800 },
  { id: "greet", label: "Patient greets you", delayMs: 1200 },
];

export const DEPARTURE_BEATS: DepartureBeat[] = [
  { id: "stand", label: "Patient stands", delayMs: 1000 },
  { id: "thanks", label: "Patient thanks you", delayMs: 1600 },
  { id: "leave", label: "Patient leaves the room", delayMs: 2000 },
  { id: "door", label: "Door closes", delayMs: 1100 },
];

export function totalArrivalMs(beats: ArrivalBeat[] = ARRIVAL_BEATS): number {
  return beats.reduce((sum, b) => sum + b.delayMs, 0);
}

export function totalDepartureMs(
  beats: DepartureBeat[] = DEPARTURE_BEATS,
): number {
  return beats.reduce((sum, b) => sum + b.delayMs, 0);
}

/** Cumulative start times for sequencing UI. */
export function beatStartTimes(
  beats: Array<{ delayMs: number }>,
): number[] {
  const starts: number[] = [];
  let t = 0;
  for (const b of beats) {
    starts.push(t);
    t += b.delayMs;
  }
  return starts;
}
