import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_PROJECTION_TABLE,
  archiveFromPublished,
  canTransitionLifecycle,
  createLifecycleStatus,
  duplicateLifecycleStatus,
  isActiveFromLifecycle,
  isTherapistVisible,
  lifecycleBadgeTone,
  lifecycleMutatesClinicalSnapshots,
  lifecycleMutatesHistoricalSessions,
  readLifecycleFromRow,
  type VirtualPatientLifecycleStatus,
} from "./virtual-patient-lifecycle";

describe("VP lifecycle projection (Option B)", () => {
  it("maps draft/testing/archived to inactive and published to active", () => {
    for (const row of LIFECYCLE_PROJECTION_TABLE) {
      expect(isActiveFromLifecycle(row.status)).toBe(row.is_active);
      expect(isTherapistVisible(row.status)).toBe(row.therapistVisible);
    }
  });

  it("makes only published therapist-visible", () => {
    expect(isTherapistVisible("draft")).toBe(false);
    expect(isTherapistVisible("testing")).toBe(false);
    expect(isTherapistVisible("published")).toBe(true);
    expect(isTherapistVisible("archived")).toBe(false);
  });
});

describe("VP lifecycle state machine", () => {
  it("allows the PR #188 safety graph", () => {
    expect(canTransitionLifecycle("draft", "testing")).toBe(true);
    expect(canTransitionLifecycle("draft", "published")).toBe(true);
    expect(canTransitionLifecycle("draft", "archived")).toBe(true);
    expect(canTransitionLifecycle("testing", "draft")).toBe(true);
    expect(canTransitionLifecycle("testing", "published")).toBe(true);
    expect(canTransitionLifecycle("testing", "archived")).toBe(true);
    expect(canTransitionLifecycle("published", "archived")).toBe(true);
    expect(canTransitionLifecycle("archived", "draft")).toBe(true);
  });

  it("blocks published demotion without duplicate", () => {
    expect(canTransitionLifecycle("published", "draft")).toBe(false);
    expect(canTransitionLifecycle("published", "testing")).toBe(false);
  });

  it("create and duplicate always land on draft", () => {
    expect(createLifecycleStatus()).toBe("draft");
    expect(duplicateLifecycleStatus()).toBe("draft");
    expect(isActiveFromLifecycle(duplicateLifecycleStatus())).toBe(false);
  });

  it("treats published withdrawal as archive (deactivate ≡ archive)", () => {
    const next = archiveFromPublished();
    expect(next).toBe("archived");
    expect(canTransitionLifecycle("published", next)).toBe(true);
    expect(isActiveFromLifecycle(next)).toBe(false);
    expect(isTherapistVisible(next)).toBe(false);
  });
});

describe("VP lifecycle historical safety invariants", () => {
  it("declares lifecycle changes do not mutate historical sessions or snapshots", () => {
    expect(lifecycleMutatesHistoricalSessions()).toBe(false);
    expect(lifecycleMutatesClinicalSnapshots()).toBe(false);
  });

  it("archive is non-destructive at the contract layer (status retained in enum)", () => {
    const statuses: VirtualPatientLifecycleStatus[] = [
      "draft",
      "testing",
      "published",
      "archived",
    ];
    expect(statuses).toContain("archived");
    // Archive is a retained status, not a delete tombstone column.
    expect(archiveFromPublished()).toBe("archived");
  });
});

describe("VP lifecycle helpers", () => {
  it("badge tones distinguish four states", () => {
    expect(lifecycleBadgeTone("draft")).toBe("warning");
    expect(lifecycleBadgeTone("testing")).toBe("info");
    expect(lifecycleBadgeTone("published")).toBe("active");
    expect(lifecycleBadgeTone("archived")).toBe("inactive");
  });

  it("readLifecycleFromRow prefers lifecycle_status over is_active", () => {
    expect(
      readLifecycleFromRow({ lifecycle_status: "testing", is_active: false }),
    ).toBe("testing");
    expect(readLifecycleFromRow({ is_active: true })).toBe("published");
    expect(readLifecycleFromRow({ is_active: false })).toBe("draft");
  });
});
