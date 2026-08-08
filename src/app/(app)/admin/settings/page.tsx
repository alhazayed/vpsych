import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const LINKS = [
  {
    href: "/admin/voices",
    title: "Voice profiles",
    description:
      "Clinical voice registry, assignment, and preview for patients.",
    icon: "record_voice_over",
  },
  {
    href: "/admin/personality",
    title: "Personality (advanced)",
    description:
      "Low-level Human Personality Engine editor — for advanced configuration only.",
    icon: "face",
  },
] as const;

export default async function SettingsHubPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          Voices and advanced configuration. Prefer the Virtual Patient editor
          for day-to-day clinical setup.
        </p>
      </section>

      <ul className="mb-6 grid gap-4 sm:grid-cols-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="clinical-card clinical-card-interactive flex h-full flex-col gap-2 p-5"
            >
              <span className="material-symbols-outlined text-[28px] text-[var(--primary)]">
                {link.icon}
              </span>
              <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold text-[var(--on-surface)]">
                {link.title}
              </h2>
              <p className="text-sm text-[var(--on-surface-variant)]">
                {link.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="clinical-card p-5 text-sm text-[var(--on-surface-variant)]">
        <p className="font-medium text-[var(--on-surface)]">
          Advanced Configuration
        </p>
        <p className="mt-2">
          Raw IDs, personality JSON, and engine panels live under Advanced on
          each virtual patient, plus the personality and voice pages linked
          above. Day-to-day authors should use{" "}
          <Link
            href="/admin/virtual-patients"
            className="font-medium text-[var(--primary)] underline-offset-2 hover:underline"
          >
            Virtual Patients
          </Link>{" "}
          instead.
        </p>
      </div>
    </main>
  );
}
