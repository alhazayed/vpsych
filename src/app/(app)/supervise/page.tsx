import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSupervisor } from "@/lib/skill-tests/access";
import type { SkillTestAssignment } from "@/lib/types";

type Row = Pick<
  SkillTestAssignment,
  "id" | "title" | "status" | "required_sessions" | "due_at" | "created_at"
> & {
  trainee: { display_name: string } | null;
  supervisor: { display_name: string } | null;
  avatars: { name: string } | null;
};

const STATUS_CHIP: Record<SkillTestAssignment["status"], string> = {
  assigned: "status-chip",
  in_progress: "status-chip status-chip-active",
  completed: "status-chip status-chip-done",
  cancelled: "status-chip",
};

/** Supervisor workspace: skill tests this supervisor assigned (admins: all). */
export default async function SupervisePage() {
  const { supabase, isAdmin } = await requireSupervisor();
  const t = await getTranslations("skillTests.supervise");
  const tStatus = await getTranslations("skillTests.status");
  const locale = await getLocale();

  const { data: rows, error } = await supabase
    .from("skill_test_assignments")
    .select(
      "id, title, status, required_sessions, due_at, created_at, trainee:profiles!skill_test_assignments_trainee_id_fkey(display_name), supervisor:profiles!skill_test_assignments_supervisor_id_fkey(display_name), avatars(name)",
    )
    .order("created_at", { ascending: false });
  if (error) console.warn("[supervise] list:", error.message);
  const tests = (rows ?? []) as unknown as Row[];

  const { data: sessionRows } = tests.length
    ? await supabase
        .from("sessions")
        .select("skill_test_assignment_id")
        .in(
          "skill_test_assignment_id",
          tests.map((x) => x.id),
        )
    : { data: [] };
  const held = new Map<string, number>();
  for (const r of (sessionRows ?? []) as Array<{ skill_test_assignment_id: string }>) {
    held.set(r.skill_test_assignment_id, (held.get(r.skill_test_assignment_id) ?? 0) + 1);
  }
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    dateStyle: "medium",
  });

  return (
    <main className="mx-auto max-w-[1080px] px-4 py-8 md:px-8">
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--on-surface-variant)]">
            {isAdmin ? t("introAdmin") : t("intro")}
          </p>
        </div>
        <Link href="/supervise/new" className="btn-primary">
          <span className="material-symbols-outlined text-[20px]" aria-hidden>
            add
          </span>
          {t("newTest")}
        </Link>
      </section>

      {error ? (
        <p role="alert" className="clinical-card p-5 text-sm text-[var(--error)]">
          {t("loadError")}
        </p>
      ) : tests.length === 0 ? (
        <p className="clinical-card p-8 text-center text-sm text-[var(--on-surface-variant)]">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {tests.map((test) => (
            <li key={test.id}>
              <Link
                href={`/supervise/${test.id}`}
                className="clinical-card clinical-card-interactive flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{test.title}</p>
                  <p className="text-sm text-[var(--on-surface-variant)]">
                    {t("rowMeta", {
                      trainee: test.trainee?.display_name ?? "—",
                      patient: test.avatars?.name ?? "—",
                    })}
                    {isAdmin && test.supervisor
                      ? ` · ${t("assignedBy", { name: test.supervisor.display_name })}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span>
                    {t("sessionsHeld", {
                      held: held.get(test.id) ?? 0,
                      total: test.required_sessions,
                    })}
                  </span>
                  {test.due_at && (
                    <span className="text-[var(--on-surface-variant)]">
                      {t("due", { date: dateFmt.format(new Date(test.due_at)) })}
                    </span>
                  )}
                  <span className={STATUS_CHIP[test.status]}>{tStatus(test.status)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
