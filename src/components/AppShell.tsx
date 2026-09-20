"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";
import {
  AdminMobilePrimaryNav,
  AdminSidebarNav,
  useAdminSidebarState,
} from "@/components/admin/AdminSidebarNav";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { flattenAdminNav } from "@/lib/admin/admin-nav";

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
    {
      href: "/feedback",
      label: t("institutionalFeedback"),
      icon: "rate_review",
      match: (p) => p === "/feedback" || p.startsWith("/feedback?"),
    },
  ];
}

function TherapistNavLink({
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
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors duration-200 ${
        active
          ? "bg-[var(--surface-container)] font-semibold text-[var(--primary)]"
          : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--primary)]"
      } ${compact ? "flex-col gap-1 px-2 py-2 text-[10px]" : "text-sm"}`}
    >
      <span
        className="material-symbols-outlined text-[22px]"
        style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
        aria-hidden
      >
        {item.icon}
      </span>
      <span className={compact ? "font-medium tracking-wide" : ""}>
        {item.label}
      </span>
    </Link>
  );
}

function pageTitleKey(pathname: string): string {
  if (pathname === "/admin") return "overview";
  if (pathname.startsWith("/admin/diagnostics")) return "systemHealth";
  if (pathname.startsWith("/admin/reports")) return "reportsLibrary";
  if (pathname.startsWith("/admin/avatars")) return "virtualPatients";
  if (pathname.startsWith("/admin/personality")) return "humanPersonality";
  if (pathname.startsWith("/admin/voices")) return "voices";
  if (pathname.startsWith("/admin/cases")) return "cases";
  if (pathname.startsWith("/admin/templates")) return "templates";
  if (pathname.startsWith("/admin/presets")) return "presets";
  if (pathname.startsWith("/admin/curriculum")) return "learnersProgress";
  if (pathname.startsWith("/admin/graph")) return "competencies";
  if (pathname.startsWith("/learning/supervisor")) return "supervisorAi";
  if (pathname.startsWith("/learning/graph")) return "competencyGraph";
  if (pathname.startsWith("/learning")) return "adaptiveLearning";
  if (pathname.startsWith("/admin/supervisor")) return "supervisorAi";
  if (pathname.startsWith("/admin/enterprise")) return "enterprise";
  if (pathname.startsWith("/admin/cidp")) return "operations";
  if (pathname.startsWith("/admin/feedback")) return "feedbackQueue";
  if (pathname.startsWith("/feedback")) return "institutionalFeedback";
  if (pathname.startsWith("/admin/research")) return "validation";
  if (pathname.startsWith("/admin/test-sessions")) return "testTranscript";
  if (pathname.startsWith("/clinic")) return "clinic";
  if (pathname.startsWith("/sessions")) return "mySessions";
  return "patientLibrary";
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const {
    collapsed,
    toggleCollapsed,
    toggleSection,
    isSectionOpen,
  } = useAdminSidebarState();

  const isImmersiveSession =
    (/^\/sessions\/[^/]+$/.test(pathname) && !pathname.endsWith("/complete")) ||
    /^\/clinic\/room\/[^/]+$/.test(pathname);

  const isAdminArea =
    profile.role === "admin" && pathname.startsWith("/admin");

  const therapistItems = [
    ...therapistNav(tNav, therapyRoomEnabled),
    ...(profile.role === "admin"
      ? [
          {
            href: "/admin",
            label: tNav("overview"),
            icon: "admin_panel_settings",
            match: (p: string) => p.startsWith("/admin"),
          } satisfies NavItem,
        ]
      : []),
  ];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const titleKey = pageTitleKey(pathname);
  const pageTitle = tShell(
    `pageTitle.${titleKey}` as
      | "pageTitle.overview"
      | "pageTitle.patientLibrary"
      | "pageTitle.systemHealth"
      | "pageTitle.reportsLibrary"
      | "pageTitle.virtualPatients"
      | "pageTitle.humanPersonality"
      | "pageTitle.voices"
      | "pageTitle.cases"
      | "pageTitle.templates"
      | "pageTitle.presets"
      | "pageTitle.learnersProgress"
      | "pageTitle.competencies"
      | "pageTitle.supervisorAi"
      | "pageTitle.competencyGraph"
      | "pageTitle.adaptiveLearning"
      | "pageTitle.enterprise"
      | "pageTitle.operations"
      | "pageTitle.feedbackQueue"
      | "pageTitle.institutionalFeedback"
      | "pageTitle.validation"
      | "pageTitle.testTranscript"
      | "pageTitle.clinic"
      | "pageTitle.mySessions",
  );

  const sidebarWidth = collapsed ? "md:w-[4.5rem]" : "md:w-64";
  const contentOffset = collapsed ? "md:ms-[4.5rem]" : "md:ms-64";

  if (isImmersiveSession) {
    return <div className="min-h-screen bg-[var(--background)]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--on-surface)]">
      {isAdminArea ? (
        <AdminCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      ) : null}

      {/* Desktop sidebar */}
      <aside
        className={`fixed start-0 top-0 z-50 hidden h-screen flex-col border-e border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-5 transition-[width] duration-200 md:flex ${sidebarWidth}`}
      >
        <div className={`mb-6 ${collapsed ? "px-2" : "px-5"}`}>
          <div className="flex items-center gap-2">
            <Link
              href={isAdminArea ? "/admin" : "/avatars"}
              className={`flex min-w-0 items-center gap-3 ${collapsed ? "justify-center" : ""}`}
            >
              <Image
                src="/vpsych-logo.png"
                alt="VPsych"
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
                priority
              />
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="font-[family-name:var(--font-headline)] text-lg font-bold tracking-tight text-[var(--primary)]">
                    VPsych
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--on-surface-variant)] opacity-70">
                    {isAdminArea ? tShell("adminTagline") : tShell("tagline")}
                  </p>
                </div>
              ) : null}
            </Link>
            {isAdminArea ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                className={`rounded-lg p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${collapsed ? "mx-auto" : "ms-auto"}`}
                aria-label={
                  collapsed
                    ? tShell("sidebar.expand")
                    : tShell("sidebar.collapse")
                }
                title={
                  collapsed
                    ? tShell("sidebar.expand")
                    : tShell("sidebar.collapse")
                }
              >
                <span
                  className="material-symbols-outlined text-[20px] rtl:scale-x-[-1]"
                  aria-hidden
                >
                  {collapsed
                    ? "keyboard_double_arrow_right"
                    : "keyboard_double_arrow_left"}
                </span>
              </button>
            ) : null}
          </div>
        </div>

        {isAdminArea ? (
          <AdminSidebarNav
            collapsed={collapsed}
            isSectionOpen={isSectionOpen}
            toggleSection={toggleSection}
          />
        ) : (
          <nav className="flex-1 space-y-1 overflow-y-auto px-2">
            {therapistItems.map((item) => (
              <TherapistNavLink
                key={item.href}
                item={item}
                pathname={pathname}
              />
            ))}
          </nav>
        )}

        <div
          className={`space-y-3 border-t border-[var(--outline-variant)] pt-4 ${collapsed ? "px-2" : "px-4"}`}
        >
          {!collapsed ? (
            <div className="px-1">
              <p className="truncate text-sm font-semibold text-[var(--on-surface)]">
                {profile.display_name}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
                {profile.role === "admin"
                  ? tShell("role.admin")
                  : tShell("role.therapist")}
              </p>
            </div>
          ) : null}
          {isAdminArea ? (
            <Link
              href="/avatars"
              className={collapsed ? "btn-secondary justify-center px-2" : "btn-secondary w-full"}
              title={tShell("therapistWorkspace")}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden>
                school
              </span>
              {!collapsed ? tShell("therapistWorkspace") : null}
            </Link>
          ) : (
            <Link href="/avatars" className="btn-primary w-full">
              <span className="material-symbols-outlined text-[20px]" aria-hidden>
                add
              </span>
              {tShell("newAssessment")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className={collapsed ? "btn-secondary w-full justify-center px-2" : "btn-secondary w-full"}
            title={tShell("signOut")}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              logout
            </span>
            {!collapsed ? tShell("signOut") : null}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed start-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 shadow-sm md:hidden">
        <div className="flex items-center gap-2">
          {isAdminArea ? (
            <button
              type="button"
              className="rounded-lg p-2 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
              aria-label={tShell("sidebar.openMenu")}
              onClick={() => setMobileDrawerOpen(true)}
            >
              <span className="material-symbols-outlined" aria-hidden>
                menu
              </span>
            </button>
          ) : null}
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
        </div>
        <div className="flex items-center gap-2">
          {isAdminArea ? (
            <button
              type="button"
              className="rounded-lg border border-[var(--outline-variant)] p-2 text-[var(--on-surface-variant)]"
              aria-label={tShell("commandPalette.title")}
              onClick={() => setCommandOpen(true)}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden>
                search
              </span>
            </button>
          ) : null}
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

      {/* Mobile admin drawer */}
      {isAdminArea && mobileDrawerOpen ? (
        <div className="fixed inset-0 z-[70] md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--on-surface)_40%,transparent)]"
            aria-label={tShell("sidebar.closeMenu")}
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 flex w-[min(20rem,88vw)] flex-col bg-[var(--surface-container-lowest)] shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--outline-variant)] px-4 py-3">
              <p className="font-[family-name:var(--font-headline)] font-bold text-[var(--primary)]">
                VPsych
              </p>
              <button
                type="button"
                className="rounded-lg p-2"
                aria-label={tShell("sidebar.closeMenu")}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  close
                </span>
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto py-3"
              onClick={() => setMobileDrawerOpen(false)}
            >
              <AdminSidebarNav
                collapsed={false}
                isSectionOpen={isSectionOpen}
                toggleSection={toggleSection}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className={`transition-[margin] duration-200 ${isAdminArea ? contentOffset : "md:ms-64"}`}>
        <header className="sticky top-0 z-40 hidden h-16 items-center justify-between gap-4 border-b border-[var(--outline-variant)] bg-[var(--surface)] px-6 lg:px-8 md:flex">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)] truncate">
              {pageTitle}
            </p>
            {isAdminArea ? (
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--outline)]">
                {tShell("adminConsole")}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {isAdminArea ? (
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden items-center gap-2 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-2 text-sm text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] lg:inline-flex"
                aria-label={tShell("commandPalette.title")}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden>
                  search
                </span>
                <span>{tShell("commandPalette.trigger")}</span>
                <kbd className="rounded border border-[var(--outline-variant)] px-1.5 py-0.5 text-[10px]">
                  ⌘K
                </kbd>
              </button>
            ) : null}
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
        {isAdminArea ? (
          <AdminMobilePrimaryNav />
        ) : (
          therapistItems.slice(0, 5).map((item) => (
            <TherapistNavLink
              key={item.href}
              item={item}
              pathname={pathname}
              compact
            />
          ))
        )}
      </nav>
    </div>
  );
}

/** Kept for tests / tooling that inspect shell nav destinations. */
export function adminNavHrefSnapshot(): string[] {
  return flattenAdminNav().map((i) => i.href);
}
