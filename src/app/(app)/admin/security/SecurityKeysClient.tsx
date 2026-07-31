"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AdminInstitutionalNav } from "@/components/AdminInstitutionalNav";
import { SafetyBar } from "@/components/SafetyBar";

const KEYS = [
  {
    name: "production_phi_master",
    id: "key_01H8…",
    type: "RSA-4096",
    status: "active" as const,
    rotated: "Oct 12, 2023",
  },
  {
    name: "internal_audit_aes",
    id: "key_92B2…",
    type: "AES-256",
    status: "expiring" as const,
    rotated: "Jan 05, 2023",
  },
  {
    name: "dev_sandbox_key",
    id: "key_54X1…",
    type: "RSA-2048",
    status: "revoked" as const,
    rotated: "N/A",
  },
];

const EVENT_KEYS = [
  {
    icon: "key",
    tone: "text-[var(--tertiary)]",
    titleKey: "rotated" as const,
    body: "`production_phi_master` was automatically rotated by System Core.",
    when: "Today, 04:12 AM",
  },
  {
    icon: "person",
    tone: "text-[var(--primary)]",
    titleKey: "config" as const,
    body: "MFA was disabled for `internal_support_user_02` by Administrator.",
    when: "Yesterday, 11:45 PM",
  },
  {
    icon: "dangerous",
    tone: "text-[var(--error)]",
    titleKey: "failedLogin" as const,
    body: "Unrecognized IP attempt (45.122.1.2) blocked by Whitelist Policy.",
    when: "Oct 14, 2:10 PM",
  },
];

