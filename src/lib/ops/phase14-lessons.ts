/**
 * Phase 14 — Lessons Learned register.
 * Institutional / ops / clinical-governance lessons. No PHI.
 */

export const LESSON_CATEGORIES = [
  "clinical",
  "educational",
  "operational",
  "security",
  "research",
  "governance",
  "institutional",
] as const;

export type LessonCategory = (typeof LESSON_CATEGORIES)[number];

export type LessonLearned = {
  id: string;
  date: string;
  institution?: string;
  category: LessonCategory;
  title: string;
  observation: string;
  root_cause?: string;
  action: string;
  owner: string;
  status: "open" | "implemented" | "deferred";
};

export type LessonsSummary = {
  generated_at: string;
  total: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  items: LessonLearned[];
};

export function summarizeLessons(items: LessonLearned[]): LessonsSummary {
  const by_category: Record<string, number> = {};
  const by_status: Record<string, number> = {};
  for (const item of items) {
    by_category[item.category] = (by_category[item.category] ?? 0) + 1;
    by_status[item.status] = (by_status[item.status] ?? 0) + 1;
  }
  return {
    generated_at: new Date().toISOString(),
    total: items.length,
    by_category,
    by_status,
    items: [...items].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function defaultPhase14Lessons(): LessonLearned[] {
  return [
    {
      id: "LL-P14-01",
      date: "2026-08-07",
      category: "governance",
      title: "CIDP packaging precedes GA evidence",
      observation:
        "Institutional package and dashboards can be GO while DR drill and score validation remain open.",
      root_cause:
        "GA gates intentionally stricter than CIDP authorization criteria.",
      action:
        "Keep dual status (CIDP GO / GA NO-GO) visible on every executive surface.",
      owner: "Release Board Chair",
      status: "implemented",
    },
    {
      id: "LL-P14-02",
      date: "2026-08-07",
      category: "operational",
      title: "Soft-fail metrics avoid blocking reports",
      observation:
        "CIDP dashboards soft-fail to zero when membership/research tables are empty.",
      action:
        "Treat zeros as missing wiring during early pilots; do not invent clinical scores.",
      owner: "Enterprise Program Manager",
      status: "implemented",
    },
    {
      id: "LL-P14-03",
      date: "2026-08-07",
      category: "clinical",
      title: "Never equate formative scores with validated instruments",
      observation:
        "Faculty may misread assessment overall as board-ready measurement.",
      action:
        "Repeat unvalidated-score disclaimer in faculty/resident guides and weekly clinical reports.",
      owner: "Clinical Governance Lead",
      status: "open",
    },
  ];
}
