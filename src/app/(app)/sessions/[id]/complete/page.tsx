import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { FinalizeSessionReport } from "@/components/FinalizeSessionReport";
import { shouldOfferReportFinalize } from "@/lib/session-finalize";
import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";
import { sessionDiagnosisText } from "@/lib/sessions/diagnosis-label";
import { sessionElapsedLabel } from "@/lib/sessions/elapsed";
import type { SessionMessage, TherapySession } from "@/lib/types";
import { CourseProgressCard } from "@/components/therapy-course/CourseProgressCard";
import { SkillTestSubmitted } from "@/components/skill-tests/SkillTestSubmitted";
import { LadderResultCard } from "@/components/training/LadderResultCard";
import { findLadderPatient } from "@/lib/training-ladder";
import {
  avatarDisplayName,
  avatarLocalNameSelect,
} from "@/lib/avatars/localized-name";
import { TraineePracticeChecklist } from "@/components/TraineePracticeChecklist";
import { TraineeSessionFeedback } from "@/components/TraineeSessionFeedback";
import { sealedDiagnosisLabels } from "@/lib/ai/diagnosis-labels";
import { normalizeReportLanguage } from "@/lib/ai/report-locale";
import {
  traineeFeedbackView,
  type MySessionFeedbackRow,
} from "@/lib/sessions/trainee-feedback";
import { withSkillTestCase } from "@/lib/skill-tests";
import { patientLabelKey } from "@/lib/therapy-room/patient-label";
import {
  buildTraineeChecklist,
  caseHasRisk,
  evaluateSessionPractice,
} from "@/lib/session-practice";

type Props = { params: Promise<{ id: string }> };

