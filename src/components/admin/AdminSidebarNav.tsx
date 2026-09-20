"use client";

import Link from "next/link";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ADMIN_NAV_SECTIONS,
  type AdminNavItemDef,
  type AdminNavSectionDef,
} from "@/lib/admin/admin-nav";

const COLLAPSED_KEY = "vpsych.admin.sidebar.collapsed";
const EXPANDED_KEY = "vpsych.admin.nav.expanded";

type SidebarSnapshot = {
  collapsed: boolean;
  expanded: Record<string, boolean>;
};

const SERVER_SNAPSHOT: SidebarSnapshot = Object.freeze({
  collapsed: false,
  expanded: Object.freeze({}) as Record<string, boolean>,
});

let clientSnapshot: SidebarSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function sameExpanded(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

function readFromStorage(): SidebarSnapshot {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  try {
    const collapsed = window.localStorage.getItem(COLLAPSED_KEY) === "1";
    let expanded: Record<string, boolean> = {};
    const raw = window.localStorage.getItem(EXPANDED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        expanded = parsed as Record<string, boolean>;
      }
    }
    if (
      clientSnapshot.collapsed === collapsed &&
      sameExpanded(clientSnapshot.expanded, expanded)
    ) {
      return clientSnapshot;
    }
    clientSnapshot = { collapsed, expanded };
    return clientSnapshot;
  } catch {
    return clientSnapshot;
  }
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === COLLAPSED_KEY || e.key === EXPANDED_KEY) {
      readFromStorage();
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): SidebarSnapshot {
  return readFromStorage();
}

function getServerSnapshot(): SidebarSnapshot {
  return SERVER_SNAPSHOT;
}

function writeCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (clientSnapshot.collapsed === next) return;
  clientSnapshot = { ...clientSnapshot, collapsed: next };
  emit();
}

function writeExpanded(next: Record<string, boolean>) {
  try {
    window.localStorage.setItem(EXPANDED_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (sameExpanded(clientSnapshot.expanded, next)) return;
  clientSnapshot = { ...clientSnapshot, expanded: next };
  emit();
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
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggleCollapsed = useCallback(() => {
    writeCollapsed(!getSnapshot().collapsed);
  }, []);

  const toggleSection = useCallback((id: string, fallback: boolean) => {
    const current = getSnapshot();
    const open = current.expanded[id] ?? fallback;
    writeExpanded({ ...current.expanded, [id]: !open });
  }, []);

  const isSectionOpen = useCallback(
    (section: AdminNavSectionDef, pathname: string) => {
      if (sectionContainsActive(section, pathname)) return true;
      if (section.id in snapshot.expanded) return snapshot.expanded[section.id]!;
      return section.defaultOpen !== false;
    },
    [snapshot.expanded],
  );

  return {
    collapsed: snapshot.collapsed,
    toggleCollapsed,
    toggleSection,
    isSectionOpen,
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
      "/admin/sessions",
      "/admin/reports",
      "/admin/content",
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
