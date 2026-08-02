import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAnalytics, evaluateCertifications } from "@/lib/ace";
import { ensureLearnerProfile } from "@/lib/ace/persist";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const userId =
    targetUserId && me?.role === "admin" ? targetUserId : user.id;

  const profile = await ensureLearnerProfile(supabase, userId);

  const { data: history } = await supabase
    .from("adaptive_case_history")
    .select("diagnosis_slug, difficulty, focus_competencies, created_at")
    .eq("learner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const { data: trends } = await supabase
    .from("performance_trends")
    .select("*")
    .eq("learner_id", profile.id)
    .maybeSingle();

  const completed = (history ?? [])
    .map((h) => h.diagnosis_slug)
    .filter(Boolean) as string[];

  const analytics = buildAnalytics(
    profile,
    ((profile.metadata?.history_overall as number[]) ?? []),
    completed,
    [],
  );

  return NextResponse.json({
    analytics,
    certifications: evaluateCertifications(profile),
    caseHistory: history ?? [],
    trends: trends ?? null,
    heatMap: analytics.weaknesses.map((w) => ({
      competency: w,
      intensity: 100 - (analytics.radar.find((r) => r.competency_id === w)?.score ?? 50),
    })),
    strengthMap: analytics.strengths.map((s) => ({
      competency: s,
      score: analytics.radar.find((r) => r.competency_id === s)?.score ?? 0,
    })),
  });
}
