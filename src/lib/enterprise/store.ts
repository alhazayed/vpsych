/**
 * In-memory enterprise store (process-local) — mirrors Stage 8/9 store pattern.
 * Durable rows live in Postgres (institutions*, enterprise_*). This store holds
 * ephemeral analytics/cert registries for API façades and tests.
 */

import type {
  DigitalCertificate,
  EnterpriseAuditEvent,
  EnterpriseBundle,
  ResearchStudy,
  WebhookEndpoint,
} from "@/lib/enterprise/types";

const bundlesByOrg = new Map<string, EnterpriseBundle[]>();
const certsByOrg = new Map<string, DigitalCertificate[]>();
const audits: EnterpriseAuditEvent[] = [];
const studies = new Map<string, ResearchStudy>();
const webhooksByOrg = new Map<string, WebhookEndpoint[]>();

export function storeEnterpriseBundle(
  organizationId: string,
  bundle: EnterpriseBundle,
): void {
  const list = bundlesByOrg.get(organizationId) ?? [];
  list.push(bundle);
  // Cap history per org to bound memory under load tests.
  if (list.length > 500) list.splice(0, list.length - 500);
  bundlesByOrg.set(organizationId, list);
}

export function listEnterpriseBundles(
  organizationId: string,
): EnterpriseBundle[] {
  return [...(bundlesByOrg.get(organizationId) ?? [])];
}

export function storeCertificate(cert: DigitalCertificate): void {
  const list = certsByOrg.get(cert.organization_id) ?? [];
  list.push(cert);
  certsByOrg.set(cert.organization_id, list);
}

export function listCertificates(organizationId: string): DigitalCertificate[] {
  return [...(certsByOrg.get(organizationId) ?? [])];
}

export function listAllCertificates(): DigitalCertificate[] {
  const out: DigitalCertificate[] = [];
  for (const list of certsByOrg.values()) out.push(...list);
  return out;
}

export function pushAudit(event: EnterpriseAuditEvent): void {
  audits.push(event);
  if (audits.length > 5000) audits.splice(0, audits.length - 5000);
}

export function listAudits(organizationId?: string): EnterpriseAuditEvent[] {
  if (!organizationId) return [...audits];
  return audits.filter((a) => a.organization_id === organizationId);
}

export function storeStudy(study: ResearchStudy): void {
  studies.set(study.id, study);
}

export function getStudy(id: string): ResearchStudy | null {
  return studies.get(id) ?? null;
}

export function storeWebhook(wh: WebhookEndpoint): void {
  const list = webhooksByOrg.get(wh.organization_id) ?? [];
  list.push(wh);
  webhooksByOrg.set(wh.organization_id, list);
}

export function listWebhooks(organizationId: string): WebhookEndpoint[] {
  return [...(webhooksByOrg.get(organizationId) ?? [])];
}

export function clearEnterpriseStoreForTests(): void {
  bundlesByOrg.clear();
  certsByOrg.clear();
  audits.length = 0;
  studies.clear();
  webhooksByOrg.clear();
}
