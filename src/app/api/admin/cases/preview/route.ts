import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  findDisorderBySlug,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type {
  CaseDifficulty,
  PersonaRow,
  TherapyModality,
} from "@/lib/case-engine/types";
import type { Avatar } from "@/lib/types";

/** Admin preview — generate CaseInstance JSON without persisting a session. */
export async function POST(request: Request) {
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

  const body = (await request.json()) as {
    avatarId?: string;
    disorderSlug?: string;
    comorbiditySlugs?: string[];
    difficulty?: CaseDifficulty;
    therapyModality?: TherapyModality;
    locale?: string;
    seed?: string;
  };

  if (!body.avatarId || !body.disorderSlug) {
    return NextResponse.json(
      { error: "avatarId and disorderSlug required" },
      { status: 400 },
    );
  }

  const { data: avatar } = await supabase
    .from("avatars")
    .select("*")
    .eq("id", body.avatarId)
    .single();
  if (!avatar) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }
  const typed = avatar as Avatar;

  const { data: dbPersona } = await supabase
    .from("personas")
    .select("*")
    .eq("avatar_id", typed.id)
    .maybeSingle();

  const persona: PersonaRow = (dbPersona as PersonaRow | null) ?? {
    id: typed.id,
    avatar_id: typed.id,
    slug: typed.slug ?? typed.id,
    display_name: typed.name,
    identity: {
      age: typed.clinical_core?.age ?? typed.age ?? 30,
      gender:
        (typed.clinical_core?.gender as PersonaRow["identity"]["gender"]) ??
        "unspecified",
    },
    traits: {},
    baseline_history: {},
    default_disorder_id: null,
    is_active: true,
  };

  const catalog = getBuiltinCatalog();
  const primary = findDisorderBySlug(body.disorderSlug, catalog);
  if (!primary) {
    return NextResponse.json({ error: "Unknown disorder" }, { status: 400 });
  }
  const comorbidities = (body.comorbiditySlugs ?? [])
    .map((s) => findDisorderBySlug(s, catalog))
    .filter(Boolean);

  const result = generateCaseInstance({
    persona,
    avatarId: typed.id,
    primaryDisorder: primary,
    comorbidities: comorbidities as NonNullable<typeof comorbidities[number]>[],
    difficulty: body.difficulty ?? "intermediate",
    therapyModality: body.therapyModality ?? "supportive",
    locale: body.locale ?? "en-US",
    seed: body.seed,
    legacyClinicalCore: typed.clinical_core,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.issues }, { status: 400 });
  }

  return NextResponse.json({
    snapshot: result.snapshot,
    exportJson: result.snapshot,
  });
}
