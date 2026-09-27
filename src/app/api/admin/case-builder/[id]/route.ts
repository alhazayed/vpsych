import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import {
  avatarToGuidedDraft,
  buildGuidedMergeWriteInput,
  changeSourcesForAudit,
  GUIDED_EDITABLE_FIELDS,
  listApprovedSaveFields,
  type GuidedCaseDraft,
  type GuidedChangeApprovals,
  type GuidedEditableField,
} from "@/lib/admin/case-builder";
import {
  assessCaseReadinessFromAvatar,
  assertAvatarContentMutable,
  isEditableLifecycle,
  readLifecycleStatus,
  updateVirtualPatientDraft,
} from "@/lib/admin/virtual-patient";
import type { Avatar } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

function parseApprovedFields(raw: unknown): GuidedEditableField[] | null {
  if (!Array.isArray(raw)) return null;
  const allowed = new Set<string>(GUIDED_EDITABLE_FIELDS);
  const out: GuidedEditableField[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !allowed.has(item)) return null;
    out.push(item as GuidedEditableField);
  }
  return out;
}

function parseApprovals(raw: unknown): GuidedChangeApprovals {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: GuidedChangeApprovals = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(GUIDED_EDITABLE_FIELDS as readonly string[]).includes(key)) continue;
    if (!value || typeof value !== "object") continue;
    const status = (value as { status?: unknown }).status;
    const source = (value as { source?: unknown }).source;
    if (
      status !== "unchanged" &&
      status !== "changed" &&
      status !== "ai_suggested" &&
      status !== "user_approved"
    ) {
      continue;
    }
    out[key as GuidedEditableField] = {
      status,
      source:
        source === "administrator" || source === "ai_suggestion_approved"
          ? source
          : undefined,
    };
  }
  return out;
}

/**
 * GET /api/admin/case-builder/[id]
 * Load existing Virtual Patient into Guided Edit draft (merge-safe mapper).
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.case_builder.read",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-case-builder-read:${user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: avatar, error } = await supabase
    .from("avatars")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !avatar) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const { data: persona } = await supabase
    .from("personas")
    .select(
      "id, slug, display_name, default_disorder_id, identity, traits, is_active",
    )
    .eq("avatar_id", id)
    .maybeSingle();

  const typed = avatar as Avatar;
  const lifecycleStatus = readLifecycleStatus(typed);
  const mapped = avatarToGuidedDraft(typed, persona);
  const readiness = assessCaseReadinessFromAvatar(typed, persona);

  return NextResponse.json({
    avatarId: typed.id,
    slug: typed.slug,
    name: typed.name,
    lifecycleStatus,
    editable: isEditableLifecycle(lifecycleStatus),
    draft: mapped.draft,
    arabicAuthorship: mapped.arabicAuthorship,
    presentationUnresolved: mapped.presentationUnresolved,
    readiness,
    fictionalNotice: "Fictional training case — not a real patient.",
  });
}

/**
 * PATCH /api/admin/case-builder/[id]
 * Merge-only Guided Edit save. Delegates persistence to updateVirtualPatientDraft
 * (same engine as PATCH /api/admin/avatars/[id]). Does not create a second case.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.case_builder.update",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-case-builder-update:${user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const mutable = await assertAvatarContentMutable(supabase, id);
  if (!mutable.ok) {
    return NextResponse.json(
      {
        error: mutable.error,
        code:
          mutable.status === 409
            ? "lifecycle_immutable"
            : "avatar_not_found",
      },
      { status: mutable.status },
    );
  }

  let body: {
    draft?: GuidedCaseDraft;
    approvals?: unknown;
    approvedFields?: unknown;
    confirmReview?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.draft || typeof body.draft !== "object") {
    return NextResponse.json({ error: "draft is required" }, { status: 400 });
  }
  if (body.draft.avatarId && body.draft.avatarId !== id) {
    return NextResponse.json(
      { error: "draft.avatarId does not match route id" },
      { status: 400 },
    );
  }
  if (body.confirmReview !== true) {
    return NextResponse.json(
      {
        error: "confirmReview must be true after reviewing changes",
        code: "review_required",
      },
      { status: 400 },
    );
  }

  const approvals = parseApprovals(body.approvals);
  const explicitFields = parseApprovedFields(body.approvedFields);
  if (body.approvedFields !== undefined && explicitFields === null) {
    return NextResponse.json(
      { error: "approvedFields contains an unknown field" },
      { status: 400 },
    );
  }

  const { data: avatar, error } = await supabase
    .from("avatars")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !avatar) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const { data: persona } = await supabase
    .from("personas")
    .select(
      "id, slug, display_name, default_disorder_id, identity, traits, is_active",
    )
    .eq("avatar_id", id)
    .maybeSingle();

  const typed = avatar as Avatar;
  const baseline = avatarToGuidedDraft(typed, persona).draft;
  const draft: GuidedCaseDraft = {
    ...body.draft,
    mode: "edit",
    avatarId: id,
  };

  const approvedFields =
    explicitFields ?? listApprovedSaveFields(baseline, draft, approvals);

  const merge = buildGuidedMergeWriteInput({
    existing: typed,
    existingPersona: persona,
    baseline,
    draft,
    approvals,
    approvedFields,
  });

  if (!merge.ok) {
    return NextResponse.json(
      { error: merge.error, code: merge.code },
      { status: merge.status },
    );
  }

  if (merge.noop) {
    const readiness = assessCaseReadinessFromAvatar(typed, persona);
    await logSecurityEvent({
      action: "admin.case_builder.update",
      outcome: "success",
      resourceType: "avatar",
      resourceId: id,
      request,
      metadata: {
        noop: true,
        appliedFields: [],
        arabicAuthorship: merge.arabicAuthorship,
      },
    });
    return NextResponse.json({
      ok: true,
      noop: true,
      avatarId: id,
      slug: typed.slug,
      appliedFields: [],
      readiness,
      message: "No approved changes — Virtual Patient unchanged",
    });
  }

  const result = await updateVirtualPatientDraft(supabase, id, merge.input);
  if (!result.ok) {
    await logSecurityEvent({
      action: "admin.case_builder.update",
      outcome: "failure",
      resourceType: "avatar",
      resourceId: id,
      request,
      metadata: { error: result.error, appliedFields: merge.appliedFields },
    });
    return NextResponse.json(
      {
        error: clientSafeError(result.error, result.error),
        issues: result.issues ?? [],
      },
      { status: result.status },
    );
  }

  const { data: updated } = await supabase
    .from("avatars")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const readiness = updated
    ? assessCaseReadinessFromAvatar(updated as Avatar, persona)
    : null;

  await logSecurityEvent({
    action: "admin.case_builder.update",
    outcome: "success",
    resourceType: "avatar",
    resourceId: result.avatarId,
    request,
    metadata: {
      slug: result.slug,
      lifecycle_status: result.lifecycleStatus,
      appliedFields: merge.appliedFields,
      changeSources: changeSourcesForAudit(approvals, merge.appliedFields),
      arabicAuthorship: merge.arabicAuthorship,
      mergeOnly: true,
    },
  });

  return NextResponse.json({
    ok: true,
    noop: false,
    avatarId: result.avatarId,
    slug: result.slug,
    lifecycleStatus: result.lifecycleStatus,
    appliedFields: merge.appliedFields,
    readiness,
    message: "Guided changes merged into existing draft",
    fictionalNotice: "Fictional training case — not a real patient.",
  });
}
