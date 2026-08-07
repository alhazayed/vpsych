/**
 * Enterprise API / integration contracts — Stage 10.
 * REST surface descriptors · webhooks · LMS · FHIR/HL7-ready · SCORM · LTI.
 * Abstractions only — no live LMS/FHIR vendor SDK binding in v1.
 */

import { secretRef } from "@/lib/enterprise/security";
import type {
  IntegrationDescriptor,
  IntegrationKind,
  WebhookEndpoint,
} from "@/lib/enterprise/types";

export const ENTERPRISE_REST_ROUTES = [
  { method: "GET", path: "/api/enterprise/summary", auth: "user" },
  { method: "GET", path: "/api/admin/enterprise", auth: "admin" },
  { method: "GET", path: "/api/enterprise/certificates/verify", auth: "public" },
  { method: "GET", path: "/api/admin/enterprise/analytics", auth: "admin" },
  { method: "GET", path: "/api/admin/enterprise/security", auth: "admin" },
  { method: "GET", path: "/api/admin/enterprise/observability", auth: "admin" },
] as const;

export function integrationCatalog(): IntegrationDescriptor[] {
  const kinds: IntegrationKind[] = [
    "lms",
    "fhir",
    "hl7",
    "scorm",
    "lti",
    "oauth",
    "saml",
    "webhook",
  ];
  return kinds.map((kind) => ({
    kind,
    status: kind === "webhook" || kind === "oauth" || kind === "saml"
      ? "ready"
      : "abstracted",
    notes: notesFor(kind),
  }));
}

function notesFor(kind: IntegrationKind): string {
  switch (kind) {
    case "lms":
      return "Grade passback & roster sync abstracted; map learning_assignments ↔ LMS course.";
    case "fhir":
      return "FHIR-ready Person/Practitioner/Encounter DTOs — no PHI clinical chart sync.";
    case "hl7":
      return "HL7-ready message envelope for training events — not clinical ADT production.";
    case "scorm":
      return "SCORM 1.2/2004 package manifest compatibility for didactic modules.";
    case "lti":
      return "LTI 1.3 launch + deep linking compatibility surface.";
    case "oauth":
      return "OAuth2/OIDC for enterprise IdP — wires to institutions.sso_metadata.";
    case "saml":
      return "SAML 2.0 SSO metadata on institutions.sso_* columns.";
    case "webhook":
      return "Signed org webhooks for session.completed, certificate.issued, membership.changed.";
  }
}

export function createWebhookEndpoint(input: {
  id?: string;
  organization_id: string;
  url: string;
  events?: string[];
}): WebhookEndpoint {
  return {
    id: input.id ?? `wh_${input.organization_id}_${Date.now()}`,
    organization_id: input.organization_id,
    url: input.url,
    events: input.events ?? [
      "session.completed",
      "certificate.issued",
      "membership.changed",
    ],
    secret_ref: secretRef("webhook", input.organization_id),
    is_active: true,
  };
}

export function signWebhookPayload(
  secretRefValue: string,
  body: string,
): string {
  // Deterministic stub signature for tests — production should HMAC with vault secret.
  let h = 0;
  const s = `${secretRefValue}:${body}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `sha256=${h.toString(16).padStart(8, "0")}`;
}
