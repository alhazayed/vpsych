import { deidentifyRatingRow, rowsToCsv, type DeidentifiedRatingRow } from "./deidentify";
import { buildCvpDashboard, type DashboardInput } from "./dashboard";
import type { DeidentifyLevel, ExportKind } from "./types";

export type PublicationPackage = {
  kind: ExportKind;
  generated_at: string;
  deidentify_level: DeidentifyLevel;
  study_slug: string | null;
  ratings_csv: string;
  ratings: DeidentifiedRatingRow[];
  dashboard_summary: ReturnType<typeof buildCvpDashboard>;
  codebook: Record<string, string>;
  ethics_notes: string[];
};

export function buildPublicationPackage(input: {
  kind: ExportKind;
  deidentifyLevel: DeidentifyLevel;
  studySlug: string | null;
  ratingRows: Parameters<typeof deidentifyRatingRow>[0][];
  dashboardInput: DashboardInput;
}): PublicationPackage {
  const ratings = input.ratingRows.map((r) =>
    deidentifyRatingRow(r, input.deidentifyLevel),
  );
  const dashboard_summary = buildCvpDashboard(input.dashboardInput);

  return {
    kind: input.kind,
    generated_at: new Date().toISOString(),
    deidentify_level: input.deidentifyLevel,
    study_slug: input.studySlug,
    ratings_csv: rowsToCsv(ratings as unknown as Record<string, unknown>[]),
    ratings,
    dashboard_summary,
    codebook: {
      study_pseudonym: "SHA-256 truncated study id",
      session_pseudonym: "SHA-256 truncated session id",
      rater_pseudonym: "SHA-256 truncated rater id",
      clinical_realism: "Likert 1–5 expert rating",
      educational_value: "Likert 1–5 expert rating",
      free_text: "Scrubbed free text per deidentify_level",
    },
    ethics_notes: [
      "Dataset intended for secondary analysis under study IRB/ethics approval.",
      "Do not attempt to re-identify participants.",
      "Formative ratings are not clinical diagnoses.",
      "See docs/cvp/ETHICS.md and docs/cvp/IRB_PACKET.md.",
    ],
  };
}
