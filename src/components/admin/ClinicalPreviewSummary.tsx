"use client";

import { AdvancedJson } from "@/components/admin/AdvancedDetails";

export type PreviewField = {
  label: string;
  value: string | number | null | undefined;
};

function formatLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function pickNestedName(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const rec = v as Record<string, unknown>;
    return (
      pickString(rec, ["name", "label", "title", "slug", "code"]) ?? null
    );
  }
  return null;
}

/** Extract human-readable clinical fields from heterogeneous preview payloads. */
export function summarizeClinicalPreview(
  payload: unknown,
): PreviewField[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const snap =
    root.snapshot && typeof root.snapshot === "object"
      ? (root.snapshot as Record<string, unknown>)
      : root.patient && typeof root.patient === "object"
        ? (root.patient as Record<string, unknown>)
        : root.case && typeof root.case === "object"
          ? (root.case as Record<string, unknown>)
          : root;

  const clinical =
    snap.clinical && typeof snap.clinical === "object"
      ? (snap.clinical as Record<string, unknown>)
      : snap.clinical_core && typeof snap.clinical_core === "object"
        ? (snap.clinical_core as Record<string, unknown>)
        : snap;

  const diagnosis =
    pickNestedName(clinical, "primary_diagnosis") ??
    pickNestedName(clinical, "diagnosis") ??
    pickString(clinical, ["disorder", "disorder_name", "disorderSlug"]) ??
    pickString(snap, ["disorder", "disorder_name", "disorderSlug"]);

  const dsm =
    pickString(clinical, ["dsm5_code", "dsm_5", "dsm5"]) ??
    pickString(snap, ["dsm5_code"]);
  const icd =
    pickString(clinical, ["icd11_code", "icd_11", "icd11"]) ??
    pickString(snap, ["icd11_code"]);

  const severity = pickString(clinical, ["severity", "severity_level"]);
  const difficulty = pickString(snap, ["difficulty", "difficulty_level"]);
  const modality =
    pickString(snap, ["therapy_modality", "modality", "therapy"]) ??
    pickString(clinical, ["therapy_modality", "modality"]);
  const locale =
    pickString(snap, ["locale", "language", "session_language"]) ??
    pickString(clinical, ["locale", "language"]);
  const assessmentId = pickString(snap, ["assessment_id", "id"]);

  let comorbidities: string | null = null;
  const rawComorbid =
    clinical.comorbidities ??
    clinical.comorbidity ??
    snap.comorbidities ??
    snap.comorbiditySlugs;
  if (Array.isArray(rawComorbid) && rawComorbid.length) {
    comorbidities = rawComorbid
      .map((c) => {
        if (typeof c === "string") return formatLabel(c);
        if (c && typeof c === "object") {
          return (
            pickString(c as Record<string, unknown>, ["name", "slug", "label"]) ??
            "—"
          );
        }
        return "—";
      })
      .join(", ");
  }

  let competencies: string | null = null;
  const rawComp =
    snap.target_competencies ??
    snap.competencies ??
    clinical.target_competencies ??
    root.target_competencies;
  if (Array.isArray(rawComp) && rawComp.length) {
    competencies = rawComp
      .slice(0, 8)
      .map((c) =>
        typeof c === "string"
          ? formatLabel(c)
          : pickString((c as Record<string, unknown>) ?? {}, [
              "label",
              "name",
              "id",
              "competency_id",
            ]) ?? "—",
      )
      .join(", ");
  }

  const fields: PreviewField[] = [
    { label: "Diagnosis", value: diagnosis },
    { label: "DSM-5", value: dsm },
    { label: "ICD-11", value: icd },
    { label: "Severity", value: severity ? formatLabel(severity) : null },
    { label: "Difficulty", value: difficulty ? formatLabel(difficulty) : null },
    { label: "Therapy modality", value: modality ? formatLabel(modality) : null },
    { label: "Language / locale", value: locale },
    { label: "Comorbidities", value: comorbidities },
    { label: "Target competencies", value: competencies },
    { label: "Assessment ID", value: assessmentId },
  ];

  return fields.filter((f) => f.value != null && String(f.value).trim() !== "");
}

export function ClinicalPreviewSummary({
  payload,
  title = "Clinical summary",
  emptyLabel = "No preview generated yet.",
}: {
  payload: unknown;
  title?: string;
  emptyLabel?: string;
}) {
  const fields = summarizeClinicalPreview(payload);
  const hasPayload = payload != null && payload !== "";

  if (!hasPayload) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">{emptyLabel}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="clinical-card p-5">
        <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {title}
        </h3>
        {fields.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            Preview ready. Open advanced details for the full technical payload.
          </p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                  {f.label}
                </dt>
                <dd className="mt-1 text-sm text-[var(--on-surface)]">
                  {String(f.value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <AdvancedJson value={payload} title="Advanced details (raw JSON)" />
    </div>
  );
}
