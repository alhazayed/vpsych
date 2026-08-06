import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export type SecurityAuditOutcome = "success" | "failure" | "denied";

export type SecurityAuditEvent = {
  action: string;
  outcome: SecurityAuditOutcome;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  /** Optional Request for Route Handlers (IP / UA). */
  request?: Request;
};

function clientIpFromHeaders(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  return h.get("x-real-ip");
}

/**
 * Best-effort security audit write. Never throws to callers — audit must not
 * break the primary request path.
 *
 * Prefers the service-role client so denied-path logging still works for
 * non-admin therapists after CQG-002 (RPC requires admin or service_role).
 */
export async function logSecurityEvent(
  event: SecurityAuditEvent,
): Promise<string | null> {
  try {
    let ip: string | null = null;
    let userAgent: string | null = null;

    if (event.request) {
      ip = clientIpFromHeaders(event.request.headers);
      userAgent = event.request.headers.get("user-agent");
    } else {
      try {
        const h = await headers();
        ip = clientIpFromHeaders(h);
        userAgent = h.get("user-agent");
      } catch {
        /* headers() unavailable outside a request scope */
      }
    }

    // Prefer service role so non-admin denied events still persist (CQG-002).
    // Fall back to the user client for admins when service role is unset.
    const supabase = createServiceClient() ?? (await createClient());
    const { data, error } = await supabase.rpc("log_security_event", {
      p_action: event.action,
      p_outcome: event.outcome,
      p_resource_type: event.resourceType ?? null,
      p_resource_id: event.resourceId ?? null,
      p_ip: ip,
      p_user_agent: userAgent,
      p_metadata: event.metadata ?? {},
    });

    if (error) {
      console.warn("[security-audit] write failed:", error.message);
      return null;
    }
    return typeof data === "string" ? data : null;
  } catch (err) {
    console.warn(
      "[security-audit] write failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
