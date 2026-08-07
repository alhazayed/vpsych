import { describe, expect, it } from "vitest";
import { evaluatePhase15Authorization } from "@/lib/ops/phase15-ga-authorization";
import { buildPilotCompletionReport } from "@/lib/ops/phase15-pilot-completion";
import {
  buildDisasterRecoveryCertification,
  buildPhase15Certifications,
  buildSecurityCertification,
} from "@/lib/ops/phase15-certification";
import { buildPhase15Readiness } from "@/lib/ops/phase15-readiness";
import type { PilotInstitutionExtended } from "@/lib/ops/phase15-pilot-completion";

describe("Phase 15 GA authorization", () => {
  it("defaults to CIDP GO and GA NO-GO with open gates", () => {
    const decision = evaluatePhase15Authorization();
    expect(decision.cidp_status).toBe("GO");
    expect(decision.ga_status).toBe("NO-GO");
    expect(decision.authorized_version).toBeNull();
    expect(decision.board_gates).toHaveLength(11);
    expect(decision.fail_or_open_count).toBeGreaterThan(0);
    expect(decision.decision).toMatch(/NO-GO/);
  });

  it("authorizes GA only when every board gate PASS", () => {
    const overrides = Object.fromEntries(
      evaluatePhase15Authorization().board_gates.map((g) => [g.id, "PASS"]),
    ) as Parameters<typeof evaluatePhase15Authorization>[0] extends {
      overrides?: infer O;
    }
      ? O
      : never;

    const decision = evaluatePhase15Authorization({
      phase14_gates: {
        open_critical_feedback: 0,
        open_critical_risks: 0,
        dr_drill_rows: 1,
        pitr_rows: 1,
      },
      pilot_objectives_met: true,
      clinical_validation_successful: true,
      educational_validation_successful: true,
      research_package_complete: true,
      executive_board_approved: true,
      overrides,
    });
    expect(decision.ga_status).toBe("GO");
    expect(decision.authorized_version).toBe("1.0.0");
    expect(decision.pass_count).toBe(11);
  });
});

describe("Phase 15 pilot completion", () => {
  it("marks objectives unmet when portfolio empty", () => {
    const report = buildPilotCompletionReport([]);
    expect(report.objectives_met).toBe(false);
    expect(report.notes.join(" ")).toMatch(/No pilots/);
  });

  it("aggregates longitudinal pilot metrics without PHI", () => {
    const pilots: PilotInstitutionExtended[] = [
      {
        id: "p1",
        institution_name: "State Med",
        institution_type: "university",
        status: "active",
        start_date: "2026-07-01",
        residents_invited: 20,
        residents_active: 15,
        faculty_active: 5,
        simulations_completed: 80,
        support_requests: 1,
        critical_incidents: 0,
        configuration_issues: 0,
        research_participating: true,
        training_completion_rate: 0.8,
        assessments_completed: 75,
        certifications_completed: 10,
        user_satisfaction: 0.85,
        faculty_satisfaction: 0.8,
        onboarding_complete: true,
      },
    ];
    const report = buildPilotCompletionReport(pilots);
    expect(report.objectives_met).toBe(true);
    expect(report.simulations_completed).toBe(80);
    expect(JSON.stringify(report)).not.toMatch(/\bmrn\b|\bssn\b|patient name/i);
    expect(report.notes.join(" ")).toMatch(/PHI-free/);
  });
});

describe("Phase 15 certifications", () => {
  it("keeps DR OPEN when evidence log empty", () => {
    const dr = buildDisasterRecoveryCertification();
    expect(dr.overall).not.toBe("PASS");
    expect(dr.checks.find((c) => c.id === "dr_drill")?.status).toBe("OPEN");
  });

  it("passes dependency audit check in security pack", () => {
    const sec = buildSecurityCertification();
    expect(sec.checks.find((c) => c.id === "dependency_audit")?.status).toBe(
      "PASS",
    );
    expect(sec.overall).not.toBe("PASS");
  });

  it("bundles all workstreams", () => {
    const bundle = buildPhase15Certifications();
    expect(bundle.clinical.workstream).toBe("clinical");
    expect(bundle.research.approval_status).toBe("PENDING");
  });
});

describe("Phase 15 readiness package", () => {
  it("composes Board package and refuses GA with seed residuals", () => {
    const pack = buildPhase15Readiness();
    expect(pack.cert_id).toMatch(/PHASE15/);
    expect(pack.ga_status).toBe("NO-GO");
    expect(pack.authorized_version).toBeNull();
    expect(pack.ownership).toMatch(/Never writes Clinical Core/);
    expect(pack.deliverables.length).toBeGreaterThanOrEqual(10);
    expect(pack.residual_risks.length).toBeGreaterThan(0);
    expect(JSON.stringify(pack)).not.toMatch(/clinical_snapshot/);
  });
});
