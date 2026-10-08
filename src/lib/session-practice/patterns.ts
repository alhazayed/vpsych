/**
 * Bilingual (English + Arabic, Levantine and MSA) cue patterns for observable
 * therapist practices. Patterns match the therapist's own turns only.
 *
 * Arabic has no reliable \b word boundary in JS regex, so Arabic cues are
 * plain substrings chosen to be specific enough on their own.
 *
 * `arabic` holds further cues written in normalized spelling (see
 * `normalizeArabic`: no diacritics, bare alef, ه for ة, ي for ى), matched
 * against the normalized turn so typed and transcribed spelling variants
 * ("اسبوعك" / "أسبوعك", "الجلسة" / "الجلسه") both count.
 */

import type { PracticeCheckId, PracticeGroup } from "@/lib/session-practice/types";

export type PracticeWindow = "opening" | "closing" | "any";

export type PracticePattern = {
  id: PracticeCheckId;
  group: PracticeGroup;
  window: PracticeWindow;
  pattern: RegExp;
  /** Extra Arabic cues in normalized spelling, tested against `normalizeArabic(turn)`. */
  arabic?: RegExp;
};

/** Fold common Arabic spelling variants so cues match typed and transcribed text. */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0670\u0640]/gu, "")
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/ة/gu, "ه")
    .replace(/ى/gu, "ي")
    .replace(/ؤ/gu, "و")
    .replace(/ئ/gu, "ي");
}

/** True when the turn shows this practice (raw cues, then normalized Arabic cues). */
export function matchesPractice(p: PracticePattern, turn: string): boolean {
  if (p.pattern.test(turn)) return true;
  return p.arabic ? p.arabic.test(normalizeArabic(turn)) : false;
}

