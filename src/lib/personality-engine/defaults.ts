import type { Avatar, AvatarPersonality } from "@/lib/types";
import type { HumanPersonalityProfile } from "./types";

/**
 * Synthesize a minimal but valid human personality from locale AvatarPersonality
 * when no authored profile exists. Deterministic — never calls GPT.
 */
export function synthesizeHumanPersonalityFromAvatar(params: {
  avatar: Avatar;
  personality?: AvatarPersonality | null;
  locale: string;
}): HumanPersonalityProfile {
  const { avatar, locale } = params;
  const p = params.personality;
  const identity = p?.identity;
  const isAr = locale.toLowerCase().startsWith("ar");

  return {
    version: 1,
    avatar_slug: avatar.slug ?? undefined,
    locale,
    temperament: isAr
      ? "مزاج متوازن مع ميل للتحفّظ تحت الضغط."
      : "Even-tempered with a tendency to hold back under stress.",
    attachment_style: "anxious_preoccupied",
    attachment_notes: isAr
      ? "يبني الثقة ببطء؛ حسّاس لدفء المعالج."
      : "Builds trust slowly; sensitive to therapist warmth.",
    intelligence: {
      band: "average",
      strengths: isAr ? ["عملي", "ملاحظة اجتماعية"] : ["practical", "social observation"],
      style: isAr
        ? "يفكّر بأمثلة من الحياة اليومية أكثر من التحليل المجرّد."
        : "Thinks in everyday examples more than abstract analysis.",
    },
    education:
      identity?.education?.trim() ||
      (isAr ? "غير محدّد في الملف" : "Not specified in avatar file"),
    occupation:
      identity?.occupation?.trim() ||
      (isAr ? "غير محدّد" : "Not specified"),
    culture:
      [
        identity?.city,
        identity?.region,
        identity?.country,
        p?.cultural_context?.stigma_framing,
      ]
        .filter(Boolean)
        .join(" · ") || (isAr ? "سياق ثقافي من الشخصية" : "Cultural context from personality"),
    religion:
      p?.cultural_context?.faith_or_meaning_framing?.trim() ||
      (isAr ? "غير مفصّل في الملف" : "Not detailed in avatar file"),
    resilience: 3,
    openness: 3,
    agreeableness: 3,
    conscientiousness: 3,
    neuroticism: 3,
    coping_style: "mixed",
    coping_notes:
      p?.cultural_context?.help_seeking_attitude?.trim() ||
      (isAr
        ? "يخلط بين طلب الدعم والتجنّب حسب الموضوع."
        : "Mixes support-seeking and avoidance depending on topic."),
    humor: "none",
    humor_notes: isAr
      ? "فكاهة قليلة في الجلسة إلا إذا ظهرت طبيعياً."
      : "Little humor in session unless it arises naturally.",
    trust_level: 3,
    trust_notes:
      p?.cultural_context?.authority_orientation?.trim() ||
      (isAr
        ? "ثقة متوسطة؛ يفتح أكثر مع الاحترام وعدم الحكم."
        : "Moderate trust; opens more with respect and non-judgement."),
    emotional_regulation: "mixed",
    emotional_regulation_notes: isAr
      ? "يتقلب بين الكبت والتعبير حسب الأمان في الغرفة."
      : "Oscillates between suppression and expression based on safety in the room.",
    speech_style:
      [
        p?.speech?.register ? `register ${p.speech.register}` : null,
        p?.speech?.pace ? `pace ${p.speech.pace}` : null,
        p?.speech?.turn_length,
      ]
        .filter(Boolean)
        .join("; ") ||
      (isAr ? "كلام يومي قصير" : "Short everyday spoken turns"),
    vocabulary: {
      register: "everyday",
      markers: (p?.speech?.filler_words?.length
        ? p.speech.filler_words
        : isAr
          ? ["يعني", "ما بعرف", "طيب"]
          : ["I mean", "I don't know", "yeah"]
      ).slice(0, 8),
      avoids: isAr
        ? ["محاضرة عن نفسه", "قائمة أعراض"]
        : ["lecturing about self", "symptom checklists"],
    },
    preferred_topics: [
      identity?.occupation
        ? isAr
          ? `العمل (${identity.occupation})`
          : `work (${identity.occupation})`
        : isAr
          ? "اليوميات"
          : "day-to-day life",
      isAr ? "النوم والطاقة" : "sleep and energy",
    ],
    avoidant_topics: [
      ...(p?.cultural_context?.taboo_topics?.length
        ? p.cultural_context.taboo_topics
        : [isAr ? "مواضيع العائلة الحسّاسة" : "sensitive family topics"]),
      isAr ? "المخاطر إلا بسؤال مباشر" : "risk topics unless asked directly",
    ],
    memory_of_therapist: {
      remembers_name: true,
      remembers_prior_sessions: true,
      alliance_sensitivity: 3,
      rupture_style: isAr
        ? "يقصر الإجابات وينسحب قليلاً."
        : "Shortens answers and withdraws slightly.",
      notes: isAr
        ? "يتذكّر نبرة الجلسات السابقة أكثر من التفاصيل الحرفية."
        : "Remembers prior session tone more than verbatim detail.",
    },
    treatment_expectations: isAr
      ? "يتوقّع أن يُسمع باحترام؛ حذر من الوعود الكبيرة."
      : "Expects to be heard respectfully; wary of grand promises.",
    author_notes: "Synthesized fallback — replace with authored human_personality when possible.",
  };
}
