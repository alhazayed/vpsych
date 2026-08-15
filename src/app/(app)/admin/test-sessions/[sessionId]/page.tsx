import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTestBanner } from "@/components/admin/AdminTestBanner";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  AdminTestTranscript,
  type AdminTestTranscriptMessage,
} from "@/components/admin/AdminTestTranscript";
import { requireAdmin } from "@/lib/auth";
import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";
import { logSecurityEvent } from "@/lib/security-audit";
import type { Avatar, TherapySession } from "@/lib/types";

/**
 * Phase 4 P0-1 — Admin Test Conversation transcript review surface.
 *
 * Closes the readiness-assessment finding that admin-test transcripts are
 * persisted but unreachable: admin tests intentionally create no
 * `session_reports` row, so `/admin/reports/[sessionId]` cannot show them and
 * every learner route redirects away.
 *
 * Authorization (server-side only, no service role, no RLS change):
 *   1. `/admin/*` edge gate in `src/middleware.ts`
 *   2. `requireAdmin()` — anonymous → /login, non-admin → /avatars + audit
 *   3. RLS — `sessions` / `session_messages` SELECT allow `is_admin()`
 *   4. Admin-test marker re-checked from the persisted row (below)
 *
 * The admin-test determination is made from `sessions.clinical_snapshot` as
 * stored by the server. Query parameters, client flags, and URL state are
 * never consulted. A learner session reached through this route 404s.
 */

type Props = { params: Promise<{ sessionId: string }> };

export default async function AdminTestTranscriptPage({ params }: Props) {
  const { sessionId } = await params;
  const { supabase } = await requireAdmin();
  const t = await getTranslations("admin.testTranscript");
  const tHome = await getTranslations("admin.home");
  const tAvatars = await getTranslations("admin.avatars");
  const locale = await getLocale();

  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, avatar_id, status, started_at, ended_at, created_at, language, interaction_mode, clinical_snapshot, avatars ( id, name, slug, disorder )",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) notFound();

  const typed = session as unknown as Pick<
    TherapySession,
    | "id"
    | "avatar_id"
    | "status"
    | "started_at"
    | "ended_at"
    | "created_at"
    | "language"
    | "interaction_mode"
    | "clinical_snapshot"
  > & { avatars: Pick<Avatar, "id" | "name" | "slug" | "disorder"> | null };

  // Authoritative: this route serves admin-test sessions only. A learner
  // session id must not become readable here by manipulating the URL.
  if (!isAdminTestSnapshot(typed.clinical_snapshot)) notFound();

  const { data: rows } = await supabase
    .from("session_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const messages = (rows ?? []) as AdminTestTranscriptMessage[];

  await logSecurityEvent({
    action: "admin.avatar.test_session.transcript_view",
    outcome: "success",
    resourceType: "session",
    resourceId: sessionId,
    metadata: {
      avatarId: typed.avatar_id,
      status: typed.status,
      messageCount: messages.length,
    },
  });

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const fmt = (v: string | null | undefined) =>
    v ? dateTime.format(new Date(v)) : "—";

  const statusLabel =
    typed.status === "active"
      ? t("statusActive")
      : typed.status === "completed"
        ? t("statusCompleted")
        : typed.status === "expired"
          ? t("statusExpired")
          : typed.status;

  const meta: { label: string; value: string }[] = [
    { label: t("metaAvatar"), value: typed.avatars?.name ?? "—" },
    { label: t("metaSlug"), value: typed.avatars?.slug ?? "—" },
    { label: t("metaDisorder"), value: typed.avatars?.disorder ?? "—" },
    { label: t("metaSessionId"), value: typed.id },
    { label: t("metaAdminTest"), value: t("metaAdminTestYes") },
    { label: t("metaCreated"), value: fmt(typed.created_at) },
    { label: t("metaStarted"), value: fmt(typed.started_at) },
    { label: t("metaEnded"), value: fmt(typed.ended_at) },
    { label: t("metaLanguage"), value: typed.language ?? "—" },
    {
      label: t("metaMode"),
      value: typed.interaction_mode ?? "classic",
    },
  ];

  return (
    <main className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
      <AdminPageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        breadcrumbs={[
          { label: tHome("title"), href: "/admin" },
          { label: tAvatars("title"), href: "/admin/avatars" },
          ...(typed.avatars
            ? [
                {
                  label: typed.avatars.name,
                  href: `/admin/avatars/${typed.avatar_id}`,
                },
              ]
            : []),
          { label: t("breadcrumb") },
        ]}
        actions={
          <StatusBadge
            label={statusLabel}
            tone={typed.status === "active" ? "warning" : "neutral"}
          />
        }
      />

      <div className="clinical-card mb-6 overflow-hidden">
        <AdminTestBanner clinicalSnapshot={typed.clinical_snapshot} />
        <p className="px-4 py-3 text-sm text-[var(--on-surface-variant)]">
          {t("notLearnerNotice")}
        </p>
      </div>

      <section className="clinical-card mb-6 p-5">
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("metaHeading")}
        </h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {meta.map((m) => (
            <div key={m.label} className="flex flex-wrap gap-x-2 text-sm">
              <dt className="text-[var(--on-surface-variant)]">{m.label}:</dt>
              <dd className="break-all font-medium text-[var(--on-surface)]">
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {t("transcriptHeading")}
        </h2>
        <AdminTestTranscript
          messages={messages}
          locale={locale}
          labels={{
            empty: t("empty"),
            roleSystem: t("roleSystem"),
            roleUser: t("roleUser"),
            roleAssistant: t("roleAssistant"),
            turns: t("turns", { count: messages.length }),
          }}
        />
      </section>

      <div className="mt-8">
        <Link
          href={`/admin/avatars/${typed.avatar_id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
        >
          <span className="material-symbols-outlined text-[18px] rtl:rotate-180">
            arrow_back
          </span>
          {t("backToAvatar")}
        </Link>
      </div>
    </main>
  );
}
