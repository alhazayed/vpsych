"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { CvpDashboard } from "@/lib/cvp";

type Study = {
  id: string;
  slug: string;
  title: string;
  status: string;
  irb_reference: string | null;
};

export function ClinicalValidationDashboard() {
  const t = useTranslations("cvp.admin");
  const [studies, setStudies] = useState<Study[]>([]);
  const [studyId, setStudyId] = useState<string>("");
  const [dash, setDash] = useState<CvpDashboard | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/cvp/studies");
      const body = (await res.json()) as {
        studies?: Study[];
        warning?: string;
        error?: string;
      };
      if (!res.ok) {
        if (!cancelled) setError(body.error ?? t("loadError"));
        return;
      }
      if (!cancelled) {
        setStudies(body.studies ?? []);
        setWarning(body.warning ?? null);
        if (body.studies?.[0]?.id) setStudyId(body.studies[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!studyId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/cvp/studies/${studyId}/dashboard`);
      const body = (await res.json()) as {
        dashboard?: CvpDashboard;
        warning?: string;
        error?: string;
      };
      if (!res.ok) {
        if (!cancelled) setError(body.error ?? t("loadError"));
        return;
      }
      if (!cancelled) {
        setDash(body.dashboard ?? null);
        if (body.warning) setWarning(body.warning);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studyId, t]);

  function runExport() {
    if (!studyId) return;
    setExportMsg(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/cvp/studies/${studyId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "publication_package",
          deidentifyLevel: "standard",
        }),
      });
      const body = (await res.json()) as { error?: string; exportId?: string };
      if (!res.ok) {
        setExportMsg(body.error ?? t("exportError"));
        return;
      }
      setExportMsg(t("exportOk", { id: body.exportId ?? "" }));
    });
  }

  function fmt(n: number | null | undefined): string {
    if (n == null) return "—";
    return String(n);
  }

  return (
    <div className="space-y-8">
      {warning ? (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--secondary)_40%,transparent)] bg-[color-mix(in_srgb,var(--secondary-container)_20%,transparent)] px-4 py-3 text-sm">
          {warning}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--on-surface-variant)]">
            {t("selectStudy")}
          </span>
          <select
            className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2"
            value={studyId}
            onChange={(e) => setStudyId(e.target.value)}
          >
            {studies.length === 0 ? (
              <option value="">{t("noStudies")}</option>
            ) : (
              studies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.status})
                </option>
              ))
            )}
          </select>
        </label>
        <button
          type="button"
          className="btn-secondary h-10 px-4"
          disabled={!studyId || pending}
          onClick={runExport}
        >
          {pending ? t("exporting") : t("exportPackage")}
        </button>
        {exportMsg ? (
          <p className="text-sm text-[var(--primary)]">{exportMsg}</p>
        ) : null}
      </div>

      {dash ? (
        <>
          <p className="text-xs text-[var(--on-surface-variant)]">
            {dash.disclaimer}
          </p>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [t("metrics.enrollments"), dash.enrollments.active],
              [t("metrics.completedAssignments"), dash.assignments.completed],
              [t("metrics.blindScores"), dash.blind_challenge.scores],
              [
                t("metrics.kappa"),
                dash.reliability.cohens_kappa?.value ?? "—",
              ],
            ].map(([label, value]) => (
              <div key={String(label)} className="clinical-card p-5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--outline)]">
                  {label}
                </p>
                <p className="font-[family-name:var(--font-headline)] text-3xl font-bold text-[var(--primary)]">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="clinical-card p-5">
              <h3 className="font-[family-name:var(--font-headline)] font-semibold">
                {t("reliabilityTitle")}
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex justify-between">
                  <span>{t("cronbach")}</span>
                  <span>{fmt(dash.reliability.cronbach_alpha)}</span>
                </li>
                <li className="flex justify-between">
                  <span>{t("cohensKappa")}</span>
                  <span>
                    {fmt(dash.reliability.cohens_kappa?.value)} (
                    {dash.reliability.cohens_kappa?.interpretation ?? "—"})
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>{t("fleissKappa")}</span>
                  <span>{fmt(dash.reliability.fleiss_kappa?.value)}</span>
                </li>
                <li className="flex justify-between">
                  <span>{t("icc")}</span>
                  <span>{fmt(dash.reliability.icc?.value)}</span>
                </li>
                <li className="flex justify-between">
                  <span>{t("pearson")}</span>
                  <span>{fmt(dash.reliability.pearson_inter_rater)}</span>
                </li>
              </ul>
            </div>

            <div className="clinical-card p-5">
              <h3 className="font-[family-name:var(--font-headline)] font-semibold">
                {t("consortTitle")}
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {(
                  [
                    ["assessed_for_eligibility", dash.consort.assessed_for_eligibility],
                    ["randomized", dash.consort.randomized],
                    ["allocated_intervention", dash.consort.allocated_intervention],
                    ["allocated_control", dash.consort.allocated_control],
                    ["received_intervention", dash.consort.received_intervention],
                    ["completed_followup", dash.consort.completed_followup],
                    ["analysed", dash.consort.analysed],
                  ] as const
                ).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-[var(--on-surface-variant)]">{k}</span>
                    <span className="font-semibold">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="clinical-card p-5">
            <h3 className="font-[family-name:var(--font-headline)] font-semibold">
              {t("institutionsTitle")}
            </h3>
            {dash.institutions.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                {t("noInstitutions")}
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                      <th className="py-2">{t("site")}</th>
                      <th className="py-2">{t("enrolled")}</th>
                      <th className="py-2">{t("completed")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dash.institutions.map((i) => (
                      <tr
                        key={i.institution_id}
                        className="border-b border-[var(--outline-variant)]"
                      >
                        <td className="py-2">
                          {i.institution_name}{" "}
                          <span className="text-xs text-[var(--outline)]">
                            {i.site_code}
                          </span>
                        </td>
                        <td className="py-2">{i.enrollments}</td>
                        <td className="py-2">{i.completed_assignments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="clinical-card p-4">
              <p className="text-xs uppercase text-[var(--outline)]">
                {t("calibration")}
              </p>
              <p className="text-2xl font-bold text-[var(--secondary)]">
                {dash.calibration.with_expert_scores}/{dash.calibration.items}
              </p>
            </div>
            <div className="clinical-card p-4">
              <p className="text-xs uppercase text-[var(--outline)]">
                {t("longitudinal")}
              </p>
              <p className="text-2xl font-bold text-[var(--secondary)]">
                {dash.longitudinal.reviewers_with_2plus_snapshots}
              </p>
            </div>
            <div className="clinical-card p-4">
              <p className="text-xs uppercase text-[var(--outline)]">
                {t("outcomes")}
              </p>
              <p className="text-2xl font-bold text-[var(--secondary)]">
                {dash.outcomes.length}
              </p>
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-[var(--on-surface-variant)]">{t("loading")}</p>
      )}
    </div>
  );
}
