/**
 * Admin console navigation — hierarchical IA mapped to existing routes.
 * Labels are i18n keys under `nav.*` (passed through a translator at render time).
 */

export type AdminNavItemDef = {
  href: string;
  /** Key under `nav` */
  labelKey: string;
  icon: string;
  /** Optional keywords for command palette (English; matching is locale-agnostic) */
  keywords?: string[];
  match?: (pathname: string) => boolean;
};

export type AdminNavSectionDef = {
  id: string;
  /** Key under `nav`; empty string = no section header */
  labelKey: string;
  /** Default expanded when no persisted preference */
  defaultOpen?: boolean;
  items: AdminNavItemDef[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSectionDef[] = [
  {
    id: "overview",
    labelKey: "",
    defaultOpen: true,
    items: [
      {
        href: "/admin",
        labelKey: "overview",
        icon: "dashboard",
        keywords: ["home", "dashboard", "overview"],
        match: (p) => p === "/admin",
      },
    ],
  },
  {
    id: "learning",
    labelKey: "sectionLearning",
    defaultOpen: true,
    items: [
      {
        href: "/admin/curriculum",
        labelKey: "learnersProgress",
        icon: "timeline",
        keywords: ["learners", "ace", "curriculum", "progress"],
        match: (p) => p.startsWith("/admin/curriculum"),
      },
      {
        href: "/admin/graph",
        labelKey: "competencies",
        icon: "account_tree",
        keywords: ["cge", "competency", "graph", "mastery"],
        match: (p) => p.startsWith("/admin/graph"),
      },
    ],
  },
  {
    id: "simulations",
    labelKey: "sectionSimulations",
    defaultOpen: true,
    items: [
      {
        href: "/admin/sessions",
        labelKey: "sessions",
        icon: "clinical_notes",
        keywords: ["sessions", "simulations", "transcript", "active"],
        match: (p) => p.startsWith("/admin/sessions"),
      },
    ],
  },
  {
    id: "assessment",
    labelKey: "sectionAssessment",
    defaultOpen: true,
    items: [
      {
        href: "/admin/reports",
        labelKey: "performanceReports",
        icon: "assignment",
        keywords: ["reports", "assessment", "scores"],
        match: (p) => p.startsWith("/admin/reports"),
      },
    ],
  },
  {
    id: "content",
    labelKey: "sectionContent",
    defaultOpen: true,
    items: [
      {
        href: "/admin/content",
        labelKey: "contentLibrary",
        icon: "inventory_2",
        keywords: ["content", "library", "hub"],
        match: (p) => p === "/admin/content",
      },
      {
        href: "/admin/avatars",
        labelKey: "virtualPatients",
        icon: "psychology",
        keywords: ["avatars", "personas", "patients", "content"],
        match: (p) => p.startsWith("/admin/avatars"),
      },
      {
        href: "/admin/voices",
        labelKey: "voices",
        icon: "record_voice_over",
        keywords: ["tts", "elevenlabs", "voice"],
        match: (p) => p.startsWith("/admin/voices"),
      },
      {
        href: "/admin/cases",
        labelKey: "cases",
        icon: "biotech",
        keywords: ["disorders", "case engine"],
        match: (p) => p.startsWith("/admin/cases"),
      },
      {
        href: "/admin/templates",
        labelKey: "templates",
        icon: "schema",
        keywords: ["scenario", "templates"],
        match: (p) => p.startsWith("/admin/templates"),
      },
      {
        href: "/admin/presets",
        labelKey: "presets",
        icon: "school",
        keywords: ["instructor", "presets"],
        match: (p) => p.startsWith("/admin/presets"),
      },
    ],
  },
  {
    id: "organization",
    labelKey: "sectionOrganization",
    defaultOpen: false,
    items: [
      {
        href: "/admin/enterprise",
        labelKey: "enterprise",
        icon: "domain",
        keywords: ["organization", "tenant", "enterprise", "members"],
        match: (p) => p.startsWith("/admin/enterprise"),
      },
      {
        href: "/admin/feedback",
        labelKey: "feedback",
        icon: "inbox",
        keywords: ["feedback", "triage", "queue"],
        match: (p) => p.startsWith("/admin/feedback"),
      },
    ],
  },
  {
    id: "analytics",
    labelKey: "sectionAnalytics",
    defaultOpen: false,
    items: [
      {
        href: "/admin/analytics",
        labelKey: "analyticsOverview",
        icon: "insights",
        keywords: ["analytics", "usage", "trends", "metrics"],
        match: (p) => p.startsWith("/admin/analytics"),
      },
    ],
  },
  {
    id: "research",
    labelKey: "sectionResearch",
    defaultOpen: false,
    items: [
      {
        href: "/admin/research",
        labelKey: "validation",
        icon: "science",
        keywords: ["research", "validation", "reliability"],
        match: (p) => p.startsWith("/admin/research"),
      },
    ],
  },
  {
    id: "system",
    labelKey: "sectionSystem",
    defaultOpen: false,
    items: [
      {
        href: "/admin/cidp",
        labelKey: "operations",
        icon: "monitoring",
        keywords: ["cidp", "ops", "operations", "metrics"],
        match: (p) => p.startsWith("/admin/cidp"),
      },
      {
        href: "/admin/diagnostics",
        labelKey: "systemHealth",
        icon: "health_and_safety",
        keywords: ["health", "diagnostics", "system"],
        match: (p) =>
          p.startsWith("/admin/diagnostics") ||
          p.startsWith("/admin/supervisor") ||
          p.startsWith("/admin/personality"),
      },
    ],
  },
];

export function flattenAdminNav(
  sections: AdminNavSectionDef[] = ADMIN_NAV_SECTIONS,
): AdminNavItemDef[] {
  return sections.flatMap((s) => s.items);
}

export function findAdminNavItem(
  pathname: string,
  sections: AdminNavSectionDef[] = ADMIN_NAV_SECTIONS,
): AdminNavItemDef | undefined {
  const flat = flattenAdminNav(sections);
  return (
    flat.find((item) =>
      item.match ? item.match(pathname) : pathname === item.href,
    ) ??
    flat.find(
      (item) => pathname.startsWith(item.href) && item.href !== "/admin",
    )
  );
}

/** Simple case-insensitive substring / keyword match for command palette. */
export function filterAdminNavItems(
  query: string,
  resolveLabel: (labelKey: string) => string,
  sections: AdminNavSectionDef[] = ADMIN_NAV_SECTIONS,
): AdminNavItemDef[] {
  const q = query.trim().toLowerCase();
  const items = flattenAdminNav(sections);
  if (!q) return items;
  return items.filter((item) => {
    const label = resolveLabel(item.labelKey).toLowerCase();
    const href = item.href.toLowerCase();
    const keys = (item.keywords ?? []).join(" ").toLowerCase();
    return label.includes(q) || href.includes(q) || keys.includes(q);
  });
}
