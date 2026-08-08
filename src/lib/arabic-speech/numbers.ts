/**
 * Expand digit + Arabic unit patterns for unambiguous TTS pronunciation.
 * Examples:
 *   "3 أيام" → "ثلاثة أيام"
 *   "2 مرات" → "مرتين"
 *   "10 دقائق" → "عشر دقائق"
 */

import { parseDigitRun } from "./detect";

type UnitGender = "m" | "f";

type UnitEntry = {
  /** Canonical unit form kept after the spoken number (or dual alone). */
  keep: string;
  gender: UnitGender;
  /** Spoken dual form when n === 2 (replaces number + unit). */
  dual: string;
};

/**
 * Unit stems → gender + dual. Matching is case-sensitive Arabic.
 * Prefer longer surface forms first via Map insertion + sort at build.
 */
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
];

const UNITS_SORTED = [...UNIT_TABLE].sort((a, b) => b[0].length - a[0].length);

/** 1–19 cardinal forms. Index = value. Gender = form agreeing with counted noun rules for 3–10. */
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

function cardBelow100(n: number, gender: UnitGender): string {
  if (n <= 0 || n > 99) return String(n);
  if (n < 20) {
    // 3–10: number takes opposite gender of the counted noun.
    if (n >= 3 && n <= 10) {
      return gender === "m" ? MASC_1_19[n]! : FEM_1_19[n]!;
    }
    // 1, 2, 11–19: same gender as noun (simplified clinical TTS).
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

function spokenForUnit(n: number, unit: UnitEntry): string | null {
  if (n === 0) return `صفر ${unit.keep}`;
  if (n === 1) {
    // Noun + "واحد/واحدة" — clear for TTS without inventing content.
    const one = unit.gender === "m" ? "واحد" : "واحدة";
    return `${unit.keep} ${one}`;
  }
  if (n === 2) return unit.dual;
  if (n >= 3 && n <= 99) {
    return `${cardBelow100(n, unit.gender)} ${unit.keep}`;
  }
  // 100+ — leave digits (years / large doses often intentional as numerals).
  return null;
}

function findUnit(rest: string): { entry: UnitEntry; length: number } | null {
  const trimmed = rest.replace(/^\s+/, "");
  const leadWs = rest.length - trimmed.length;
  for (const [surface, entry] of UNITS_SORTED) {
    if (trimmed.startsWith(surface)) {
      const after = trimmed.slice(surface.length);
      // Unit must end or be followed by non-Arabic-letter (punctuation/space).
      if (after === "" || !/^[\u0600-\u06FF]/.test(after)) {
        return { entry, length: leadWs + surface.length };
      }
    }
  }
  return null;
}

/**
 * Expand patterns like `3 أيام`, `٢ مرات`, `10دقائق` when a known unit follows.
 * Leaves bare numbers (years, doses without units, phone fragments) unchanged.
 */
export function expandArabicNumbers(text: string): string {
  const digitRun = /([0-9\u0660-\u0669]+)/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = digitRun.exec(text)) !== null) {
    const run = m[1]!;
    const start = m.index;
    out += text.slice(last, start);
    const n = parseDigitRun(run);
    const afterIdx = start + run.length;
    const unitHit = n !== null ? findUnit(text.slice(afterIdx)) : null;
    if (n !== null && unitHit) {
      const spoken = spokenForUnit(n, unitHit.entry);
      if (spoken) {
        out += spoken;
        last = afterIdx + unitHit.length;
        digitRun.lastIndex = last;
        continue;
      }
    }
    out += run;
    last = afterIdx;
  }
  out += text.slice(last);
  return out;
}
