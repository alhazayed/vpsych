/**
 * Operational readiness checklist for enterprise deployment.
 */

export type OpsControl = {
  id: string;
  title: string;
  status: "implemented" | "partial" | "missing";
  evidence: string;
};

export type OperationalReadiness = {
  controls: OpsControl[];
  score: number;
  deployment_ready: boolean;
};

export function assessOperationalReadiness(input: {
  publicHealthEndpoint: boolean;
  ciPipeline: boolean;
  migrationParity: boolean;
  vercelDeploy: boolean;
  backupDocumented: boolean;
  monitoringDocumented: boolean;
  drRunbook: boolean;
  supportRunbook: boolean;
}): OperationalReadiness {
  const controls: OpsControl[] = [
    {
      id: "health",
      title: "Public health endpoint",
      status: input.publicHealthEndpoint ? "implemented" : "missing",
      evidence: input.publicHealthEndpoint
        ? "/api/health returns JSON status"
        : "No public /api/health",
    },
    {
      id: "ci",
      title: "CI pipeline",
      status: input.ciPipeline ? "implemented" : "missing",
      evidence: ".github/workflows/ci.yml",
    },
    {
      id: "migrations",
      title: "Migration parity checks",
      status: input.migrationParity ? "implemented" : "partial",
      evidence: "scripts/verify-migration-parity.mjs",
    },
    {
      id: "deploy",
      title: "Vercel deployment",
      status: input.vercelDeploy ? "implemented" : "partial",
      evidence: "vercel.json + Next.js app",
    },
    {
      id: "backups",
      title: "Backup posture",
      status: input.backupDocumented ? "partial" : "missing",
      evidence: input.backupDocumented
        ? "Documented reliance on Supabase PITR/backups"
        : "No backup documentation",
    },
    {
      id: "monitoring",
      title: "Monitoring / alerting",
      status: input.monitoringDocumented ? "partial" : "missing",
      evidence: "security_audit_events + platform logs",
    },
    {
      id: "dr",
      title: "Disaster recovery",
      status: input.drRunbook ? "partial" : "missing",
      evidence: input.drRunbook
        ? "DR notes in enterprise certification"
        : "No DR runbook",
    },
    {
      id: "support",
      title: "Supportability",
      status: input.supportRunbook ? "partial" : "missing",
      evidence: "Admin tooling + audit; escalation path TBD",
    },
  ];

  const weights = { implemented: 1, partial: 0.6, missing: 0 };
  const score = Math.round(
    (controls.reduce((a, c) => a + weights[c.status], 0) / controls.length) * 100,
  );

  return {
    controls,
    score,
    deployment_ready: score >= 70 && input.publicHealthEndpoint && input.ciPipeline,
  };
}
