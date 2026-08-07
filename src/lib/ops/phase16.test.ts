import { describe, expect, it } from "vitest";
import {
  EVIDENCE_PENDING,
  displayEvidence,
  pending,
  observed,
} from "@/lib/ops/phase16-evidence-state";
import { buildInstitutionPilotDashboard } from "@/lib/ops/phase16-institutions";
import { buildPhase16Dashboards } from "@/lib/ops/phase16-dashboards";
import { evaluatePhase16GaGates } from "@/lib/ops/phase16-ga-gates";
import { buildPhase16Execution } from "@/lib/ops/phase16-execution";

describe("Phase 16 evidence state", () => {
  it("displays Evidence Pending for missing values", () => {
    expect(displayEvidence(pending("x"))).toBe(EVIDENCE_PENDING);
    expect(displayEvidence(observed("y", 3))).toBe("3");
  });
});

describe("Phase 16 institution registry", () => {
  it("reports Evidence Pending when no pilots registered", () => {
    const dash = buildInstitutionPilotDashboard([]);
    expect(dash.registry_state).toBe("EVIDENCE_PENDING");
    expect(dash.institutions_registered.state).toBe("EVIDENCE_PENDING");
    expect(dash.profiles).toHaveLength(0);
    expect(dash.notes.join(" ")).toMatch(/do not fabricate/i);
  });

  it("aggregates only supplied observed profiles", () => {
    const dash = buildInstitutionPilotDashboard([
      {
        id: "i1",
        institution_name: "Example Med",
        institution_type: "medical_school",
        deployment_date: "2026-08-01",
        software_version: "1.0.0-rc.1",
        faculty_users: 4,
        resident_users: 12,
        active_learners: 10,
        simulations_started: 20,
        simulations_completed: 15,
        assessments_completed: 14,
        supervisor_reviews: 8,
        certifications_issued: 2,
      },
    ]);
    expect(dash.registry_state).toBe("OBSERVED");
    expect(dash.institutions_registered.value).toBe(1);
    expect(dash.aggregates.find((a) => a.label === "Faculty users")?.value).toBe(
      4,
    );
  });
});

describe("Phase 16 dashboards", () => {
  it("marks clinical survey metrics pending when unset", () => {
    const bundle = buildPhase16Dashboards({
      sessions_completed: 10,
      institutions_count: 2,
    });
    const clinical = bundle.dashboards.find((d) => d.id === "clinical")!;
    const realism = clinical.metrics.find((m) => m.label === "Clinical realism");
    expect(realism?.state).toBe("EVIDENCE_PENDING");
    expect(displayEvidence(realism!)).toBe(EVIDENCE_PENDING);
    const completed = clinical.metrics.find((m) =>
      m.label.includes("Simulations completed"),
    );
    expect(completed?.state).toBe("OBSERVED");
    expect(completed?.value).toBe(10);
    expect(bundle.fabrication_policy).toMatch(/Never fabricate/);
  });
});

describe("Phase 16 GA gates", () => {
  it("defaults to CIDP GO and GA NO-GO with Evidence Pending gates", () => {
    const eval_ = evaluatePhase16GaGates();
    expect(eval_.cidp_status).toBe("GO");
    expect(eval_.ga_status).toBe("NO-GO");
    expect(eval_.authorized_version).toBeNull();
    expect(eval_.release_package).toBeNull();
    expect(eval_.unmet.length).toBeGreaterThan(0);
    expect(
      eval_.gates.find((g) => g.id === "dr_drill_completed")?.detail,
    ).toBe(EVIDENCE_PENDING);
    expect(
      eval_.gates.find((g) => g.id === "penetration_test_completed")?.status,
    ).toBe("EVIDENCE_PENDING");
    expect(
      eval_.gates.find((g) => g.id === "critical_issues_zero")?.status,
    ).toBe("EVIDENCE_PENDING");
  });

  it("reaches GO only when every gate is explicitly PASS", () => {
    const eval_ = evaluatePhase16GaGates({
      dr_drill_rows: 1,
      pitr_rows: 1,
      pen_test_rows: 1,
      security_residuals_closed: true,
      pilot_objectives_achieved: true,
      open_critical_feedback: 0,
      open_critical_risks: 0,
      clinical_validation_complete: true,
      educational_validation_complete: true,
      research_validation_complete: true,
      release_board_approval_signed: true,
    });
    expect(eval_.ga_status).toBe("GO");
    expect(eval_.authorized_version).toBe("1.0.0");
    expect(eval_.release_package?.tag).toBe("v1.0.0");
  });
});

describe("Phase 16 execution package", () => {
  it("never invents pilots and keeps GA NO-GO", () => {
    const pack = buildPhase16Execution({
      dashboard: {
        sessions_completed: 5,
        npm_audit_high_vulns: 0,
      },
    });
    expect(pack.institutions.registry_state).toBe("EVIDENCE_PENDING");
    expect(pack.ga_status).toBe("NO-GO");
    expect(pack.weekly_report.markdown).toMatch(/Evidence Pending/);
    expect(pack.monthly_report.ga_status).toBe("NO-GO");
    expect(pack.ownership).toMatch(/Never writes Clinical Core/);
    expect(JSON.stringify(pack)).not.toMatch(/clinical_snapshot/);
    // Must not fabricate satisfaction-like fields
    expect(JSON.stringify(pack.institutions.profiles)).toBe("[]");
  });
});
