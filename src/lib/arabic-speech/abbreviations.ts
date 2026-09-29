/**
 * Latin clinical / psych abbreviations → Arabic spoken expansions.
 * Matched as whole tokens (case-insensitive); never invents clinical content
 * beyond the canonical spoken name of the abbreviation.
 */

/** Longest keys first so "SSRIs" wins over "SSRI" when both listed. */
export const CLINICAL_ABBREVIATION_EXPANSIONS: ReadonlyArray<
  readonly [string, string]
> = [
  ["SSRIs", "مثبطات استرداد السيروتونين الانتقائية"],
  ["SNRIs", "مثبطات استرداد السيروتونين والنورأدرينالين"],
  ["ADHD", "اضطراب فرط الحركة وتشتت الانتباه"],
  ["PTSD", "اضطراب ما بعد الصدمة"],
  ["MDD", "اضطراب الاكتئاب الجسيم"],
  ["GAD", "اضطراب القلق العام"],
  ["OCD", "الوَسْوَاس القَهْرِي"],
  ["BPD", "اضطراب الشخصية الحَدِّيَّة"],
  ["ASD", "اضطراب طيف التوحد"],
  ["CBT", "العلاج المعرفي السلوكي"],
  ["DBT", "العلاج الجدلي السلوكي"],
  ["EMDR", "إزالة الحساسية وإعادة المعالجة بحركات العين"],
  ["SSRI", "مثبطات استرداد السيروتونين الانتقائية"],
  ["SNRI", "مثبطات استرداد السيروتونين والنورأدرينالين"],
  ["DSM-5", "الدليل التشخيصي والإحصائي للاضطرابات النفسية، الطبعة الخامسة"],
  ["DSM-5-TR", "الدليل التشخيصي والإحصائي للاضطرابات النفسية، الطبعة الخامسة المنقحة"],
  ["DSM", "الدليل التشخيصي والإحصائي للاضطرابات النفسية"],
  ["ICD-11", "التصنيف الدولي للأمراض، الطبعة الحادية عشرة"],
  ["ICD-10", "التصنيف الدولي للأمراض، الطبعة العاشرة"],
  ["IQ", "معامل الذكاء"],
  ["PHQ-9", "استبيان صحة المريض تسعة"],
  ["PHQ9", "استبيان صحة المريض تسعة"],
  ["GAD-7", "مقياس اضطراب القلق العام سبعة"],
  ["GAD7", "مقياس اضطراب القلق العام سبعة"],
];

const BY_UPPER = new Map(
  CLINICAL_ABBREVIATION_EXPANSIONS.map(([k, v]) => [k.toUpperCase(), v]),
);

/**
 * Expand whole-token Latin clinical abbreviations inside mixed Arabic text.
 * Leaves unknown Latin tokens untouched (code-switching preserved).
 */
export function expandClinicalAbbreviations(text: string): string {
  return text.replace(/\b([A-Za-z][A-Za-z0-9-]{1,12})\b/g, (raw) => {
    const hit = BY_UPPER.get(raw.toUpperCase());
    return hit ?? raw;
  });
}
