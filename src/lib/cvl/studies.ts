import type {
  CvlArm,
  CvlReviewerType,
  CvlStudy,
  CvlStudyKind,
} from "@/lib/cvl/types";
import { CVL_ARMS, CVL_REVIEWER_TYPES, CVL_VERSION } from "@/lib/cvl/types";
import {
  allocateArmFromBlocks,
  buildRandomizationBlocks,
  mintReviewerToken,
} from "@/lib/cvl/randomization";
import {
  cvlInsertAssignment,
  cvlInsertStudy,
} from "@/lib/cvl/store";

export function validateCreateStudy(
  raw: unknown,
):
  | {
      ok: true;
      draft: Omit<CvlStudy, "id" | "created_at" | "updated_at">;
    }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const body = raw as Partial<CvlStudy> & { kind?: CvlStudyKind };
  if (!body.title || String(body.title).trim().length < 4) {
    return { ok: false, error: "title required" };
  }
  if (!body.kind) {
    return { ok: false, error: "kind required" };
  }
  const arms = (body.arms?.length ? body.arms : [...CVL_ARMS]) as CvlArm[];
  for (const a of arms) {
    if (!(CVL_ARMS as readonly string[]).includes(a)) {
      return { ok: false, error: `invalid arm ${a}` };
    }
  }
  const reviewers = (body.target_reviewer_types?.length
    ? body.target_reviewer_types
    : ["consultant_psychiatrist", "psychiatry_resident"]) as CvlReviewerType[];
  for (const r of reviewers) {
    if (!(CVL_REVIEWER_TYPES as readonly string[]).includes(r)) {
      return { ok: false, error: `invalid reviewer_type ${r}` };
    }
  }

  return {
    ok: true,
    draft: {
      kind: body.kind,
      title: String(body.title).trim(),
      status: body.status ?? "draft",
      protocol_version: body.protocol_version ?? CVL_VERSION,
      irb_reference: body.irb_reference ?? null,
      arms,
      target_reviewer_types: reviewers,
      disorder_slugs: body.disorder_slugs ?? [],
      preregistration: body.preregistration ?? {
        primary_endpoint: "CRI",
        noninferiority_margin_vs_sp: 5,
        note: "Preregister before unblinding",
      },
      metadata: body.metadata ?? {},
    },
  };
}

export function createStudyWithAssignments(input: {
  draft: Omit<CvlStudy, "id" | "created_at" | "updated_at">;
  cases: Array<{ case_ref: string; disorder_slug: string; modality?: string }>;
  reviewers_per_case?: number;
  seed?: string;
}): {
  study: CvlStudy;
  assignments: ReturnType<typeof cvlInsertAssignment>[];
} {
  const study = cvlInsertStudy(input.draft);
  const clusters = [
    ...new Set(input.cases.map((c) => clusterFor(c.disorder_slug))),
  ];
  const blocks = buildRandomizationBlocks({
    seed: input.seed ?? study.id,
    disorder_clusters: clusters,
    arms: study.arms,
  });
  const assignments = [];
  let i = 0;
  const nReviewers = input.reviewers_per_case ?? 2;
  for (const c of input.cases) {
    for (let r = 0; r < nReviewers; r++) {
      const reviewer_type =
        study.target_reviewer_types[r % study.target_reviewer_types.length]!;
      const { arm, block_id } = allocateArmFromBlocks(
        blocks,
        clusterFor(c.disorder_slug),
        i++,
      );
      assignments.push(
        cvlInsertAssignment({
          study_id: study.id,
          reviewer_token: mintReviewerToken(reviewer_type),
          reviewer_type,
          arm,
          case_ref: c.case_ref,
          disorder_slug: c.disorder_slug,
          modality: c.modality ?? "transcript",
          block_id,
        }),
      );
    }
  }
  return { study, assignments };
}

function clusterFor(slug: string): string {
  if (/mdd|bipolar|mania|depress/i.test(slug)) return "mood";
  if (/gad|panic|anxiety|ocd/i.test(slug)) return "anxiety";
  if (/schizo|psychos/i.test(slug)) return "psychosis";
  if (/ptsd|trauma/i.test(slug)) return "trauma";
  if (/bpd|borderline|personality/i.test(slug)) return "personality";
  if (/alcohol|substance|adhd/i.test(slug)) return "other";
  return "general";
}
