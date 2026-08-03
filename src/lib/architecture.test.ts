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

  it("session start/message RPCs fail closed without service role", () => {
    const start = readFileSync(join(root, "app/api/sessions/route.ts"), "utf8");
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    const admin = readFileSync(join(root, "lib/supabase/admin.ts"), "utf8");
    expect(start).toMatch(/messageRpcClient/);
    expect(message).toMatch(/messageRpcClient/);
    expect(start).toMatch(/error: "Server misconfigured"/);
    expect(message).toMatch(/error: "Server misconfigured"/);
    // No authenticated fallback — transcript forge path closed
    expect(admin).not.toMatch(/createServiceClient\(\) \?\? userClient/);
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
