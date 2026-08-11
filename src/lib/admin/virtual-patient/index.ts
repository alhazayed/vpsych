export {
  validateVirtualPatientWrite,
  assessPublishReadiness,
  assessDraftWrite,
  validateSlug,
  type ValidationIssue,
  type ValidationResult,
  type VirtualPatientWriteInput,
  type PublishContext,
} from "./validation";

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
  type PersistResult,
} from "./persist";

export {
  canTransitionLifecycle,
  isActiveFromLifecycle,
  isTherapistVisible,
  type VirtualPatientLifecycleStatus,
} from "@/lib/admin/virtual-patient-lifecycle";
