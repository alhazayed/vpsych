import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { sanitizeDbError } from "@/lib/safe-client-error";
import { listBuiltinTemplates } from "@/lib/scenario-templates/catalog";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-templates:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await supabase
    .from("clinical_templates")
    .select(
      "id, slug, name, description, specialty, difficulty, language, culture, therapy_modality, severity, risk_level, assessment_type, enabled, version, estimated_duration_minutes, target_learners, archived_at, primary_diagnosis_id",
    )
    .is("archived_at", null)
    .order("name");

  if (error) {
    return NextResponse.json({
      source: "builtin",
      templates: listBuiltinTemplates(),
    });
  }

  return NextResponse.json({ source: "database", templates: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-templates:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    action?: "create" | "clone" | "archive" | "export";
    templateId?: string;
    slug?: string;
    name?: string;
    description?: string;
    specialty?: string;
    primaryDiagnosisId?: string;
    difficulty?: string;
    language?: string;
    therapyModality?: string;
    severity?: string;
    assessmentType?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "archive" && body.templateId) {
    const { error } = await supabase
      .from("clinical_templates")
      .update({ archived_at: new Date().toISOString(), enabled: false })
      .eq("id", body.templateId);
    if (error) {
      console.warn("[api]", error.message);
      return NextResponse.json({ error: sanitizeDbError(error.message) }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "export" && body.templateId) {
    const { data: tpl } = await supabase
      .from("clinical_templates")
      .select("*")
      .eq("id", body.templateId)
      .single();
    if (!tpl) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { data: objectives } = await supabase
      .from("template_objectives")
      .select("*")
      .eq("template_id", body.templateId);
    const { data: competencies } = await supabase
      .from("template_competencies")
      .select("*")
      .eq("template_id", body.templateId);
    return NextResponse.json({
      template: tpl,
      objectives: objectives ?? [],
      competencies: competencies ?? [],
    });
  }

  if (body.action === "clone" && body.templateId) {
    const { data: src, error } = await supabase
      .from("clinical_templates")
      .select("*")
      .eq("id", body.templateId)
      .single();
    if (error || !src) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    const {
      id: _id,
      created_at: _c,
      updated_at: _u,
      archived_at: _a,
      ...rest
    } = src;
    const newSlug = `${src.slug}-clone-${Date.now().toString(36)}`;
    const { data: cloned, error: cloneErr } = await supabase
      .from("clinical_templates")
      .insert({
        ...rest,
        slug: newSlug,
        name: `${src.name} (Clone)`,
        version: 1,
        created_by: user.id,
        archived_at: null,
        enabled: false,
      })
      .select("id, slug, name")
      .single();
    if (cloneErr) {
      return NextResponse.json({ error: cloneErr.message }, { status: 500 });
    }
    await supabase.from("template_versions").insert({
      template_id: cloned.id,
      version: 1,
      snapshot: { cloned_from: body.templateId },
      change_notes: "Cloned template",
      created_by: user.id,
    });
    return NextResponse.json({ ok: true, template: cloned });
  }

  if (!body.slug || !body.name || !body.primaryDiagnosisId) {
    return NextResponse.json(
      { error: "slug, name, primaryDiagnosisId required" },
      { status: 400 },
    );
  }

  const { data: created, error: createErr } = await supabase
    .from("clinical_templates")
    .insert({
      slug: body.slug,
      name: body.name,
      description: body.description ?? null,
      specialty: body.specialty ?? "general_adult_psychiatry",
      primary_diagnosis_id: body.primaryDiagnosisId,
      difficulty: body.difficulty ?? "intermediate",
      language: body.language ?? "en-US",
      therapy_modality: body.therapyModality ?? "supportive",
      severity: body.severity ?? "moderate",
      assessment_type: body.assessmentType ?? "initial_assessment",
      grading_rubric: { pass_threshold: 60, outstanding_threshold: 85 },
      report_template: { sections: ["summary", "risk", "plan"] },
      enabled: false,
      version: 1,
      created_by: user.id,
    })
    .select("id, slug, name")
    .single();

  if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 500 });
  }

  await supabase.from("template_versions").insert({
    template_id: created.id,
    version: 1,
    snapshot: { created: true },
    change_notes: "Initial version",
    created_by: user.id,
  });
  await supabase.from("template_objectives").insert({
    template_id: created.id,
    category: "skills",
    statement: "Complete a structured clinical assessment",
    sort_order: 1,
  });
  await supabase.from("template_competencies").insert({
    template_id: created.id,
    competency_id: "alliance",
    label: "Therapeutic alliance",
    weight: 1,
    max_score: 5,
    sort_order: 1,
  });

  return NextResponse.json({ ok: true, template: created }, { status: 201 });
}
