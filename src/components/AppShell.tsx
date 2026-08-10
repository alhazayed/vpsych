"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  match?: (pathname: string) => boolean;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

function therapistNav(
  t: (key: string) => string,
  therapyRoomEnabled: boolean,
): NavItem[] {
  return [
    {
      href: "/avatars",
      label: t("patientLibrary"),
      icon: "library_books",
      match: (p) => p.startsWith("/avatars"),
    },
    ...(therapyRoomEnabled
      ? [
          {
            href: "/clinic",
            label: t("clinic"),
            icon: "local_hospital",
            match: (p: string) => p.startsWith("/clinic"),
          } satisfies NavItem,
        ]
      : []),
    {
      href: "/sessions",
      label: t("mySessions"),
      icon: "clinical_notes",
      match: (p) => p.startsWith("/sessions"),
    },
    {
      href: "/learning",
      label: t("adaptiveLearning"),
      icon: "auto_graph",
      match: (p) => p === "/learning" || p.startsWith("/learning?"),
    },
    {
      href: "/learning/graph",
      label: t("competencyGraph"),
      icon: "account_tree",
      match: (p) => p.startsWith("/learning/graph"),
    },
    {
      href: "/learning/supervisor",
      label: t("supervisorAi"),
      icon: "psychology",
      match: (p) => p.startsWith("/learning/supervisor"),
    },
    {
      href: "/feedback",
      label: t("institutionalFeedback"),
      icon: "rate_review",
      match: (p) => p === "/feedback" || p.startsWith("/feedback?"),
    },
  ];
}

/** Task-oriented admin IA (Phase 2). Old routes remain valid. */
function adminNavSections(t: (key: string) => string): NavSection[] {
  return [
    {
      id: "home",
      label: "",
      items: [
        {
          href: "/admin",
          label: t("adminHome"),
          icon: "dashboard",
          match: (p) => p === "/admin",
        },
      ],
    },
    {
      id: "content",
      label: t("sectionContent"),
      items: [
        {
          href: "/admin/avatars",
          label: t("virtualPatients"),
          icon: "psychology",
          match: (p) => p.startsWith("/admin/avatars"),
        },
        {
          href: "/admin/voices",
          label: t("voices"),
          icon: "record_voice_over",
          match: (p) => p.startsWith("/admin/voices"),
        },
        {
          href: "/admin/cases",
          label: t("cases"),
          icon: "biotech",
          match: (p) => p.startsWith("/admin/cases"),
        },
        {
          href: "/admin/templates",
          label: t("templates"),
          icon: "schema",
          match: (p) => p.startsWith("/admin/templates"),
        },
        {
          href: "/admin/presets",
          label: t("presets"),
          icon: "school",
          match: (p) => p.startsWith("/admin/presets"),
        },
      ],
    },
    {
      id: "learners",
      label: t("sectionLearners"),
      items: [
        {
          href: "/admin/reports",
          label: t("reports"),
          icon: "folder_shared",
          match: (p) => p.startsWith("/admin/reports"),
        },
        {
          href: "/admin/curriculum",
          label: t("learnersProgress"),
          icon: "timeline",
          match: (p) => p.startsWith("/admin/curriculum"),
        },
        {
          href: "/admin/graph",
          label: t("competencies"),
          icon: "account_tree",
          match: (p) => p.startsWith("/admin/graph"),
        },
      ],
    },
    {
      id: "research",
      label: t("sectionResearch"),
      items: [
        {
          href: "/admin/research",
          label: t("validation"),
          icon: "science",
          match: (p) => p.startsWith("/admin/research"),
        },
      ],
    },
    {
      id: "organization",
      label: t("sectionOrganization"),
      items: [
        {
          href: "/admin/enterprise",
          label: t("enterprise"),
          icon: "domain",
          match: (p) => p.startsWith("/admin/enterprise"),
        },
        {
          href: "/admin/feedback",
          label: t("feedback"),
          icon: "inbox",
          match: (p) => p.startsWith("/admin/feedback"),
        },
      ],
    },
    {
      id: "system",
      label: t("sectionSystem"),
      items: [
        {
          href: "/admin/cidp",
          label: t("operations"),
          icon: "monitoring",
          match: (p) => p.startsWith("/admin/cidp"),
        },
        {
          href: "/admin/diagnostics",
          label: t("diagnostics"),
          icon: "settings_suggest",
          match: (p) =>
            p.startsWith("/admin/diagnostics") ||
            p.startsWith("/admin/supervisor") ||
            p.startsWith("/admin/personality"),
        },
      ],
    },
  ];
}

