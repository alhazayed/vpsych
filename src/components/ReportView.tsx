import type { SessionReport } from "@/lib/types";

export function ReportView({ report }: { report: SessionReport }) {
  const items = report.scores?.items ?? [];
  const overall = report.scores?.overall ?? 0;

  return (
    <article className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
            Confidential assessment
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
            Session report
          </h1>
        </div>
        <div className="rounded-2xl bg-[var(--accent-soft)] px-5 py-3 text-center">
          <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
            Overall
          </p>
          <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
            {overall}
            <span className="text-base text-[var(--muted)]">/100</span>
          </p>
        </div>
      </div>

      <p className="max-w-3xl text-base leading-relaxed text-[var(--ink)]">
        {report.narrative}
      </p>

      <div className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
          Rubric
        </h2>
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium text-[var(--ink)]">{item.label}</p>
                <p className="font-mono text-sm text-[var(--ink)]">
                  {item.score}/{item.max}
                  <span className="ml-2 text-[var(--muted)]">
                    w{item.weight}
                  </span>
                </p>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.feedback}</p>
            </li>
          ))}
        </ul>
      </div>

      {report.excerpts?.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            Key excerpts
          </h2>
          <ul className="space-y-2">
            {report.excerpts.map((ex, i) => (
              <li
                key={`${i}-${ex.slice(0, 12)}`}
                className="border-l-2 border-[var(--accent)] pl-3 text-sm italic text-[var(--ink)]"
              >
                {ex}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-[var(--muted)]">
        Admin-only. Not shared with the trainee or external parties.
      </p>
    </article>
  );
}
