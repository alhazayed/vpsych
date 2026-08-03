import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { generateAdaptiveCase, generateCurriculum } from "@/lib/ace";
import { ensureLearnerProfile } from "@/lib/ace/persist";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeDbError } from "@/lib/safe-client-error";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`adaptive-case:${user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    seed?: string;
    persist?: boolean;
  };

  const profile = await ensureLearnerProfile(supabase, user.id);
  const { data: history } = await supabase
    .from("adaptive_case_history")
    .select("fingerprint")
    .eq("learner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const priorFingerprints = (history ?? []).map((h) => h.fingerprint);
  const path = generateCurriculum(profile);
  // Use exposure-derived current_step — do NOT force 0 (Passive-SI trap).
  const nextCase = generateAdaptiveCase(profile, {
    seed: body.seed ?? `api:${profile.id}:${Date.now()}`,
    priorFingerprints,
    stepIndex: path.current_step,
  });

  // Persist recommendation history by default so anti-repeat works across generate-next.
  const writer = createServiceClient() ?? supabase;
  const { error: histErr } = await writer.from("adaptive_case_history").upsert(
    {
      learner_id: profile.id,
      session_id: null,
      focus_competencies: nextCase.focusCompetencies,
      adaptation: {
        adaptations: nextCase.adaptations,
        rationale: nextCase.rationale,
        confidence: nextCase.confidence,
        explainability: nextCase.explainability,
        source: "adaptive_case_api",
      },
      diagnosis_slug: nextCase.disorderSlug ?? null,
      difficulty: nextCase.difficulty,
      fingerprint: nextCase.fingerprint,
    },
    { onConflict: "learner_id,fingerprint", ignoreDuplicates: true },
  );
  if (histErr) {
    console.warn("[adaptive-case] history:", histErr.message);
  }

  return NextResponse.json({
    ok: true,
    case: nextCase,
    curriculum: path,
    persisted: !histErr,
    ...(histErr ? { persistWarning: sanitizeDbError(histErr.message) } : {}),
    startSessionHint: {
      presetSlug: nextCase.presetSlug,
      disorderSlug: nextCase.disorderSlug,
      comorbiditySlugs: nextCase.comorbiditySlugs,
      difficulty: nextCase.difficulty,
      therapyModality: nextCase.therapyModality,
    },
  });
}
