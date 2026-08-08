/**
 * Expand digit patterns for unambiguous Arabic TTS pronunciation.
 *
 * Supported:
 *   digit + unit   → "3 أيام" → "ثلاثة أيام"
 *   percentage     → "10%" → "عشرة بالمئة"
 *   decimal + unit → "1.5 ملغ" → "واحد ونصف ملغ"
 *   clock          → "الساعة 3" → "الساعة الثالثة"
 *   large doses    → "25 ملغ" → "خمسة وعشرون ملغ" / "100 ملغ" → "مئة ملغ"
 *
 * Bare years / phone-like digits without units are left unchanged.
 */

import { normalizeIndicDigitChar, parseDigitRun } from "./detect";

type UnitGender = "m" | "f";

type UnitEntry = {
  keep: string;
  gender: UnitGender;
  dual: string;
};

const UNIT_TABLE: ReadonlyArray<readonly [string, UnitEntry]> = [
  ["دقائق", { keep: "دقائق", gender: "f", dual: "دقيقتين" }],
  ["دقيقة", { keep: "دقيقة", gender: "f", dual: "دقيقتين" }],
  ["ساعات", { keep: "ساعات", gender: "f", dual: "ساعتين" }],
  ["ساعة", { keep: "ساعة", gender: "f", dual: "ساعتين" }],
  ["مرات", { keep: "مرات", gender: "f", dual: "مرتين" }],
  ["مرة", { keep: "مرة", gender: "f", dual: "مرتين" }],
  ["جلسات", { keep: "جلسات", gender: "f", dual: "جلستين" }],
  ["جلسة", { keep: "جلسة", gender: "f", dual: "جلستين" }],
  ["ليالي", { keep: "ليالي", gender: "f", dual: "ليلتين" }],
  ["ليلة", { keep: "ليلة", gender: "f", dual: "ليلتين" }],
  ["أسابيع", { keep: "أسابيع", gender: "m", dual: "أسبوعين" }],
  ["أسبوع", { keep: "أسبوع", gender: "m", dual: "أسبوعين" }],
  ["أشهر", { keep: "أشهر", gender: "m", dual: "شهرين" }],
  ["شهور", { keep: "شهور", gender: "m", dual: "شهرين" }],
  ["شهر", { keep: "شهر", gender: "m", dual: "شهرين" }],
  ["سنوات", { keep: "سنوات", gender: "f", dual: "سنتين" }],
  ["سنين", { keep: "سنين", gender: "f", dual: "سنتين" }],
  ["سنة", { keep: "سنة", gender: "f", dual: "سنتين" }],
  ["أعوام", { keep: "أعوام", gender: "m", dual: "عامين" }],
  ["أعواما", { keep: "أعواما", gender: "m", dual: "عامين" }],
  ["عام", { keep: "عام", gender: "m", dual: "عامين" }],
  ["أيام", { keep: "أيام", gender: "m", dual: "يومين" }],
  ["يوم", { keep: "يوم", gender: "m", dual: "يومين" }],
  ["ساعاتا", { keep: "ساعات", gender: "f", dual: "ساعتين" }],
  ["حبات", { keep: "حبات", gender: "f", dual: "حبتين" }],
  ["حبة", { keep: "حبة", gender: "f", dual: "حبتين" }],
  ["ميلليغرام", { keep: "ميلليغرام", gender: "m", dual: "ميلليغرامين" }],
  ["مليغرام", { keep: "مليغرام", gender: "m", dual: "مليغرامين" }],
  ["ملغ", { keep: "ملغ", gender: "m", dual: "ملغين" }],
  ["بالمئة", { keep: "بالمئة", gender: "m", dual: "بالمئة" }],
];

const UNITS_SORTED = [...UNIT_TABLE].sort((a, b) => b[0].length - a[0].length);

const MASC_1_19 = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
] as const;

const FEM_1_19 = [
  "",
  "واحدة",
  "اثنتان",
  "ثلاث",
  "أربع",
  "خمس",
  "ست",
  "سبع",
  "ثماني",
  "تسع",
  "عشر",
  "إحدى عشرة",
  "اثنتا عشرة",
  "ثلاث عشرة",
  "أربع عشرة",
  "خمس عشرة",
  "ست عشرة",
  "سبع عشرة",
  "ثماني عشرة",
  "تسع عشرة",
] as const;

const TENS_M = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
] as const;

/** Feminine ordinals 1–12 for clock hours. */
const HOUR_ORDINAL: Record<number, string> = {
  1: "الواحدة",
  2: "الثانية",
  3: "الثالثة",
  4: "الرابعة",
  5: "الخامسة",
  6: "السادسة",
  7: "السابعة",
  8: "الثامنة",
  9: "التاسعة",
  10: "العاشرة",
  11: "الحادية عشرة",
  12: "الثانية عشرة",
};

function cardBelow100(n: number, gender: UnitGender): string {
  if (n <= 0 || n > 99) return String(n);
  if (n < 20) {
    if (n >= 3 && n <= 10) {
      return gender === "m" ? MASC_1_19[n]! : FEM_1_19[n]!;
    }
    return gender === "m" ? MASC_1_19[n]! : FEM_1_19[n]!;
  }
  const ones = n % 10;
  const tens = Math.floor(n / 10);
  if (ones === 0) return TENS_M[tens]!;
  const oneWord =
    gender === "m"
      ? ones === 1
        ? "واحد"
        : ones === 2
          ? "اثنان"
          : MASC_1_19[ones]!
      : ones === 1
        ? "واحدة"
        : ones === 2
          ? "اثنتان"
          : FEM_1_19[ones]!;
  return `${oneWord} و${TENS_M[tens]}`;
}

