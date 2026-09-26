import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  guidedDraftToWriteInput,
  validateGuidedDraft,
  type GuidedCaseDraft,
} from "@/lib/admin/case-builder";
import { createVirtualPatientDraft } from "@/lib/admin/virtual-patient/persist";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";

/**
 * Persist an educator-approved guided draft as a Virtual Patient draft.
 * Does not publish. AI output is only included when sectionApprovals.generated.
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.case_builder.create",
    resourceType: "case_builder",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-case-builder-create:${auth.user.id}`,
    20,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { draft?: GuidedCaseDraft; skipApprovals?: boolean };
  try {
    body = (await request.json()) as {
      draft?: GuidedCaseDraft;
      skipApprovals?: boolean;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.draft || typeof body.draft !== "object") {
    return NextResponse.json({ error: "draft is required" }, { status: 400 });
  }

  // skipApprovals only for save-draft soft path — still requires core clinical fields
  const mode = body.skipApprovals ? "step" : "create";
  const validation = validateGuidedDraft(body.draft, mode);
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: "Case validation failed",
        issues: validation.issues.filter((i) => i.severity === "error"),
      },
      { status: 400 },
    );
  }

  const input = guidedDraftToWriteInput(body.draft);

  try {
    const result = await createVirtualPatientDraft(auth.supabase, input);
    if (!result.ok) {
      await logSecurityEvent({
        action: "admin.case_builder.create",
        outcome: "failure",
        resourceType: "avatar",
        request,
        metadata: { error: result.error },
      });
      return NextResponse.json(
        { error: result.error, issues: result.issues },
        { status: result.status },
      );
    }

    await logSecurityEvent({
      action: "admin.case_builder.create",
      outcome: "success",
      resourceType: "avatar",
      resourceId: result.avatarId,
      request,
      metadata: {
        slug: result.slug,
        lifecycleStatus: result.lifecycleStatus,
        caseType: "training_simulation",
      },
    });

    return NextResponse.json({
      ok: true,
      avatarId: result.avatarId,
      personaId: result.personaId,
      slug: result.slug,
      lifecycleStatus: result.lifecycleStatus,
      caseType: "training_simulation",
      fictionalNotice: "Fictional training case — not a real patient.",
    });
  } catch (error) {
    await logSecurityEvent({
      action: "admin.case_builder.create",
      outcome: "failure",
      resourceType: "case_builder",
      request,
    });
    return NextResponse.json(
      {
        error: clientSafeError(
          error instanceof Error ? error.message : "Create failed",
        ),
      },
      { status: 500 },
    );
  }
}
