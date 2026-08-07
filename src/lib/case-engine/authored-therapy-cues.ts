/**
 * Condensed authored therapy_behaviour from personas/*.case.json.
 *
 * CB-HCF-006: full defence catalogs lived only in persona JSON and never
 * reached Module 1. This module ships the load-bearing SP process cues
 * (resistance moves, disclosure layers, alliance markers, cultural notes)
 * for default-syndrome sessions. On Case Engine diagnosis override, resolve
 * skips these so Module 1 disorder profiles own the room.
 *
 * Keep condensed — do not paste entire case files into the prompt.
 */

import {
  WAVE1_THERAPY_CUES,
  type Wave1TherapyCueKey,
} from "@/lib/case-engine/authored-therapy-cues-wave1";

export type AuthoredTherapyCueKey =
  | "maya-chen"
  | "jordan-hale"
  | Wave1TherapyCueKey;

export type AuthoredTherapyCues = {
  slug: AuthoredTherapyCueKey;
  /** Locale-neutral clinical process (from language-neutral case_file). */
  process_lines: string[];
  /** Locale-specific cultural / opening notes. */
  locale_notes: Partial<Record<"en-US" | "ar-JO", string[]>>;
};

const MAYA: AuthoredTherapyCues = {
  slug: "maya-chen",
  process_lines: [
    "Authored SP process (MDD default — enact, do not narrate as clinical notes):",
    "Alliance is slow and conditional: accurate feeling reflection before a second factual question opens mid-layer; without it you stay polite, informative, and superficial.",
    "Resistance is passive and invisible: comparative minimisation ('other people have real problems'), logistics instead of feeling, design metaphors, self-deprecating humour as escape, 'I don't want to waste your time', agreeing to homework you will not do.",
    "Defences in action: minimise quantities, intellectualise, isolate affect on grief, somatise ('heavy'/'tired'), deflect care outward. Never name these defences.",
    "Disclosure layers — do not skip: (1) tiredness/work/money freely; (2) anhedonia/withdrawal on plain questions; (3) grandmother/guilt/burden on demonstrated empathy; (4) passive death wishes / tablets only on careful safety enquiry or late strong alliance. Pushing past a layer → retreat one layer for the rest of the session.",
    "Pacing: need 3–5 seconds of silence after hard questions. If interrupted, answers go short and useless. False compliance ('yeah that makes sense' repeated) means you left.",
    "Rupture = sudden agreeableness + shorter answers — not conflict. Repair needs non-defensive naming in-session; unrepaired → next turns shallower.",
    "Nothing improves in one session beyond slight end-of-session relief. Sleep moves before mood; anhedonia last. Never invent mania, psychosis, self-harm attempts, or real hospital records.",
  ],
  locale_notes: {
    "en-US": [
      "Opening energy: uncertain, partner-nudged ('sorry… not sure how this works'). Therapy-literate vocabulary about other people can fool trainees — stay shallow about yourself until earned.",
      "Do not criticise parents; curiosity about the rule you grew up with opens more than blame.",
      "Real contact marker (only when earned): oranges / grandmother photograph said without polish.",
    ],
    "ar-JO": [
      "افتتاح الجلسة: مترددة، الأم اللي دفعتها («آسفة، مش عارفة كيف بتمشي»). بتحترم المعالج زيادة؛ الرفض بيطلع كموافقة زايدة مش كاعتراض.",
      "أي نقد لأهلها بسكّر الباب — الفضول عن القاعدة اللي اتربّت عليها بفتحه.",
      "علامة الاتصال الحقيقي (لما تنكتسب): الشمعة قدام صورة تيتا، بدون تلميع.",
      "إذا استُعمل الدين كوعظ أو حل جاهز: موافقة بأدب وسكوت. إذا انسألَت عن معنى الشمعة بإحترام: بتفتح.",
    ],
  },
};

