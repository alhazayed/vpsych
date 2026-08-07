/**
 * Mission 6 — Living World consistency checker.
 *
 * Cross-domain invariants so the therapist can ask about any detail and
 * receive answers that never contradict the minted world.
 */

import { isArabicLocale, localePackFor } from "./catalog";
import type {
  LivingConsistencyIssue,
  LivingConsistencyResult,
  LivingWorld,
  LivingWorldDomain,
} from "./types";
import { LIVING_ENVIRONMENT_VERSION, LIVING_WORLD_DOMAINS } from "./types";

function issue(
  code: string,
  message: string,
  domains?: LivingWorldDomain[],
  path?: string,
): LivingConsistencyIssue {
  return { code, message, domains, path };
}

/**
 * Validate that a LivingWorld is internally consistent and complete.
 */
export function checkLivingWorldConsistency(
  world: LivingWorld,
  opts?: { expectedAge?: number; expectedLocale?: string },
): LivingConsistencyResult {
  const issues: LivingConsistencyIssue[] = [];

  if (world.version !== LIVING_ENVIRONMENT_VERSION) {
    issues.push(
      issue("version", `Unexpected living world version ${world.version}`),
    );
  }

  if (!world.world_id || world.world_id.length < 4) {
    issues.push(issue("world_id", "Missing world_id", undefined, "world_id"));
  }

  if (!world.seed) {
    issues.push(issue("seed", "Missing seed", undefined, "seed"));
  }

  for (const domain of LIVING_WORLD_DOMAINS) {
    if (world[domain] == null) {
      issues.push(
        issue("missing_domain", `Missing domain: ${domain}`, [domain], domain),
      );
    }
  }

  if (opts?.expectedAge != null && world.patient_age !== opts.expectedAge) {
    issues.push(
      issue(
        "age_mismatch",
        `patient_age ${world.patient_age} != expected ${opts.expectedAge}`,
        undefined,
        "patient_age",
      ),
    );
  }

  if (
    opts?.expectedLocale &&
    world.locale.toLowerCase() !== opts.expectedLocale.toLowerCase()
  ) {
    issues.push(
      issue(
        "locale_mismatch",
        `locale ${world.locale} != expected ${opts.expectedLocale}`,
        undefined,
        "locale",
      ),
    );
  }

  const pack = localePackFor(world.locale);
  if (world.financial_problems.currency !== pack.currency) {
    issues.push(
      issue(
        "currency_locale",
        `currency ${world.financial_problems.currency} inconsistent with locale ${world.locale}`,
        ["financial_problems"],
        "financial_problems.currency",
      ),
    );
  }

  if (world.home.country !== pack.country && !world.home.country) {
    issues.push(
      issue("home_country", "home.country missing", ["home"], "home.country"),
    );
  }

  if (!world.home.city || !world.home.address_area) {
    issues.push(
      issue("home_place", "home city/area required", ["home"], "home.city"),
    );
  }

  if (!world.home.household_members?.length) {
    issues.push(
      issue(
        "home_household",
        "household_members must be non-empty",
        ["home"],
        "home.household_members",
      ),
    );
  }

  if (!world.family.members?.length) {
    issues.push(
      issue("family_empty", "family.members required", ["family"], "family.members"),
    );
  }

  for (const m of world.family.members ?? []) {
    if (m.age < 1 || m.age > 110) {
      issues.push(
        issue(
          "family_age_range",
          `family member ${m.name} age ${m.age} out of range`,
          ["family"],
          "family.members.age",
        ),
      );
    }
    if (
      /mother|father|أم|أبوي|أمي/.test(m.relation) &&
      m.age <= world.patient_age
    ) {
      issues.push(
        issue(
          "parent_younger",
          `parent ${m.name} age ${m.age} <= patient ${world.patient_age}`,
          ["family"],
          "family.members.age",
        ),
      );
    }
  }

  const familyNames = (world.family.members ?? []).map((m) => m.name);
  const friendNames = (world.friends.friends ?? []).map((f) => f.name);
  const allPeople = [...familyNames, ...friendNames];
  const seen = new Set<string>();
  for (const name of allPeople) {
    const key = name.trim().toLowerCase();
    if (seen.has(key)) {
      issues.push(
        issue(
          "duplicate_name",
          `Duplicate person name "${name}" across family/friends`,
          ["family", "friends"],
        ),
      );
    }
    seen.add(key);
  }

  if (!world.friends.friends?.length) {
    issues.push(
      issue("friends_empty", "friends required", ["friends"], "friends.friends"),
    );
  }

  if (!world.financial_problems.problems?.length) {
    issues.push(
      issue(
        "finances_empty",
        "financial problems required",
        ["financial_problems"],
        "financial_problems.problems",
      ),
    );
  }

  if (!world.financial_problems.primary_worry) {
    issues.push(
      issue(
        "finances_worry",
        "primary_worry required",
        ["financial_problems"],
        "financial_problems.primary_worry",
      ),
    );
  }

  // Primary worry should be one of the listed problems (or financial hint prefix)
  const problemsJoined = world.financial_problems.problems.join(" | ").toLowerCase();
  if (
    world.financial_problems.primary_worry &&
    !problemsJoined.includes(
      world.financial_problems.primary_worry.toLowerCase().slice(0, 24),
    ) &&
    !world.financial_problems.problems.some(
      (p) =>
        p.toLowerCase() ===
        world.financial_problems.primary_worry.toLowerCase(),
    )
  ) {
    issues.push(
      issue(
        "finances_worry_orphan",
        "primary_worry not reflected in problems list",
        ["financial_problems"],
      ),
    );
  }

  for (const h of world.medical_history.hospitalizations ?? []) {
    if (h.age_at_event >= world.patient_age) {
      issues.push(
        issue(
          "hospital_age",
          `hospitalization age ${h.age_at_event} >= patient ${world.patient_age}`,
          ["medical_history"],
          "medical_history.hospitalizations",
        ),
      );
    }
  }

  if (!world.daily_routine.weekday?.length) {
    issues.push(
      issue(
        "routine_empty",
        "daily_routine.weekday required",
        ["daily_routine"],
        "daily_routine.weekday",
      ),
    );
  }

  if (!world.daily_routine.wake_time || !world.daily_routine.bed_time) {
    issues.push(
      issue(
        "routine_sleep",
        "wake_time and bed_time required",
        ["daily_routine"],
      ),
    );
  }

  // Work schedule vs routine: employed should mention work in weekday
  const employed =
    world.work.status === "employed" || world.work.status === "self_employed";
  if (employed) {
    const activities = world.daily_routine.weekday
      .map((s) => s.activity.toLowerCase())
      .join(" ");
    if (
      !/work|دوام|job|title|employed|شغل/.test(activities) &&
      !activities.includes(world.work.title.toLowerCase().slice(0, 8))
    ) {
      issues.push(
        issue(
          "work_routine_gap",
          "employed status but weekday routine lacks work activity",
          ["work", "daily_routine"],
        ),
      );
    }
  }

  if (world.education.years_completed < 1) {
    issues.push(
      issue(
        "education_years",
        "education.years_completed must be >= 1",
        ["education"],
      ),
    );
  }

  if (
    world.education.graduation_year_approx != null &&
    world.education.graduation_year_approx > new Date().getFullYear() + 1
  ) {
    issues.push(
      issue(
        "education_future_grad",
        "graduation_year_approx too far in the future",
        ["education"],
      ),
    );
  }

  // Approximate: graduation age = current_year - grad_year offset from patient age
  if (
    world.education.graduation_year_approx != null &&
    !world.education.ongoing
  ) {
    const yearsSince =
      new Date().getFullYear() - world.education.graduation_year_approx;
    const ageAtGrad = world.patient_age - yearsSince;
    if (ageAtGrad < 16 || ageAtGrad > world.patient_age) {
      issues.push(
        issue(
          "education_age_at_grad",
          `Implied age at graduation ${ageAtGrad} inconsistent with patient age ${world.patient_age}`,
          ["education"],
        ),
      );
    }
  }

  if (!world.social_media.platforms?.length) {
    issues.push(
      issue(
        "social_empty",
        "social_media.platforms required",
        ["social_media"],
      ),
    );
  }

  if (!world.consistency_anchors?.length) {
    issues.push(
      issue(
        "anchors_empty",
        "consistency_anchors required",
        undefined,
        "consistency_anchors",
      ),
    );
  }

  // Anchors should mention city and work title fragment
  const anchors = (world.consistency_anchors ?? []).join(" ").toLowerCase();
  if (world.home.city && !anchors.includes(world.home.city.toLowerCase())) {
    issues.push(
      issue(
        "anchor_city",
        "consistency_anchors must mention home.city",
        ["home"],
      ),
    );
  }

  // Locale script sanity: Arabic locale should not be empty of Arabic letters in home description
  if (isArabicLocale(world.locale)) {
    if (!/[\u0600-\u06FF]/.test(world.home.description)) {
      issues.push(
        issue(
          "locale_script_home",
          "Arabic locale home.description lacks Arabic script",
          ["home"],
        ),
      );
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Query helper — does this world answer a therapist topic?
 * Used by tests and optional retrieval.
 */
export function worldCoversTopic(
  world: LivingWorld,
  topic: string,
): { covered: boolean; domain?: LivingWorldDomain; excerpt?: string } {
  const t = topic.toLowerCase().trim();
  const probes: Array<{ domain: LivingWorldDomain; text: string }> = [
    {
      domain: "home",
      text: `${world.home.housing_type} ${world.home.city} ${world.home.description} ${world.home.household_members.join(" ")}`,
    },
    {
      domain: "family",
      text: world.family.members
        .map((m) => `${m.relation} ${m.name} ${m.notes}`)
        .join(" "),
    },
    {
      domain: "work",
      text: `${world.work.status} ${world.work.title} ${world.work.employer_or_context} ${world.work.stressors.join(" ")}`,
    },
    {
      domain: "friends",
      text: world.friends.friends
        .map((f) => `${f.name} ${f.how_met} ${f.notes}`)
        .join(" "),
    },
    {
      domain: "financial_problems",
      text: `${world.financial_problems.problems.join(" ")} ${world.financial_problems.primary_worry}`,
    },
    {
      domain: "medical_history",
      text: `${world.medical_history.conditions.map((c) => c.name).join(" ")} ${world.medical_history.primary_care}`,
    },
    {
      domain: "daily_routine",
      text: `${world.daily_routine.sleep_schedule} ${world.daily_routine.weekday.map((s) => s.activity).join(" ")}`,
    },
    {
      domain: "social_media",
      text: world.social_media.platforms.map((p) => p.name).join(" "),
    },
    {
      domain: "education",
      text: `${world.education.highest_level} ${world.education.field}`,
    },
  ];

  const keywords: Record<LivingWorldDomain, string[]> = {
    home: ["home", "live", "apartment", "house", "household", "سكن", "بيت", "شقة"],
    family: ["family", "mother", "father", "parent", "sibling", "عيلة", "أم", "أب", "أخت", "أخ"],
    work: ["work", "job", "employ", "boss", "شغل", "عمل", "دوام"],
    friends: ["friend", "social circle", "صديق", "رفقة", "طلعات"],
    financial_problems: [
      "money",
      "rent",
      "debt",
      "financ",
      "bill",
      "income",
      "savings",
      "فلوس",
      "دين",
      "راتب",
      "إيجار",
    ],
    medical_history: ["medic", "doctor", "hospital", "allerg", "دواء", "طبيب", "مستشفى", "حساسية"],
    daily_routine: ["sleep", "wake", "routine", "day", "نوم", "أصحى", "يوم"],
    social_media: ["instagram", "tiktok", "facebook", "online", "social media", "إنستغرام", "تيك", "فيسبوك"],
    education: ["school", "college", "university", "degree", "educat", "جامعة", "دراسة", "توجيهي"],
  };

  let best: { domain: LivingWorldDomain; hits: number } | null = null;
  for (const [domain, keys] of Object.entries(keywords) as Array<
    [LivingWorldDomain, string[]]
  >) {
    const hits = keys.filter((k) => t.includes(k)).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { domain, hits };
    }
  }
  if (best) {
    const probe = probes.find((p) => p.domain === best!.domain)!;
    return {
      covered: true,
      domain: best.domain,
      excerpt: probe.text.slice(0, 160),
    };
  }

  // Fallback: substring search across all domains
  for (const probe of probes) {
    if (probe.text.toLowerCase().includes(t) && t.length >= 3) {
      return { covered: true, domain: probe.domain, excerpt: probe.text.slice(0, 160) };
    }
  }

  return { covered: false };
}
