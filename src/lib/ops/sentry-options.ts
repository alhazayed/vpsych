/**
 * Shared Sentry options for the browser, Node and edge runtimes.
 *
 * Privacy: VPsych transcripts are simulated clinical content and must never
 * leave the platform as telemetry. So:
 * - `sendDefaultPii: false` (no IPs, cookies, user emails; AI integrations
 *   don't record prompts or replies);
 * - request bodies, headers, cookies and query strings are dropped from events;
 * - console breadcrumbs are dropped (several server logs carry model output
 *   previews);
 * - `gen_ai.*` / `ai.*` span attributes are removed in case an AI
 *   integration records inputs anyway.
 *
 * Sentry is off unless `NEXT_PUBLIC_SENTRY_DSN` is set.
 */

type Scrubbable = {
  request?: {
    data?: unknown;
    cookies?: unknown;
    headers?: unknown;
    query_string?: unknown;
  };
  user?: unknown;
  breadcrumbs?: Array<{ category?: string }>;
};

type SpanLike = { attributes?: Record<string, unknown> };

/** Default share of requests traced for performance (errors are always sent). */
export const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

const AI_ATTRIBUTE = /^(gen_ai|ai|llm)\./;

export function sentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
}

export function tracesSampleRate(): number {
  const text = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE?.trim();
  const raw = text ? Number(text) : Number.NaN;
  return Number.isFinite(raw) && raw >= 0 && raw <= 1
    ? raw
    : DEFAULT_TRACES_SAMPLE_RATE;
}

export function scrubEvent<E extends Scrubbable>(event: E): E {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
  }
  delete event.user;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.filter((b) => b.category !== "console");
  }
  return event;
}

export function scrubBreadcrumb<B extends { category?: string; data?: Record<string, unknown> }>(
  breadcrumb: B,
): B | null {
  if (breadcrumb.category === "console") return null;
  if (breadcrumb.data) {
    delete breadcrumb.data.body;
    delete breadcrumb.data.request_body;
    delete breadcrumb.data.response_body;
  }
  return breadcrumb;
}

export function scrubSpan<S extends SpanLike>(span: S): S {
  if (span.attributes) {
    for (const key of Object.keys(span.attributes)) {
      if (AI_ATTRIBUTE.test(key)) delete span.attributes[key];
    }
  }
  return span;
}

export function sentryBaseOptions() {
  const dsn = sentryDsn();
  return {
    dsn,
    enabled: Boolean(dsn),
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: tracesSampleRate(),
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSendSpan: scrubSpan,
  };
}
