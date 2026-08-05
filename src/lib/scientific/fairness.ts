/**
 * Bias & fairness checks for bilingual / demographic scientific review.
 */

export type LocaleParityResult = {
  locale_a: string;
  locale_b: string;
  mean_a: number;
  mean_b: number;
  abs_diff: number;
  within_tolerance: boolean;
  tolerance: number;
  n_a: number;
  n_b: number;
};

export function localeScoreParity(
  scoresA: number[],
  scoresB: number[],
  localeA: string,
  localeB: string,
  tolerance = 5,
): LocaleParityResult {
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const ma = mean(scoresA);
  const mb = mean(scoresB);
  const abs_diff = Math.abs(ma - mb);
  return {
    locale_a: localeA,
    locale_b: localeB,
    mean_a: Math.round(ma * 10) / 10,
    mean_b: Math.round(mb * 10) / 10,
    abs_diff: Math.round(abs_diff * 10) / 10,
    within_tolerance: abs_diff <= tolerance,
    tolerance,
    n_a: scoresA.length,
    n_b: scoresB.length,
  };
}

export type FairnessFinding = {
  dimension: string;
  status: "pass" | "partial" | "fail" | "insufficient_evidence";
  evidence: string;
};

export function assessFairnessControls(input: {
  enArParityWithinTolerance: boolean;
  genderAllowedOnPackages: boolean;
  cultureDoesNotRewriteCodes: boolean;
  authoredNativePersonalities: boolean;
}): FairnessFinding[] {
  return [
    {
      dimension: "language_en_ar",
      status: input.enArParityWithinTolerance ? "pass" : "partial",
      evidence: input.enArParityWithinTolerance
        ? "Simulated EN/AR score means within tolerance under identical case seeds"
        : "EN/AR simulated means exceeded tolerance — investigate locale scoring bias",
    },
    {
      dimension: "gender",
      status: input.genderAllowedOnPackages ? "pass" : "fail",
      evidence: "Disorder packages declare allowed_genders; generator validates age/gender bounds",
    },
    {
      dimension: "culture_religion",
      status: input.cultureDoesNotRewriteCodes ? "pass" : "fail",
      evidence:
        "Culture/locale must not mutate DSM/ICD codes (scenario template generation invariant)",
    },
    {
      dimension: "native_language_authorship",
      status: input.authoredNativePersonalities ? "partial" : "insufficient_evidence",
      evidence: input.authoredNativePersonalities
        ? "Maya/Jordan personalities authored natively EN/AR — broader persona set limited"
        : "No native bilingual personality evidence found",
    },
    {
      dimension: "socioeconomic_age_setting",
      status: "partial",
      evidence:
        "Randomized context varies stressors/finances; no formal SES fairness audit published",
    },
    {
      dimension: "training_level",
      status: "partial",
      evidence:
        "Difficulty profiles + ACE professions exist; fairness across training levels not externally validated",
    },
  ];
}
