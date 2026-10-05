import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { expireStaleSessionsForTherapist } from "@/lib/session-expiry";
import { isSessionLive, decideSkillTestStart } from "@/lib/skill-tests";
import { StartSkillTestButton } from "@/components/skill-tests/StartSkillTestButton";
import type { SkillTestAssignment } from "@/lib/types";

type TestRow = Pick<
  SkillTestAssignment,
  | "id"
  | "title"
  | "status"
  | "required_sessions"
  | "trainee_instructions"
  | "due_at"
  | "trainee_id"
  | "language"
  | "created_at"
> & { avatars: { name: string; portrait_url: string | null } | null };

type TestSessionRow = {
  id: string;
  status: string;
  started_at: string;
  max_duration_sec: number;
  skill_test_assignment_id: string;
};

/**
 * Skill test page: only the patients a supervisor assigned to this trainee.
 * The diagnosis is not shown; working it out is part of the test.
 */
export default async function SkillTestsPage() {
  const { supabase, user } = await requireProfile();
  const t = await getTranslations("skillTests.trainee");
  const locale = await getLocale();

  await expireStaleSessionsForTherapist(supabase, user.id);

  const { data: rows, error } = await supabase
    .from("skill_test_assignments")
    .select(
      "id, title, status, required_sessions, trainee_instructions, due_at, trainee_id, language, created_at, avatars(name, portrait_url)",
    )
    .eq("trainee_id", user.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[tests] list:", error.message);
  }
  const tests = (rows ?? []) as unknown as TestRow[];

  const { data: sessionRows } = tests.length
    ? await supabase
        .from("sessions")
        .select("id, status, started_at, max_duration_sec, skill_test_assignment_id")
        .eq("therapist_id", user.id)
        .in(
          "skill_test_assignment_id",
          tests.map((x) => x.id),
        )
        .order("started_at", { ascending: true })
    : { data: [] };
  const sessions = (sessionRows ?? []) as TestSessionRow[];

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    dateStyle: "medium",
  });

  return (
    <main className="mx-auto max-w-[1080px] px-4 py-8 md:px-8">
      <section className="mb-8 fade-in-up">
        <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-[var(--on-surface-variant)]">
          {t("intro")}
        </p>
      </section>

      {error ? (
        <p role="alert" className="clinical-card p-5 text-sm text-[var(--error)]">
          {t("loadError")}
        </p>
      ) : tests.length === 0 ? (
        <section className="clinical-card flex flex-col items-center gap-3 p-10 text-center">
          <span
            className="material-symbols-outlined text-[40px] text-[var(--on-surface-variant)]"
            aria-hidden
          >
            assignment_late
          </span>
          <h2 className="font-[family-name:var(--font-headline)] text-xl font-semibold">
            {t("emptyTitle")}
          </h2>
          <p className="max-w-md text-sm text-[var(--on-surface-variant)]">
            {t("emptyBody")}
          </p>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {tests.map((test) => {
            const mine = sessions.filter(
              (s) => s.skill_test_assignment_id === test.id,
            );
            const live = mine.find((s) => isSessionLive(s));
            const decision = decideSkillTestStart(test, user.id, mine);
            const held = mine.length;
            const done = test.status === "completed";
            return (
              <article key={test.id} className="clinical-card overflow-hidden">
                <div className="flex items-center gap-4 border-b border-[var(--outline-variant)] p-5">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--surface-container)]">
                    {test.avatars?.portrait_url ? (
                      <Image
                        src={test.avatars.portrait_url}
                        alt={test.avatars.name}
                        fill
                        className="object-cover object-top"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-2xl font-bold text-[var(--primary)]">
                        {(test.avatars?.name ?? "?").slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
                      {test.title}
                    </h2>
                    <p className="text-sm text-[var(--on-surface-variant)]">
                      {t("patient", { name: test.avatars?.name ?? "—" })} ·{" "}
                      {test.language === "ar-JO" ? t("languageAr") : t("languageEn")}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <p className="text-sm font-semibold">
                    {done
                      ? t("submitted")
                      : t("progress", { held, total: test.required_sessions })}
                  </p>
                  {test.due_at && !done && (
                    <p className="text-sm text-[var(--on-surface-variant)]">
                      {t("due", { date: dateFmt.format(new Date(test.due_at)) })}
                    </p>
                  )}
                  {test.trainee_instructions && (
                    <div className="rounded-lg bg-[var(--surface-container-high)] p-3 text-sm">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                        {t("instructions")}
                      </p>
                      <p className="whitespace-pre-wrap">{test.trainee_instructions}</p>
                    </div>
                  )}
                  {live ? (
                    <Link href={`/sessions/${live.id}`} className="btn-primary w-full">
                      <span className="material-symbols-outlined text-[20px]" aria-hidden>
                        meeting_room
                      </span>
                      {t("resume")}
                    </Link>
                  ) : decision.kind === "start" ? (
                    <StartSkillTestButton
                      skillTestId={test.id}
                      sessionNumber={decision.sessionNumber}
                    />
                  ) : (
                    <p className="text-sm text-[var(--on-surface-variant)]">
                      {t("resultsPrivate")}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
