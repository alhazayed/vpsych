import { getFormatter, getTranslations } from "next-intl/server";
import type {
  ProgressPoint,
  SkillProgress,
  SkillSeries,
} from "@/lib/skill-progress";

/**
 * Session-by-session skill scores as small multiples on one 0–100 axis.
 * Server component, plain SVG; native tooltips per point and a table view.
 * Admin-only surfaces — it reads report scores.
 */

const GRID = [0, 50, 100];

function Line({
  series,
  points,
  width,
  height,
  pad,
  describe,
  axes = false,
}: {
  axes?: boolean;
  series: SkillSeries;
  points: ProgressPoint[];
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
  describe: (p: ProgressPoint, v: number) => string;
}) {
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) =>
    pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / 100) * innerH;

  // Break the line where a session has no score for this skill.
  const segments: string[] = [];
  let current: string[] = [];
  series.values.forEach((v, i) => {
    if (v == null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block h-auto w-full"
      role="img"
      aria-label={series.label}
    >
      {GRID.map((g) => (
        <line
          key={g}
          x1={pad.left}
          x2={width - pad.right}
          y1={y(g)}
          y2={y(g)}
          stroke="var(--outline-variant)"
          strokeWidth={1}
          strokeDasharray={g === 0 ? undefined : "2 3"}
        />
      ))}
      {axes &&
        GRID.map((g) => (
          <text
            key={`l${g}`}
            x={pad.left - 6}
            y={y(g) + 4}
            textAnchor="end"
            fontSize={11}
            fill="var(--on-surface-variant)"
          >
            {g}
          </text>
        ))}
      {segments.map((pts, i) => (
        <polyline
          key={i}
          points={pts}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {series.values.map((v, i) =>
        v == null ? null : (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(v)}
              r={4}
              fill="var(--primary)"
              stroke="var(--surface-container-lowest)"
              strokeWidth={2}
            />
            {/* Larger invisible hit target carrying the tooltip. */}
            <circle cx={x(i)} cy={y(v)} r={10} fill="transparent">
              <title>{describe(points[i]!, v)}</title>
            </circle>
          </g>
        ),
      )}
      {axes &&
        points.map((p, i) => (
          <text
            key={p.sessionId}
            x={x(i)}
            y={height - 6}
            textAnchor="middle"
            fontSize={11}
            fill="var(--on-surface-variant)"
          >
            {p.sessionNumber}
          </text>
        ))}
    </svg>
  );
}

function Change({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  const icon = value > 0 ? "trending_up" : value < 0 ? "trending_down" : "trending_flat";
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs text-[var(--on-surface-variant)]"
      title={label}
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden>
        {icon}
      </span>
      <span className="tabular-nums" dir="ltr">
        {sign}
        {Math.abs(value)}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export async function SkillProgressChart({
  progress,
  title,
}: {
  progress: SkillProgress;
  title?: string;
}) {
  const t = await getTranslations("progress");
  const format = await getFormatter();
  const { points } = progress;
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium" });

  if (points.length === 0) {
    return (
      <section className="clinical-card p-5">
        <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {title ?? t("title")}
        </h2>
        <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
          {progress.excludedFallback > 0
            ? t("emptyFallbackOnly", { n: progress.excludedFallback })
            : t("empty")}
        </p>
      </section>
    );
  }

  const describe = (label: string) => (p: ProgressPoint, v: number) =>
    `${label} · ${t("sessionN", { n: p.sessionNumber })} · ${date(p.startedAt)} · ${v}`;

  return (
    <section className="clinical-card space-y-5 p-5">
      <div>
        <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
          {title ?? t("title")}
        </h2>
        <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
          {t("subtitle", { n: points.length })}
        </p>
        <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
          {t("notValidated")}
        </p>
        {progress.excludedFallback > 0 && (
          <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
            {t("excludedFallback", { n: progress.excludedFallback })}
          </p>
        )}
        {progress.truncated > 0 && (
          <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
            {t("truncated", { n: progress.truncated })}
          </p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{progress.overall.label}</h3>
          <span className="flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-headline)] text-xl font-semibold tabular-nums">
              {progress.overall.latest ?? "—"}
            </span>
            <Change
              value={progress.overall.change}
              label={t("changeSinceFirst")}
            />
          </span>
        </div>
        <Line
          series={progress.overall}
          points={points}
          width={640}
          height={180}
          pad={{ top: 10, right: 12, bottom: 22, left: 30 }}
          axes
          describe={describe(progress.overall.label)}
        />
        <p className="mt-1 text-center text-xs text-[var(--on-surface-variant)]">
          {t("axisSession")}
        </p>
      </div>

      {progress.skills.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {progress.skills.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-[var(--outline-variant)] p-3"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="text-xs font-semibold leading-snug">{s.label}</h3>
                <span className="flex shrink-0 items-baseline gap-1.5">
                  <span className="text-sm font-semibold tabular-nums">
                    {s.latest ?? "—"}
                  </span>
                  <Change value={s.change} label={t("changeSinceFirst")} />
                </span>
              </div>
              <Line
                series={s}
                points={points}
                width={240}
                height={64}
                pad={{ top: 6, right: 6, bottom: 6, left: 6 }}
                describe={describe(s.label)}
              />
            </li>
          ))}
        </ul>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-medium text-[var(--primary)]">
          {t("tableView")}
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                <th className="px-2 py-2 text-start font-semibold">{t("colSkill")}</th>
                {points.map((p) => (
                  <th
                    key={p.sessionId}
                    className="px-2 py-2 text-end font-semibold tabular-nums"
                    title={date(p.startedAt)}
                  >
                    {t("sessionN", { n: p.sessionNumber })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-container)]">
              {[progress.overall, ...progress.skills].map((s) => (
                <tr key={s.id}>
                  <td className="px-2 py-1.5">{s.label}</td>
                  {s.values.map((v, i) => (
                    <td key={i} className="px-2 py-1.5 text-end tabular-nums">
                      {v ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
