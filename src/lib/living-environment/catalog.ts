/**
 * Locale-aware content pools for Living Environment generation.
 * EN and AR pools are independently authored — never translations.
 */

export type LocalePack = {
  currency: string;
  country: string;
  cities: Array<{ city: string; areas: string[] }>;
  housing_types: string[];
  given_names_female: string[];
  given_names_male: string[];
  family_relations: Array<{ relation: string; generation: "parent" | "sibling" | "partner" | "extended" }>;
  employers: string[];
  job_titles: string[];
  education_fields: string[];
  education_levels: Array<{ level: string; years: number; typical_grad_age: number }>;
  friend_how_met: string[];
  social_platforms: string[];
  medical_conditions_benign: Array<{ name: string; notes: string }>;
  routine_evening: string[];
  financial_problem_templates: string[];
};

const EN_US: LocalePack = {
  currency: "USD",
  country: "United States",
  cities: [
    { city: "Portland", areas: ["Alberta Arts", "Sellwood", "St. Johns", "Hawthorne"] },
    { city: "Austin", areas: ["East Side", "Mueller", "South Congress", "Hyde Park"] },
    { city: "Chicago", areas: ["Logan Square", "Pilsen", "Edgewater", "Bridgeport"] },
    { city: "Seattle", areas: ["Ballard", "Beacon Hill", "Capitol Hill", "Columbia City"] },
  ],
  housing_types: [
    "one-bedroom apartment",
    "studio apartment",
    "shared two-bedroom flat",
    "small rented house",
    "basement suite",
  ],
  given_names_female: ["Elena", "Priya", "Nora", "Samira", "Claire", "Aisha", "June", "Rosa"],
  given_names_male: ["Marcus", "Omar", "Daniel", "Kenji", "Luis", "Theo", "Andre", "Yusuf"],
  family_relations: [
    { relation: "mother", generation: "parent" },
    { relation: "father", generation: "parent" },
    { relation: "older sister", generation: "sibling" },
    { relation: "younger brother", generation: "sibling" },
    { relation: "partner", generation: "partner" },
    { relation: "maternal aunt", generation: "extended" },
    { relation: "cousin", generation: "extended" },
  ],
  employers: [
    "a regional design studio",
    "a mid-size logistics company",
    "a nonprofit clinic admin office",
    "a university facilities team",
    "a retail chain regional office",
    "freelance clients",
  ],
  job_titles: [
    "graphic designer",
    "operations coordinator",
    "administrative assistant",
    "junior analyst",
    "customer success associate",
    "freelance contractor",
  ],
  education_fields: [
    "graphic design",
    "psychology",
    "business administration",
    "computer science",
    "communications",
    "nursing prerequisites",
  ],
  education_levels: [
    { level: "high school diploma", years: 12, typical_grad_age: 18 },
    { level: "associate degree", years: 14, typical_grad_age: 20 },
    { level: "bachelor's degree", years: 16, typical_grad_age: 22 },
    { level: "some graduate coursework", years: 17, typical_grad_age: 24 },
  ],
  friend_how_met: [
    "college",
    "a previous job",
    "the neighborhood gym",
    "a mutual friend",
    "an evening class",
  ],
  social_platforms: ["Instagram", "TikTok", "Facebook", "Reddit", "WhatsApp"],
  medical_conditions_benign: [
    { name: "seasonal allergies", notes: "Worse in spring; OTC antihistamine as needed." },
    { name: "mild asthma", notes: "Inhaler rarely used; last flare over a year ago." },
    { name: "migraine", notes: "A few times a year; triggered by irregular sleep." },
    { name: "low vitamin D (past)", notes: "Repleted; no ongoing prescription." },
  ],
  routine_evening: [
    "scrolls phone on the couch then half-watches a show",
    "feeds the pet and washes one dish before bed",
    "texts one person then goes quiet",
    "lies in bed with a podcast they do not finish",
  ],
  financial_problem_templates: [
    "rent and utilities eat most of the paycheck",
    "credit card balance from last winter still open",
    "student loan payment lands the same week as rent",
    "irregular freelance income makes budgeting hard",
    "helping a family member with cash when asked",
  ],
};

