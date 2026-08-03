import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type NavLink = { href: string; label: string };

export function MarketingDocShell({
  brand = "VPsych",
  nav = [],
  children,
}: {
  brand?: string;
  nav?: NavLink[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)]">
      <header className="border-b border-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-headline)] text-lg font-bold text-[var(--primary)]"
          >
            {brand}
          </Link>
          <nav aria-label="Secondary" className="flex items-center gap-4 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[var(--primary)] hover:underline"
              >
                {item.label}
              </Link>
            ))}
            <LanguageSwitcher compact />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
    </div>
  );
}
