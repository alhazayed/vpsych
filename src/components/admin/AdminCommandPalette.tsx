"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ADMIN_NAV_SECTIONS,
  filterAdminNavItems,
  type AdminNavItemDef,
} from "@/lib/admin/admin-nav";

const RECENT_KEY = "vpsych.admin.command.recent";
const MAX_RECENT = 6;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function pushRecent(href: string) {
  try {
    const next = [href, ...readRecent().filter((h) => h !== href)].slice(
      0,
      MAX_RECENT,
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const tNav = useTranslations("nav");
  const tShell = useTranslations("shell");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent] = useState(() => readRecent());

  const resolveLabel = useCallback(
    (key: string) => tNav(key as "overview"),
    [tNav],
  );

  const results = useMemo(
    () => filterAdminNavItems(query, resolveLabel, ADMIN_NAV_SECTIONS),
    [query, resolveLabel],
  );

  const recentItems = useMemo(() => {
    const flat = filterAdminNavItems("", resolveLabel, ADMIN_NAV_SECTIONS);
    return recent
      .map((href) => flat.find((i) => i.href === href))
      .filter((x): x is AdminNavItemDef => Boolean(x));
  }, [recent, resolveLabel]);

  const display = query.trim()
    ? results
    : recentItems.length
      ? recentItems
      : results;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function go(item: AdminNavItemDef) {
    pushRecent(item.href);
    onClose();
    router.push(item.href);
  }

  function onInputKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(display.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = display[activeIndex];
      if (item) go(item);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-[color-mix(in_srgb,var(--on-surface)_40%,transparent)] px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tShell("commandPalette.title")}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-[var(--clinical-shadow-hover)]"
      >
        <div className="flex items-center gap-2 border-b border-[var(--outline-variant)] px-3">
          <span
            className="material-symbols-outlined text-[var(--outline)]"
            aria-hidden
          >
            search
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKey}
            placeholder={tShell("commandPalette.placeholder")}
            className="w-full border-0 bg-transparent py-3.5 text-sm text-[var(--on-surface)] outline-none placeholder:text-[var(--outline)]"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              display[activeIndex]
                ? `${listId}-opt-${activeIndex}`
                : undefined
            }
          />
          <kbd className="hidden rounded border border-[var(--outline-variant)] px-1.5 py-0.5 text-[10px] text-[var(--outline)] sm:inline">
            esc
          </kbd>
        </div>
        <ul
          id={listId}
          role="listbox"
          className="max-h-72 overflow-y-auto py-2"
        >
          {display.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-[var(--on-surface-variant)]">
              {tShell("commandPalette.empty")}
            </li>
          ) : (
            display.map((item, index) => {
              const active = index === activeIndex;
              return (
                <li key={item.href} role="option" aria-selected={active}>
                  <button
                    type="button"
                    id={`${listId}-opt-${index}`}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm ${
                      active
                        ? "bg-[var(--surface-container)] text-[var(--primary)]"
                        : "text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(item)}
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      aria-hidden
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1 font-medium">
                      {resolveLabel(item.labelKey)}
                    </span>
                    <span className="text-xs text-[var(--outline)]">
                      {item.href}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <p className="border-t border-[var(--outline-variant)] px-4 py-2 text-[10px] text-[var(--outline)]">
          {tShell("commandPalette.hint")}
        </p>
      </div>
    </div>
  );
}

export function AdminCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;
  return <PaletteDialog onClose={() => onOpenChange(false)} />;
}
