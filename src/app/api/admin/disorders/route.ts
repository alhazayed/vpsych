import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { getBuiltinCatalog } from "@/lib/case-engine/catalog";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.disorders.list",
    resourceType: "disorders",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-disorders:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
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
