import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

describe("architecture invariants", () => {
  it("does not re-export ACE bridge from the CGE barrel (breaks ACE↔CGE cycle)", () => {
    const barrel = readFileSync(join(root, "lib/cge/index.ts"), "utf8");
    expect(barrel).not.toMatch(/export \* from ["']\.\/ace-bridge["']/);
  });

  it("requires admin auth on the OpenAI health probe", () => {
    const route = readFileSync(
      join(root, "app/api/health/openai/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/requireApiAdmin/);
    expect(route).toMatch(/OpenAI health probe failed|not configured/);
  });

  it("does not return raw AI failure detail from session end", () => {
    const route = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    expect(route).not.toMatch(/aiFailureDetail:/);
  });

  it("session start/message RPCs fall back when service role is unset", () => {
    const start = readFileSync(join(root, "app/api/sessions/route.ts"), "utf8");
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    expect(start).toMatch(/messageRpcClient/);
    expect(message).toMatch(/messageRpcClient/);
    expect(start).not.toMatch(/error: "Server misconfigured"/);
    expect(message).not.toMatch(/error: "Server misconfigured"/);
  });

  it("provides App Router error boundaries", () => {
    expect(() =>
      readFileSync(join(root, "app/error.tsx"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(root, "app/(app)/error.tsx"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(root, "app/global-error.tsx"), "utf8"),
    ).not.toThrow();
  });

  it("exposes a public liveness probe at /api/health", () => {
    const route = readFileSync(join(root, "app/api/health/route.ts"), "utf8");
    expect(route).toMatch(/ok:\s*true/);
    expect(route).toMatch(/service:\s*"vpsych"/);
  });

  it("middleware returns JSON 401 for unauthenticated APIs and keeps SEO/legal public", () => {
    const mw = readFileSync(join(root, "lib/supabase/middleware.ts"), "utf8");
    expect(mw).toMatch(/Unauthorized/);
    expect(mw).toMatch(/status:\s*401/);
    expect(mw).toMatch(/\/api\/health/);
    expect(mw).toMatch(/\/robots\.txt/);
    expect(mw).toMatch(/\/privacy/);
    expect(mw).toMatch(/\/terms/);
    expect(mw).toMatch(/secure:\s*process\.env\.NODE_ENV === "production"/);
  });

  it("surfaces clinical/educational/AI disclaimers on the privacy page", () => {
    const privacy = readFileSync(join(root, "app/privacy/page.tsx"), "utf8");
    expect(privacy).toMatch(/clinical\.title/);
    expect(privacy).toMatch(/educational\.title/);
    expect(privacy).toMatch(/ai\.title/);
  });

  it("rate-limits admin CGE and ACE learner mutates", () => {
    const cge = readFileSync(join(root, "app/api/admin/cge/route.ts"), "utf8");
    const ace = readFileSync(
      join(root, "app/api/admin/ace/learners/route.ts"),
      "utf8",
    );
    expect(cge).toMatch(/rateLimit/);
    expect(ace).toMatch(/rateLimit/);
  });
});