export function SecurityKeysClient() {
  const t = useTranslations("admin.security");
  const [dirty, setDirty] = useState(false);
  const [mfa, setMfa] = useState(true);
  const [timeoutMins, setTimeoutMins] = useState(30);
  const [rotation, setRotation] = useState("90");
  const [ips, setIps] = useState(["192.168.1.0/24", "10.0.4.15"]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function markDirty() {
    setDirty(true);
  }

  function discard() {
    setMfa(true);
    setTimeoutMins(30);
    setRotation("90");
    setIps(["192.168.1.0/24", "10.0.4.15"]);
    setDirty(false);
  }

  function statusLabel(status: (typeof KEYS)[number]["status"]) {
    if (status === "active") return t("status.active");
    if (status === "expiring") return t("status.expiring");
    return t("status.revoked");
  }

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
            <button
              type="button"
              onClick={markDirty}
              className="btn-primary"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              {t("generate")}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
            <div className="space-y-8 xl:col-span-8">
              <section className="clinical-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-3">
                  <h2 className="text-sm font-semibold text-[var(--on-surface)]">
                    {t("keysTitle")}
                  </h2>
                  <span className="text-[11px] font-semibold text-[var(--on-surface-variant)]">
                    {t("activeCount", {
                      count: KEYS.filter((k) => k.status !== "revoked").length,
                    })}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-sm">
                    <thead>
                      <tr className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
                        {(
                          [
                            "name",
                            "type",
                            "status",
                            "lastRotated",
                            "actions",
                          ] as const
                        ).map((h) => (
                          <th
                            key={h}
                            className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)] ${
                              h === "actions" ? "text-end" : ""
                            }`}
                          >
                            {t(`table.${h}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)]">
                      {KEYS.map((key) => (
                        <tr
                          key={key.id}
                          className="hover:bg-[var(--surface-container-low)]"
                        >
                          <td className="px-4 py-4">
                            <div className="font-semibold text-[var(--on-surface)]">
                              {key.name}
                            </div>
                            <div className="text-xs text-[var(--on-surface-variant)]">
                              ID: {key.id}
                            </div>
                          </td>
                          <td className="px-4 py-4">{key.type}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                key.status === "active"
                                  ? "bg-[color-mix(in_srgb,#16a34a_15%,transparent)] text-[#15803d]"
                                  : key.status === "expiring"
                                    ? "bg-[var(--error-container)] text-[var(--on-error-container)]"
                                    : "bg-[var(--outline-variant)] text-[var(--on-surface-variant)]"
                              }`}
                            >
                              {statusLabel(key.status)}
                            </span>
                          </td>
                          <td className="px-4 py-4">{key.rotated}</td>
                          <td className="space-x-3 px-4 py-4 text-end">
                            {key.status === "revoked" ? (
                              <span className="text-xs text-[var(--on-surface-variant)] opacity-50">
                                {t("status.archived")}
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="text-xs font-semibold text-[var(--primary)] hover:underline"
                                  onClick={markDirty}
                                >
                                  {key.status === "expiring"
                                    ? t("actions.rotate")
                                    : t("actions.download")}
                                </button>
                                <button
                                  type="button"
                                  className="text-xs font-semibold text-[var(--error)] hover:underline"
                                  onClick={markDirty}
                                >
                                  {t("actions.revoke")}
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="flex items-center gap-2 font-[family-name:var(--font-headline)] text-lg font-semibold">
                  <span className="material-symbols-outlined text-[var(--primary)]">
                    verified_user
                  </span>
                  {t("ssl.title")}
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="clinical-card flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,#16a34a_18%,transparent)] text-[#15803d]">
                        <span className="material-symbols-outlined">lock</span>
                      </div>
                      <div>
                        <p className="font-semibold">api.vpsych.health</p>
                        <p className="text-xs text-[var(--on-surface-variant)]">
                          DigiCert Global CA
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-[family-name:var(--font-headline)] text-xl font-bold text-[#15803d]">
                        214 Days
                      </p>
                      <p className="text-[11px] text-[var(--on-surface-variant)]">
                        {t("ssl.untilExpiry")}
                      </p>
                    </div>
                  </div>
                  <div className="clinical-card flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--error-container)] text-[var(--error)]">
                        <span className="material-symbols-outlined">warning</span>
                      </div>
                      <div>
                        <p className="font-semibold">portal.vpsych.health</p>
                        <p className="text-xs text-[var(--on-surface-variant)]">
                          Let&apos;s Encrypt Authority
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--error)]">
                        12 Days
                      </p>
                      <p className="text-[11px] text-[var(--on-surface-variant)]">
                        {t("ssl.actionRequired")}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6 xl:col-span-4">
              <section className="clinical-card p-4">
                <h3 className="mb-4 flex items-center gap-2 border-b border-[var(--outline-variant)] pb-3 text-sm font-semibold">
                  <span className="material-symbols-outlined text-[var(--primary)]">
                    policy
                  </span>
                  {t("policy.title")}
                </h3>
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{t("policy.mfa")}</p>
                      <p className="text-xs text-[var(--on-surface-variant)]">
                        {t("policy.mfaHint")}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={mfa}
                      onClick={() => {
                        setMfa((v) => !v);
                        markDirty();
                      }}
                      className={`relative h-5 w-10 rounded-full transition ${
                        mfa ? "bg-[#16a34a]" : "bg-[var(--surface-container-highest)]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                          mfa ? "start-5" : "start-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">{t("policy.timeout")}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={timeoutMins}
                        onChange={(e) => {
                          setTimeoutMins(Number(e.target.value));
                          markDirty();
                        }}
                        className="field-input w-20"
                      />
                      <span className="text-xs text-[var(--on-surface-variant)]">
                        {t("policy.timeoutHint")}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">{t("policy.ip")}</p>
                    <div className="rounded-lg border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
                      <div className="flex flex-wrap gap-2">
                        {ips.map((ip) => (
                          <span
                            key={ip}
                            className="inline-flex items-center gap-1 rounded bg-[var(--primary-fixed)] px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)]"
                          >
                            {ip}
                            <button
                              type="button"
                              onClick={() => {
                                setIps((list) => list.filter((x) => x !== ip));
                                markDirty();
                              }}
                              className="material-symbols-outlined text-[14px]"
                            >
                              close
                            </button>
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setIps((list) => [...list, "10.0.0.0/8"]);
                            markDirty();
                          }}
                          className="text-[11px] font-bold text-[var(--primary)] hover:underline"
                        >
                          {t("policy.addRange")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="relative overflow-hidden rounded-xl bg-[var(--primary-container)] p-4 text-[var(--on-primary-container)] shadow-lg">
                <span className="material-symbols-outlined absolute -end-4 -top-4 text-[120px] opacity-10">
                  published_with_changes
                </span>
                <h3 className="mb-2 text-sm font-semibold">{t("rotation.title")}</h3>
                <p className="mb-4 text-xs opacity-90">
                  {t("rotation.hint")}
                </p>
                <label className="mb-1 block text-[11px] font-bold uppercase opacity-70">
                  {t("rotation.interval")}
                </label>
                <select
                  value={rotation}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRotation(next);
                    markDirty();
                    if (next === "30") setConfirmOpen(true);
                  }}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="90" className="text-[var(--on-surface)]">
                    {t("rotation.days90")}
                  </option>
                  <option value="60" className="text-[var(--on-surface)]">
                    {t("rotation.days60")}
                  </option>
                  <option value="30" className="text-[var(--on-surface)]">
                    {t("rotation.days30")}
                  </option>
                </select>
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs">
                  <span className="material-symbols-outlined text-white">info</span>
                  {t("rotation.next")} <strong>Nov 24, 2023</strong>
                </div>
              </section>
            </div>
          </div>

          <section className="clinical-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("events.title")}</h3>
              <button
                type="button"
                className="text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                {t("events.export")}
              </button>
            </div>
            <div className="space-y-2">
              {EVENT_KEYS.map((event) => (
                <div
                  key={event.titleKey + event.when}
                  className="flex items-center gap-4 border-b border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] py-3 last:border-0"
                >
                  <span className={`material-symbols-outlined ${event.tone}`}>
                    {event.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold">
                      {t(`events.${event.titleKey}`)}
                    </span>{" "}
                    <span className="text-[var(--on-surface-variant)]">
                      {event.body}
                    </span>
                  </div>
                  <div className="text-end text-[11px] text-[var(--on-surface)]">
                    {event.when}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <SafetyBar
        visible={dirty}
        message={t("unsaved")}
        onDiscard={discard}
        onSave={() => setDirty(false)}
      />

      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-8 shadow-2xl">
            <h2 className="font-[family-name:var(--font-headline)] text-2xl font-bold">
              {t("confirm.title")}
            </h2>
            <p className="text-[var(--on-surface-variant)]">
              {t("confirm.body")}
            </p>
            <div className="flex gap-3 rounded-lg bg-[var(--error-container)] p-4 text-[var(--on-error-container)]">
              <span className="material-symbols-outlined">warning</span>
              <span className="text-sm font-semibold">
                {t("confirm.warning")}
              </span>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setRotation("90");
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]"
              >
                {t("confirm.cancel")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg bg-[var(--error)] px-4 py-2 text-sm font-semibold text-white"
              >
                {t("confirm.proceed")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
