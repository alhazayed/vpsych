/**
 * Clinical Educator PDF / print package.
 * Returns structured payload + print-ready HTML (browser print → PDF).
 */

import type { ClinicalEducatorReport } from "@/lib/clinical-educator/types";

export type ClinicalEducatorPdfPackage = {
  format: "vpsych-clinical-educator-pdf";
  version: string;
  title: string;
  language: "en" | "ar";
  report: ClinicalEducatorReport;
  meta: {
    session_id?: string | null;
    therapist_name?: string | null;
    patient_name?: string | null;
    disorder?: string | null;
    generated_at: string;
  };
  html: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildClinicalEducatorPdfHtml(
  report: ClinicalEducatorReport,
  meta: ClinicalEducatorPdfPackage["meta"],
): string {
  const isAr = report.language === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const title = isAr ? "تقرير المعلّم السريري" : "Clinical Educator Report";
  const dimRows = report.dimensions
    .map((d) => {
      const examples =
        d.examples.length > 0
          ? `<ul>${d.examples.map((e) => `<li><em>${escapeHtml(e)}</em></li>`).join("")}</ul>`
          : `<p class="muted">${isAr ? "لا مقتطفات مباشرة." : "No direct excerpts."}</p>`;
      return `
      <section class="dim">
        <header>
          <h2>${escapeHtml(d.label)}</h2>
          <p class="score">${d.score}/${d.max} · ${d.percent}%</p>
        </header>
        <p>${escapeHtml(d.feedback)}</p>
        <h3>${isAr ? "نقاط القوة" : "Strengths"}</h3>
        <ul>${d.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
        <h3>${isAr ? "مجالات النمو" : "Growth areas"}</h3>
        <ul>${d.growth_areas.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
        <h3>${isAr ? "تمرين مقترح" : "Next practice"}</h3>
        <p>${escapeHtml(d.next_practice)}</p>
        <h3>${isAr ? "أمثلة من النص" : "Transcript examples"}</h3>
        ${examples}
      </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${report.language}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: Georgia, "Times New Roman", serif; margin: 2rem; color: #1a1a1a; line-height: 1.45; }
    h1 { font-size: 1.75rem; margin: 0 0 0.25rem; }
    h2 { font-size: 1.15rem; margin: 0; }
    h3 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: #555; margin: 0.75rem 0 0.25rem; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.25rem; }
    .summary { border-left: 3px solid #2c5f4a; padding-left: 0.75rem; margin: 1rem 0 1.5rem; }
    [dir="rtl"] .summary { border-left: none; border-right: 3px solid #2c5f4a; padding-left: 0; padding-right: 0.75rem; }
    .dim { break-inside: avoid; border-top: 1px solid #ddd; padding: 1rem 0; }
    .dim header { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
    .score { font-family: ui-monospace, monospace; color: #2c5f4a; font-weight: 700; }
    .muted { color: #777; font-size: 0.9rem; }
    .disclaimer { margin-top: 2rem; font-size: 0.8rem; color: #666; border-top: 1px solid #ddd; padding-top: 0.75rem; }
    @media print { body { margin: 1rem; } }
  </style>
</head>
<body>
  <header>
    <p class="muted">${isAr ? "تقييم سرّي — للإدارة فقط" : "Confidential — admin only"}</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">
      ${meta.therapist_name ? `${isAr ? "المعالج" : "Therapist"}: ${escapeHtml(meta.therapist_name)} · ` : ""}
      ${meta.patient_name ? `${isAr ? "المريض" : "Patient"}: ${escapeHtml(meta.patient_name)}${meta.disorder ? ` (${escapeHtml(meta.disorder)})` : ""} · ` : ""}
      ${meta.session_id ? `Session ${escapeHtml(meta.session_id.slice(0, 8))} · ` : ""}
      ${escapeHtml(meta.generated_at)}
    </p>
  </header>
  <section class="summary">
    <p>${escapeHtml(report.educational_summary)}</p>
    <p class="muted">${isAr ? "مركب مرجعي (للتوافق)" : "Reference composite (compatibility)"}: ${report.composite}/100 · ${report.rubric_version}</p>
  </section>
  ${dimRows}
  <p class="disclaimer">${escapeHtml(report.disclaimer)}</p>
</body>
</html>`;
}

export function buildClinicalEducatorPdfPackage(
  report: ClinicalEducatorReport,
  meta: Omit<ClinicalEducatorPdfPackage["meta"], "generated_at"> & {
    generated_at?: string;
  } = {},
): ClinicalEducatorPdfPackage {
  const fullMeta = {
    session_id: meta.session_id ?? null,
    therapist_name: meta.therapist_name ?? null,
    patient_name: meta.patient_name ?? null,
    disorder: meta.disorder ?? null,
    generated_at: meta.generated_at ?? new Date().toISOString(),
  };
  return {
    format: "vpsych-clinical-educator-pdf",
    version: report.version,
    title:
      report.language === "ar"
        ? "تقرير المعلّم السريري"
        : "Clinical Educator Report",
    language: report.language,
    report,
    meta: fullMeta,
    html: buildClinicalEducatorPdfHtml(report, fullMeta),
  };
}
