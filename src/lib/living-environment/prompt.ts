/**
 * Mission 6 — format LivingWorld for the patient system prompt.
 *
 * Facts are fixed for the CaseInstance. The model may disclose when asked;
 * it must never invent conflicting biography.
 */

import { isArabicLocale } from "./catalog";
import type { LivingWorld } from "./types";

function bullets(lines: string[]): string {
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `- ${l}`)
    .join("\n");
}

/**
 * Prompt-ready MODULE LIVING ENVIRONMENT block. Empty string if world is null.
 */
export function formatLivingWorldForPrompt(world: LivingWorld | null | undefined): string {
  if (!world) return "";
  const ar = isArabicLocale(world.locale);

  const header = ar
    ? `MODULE LIVING ENVIRONMENT — عالمك الثابت (لا يتغيّر أبداً في هذه الحالة)
العالم رقم ${world.world_id}. هذي حقائق ثابتة. إذا سألك المعالج عن أي تفصيل، جاوب من هون.
ممنوع تخترع بيت ثاني أو عيلة ثانية أو شغل يناقض اللي مكتوب. ما لازم تحكي كل شي من أول جلسة — افصح لما ينسأل أو لما يصير مناسب.`
    : `MODULE LIVING ENVIRONMENT — your fixed living world (immutable for this case)
World ${world.world_id}. These facts never change. If the therapist asks about any detail, answer from this world.
Never invent a conflicting home, family, job, or history. Do not dump everything in session one — disclose when asked or when it naturally fits.`;

  const home = ar
    ? [
        `البيت: ${world.home.housing_type} في ${world.home.address_area}، ${world.home.city}، ${world.home.country}`,
        `السكن: ${world.home.tenure} · التكلفة الشهرية تقريباً ${world.home.monthly_housing_cost}`,
        `مع مين بالبيت: ${world.home.household_members.join("؛ ")}`,
        world.home.description,
      ]
    : [
        `Home: ${world.home.housing_type} in ${world.home.address_area}, ${world.home.city}, ${world.home.country}`,
        `Tenure: ${world.home.tenure} · monthly cost ~ ${world.home.monthly_housing_cost}`,
        `Household: ${world.home.household_members.join("; ")}`,
        world.home.description,
      ];

  const family = [
    ...(ar ? ["العيلة:"] : ["Family:"]),
    ...world.family.members.map((m) =>
      ar
        ? `${m.relation} — ${m.name} (عمر ~${m.age}) · ${m.relationship_quality}${m.living_nearby ? " · قريب مكانياً" : ""}`
        : `${m.relation} — ${m.name} (age ~${m.age}) · ${m.relationship_quality}${m.living_nearby ? " · nearby" : ""}`,
    ),
    ar
      ? `التواصل: ${world.family.contact_frequency}`
      : `Contact: ${world.family.contact_frequency}`,
    world.family.origin_story,
  ];

  const work = ar
    ? [
        `الشغل: ${world.work.status} — ${world.work.title}`,
        `السياق: ${world.work.employer_or_context}`,
        `الجدول: ${world.work.schedule} · المدة: ${world.work.tenure}`,
        `الضغوط: ${world.work.stressors.join("؛ ")}`,
        `الرضا: ${world.work.satisfaction}`,
      ]
    : [
        `Work: ${world.work.status} — ${world.work.title}`,
        `Context: ${world.work.employer_or_context}`,
        `Schedule: ${world.work.schedule} · tenure: ${world.work.tenure}`,
        `Stressors: ${world.work.stressors.join("; ")}`,
        `Satisfaction: ${world.work.satisfaction}`,
      ];

  const friends = [
    ...(ar ? ["الأصدقاء:"] : ["Friends:"]),
    ...world.friends.friends.map((f) =>
      ar
        ? `${f.name} (${f.closeness}) — تعرفنا عبر ${f.how_met} · ${f.contact_pattern}`
        : `${f.name} (${f.closeness}) — met via ${f.how_met} · ${f.contact_pattern}`,
    ),
    ar
      ? `الطاقة الاجتماعية: ${world.friends.social_energy}. ${world.friends.recent_withdrawal}`
      : `Social energy: ${world.friends.social_energy}. ${world.friends.recent_withdrawal}`,
  ];

  const money = ar
    ? [
        `المال (${world.financial_problems.currency}): ${world.financial_problems.income_band}`,
        `الهم الأساسي: ${world.financial_problems.primary_worry}`,
        `مشاكل: ${world.financial_problems.problems.join("؛ ")}`,
        `ديون/فواتير: ${world.financial_problems.debt_or_bills}`,
        `التوفير: ${world.financial_problems.savings_status}`,
      ]
    : [
        `Money (${world.financial_problems.currency}): ${world.financial_problems.income_band}`,
        `Primary worry: ${world.financial_problems.primary_worry}`,
        `Problems: ${world.financial_problems.problems.join("; ")}`,
        `Debt/bills: ${world.financial_problems.debt_or_bills}`,
        `Savings: ${world.financial_problems.savings_status}`,
      ];

  const medical = ar
    ? [
        `التاريخ الطبي:`,
        ...world.medical_history.conditions.map(
          (c) => `${c.name} (${c.status}) — ${c.notes}`,
        ),
        world.medical_history.medications.length
          ? `أدوية: ${world.medical_history.medications.map((m) => `${m.name} لـ ${m.purpose}`).join("؛ ")}`
          : "أدوية نفسية مستمرة: لا (إلا إذا Module 1 قال غير هيك)",
        `حساسية: ${world.medical_history.allergies.join("؛ ")}`,
        ...world.medical_history.hospitalizations.map(
          (h) => `دخول مستشفى: ${h.reason} (${h.when}) — ${h.notes}`,
        ),
        `الرعاية الأولية: ${world.medical_history.primary_care}`,
      ]
    : [
        `Medical history:`,
        ...world.medical_history.conditions.map(
          (c) => `${c.name} (${c.status}) — ${c.notes}`,
        ),
        world.medical_history.medications.length
          ? `Meds: ${world.medical_history.medications.map((m) => `${m.name} for ${m.purpose}`).join("; ")}`
          : "No ongoing psychotropic listed here (Module 1 still owns syndrome meds if any)",
        `Allergies: ${world.medical_history.allergies.join("; ")}`,
        ...world.medical_history.hospitalizations.map(
          (h) => `Hospitalization: ${h.reason} (${h.when}) — ${h.notes}`,
        ),
        `Primary care: ${world.medical_history.primary_care}`,
      ];

  const routine = ar
    ? [
        `الروتين اليومي: نوم ${world.daily_routine.sleep_schedule}`,
        ...world.daily_routine.weekday.map((s) => `${s.time}: ${s.activity}`),
        `الويكند: ${world.daily_routine.weekend_difference}`,
        `الأكل: ${world.daily_routine.meals}`,
        `الحركة: ${world.daily_routine.exercise_or_movement}`,
      ]
    : [
        `Daily routine: sleep ${world.daily_routine.sleep_schedule}`,
        ...world.daily_routine.weekday.map((s) => `${s.time}: ${s.activity}`),
        `Weekend: ${world.daily_routine.weekend_difference}`,
        `Meals: ${world.daily_routine.meals}`,
        `Movement: ${world.daily_routine.exercise_or_movement}`,
      ];

  const social = ar
    ? [
        `السوشال ميديا:`,
        ...world.social_media.platforms.map(
          (p) => `${p.name} — ${p.usage} (${p.publicness})`,
        ),
        world.social_media.posting_style,
        world.social_media.doomscroll_or_avoidance,
        world.social_media.online_vs_offline,
      ]
    : [
        `Social media:`,
        ...world.social_media.platforms.map(
          (p) => `${p.name} — ${p.usage} (${p.publicness})`,
        ),
        world.social_media.posting_style,
        world.social_media.doomscroll_or_avoidance,
        world.social_media.online_vs_offline,
      ];

  const education = ar
    ? [
        `التعليم: ${world.education.highest_level} — ${world.education.field}`,
        `المؤسسة: ${world.education.institution_type}`,
        world.education.ongoing
          ? "لسا يدرس"
          : `تخرّج تقريباً ${world.education.graduation_year_approx ?? "—"}`,
        world.education.notes,
      ]
    : [
        `Education: ${world.education.highest_level} — ${world.education.field}`,
        `Institution: ${world.education.institution_type}`,
        world.education.ongoing
          ? "Currently enrolled"
          : `Graduated ~${world.education.graduation_year_approx ?? "—"}`,
        world.education.notes,
      ];

  const anchors = [
    ...(ar ? ["مراسي ثابتة (لا تناقض):"] : ["Consistency anchors (never contradict):"]),
    ...world.consistency_anchors,
  ];

  return [
    header,
    "",
    bullets(home),
    "",
    bullets(family),
    "",
    bullets(work),
    "",
    bullets(friends),
    "",
    bullets(money),
    "",
    bullets(medical),
    "",
    bullets(routine),
    "",
    bullets(social),
    "",
    bullets(education),
    "",
    bullets(anchors),
  ].join("\n");
}
