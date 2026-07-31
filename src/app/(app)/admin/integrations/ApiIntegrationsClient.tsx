"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AdminInstitutionalNav } from "@/components/AdminInstitutionalNav";
import { SafetyBar } from "@/components/SafetyBar";

const INTEGRATION_KEYS = [
  {
    key: "epic" as const,
    detail: "Production (v2.4)",
    status: "active" as const,
    sync: "2 mins ago",
    icon: "medical_services",
    iconTone: "bg-blue-50 text-[var(--primary)]",
  },
  {
    key: "cerner" as const,
    detail: "Sandbox (v1.0)",
    status: "syncing" as const,
    sync: "Now",
    icon: "local_hospital",
    iconTone: "bg-[var(--surface-container)] text-[var(--on-surface-variant)]",
  },
  {
    key: "webhooks" as const,
    detail: "Internal Events",
    status: "error" as const,
    sync: "Failed (4h ago)",
    icon: "webhook",
    iconTone: "bg-purple-50 text-purple-600",
  },
];

const LOGS = [
  {
    ts: "2023-11-20 14:22:01",
    endpoint: "GET /v2/patient/98213",
    status: "200 OK",
    ok: true,
    latency: "42ms",
  },
  {
    ts: "2023-11-20 14:21:58",
    endpoint: "POST /v2/lab-results",
    status: "201 Created",
    ok: true,
    latency: "156ms",
  },
  {
    ts: "2023-11-20 14:20:44",
    endpoint: "GET /v1/auth/refresh",
    status: "401 Unauth",
    ok: false,
    latency: "12ms",
  },
  {
    ts: "2023-11-20 14:19:12",
    endpoint: "GET /v2/imaging/MRI_SC-12",
    status: "200 OK",
    ok: true,
    latency: "210ms",
  },
];

