"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const STEP_IDS = [
  "transcript",
  "communication",
  "reasoning",
  "report",
  "recommendations",
  "finalize",
] as const;

const TIP_IDS = ["1", "2", "3", "4", "5", "6"] as const;

export function AiAnalysisOverlay() {
  const t = useTranslations("analysis");
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(18);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);

  useEffect(() => {
    const stepTimer = window.setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, STEP_IDS.length - 2));
    }, 2200);
    const progressTimer = window.setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8 + 2, 92));
    }, 900);
    const tipTimer = window.setInterval(() => {
      setTipVisible(false);
      window.setTimeout(() => {
        setTipIndex((i) => (i + 1) % TIP_IDS.length);
        setTipVisible(true);
      }, 400);
    }, 5000);
    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(progressTimer);
      window.clearInterval(tipTimer);
    };
  }, []);

  const radius = 72;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed inset-0 z-[100] flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--background)] px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(800px 500px at 50% 20%, rgba(29,98,150,0.22) 0%, transparent 60%), radial-gradient(700px 500px at 30% 80%, rgba(18,39,60,0.12) 0%, transparent 55%), linear-gradient(180deg, #f8f9fe 0%, #e8eef4 100%)",
        }}
      />

      <main className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-6">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[28px] text-[var(--primary)]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            psychology
          </span>
          <span className="font-[family-name:var(--font-headline)] text-xl font-bold tracking-tight text-[var(--primary)]">
            {t("brandAi")}
          </span>
        </div>

        <div className="w-full rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-white/85 p-8 shadow-[0_12px_40px_rgba(18,39,60,0.08)] backdrop-blur-md fade-in-up sm:p-10">
          <div className="relative mx-auto mb-6 flex h-40 w-40 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90">
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="var(--surface-container-high)"
                strokeWidth="6"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="var(--primary)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={offset}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            </svg>
            <div className="flex h-24 w-24 animate-[micPulse_2s_ease-in-out_infinite] items-center justify-center rounded-full bg-[var(--primary-container)] text-[var(--on-primary-container)]">
              <span
                className="material-symbols-outlined text-[48px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                drive_file_rename
              </span>
            </div>
          </div>

          <div className="mb-8 text-center">
            <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--primary)]">
              {t("title")}
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-base text-[var(--on-surface-variant)]">
              {t("subtitle")}
            </p>
          </div>

          <div className="mb-6 w-full space-y-4 border-t border-[var(--outline-variant)] pt-8">
            {STEP_IDS.map((stepId, index) => {
              const done = index < activeStep;
              const active = index === activeStep;
              const pending = index > activeStep;
              return (
                <div
                  key={stepId}
                  className={`flex items-center gap-4 ${pending ? "opacity-40" : ""}`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      done
                        ? "bg-[var(--primary)] text-white"
                        : active
                          ? "animate-pulse border-2 border-[var(--primary)] text-[var(--primary)]"
                          : "bg-[var(--surface-container-highest)] text-[var(--on-surface-variant)]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {done
                        ? "check"
                        : active
                          ? "generating_tokens"
                          : "hourglass_empty"}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      active
                        ? "text-[var(--primary)]"
                        : "text-[var(--on-surface)]"
                    }`}
                  >
                    {t(`steps.${stepId}`)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-1 rounded-lg bg-[var(--surface-container-low)] px-4 py-2 text-[var(--on-surface-variant)]">
            <span className="material-symbols-outlined text-[16px]">
              schedule
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider">
              {t("estimatedTime")}
            </span>
          </div>
        </div>

        <div className="flex w-full max-w-sm items-center gap-4 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_50%,transparent)] bg-white/85 p-4 shadow-[0_12px_40px_rgba(18,39,60,0.08)] backdrop-blur-md">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#a13f00] text-[#ffcdb8]">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lightbulb
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#7b2e00]">
              {t("clinicalTip")}
            </span>
            <p
              className={`text-sm text-[var(--on-surface-variant)] transition-opacity duration-500 ${
                tipVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              {t(`tips.${TIP_IDS[tipIndex]}`)}
            </p>
          </div>
        </div>

        <p className="text-center text-xs font-semibold text-[var(--on-surface-variant)] opacity-60">
          {t("doNotClose")}
        </p>
      </main>
    </div>
  );
}
