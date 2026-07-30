import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import type { TherapySession } from "@/lib/types";
import { format } from "date-fns";

export default async function SessionsListPage() {
  const { supabase, user } = await requireProfile();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, status, started_at, ended_at, avatars(name, disorder)")
    .eq("therapist_id", user.id)
    .order("started_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        My sessions
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Transcripts are visible to you; assessment reports are admin-only.
      </p>
      <ul className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {(
          sessions as
            | (Pick<
                TherapySession,
                "id" | "status" | "started_at" | "ended_at"
              > & {
                avatars: { name: string; disorder: string };
              })[]
            | null
        )?.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <p className="font-medium">
                {s.avatars?.name} · {s.avatars?.disorder}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {format(new Date(s.started_at), "MMM d, yyyy · HH:mm")} ·{" "}
                {s.status}
              </p>
            </div>
            <Link
              href={
                s.status === "active"
                  ? `/sessions/${s.id}`
                  : `/sessions/${s.id}/complete`
              }
              className="text-sm text-[var(--accent)] underline"
            >
              {s.status === "active" ? "Resume" : "Details"}
            </Link>
          </li>
        ))}
        {!sessions?.length && (
          <li className="py-8 text-sm text-[var(--muted)]">
            No sessions yet.{" "}
            <Link href="/avatars" className="text-[var(--accent)] underline">
              Start one
            </Link>
            .
          </li>
        )}
      </ul>
    </main>
  );
}
