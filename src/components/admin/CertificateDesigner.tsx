"use client";

import { useEffect, useId, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CertificateSheet } from "@/components/admin/CertificateSheet";
import { IssuedCertificatesPanel } from "@/components/admin/IssuedCertificatesPanel";
import {
  CERTIFICATE_LIMITS,
  MAX_SIGNATORIES,
  certificateImageProblem,
  certificateReference,
  defaultCertificateSettings,
  defaultWording,
  formatCertificateDate,
  parseCertificateSettings,
  todayIsoDate,
  type CertificateDefaults,
  type CertificateLocale,
  type CertificateSettings,
  type CertificateSheetLabels,
  type CertificateWording,
} from "@/lib/certificate-template";
import {
  certificateIssuedDay,
  certificateVerifyLink,
  type CertificateWriteError,
  type IssuedCertificate,
  type LoadCertificatesResult,
} from "@/lib/certificate-registry";

const STORAGE_KEY = "vtraining.certificate.settings.v1";

export type CertificateTrainee = {
  id: string;
  name: string;
  patientsCompleted: number;
  levelsCleared: number;
};

type Templates = Record<
  CertificateLocale,
  { defaults: CertificateDefaults; sheet: CertificateSheetLabels }
>;

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function CertificateDesigner({
  templates,
  trainees,
  totals,
  institutions,
  initialLocale,
  registry,
}: {
  templates: Templates;
  trainees: CertificateTrainee[];
  totals: { patients: number; levels: number };
  institutions: string[];
  initialLocale: CertificateLocale;
  /** Recorded certificates; `not_set_up` until the migration is applied. */
  registry: LoadCertificatesResult;
}) {
  const t = useTranslations("admin.certificates");
  const ids = useId();
  const defaults = { en: templates.en.defaults, ar: templates.ar.defaults };

  const [settings, setSettings] = useState<CertificateSettings>(() =>
    defaultCertificateSettings(initialLocale, defaults),
  );
  const [loaded, setLoaded] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [traineeId, setTraineeId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [reference, setReference] = useState("");
  const [printTarget, setPrintTarget] = useState<HTMLElement | null>(null);
  const [certificates, setCertificates] = useState<IssuedCertificate[]>(
    registry.status === "ok" ? registry.certificates : [],
  );
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Browser-only values (storage, today, a random reference) are read after
  // mount so the server render and the first client render agree.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    const today = todayIsoDate();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser-only sources
    setSettings((s) => parseCertificateSettings(stored, s));
    setIssuedOn(today);
    setReference(certificateReference(today));
    setPrintTarget(document.body);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects the storage outcome
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [settings, loaded]);

  const locale = settings.locale;
  const wording = settings.wording[locale];
  const labels = templates[locale].sheet;

  const setWording = (patch: Partial<CertificateWording>) =>
    setSettings((s) => ({
      ...s,
      wording: { ...s.wording, [s.locale]: { ...s.wording[s.locale], ...patch } },
    }));

  const setSignatory = (index: number, patch: Partial<{ name: string; title: string }>) =>
    setWording({
      signatories: wording.signatories.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });

  const addSignatory = () =>
    setSettings((s) => {
      if (s.wording.en.signatories.length >= MAX_SIGNATORIES) return s;
      const add = (w: CertificateWording, title: string): CertificateWording => ({
        ...w,
        signatories: [...w.signatories, { name: "", title }],
      });
      return {
        ...s,
        wording: { en: add(s.wording.en, ""), ar: add(s.wording.ar, "") },
        signatures: [...s.signatures, null],
      };
    });

  const removeSignatory = (index: number) =>
    setSettings((s) => {
      if (s.wording.en.signatories.length <= 1) return s;
      const drop = (w: CertificateWording): CertificateWording => ({
        ...w,
        signatories: w.signatories.filter((_, i) => i !== index),
      });
      return {
        ...s,
        wording: { en: drop(s.wording.en), ar: drop(s.wording.ar) },
        signatures: s.signatures.filter((_, i) => i !== index),
      };
    });

  async function takeImage(
    event: ChangeEvent<HTMLInputElement>,
    apply: (dataUrl: string) => void,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = certificateImageProblem(file);
    if (problem) {
      setImageError(problem === "type" ? t("imageType") : t("imageSize"));
      return;
    }
    try {
      apply(await readImage(file));
      setImageError(null);
    } catch {
      setImageError(t("imageRead"));
    }
  }

  // With records set up, only a recorded certificate is printed, so every
  // printed number can be checked. If they failed to load, printing waits.
  const recordsOn = registry.status === "ok";
  const recordsFailed = registry.status === "failed";
  const activeRecord = (userId: string) =>
    certificates.find((c) => c.userId === userId && !c.revoked) ?? null;
  const record = recordsOn && traineeId ? activeRecord(traineeId) : null;

  const pickTrainee = (id: string) => {
    setTraineeId(id);
    setIssueError(null);
    const found = trainees.find((tr) => tr.id === id);
    const existing = recordsOn && id ? activeRecord(id) : null;
    const name = existing?.recipientName ?? found?.name;
    if (name) setRecipient(name.slice(0, CERTIFICATE_LIMITS.recipient));
  };

  async function issue() {
    if (!traineeId || !recipient.trim()) return;
    setIssuing(true);
    setIssueError(null);
    try {
      const res = await fetch("/api/admin/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: traineeId,
          recipientName: recipient.trim(),
          institutionName: wording.instituteName.trim(),
          locale,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { certificate?: IssuedCertificate; code?: CertificateWriteError }
        | null;
      if (!res.ok || !body?.certificate) {
        setIssueError(t(`issueErrors.${body?.code ?? "failed"}`));
        return;
      }
      const issued = body.certificate;
      setCertificates((list) => [issued, ...list.filter((c) => c.id !== issued.id)]);
      if (issued.recipientName) setRecipient(issued.recipientName);
    } catch {
      setIssueError(t("issueErrors.network"));
    } finally {
      setIssuing(false);
    }
  }

  const selected = trainees.find((tr) => tr.id === traineeId) ?? null;
  const sheetRecipient = record ? (record.recipientName ?? recipient) : recipient;
  // Recorded dates are UTC days, the same day /verify shows.
  const sheetIssuedOn = record ? certificateIssuedDay(record.issuedAt) : issuedOn;
  const sheetReference = recordsOn || recordsFailed ? (record?.number ?? "—") : reference;
  const canPrint = recordsOn
    ? Boolean(record && sheetRecipient.trim())
    : !recordsFailed && Boolean(recipient.trim());
  const printBlocker = recordsFailed
    ? null
    : recordsOn
      ? !traineeId
        ? t("printNeedsTrainee")
        : !record
          ? t("printNeedsRecord")
          : null
      : !recipient.trim()
        ? t("printNeedsName")
        : null;
  const fieldClass =
    "mt-1 w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]";
  const labelClass = "block text-sm font-medium text-[var(--on-surface)]";
  const sectionTitle = "text-base font-semibold text-[var(--on-surface)]";

  const sheet = (
    <CertificateSheet
      locale={locale}
      wording={wording}
      labels={labels}
      recipient={sheetRecipient}
      issuedOn={sheetIssuedOn}
      reference={sheetReference}
      verifyLink={record ? certificateVerifyLink(record.number) : null}
      instituteLogo={settings.instituteLogo}
      signatures={settings.signatures}
    />
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <style>{"@media print { @page { size: A4 landscape; margin: 0; } }"}</style>

        <form className="space-y-5" onSubmit={(e) => e.preventDefault()} aria-label={t("formLabel")}>
          <fieldset className="clinical-card space-y-3 p-4">
            <legend className={`${sectionTitle} px-1`}>{t("languageTitle")}</legend>
            <div className="flex gap-2">
              {(["en", "ar"] as const).map((l) => (
                <label
                  key={l}
                  className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium ${
                    locale === l
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]"
                      : "border-[var(--outline-variant)] text-[var(--on-surface)]"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${ids}-locale`}
                    value={l}
                    checked={locale === l}
                    onChange={() => setSettings((s) => ({ ...s, locale: l }))}
                    className="sr-only"
                  />
                  {l === "en" ? t("languageEn") : t("languageAr")}
                </label>
              ))}
            </div>
            <p className="text-xs text-[var(--on-surface-variant)]">{t("languageHint")}</p>
          </fieldset>

          <fieldset className="clinical-card space-y-3 p-4">
            <legend className={`${sectionTitle} px-1`}>{t("recipientTitle")}</legend>
            <div>
              <label htmlFor={`${ids}-trainee`} className={labelClass}>
                {t("trainee")}
              </label>
              <select
                id={`${ids}-trainee`}
                value={traineeId}
                onChange={(e) => pickTrainee(e.target.value)}
                className={fieldClass}
              >
                <option value="">{t("traineeNone")}</option>
                {trainees.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {t("traineeOption", {
                      name: tr.name,
                      completed: tr.patientsCompleted,
                      patients: totals.patients,
                    })}
                  </option>
                ))}
              </select>
              {selected ? (
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
                  {t("traineeProgress", {
                    completed: selected.patientsCompleted,
                    patients: totals.patients,
                    cleared: selected.levelsCleared,
                    levels: totals.levels,
                  })}
                </p>
              ) : trainees.length === 0 ? (
                <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{t("traineeEmpty")}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor={`${ids}-recipient`} className={labelClass}>
                {t("recipientName")}
              </label>
              <input
                id={`${ids}-recipient`}
                value={sheetRecipient}
                maxLength={CERTIFICATE_LIMITS.recipient}
                onChange={(e) => setRecipient(e.target.value)}
                readOnly={Boolean(record)}
                className={`${fieldClass} read-only:bg-[var(--surface-container)]`}
                dir="auto"
              />
              <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{t("recipientHint")}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor={`${ids}-date`} className={labelClass}>
                  {t("date")}
                </label>
                <input
                  id={`${ids}-date`}
                  type="date"
                  value={sheetIssuedOn}
                  onChange={(e) => setIssuedOn(e.target.value)}
                  readOnly={Boolean(record) || recordsOn}
                  className={`${fieldClass} read-only:bg-[var(--surface-container)]`}
                />
              </div>
              <div>
                <span className={labelClass} id={`${ids}-ref`}>
                  {t("reference")}
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <output aria-labelledby={`${ids}-ref`} dir="ltr" className="whitespace-nowrap text-sm tabular-nums">
                    {sheetReference}
                  </output>
                  {!recordsOn && !recordsFailed ? (
                    <button
                      type="button"
                      className="btn-secondary min-h-9 px-2 text-xs"
                      onClick={() => setReference(certificateReference(issuedOn))}
                    >
                      {t("referenceNew")}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            {record ? (
              <div className="space-y-1 rounded-lg border border-[var(--outline-variant)] p-3 text-xs text-[var(--on-surface-variant)]">
                <p className="font-medium text-[var(--on-surface)]">
                  {t("recorded", {
                    number: record.number,
                    date: formatCertificateDate(sheetIssuedOn, locale),
                  })}
                </p>
                <p>{record.source === "training_ladder" ? t("recordedAuto") : t("recordedAdmin")}</p>
                <p>{t("recordedLocked")}</p>
              </div>
            ) : recordsOn && traineeId ? (
              <div className="space-y-2">
                <button
                  type="button"
                  className="btn-primary inline-flex min-h-10 items-center px-4 text-sm"
                  onClick={issue}
                  disabled={issuing || !recipient.trim()}
                >
                  {issuing ? t("issuing") : t("issue")}
                </button>
                <p className="text-xs text-[var(--on-surface-variant)]">{t("issueHint")}</p>
                {issueError ? (
                  <p role="alert" className="text-xs text-[var(--error)]">
                    {issueError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </fieldset>

          <fieldset className="clinical-card space-y-3 p-4">
            <legend className={`${sectionTitle} px-1`}>
              {t("wordingTitle", { language: locale === "en" ? t("languageEn") : t("languageAr") })}
            </legend>
            <div>
              <label htmlFor={`${ids}-heading`} className={labelClass}>
                {t("heading")}
              </label>
              <input
                id={`${ids}-heading`}
                value={wording.heading}
                maxLength={CERTIFICATE_LIMITS.heading}
                onChange={(e) => setWording({ heading: e.target.value })}
                className={fieldClass}
                dir={locale === "ar" ? "rtl" : "ltr"}
              />
            </div>
            <div>
              <label htmlFor={`${ids}-intro`} className={labelClass}>
                {t("intro")}
              </label>
              <input
                id={`${ids}-intro`}
                value={wording.intro}
                maxLength={CERTIFICATE_LIMITS.intro}
                onChange={(e) => setWording({ intro: e.target.value })}
                className={fieldClass}
                dir={locale === "ar" ? "rtl" : "ltr"}
              />
            </div>
            <div>
              <label htmlFor={`${ids}-achievement`} className={labelClass}>
                {t("achievement")}
              </label>
              <textarea
                id={`${ids}-achievement`}
                value={wording.achievement}
                maxLength={CERTIFICATE_LIMITS.achievement}
                rows={3}
                onChange={(e) => setWording({ achievement: e.target.value })}
                className={fieldClass}
                dir={locale === "ar" ? "rtl" : "ltr"}
              />
            </div>
            <button
              type="button"
              className="btn-secondary min-h-9 px-3 text-xs"
              onClick={() => {
                const d = defaultWording(defaults[locale]);
                setWording({ heading: d.heading, intro: d.intro, achievement: d.achievement });
              }}
            >
              {t("wordingReset")}
            </button>
          </fieldset>

          <fieldset className="clinical-card space-y-3 p-4">
            <legend className={`${sectionTitle} px-1`}>{t("instituteTitle")}</legend>
            <div>
              <label htmlFor={`${ids}-institute`} className={labelClass}>
                {t("instituteName")}
              </label>
              <input
                id={`${ids}-institute`}
                value={wording.instituteName}
                maxLength={CERTIFICATE_LIMITS.instituteName}
                onChange={(e) => setWording({ instituteName: e.target.value })}
                list={institutions.length > 0 ? `${ids}-institutes` : undefined}
                className={fieldClass}
                dir={locale === "ar" ? "rtl" : "ltr"}
              />
              {institutions.length > 0 ? (
                <datalist id={`${ids}-institutes`}>
                  {institutions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              ) : null}
              <p className="mt-1 text-xs text-[var(--on-surface-variant)]">{t("instituteHint")}</p>
            </div>
            <ImageField
              id={`${ids}-institute-logo`}
              label={t("instituteLogo")}
              value={settings.instituteLogo}
              chooseLabel={t("imageChoose")}
              removeLabel={t("imageRemove")}
              onChange={(e) => takeImage(e, (url) => setSettings((s) => ({ ...s, instituteLogo: url })))}
              onRemove={() => setSettings((s) => ({ ...s, instituteLogo: null }))}
            />
          </fieldset>

          <fieldset className="clinical-card space-y-4 p-4">
            <legend className={`${sectionTitle} px-1`}>{t("signatoriesTitle")}</legend>
            {wording.signatories.map((s, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-[var(--outline-variant)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{t("signatoryN", { n: i + 1 })}</p>
                  {wording.signatories.length > 1 ? (
                    <button
                      type="button"
                      className="min-h-9 rounded-lg px-2 text-xs font-medium text-[var(--error)] hover:underline"
                      onClick={() => removeSignatory(i)}
                    >
                      {t("signatoryRemove", { n: i + 1 })}
                    </button>
                  ) : null}
                </div>
                <div>
                  <label htmlFor={`${ids}-sig-name-${i}`} className={labelClass}>
                    {t("signatoryName")}
                  </label>
                  <input
                    id={`${ids}-sig-name-${i}`}
                    value={s.name}
                    maxLength={CERTIFICATE_LIMITS.signatoryName}
                    onChange={(e) => setSignatory(i, { name: e.target.value })}
                    className={fieldClass}
                    dir="auto"
                  />
                </div>
                <div>
                  <label htmlFor={`${ids}-sig-title-${i}`} className={labelClass}>
                    {t("signatoryTitle")}
                  </label>
                  <input
                    id={`${ids}-sig-title-${i}`}
                    value={s.title}
                    maxLength={CERTIFICATE_LIMITS.signatoryTitle}
                    onChange={(e) => setSignatory(i, { title: e.target.value })}
                    className={fieldClass}
                    dir={locale === "ar" ? "rtl" : "ltr"}
                  />
                </div>
                <ImageField
                  id={`${ids}-sig-img-${i}`}
                  label={t("signatoryImage")}
                  value={settings.signatures[i] ?? null}
                  chooseLabel={t("imageChoose")}
                  removeLabel={t("imageRemove")}
                  onChange={(e) =>
                    takeImage(e, (url) =>
                      setSettings((st) => ({
                        ...st,
                        signatures: st.signatures.map((v, j) => (j === i ? url : v)),
                      })),
                    )
                  }
                  onRemove={() =>
                    setSettings((st) => ({
                      ...st,
                      signatures: st.signatures.map((v, j) => (j === i ? null : v)),
                    }))
                  }
                />
              </div>
            ))}
            {wording.signatories.length < MAX_SIGNATORIES ? (
              <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={addSignatory}>
                {t("signatoryAdd")}
              </button>
            ) : null}
            <p className="text-xs text-[var(--on-surface-variant)]">{t("signatoriesHint")}</p>
          </fieldset>

          {imageError ? (
            <p role="alert" className="clinical-card p-3 text-sm text-[var(--error)]">
              {imageError}
            </p>
          ) : null}
          {saveFailed ? (
            <p role="alert" className="clinical-card p-3 text-sm text-[var(--error)]">
              {t("saveFailed")}
            </p>
          ) : null}
        </form>

        <section aria-labelledby={`${ids}-preview`} className="space-y-3 xl:sticky xl:top-6 xl:self-start">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${ids}-preview`} className={sectionTitle}>
              {t("previewTitle")}
            </h2>
            <button
              type="button"
              className="btn-primary inline-flex min-h-11 items-center gap-2 px-4"
              onClick={() => window.print()}
              disabled={!canPrint}
            >
              <span aria-hidden className="material-symbols-outlined text-[20px]">
                print
              </span>
              {t("print")}
            </button>
          </div>
          {printBlocker ? (
            <p className="text-xs text-[var(--on-surface-variant)]">{printBlocker}</p>
          ) : null}
          {recordsFailed ? (
            <p role="alert" className="text-xs text-[var(--error)]">
              {t("registryFailed")}
            </p>
          ) : null}
          <div className="overflow-hidden rounded-lg border border-[var(--outline-variant)] shadow-sm">
            {sheet}
          </div>
          <p className="text-xs text-[var(--on-surface-variant)]">{t("printHint")}</p>
          {registry.status === "not_set_up" ? (
            <p className="text-xs text-[var(--on-surface-variant)]">{t("notStored")}</p>
          ) : null}
        </section>

        {printTarget && canPrint
          ? createPortal(<div className="certificate-print-root">{sheet}</div>, printTarget)
          : null}
      </div>
      {recordsOn ? (
        <IssuedCertificatesPanel
          certificates={certificates}
          showableUserIds={new Set(trainees.map((tr) => tr.id))}
          onShow={(userId) => {
            pickTrainee(userId);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onRevoked={(revoked) =>
            setCertificates((list) => list.map((c) => (c.id === revoked.id ? revoked : c)))
          }
        />
      ) : null}
    </div>
  );
}

function ImageField({
  id,
  label,
  value,
  chooseLabel,
  removeLabel,
  onChange,
  onRemove,
}: {
  id: string;
  label: string;
  value: string | null;
  chooseLabel: string;
  removeLabel: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <span className="block text-sm font-medium text-[var(--on-surface)]" id={`${id}-label`}>
        {label}
      </span>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL preview
          <img src={value} alt="" className="h-10 max-w-[120px] rounded border border-[var(--outline-variant)] bg-white object-contain" />
        ) : null}
        <label
          htmlFor={id}
          className="btn-secondary inline-flex min-h-9 cursor-pointer items-center px-3 text-xs focus-within:outline focus-within:outline-2 focus-within:outline-[var(--primary)]"
        >
          {chooseLabel}
          <input
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-labelledby={`${id}-label`}
            className="sr-only"
            onChange={onChange}
          />
        </label>
        {value ? (
          <button
            type="button"
            className="min-h-9 rounded-lg px-2 text-xs font-medium text-[var(--error)] hover:underline"
            onClick={onRemove}
          >
            {removeLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
