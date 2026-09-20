"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ADMIN_NAV_SECTIONS,
  type AdminNavItemDef,
  type AdminNavSectionDef,
} from "@/lib/admin/admin-nav";

const COLLAPSED_KEY = "vpsych.admin.sidebar.collapsed";
const EXPANDED_KEY = "vpsych.admin.nav.expanded";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function readExpanded(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EXPANDED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

function isItemActive(item: AdminNavItemDef, pathname: string) {
  return item.match ? item.match(pathname) : pathname === item.href;
}

function sectionContainsActive(
  section: AdminNavSectionDef,
  pathname: string,
) {
  return section.items.some((item) => isItemActive(item, pathname));
}

export function useAdminSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
    setExpanded(readExpanded());
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleSection(id: string, fallback: boolean) {
    setExpanded((prev) => {
      const current = prev[id] ?? fallback;
      const next = { ...prev, [id]: !current };
      try {
        window.localStorage.setItem(EXPANDED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function isSectionOpen(section: AdminNavSectionDef, pathname: string) {
    if (sectionContainsActive(section, pathname)) return true;
    if (!hydrated) return section.defaultOpen !== false;
    if (section.id in expanded) return expanded[section.id]!;
    return section.defaultOpen !== false;
  }

  return {
    collapsed,
    toggleCollapsed,
    toggleSection,
    isSectionOpen,
    hydrated,
  };
}

export function AdminNavLink({
  item,
  pathname,
  collapsed,
  compact,
}: {
  item: AdminNavItemDef;
  pathname: string;
  collapsed?: boolean;
  compact?: boolean;
}) {
  const tNav = useTranslations("nav");
  const active = isItemActive(item, pathname);
  const label = tNav(item.labelKey as "overview");

  return (
    <Link
      href={item.href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-lg transition-colors duration-200 ${
        active
          ? "bg-[var(--surface-container)] font-semibold text-[var(--primary)]"
          : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--primary)]"
      } ${
        compact
          ? "flex-col gap-1 px-2 py-2 text-[10px]"
          : collapsed
            ? "justify-center px-2 py-3"
            : "px-3 py-2.5 text-sm"
      }`}
    >
      <span
        className="material-symbols-outlined text-[22px]"
        style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
        aria-hidden
      >
        {item.icon}
      </span>
      {!collapsed || compact ? (
        <span className={compact ? "font-medium tracking-wide" : "truncate"}>
          {label}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </Link>
  );
}

export function AdminSidebarNav({
  collapsed,
  isSectionOpen,
  toggleSection,
}: {
  collapsed: boolean;
  isSectionOpen: (section: AdminNavSectionDef, pathname: string) => boolean;
  toggleSection: (id: string, fallback: boolean) => void;
}) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");

  return (
    <nav className="flex-1 space-y-3 overflow-y-auto px-2" aria-label="Admin">
      {ADMIN_NAV_SECTIONS.map((section) => {
        const open = isSectionOpen(section, pathname);
        const label = section.labelKey
          ? tNav(section.labelKey as "sectionContent")
          : "";

        if (!section.labelKey) {
          return (
            <div key={section.id} className="space-y-1">
              {section.items.map((item) => (
                <AdminNavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                />
              ))}
            </div>
          );
        }

        return (
          <div key={section.id}>
            {collapsed ? (
              <div className="mb-1 space-y-1">
                {section.items.map((item) => (
                  <AdminNavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed
                  />
                ))}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="mb-1 flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-start text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)] hover:bg-[var(--surface-container-low)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  aria-expanded={open}
                  onClick={() =>
                    toggleSection(section.id, section.defaultOpen !== false)
                  }
                >
                  <span>{label}</span>
                  <span
                    className={`material-symbols-outlined text-[16px] transition-transform ${
                      open ? "rotate-0" : "-rotate-90 rtl:rotate-90"
                    }`}
                    aria-hidden
                  >
                    expand_more
                  </span>
                </button>
                {open ? (
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <AdminNavLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        collapsed={false}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminMobilePrimaryNav() {
  const pathname = usePathname();
  const items = useMemo(() => {
    const flat = ADMIN_NAV_SECTIONS.flatMap((s) => s.items);
    const pick = [
      "/admin",
      "/admin/avatars",
      "/admin/reports",
      "/admin/curriculum",
      "/admin/diagnostics",
    ];
    return pick
      .map((href) => flat.find((i) => i.href === href))
      .filter((x): x is AdminNavItemDef => Boolean(x));
  }, []);

  return (
    <>
      {items.map((item) => (
        <AdminNavLink
          key={item.href}
          item={item}
          pathname={pathname}
          compact
        />
      ))}
    </>
  );
}
