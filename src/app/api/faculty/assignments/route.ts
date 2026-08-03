import { NextResponse } from "next/server";
import { requireInstitutionPermission } from "@/lib/api-auth";
import { getBuiltinInstitutionTree } from "@/lib/enterprise/catalog";

export const dynamic = "force-dynamic";

/** List assignments for an institution (faculty permission). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const institutionId = url.searchParams.get("institution_id") ?? "";

  const auth = await requireInstitutionPermission(request, {
    permission: "assignment.manage",
    institutionId,
    action: "faculty.assignments.list",
    resourceType: "learning_assignments",
  });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("learning_assignments")
    .select("*")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    const tree = getBuiltinInstitutionTree();
    return NextResponse.json({
      assignments: tree.assignments.filter(
        (a) => a.institution_id === institutionId || true,
      ),
      source: "builtin",
      warning: error.message,
    });
  }

  return NextResponse.json({ assignments: data ?? [], source: "database" });
}

/** Create assignment within the caller's institution. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const institution_id = String(body.institution_id ?? "").trim();
  const auth = await requireInstitutionPermission(request, {
    permission: "assignment.manage",
    institutionId: institution_id,
    action: "faculty.assignments.create",
    resourceType: "learning_assignments",
  });
  if (!auth.ok) return auth.response;

  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const is_required = body.is_required !== false;
  const is_elective = Boolean(body.is_elective);
  if (is_required && is_elective) {
    return NextResponse.json(
      { error: "assignment cannot be both required and elective" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("learning_assignments")
    .insert({
      institution_id,
      class_id: body.class_id ?? null,
      cohort_id: body.cohort_id ?? null,
      created_by: auth.user.id,
      title,
      description: body.description ?? null,
      status: body.status ?? "draft",
      is_required,
      is_elective,
      due_at: body.due_at ?? null,
      opens_at: body.opens_at ?? null,
      scenario_template_slug: body.scenario_template_slug ?? null,
      instructor_preset_slug: body.instructor_preset_slug ?? null,
      required_competency_ids: body.required_competency_ids ?? [],
      pass_threshold: body.pass_threshold ?? 70,
      max_attempts: body.max_attempts ?? 3,
      metadata: body.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ assignment: data }, { status: 201 });
}