const AR_JO: LocalePack = {
  currency: "JOD",
  country: "Jordan",
  cities: [
    { city: "عمّان", areas: ["الجبيهة", "خلدا", "الصويفية", "ماركا", "تلاع العلي"] },
    { city: "إربد", areas: ["الحي الجنوبي", "المنارة", "الحصن"] },
    { city: "الزرقاء", areas: ["حي الأمير محمد", "الجديد"] },
  ],
  housing_types: [
    "شقة غرفة وصالة",
    "شقة غرفتين مع العيلة",
    "استوديو مفروش",
    "طابق أرضي في بيت عيلة",
  ],
  given_names_female: ["ليان", "نور", "سارة", "رغد", "دانا", "ميرا", "هبة", "سيلا"],
  given_names_male: ["أحمد", "عمر", "كريم", "ياسر", "زياد", "طارق", "سامر", "هاني"],
  family_relations: [
    { relation: "أمي", generation: "parent" },
    { relation: "أبوي", generation: "parent" },
    { relation: "أختي الكبيرة", generation: "sibling" },
    { relation: "أخوي الصغير", generation: "sibling" },
    { relation: "شريكي/شريكتي", generation: "partner" },
    { relation: "خالتي", generation: "extended" },
    { relation: "ابن عمي", generation: "extended" },
  ],
  employers: [
    "شركة خدمات محلية",
    "مكتب تصميم صغير",
    "مؤسسة غير ربحية",
    "صيدلية سلسلة",
    "عمل حر مع زباين",
    "دائرة إدارية في جامعة",
  ],
  job_titles: [
    "مصمم/ة جرافيك",
    "منسق/ة عمليات",
    "مساعد/ة إداري/ة",
    "موظف/ة خدمة عملاء",
    "محاسب/ة مبتدئ/ة",
    "فريلانسر",
  ],
  education_fields: [
    "تصميم جرافيك",
    "إدارة أعمال",
    "علم نفس",
    "حاسوب",
    "صحافة وإعلام",
    "تمريض",
  ],
  education_levels: [
    { level: "توجيهي", years: 12, typical_grad_age: 18 },
    { level: "دبلوم متوسط", years: 14, typical_grad_age: 20 },
    { level: "بكالوريوس", years: 16, typical_grad_age: 22 },
    { level: "ساعات دراسات عليا غير مكتملة", years: 17, typical_grad_age: 24 },
  ],
  friend_how_met: [
    "الجامعة",
    "شغل قديم",
    "الجيران",
    "صديق مشترك",
    "دورة مسائية",
  ],
  social_platforms: ["إنستغرام", "تيك توك", "فيسبوك", "واتساب", "سناب شات"],
  medical_conditions_benign: [
    { name: "حساسية موسمية", notes: "بتزيد بالربيع؛ أحياناً بحب مضاد هيستامين." },
    { name: "ربو خفيف", notes: "البخاخ نادر؛ آخر مرة من سنة تقريباً." },
    { name: "صداع نصفي", notes: "مرات قليلة بالسنة؛ مع قلة النوم." },
    { name: "نقص فيتامين د سابقاً", notes: "تعالج؛ ما في دواء مستمر." },
  ],
  routine_evening: [
    "بتصفّح التلفون على الكنبة وبنعس عليه",
    "بطعم القطة وبغسل صحون وأروح أنام",
    "برنّ لحدا قصير بعدين بسكت",
    "بسمع بودكاست بالنوم وما بكمله",
  ],
  financial_problem_templates: [
    "الإيجار والفواتير بياخدوا أغلب الراتب",
    "دين بطاقة من الشتاء لسا مفتوح",
    "قسط الجامعة بنفس أسبوع الإيجار",
    "الدخل غير ثابت من الشغل الحر",
    "بساعد أحد من العيلة لما يطلب",
  ],
};

export function localePackFor(locale: string): LocalePack {
  const l = locale.toLowerCase();
  if (l.startsWith("ar")) return AR_JO;
  return EN_US;
}

export function isArabicLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith("ar");
}
