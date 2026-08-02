import { CERTIFICATION_BADGES, scoreOf } from "./catalog";
import type {
  AceCertificationStatus,
  CertificationBadge,
  LearnerProfile,
} from "./types";

export type EarnedCertification = {
  badge_slug: string;
  title: string;
  status: AceCertificationStatus;
  competency_id: string;
  score: number;
  samples: number;
};

export function evaluateCertifications(
  profile: LearnerProfile,
  badges: CertificationBadge[] = CERTIFICATION_BADGES,
): EarnedCertification[] {
  return badges.map((b) => {
    const score = scoreOf(profile.competencies, b.competency_id);
    const samples =
      profile.competencies.find((c) => c.competency_id === b.competency_id)
        ?.samples ?? 0;
    let status: AceCertificationStatus = "not_started";
    if (samples > 0) status = "in_progress";
    if (score >= b.threshold - 10 && samples >= Math.max(1, b.min_samples - 1)) {
      status = "eligible";
    }
    if (score >= b.threshold && samples >= b.min_samples) {
      status = "certified";
    }
    return {
      badge_slug: b.badge_slug,
      title: b.title,
      status,
      competency_id: b.competency_id,
      score,
      samples,
    };
  });
}

export function updateCertificationStatus(
  profile: LearnerProfile,
): LearnerProfile {
  const earned = evaluateCertifications(profile);
  const certified = earned.filter((e) => e.status === "certified").length;
  const eligible = earned.filter((e) => e.status === "eligible").length;
  let certification_status = profile.certification_status;
  if (certified >= 3) certification_status = "certified";
  else if (certified >= 1 || eligible >= 2) certification_status = "eligible";
  else if (profile.completed_case_count > 0) {
    certification_status = "in_progress";
  }
  return { ...profile, certification_status };
}