function cardUpTo999(n: number, gender: UnitGender): string | null {
  if (n <= 0 || n > 999) return null;
  if (n < 100) return cardBelow100(n, gender);
  if (n === 100) return "مئة";
  if (n < 200) return `مئة و${cardBelow100(n - 100, gender)}`;
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hundWord =
    hundreds === 2 ? "مئتان" : `${MASC_1_19[hundreds]} مئة`;
  if (rest === 0) return hundWord;
  return `${hundWord} و${cardBelow100(rest, gender)}`;
}

function spokenForUnit(n: number, unit: UnitEntry): string | null {
  if (n === 0) return `صفر ${unit.keep}`;
  if (n === 1) {
    const one = unit.gender === "m" ? "واحد" : "واحدة";
    return `${unit.keep} ${one}`;
  }
  if (n === 2) return unit.dual;
  if (n >= 3 && n <= 999) {
    const card = cardUpTo999(n, unit.gender);
    return card ? `${card} ${unit.keep}` : null;
  }
  return null;
}

function findUnit(rest: string): { entry: UnitEntry; length: number } | null {
  const trimmed = rest.replace(/^\s+/, "");
  const leadWs = rest.length - trimmed.length;
  for (const [surface, entry] of UNITS_SORTED) {
    if (trimmed.startsWith(surface)) {
      const after = trimmed.slice(surface.length);
      if (after === "" || !/^[\u0600-\u06FF]/.test(after)) {
        return { entry, length: leadWs + surface.length };
      }
    }
  }
  return null;
}

function parseDecimalRun(run: string): number | null {
  const western = [...run].map(normalizeIndicDigitChar).join("");
  if (!/^\d+(\.\d+)?$/.test(western)) return null;
  const n = Number(western);
  return Number.isFinite(n) ? n : null;
}

function spokenHalf(integer: number, gender: UnitGender): string {
  if (integer === 0) return "نصف";
  if (integer === 1) {
    return gender === "m" ? "واحد ونصف" : "واحدة ونصف";
  }
  const card = cardUpTo999(integer, gender);
  return card ? `${card} ونصف` : `${integer} ونصف`;
}

export type ExpandableNumberMatch = {
  surface: string;
  start: number;
  end: number;
  spoken: string;
};

function pushMatch(
  matches: ExpandableNumberMatch[],
  text: string,
  start: number,
  end: number,
  spoken: string,
) {
  if (start < 0 || end <= start || end > text.length) return;
  if (matches.some((m) => !(end <= m.start || start >= m.end))) return;
  matches.push({ surface: text.slice(start, end), start, end, spoken });
}

/** Identify number spans that should be spoken as words. */
export function findExpandableNumberMatches(
  text: string,
): ExpandableNumberMatch[] {
  const matches: ExpandableNumberMatch[] = [];

  // الساعة N → الساعة <ordinal>
  const clockRe = /الساعة\s*([0-9\u0660-\u0669]{1,2})/g;
  let cm: RegExpExecArray | null;
  while ((cm = clockRe.exec(text)) !== null) {
    const n = parseDigitRun(cm[1]!);
    if (n === null || n < 1 || n > 12) continue;
    const ordinal = HOUR_ORDINAL[n];
    if (!ordinal) continue;
    pushMatch(matches, text, cm.index, cm.index + cm[0].length, `الساعة ${ordinal}`);
  }

  // N% / N٪
  const pctRe = /([0-9\u0660-\u0669]+)\s*[%٪]/g;
  let pm: RegExpExecArray | null;
  while ((pm = pctRe.exec(text)) !== null) {
    const n = parseDigitRun(pm[1]!);
    if (n === null || n > 100) continue;
    const card = cardUpTo999(n, "m");
    if (!card) continue;
    pushMatch(
      matches,
      text,
      pm.index,
      pm.index + pm[0].length,
      `${card} بالمئة`,
    );
  }

  // Decimal or integer + unit (including ملغ doses)
  const numRe = /([0-9\u0660-\u0669]+(?:[.][0-9\u0660-\u0669]+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(text)) !== null) {
    const run = m[1]!;
    const start = m.index;
    const afterIdx = start + run.length;
    // Skip if already claimed (clock / percent)
    if (matches.some((x) => start >= x.start && start < x.end)) continue;

    const unitHit = findUnit(text.slice(afterIdx));
    if (!unitHit) continue;

    const end = afterIdx + unitHit.length;
    if (matches.some((x) => !(end <= x.start || start >= x.end))) continue;

    if (run.includes(".") || /[٠-٩]\.[٠-٩]/.test(run) || run.includes("٫")) {
      const n = parseDecimalRun(run.replace("٫", "."));
      if (n === null) continue;
      const int = Math.floor(n);
      const frac = n - int;
      if (Math.abs(frac - 0.5) < 1e-9) {
        const spoken = `${spokenHalf(int, unitHit.entry.gender)} ${unitHit.entry.keep}`;
        pushMatch(matches, text, start, end, spoken);
      }
      // other decimals: leave unchanged (avoid inventing awkward speech)
      continue;
    }

    const n = parseDigitRun(run);
    if (n === null) continue;
    const spoken = spokenForUnit(n, unitHit.entry);
    if (!spoken) continue;
    pushMatch(matches, text, start, end, spoken);
    numRe.lastIndex = end;
  }

  return matches.sort((a, b) => a.start - b.start);
}

export function expandArabicNumbers(text: string): string {
  const hits = findExpandableNumberMatches(text);
  if (hits.length === 0) return text;
  let out = text;
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i]!;
    out = out.slice(0, h.start) + h.spoken + out.slice(h.end);
  }
  return out;
}