export default async function SessionCompletePage({ params }: Props) {
  const { id } = await params;
  const { supabase, user, profile } = await requireProfile();
  const t = await getTranslations("sessions.complete");
  const tRoom = await getTranslations("therapyRoom.complete");
  const tTranscript = await getTranslations("therapyRoom.transcript");
  const tDisorders = await getTranslations("skillTests.disorders");
  const tDefaultDisorders = await getTranslations("avatars.defaultDisorders");

  const localName = avatarLocalNameSelect(await getLocale());
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(`*, avatars(name, disorder, gender, ${localName})`)
    .eq("id", id)
    .maybeSingle();

  // A failed read goes to the error page (logged, with a retry), not a 404.
  if (sessionError) {
    console.error("[sessions/complete] session load failed", {
      sessionId: id,
      error: sessionError.message,
    });
    throw new Error("session_unavailable");
  }
  if (!session) notFound();
  const typed = session as unknown as TherapySession & {
    avatars: {
      name: string;
      disorder: string;
      gender: string | null;
      local_name: string | null;
    };
  };
  if (typed.therapist_id !== user.id && profile.role !== "admin") {
    redirect("/avatars");
  }

  // Phase 3C — admin tests must not land on learner complete/report UX.
  if (isAdminTestSnapshot(typed.clinical_snapshot)) {
    redirect(`/admin/avatars/${typed.avatar_id}`);
  }

  // The name this patient goes by in the UI language (أحمد, not Ethan).
  const patientName = avatarDisplayName(typed.avatars);

  // Skill test: the transcript and results go to the assigning supervisor.
  if (typed.skill_test_assignment_id) {
    return <SkillTestSubmitted sessionNumber={typed.test_session_number ?? null} />;
  }

  const immersionOverall =
    typed.interaction_mode === "therapy_room" &&
    typed.immersion_metrics &&
    typeof typed.immersion_metrics.overall === "number"
      ? typed.immersion_metrics.overall
      : null;

  const showRoomDebrief = typed.interaction_mode === "therapy_room";
  // The session's own case, never the avatar's legacy default diagnosis.
  const diagnosis = sessionDiagnosisText(typed, tDisorders, tDefaultDisorders);

  // Always load the transcript for the complete page — classic sessions also
  // promise review under My Sessions / this page (not therapy-room-only).
  const { data: messages, error: messagesError } = await supabase
    .from("session_messages")
    .select("*")
    .eq("session_id", id)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });
  // An empty-looking transcript would also hide the report finalize card.
  if (messagesError) {
    console.error("[sessions/complete] transcript load failed", {
      sessionId: id,
      error: messagesError.message,
    });
    throw new Error("transcript_unavailable");
  }
  const transcript = (messages ?? []) as SessionMessage[];

  // A ladder level keeps its case sealed in the row; open it here only to
  // know whether the patient carried risk (every level does).
  const opened = withSkillTestCase(typed);
  const caseSnapshot = opened.ok
    ? opened.session.clinical_snapshot
    : typed.clinical_snapshot;

  // Practices done or missed, for the trainee. No scores: reports stay admin-only.
  const checklist = transcript.some((m) => m.role === "user")
    ? buildTraineeChecklist(
        evaluateSessionPractice({
          messages: transcript,
          sessionNumber: typed.course_session_number ?? null,
          riskPresent: caseHasRisk(
            caseSnapshot?.clinical_core?.risk_profile,
          ),
        }),
      )
    : [];

  // A finished session can lack a report when the tab closed mid-session, the
  // expiry cron ended it, or the end request failed. Only the owning learner
  // can finalize it (the end route enforces ownership); skip empty sessions.
  let needsReport = false;
  if (
    shouldOfferReportFinalize({
      status: typed.status,
      therapistId: typed.therapist_id,
      viewerId: user.id,
      roles: transcript.map((m) => m.role),
    })
  ) {
    const { data: hasReport, error: hasReportError } = await supabase.rpc(
      "session_has_report",
      { p_session_id: id },
    );
    // Finalizing is idempotent (/end returns alreadyExists), so when the check
    // itself fails, offer it rather than leave the session without a report.
    if (hasReportError) {
      console.warn("[sessions/complete] session_has_report failed", {
        sessionId: id,
        error: hasReportError.message,
      });
    }
    needsReport = Boolean(hasReportError) || hasReport === false;
  }

  // Feedback in words from the owner's own report (no scores; the report
  // itself stays admin-only). A ladder level keeps its case sealed, so items
  // naming the diagnosis are dropped. A failed read only hides the card.
  let feedbackRow: MySessionFeedbackRow | null = null;
  if (typed.therapist_id === user.id && !needsReport) {
    const { data: feedbackData, error: feedbackError } = await supabase
      .rpc("my_session_feedback", { p_session_id: id })
      .maybeSingle<MySessionFeedbackRow>();
    if (feedbackError) {
      console.warn("[sessions/complete] my_session_feedback failed", {
        sessionId: id,
        error: feedbackError.message,
      });
    }
    feedbackRow = feedbackData ?? null;
  }
  // A sealed case that cannot be opened shows no feedback (fail closed).
  const feedbackView =
    typed.sealed_case && !opened.ok
      ? ({ kind: "none" } as const)
      : traineeFeedbackView(
          feedbackRow,
          typed.sealed_case && opened.ok
            ? sealedDiagnosisLabels(opened.session.clinical_snapshot)
            : [],
        );

  // Ladder attempts lead back to that patient's levels, not the library.
  const { data: ladderAttempt } = await supabase
    .from("training_ladder_attempts")
    .select("patient_key")
    .eq("session_id", id)
    .maybeSingle();
  const ladderPatient = ladderAttempt
    ? findLadderPatient(String(ladderAttempt.patient_key))
    : null;
  const tTraining = await getTranslations("training.result");

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
          {diagnosis
            ? t("body", {
                name: patientName,
                disorder: diagnosis,
              })
            : t("bodyNoDisorder", { name: patientName })}
        </p>
      </div>

      {/* Refresh once the report exists so the ladder result replaces
          "Scoring this level" without a manual reload. */}
      {needsReport ? (
        <FinalizeSessionReport sessionId={id} refreshOnDone />
      ) : null}
      <LadderResultCard
        supabase={supabase}
        sessionId={id}
        patientName={patientName}
      />
      <CourseProgressCard
        supabase={supabase}
        courseId={typed.therapy_course_id}
        sessionNumber={typed.course_session_number}
      />

      <TraineeSessionFeedback
        view={feedbackView}
        language={normalizeReportLanguage(typed.language)}
      />

      {checklist.length > 0 ? (
        <TraineePracticeChecklist groups={checklist} />
      ) : null}

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

      <section className="clinical-card mb-4 p-5 fade-in-up">
        <h2 className="mb-3 font-[family-name:var(--font-headline)] text-lg font-semibold">
          {tRoom("transcriptTitle")}
        </h2>
        {transcript.length === 0 ? (
          <p className="text-sm text-[var(--on-surface-variant)]">
            {tTranscript("empty")}
          </p>
        ) : (
          <ol
            className="max-h-80 overflow-auto text-sm"
            tabIndex={0}
            aria-label={tRoom("transcriptTitle")}
          >
            {transcript.map((m) => (
              <li
                key={m.id}
                className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-2 border-b border-[var(--outline-variant)] py-2.5 last:border-0 sm:grid-cols-[3rem_5rem_minmax(0,1fr)]"
              >
                <time
                  dateTime={m.created_at}
                  className="row-span-2 text-xs tabular-nums text-[var(--outline)] sm:row-span-1"
                >
                  {sessionElapsedLabel(typed.started_at, m.created_at)}
                </time>
                <span
                  className={`text-xs font-semibold ${
                    m.role === "user"
                      ? "text-[var(--on-surface-variant)]"
                      : "text-[var(--primary)]"
                  }`}
                >
                  {m.role === "user"
                    ? tTranscript("you")
                    : tTranscript(patientLabelKey(typed.avatars?.gender))}
                </span>
                <span className="text-[var(--on-surface)]" dir="auto">
                  {m.content}
                </span>
              </li>
            ))}
          </ol>
        )}
        {showRoomDebrief && typed.private_notes?.trim() ? (
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

      <section className="clinical-card mb-4 p-5 fade-in-up">
        <div className="mb-3 flex items-center gap-2">
          <span aria-hidden className="material-symbols-outlined text-[var(--primary)]">
            verified
          </span>
          <h2 className="font-[family-name:var(--font-headline)] text-lg font-semibold">
            {t("nextTitle")}
          </h2>
        </div>
        <ul className="space-y-3 text-sm text-[var(--on-surface-variant)]">
          <li className="flex gap-3">
            <span aria-hidden className="material-symbols-outlined text-[20px] text-[var(--primary)]">
              lock
            </span>
            <span>{t("next1")}</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="material-symbols-outlined text-[20px] text-[var(--secondary)]">
              trending_up
            </span>
            <span>{t("next2")}</span>
          </li>
        </ul>
      </section>

      <div className="flex flex-col gap-3 fade-in-up">
        {ladderPatient ? (
          <Link
            href={`/training/${ladderPatient.key}`}
            className="btn-primary h-12 w-full"
          >
            <span aria-hidden className="material-symbols-outlined">stairs</span>
            {tTraining("toPatient", { name: patientName })}
          </Link>
        ) : (
          <Link href="/avatars" className="btn-primary h-12 w-full">
            <span aria-hidden className="material-symbols-outlined">play_circle</span>
            {t("practiceAgain")}
          </Link>
        )}
        <Link href="/sessions" className="btn-secondary h-12 w-full">
          <span aria-hidden className="material-symbols-outlined">clinical_notes</span>
          {t("mySessions")}
        </Link>
        {profile.role === "admin" && (
          <Link
            href={`/admin/reports/${id}`}
            className="btn-secondary h-12 w-full"
          >
            <span aria-hidden className="material-symbols-outlined">folder_shared</span>
            {t("viewReport")}
          </Link>
        )}
      </div>
    </main>
  );
}