function flattenAdminNav(sections: NavSection[]): NavItem[] {
  return sections.flatMap((s) => s.items);
}

function NavLink({
  item,
  pathname,
  compact,
}: {
  item: NavItem;
  pathname: string;
  compact?: boolean;
}) {
  const active = item.match ? item.match(pathname) : pathname === item.href;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors duration-200 ${
        active
          ? "bg-[var(--surface-container)] font-semibold text-[var(--primary)]"
          : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--primary)]"
      } ${compact ? "flex-col gap-1 px-2 py-2 text-[10px]" : "text-sm"}`}
    >
      <span
        className="material-symbols-outlined text-[22px]"
        style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {item.icon}
      </span>
      <span className={compact ? "font-medium tracking-wide" : ""}>
        {item.label}
      </span>
    </Link>
  );
}

export function AppShell({
  profile,
  therapyRoomEnabled = false,
  children,
}: {
  profile: Profile;
  therapyRoomEnabled?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tNav = useTranslations("nav");
  const tShell = useTranslations("shell");
  const isImmersiveSession =
    (/^\/sessions\/[^/]+$/.test(pathname) && !pathname.endsWith("/complete")) ||
    /^\/clinic\/room\/[^/]+$/.test(pathname);

  const isAdminArea =
    profile.role === "admin" && pathname.startsWith("/admin");

  const adminSections =
    profile.role === "admin" ? adminNavSections(tNav) : [];
  const adminFlat = flattenAdminNav(adminSections);

  const therapistItems = [
    ...therapistNav(tNav, therapyRoomEnabled),
    ...(profile.role === "admin"
      ? [
          {
            href: "/admin",
            label: tNav("adminHome"),
            icon: "admin_panel_settings",
            match: (p: string) => p.startsWith("/admin"),
          } satisfies NavItem,
        ]
      : []),
  ];

  const mobileNav = isAdminArea
    ? [
        adminFlat.find((i) => i.href === "/admin")!,
        adminFlat.find((i) => i.href === "/admin/avatars")!,
        adminFlat.find((i) => i.href === "/admin/reports")!,
        adminFlat.find((i) => i.href === "/admin/feedback")!,
        adminFlat.find((i) => i.href === "/admin/diagnostics")!,
      ].filter(Boolean)
    : therapistItems;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function pageTitle() {
    if (pathname === "/admin") return tShell("pageTitle.adminHome");
    if (pathname.startsWith("/admin/diagnostics"))
      return tShell("pageTitle.diagnostics");
    if (pathname.startsWith("/admin/reports"))
      return tShell("pageTitle.reportsLibrary");
    if (pathname.startsWith("/admin/avatars"))
      return tShell("pageTitle.virtualPatients");
    if (pathname.startsWith("/admin/personality"))
      return tShell("pageTitle.humanPersonality");
    if (pathname.startsWith("/admin/voices"))
      return tShell("pageTitle.voices");
    if (pathname.startsWith("/admin/cases"))
      return tShell("pageTitle.cases");
    if (pathname.startsWith("/admin/templates"))
      return tShell("pageTitle.templates");
    if (pathname.startsWith("/admin/presets"))
      return tShell("pageTitle.presets");
    if (pathname.startsWith("/admin/curriculum"))
      return tShell("pageTitle.learnersProgress");
    if (pathname.startsWith("/admin/graph"))
      return tShell("pageTitle.competencies");
    if (pathname.startsWith("/learning/supervisor"))
      return tShell("pageTitle.supervisorAi");
    if (pathname.startsWith("/learning/graph"))
      return tShell("pageTitle.competencyGraph");
    if (pathname.startsWith("/learning"))
      return tShell("pageTitle.adaptiveLearning");
    if (pathname.startsWith("/admin/supervisor"))
      return tShell("pageTitle.supervisorAi");
    if (pathname.startsWith("/admin/enterprise"))
      return tShell("pageTitle.enterprise");
    if (pathname.startsWith("/admin/cidp"))
      return tShell("pageTitle.operations");
    if (pathname.startsWith("/admin/feedback"))
      return tShell("pageTitle.feedbackQueue");
    if (pathname.startsWith("/feedback"))
      return tShell("pageTitle.institutionalFeedback");
    if (pathname.startsWith("/admin/research"))
      return tShell("pageTitle.validation");
    if (pathname.startsWith("/clinic")) return tShell("pageTitle.clinic");
    if (pathname.startsWith("/sessions")) return tShell("pageTitle.mySessions");
    return tShell("pageTitle.patientLibrary");
  }

  if (isImmersiveSession) {
    return <div className="min-h-screen bg-[var(--background)]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--on-surface)]">
      <aside className="fixed start-0 top-0 z-50 hidden h-screen w-64 flex-col border-e border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-6 md:flex">
        <div className="mb-8 px-6">
          <Link
            href={isAdminArea ? "/admin" : "/avatars"}
            className="flex items-center gap-3"
          >
            <Image
              src="/vpsych-logo.png"
              alt="VPsych"
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-cover"
              priority
            />
            <div>
              <p className="font-[family-name:var(--font-headline)] text-lg font-bold tracking-tight text-[var(--primary)]">
                VPsych
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--on-surface-variant)] opacity-70">
                {isAdminArea ? tShell("adminTagline") : tShell("tagline")}
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2">
          {isAdminArea ? (
            adminSections.map((section) => (
              <div key={section.id}>
                {section.label ? (
                  <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
                    {section.label}
                  </p>
                ) : null}
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            therapistItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))
          )}
        </nav>

        <div className="space-y-3 border-t border-[var(--outline-variant)] px-4 pt-4">
          <div className="px-2">
            <p className="truncate text-sm font-semibold text-[var(--on-surface)]">
              {profile.display_name}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
              {profile.role === "admin"
                ? tShell("role.admin")
                : tShell("role.therapist")}
            </p>
          </div>
          {isAdminArea ? (
            <Link href="/avatars" className="btn-secondary w-full">
              <span className="material-symbols-outlined text-[20px]">
                school
              </span>
              {tShell("therapistWorkspace")}
            </Link>
          ) : (
            <Link href="/avatars" className="btn-primary w-full">
              <span className="material-symbols-outlined text-[20px]">add</span>
              {tShell("newAssessment")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="btn-secondary w-full"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            {tShell("signOut")}
          </button>
        </div>
      </aside>

      <header className="fixed start-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 shadow-sm md:hidden">
        <Link
          href={isAdminArea ? "/admin" : "/avatars"}
          className="flex items-center gap-2"
        >
          <Image
            src="/vpsych-logo.png"
            alt="VPsych"
            width={32}
            height={32}
            className="h-8 w-8 rounded-md object-cover"
          />
          <span className="font-[family-name:var(--font-headline)] text-lg font-bold text-[var(--primary)]">
            VPsych
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)]"
          >
            {tShell("signOut")}
          </button>
        </div>
      </header>

      <div className="md:ms-64">
        <header className="sticky top-0 z-40 hidden h-16 items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface)] px-8 md:flex">
          <p className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
            {pageTitle()}
          </p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="text-end">
              <p className="text-sm font-bold text-[var(--on-surface)]">
                {profile.display_name}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
                {profile.role === "admin"
                  ? tShell("role.clinicalSupervisor")
                  : tShell("role.therapist")}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--primary-fixed)] bg-[var(--surface-container)] font-[family-name:var(--font-headline)] text-sm font-bold text-[var(--primary)]">
              {profile.display_name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="pb-24 pt-16 md:pb-0 md:pt-0">{children}</div>
      </div>

      <nav className="fixed bottom-0 start-0 z-50 flex h-20 w-full items-center justify-around border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] md:hidden">
        {mobileNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} compact />
        ))}
      </nav>
    </div>
  );
}
