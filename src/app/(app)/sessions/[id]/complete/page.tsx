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
    <main className="mx-auto max-w-lg px-4 py-12 md:py-16">
      <div className="mb-8 text-center fade-in-up">
        <span className="status-chip status-chip-done mb-4">
          Simulation completed
        </span>
        <h1 className="mt-4 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          Session complete
        </h1>
        <p className="mt-3 text-[var(--on-surface-variant)]">
          Your session with {typed.avatars?.name} ({typed.avatars?.disorder})
          has ended. A performance assessment was generated and stored securely
          for administrators only.
        </p>
      </div>

      <section className="clinical-card mb-4 p-5 fade-in-up">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--primary)]">
            verified
          </span>
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            What happens next
          </h2>
        </div>
        <ul className="space-y-3 text-sm text-[var(--on-surface-variant)]">
          <li className="flex gap-3">
            <span className="material-symbols-outlined text-[20px] text-[var(--primary)]">
              lock
            </span>
            <span>
              Your transcript remains available under My Sessions. Scoring and
              narrative feedback stay admin-only.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="material-symbols-outlined text-[20px] text-[var(--secondary)]">
              trending_up
            </span>
            <span>
              Practice again with another persona to build clinical range.
            </span>
          </li>
        </ul>
      </section>

      <div className="flex flex-col gap-3 fade-in-up">
        <Link href="/avatars" className="btn-primary h-12 w-full">
          <span className="material-symbols-outlined">play_circle</span>
          Practice again
        </Link>
        <Link href="/sessions" className="btn-secondary h-12 w-full">
          <span className="material-symbols-outlined">clinical_notes</span>
          My sessions
        </Link>
        {profile.role === "admin" && (
          <Link
            href={`/admin/reports/${id}`}
            className="btn-secondary h-12 w-full"
          >
            <span className="material-symbols-outlined">folder_shared</span>
            View report
          </Link>
        )}
      </div>
    </main>
  );
}
