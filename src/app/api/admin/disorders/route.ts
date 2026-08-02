import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBuiltinCatalog } from "@/lib/case-engine/catalog";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("disorders")
    .select(
      "id, slug, name, dsm5_code, icd10_code, icd11_code, category, min_age, max_age, is_active",
    )
    .order("name");

  if (error) {
    // Fallback catalog if migration not applied
    const catalog = getBuiltinCatalog();
    return NextResponse.json({
      source: "builtin",
      disorders: catalog.disorders.map((d) => ({
        id: d.id,
        slug: d.slug,
        name: d.name,
        dsm5_code: d.dsm5_code,
        icd10_code: d.icd10_code,
        icd11_code: d.icd11_code,
        category: d.category,
        min_age: d.min_age,
        max_age: d.max_age,
        is_active: d.is_active,
      })),
      difficulties: catalog.difficultyProfiles,
      therapies: catalog.therapyProfiles,
      comorbidityRules: catalog.comorbidityRules,
    });
  }

  const catalog = getBuiltinCatalog();
  return NextResponse.json({
    source: "database",
    disorders: rows ?? [],
    difficulties: catalog.difficultyProfiles,
    therapies: catalog.therapyProfiles,
  });
}
