import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  findPresentationById,
  generateCaseBuilderSuggestions,
  type CaseBuilderGenerateKind,
  type GuidedCaseDraft,
} from "@/lib/admin/case-builder";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";

const KINDS = new Set<CaseBuilderGenerateKind>([
  "symptoms",
  "context",
  "framework",
  "case",
]);

/**
 * AI suggestions for Guided Case Builder — never persists.
 * Educator must accept/edit before create.
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.case_builder.generate",
    resourceType: "case_builder",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-case-builder-generate:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { kind?: string; draft?: GuidedCaseDraft };
  try {
    body = (await request.json()) as { kind?: string; draft?: GuidedCaseDraft };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const kind = body.kind as CaseBuilderGenerateKind | undefined;
  if (!kind || !KINDS.has(kind) || !body.draft || typeof body.draft !== "object") {
    return NextResponse.json(
      { error: "kind and draft are required" },
      { status: 400 },
    );
  }

  const presentation = body.draft.presentationId
    ? findPresentationById(body.draft.presentationId)
    : null;

  try {
    const result = await generateCaseBuilderSuggestions({
      kind,
      draft: body.draft,
      presentation,
    });

    await logSecurityEvent({
      action: `admin.case_builder.generate.${kind}`,
      outcome: result.ok ? "success" : "failure",
      resourceType: "case_builder",
      request,
      metadata: {
        kind,
        code: result.ok ? undefined : result.code,
        aiSource: result.ok ? result.aiSource : undefined,
      },
    });

    if (!result.ok) {
      const status = result.code === "AI_UNAVAILABLE" ? 503 : 422;
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          manualFallback: true,
        },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      kind: result.kind,
      aiSource: result.aiSource,
      model: result.model,
      result,
    });
  } catch (error) {
    await logSecurityEvent({
      action: "admin.case_builder.generate",
      outcome: "failure",
      resourceType: "case_builder",
      request,
      metadata: { kind },
    });
    return NextResponse.json(
      {
        error: clientSafeError(
          error instanceof Error ? error.message : "Generation failed",
        ),
        manualFallback: true,
      },
      { status: 500 },
    );
  }
}
