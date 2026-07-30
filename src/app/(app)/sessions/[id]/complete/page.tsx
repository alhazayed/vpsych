import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import type { TherapySession } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export default async function SessionCompletePage({ params }: Props) {
  const { id } = await params;
  const { supabase, user, profile } = await requireProfile();

  const { data: session } = await supabase
    .from("sessions")
    .select("*, avatars(name, disorder)")
    .eq("id", id)
    .single();

  if (!session) notFound();
  const typed = session as TherapySession & {
    avatars: { name: string; disorder: string };
  };
  if (typed.therapist_id !== user.id && profile.role !== "admin") {
    redirect("/avatars");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
        Session {typed.status}
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl">
        Thank you
      </h1>
      <p className="mt-4 text-[var(--muted)]">
        Your session with {typed.avatars?.name} ({typed.avatars?.disorder}) has
        ended. A performance assessment report was generated and stored securely
        for administrators only.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/avatars"
          className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm text-white"
        >
          Practice again
        </Link>
        <Link
          href="/sessions"
          className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm"
        >
          My sessions
        </Link>
        {profile.role === "admin" && (
          <Link
            href={`/admin/reports/${id}`}
            className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm"
          >
            View report
          </Link>
        )}
      </div>
    </main>
  );
}
