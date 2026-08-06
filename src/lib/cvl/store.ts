import { randomUUID } from "crypto";
import type {
  AssessmentAccuracyRow,
  BpcRatingSubmission,
  BtcRatingSubmission,
  CflRecord,
  CvlAssignment,
  CvlStudy,
  EducationOutcomeRow,
  HcfEvaluationRow,
  LongitudinalMeasureRow,
} from "@/lib/cvl/types";

const STUDIES: CvlStudy[] = [];
const ASSIGNMENTS: CvlAssignment[] = [];
const BPC: BpcRatingSubmission[] = [];
const BTC: BtcRatingSubmission[] = [];
const EDU: EducationOutcomeRow[] = [];
const LONG: LongitudinalMeasureRow[] = [];
const HCF: HcfEvaluationRow[] = [];
const CFL: CflRecord[] = [];
const AA: AssessmentAccuracyRow[] = [];

export function cvlMemoryEnabled(): boolean {
  return process.env.CVL_MEMORY_FALLBACK !== "0";
}

export function cvlClearMemory(): void {
  STUDIES.length = 0;
  ASSIGNMENTS.length = 0;
  BPC.length = 0;
  BTC.length = 0;
  EDU.length = 0;
  LONG.length = 0;
  HCF.length = 0;
  CFL.length = 0;
  AA.length = 0;
}

/** Replace memory vault with a corpus (used after DB load). */
export function cvlReplaceMemory(corpus: {
  studies: CvlStudy[];
  assignments: CvlAssignment[];
  bpc: BpcRatingSubmission[];
  btc: BtcRatingSubmission[];
  education: EducationOutcomeRow[];
  longitudinal: LongitudinalMeasureRow[];
  hcf: HcfEvaluationRow[];
  cfl: CflRecord[];
  assessment_accuracy?: AssessmentAccuracyRow[];
}): void {
  cvlClearMemory();
  STUDIES.push(...corpus.studies);
  ASSIGNMENTS.push(...corpus.assignments);
  BPC.push(...corpus.bpc);
  BTC.push(...corpus.btc);
  EDU.push(...corpus.education);
  LONG.push(...corpus.longitudinal);
  HCF.push(...corpus.hcf);
  CFL.push(...corpus.cfl);
  if (corpus.assessment_accuracy?.length) {
    AA.push(...corpus.assessment_accuracy);
  }
}

export function cvlInsertStudy(
  row: Omit<CvlStudy, "id" | "created_at" | "updated_at"> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
  },
): CvlStudy {
  const now = new Date().toISOString();
  const full: CvlStudy = {
    kind: row.kind,
    title: row.title,
    status: row.status,
    protocol_version: row.protocol_version,
    irb_reference: row.irb_reference,
    arms: row.arms,
    target_reviewer_types: row.target_reviewer_types,
    disorder_slugs: row.disorder_slugs,
    preregistration: row.preregistration,
    metadata: row.metadata,
    id: row.id ?? randomUUID(),
    created_at: row.created_at ?? now,
    updated_at: row.updated_at ?? now,
  };
  STUDIES.push(full);
  return full;
}

export function cvlListStudies(): CvlStudy[] {
  return [...STUDIES];
}

export function cvlGetStudy(id: string): CvlStudy | null {
  return STUDIES.find((s) => s.id === id) ?? null;
}

export function cvlUpdateStudyStatus(
  id: string,
  status: CvlStudy["status"],
): CvlStudy | null {
  const s = STUDIES.find((x) => x.id === id);
  if (!s) return null;
  s.status = status;
  s.updated_at = new Date().toISOString();
  return s;
}

export function cvlInsertAssignment(
  row: Omit<CvlAssignment, "id" | "created_at"> & {
    id?: string;
    created_at?: string;
  },
): CvlAssignment {
  const full: CvlAssignment = {
    study_id: row.study_id,
    reviewer_token: row.reviewer_token,
    reviewer_type: row.reviewer_type,
    arm: row.arm,
    case_ref: row.case_ref,
    disorder_slug: row.disorder_slug,
    modality: row.modality,
    block_id: row.block_id,
    id: row.id ?? randomUUID(),
    created_at: row.created_at ?? new Date().toISOString(),
  };
  ASSIGNMENTS.push(full);
  return full;
}

export function cvlListAssignments(studyId?: string): CvlAssignment[] {
  return studyId
    ? ASSIGNMENTS.filter((a) => a.study_id === studyId)
    : [...ASSIGNMENTS];
}

export function cvlGetAssignment(id: string): CvlAssignment | null {
  return ASSIGNMENTS.find((a) => a.id === id) ?? null;
}

export function cvlInsertBpc(row: BpcRatingSubmission): BpcRatingSubmission {
  BPC.push(row);
  return row;
}

export function cvlListBpc(studyId?: string): BpcRatingSubmission[] {
  return studyId ? BPC.filter((r) => r.study_id === studyId) : [...BPC];
}

export function cvlInsertBtc(row: BtcRatingSubmission): BtcRatingSubmission {
  BTC.push(row);
  return row;
}

export function cvlListBtc(studyId?: string): BtcRatingSubmission[] {
  return studyId ? BTC.filter((r) => r.study_id === studyId) : [...BTC];
}

export function cvlInsertEducation(row: EducationOutcomeRow): EducationOutcomeRow {
  EDU.push(row);
  return row;
}

export function cvlListEducation(studyId?: string): EducationOutcomeRow[] {
  return studyId ? EDU.filter((r) => r.study_id === studyId) : [...EDU];
}

export function cvlInsertLongitudinal(
  row: LongitudinalMeasureRow,
): LongitudinalMeasureRow {
  LONG.push(row);
  return row;
}

export function cvlListLongitudinal(
  studyId?: string,
): LongitudinalMeasureRow[] {
  return studyId ? LONG.filter((r) => r.study_id === studyId) : [...LONG];
}

export function cvlInsertHcf(row: HcfEvaluationRow): HcfEvaluationRow {
  HCF.push(row);
  return row;
}

export function cvlListHcf(studyId?: string): HcfEvaluationRow[] {
  return studyId ? HCF.filter((r) => r.study_id === studyId) : [...HCF];
}

export function cvlUpsertCfl(row: Omit<CflRecord, "id"> & { id?: string }): CflRecord {
  const existing = CFL.find((c) => c.case_ref === row.case_ref);
  if (existing) {
    Object.assign(existing, row, { id: existing.id });
    return existing;
  }
  const full: CflRecord = { ...row, id: row.id ?? randomUUID() };
  CFL.push(full);
  return full;
}

export function cvlListCfl(): CflRecord[] {
  return [...CFL];
}

export function cvlInsertAssessmentAccuracy(
  row: AssessmentAccuracyRow,
): AssessmentAccuracyRow {
  AA.push(row);
  return row;
}

export function cvlListAssessmentAccuracy(
  studyId?: string,
): AssessmentAccuracyRow[] {
  return studyId ? AA.filter((r) => r.study_id === studyId) : [...AA];
}
