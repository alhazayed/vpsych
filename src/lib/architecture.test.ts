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
    expect(route).toMatch(/sanitizeDbError/);
    expect(route).not.toMatch(
      /return NextResponse\.json\(\{\s*error:\s*(updateError|hasErr)\.message/,
    );
  });

  it("persists ACE scoring via service-role apply_ace_session_progress", () => {
    const persist = readFileSync(join(root, "lib/ace/persist.ts"), "utf8");
    expect(persist).toMatch(/createServiceClient/);
    expect(persist).toMatch(/apply_ace_session_progress/);
    expect(persist).not.toMatch(
      /\.from\(["']learner_profiles["']\)\s*\.update\(/,
    );
  });

  it("dedupes persisted therapist turns and expands mini failover in patient-agent", () => {
    const agent = readFileSync(join(root, "lib/ai/patient-agent.ts"), "utf8");
    expect(agent).toMatch(/withoutCurrent/);
    expect(agent).toMatch(/shouldTryOpenAiMiniFailover/);
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
});
