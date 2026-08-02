import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

    const supabase = await createClient();
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
