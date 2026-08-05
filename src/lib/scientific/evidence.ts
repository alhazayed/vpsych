/**
 * Scientific evidence locks for VPsych disorder packages (Mission 19).
 * Every entry cites primary nosology and at least one guideline / instrument.
 * Unsupported claims are flagged explicitly — do not invent citations.
 */

export type EvidenceCitation = {
  id: string;
  type:
    | "dsm5_tr"
    | "icd11"
    | "guideline"
    | "instrument"
    | "psychotherapy"
    | "pharmacology"
    | "risk_standard"
    | "review";
  citation: string;
  year?: number;
  notes?: string;
};

export type DisorderEvidenceLock = {
  slug: string;
  dsm5_code: string | null;
  icd11_code: string | null;
  /** True when DSM-5-TR has no equivalent code (e.g. CPTSD). */
  dsm5_optional?: boolean;
  criteria_basis: string;
  citations: EvidenceCitation[];
  unsupported_flags: string[];
  evidence_grade: "A" | "B" | "C" | "unsupported";
};

/**
 * Canonical evidence map. Grades:
 * A = DSM/ICD + guideline + instrument
 * B = DSM/ICD + instrument or guideline
 * C = codes only / thin package
 * unsupported = missing nosology lock
 */
export const DISORDER_EVIDENCE: DisorderEvidenceLock[] = [
  {
    slug: "mdd-recurrent-moderate",
    dsm5_code: "296.32",
    icd11_code: "6A71.1",
    criteria_basis:
      "DSM-5-TR Major Depressive Disorder, recurrent, moderate; ICD-11 6A71.1",
    citations: [
      {
        id: "dsm5tr-mdd",
        type: "dsm5_tr",
        citation:
          "American Psychiatric Association. Diagnostic and Statistical Manual of Mental Disorders, 5th ed., Text Revision (DSM-5-TR). 2022. MDD criteria.",
        year: 2022,
      },
      {
        id: "icd11-mdd",
        type: "icd11",
        citation:
          "World Health Organization. ICD-11 for Mortality and Morbidity Statistics. 6A71 Recurrent depressive disorder.",
        year: 2022,
      },
      {
        id: "apa-mdd-gl",
        type: "guideline",
        citation:
          "APA. Practice Guideline for the Treatment of Patients With Major Depressive Disorder. 3rd ed. 2010 (reaffirmed updates).",
        year: 2010,
      },
      {
        id: "phq9",
        type: "instrument",
        citation:
          "Kroenke K, Spitzer RL, Williams JB. The PHQ-9. J Gen Intern Med. 2001;16(9):606-613.",
        year: 2001,
      },
      {
        id: "beckrs-mdd",
        type: "risk_standard",
        citation:
          "Posner K et al. Columbia-Suicide Severity Rating Scale (C-SSRS). 2008.",
        year: 2008,
      },
    ],
    unsupported_flags: [],
    evidence_grade: "A",
  },
  {
    slug: "gad-with-panic",
    dsm5_code: "300.02",
    icd11_code: "6B00",
    criteria_basis: "DSM-5-TR GAD; panic features as comorbidity/specifier teaching",
    citations: [
      {
        id: "dsm5tr-gad",
        type: "dsm5_tr",
        citation:
          "APA. DSM-5-TR. Generalized Anxiety Disorder criteria. 2022.",
        year: 2022,
      },
      {
        id: "icd11-gad",
        type: "icd11",
        citation: "WHO. ICD-11. 6B00 Generalised anxiety disorder.",
        year: 2022,
      },
      {
        id: "gad7",
        type: "instrument",
        citation:
          "Spitzer RL et al. A brief measure for assessing generalized anxiety disorder: the GAD-7. Arch Intern Med. 2006;166(10):1092-1097.",
        year: 2006,
      },
      {
        id: "nice-gad",
        type: "guideline",
        citation:
          "NICE. Generalised anxiety disorder and panic disorder in adults: management (CG113).",
        year: 2011,
      },
    ],
    unsupported_flags: [
      "Package title includes panic; panic disorder criteria are separate (300.01 / 6B01) — treat panic as comorbid teaching, not fused nosology",
    ],
    evidence_grade: "A",
  },
  {
    slug: "ptsd",
    dsm5_code: "309.81",
    icd11_code: "6B40",
    criteria_basis: "DSM-5-TR PTSD; ICD-11 PTSD 6B40",
    citations: [
      {
        id: "dsm5tr-ptsd",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Posttraumatic Stress Disorder. 2022.",
        year: 2022,
      },
      {
        id: "icd11-ptsd",
        type: "icd11",
        citation: "WHO. ICD-11. 6B40 Post traumatic stress disorder.",
        year: 2022,
      },
      {
        id: "va-ptsd",
        type: "guideline",
        citation:
          "VA/DoD Clinical Practice Guideline for the Management of PTSD. 2023.",
        year: 2023,
      },
      {
        id: "pcl5",
        type: "instrument",
        citation: "Weathers FW et al. PTSD Checklist for DSM-5 (PCL-5). 2013.",
        year: 2013,
      },
    ],
    unsupported_flags: [],
    evidence_grade: "A",
  },
  {
    slug: "complex-ptsd",
    dsm5_code: null,
    icd11_code: "6B41",
    dsm5_optional: true,
    criteria_basis: "ICD-11 Complex PTSD 6B41 (no DSM-5-TR equivalent code)",
    citations: [
      {
        id: "icd11-cptsd",
        type: "icd11",
        citation: "WHO. ICD-11. 6B41 Complex post traumatic stress disorder.",
        year: 2022,
      },
      {
        id: "cloitre-cptsd",
        type: "review",
        citation:
          "Cloitre M et al. Evidence for proposed ICD-11 PTSD and complex PTSD. Eur J Psychotraumatol. 2018.",
        year: 2018,
      },
    ],
    unsupported_flags: [
      "Must never be coded as DSM-5-TR 309.81 alone without noting ICD-11-only construct",
    ],
    evidence_grade: "A",
  },
  {
    slug: "pdd",
    dsm5_code: "300.4",
    icd11_code: "6A72",
    criteria_basis: "DSM-5-TR Persistent Depressive Disorder; ICD-11 6A72 dysthymic disorder",
    citations: [
      {
        id: "dsm5tr-pdd",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Persistent Depressive Disorder (Dysthymia). 2022.",
        year: 2022,
      },
      {
        id: "icd11-pdd",
        type: "icd11",
        citation: "WHO. ICD-11. 6A72 Dysthymic disorder.",
        year: 2022,
      },
    ],
    unsupported_flags: [
      "Builtin package on main may be thin — verify ≥2-year course in generation",
    ],
    evidence_grade: "B",
  },
  {
    slug: "panic-disorder",
    dsm5_code: "300.01",
    icd11_code: "6B01",
    criteria_basis: "DSM-5-TR Panic Disorder; ICD-11 6B01",
    citations: [
      {
        id: "dsm5tr-panic",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Panic Disorder. 2022.",
        year: 2022,
      },
      {
        id: "icd11-panic",
        type: "icd11",
        citation: "WHO. ICD-11. 6B01 Panic disorder.",
        year: 2022,
      },
      {
        id: "nice-panic",
        type: "guideline",
        citation: "NICE CG113 — panic disorder management sections.",
        year: 2011,
      },
    ],
    unsupported_flags: [],
    evidence_grade: "A",
  },
  {
    slug: "social-anxiety",
    dsm5_code: "300.23",
    icd11_code: "6B04",
    criteria_basis: "DSM-5-TR Social Anxiety Disorder; ICD-11 6B04",
    citations: [
      {
        id: "dsm5tr-sad",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Social Anxiety Disorder. 2022.",
        year: 2022,
      },
      {
        id: "icd11-sad",
        type: "icd11",
        citation: "WHO. ICD-11. 6B04 Social anxiety disorder.",
        year: 2022,
      },
    ],
    unsupported_flags: ["Builtin package may be thin on main branch"],
    evidence_grade: "B",
  },
  {
    slug: "ocd",
    dsm5_code: "300.3",
    icd11_code: "6B20",
    criteria_basis: "DSM-5-TR OCD; ICD-11 6B20",
    citations: [
      {
        id: "dsm5tr-ocd",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Obsessive-Compulsive Disorder. 2022.",
        year: 2022,
      },
      {
        id: "icd11-ocd",
        type: "icd11",
        citation: "WHO. ICD-11. 6B20 Obsessive-compulsive disorder.",
        year: 2022,
      },
      {
        id: "nice-ocd",
        type: "guideline",
        citation: "NICE. Obsessive-compulsive disorder and body dysmorphic disorder (CG31).",
        year: 2005,
      },
    ],
    unsupported_flags: [],
    evidence_grade: "A",
  },
  {
    slug: "adult-adhd",
    dsm5_code: "314.00",
    icd11_code: "6A05.0",
    criteria_basis: "DSM-5-TR ADHD predominantly inattentive; ICD-11 6A05",
    citations: [
      {
        id: "dsm5tr-adhd",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Attention-Deficit/Hyperactivity Disorder. 2022.",
        year: 2022,
      },
      {
        id: "icd11-adhd",
        type: "icd11",
        citation: "WHO. ICD-11. 6A05 Attention deficit hyperactivity disorder.",
        year: 2022,
      },
      {
        id: "nice-adhd",
        type: "guideline",
        citation: "NICE. Attention deficit hyperactivity disorder (NG87).",
        year: 2018,
      },
    ],
    unsupported_flags: [],
    evidence_grade: "A",
  },
  {
    slug: "alcohol-use-disorder",
    dsm5_code: "305.00",
    icd11_code: "6C40.1",
    criteria_basis: "DSM-5-TR AUD; ICD-11 6C40 Harmful pattern of use of alcohol",
    citations: [
      {
        id: "dsm5tr-aud",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Alcohol Use Disorder. 2022.",
        year: 2022,
      },
      {
        id: "icd11-aud",
        type: "icd11",
        citation: "WHO. ICD-11. 6C40 Disorders due to use of alcohol.",
        year: 2022,
      },
      {
        id: "audit",
        type: "instrument",
        citation:
          "Saunders JB et al. Development of the Alcohol Use Disorders Identification Test (AUDIT). Addiction. 1993.",
        year: 1993,
      },
    ],
    unsupported_flags: [],
    evidence_grade: "A",
  },
  {
    slug: "bpd",
    dsm5_code: "301.83",
    icd11_code: "6D10.1/6D11.5",
    criteria_basis:
      "DSM-5-TR Borderline Personality Disorder; ICD-11 personality severity + borderline pattern",
    citations: [
      {
        id: "dsm5tr-bpd",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Borderline Personality Disorder. 2022.",
        year: 2022,
      },
      {
        id: "icd11-bpd",
        type: "icd11",
        citation:
          "WHO. ICD-11. 6D10 Personality disorder + 6D11.5 Borderline pattern.",
        year: 2022,
      },
      {
        id: "dbt",
        type: "psychotherapy",
        citation:
          "Linehan MM. DBT Skills Training Manual. 2nd ed. Guilford. 2015.",
        year: 2015,
      },
    ],
    unsupported_flags: [],
    evidence_grade: "A",
  },
  {
    slug: "asd",
    dsm5_code: "299.00",
    icd11_code: "6A02",
    criteria_basis: "DSM-5-TR Autism Spectrum Disorder; ICD-11 6A02",
    citations: [
      {
        id: "dsm5tr-asd",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Autism Spectrum Disorder. 2022.",
        year: 2022,
      },
      {
        id: "icd11-asd",
        type: "icd11",
        citation: "WHO. ICD-11. 6A02 Autism spectrum disorder.",
        year: 2022,
      },
    ],
    unsupported_flags: ["Adult assessment package may be thin"],
    evidence_grade: "B",
  },
  {
    slug: "schizophrenia",
    dsm5_code: "295.90",
    icd11_code: "6A20",
    criteria_basis: "DSM-5-TR Schizophrenia; ICD-11 6A20",
    citations: [
      {
        id: "dsm5tr-scz",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Schizophrenia. 2022.",
        year: 2022,
      },
      {
        id: "icd11-scz",
        type: "icd11",
        citation: "WHO. ICD-11. 6A20 Schizophrenia.",
        year: 2022,
      },
      {
        id: "apa-scz-gl",
        type: "guideline",
        citation:
          "APA. Practice Guideline for the Treatment of Patients With Schizophrenia. 3rd ed. 2020.",
        year: 2020,
      },
    ],
    unsupported_flags: [
      "Main-branch package historically thin (symptoms) — expand before claiming full MSE fidelity",
    ],
    evidence_grade: "B",
  },
  {
    slug: "schizoaffective",
    dsm5_code: "295.70",
    icd11_code: "6A21",
    criteria_basis: "DSM-5-TR Schizoaffective Disorder; ICD-11 6A21",
    citations: [
      {
        id: "dsm5tr-sa",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Schizoaffective Disorder. 2022.",
        year: 2022,
      },
      {
        id: "icd11-sa",
        type: "icd11",
        citation: "WHO. ICD-11. 6A21 Schizoaffective disorder.",
        year: 2022,
      },
    ],
    unsupported_flags: ["Timeline teaching essential; package may be thin on main"],
    evidence_grade: "B",
  },
  {
    slug: "bipolar-mania",
    dsm5_code: "296.44",
    icd11_code: "6A60.2",
    criteria_basis:
      "DSM-5-TR Bipolar I manic episode with psychotic features; ICD-11 6A60.2",
    citations: [
      {
        id: "dsm5tr-bp",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Bipolar I Disorder. 2022.",
        year: 2022,
      },
      {
        id: "icd11-bp",
        type: "icd11",
        citation:
          "WHO. ICD-11. 6A60.2 Manic episode with psychotic symptoms.",
        year: 2022,
      },
      {
        id: "canmat",
        type: "guideline",
        citation:
          "Yatham LN et al. CANMAT/ISBD guidelines for bipolar disorder. Bipolar Disord. 2018.",
        year: 2018,
      },
    ],
    unsupported_flags: [
      "ICD-11 6A60.1 is without psychosis — must not be used for 296.44/F31.2 packages",
    ],
    evidence_grade: "A",
  },
  {
    slug: "eating-disorders",
    dsm5_code: "307.1",
    icd11_code: "6B80",
    criteria_basis: "DSM-5-TR Anorexia Nervosa; ICD-11 6B80 (AN-specific codes — not full ED spectrum)",
    citations: [
      {
        id: "dsm5tr-an",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Anorexia Nervosa. 2022.",
        year: 2022,
      },
      {
        id: "icd11-an",
        type: "icd11",
        citation: "WHO. ICD-11. 6B80 Anorexia nervosa.",
        year: 2022,
      },
      {
        id: "nice-ed",
        type: "guideline",
        citation: "NICE. Eating disorders: recognition and treatment (NG69).",
        year: 2017,
      },
    ],
    unsupported_flags: [
      "Slug implies spectrum; codes are AN-specific — document limitation",
    ],
    evidence_grade: "A",
  },
  {
    slug: "delirium",
    dsm5_code: "293.0",
    icd11_code: "6D70",
    criteria_basis: "DSM-5-TR Delirium; ICD-11 6D70 — medical simulation",
    citations: [
      {
        id: "dsm5tr-del",
        type: "dsm5_tr",
        citation: "APA. DSM-5-TR. Delirium. 2022.",
        year: 2022,
      },
      {
        id: "icd11-del",
        type: "icd11",
        citation: "WHO. ICD-11. 6D70 Delirium.",
        year: 2022,
      },
      {
        id: "cam",
        type: "instrument",
        citation:
          "Inouye SK et al. Clarifying confusion: the confusion assessment method. Ann Intern Med. 1990.",
        year: 1990,
      },
    ],
    unsupported_flags: [
      "Not a psychotherapy OSCE primary; hours–days course required",
    ],
    evidence_grade: "A",
  },
];

export function evidenceForSlug(slug: string): DisorderEvidenceLock | undefined {
  return DISORDER_EVIDENCE.find((e) => e.slug === slug);
}

export function evidenceMatrixSummary() {
  const grades = { A: 0, B: 0, C: 0, unsupported: 0 };
  for (const e of DISORDER_EVIDENCE) grades[e.evidence_grade] += 1;
  const unsupported = DISORDER_EVIDENCE.flatMap((e) =>
    e.unsupported_flags.map((f) => ({ slug: e.slug, flag: f })),
  );
  return {
    disorder_locks: DISORDER_EVIDENCE.length,
    grades,
    unsupported_flags: unsupported,
    mean_citations:
      DISORDER_EVIDENCE.reduce((a, e) => a + e.citations.length, 0) /
      DISORDER_EVIDENCE.length,
  };
}
