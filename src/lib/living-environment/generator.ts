/**
 * Mission 6 — Living World Generator.
 *
 * Mints an immutable LivingWorld for a CaseInstance. Deterministic from seed.
 * Cross-domain links are constructed together so the consistency checker passes.
 */

import { randomUUID } from "crypto";
import { isArabicLocale, localePackFor } from "./catalog";
import { checkLivingWorldConsistency } from "./consistency";
import { createRng } from "./rng";
import type {
  FriendCloseness,
  HousingTenure,
  LivingWorld,
  LivingWorldEducation,
  LivingWorldFamilyMember,
  LivingWorldFriend,
  LivingWorldGenerationInput,
  LivingWorldGenerationResult,
  WorkStatus,
} from "./types";
import { LIVING_ENVIRONMENT_VERSION } from "./types";

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function pickN<T>(rng: () => number, items: readonly T[], n: number): T[] {
  const copy = [...items];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]!);
  }
  return out;
}

function uniqueName(
  rng: () => number,
  pool: string[],
  used: Set<string>,
): string {
  for (let i = 0; i < 20; i++) {
    const name = pick(rng, pool);
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `${pick(rng, pool)}-${Math.floor(rng() * 90 + 10)}`;
  used.add(fallback);
  return fallback;
}

function inferWorkStatus(
  rng: () => number,
  occupationBaseline?: string,
): WorkStatus {
  const o = (occupationBaseline ?? "").toLowerCase();
  if (/student|طالب/.test(o)) return "student";
  if (/unemploy|بدون عمل|عاطل/.test(o)) return "unemployed";
  if (/freelance|self.?employ|حر|فريلانس/.test(o)) return "self_employed";
  if (/caregiv|care.?giver|رعاية/.test(o)) return "caregiver";
  if (/leave|إجازة|اجازة/.test(o)) return "leave";
  return pick(rng, ["employed", "employed", "employed", "self_employed"] as const);
}

function educationForAge(
  rng: () => number,
  age: number,
  pack: ReturnType<typeof localePackFor>,
  locale: string,
  baseline?: string,
): LivingWorldEducation {
  const ar = isArabicLocale(locale);
  const candidates = pack.education_levels.filter(
    (e) => e.typical_grad_age <= age,
  );
  const level =
    candidates.length > 0
      ? pick(rng, candidates)
      : pack.education_levels[0]!;
  const field =
    baseline && baseline.length > 2
      ? baseline
      : pick(rng, pack.education_fields);
  const gradAge = Math.min(
    age - 1,
    Math.max(17, level.typical_grad_age + Math.floor(rng() * 2)),
  );
  const ongoing =
    /student|طالب/.test(baseline ?? "") || age < level.typical_grad_age;
  const graduation_year_approx = ongoing
    ? null
    : new Date().getFullYear() - (age - gradAge);
  return {
    highest_level: level.level,
    field,
    institution_type: ar
      ? pick(rng, ["جامعة حكومية", "جامعة خاصة", "كلية مجتمع"])
      : pick(rng, ["state university", "private college", "community college"]),
    graduation_year_approx,
    years_completed: level.years,
    ongoing,
    notes: ongoing
      ? ar
        ? "لسا بالمسار التعليمي؛ الضغط من المواد والوقت."
        : "Still in the program; coursework timing is a stressor."
      : ar
        ? "خلّص المرحلة؛ ما في دراسة حالياً."
        : "Completed this level; not enrolled now.",
  };
}

function buildAnchors(world: Omit<LivingWorld, "consistency_anchors">): string[] {
  const ar = isArabicLocale(world.locale);
  const parent = world.family.members.find((m) =>
    /mother|father|أم|أب/.test(m.relation),
  );
  const closeFriend = world.friends.friends.find((f) => f.closeness === "close");
  return [
    ar
      ? `العمر ${world.patient_age}. السكن في ${world.home.city} — ${world.home.address_area}.`
      : `Age ${world.patient_age}. Lives in ${world.home.city} — ${world.home.address_area}.`,
    ar
      ? `السكن: ${world.home.housing_type} (${world.home.tenure}). التكلفة الشهرية تقريباً ${world.home.monthly_housing_cost}.`
      : `Housing: ${world.home.housing_type} (${world.home.tenure}). Monthly cost about ${world.home.monthly_housing_cost}.`,
    ar
      ? `الشغل: ${world.work.status} — ${world.work.title} عند ${world.work.employer_or_context}.`
      : `Work: ${world.work.status} — ${world.work.title} at ${world.work.employer_or_context}.`,
    ar
      ? `التعليم: ${world.education.highest_level} في ${world.education.field}.`
      : `Education: ${world.education.highest_level} in ${world.education.field}.`,
    ar
      ? `الوضع المالي (${world.financial_problems.currency}): ${world.financial_problems.primary_worry}.`
      : `Finances (${world.financial_problems.currency}): ${world.financial_problems.primary_worry}.`,
    ar
      ? `النوم تقريباً من ${world.daily_routine.bed_time} إلى ${world.daily_routine.wake_time}.`
      : `Sleep roughly ${world.daily_routine.bed_time} to ${world.daily_routine.wake_time}.`,
    parent
      ? ar
        ? `${parent.relation} اسمه/ا ${parent.name}، عمره/ا حوالي ${parent.age}.`
        : `${parent.relation} named ${parent.name}, about age ${parent.age}.`
      : ar
        ? "العيلة موجودة بس التواصل مش يومي."
        : "Family exists; contact is not daily.",
    closeFriend
      ? ar
        ? `صديق/ة مقرّب/ة: ${closeFriend.name} (${closeFriend.how_met}).`
        : `Close friend: ${closeFriend.name} (met via ${closeFriend.how_met}).`
      : ar
        ? "الدائرة الاجتماعية ضيّقة هالفترة."
        : "Social circle is thin right now.",
    ar
      ? `الرعاية الأولية: ${world.medical_history.primary_care}.`
      : `Primary care: ${world.medical_history.primary_care}.`,
  ];
}

/**
 * Generate a living world. Retries with derived seeds until consistency passes
 * (generator is constructed to pass; retries cover edge ages).
 */
export function generateLivingWorld(
  input: LivingWorldGenerationInput,
): LivingWorldGenerationResult {
  const maxAttempts = 6;
  let lastIssues: import("./types").LivingConsistencyIssue[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seed =
      attempt === 0
        ? String(input.seed)
        : `${String(input.seed)}:retry:${attempt}`;
    const world = mintWorld({ ...input, seed, attempt });
    const check = checkLivingWorldConsistency(world, {
      expectedAge: Math.max(16, Math.min(90, Math.round(input.age))),
      expectedLocale: input.locale,
    });
    if (check.ok) {
      return { ok: true, world };
    }
    lastIssues = check.issues;
  }

  return { ok: false, issues: lastIssues };
}

/** Pure mint without consistency gate — used by tests and internal retries. */
export function mintWorld(input: LivingWorldGenerationInput): LivingWorld {
  const seed = String(input.seed);
  const rng = createRng(seed);
  const pack = localePackFor(input.locale);
  const ar = isArabicLocale(input.locale);
  const age = Math.max(16, Math.min(90, Math.round(input.age)));
  const usedNames = new Set<string>();

  const cityEntry = input.cityHint
    ? pack.cities.find((c) => c.city === input.cityHint) ??
      ({ city: input.cityHint, areas: pack.cities[0]!.areas })
    : pick(rng, pack.cities);
  const area = pick(rng, cityEntry.areas);
  const country = input.countryHint ?? pack.country;

  const education = educationForAge(
    rng,
    age,
    pack,
    input.locale,
    input.educationBaseline,
  );

  const workStatus = inferWorkStatus(rng, input.occupationBaseline);
  const jobTitle =
    input.occupationBaseline && input.occupationBaseline.length > 2
      ? input.occupationBaseline
      : pick(rng, pack.job_titles);
  const employer =
    workStatus === "unemployed"
      ? ar
        ? "بدون عمل حالياً"
        : "not currently employed"
      : workStatus === "student"
        ? ar
          ? "الدراسة أساس الوقت"
          : "studies occupy most of the week"
        : input.randomized?.occupation_variant
          ? `${pick(rng, pack.employers)} (${input.randomized.occupation_variant})`
          : pick(rng, pack.employers);

  const workSchedule =
    workStatus === "employed" || workStatus === "self_employed"
      ? ar
        ? pick(rng, [
            "دوام مكتبي تقريباً 9–5 مع يوم ريموت",
            "شفتات متغيرة، أحياناً مسائية",
            "ساعات مرنة بس الضغط عالي آخر الشهر",
          ])
        : pick(rng, [
            "roughly 9–5 office with one remote day",
            "variable shifts, sometimes evenings",
            "flexible hours but end-of-month crunch",
          ])
      : workStatus === "student"
        ? ar
          ? "محاضرات وسط الأسبوع وواجبات بالليل"
          : "weekday classes and evening coursework"
        : ar
          ? "ما في دوام ثابت"
          : "no fixed work schedule";

  // Family members — parents older than patient
  const familyCount = 2 + Math.floor(rng() * 3);
  const relationPool = [...pack.family_relations];
  const members: LivingWorldFamilyMember[] = [];
  const namePool =
    input.gender === "male"
      ? [...pack.given_names_female, ...pack.given_names_male]
      : [...pack.given_names_male, ...pack.given_names_female];

  for (let i = 0; i < familyCount && relationPool.length > 0; i++) {
    const relIdx = Math.floor(rng() * relationPool.length);
    const rel = relationPool.splice(relIdx, 1)[0]!;
    let memberAge: number;
    if (rel.generation === "parent") {
      memberAge = age + 22 + Math.floor(rng() * 12);
    } else if (rel.generation === "sibling") {
      memberAge = Math.max(12, age - 6 + Math.floor(rng() * 12));
    } else if (rel.generation === "partner") {
      memberAge = Math.max(18, age - 4 + Math.floor(rng() * 8));
    } else {
      memberAge = age + 8 + Math.floor(rng() * 25);
    }
    const name = uniqueName(rng, namePool, usedNames);
    members.push({
      relation: rel.relation,
      name,
      age: memberAge,
      living_nearby: rng() > 0.45,
      relationship_quality: pick(rng, ar
        ? ["قريب بس فيه توتر", "دافئ مع حدود", "بارد عملياً", "داعم لما بيحتاج"]
        : ["close but tense", "warm with boundaries", "practically distant", "supportive when asked"]),
      notes: pick(rng, ar
        ? ["بحكي معهم بالويكند غالباً", "بيتواصلوا أكثر مني", "بتجنب مواضيع المرض"]
        : ["Talks most weekends", "They initiate more than the patient", "Avoids illness topics with them"]),
    });
  }

  const householdFromFamily = members
    .filter((m) => m.living_nearby && /partner|شريك|sister|brother|أخت|أخ/.test(m.relation))
    .slice(0, 2)
    .map((m) => `${m.name} (${m.relation})`);

  const tenure: HousingTenure = pick(rng, [
    "rent",
    "rent",
    "family_home",
    "own",
  ] as const);
  const housingCost =
    tenure === "family_home"
      ? ar
        ? `مساهمة ${Math.round(80 + rng() * 120)} ${pack.currency}`
        : `contributes ~${Math.round(200 + rng() * 400)} ${pack.currency}`
      : ar
        ? `${Math.round(180 + rng() * 220)} ${pack.currency}`
        : `${Math.round(900 + rng() * 1100)} ${pack.currency}`;

  const household =
    householdFromFamily.length > 0
      ? householdFromFamily
      : [
          ar
            ? pick(rng, ["لحالي", "مع رفيق سكن", "مع العيلة"])
            : pick(rng, ["lives alone", "one roommate", "with family"]),
        ];

  // Friends
  const friendCount = 2 + Math.floor(rng() * 3);
  const friends: LivingWorldFriend[] = [];
  const closenesses: FriendCloseness[] = ["close", "casual", "casual", "distant"];
  for (let i = 0; i < friendCount; i++) {
    friends.push({
      name: uniqueName(rng, namePool, usedNames),
      how_met: pick(rng, pack.friend_how_met),
      closeness: i === 0 ? "close" : pick(rng, closenesses),
      contact_pattern: pick(rng, ar
        ? ["رسالة كل كم يوم", "خروج نادر مرة بالشهر", "أكثر أونلاين من الواقع"]
        : ["texts every few days", "see each other maybe monthly", "more online than in person"]),
      notes: pick(rng, ar
        ? ["بعرف عن الضغط بس مش التفاصيل", "بطّل يضغط عشان نطلع"]
        : ["Knows about stress but not details", "Stopped pushing to go out"]),
    });
  }

  const financialHint = input.randomized?.financial_situation;
  const problems = pickN(rng, pack.financial_problem_templates, 2);
  if (financialHint) {
    problems.unshift(financialHint);
  }

  const medCondition = pick(rng, pack.medical_conditions_benign);
  const hadHospital = rng() > 0.72;
  const hospAge = hadHospital
    ? Math.max(8, Math.min(age - 2, 12 + Math.floor(rng() * (age - 14))))
    : 0;

  const employed =
    workStatus === "employed" || workStatus === "self_employed";
  const wake = employed
    ? ar
      ? pick(rng, ["06:45", "07:00", "07:30"])
      : pick(rng, ["6:45 AM", "7:00 AM", "7:30 AM"])
    : ar
      ? pick(rng, ["09:00", "09:30", "10:00"])
      : pick(rng, ["9:00 AM", "9:30 AM", "10:00 AM"]);
  const bed = ar
    ? pick(rng, ["23:00", "23:30", "00:30"])
    : pick(rng, ["11:00 PM", "11:30 PM", "12:30 AM"]);

  const weekday = employed
    ? ar
      ? [
          { time: wake, activity: "بصحى متأخر شوي وبجهز عالشغل" },
          { time: "09:00–17:00", activity: `دوام — ${jobTitle}` },
          { time: "18:30", activity: "برجع البيت؛ أكل خفيف" },
          { time: "21:00", activity: pick(rng, pack.routine_evening) },
          { time: bed, activity: "بنام" },
        ]
      : [
          { time: wake, activity: "wakes, rushes through getting ready" },
          { time: "9:00 AM–5:00 PM", activity: `work — ${jobTitle}` },
          { time: "6:30 PM", activity: "gets home; light meal" },
          { time: "9:00 PM", activity: pick(rng, pack.routine_evening) },
          { time: bed, activity: "sleep" },
        ]
    : ar
      ? [
          { time: wake, activity: "بصحى بصعوبة؛ قهوة أو شاي" },
          { time: "12:00", activity: "محاولة إنجاز مهمة واحدة" },
          { time: "16:00", activity: "راحة / نوم خفيف أحياناً" },
          { time: "20:00", activity: pick(rng, pack.routine_evening) },
          { time: bed, activity: "بنام" },
        ]
      : [
          { time: wake, activity: "hard wake; coffee or tea" },
          { time: "12:00 PM", activity: "tries one concrete task" },
          { time: "4:00 PM", activity: "rest / occasional nap" },
          { time: "8:00 PM", activity: pick(rng, pack.routine_evening) },
          { time: bed, activity: "sleep" },
        ];

  const platforms = pickN(rng, pack.social_platforms, 2 + Math.floor(rng() * 2)).map(
    (name) => ({
      name,
      usage: pick(rng, ar
        ? ["يومياً بس بدون نشر", "يفتح بالليل أكثر", "يستخدمه للشات مش للمحتوى"]
        : ["daily but rarely posts", "mostly late-night opens", "chats more than content"]),
      publicness: pick(rng, ar
        ? ["خاص / أصدقاء فقط", "شبه عام بس بحذر", "حساب قديم مهجور تقريباً"]
        : ["private / friends-only", "semi-public but careful", "old account nearly abandoned"]),
    }),
  );

  const worldBase: Omit<LivingWorld, "consistency_anchors"> = {
    version: LIVING_ENVIRONMENT_VERSION,
    world_id: `LW-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    persona_slug: input.personaSlug,
    locale: input.locale,
    seed,
    generated_at: new Date().toISOString(),
    patient_age: age,
    patient_gender: input.gender,
    home: {
      housing_type: pick(rng, pack.housing_types),
      address_area: area,
      city: cityEntry.city,
      country,
      household_members: household,
      description: ar
        ? `${pick(rng, pack.housing_types)} في ${area}، ${cityEntry.city}. ${
            tenure === "family_home" ? "بيت العيلة فيه حركة." : "المكان هادي نسبياً."
          }`
        : `${pick(rng, pack.housing_types)} in ${area}, ${cityEntry.city}. ${
            tenure === "family_home"
              ? "Family house with people coming and going."
              : "Relatively quiet space."
          }`,
      tenure,
      monthly_housing_cost: housingCost,
    },
    family: {
      members,
      origin_story:
        input.familyBaseline && input.familyBaseline.length > 4
          ? input.familyBaseline
          : ar
            ? "عيلة متوسطة؛ فيه قواعد غير مكتوبة عن إن الضغوط النفسية ما بتنحكى برا البيت."
            : "Middle-income family; unspoken rule that emotional struggle stays private.",
      contact_frequency: pick(rng, ar
        ? ["اتصال أسبوعي مع الأهل", "رسائل متفرقة خلال الأسبوع", "لقاءات مناسبة أكثر من ودّ"]
        : ["weekly call with parents", "scattered texts through the week", "occasions more than warmth"]),
    },
    work: {
      status: workStatus,
      title: jobTitle,
      employer_or_context: employer,
      schedule: workSchedule,
      tenure: ar
        ? pick(rng, ["أقل من سنة", "سنة إلى ثلاث", "أكثر من ثلاث سنين"])
        : pick(rng, ["under a year", "1–3 years", "over three years"]),
      stressors: [
        input.randomized?.recent_stressor,
        ar
          ? pick(rng, ["ضغط تسليم", "مدير صارم", "خوف من التقييم", "ملل مع إرهاق"])
          : pick(rng, ["deadline pressure", "critical manager", "fear of review", "boredom plus fatigue"]),
      ].filter((s): s is string => Boolean(s)),
      satisfaction: pick(rng, ar
        ? ["ماشي الحال بس مش فخور/ة", "مرهق/ة من الشغل", "مرتاح/ة نسبياً بالدور"]
        : ["fine but not proud", "worn down by the work", "relatively settled in the role"]),
    },
    friends: {
      friends,
      social_energy: pick(rng, ar
        ? ["منخفض هالفترة", "متوسط؛ بيختار بعناية", "بيتحمّس بعدين بينسحب"]
        : ["low lately", "moderate; selective", "eager then withdraws"]),
      recent_withdrawal: input.randomized?.relationship_detail
        ?? (ar
          ? "بطّل يرد على الدعوات الاجتماعية بنفس السرعة."
          : "Stopped answering social invites as quickly."),
    },
    financial_problems: {
      income_band: ar
        ? pick(rng, ["دخل محدود", "دخل متوسط تحت ضغط", "دخل غير ثابت"])
        : pick(rng, ["limited income", "mid income under strain", "irregular income"]),
      currency: pack.currency,
      problems: [...new Set(problems)].slice(0, 3),
      debt_or_bills: pick(rng, ar
        ? ["فواتير متراكمة بسيطة", "قسط واضح كل شهر", "ما في دين كبير بس السيولة ضعيفة"]
        : ["small stacked bills", "one clear monthly installment", "no big debt but thin cashflow"]),
      savings_status: pick(rng, ar
        ? ["تقريباً ما في توفير", "توفير يكفي لشهر واحد", "توفير يتآكل"]
        : ["almost no savings", "about one month of buffer", "savings are eroding"]),
      primary_worry: problems[0]!,
    },
    medical_history: {
      conditions: [
        {
          name: medCondition.name,
          status: ar ? "مستقر" : "stable",
          notes: medCondition.notes,
        },
      ],
      medications:
        rng() > 0.55
          ? [
              {
                name: ar ? "مضاد هيستامين عند الحاجة" : "OTC antihistamine PRN",
                purpose: medCondition.name,
                adherence: ar ? "عند اللزوم" : "as needed",
              },
            ]
          : [],
      allergies: rng() > 0.7
        ? [ar ? "غبار / عطور قوية" : "dust / strong fragrances"]
        : [ar ? "ما في حساسية معروفة مهمة" : "no major known allergies"],
      hospitalizations: hadHospital
        ? [
            {
              reason: ar ? "التهاب زائدة / جراحة بسيطة" : "appendicitis / minor surgery",
              when: ar
                ? `عمر تقريباً ${hospAge}`
                : `around age ${hospAge}`,
              age_at_event: hospAge,
              notes: ar
                ? "ما إلها علاقة بالحالة النفسية الحالية."
                : "Unrelated to the current psychiatric episode.",
            },
          ]
        : [],
      primary_care: ar
        ? pick(rng, ["مركز صحي قريب", "طبيب عام في العيادة الخاصة", "ما عندي مراجعة منتظمة"])
        : pick(rng, [
            "nearby community clinic",
            "GP at a private practice",
            "no regular primary-care visits lately",
          ]),
    },
    daily_routine: {
      weekday,
      weekend_difference: ar
        ? "الويكند أبطأ؛ بصحى متأخر وبقعد بالبيت أكثر."
        : "Weekends slower; later wake and more time at home.",
      sleep_schedule: ar
        ? `تقريباً ${bed} إلى ${wake}`
        : `roughly ${bed} to ${wake}`,
      wake_time: wake,
      bed_time: bed,
      meals: ar
        ? "وجبة حقيقية واحدة غالباً بعد الظهر أو المساء؛ باقي اليوم خفيف."
        : "One real meal usually afternoon/evening; rest of day is light.",
      exercise_or_movement: ar
        ? pick(rng, ["مشي قصير أحياناً", "تقريباً ما في رياضة", "تمارين خفيفة بالبيت نادر"])
        : pick(rng, ["short walk sometimes", "almost no exercise", "rare light home workouts"]),
    },
    social_media: {
      platforms,
      posting_style: ar
        ? pick(rng, ["مشاهد أكثر من ناشر", "ستوري نادر", "تعليقات قصيرة بس"])
        : pick(rng, ["lurker more than poster", "rare stories", "short comments only"]),
      doomscroll_or_avoidance: ar
        ? pick(rng, ["يسكر أونلاين لما مزاجه ينزل", "يسكر بالليل بدون ما يحس بالوقت"])
        : pick(rng, [
            "avoids feeds when mood drops",
            "late-night scroll without noticing time",
          ]),
      online_vs_offline: ar
        ? "أونلاين أسهل من الطلعات هالفترة."
        : "Online contact feels easier than going out lately.",
    },
    education,
  };

  // Align housing description housing_type with selected type
  worldBase.home.description = ar
    ? `${worldBase.home.housing_type} في ${area}، ${cityEntry.city}. ${
        tenure === "family_home" ? "بيت العيلة فيه حركة." : "المكان هادي نسبياً."
      }`
    : `${worldBase.home.housing_type} in ${area}, ${cityEntry.city}. ${
        tenure === "family_home"
          ? "Family house with people coming and going."
          : "Relatively quiet space."
      }`;

  return {
    ...worldBase,
    consistency_anchors: buildAnchors(worldBase),
  };
}
