import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TRACES_SAMPLE_RATE,
  scrubBreadcrumb,
  scrubEvent,
  scrubSpan,
  sentryBaseOptions,
} from "@/lib/ops/sentry-options";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sentryBaseOptions", () => {
  it("is disabled without a DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const opts = sentryBaseOptions();
    expect(opts.enabled).toBe(false);
    expect(opts.dsn).toBeUndefined();
  });

  it("enables with a DSN, never sends PII, samples 10% of traces", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o1.ingest.de.sentry.io/2");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "");
    const opts = sentryBaseOptions();
    expect(opts.enabled).toBe(true);
    expect(opts.sendDefaultPii).toBe(false);
    expect(opts.tracesSampleRate).toBe(DEFAULT_TRACES_SAMPLE_RATE);
  });

  it("ignores an out-of-range sample rate override", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "5");
    expect(sentryBaseOptions().tracesSampleRate).toBe(DEFAULT_TRACES_SAMPLE_RATE);
  });
});

describe("scrubbers keep clinical content out of Sentry", () => {
  it("drops request bodies, headers, cookies, query strings, user and console crumbs", () => {
    const event = scrubEvent({
      request: {
        data: { message: "I have been thinking about ending it" },
        headers: { cookie: "sb=1" },
        cookies: { sb: "1" },
        query_string: "x=1",
        url: "https://vpsych.vercel.app/api/sessions/1/message",
      },
      user: { email: "t@example.com" },
      breadcrumbs: [
        { category: "console", message: "textPreview: patient said ..." },
        { category: "navigation" },
      ],
    });
    expect(JSON.stringify(event)).not.toContain("ending it");
    expect(event.request).toEqual({
      url: "https://vpsych.vercel.app/api/sessions/1/message",
    });
    expect(event).not.toHaveProperty("user");
    expect(event.breadcrumbs).toEqual([{ category: "navigation" }]);
  });

  it("drops console breadcrumbs and fetch bodies", () => {
    expect(scrubBreadcrumb({ category: "console" })).toBeNull();
    expect(
      scrubBreadcrumb({
        category: "fetch",
        data: { url: "/api/x", body: "transcript", status_code: 200 },
      }),
    ).toEqual({ category: "fetch", data: { url: "/api/x", status_code: 200 } });
  });

  it("removes AI prompt and response attributes from spans", () => {
    const span = scrubSpan({
      attributes: {
        "gen_ai.request.messages": "[...]",
        "gen_ai.response.text": "reply",
        "ai.prompt": "system prompt",
        "http.status_code": 200,
      },
    });
    expect(span.attributes).toEqual({ "http.status_code": 200 });
  });
});
