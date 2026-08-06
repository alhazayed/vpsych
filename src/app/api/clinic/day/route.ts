/**
 * Ensure today's Virtual Mental Health Center clinic day + appointment board.
 * Seeds from active avatars when the day is opened for the first time.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTherapyRoomEnabled } from "@/lib/features";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  buildAppointmentCard,
  clinicDayDateKey,
  urgencyFromRisk,
} from "@/lib/therapy-room";
import { chartSectionsForDifficulty } from "@/lib/therapy-room";
import type { CaseDifficulty } from "@/lib/case-engine/types";
import type { ClinicAppointmentCard } from "@/lib/therapy-room";

export async function GET() {
  if (!isTherapyRoomEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`clinic:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  try {
    const dayKey = clinicDayDateKey();
    const { data: existing } = await supabase
      .from("clinic_days")
      .select("id, day_date, summary, reflection_journal, closed_at")
      .eq("therapist_id", user.id)
      .eq("day_date", dayKey)
      .maybeSingle();

    let clinicDayId = existing?.id as string | undefined;

    if (!clinicDayId) {
      const { data: created, error } = await supabase
        .from("clinic_days")
        .insert({ therapist_id: user.id, day_date: dayKey })
        .select("id, day_date, summary, reflection_journal, closed_at")
        .single();
      if (error || !created) {
        return NextResponse.json(
          { error: clientSafeError("Could not open clinic day", error) },
          { status: 500 },
        );
      }
      clinicDayId = created.id;

      const { data: avatars } = await supabase
        .from("avatars")
        .select("id, name, disorder, portrait_url, clinical_core")
        .eq("is_active", true)
        .order("name")
        .limit(6);

      const dayStart = `${dayKey}T09:00:00.000Z`;
      const rows = (avatars ?? []).map((av, index) => {
        const core = av.clinical_core as
          | { risk_profile?: { suicidal_ideation?: string } }
          | null;
        const difficulty: CaseDifficulty =
          index === 0 ? "beginner" : index >= 4 ? "advanced" : "intermediate";
        return {
          clinic_day_id: clinicDayId,
          therapist_id: user.id,
          avatar_id: av.id,
          slot_index: index,
          scheduled_at: new Date(
            new Date(dayStart).getTime() + index * 50 * 60 * 1000,
          ).toISOString(),
          status: "scheduled",
          urgency: urgencyFromRisk(core?.risk_profile?.suicidal_ideation),
          referral_source: [
            "Primary care referral",
            "Self-referral",
            "Emergency department",
            "Student health",
            "Occupational health",
            "Family physician",
          ][index % 6],
          session_number: 1,
          difficulty,
          outstanding_tasks: ["Review referral", "Confirm identity"],
        };
      });

      if (rows.length) {
        await supabase.from("clinic_appointments").insert(rows);
      }
    }

    const { data: appts, error: apptErr } = await supabase
      .from("clinic_appointments")
      .select(
        "id, clinic_day_id, avatar_id, session_id, slot_index, scheduled_at, status, urgency, referral_source, session_number, difficulty, outstanding_tasks, avatars(name, disorder, portrait_url)",
      )
      .eq("clinic_day_id", clinicDayId)
      .order("slot_index", { ascending: true });

    if (apptErr) {
      return NextResponse.json(
        { error: clientSafeError("Could not load schedule", apptErr) },
        { status: 500 },
      );
    }

    const unreadSupervisor = await countUnreadSupervisor(supabase, user.id);

    const cards: ClinicAppointmentCard[] = (appts ?? []).map((row) => {
      const avatar = (Array.isArray(row.avatars) ? row.avatars[0] : row.avatars) as {
        name: string;
        disorder: string;
        portrait_url: string | null;
      } | null;
      const difficulty = (row.difficulty ?? "intermediate") as CaseDifficulty;
      const showDx = chartSectionsForDifficulty(difficulty).includes("diagnosis");
      return buildAppointmentCard({
        clinicDayId: row.clinic_day_id,
        avatarId: row.avatar_id,
        avatarName: avatar?.name ?? "Patient",
        portraitUrl: avatar?.portrait_url ?? null,
        slotIndex: row.slot_index,
        dayStartIso: row.scheduled_at,
        sessionId: row.session_id,
        status: row.status,
        diagnosis: showDx ? avatar?.disorder ?? null : null,
        difficulty,
        sessionNumber: row.session_number ?? 1,
        outstandingTasks: Array.isArray(row.outstanding_tasks)
          ? (row.outstanding_tasks as string[])
          : [],
        showDiagnosis: showDx,
        urgency: row.urgency,
      });
    });

    // Preserve DB appointment ids on cards
    const withIds = cards.map((card, i) => ({
      ...card,
      id: (appts?.[i]?.id as string) ?? card.id,
      scheduledAt: (appts?.[i]?.scheduled_at as string) ?? card.scheduledAt,
      referralSource:
        (appts?.[i]?.referral_source as string) ?? card.referralSource,
    }));

    return NextResponse.json({
      clinicDay: {
        id: clinicDayId,
        date: dayKey,
        closedAt: existing?.closed_at ?? null,
        summary: existing?.summary ?? null,
        reflectionJournal: existing?.reflection_journal ?? null,
      },
      appointments: withIds,
      unreadSupervisorMessages: unreadSupervisor,
      outstandingTasks: withIds.flatMap((a) =>
        a.status === "scheduled" || a.status === "checked_in"
          ? a.outstandingTasks.map((t) => `${a.patientDisplay}: ${t}`)
          : [],
      ),
    });
  } catch (e) {
    return NextResponse.json(
      { error: clientSafeError("Clinic unavailable", e instanceof Error ? e : null) },
      { status: 500 },
    );
  }
}

async function countUnreadSupervisor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number> {
  const { data: lp } = await supabase
    .from("learner_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!lp?.id) return 0;
  const { count } = await supabase
    .from("coach_feedback")
    .select("id", { count: "exact", head: true })
    .eq("learner_id", lp.id);
  return count ?? 0;
}
