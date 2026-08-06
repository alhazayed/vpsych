"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore, useTransition } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "vpsych.ppp.onboarding.dismissed";

const dismissListeners = new Set<() => void>();

function subscribeDismiss(listener: () => void) {
  dismissListeners.add(listener);
  return () => {
    dismissListeners.delete(listener);
  };
}

function getDismissSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerDismissSnapshot(): boolean {
  return false;
}

function markDismissedLocally() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
  dismissListeners.forEach((l) => l());
}

type Props = {
  displayName: string;
  /** Server-side dismiss timestamp when PPP migration is applied. */
  dismissedAt: string | null;
};

/**
 * First-run orientation for invited clinicians.
 * Does not change simulation behaviour — education and expectation-setting only.
 * Dismiss persists to localStorage immediately; server column is best-effort.
 */
export function ReviewerOnboarding({ displayName, dismissedAt }: Props) {
  const t = useTranslations("ppp.onboarding");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const localDismissed = useSyncExternalStore(
    subscribeDismiss,
    getDismissSnapshot,
    getServerDismissSnapshot,
  );

  const visible = !dismissedAt && !localDismissed;

  function dismiss() {
    markDismissedLocally();
    startTransition(async () => {
      try {
        const res = await fetch("/api/ppp/onboarding/dismiss", {
          method: "POST",
        });
        if (res.ok) router.refresh();
      } catch {
        /* soft-fail — localStorage already hides the panel */
      }
    });
  }

  if (!visible) return null;

  return (
    <section
      className="mb-8 overflow-hidden rounded-[14px] border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary-container)_18%,var(--surface))] fade-in-up"
      aria-labelledby="ppp-onboarding-title"
    >
      <div className="border-b border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] px-5 py-4 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
          {t("eyebrow")}
        </p>
        <h2
          id="ppp-onboarding-title"
          className="mt-1 font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)] md:text-2xl"
        >
          {t("title", { name: displayName })}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--on-surface-variant)]">
          {t("body")}
        </p>
      </div>

      <ol className="grid gap-0 md:grid-cols-2 lg:grid-cols-3">
        {(["1", "2", "3", "4", "5", "6"] as const).map((step) => (
          <li
            key={step}
            className="border-t border-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] px-5 py-4 md:border-e md:px-6 md:odd:border-e lg:[&:nth-child(3n)]:border-e-0"
          >
            <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
              {step}
            </div>
            <h3 className="font-[family-name:var(--font-headline)] text-sm font-semibold text-[var(--on-surface)]">
              {t(`steps.${step}.title`)}
            </h3>
            <p className="mt-1 text-sm leading-5 text-[var(--on-surface-variant)]">
              {t(`steps.${step}.body`)}
            </p>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <p className="text-xs text-[var(--on-surface-variant)]">{t("hint")}</p>
        <button
          type="button"
          className="btn-primary h-10 px-5"
          onClick={dismiss}
          disabled={pending}
        >
          {pending ? t("dismissing") : t("dismiss")}
        </button>
      </div>
    </section>
  );
}
