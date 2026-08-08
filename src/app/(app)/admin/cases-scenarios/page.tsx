import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const LINKS = [
  {
    href: "/admin/cases",
    title: "Clinical cases",
    description:
      "Generate and preview immutable clinical cases for assessments.",
    icon: "biotech",
  },
  {
    href: "/admin/templates",
    title: "Scenario templates",
    description:
      "Author reusable scenario templates that drive standardized patients.",
    icon: "schema",
  },
  {
    href: "/admin/presets",
    title: "Instructor presets",
    description:
      "Configure learning objectives and learner levels for adaptive cases.",
    icon: "school",
  },
] as const;

export default async function CasesScenariosHubPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          Cases & Scenarios
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          Build the clinical cases and scenario templates that power training
          sessions.
        </p>
      </section>
      <HubGrid links={LINKS} />
    </main>
  );
}

function HubGrid({
  links,
}: {
  links: ReadonlyArray<{
    href: string;
    title: string;
    description: string;
    icon: string;
  }>;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {links.map((link) => (
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
  );
}
