"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  match?: (pathname: string) => boolean;
};

function therapistNav(): NavItem[] {
  return [
    {
      href: "/avatars",
      label: "Patient Library",
      icon: "library_books",
      match: (p) => p.startsWith("/avatars"),
    },
    {
      href: "/sessions",
      label: "My Sessions",
      icon: "clinical_notes",
      match: (p) => p.startsWith("/sessions"),
    },
  ];
}

function adminNav(): NavItem[] {
  return [
    {
      href: "/admin/reports",
      label: "Reports Library",
      icon: "folder_shared",
      match: (p) => p.startsWith("/admin/reports"),
    },
    {
      href: "/admin/avatars",
      label: "Avatar Presets",
      icon: "psychology",
      match: (p) => p.startsWith("/admin/avatars"),
    },
    {
      href: "/admin/integrations",
      label: "API Integrations",
      icon: "api",
      match: (p) => p.startsWith("/admin/integrations"),
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
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isImmersiveSession =
    /^\/sessions\/[^/]+$/.test(pathname) && !pathname.endsWith("/complete");

  const nav = [
    ...therapistNav(),
    ...(profile.role === "admin" ? adminNav() : []),
  ];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (isImmersiveSession) {
    return <div className="min-h-screen bg-[var(--background)]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--on-surface)]">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col border-r border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-6 md:flex">
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
                Clinical Intelligence
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
              {profile.role === "admin" ? "Administrator" : "Therapist"}
            </p>
          </div>
          <Link href="/avatars" className="btn-primary w-full">
            <span className="material-symbols-outlined text-[20px]">add</span>
            New Assessment
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="btn-secondary w-full"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed left-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 shadow-sm md:hidden">
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
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-xs font-medium text-[var(--on-surface-variant)]"
        >
          Sign out
        </button>
      </header>

      <div className="md:ml-64">
        <header className="sticky top-0 z-40 hidden h-16 items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface)] px-8 md:flex">
          <p className="font-[family-name:var(--font-headline)] text-xl font-semibold text-[var(--on-surface)]">
            {pathname.startsWith("/admin/integrations")
              ? "API Integrations"
              : pathname.startsWith("/admin/reports")
                ? "Reports Library"
                : pathname.startsWith("/admin/avatars")
                  ? "Avatar Presets"
                  : pathname.startsWith("/sessions")
                    ? "My Sessions"
                    : "Virtual Patient Library"}
          </p>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-[var(--on-surface)]">
                {profile.display_name}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
                {profile.role === "admin" ? "Clinical Supervisor" : "Therapist"}
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
      <nav className="fixed bottom-0 left-0 z-50 flex h-20 w-full items-center justify-around border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] md:hidden">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} compact />
        ))}
      </nav>
    </div>
  );
}
