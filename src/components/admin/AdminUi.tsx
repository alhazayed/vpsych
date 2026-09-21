import type { ReactNode } from "react";
import Link from "next/link";

export function MetricCard({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "default" | "warning" | "success" | "danger";
}) {
  const valueClass =
    tone === "warning"
      ? "text-[var(--secondary)]"
      : tone === "danger"
        ? "text-[var(--error)]"
        : tone === "success"
          ? "text-[var(--primary)]"
          : "text-[var(--on-surface)]";

  const body = (
    <>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
        {label}
      </p>
      <p
        className={`mt-2 font-[family-name:var(--font-headline)] text-3xl font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs text-[var(--on-surface-variant)]">{hint}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="clinical-card block p-4 transition-colors hover:bg-[var(--surface-container-low)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        {body}
      </Link>
    );
  }

  return <div className="clinical-card p-4">{body}</div>;
}

export function EmptyState({
  title,
  description,
  action,
  icon = "inbox",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span
        className="material-symbols-outlined mb-3 text-4xl text-[var(--outline)]"
        aria-hidden
      >
        {icon}
      </span>
      <p className="font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--on-surface)]">
        {title}
      </p>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-[var(--on-surface-variant)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  technical,
  technicalLabel,
  action,
}: {
  title: string;
  description?: string;
  technical?: string;
  technicalLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-[color-mix(in_srgb,var(--error)_35%,var(--outline-variant))] bg-[color-mix(in_srgb,var(--error-container)_40%,transparent)] p-5"
    >
      <p className="font-semibold text-[var(--on-error-container)]">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
          {description}
        </p>
      ) : null}
      {technical ? (
        <details className="mt-3 text-xs text-[var(--on-surface-variant)]">
          <summary className="cursor-pointer font-medium">
            {technicalLabel ?? "Technical details"}
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-[var(--surface-container-lowest)] p-2 font-mono">
            {technical}
          </pre>
        </details>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function AlertPanel({
  items,
  emptyLabel,
  title,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{
    id: string;
    label: string;
    href: string;
    actionLabel: string;
  }>;
}) {
  return (
    <section className="clinical-card p-5">
      <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--outline-variant)] px-3 py-2.5 text-sm transition-colors hover:bg-[var(--surface-container-low)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                <span className="min-w-0 text-start">{item.label}</span>
                <span className="shrink-0 text-xs font-semibold text-[var(--secondary)]">
                  {item.actionLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function QuickActions({
  title,
  actions,
}: {
  title: string;
  actions: Array<{ href: string; label: string; icon: string }>;
}) {
  return (
    <section className="clinical-card p-5">
      <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
        {title}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className="btn-secondary">
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                {a.icon}
              </span>
              {a.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LoadingSkeleton({
  rows = 3,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded-lg bg-[var(--surface-container)]"
        />
      ))}
    </div>
  );
}
