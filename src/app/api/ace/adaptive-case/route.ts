import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAdaptiveCase, generateCurriculum } from "@/lib/ace";
import { ensureLearnerProfile } from "@/lib/ace/persist";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    seed?: string;
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
  const nextCase = generateAdaptiveCase(profile, {
    seed: body.seed ?? `api:${profile.id}:${Date.now()}`,
    priorFingerprints,
    stepIndex: path.current_step,
  });

  return NextResponse.json({
    ok: true,
    case: nextCase,
    curriculum: path,
    startSessionHint: {
      presetSlug: nextCase.presetSlug,
      disorderSlug: nextCase.disorderSlug,
      comorbiditySlugs: nextCase.comorbiditySlugs,
      difficulty: nextCase.difficulty,
      therapyModality: nextCase.therapyModality,
    },
  });
}
