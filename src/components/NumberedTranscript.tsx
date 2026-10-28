import { getTranslations } from "next-intl/server";
import { turnAnchorId, type NumberedTurn } from "@/lib/sessions/transcript-turns";
import { TranscriptTurnOpener } from "@/components/TranscriptTurnOpener";

type Line = NumberedTurn<{ id: string; role: string; content: string }>;

/**
 * A session transcript for admins and supervisors, each line carrying the
 * turn number the report's evidence cites, so "Turn 7" links straight to it.
 * Collapsed by default; following a turn link opens it.
 */
export async function NumberedTranscript({
  turns,
  summary,
  traineeLabel,
  patientLabel,
  emptyLabel,
  scope,
}: {
  turns: Line[];
  summary: string;
  traineeLabel: string;
  patientLabel: string;
  emptyLabel: string;
  /** Keeps anchors unique when a page lists several sessions. */
  scope?: string;
}) {
  const t = await getTranslations("report.quotes");
  return (
    <details className="clinical-card p-4" data-numbered-transcript>
      <summary className="cursor-pointer text-sm font-semibold">{summary}</summary>
      <TranscriptTurnOpener />
      {turns.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--on-surface-variant)]">{emptyLabel}</p>
      ) : (
        <ol className="mt-3 space-y-3 text-sm">
          {turns.map((m) => (
            <li
              key={m.id}
              id={turnAnchorId(m.turn, scope)}
              tabIndex={-1}
              className="scroll-mt-24 rounded-md px-2 py-1 target:bg-[var(--surface-container)] target:outline target:outline-2 target:outline-[var(--primary)]"
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                <span className="tabular-nums">{t("turnShort", { turn: m.turn })}</span>
                {" · "}
                {m.role === "user" ? traineeLabel : patientLabel}
              </span>
              <span className="whitespace-pre-wrap" dir="auto">
                {m.content}
              </span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
