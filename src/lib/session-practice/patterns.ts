/**
 * Bilingual (English + Arabic, Levantine and MSA) cue patterns for observable
 * therapist practices. Patterns match the therapist's own turns only.
 *
 * Arabic has no reliable \b word boundary in JS regex, so Arabic cues are
 * plain substrings chosen to be specific enough on their own.
 */

import type { PracticeCheckId, PracticeGroup } from "@/lib/session-practice/types";

export type PracticeWindow = "opening" | "closing" | "any";

export type PracticePattern = {
  id: PracticeCheckId;
  group: PracticeGroup;
  window: PracticeWindow;
  pattern: RegExp;
};

export const PRACTICE_PATTERNS: readonly PracticePattern[] = [
  // ── Intake ────────────────────────────────────────────────────────────
  {
    id: "role_intro",
    group: "intake",
    window: "opening",
    pattern:
      /my name is|i'?m (dr\.?|doctor) |i'?ll be your|i am (a|your) (therapist|psycholog|psychiatr|counsel|clinician|doctor)|i'?m (a|your) (therapist|psycholog|psychiatr|counsel|clinician)|اسمي|أنا الدكتور|انا الدكتور|أنا الدكتورة|انا الدكتورة|أنا المعالج|انا المعالج|أنا الأخصائي|انا الاخصائي/iu,
  },
  {
    id: "presenting_problem",
    group: "intake",
    window: "any",
    pattern:
      /what brings you|what brought you|what('?s| has) been (going on|troubling you|bothering you)|how can i help|tell me (a bit |a little )?about what|شو اللي جابك|شو جابك|ايش اللي جابك|ما الذي جاء بك|شو صاير معك|كيف بقدر اساعدك|كيف بقدر أساعدك|كيف أقدر أساعدك/iu,
  },
  {
    id: "history",
    group: "intake",
    window: "any",
    pattern:
      /when did (this|it|that|these|you first)|how long (has|have|did)|(first|ever) (start|notice|began|felt)|happened before|in the past|أول مرة|اول مرة|من قديش|من متى|من إيمتى|من امتى|قديش صارلك|كم صار لك|قبل هيك|من زمان/iu,
  },
  {
    id: "social_context",
    group: "intake",
    window: "any",
    pattern:
      /who (do you live|lives) |live with|your (family|wife|husband|partner|kids|children|parents|friends|job|work)|anyone you can talk to|عيلتك|عائلتك|أهلك|اهلك|مين ساكن معك|مع مين ساكن|شغلك|عملك|زوجك|زوجتك|أصحابك|اصحابك|ولادك|أولادك/iu,
  },
  {
    id: "expectations",
    group: "intake",
    window: "any",
    pattern:
      /hop(e|ing) (to get|for|from|to change)|what would you like (to get|from|to change)|what do you want (to get|from|to change)|your goals?|what would (be different|change)|شو بتتمنى|شو بتتوقع|ايش بتتوقع|شو هدفك|شو أهدافك|شو اهدافك|شو بدك توصل|شو حابب يتغير/iu,
  },
  // ── Consent and confidentiality ───────────────────────────────────────
  {
    id: "confidentiality",
    group: "consent",
    window: "any",
    pattern:
      /confidential|stays? (between us|in this room)|kept private|سرّي|سري|سرية|سرّية|بيضل بيننا|بضل بيننا|بتضل بيننا/iu,
  },
  {
    id: "confidentiality_limits",
    group: "consent",
    window: "any",
    pattern:
      /(limits? (of|to)|except|exception|unless).{0,60}(confidential|safety|harm|risk|danger)|(harm|hurt) (yourself|someone|others).{0,60}(share|tell|inform|break|contact)|حدود السرية|(إلا|الا) (إذا|اذا|في حال).{0,60}(خطر|تأذي|أذى|اذى|سلامت)/iu,
  },
  {
    id: "consent_to_proceed",
    group: "consent",
    window: "opening",
    pattern:
      /(is that|does that sound) (ok|okay|alright|all right)|any questions (before|about)|do you have (any )?questions|are you (ok|okay|comfortable) (with|to)|your (consent|permission)|موافق|موافقة|عندك أي سؤال|عندك اي سؤال|مرتاح نكمل|مرتاحة نكمل/iu,
  },
  // ── Session structure ─────────────────────────────────────────────────
  {
    id: "mood_check",
    group: "structure",
    window: "opening",
    pattern:
      /how (have|has) (you|your mood|things) been|how are you (feeling|doing)|how('?s| is| has| was) (your|the) (week|mood)|كيف كان أسبوعك|كيف كان اسبوعك|كيف كان مزاجك|كيف مزاجك|كيف حالك اليوم|كيف كانت الأيام|كيف حاسس|كيف حاسة/iu,
  },
  {
    id: "bridge",
    group: "structure",
    window: "opening",
    pattern:
      /last (time|session|week)|since (we|our) (last|met|spoke)|previous session|(we|you) (talked|spoke) about|المرة الماضية|الجلسة الماضية|آخر مرة|اخر مرة|الجلسة اللي فاتت|المرة اللي فاتت/iu,
  },
  {
    id: "agenda",
    group: "structure",
    window: "opening",
    pattern:
      /agenda|what (would|do) you (like|want) (us )?to (talk|focus|cover|work) (about |on )?today|(focus|work) on today|plan for (today|this session)|today i('?d| would) like (us )?to|شو حابب نحكي اليوم|شو حابة نحكي اليوم|شو بدك نحكي فيه اليوم|خطة الجلسة|اليوم رح نركز|خلينا نحدد شو/iu,
  },
  {
    id: "homework_review",
    group: "structure",
    window: "opening",
    pattern:
      /(how did|how was|did you (get a chance|manage|try)).{0,40}(homework|exercise|task|practice|diary|log|record|worksheet)|كيف كان الواجب|عملت الواجب|عملتي الواجب|جربت التمرين|جرّبت التمرين|كيف كان التمرين/iu,
  },
  {
    id: "homework_set",
    group: "structure",
    window: "closing",
    pattern:
      /homework|between (now and|sessions)|before (we meet again|our next|the next session)|(would you be willing|could you|can you) (try|practi[cs]e|keep a|write down|notice|track)|this week.{0,40}(try|practi[cs]e|write|notice|track)|خلال الأسبوع|خلال هالأسبوع|خلال هالاسبوع|لحد الجلسة الجاية|قبل الجلسة الجاية|بين الجلسات|واجب|تمرين للبيت/iu,
  },
  {
    id: "summary",
    group: "structure",
    window: "closing",
    pattern:
      /summari[sz]e|let me (sum|recap)|recap|to sum up|so today we|we covered|ملخص|نلخص|خلينا نلخص|يعني اليوم حكينا|اليوم حكينا عن|باختصار/iu,
  },
  {
    id: "feedback_elicited",
    group: "structure",
    window: "closing",
    pattern:
      /how (was|did) (this|today'?s?|the) session|how did (that|today|this) (feel|go) for you|any feedback|what was (helpful|unhelpful|useful)|anything (i said|i did|about today) that|كيف كانت الجلسة|شو كان مفيد|شو اللي ساعدك اليوم|في إشي ضايقك|في اشي ضايقك|رأيك بالجلسة|رأيك بجلسة اليوم/iu,
  },
  // ── Safety planning (Stanley-Brown) ───────────────────────────────────
  {
    id: "warning_signs",
    group: "safety_plan",
    window: "any",
    pattern:
      /warning signs?|early signs|(what|which) (thoughts|feelings|situations).{0,30}(before|lead|trigger)|علامات الخطر|علامات التحذير|إشارات التحذير|اشارات التحذير/iu,
  },
  {
    id: "internal_coping",
    group: "safety_plan",
    window: "any",
    pattern:
      /what (can|could) you do (on your own|by yourself|to (distract|cope|calm))|coping (strateg|skill)|distract yourself|calm yourself|شو بتقدر تعمل لحالك|شو بتقدري تعملي لحالك|تلهي حالك|تهدّي حالك|تهدي حالك|طرق التأقلم/iu,
  },
  {
    id: "social_supports",
    group: "safety_plan",
    window: "any",
    pattern:
      /(who|someone|anyone) (could|can|would) you (call|reach|contact|be with|talk to)|(friend|family member) you (could|can) (call|reach)|مين ممكن تحكي معه|مين بتقدر تحكي معه|مين بتقدر تتصل|حدا تحكي معه|حدا بتقدر تتصل/iu,
  },
  {
    id: "professional_contacts",
    group: "safety_plan",
    window: "any",
    pattern:
      /crisis (line|team|service|number)|hotline|helpline|emergency (room|department|services|number)|call (911|999|112)|خط الأزمات|خط المساعدة|خط الطوارئ|رقم الطوارئ|قسم الطوارئ|اتصل بالطوارئ/iu,
  },
  {
    id: "means_safety",
    group: "safety_plan",
    window: "any",
    pattern:
      /(access to|keep|store|remove|lock|get rid of|hold on to).{0,40}(pills|medication|tablets|knife|knives|gun|firearm|rope|weapon)|means (restriction|safety)|(الأدوية|الحبوب|الدوا|السكاكين|السلاح).{0,40}(بعيد|تشيل|نشيل|مقفل|مسكر)|(تشيل|نشيل|نبعد|تبعد).{0,40}(الأدوية|الحبوب|الدوا|السكاكين|السلاح)/iu,
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
