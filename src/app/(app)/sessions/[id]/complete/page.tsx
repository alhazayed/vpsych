import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import type { SessionMessage, TherapySession } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export default async function SessionCompletePage({ params }: Props) {
  const { id } = await params;
  const { supabase, user, profile } = await requireProfile();
  const t = await getTranslations("sessions.complete");
  const tRoom = await getTranslations("therapyRoom.complete");
  const tTranscript = await getTranslations("therapyRoom.transcript");

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

  const immersionOverall =
    typed.interaction_mode === "therapy_room" &&
    typed.immersion_metrics &&
    typeof typed.immersion_metrics.overall === "number"
      ? typed.immersion_metrics.overall
      : null;

  const showRoomDebrief = typed.interaction_mode === "therapy_room";

  let transcript: SessionMessage[] = [];
  if (showRoomDebrief) {
    const { data: messages } = await supabase
      .from("session_messages")
      .select("*")
      .eq("session_id", id)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true });
    transcript = (messages ?? []) as SessionMessage[];
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12 md:py-16">
      <div className="mb-8 text-center fade-in-up">
        <span className="status-chip status-chip-done mb-4">
          {t("badge")}
        </span>
        <h1 className="mt-4 font-[family-name:var(--font-headline)] text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-3 text-[var(--on-surface-variant)]">
          {t("body", {
            name: typed.avatars?.name ?? "",
            disorder: typed.avatars?.disorder ?? "",
          })}
        </p>
      </div>

      {immersionOverall != null && (
        <section className="clinical-card mb-4 p-5 fade-in-up">
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            {tRoom("immersionTitle")}
          </h2>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {tRoom("immersionScore", { score: immersionOverall })}
          </p>
        </section>
      )}

      {showRoomDebrief && (
        <section className="clinical-card mb-4 p-5 fade-in-up">
          <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg font-semibold">
            {tRoom("transcriptTitle")}
          </h2>
          {transcript.length === 0 ? (
            <p className="text-sm text-[var(--on-surface-variant)]">
              {tTranscript("empty")}
            </p>
          ) : (
            <ul className="max-h-80 space-y-3 overflow-auto text-sm">
              {transcript.map((m) => (
                <li key={m.id}>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                    {m.role === "user"
                      ? tTranscript("you")
                      : tTranscript("patient")}
                  </span>
                  <span className="text-[var(--on-surface)]">{m.content}</span>
                </li>
              ))}
            </ul>
          )}
          {typed.private_notes?.trim() ? (
            <div className="mt-4 border-t border-[var(--outline-variant)] pt-4">
              <h3 className="mb-2 text-sm font-semibold">
                {tRoom("notesTitle")}
              </h3>
              <p className="whitespace-pre-wrap text-sm text-[var(--on-surface-variant)]">
                {typed.private_notes}
              </p>
            </div>
          ) : null}
          <p className="mt-4 text-xs text-[var(--on-surface-variant)]">
            {tRoom("debriefNote")}
          </p>
        </section>
      )}

      <section className="clinical-card mb-4 p-5 fade-in-up">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--primary)]">
            verified
          </span>
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            {t("nextTitle")}
          </h2>
        </div>
        <ul className="space-y-3 text-sm text-[var(--on-surface-variant)]">
          <li className="flex gap-3">
            <span className="material-symbols-outlined text-[20px] text-[var(--primary)]">
              lock
            </span>
            <span>{t("next1")}</span>
          </li>
          <li className="flex gap-3">
            <span className="material-symbols-outlined text-[20px] text-[var(--secondary)]">
              trending_up
            </span>
            <span>{t("next2")}</span>
          </li>
        </ul>
      </section>

      <div className="flex flex-col gap-3 fade-in-up">
        <Link href="/avatars" className="btn-primary h-12 w-full">
          <span className="material-symbols-outlined">play_circle</span>
          {t("practiceAgain")}
        </Link>
        <Link href="/sessions" className="btn-secondary h-12 w-full">
          <span className="material-symbols-outlined">clinical_notes</span>
          {t("mySessions")}
        </Link>
        {profile.role === "admin" && (
          <Link
            href={`/admin/reports/${id}`}
            className="btn-secondary h-12 w-full"
          >
            <span className="material-symbols-outlined">folder_shared</span>
            {t("viewReport")}
          </Link>
        )}
      </div>
    </main>
  );
}
