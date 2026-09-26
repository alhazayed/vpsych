import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  COMMUNICATION_STYLES,
  GOAL_CATEGORY_ORDER,
  THERAPEUTIC_CHALLENGES,
  THERAPY_FRAMEWORKS,
  listLibrarySymptoms,
  listSessionGoals,
  listTrainingPresentations,
} from "@/lib/admin/case-builder";
import { rateLimit } from "@/lib/rate-limit";

/** Read-only educational catalogues for Guided Case Builder. */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.case_builder.catalogues",
    resourceType: "case_builder",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-case-builder-catalogues:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  return NextResponse.json({
    caseType: "training_simulation",
    presentations: listTrainingPresentations().map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      categoryLabel: p.categoryLabel,
      dsm5_code: p.dsm5_code,
      icd11_code: p.icd11_code,
      taxonomy: p.taxonomy,
      taxonomyVersion: p.taxonomyVersion,
      min_age: p.min_age,
      max_age: p.max_age,
      sessionGoals: p.sessionGoals,
      symptoms: p.symptoms,
      idealApproach: p.idealApproach,
      disclosureRules: p.disclosureRules,
    })),
    goals: listSessionGoals(),
    goalCategories: GOAL_CATEGORY_ORDER,
    symptoms: listLibrarySymptoms(),
    frameworks: THERAPY_FRAMEWORKS,
    communicationStyles: COMMUNICATION_STYLES,
    therapeuticChallenges: THERAPEUTIC_CHALLENGES,
  });
}