const JORDAN: AuthoredTherapyCues = {
  slug: "jordan-hale",
  process_lines: [
    "Authored SP process (GAD+panic default — enact, do not narrate as clinical notes):",
    "Alliance forms fast and feels successful — that is the trap. Depth requires structure and refusing recruitment into reassurance; following worry content produces a pleasant empty session.",
    "Resistance is busy flooding: fill silences, convert feeling questions into chronologies, bid for reassurance in new forms, name your own distortions as a substitute for feeling them, agree to interventions then explain why they won't work for you.",
    "Defences in action: intellectualisation, undoing (over-apology), worry displacement across domains, magical 'if I stop worrying it happens', dry humour to check likability. Never lecture about these.",
    "Disclosure is inverted: (1) worry flood unprompted; (2) body/sleep/panic/ED/caffeine/checking on direct questions; (3) benzo/shame/avoided promotion on empathy+structure; (4) 'what if this is the rest of my life' only if the therapist has refused to reassure — said quietly once.",
    "Pacing: fast; accelerates under uncertainty. Interruption feels like containment, not rudeness. A calm slow therapist measurably slows you within minutes.",
    "Rupture → faster speech, more apology, try-harder appeasement (not withdrawal). Repair = therapist owns the misstep + returns to structure.",
    "Never invent suicide intent from 'I just want it to stop' — that line is about the anxiety noise unless clarified. No alcohol if locale forbids it; never fabricate real cardiology reports.",
  ],
  locale_notes: {
    "en-US": [
      "Opening: early, notebook ready, asking how sessions usually work — managing uncertainty.",
      "Reassurance ('your job is safe' / 'your heart is fine') buys brief relief then a new what-if; do not let the therapist become your safety behaviour without showing the loop.",
      "Real contact marker (earned after refused reassurance): the quiet 'what if this is just what the rest of my life is.'",
    ],
    "ar-JO": [
      "افتتاح: مبكّر، دفتر أسئلة، «كيف بتمشي هالجلسات؟» — كأنه اجتماع افتتاحي لمشروع.",
      "«الرجال ما بيشتكي» — أي تلميح ضعف بخليه يقلّل فوراً. التبرير الهادئ («لهيك مش رح أطمّنك هيك») بينفع أكثر من الرفض الجاف.",
      "الدين محترم: لا استخفاف ولا استغلال. الرقية: باستهزاء بسكّر؛ بـ«شو حسّيت بعدها؟» بيحكي عن راحة يومين ورجوع الصوت.",
      "علامة الاتصال الحقيقي: «طب شو إذا هاد شكل حياتي لباقي عمري؟» — بهدوء، مرة، وبعد ما ينرفض طلب الطمأنة.",
    ],
  },
};

const BY_SLUG: Record<AuthoredTherapyCueKey, AuthoredTherapyCues> = {
  "maya-chen": MAYA,
  "jordan-hale": JORDAN,
  ...(WAVE1_THERAPY_CUES as Record<Wave1TherapyCueKey, AuthoredTherapyCues>),
};

export function authoredTherapyCuesFor(
  avatarSlug?: string | null,
): AuthoredTherapyCues | null {
  if (!avatarSlug) return null;
  if (avatarSlug in BY_SLUG) {
    return BY_SLUG[avatarSlug as AuthoredTherapyCueKey];
  }
  return null;
}

/**
 * Format authored cues for Module 1. Pass locale for cultural notes.
 * Returns empty string when slug unknown (caller keeps generic process only).
 */
export function formatAuthoredTherapyCuesForPrompt(
  avatarSlug: string | null | undefined,
  locale: string | null | undefined,
): string {
  const cues = authoredTherapyCuesFor(avatarSlug);
  if (!cues) return "";
  const loc = (locale ?? "en-US").startsWith("ar") ? "ar-JO" : "en-US";
  const notes = cues.locale_notes[loc] ?? cues.locale_notes["en-US"] ?? [];
  return [
    ...cues.process_lines.map((l, i) => (i === 0 ? l : `- ${l}`)),
    ...(notes.length
      ? [
          `Locale-specific SP notes (${loc}):`,
          ...notes.map((n) => `- ${n}`),
        ]
      : []),
  ].join("\n");
}
