/**
 * Soft-fail enterprise after education / validation / supervisor.
 * Stamps tenant analytics context only. Never blocks report.
 * Never writes clinical_snapshot / case_memory / patient_long_term_memory /
 * DecisionPlan / patient prompt. Never owns Emotion, Adaptation, Case Engine,
 * Clinical Intelligence, Validation, or Supervisor skill evaluation.
 */

import { runEnterpriseEngine } from "@/lib/enterprise/engine";
import type { EnterpriseBundle } from "@/lib/enterprise/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EnterpriseBridgeResult = {
  ok: boolean;
  bundle: EnterpriseBundle | null;
  error: string | null;
};

/**
 * Best-effort Stage 10 enterprise hook.
 * Observational / tenancy analytics only.
 */
export async function runEnterpriseAfterAssessment(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    sessionId: string;
    overall: number;
    organizationId?: string | null;
    profileRole?: "therapist" | "admin";
    membershipRole?: string | null;
    programId?: string | null;
    campusId?: string | null;
  },
): Promise<EnterpriseBridgeResult> {
  try {
    let organizationId = opts.organizationId ?? null;
    let membershipRole = opts.membershipRole ?? null;

    if (!organizationId) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("primary_institution_id, role")
          .eq("id", opts.userId)
          .maybeSingle();
        organizationId =
          (profile?.primary_institution_id as string | null) ?? null;
        if (!opts.profileRole && profile?.role === "admin") {
          opts.profileRole = "admin";
        }
      } catch {
        // soft-fail
      }
    }

    if (organizationId && !membershipRole) {
      try {
        const { data: membership } = await supabase
          .from("institution_memberships")
          .select("role")
          .eq("user_id", opts.userId)
          .eq("institution_id", organizationId)
          .eq("is_active", true)
          .maybeSingle();
        membershipRole = (membership?.role as string | null) ?? null;
      } catch {
        // soft-fail
      }
    }

    const bundle = runEnterpriseEngine({
      organization_id: organizationId,
      user_id: opts.userId,
      profile_role: opts.profileRole ?? "therapist",
      membership_role: membershipRole,
      campus_id: opts.campusId ?? null,
      program_id: opts.programId ?? null,
      session_count: 1,
      overall: opts.overall,
      issue_course_certificate: opts.overall >= 85,
      course_title: `Session ${opts.sessionId} formative credit`,
    });

    return { ok: true, bundle, error: null };
  } catch (e) {
    return {
      ok: false,
      bundle: null,
      error: e instanceof Error ? e.message : "enterprise_bridge_failed",
    };
  }
}