export function ApiIntegrationsClient() {
  const t = useTranslations("admin.integrations");
  const [dirty, setDirty] = useState(false);
  const [env, setEnv] = useState<"production" | "sandbox">("production");
  const [baseUrl, setBaseUrl] = useState(
    "https://api.vpsych.health/fhir/v2",
  );
  const [version, setVersion] = useState("v2.4");
  const [timeoutMs, setTimeoutMs] = useState(3000);
  const [autoRecovery, setAutoRecovery] = useState(true);
  const [revealSecret, setRevealSecret] = useState(false);

  function markDirty() {
    setDirty(true);
  }

  function discard() {
    setEnv("production");
    setBaseUrl("https://api.vpsych.health/fhir/v2");
    setVersion("v2.4");
    setTimeoutMs(3000);
    setAutoRecovery(true);
    setDirty(false);
  }

  const metrics = [
    { label: t("metrics.latency"), value: "42", unit: "ms" },
    { label: t("metrics.success"), value: "99.98", unit: "%" },
    { label: t("metrics.streams"), value: "12", unit: "" },
    { label: t("metrics.throughput"), value: "1.2", unit: "GB/m" },
  ];

  return (
    <>
      <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-8 md:px-8 lg:flex-row">
        <AdminInstitutionalNav />
        <div className={`min-w-0 flex-1 space-y-8 ${dirty ? "pb-20" : ""}`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
                {t("title")}
              </h1>
              <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                {t("subtitle")}
              </p>
            </div>
            <button type="button" onClick={markDirty} className="btn-primary rounded-xl">
              <span className="material-symbols-outlined text-[20px]">add</span>
              {t("create")}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="clinical-card p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--outline)]">
                  {m.label}
                </p>
                <p className="mt-2 font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--primary)]">
                  {m.value}
                  {m.unit ? (
                    <span className="text-sm font-normal"> {m.unit}</span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <section className="space-y-4 lg:col-span-2">
              <h2 className="flex items-center gap-2 font-[family-name:var(--font-headline)] text-lg font-semibold">
                <span className="material-symbols-outlined">hub</span>
                {t("active")}
              </h2>
              <div className="clinical-card overflow-hidden">
                <table className="w-full text-start text-sm">
                  <thead className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] text-xs font-semibold">
                    <tr>
                      <th className="px-4 py-3">{t("table.provider")}</th>
                      <th className="px-4 py-3">{t("table.status")}</th>
                      <th className="px-4 py-3">{t("table.lastSync")}</th>
                      <th className="px-4 py-3 text-end">{t("table.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--outline-variant)]">
                    {INTEGRATION_KEYS.map((row) => (
                      <tr
                        key={row.key}
                        className="hover:bg-[var(--surface-container-low)]"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded border border-[var(--outline-variant)] ${row.iconTone}`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {row.icon}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold">
                                {t(`providers.${row.key}`)}
                              </p>
                              <p className="text-xs text-[var(--on-surface-variant)]">
                                {row.detail}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              row.status === "active"
                                ? "bg-green-100 text-green-800"
                                : row.status === "syncing"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-[var(--error-container)] text-[var(--error)]"
                            }`}
                          >
                            {t(`status.${row.status}`)}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-4 text-sm ${
                            row.status === "error"
                              ? "text-[var(--error)]"
                              : ""
                          }`}
                        >
                          {row.sync}
                        </td>
                        <td className="px-4 py-4 text-end">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="rounded p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                            >
                              <span className="material-symbols-outlined">
                                {row.status === "error" ? "refresh" : "settings"}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
                            >
                              <span className="material-symbols-outlined">
                                {row.status === "error"
                                  ? "settings"
                                  : "pause_circle"}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h2 className="mb-4 flex items-center gap-2 font-[family-name:var(--font-headline)] text-lg font-semibold">
                  <span className="material-symbols-outlined">history</span>
                  {t("logs")}
                </h2>
                <div className="clinical-card overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-start text-xs">
                      <thead className="sticky top-0 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
                        <tr>
                          {(
                            [
                              "timestamp",
                              "endpoint",
                              "status",
                              "latency",
                            ] as const
                          ).map((h) => (
                            <th
                              key={h}
                              className="px-4 py-2 font-bold uppercase tracking-tighter opacity-70"
                            >
                              {t(`logCols.${h}`)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--outline-variant)]">
                        {LOGS.map((log) => (
                          <tr
                            key={log.ts + log.endpoint}
                            className="hover:bg-[var(--surface-container-low)]"
                          >
                            <td className="px-4 py-2 text-[var(--on-surface-variant)]">
                              {log.ts}
                            </td>
                            <td className="px-4 py-2 font-mono">
                              {log.endpoint}
                            </td>
                            <td
                              className={`px-4 py-2 font-bold ${
                                log.ok
                                  ? "text-green-600"
                                  : "text-[var(--error)]"
                              }`}
                            >
                              {log.status}
                            </td>
                            <td className="px-4 py-2">{log.latency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="clinical-card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-[family-name:var(--font-headline)] text-lg font-semibold">
                  <span className="material-symbols-outlined text-[var(--primary)]">
                    dns
                  </span>
                  {t("profile.title")}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--outline)]">
                      {t("profile.environment")}
                    </label>
                    <div className="flex gap-2">
                      {(["production", "sandbox"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setEnv(option);
                            markDirty();
                          }}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold capitalize transition ${
                            env === option
                              ? "border-2 border-[var(--primary)] bg-[var(--primary-fixed)] text-[var(--primary)]"
                              : "border border-[var(--outline-variant)] hover:bg-[var(--surface-container-high)]"
                          }`}
                        >
                          {t(`profile.${option}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--outline)]">
                      {t("profile.baseUrl")}
                    </label>
                    <input
                      value={baseUrl}
                      onChange={(e) => {
                        setBaseUrl(e.target.value);
                        markDirty();
                      }}
                      className="field-input font-mono text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--outline)]">
                        {t("profile.apiVersion")}
                      </label>
                      <select
                        value={version}
                        onChange={(e) => {
                          setVersion(e.target.value);
                          markDirty();
                        }}
                        className="field-input"
                      >
                        <option value="v2.4">{t("profile.vLatest")}</option>
                        <option value="v2.3">v2.3</option>
                        <option value="v1.0">{t("profile.vLegacy")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--outline)]">
                        {t("profile.timeout")}
                      </label>
                      <input
                        type="number"
                        value={timeoutMs}
                        onChange={(e) => {
                          setTimeoutMs(Number(e.target.value));
                          markDirty();
                        }}
                        className="field-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="clinical-card border-s-4 border-s-[var(--primary)] p-6">
                <h3 className="mb-4 flex items-center gap-2 font-[family-name:var(--font-headline)] text-lg font-semibold">
                  <span className="material-symbols-outlined text-[var(--primary)]">
                    key
                  </span>
                  {t("auth.title")}
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase text-[var(--outline)]">
                        {t("auth.clientId")}
                      </label>
                      <button
                        type="button"
                        className="text-[10px] text-[var(--primary)] hover:underline"
                      >
                        {t("auth.copy")}
                      </button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 font-mono text-sm">
                      <span>vps_admin_09218…</span>
                      <span className="material-symbols-outlined text-sm opacity-50">
                        content_copy
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase text-[var(--outline)]">
                        {t("auth.clientSecret")}
                      </label>
                      <button
                        type="button"
                        onClick={() => setRevealSecret((v) => !v)}
                        className="text-[10px] text-[var(--primary)] hover:underline"
                      >
                        {revealSecret ? t("auth.hide") : t("auth.reveal")}
                      </button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 font-mono text-sm tracking-widest">
                      <span>
                        {revealSecret ? "sk_live_demo_secret" : "••••••••••••••••"}
                      </span>
                      <span className="material-symbols-outlined text-sm opacity-50">
                        {revealSecret ? "visibility" : "visibility_off"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={markDirty}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--surface-container-highest)] py-2 text-sm font-bold hover:bg-[var(--outline-variant)]"
                  >
                    <span className="material-symbols-outlined text-sm">
                      autorenew
                    </span>
                    {t("auth.rotate")}
                  </button>
                  <p className="text-center text-[10px] italic text-[var(--on-surface-variant)]">
                    {t("auth.lastRotated")}
                  </p>
                </div>
              </div>

              <div className="clinical-card flex items-center justify-between p-4">
                <div>
                  <h4 className="text-xs font-semibold">{t("autoRecovery")}</h4>
                  <p className="text-[10px] text-[var(--on-surface-variant)]">
                    {t("autoRecoveryHint")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoRecovery}
                  onClick={() => {
                    setAutoRecovery((v) => !v);
                    markDirty();
                  }}
                  className={`relative h-5 w-10 rounded-full transition ${
                    autoRecovery
                      ? "bg-green-600"
                      : "bg-[var(--outline)]"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-3 w-3 rounded-full bg-white transition ${
                      autoRecovery ? "end-1" : "start-1"
                    }`}
                  />
                </button>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <SafetyBar
        visible={dirty}
        message={t("unsaved")}
        onDiscard={discard}
        onSave={() => setDirty(false)}
      />
    </>
  );
}
