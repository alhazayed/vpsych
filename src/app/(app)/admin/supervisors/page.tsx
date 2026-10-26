import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { SupervisorRoleToggle } from "@/components/skill-tests/SupervisorRoleToggle";
import { SupervisorTraineeLinks } from "@/components/skill-tests/SupervisorTraineeLinks";
import type { SupervisorTraineeLink } from "@/lib/types";

/** Superadmin grants and revokes the supervisor role. */
export default async function AdminSupervisorsPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations("skillTests.admin");
  const tLinks = await getTranslations("supervisorReviews.links");

  const { data, error } = await supabase.rpc("list_skill_test_trainees");
  if (error) console.warn("[admin/supervisors] list:", error.message);
  const users = (data ?? []) as Array<{
    id: string;
    display_name: string;
    email: string;
    is_supervisor: boolean;
  }>;
  const supervisors = users.filter((u) => u.is_supervisor);

  // Which trainees each supervisor oversees (practice report review).
  const { data: linkRows, error: linksError } = await supabase
    .from("supervisor_trainees")
    .select("supervisor_id, trainee_id");
  if (linksError) console.error("[admin/supervisors] links:", linksError.message);
  const links = (linkRows ?? []) as Pick<SupervisorTraineeLink, "supervisor_id" | "trainee_id">[];
  const byId = new Map(users.map((u) => [u.id, u]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <h1 className="font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <p className="mb-6 mt-2 text-sm text-[var(--on-surface-variant)]">{t("intro")}</p>
      <p className="mb-6 text-sm">
        <Link href="/admin/accounts" className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline">
          {t("accountApprovalsLink")}
        </Link>
      </p>
      {/* Skill tests live outside /admin (the supervisor workspace), so they
          are linked from here rather than from the admin sidebar. */}
      <p className="mb-6 text-sm">
        <Link href="/supervise" className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline">
          {t("skillTestsLink")}
        </Link>
      </p>

      {error ? (
        <p role="alert" className="clinical-card p-5 text-sm text-[var(--error)]">
          {t("loadError")}
        </p>
      ) : users.length === 0 ? (
        <p className="clinical-card p-5 text-sm text-[var(--on-surface-variant)]">
          {t("empty")}
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm font-semibold">
            {t("count", { count: supervisors.length })}
          </p>
          <ul className="clinical-card divide-y divide-[var(--outline-variant)]">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {u.display_name}
                    {u.is_supervisor && (
                      <span className="status-chip status-chip-active ms-2">
                        {t("badge")}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-[var(--on-surface-variant)]" dir="ltr">
                    {u.email}
                  </p>
                </div>
                <SupervisorRoleToggle
                  userId={u.id}
                  isSupervisor={u.is_supervisor}
                  name={u.display_name}
                />
                {u.is_supervisor &&
                  (linksError ? (
                    <p role="alert" className="basis-full text-sm text-[var(--error)]">
                      {tLinks("loadError")}
                    </p>
                  ) : (
                    <div className="basis-full">
                      <SupervisorTraineeLinks
                        supervisor={{ id: u.id, display_name: u.display_name }}
                        linked={links
                          .filter((l) => l.supervisor_id === u.id)
                          .map((l) => ({
                            id: l.trainee_id,
                            display_name: byId.get(l.trainee_id)?.display_name ?? "—",
                          }))}
                        candidates={users
                          .filter(
                            (c) =>
                              c.id !== u.id &&
                              !links.some(
                                (l) => l.supervisor_id === u.id && l.trainee_id === c.id,
                              ),
                          )
                          .map((c) => ({ id: c.id, display_name: c.display_name }))}
                      />
                    </div>
                  ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
