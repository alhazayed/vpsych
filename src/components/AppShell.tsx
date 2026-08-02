"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

function therapistNav(t: (key: string) => string): NavItem[] {
  return [
    {
      href: "/avatars",
      label: t("patientLibrary"),
      icon: "library_books",
      match: (p) => p.startsWith("/avatars"),
    },
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
  ];
}

function NavLink({
  item,
  pathname,
  compact,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const active = item.match ? item.match(pathname) : pathname === item.href;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
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
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tNav = useTranslations("nav");
  const tShell = useTranslations("shell");
  const isImmersiveSession =
    /^\/sessions\/[^/]+$/.test(pathname) && !pathname.endsWith("/complete");
  const isAdmin = profile.role === "admin";
  const primaryNav = therapistNav(tNav);
  const secondaryNav = isAdmin ? adminNav(tNav) : [];
  const desktopNav = [...primaryNav, ...secondaryNav];
  const [moreOpen, setMoreOpen] = useState(false);
  const adminActive = secondaryNav.some((item) =>
    item.match ? item.match(pathname) : pathname === item.href,
  );

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

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
    if (pathname.startsWith("/learning/graph"))
      return tShell("pageTitle.competencyGraph");
    if (pathname.startsWith("/learning"))
      return tShell("pageTitle.adaptiveLearning");
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

        <nav className="flex-1 space-y-1 overflow-y-auto px-2">
          {desktopNav.map((item) => (
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

      {/* Mobile bottom nav — primary destinations only; admin via More sheet */}
      <nav
        className="fixed bottom-0 start-0 z-50 flex h-20 w-full items-center justify-around border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] md:hidden"
        aria-label={tShell("tagline")}
      >
        {primaryNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            compact
            onNavigate={() => setMoreOpen(false)}
          />
        ))}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] font-medium tracking-wide ${
              adminActive || moreOpen
                ? "text-[var(--primary)]"
                : "text-[var(--on-surface-variant)]"
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={
                adminActive || moreOpen
                  ? { fontVariationSettings: "'FILL' 1" }
                  : undefined
              }
            >
              more_horiz
            </span>
            {tNav("more")}
          </button>
        )}
      </nav>

      {moreOpen && isAdmin && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label={tNav("closeMenu")}
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tNav("adminTools")}
            className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 pb-8 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-[var(--on-surface)]">
                {tNav("adminTools")}
              </p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs font-medium"
              >
                {tNav("closeMenu")}
              </button>
            </div>
            <nav className="space-y-1">
              {secondaryNav.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setMoreOpen(false)}
                />
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