export const PRACTICE_PATTERNS: readonly PracticePattern[] = [
  // ── Intake ────────────────────────────────────────────────────────────
  {
    id: "role_intro",
    group: "intake",
    window: "opening",
    pattern:
      /my name is|i'?m (dr\.?|doctor) |(this|it)'?s? (is )?(dr\.?|doctor) |(dr\.?|doctor) \w+ (here|speaking)|\w+,? (your|the) (therapist|psycholog|counsel|clinician)|you can call me|i'?ll be your|i am (a|your) (therapist|psycholog|psychiatr|counsel|clinician|doctor)|i'?m (a|your) (therapist|psycholog|psychiatr|counsel|clinician)|اسمي|أنا الدكتور|انا الدكتور|أنا الدكتورة|انا الدكتورة|أنا المعالج|انا المعالج|أنا الأخصائي|انا الاخصائي/iu,
    arabic:
      /انا (اسمي|المعالج|الدكتور|الاخصائي|المختص|معالجك|معالجتك|المرشد)|معك (الدكتور|المعالج|الاخصائي)|رح اكون (معالجك|معالجتك)/u,
  },
  {
    id: "presenting_problem",
    group: "intake",
    window: "any",
    pattern:
      /what brings you|what brought you|what('?s| has) been (going on|troubling you|bothering you)|how can i help|tell me (a bit |a little )?about what|شو اللي جابك|شو جابك|ايش اللي جابك|ما الذي جاء بك|شو صاير معك|كيف بقدر اساعدك|كيف بقدر أساعدك|كيف أقدر أساعدك/iu,
    arabic:
      /(شو|ايش|ما) (اللي )?(جابك|جاء بك|دفعك|خلاك تيجي)|شو (صاير|عم يصير) معك|(كيف|بشو) (بقدر|اقدر|ممكن) (اساعدك|اخدمك)|احكيلي (شو|عن)|ما الذي يزعجك/u,
  },
  {
    id: "history",
    group: "intake",
    window: "any",
    pattern:
      /when did (this|it|that|these|you first)|how long (has|have|did)|(first|ever) (start|notice|began|felt)|happened before|in the past|أول مرة|اول مرة|من قديش|من متى|من إيمتى|من امتى|قديش صارلك|كم صار لك|قبل هيك|من زمان/iu,
    arabic:
      /(اول|اخر) مره|من (قديش|متي|امتي|ايمتي|وقتيش)|قديش (صارلك|صار لك)|كم (صارلك|صار لك|مده)|قبل هيك|من زمان|بدايه (المشكله|الاعراض)/u,
  },
  {
    id: "social_context",
    group: "intake",
    window: "any",
    pattern:
      /who (do you live|lives) |live with|liv(e|ing) (alone|by yourself|on your own)|your (family|wife|husband|partner|kids|children|parents|friends|job|work)|anyone you can talk to|عيلتك|عائلتك|أهلك|اهلك|مين ساكن معك|مع مين ساكن|شغلك|عملك|زوجك|زوجتك|أصحابك|اصحابك|ولادك|أولادك/iu,
    arabic:
      /عيلتك|عايلتك|اهلك|(بتشتغل|بتشتغلي|شو بتشتغل|وين بتشتغل|بتدرس|بتدرسي)|(متزوج|متزوجه|مرتبط|مرتبطه|مخطوب|مخطوبه)|(مين|مع مين) (ساكن|ساكنه|عايش|عايشه)|(ساكن|ساكنه|عايش|عايشه) (لحالك|لوحدك|بحالك)|(في|فيه) معك حدا|حدا (ساكن|عايش) معك|شغلك|عملك|وظيفتك|زوجك|زوجتك|اصحابك|اصدقاوك|اصدقائك|ولادك|اولادك/u,
  },
  {
    id: "expectations",
    group: "intake",
    window: "any",
    pattern:
      /hop(e|ing) (to get|for|from|to change)|what would you like (to get|from|to change)|what do you want (to get|from|to change)|your goals?|what would (be different|change)|شو بتتمنى|شو بتتوقع|ايش بتتوقع|شو هدفك|شو أهدافك|شو اهدافك|شو بدك توصل|شو حابب يتغير/iu,
    arabic:
      /(شو|ايش|ماذا) (بتتمني|بتتوقع|تتوقع|تتمني|هدفك|اهدافك|بدك توصل|حابب يتغير|حابه يتغير|بدك يتغير)|اهدافك|توقعاتك/u,
  },
  // ── Consent and confidentiality ───────────────────────────────────────
  {
    id: "confidentiality",
    group: "consent",
    window: "any",
    pattern:
      /confidential|stays? (between us|in this room)|kept private|سرّي|سري|سرية|سرّية|بيضل بيننا|بضل بيننا|بتضل بيننا/iu,
    arabic:
      /سري|سريه|(بيضل|بضل|بتضل|يبقي|سيبقي) (بيننا|بينا)|خصوصيتك/u,
  },
  {
    id: "confidentiality_limits",
    group: "consent",
    window: "any",
    pattern:
      /(limits? (of|to)|except|exception|unless).{0,60}(confidential|safety|harm|risk|danger)|(harm|hurt) (yourself|someone|others).{0,60}(share|tell|inform|break|contact)|حدود السرية|(إلا|الا) (إذا|اذا|في حال).{0,60}(خطر|تأذي|أذى|اذى|سلامت)/iu,
    arabic:
      /حدود السريه|(الا|ماعدا|باستثناء) (اذا|في حال|لو).{0,60}(خطر|تاذي|اذي|سلامت|حياتك)/u,
  },
  {
    id: "consent_to_proceed",
    group: "consent",
    window: "opening",
    pattern:
      /(is that|does that sound) (ok|okay|alright|all right)|any questions (before|about)|do you have (any )?questions|are you (ok|okay|comfortable) (with|to)|your (consent|permission)|موافق|موافقة|عندك أي سؤال|عندك اي سؤال|مرتاح نكمل|مرتاحة نكمل/iu,
    arabic:
      /موافق|موافقه|عندك (اي )?(سوال|اسئله)|(مرتاح|مرتاحه) (نكمل|نبلش|نبدا)|(بنبلش|نبلش|نبدا)[؟?]|بتسمحلي|اذا بتسمح/u,
  },
  // ── Session structure ─────────────────────────────────────────────────
  {
    id: "mood_check",
    group: "structure",
    window: "opening",
    pattern:
      /how (have|has) (you|your mood|things) been|how are you (feeling|doing)|how('?s| is| has| was) (your|the) (week|mood)|كيف كان أسبوعك|كيف كان اسبوعك|كيف كان مزاجك|كيف مزاجك|كيف حالك اليوم|كيف كانت الأيام|كيف حاسس|كيف حاسة/iu,
    arabic:
      /كيفك|كيف حالك|كيف الحال|كيف (مزاجك|نفسيتك|صحتك)|شو (اخبارك|اخبار)|كيف (كان|مر|مرق) (اسبوعك|الاسبوع|يومك|اليوم)|كيف (كانت|مرت) (الايام|الفتره|ايامك)|كيف (بتحس|بتحسي|حاسس|حاسه|تشعر|تشعرين|صرت|صار حالك)/u,
  },
  {
    id: "bridge",
    group: "structure",
    window: "opening",
    pattern:
      /last (time|session|week)|since (we|our) (last|met|spoke)|previous session|(we|you) (talked|spoke) about|المرة الماضية|الجلسة الماضية|آخر مرة|اخر مرة|الجلسة اللي فاتت|المرة اللي فاتت/iu,
    arabic:
      /(الجلسه|المره) (الماضيه|السابقه|الفايته|اللي فاتت)|اخر (مره|جلسه)|(حكينا|تحدثنا|تكلمنا) (عن|المره|بالجلسه|في الجلسه)|اتفقنا (المره|بالجلسه|في الجلسه|علي)|من (اخر|اخر ما) (جلسه|التقينا|شفتك)/u,
  },
  {
    id: "agenda",
    group: "structure",
    window: "opening",
    pattern:
      /agenda|what (would|do) you (like|want) (us )?to (talk|focus|cover|work) (about |on )?today|(focus|work) on today|plan for (today|this session)|today i('?d| would) like (us )?to|شو حابب نحكي اليوم|شو حابة نحكي اليوم|شو بدك نحكي فيه اليوم|خطة الجلسة|اليوم رح نركز|خلينا نحدد شو/iu,
    arabic:
      /(شو|ايش|ماذا|عن شو) (حابب|حابه|بدك|تحب|تحبي|تريد|تريدين|بتحب|بتحبي) (نحكي|نتكلم|نتحدث|نركز|نشتغل)|(خطه|جدول|اجنده) (الجلسه|اليوم|اعمال)|اليوم (رح|راح|سوف|بدنا|خلينا) (نركز|نحكي|نشتغل|نتكلم)|خلينا نحدد|نحدد (شو|ايش|المواضيع)|نتفق (علي|شو) (المواضيع|نحكي)/u,
  },
  {
    id: "homework_review",
    group: "structure",
    window: "opening",
    pattern:
      /(how did|how was|did you (get a chance|manage|try)).{0,40}(homework|exercise|task|practice|diary|log|record|worksheet)|كيف كان الواجب|عملت الواجب|عملتي الواجب|جربت التمرين|جرّبت التمرين|كيف كان التمرين/iu,
    arabic:
      /(عملت|عملتي|سويت|سويتي|جربت|جربتي|قدرت|قدرتي|طبقت|طبقتي|كملت|كملتي).{0,30}(الواجب|التمرين|المهمه|السجل|الجدول|المذكره|اللي اتفقنا)|كيف (كان|كانت|مشي|زبط) (الواجب|التمرين|المهمه)|(الواجب|التمرين|المهمه) (اللي|الذي) (اتفقنا|اعطيتك|حكينا)/u,
  },
  {
    id: "homework_set",
    group: "structure",
    window: "closing",
    pattern:
      /homework|between (now and|sessions)|before (we meet again|our next|the next session)|(would you be willing|could you|can you) (try|practi[cs]e|keep a|write down|notice|track)|this week.{0,40}(try|practi[cs]e|write|notice|track)|خلال الأسبوع|خلال هالأسبوع|خلال هالاسبوع|لحد الجلسة الجاية|قبل الجلسة الجاية|بين الجلسات|واجب|تمرين للبيت/iu,
    arabic:
      /(هالاسبوع|هذا الاسبوع|خلال الاسبوع|الاسبوع الجاي|الاسبوع القادم|لحد ما نلتقي|قبل ما نلتقي).{0,50}(تجرب|تجربي|تكتب|تكتبي|تلاحظ|تلاحظي|تسجل|تسجلي|تمارس|تتمرن|تطبق|تطبقي)|(مهمه|تمرين|واجب) (للبيت|بيتي|بيتيه)|واجب|(بتقدر|بتقدري|ممكن|هل يمكنك) (تجرب|تجربي|تكتب|تكتبي|تسجل|تسجلي|تلاحظ|تلاحظي|تطبق|تطبقي)/u,
  },
  {
    id: "summary",
    group: "structure",
    window: "closing",
    pattern:
      /summari[sz]e|let me (sum|recap)|recap|to sum up|so today we|we covered|ملخص|نلخص|خلينا نلخص|يعني اليوم حكينا|اليوم حكينا عن|باختصار/iu,
    arabic:
      /ملخص|نلخص|الخص|بلخص|خلاصه|باختصار|(اليوم|بجلسه اليوم) (حكينا|تحدثنا|تكلمنا|ناقشنا)|(حكينا|تحدثنا|تكلمنا|ناقشنا) اليوم/u,
  },
  {
    id: "feedback_elicited",
    group: "structure",
    window: "closing",
    pattern:
      /how (was|did) (this|today'?s?|the) session|how did (that|today|this) (feel|go) for you|any feedback|what was (helpful|unhelpful|useful)|anything (i said|i did|about today) that|كيف كانت الجلسة|شو كان مفيد|شو اللي ساعدك اليوم|في إشي ضايقك|في اشي ضايقك|رأيك بالجلسة|رأيك بجلسة اليوم/iu,
    arabic:
      /كيف (كانت|لقيت|وجدت|شفت|حسيت) (الجلسه|جلسه اليوم|بالجلسه)|رايك (بالجلسه|في الجلسه|بجلسه اليوم)|(شو|ايش|ما) (كان|اللي كان|الذي كان) مفيد|(شو|ايش) (ساعدك|استفدت)|في (اشي|شي) (ضايقك|ما عجبك|بدك تغيره)|ملاحظات(ك)? علي الجلسه/u,
  },
  // ── Safety planning (Stanley-Brown) ───────────────────────────────────
  {
    id: "warning_signs",
    group: "safety_plan",
    window: "any",
    pattern:
      /warning signs?|early signs|(what|which) (thoughts|feelings|situations).{0,30}(before|lead|trigger)|علامات الخطر|علامات التحذير|إشارات التحذير|اشارات التحذير/iu,
    arabic:
      /علامات (الخطر|التحذير|الانذار)|اشارات (الخطر|التحذير|الانذار)|(شو|ايش|ما) (اللي|الذي) (بيصير|بتحس|بتحسي|تشعر|بتلاحظ|بتلاحظي|بيسبق).{0,30}(قبل|لما)|(بتعرف|كيف بتعرف) (انك|انو) (رح|راح) (تتعب|تنهار)/u,
  },
  {
    id: "internal_coping",
    group: "safety_plan",
    window: "any",
    pattern:
      /what (can|could) you do (on your own|by yourself|to (distract|cope|calm))|coping (strateg|skill)|distract yourself|calm yourself|شو بتقدر تعمل لحالك|شو بتقدري تعملي لحالك|تلهي حالك|تهدّي حالك|تهدي حالك|طرق التأقلم/iu,
    arabic:
      /(شو|ايش|ماذا) (بتقدر|بتقدري|تقدر|تستطيع|ممكن) (تعمل|تعملي|تسوي|تسويي|تفعل).{0,20}(لحالك|بنفسك|وحدك|لتهدي|لتهدا|عشان تهدا)|(تلهي|تشغل|تهدي|تهدا) (حالك|نفسك|بالك)|طرق (التاقلم|التكيف|التعامل)|شو (بيساعدك|بيهديك|بريحك)/u,
  },
  {
    id: "social_supports",
    group: "safety_plan",
    window: "any",
    pattern:
      /(who|someone|anyone) (could|can|would) you (call|reach|contact|be with|talk to)|(friend|family member) you (could|can) (call|reach)|مين ممكن تحكي معه|مين بتقدر تحكي معه|مين بتقدر تتصل|حدا تحكي معه|حدا بتقدر تتصل/iu,
    arabic:
      /(مين|من) (ممكن|بتقدر|بتقدري|تقدر|تستطيع|يمكن) (تحكي|تحكيلو|تحكيله|تتصل|تتواصل|تلجا|يكون معك|يضل معك|تكلم)|(حدا|شخص|احد) (تحكي|تثق|بتثق|تتصل|تلجا|يكون معك|يضل معك)|(بتقدر|ممكن) (تحكي|تتصل) (لاهلك|مع اهلك|لصاحبك|باهلك)/u,
  },
  {
    id: "professional_contacts",
    group: "safety_plan",
    window: "any",
    pattern:
      /crisis (line|team|service|number)|hotline|helpline|emergency (room|department|services|number)|call (911|999|112)|خط الأزمات|خط المساعدة|خط الطوارئ|رقم الطوارئ|قسم الطوارئ|اتصل بالطوارئ/iu,
    arabic:
      /خط (الازمات|المساعده|الطوارئ|الدعم|الساخن)|رقم (الطوارئ|الازمات|المساعده)|(قسم|غرفه) الطوارئ|الطوارئ|طبيب نفسي|الطبيب النفسي|طبيبك|دكتورك|الطبيب المعالج|911|999|112/u,
  },
  {
    id: "means_safety",
    group: "safety_plan",
    window: "any",
    pattern:
      /(access to|keep|store|remove|lock|get rid of|hold on to).{0,40}(pills|medication|tablets|knife|knives|gun|firearm|rope|weapon)|means (restriction|safety)|(الأدوية|الحبوب|الدوا|السكاكين|السلاح).{0,40}(بعيد|تشيل|نشيل|مقفل|مسكر)|(تشيل|نشيل|نبعد|تبعد).{0,40}(الأدوية|الحبوب|الدوا|السكاكين|السلاح)/iu,
    arabic:
      /(الادويه|الحبوب|الدوا|الدواء|السكاكين|السكينه|السلاح|الحبل).{0,40}(بعيد|تشيل|نشيل|مقفل|مسكر|تقفل|نقفل|تعطي|نعطي|نخبي|تخبي|تتخلص)|(تشيل|نشيل|نبعد|تبعد|تقفل|نقفل|تعطي|نعطي|تخبي|نخبي|تتخلص من).{0,40}(الادويه|الحبوب|الدوا|الدواء|السكاكين|السلاح|الحبل)|(عندك|في عندك|في بالبيت|بتقدر توصل).{0,20}(ادويه|حبوب|سلاح|سكاكين)/u,
  },
  // ── Standardised measures ─────────────────────────────────────────────
  {
    id: "phq9",
    group: "measures",
    window: "any",
    pattern:
      /phq-?9|phq ?nine|patient health questionnaire|little interest or pleasure in doing things|استبيان صحة المريض|قلة الاهتمام أو المتعة|قلة الاهتمام او المتعة/iu,
  },
  {
    id: "gad7",
    group: "measures",
    window: "any",
    pattern:
      /gad-?7|gad ?seven|generali[sz]ed anxiety disorder (scale|questionnaire)|nervous, anxious,? or on edge|stop or control worrying|مقياس القلق العام|بالعصبية أو القلق|التوقف عن القلق/iu,
  },
];
