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
  ];
}

function adminNav(t: (key: string) => string): NavItem[] {
  return [
    {
      href: "/admin/reports",
      label: t("reportsLibrary"),
      icon: "folder_shared",
      match: (p) => p.startsWith("/admin/reports"),
    },
    {
      href: "/admin/avatars",
      label: t("avatarPresets"),
      icon: "psychology",
      match: (p) => p.startsWith("/admin/avatars"),
    },
    {
      href: "/admin/personality",
      label: t("humanPersonality"),
      icon: "face",
      match: (p) => p.startsWith("/admin/personality"),
    },
    {
      href: "/admin/voices",
      label: t("voiceManagement"),
      icon: "record_voice_over",
      match: (p) => p.startsWith("/admin/voices"),
    },
    {
      href: "/admin/cases",
      label: t("caseEngine"),
      icon: "biotech",
      match: (p) => p.startsWith("/admin/cases"),
    },
    {
      href: "/admin/templates",
      label: t("scenarioTemplates"),
      icon: "schema",
      match: (p) => p.startsWith("/admin/templates"),
    },
    {
      href: "/admin/presets",
      label: t("instructorPresets"),
      icon: "school",
      match: (p) => p.startsWith("/admin/presets"),
    },
    {
      href: "/admin/curriculum",
      label: t("adaptiveCurriculum"),
      icon: "timeline",
      match: (p) => p.startsWith("/admin/curriculum"),
    },
    {
      href: "/admin/graph",
      label: t("competencyGraph"),
      icon: "account_tree",
      match: (p) => p.startsWith("/admin/graph"),
    },
    {
      href: "/admin/research",
      label: t("researchValidation"),
      icon: "science",
      match: (p) => p.startsWith("/admin/research"),
    },
    {
      href: "/admin/supervisor",
      label: t("supervisorAi"),
      icon: "supervisor_account",
      match: (p) => p.startsWith("/admin/supervisor"),
    },
    {
      href: "/admin/enterprise",
      label: t("enterprisePlatform"),
      icon: "domain",
      match: (p) => p.startsWith("/admin/enterprise"),
    },
  ];
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

  const nav = [
    ...therapistNav(tNav, therapyRoomEnabled),
    ...(profile.role === "admin" ? adminNav(tNav) : []),
  ];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function pageTitle() {
    if (pathname.startsWith("/admin/reports"))
      return tShell("pageTitle.reportsLibrary");
    if (pathname.startsWith("/admin/avatars"))
      return tShell("pageTitle.avatarPresets");
    if (pathname.startsWith("/admin/personality"))
      return tShell("pageTitle.humanPersonality");
    if (pathname.startsWith("/admin/voices"))
      return tShell("pageTitle.voiceManagement");
    if (pathname.startsWith("/admin/cases"))
      return tShell("pageTitle.caseEngine");
    if (pathname.startsWith("/admin/templates"))
      return tShell("pageTitle.scenarioTemplates");
    if (pathname.startsWith("/admin/presets"))
      return tShell("pageTitle.instructorPresets");
    if (pathname.startsWith("/admin/curriculum"))
      return tShell("pageTitle.adaptiveCurriculum");
    if (pathname.startsWith("/admin/graph"))
      return tShell("pageTitle.competencyGraph");
    if (pathname.startsWith("/learning/supervisor"))
      return tShell("pageTitle.supervisorAi");
    if (pathname.startsWith("/learning/graph"))
      return tShell("pageTitle.competencyGraph");
    if (pathname.startsWith("/learning"))
      return tShell("pageTitle.adaptiveLearning");
    if (pathname.startsWith("/admin/supervisor"))
      return tShell("pageTitle.supervisorAi");
    if (pathname.startsWith("/admin/enterprise"))
      return tShell("pageTitle.enterprisePlatform");
    if (pathname.startsWith("/clinic")) return tShell("pageTitle.clinic");
    if (pathname.startsWith("/sessions")) return tShell("pageTitle.mySessions");
    return tShell("pageTitle.patientLibrary");
  }

  if (isImmersiveSession) {
    return <div className="min-h-screen bg-[var(--background)]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--on-surface)]">
      {/* Desktop sidebar */}
      <aside className="fixed start-0 top-0 z-50 hidden h-screen w-64 flex-col border-e border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-6 md:flex">
        <div className="mb-8 px-6">
          <Link href="/avatars" className="flex items-center gap-3">
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
                {tShell("tagline")}
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-2">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
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
          <Link href="/avatars" className="btn-primary w-full">
            <span className="material-symbols-outlined text-[20px]">add</span>
            {tShell("newAssessment")}
          </Link>
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

      {/* Mobile top bar */}
      <header className="fixed start-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 shadow-sm md:hidden">
        <Link href="/avatars" className="flex items-center gap-2">
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

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 start-0 z-50 flex h-20 w-full items-center justify-around border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] md:hidden">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} compact />
        ))}
      </nav>
    </div>
  );
}
