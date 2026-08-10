import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const LINKS = [
  {
    href: "/admin/curriculum",
    title: "Adaptive curriculum",
    description:
      "Monitor learner competencies, pathways, and adaptive thresholds.",
    icon: "timeline",
  },
  {
    href: "/admin/graph",
    title: "Competency graph",
    description:
      "Inspect learner and cohort graphs, mastery, and reassessment.",
    icon: "account_tree",
  },
  {
    href: "/admin/feedback",
    title: "Feedback queue",
    description: "Review institutional and learner feedback submissions.",
    icon: "inbox",
  },
] as const;

export default async function LearnersHubPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          Learners
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
          Curriculum progress, competency graphs, and feedback for trainees.
        </p>
      </section>
      <ul className="grid gap-4 sm:grid-cols-2">
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
    </main>
  );
}
