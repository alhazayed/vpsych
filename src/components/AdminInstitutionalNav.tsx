"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/integrations", label: "API Integrations", icon: "api" },
  { href: "/admin/security", label: "Security & Keys", icon: "vpn_key" },
  { href: "/admin/reports", label: "Reports Library", icon: "folder_shared" },
  { href: "/admin/avatars", label: "Avatar Presets", icon: "psychology" },
] as const;

export function AdminInstitutionalNav() {
  const pathname = usePathname();

  return (
    <aside className="mb-6 w-full shrink-0 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 lg:mb-0 lg:w-[260px]">
      <div className="mb-4 flex items-center gap-3 px-2 py-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
          <span className="material-symbols-outlined">shield_lock</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--primary)]">VPsych</p>
          <p className="text-xs text-[var(--on-surface-variant)]">
            Enterprise Admin
          </p>
        </div>
      </div>
      <nav className="space-y-1">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                active
                  ? "border-l-4 border-[var(--primary)] bg-[var(--primary-fixed)] text-[var(--primary)]"
                  : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-[var(--outline-variant)] pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-[10px] font-bold text-green-700">
            System Status: Healthy
          </span>
        </div>
      </div>
    </aside>
  );
}
