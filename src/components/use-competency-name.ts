"use client";

import { useTranslations } from "next-intl";

// Competency ids from the ACE and CGE engines are English snake_case. Returns
// the translated name when messages have one, else the fallback (e.g. the
// node's stored English name) or the id with spaces.
export function useCompetencyName() {
  const t = useTranslations("learning.competencies");
  return (id: string, fallback?: string) =>
    t.has(id) ? t(id) : (fallback ?? id.replace(/_/g, " "));
}
