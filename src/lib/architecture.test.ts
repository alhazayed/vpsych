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

  it("exposes a public liveness probe and JSON 401 for unauth APIs", () => {
    const health = readFileSync(join(root, "app/api/health/route.ts"), "utf8");
    expect(health).toMatch(/service:\s*["']vpsych["']/);

    const mw = readFileSync(join(root, "lib/supabase/middleware.ts"), "utf8");
    expect(mw).toMatch(/\/api\/health/);
    expect(mw).toMatch(/Unauthorized/);
    expect(mw).toMatch(/status:\s*401/);
  });

  it("gates expensive AI/voice work with concurrency limits", () => {
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    expect(message).toMatch(/aiChatGate/);
    const tts = readFileSync(join(root, "app/api/voice/tts/route.ts"), "utf8");
    expect(tts).toMatch(/ttsGate/);
  });

  it("does not return raw AI failure detail from session end", () => {
    const route = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    expect(route).not.toMatch(/aiFailureDetail:/);
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
