export {
  validateVirtualPatientWrite,
  assessPublishReadiness,
  assessDraftWrite,
  validateSlug,
  isArabicPersonalityStub,
  type ValidationIssue,
  type ValidationResult,
  type VirtualPatientWriteInput,
  type PublishContext,
} from "./validation";

export {
  assessCaseReadiness,
  assessCaseReadinessFromAvatar,
  type CaseReadinessResult,
  type ReadinessItem,
  type ReadinessSectionId,
  type ReadinessStatus,
  type AssessCaseReadinessOptions,
} from "./readiness";

export {
  createVirtualPatientDraft,
  updateVirtualPatientDraft,
  publishVirtualPatient,
  archiveVirtualPatient,
  restoreVirtualPatient,
  moveVirtualPatientToTesting,
  transitionVirtualPatientLifecycle,
  deactivateVirtualPatient,
  duplicateVirtualPatient,
  resolvePublishContext,
  avatarToWriteInput,
  readLifecycleStatus,
  isEditableLifecycle,
  assertAvatarContentMutable,
  buildRpcPayload,
  type PersistResult,
} from "./persist";

export {
  canTransitionLifecycle,
  isActiveFromLifecycle,
  isTherapistVisible,
  type VirtualPatientLifecycleStatus,
} from "@/lib/admin/virtual-patient-lifecycle";
