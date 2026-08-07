import { describe, expect, it } from "vitest";
import {
  defaultPriorityForSeverity,
  summarizeFeedback,
  validateFeedbackAdminPatch,
  validateFeedbackInput,
} from "@/lib/enterprise/feedback";

describe("institutional feedback (CIDP)", () => {
  it("validates a complete faculty submission", () => {
    const result = validateFeedbackInput({
      submitter_role: "faculty",
      institution_name: "State Medical School",
      department: "Psychiatry",
      category: "curriculum",
      severity: "high",
      reproducibility: "often",
      title: "Preset picker unclear for PGY-2 rotation",
      body: "Faculty cannot find the residency preset when starting a cohort session from the avatars page.",
      suggested_action: "Surface instructor presets on the session start flow.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.role_persona).toBe("faculty");
      expect(result.value.priority).toBe("p1");
      expect(result.value.status).toBe("submitted");
      expect(result.value.platform_version).toMatch(/1\.0\.0-rc/);
    }
  });

  it("rejects possible PHI hints", () => {
    const result = validateFeedbackInput({
      submitter_role: "resident",
      institution_name: "Hospital A",
      category: "clinical_simulation",
      severity: "medium",
      title: "Odd reply",
      body: "The real patient name is Jane Doe and MRN 12345 appeared somehow.",
    });
    expect(result.ok).toBe(false);
  });

  it("maps severity to default priority", () => {
    expect(defaultPriorityForSeverity("critical")).toBe("p0");
    expect(defaultPriorityForSeverity("wishlist")).toBe("p3");
  });

  it("validates admin patches", () => {
    const ok = validateFeedbackAdminPatch({ status: "triaged", priority: "p0" });
    expect(ok.ok).toBe(true);
    const bad = validateFeedbackAdminPatch({ status: "nope" });
    expect(bad.ok).toBe(false);
  });

  it("summarizes open criticals", () => {
    const summary = summarizeFeedback([
      { severity: "critical", status: "submitted", role_persona: "it" },
      { severity: "critical", status: "resolved", role_persona: "faculty" },
      { severity: "low", status: "submitted", role_persona: "resident" },
    ]);
    expect(summary.total).toBe(3);
    expect(summary.open_critical).toBe(1);
    expect(summary.by_role.resident).toBe(1);
  });
});
