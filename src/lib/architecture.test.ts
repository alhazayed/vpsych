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

  it("keeps /validation and invite redeem public for invited experts", () => {
    const mw = readFileSync(join(root, "lib/supabase/middleware.ts"), "utf8");
    expect(mw).toMatch(/path === "\/validation"/);
    expect(mw).toMatch(/path === "\/api\/validation\/invite"/);
    const page = readFileSync(join(root, "app/validation/page.tsx"), "utf8");
    expect(page).toMatch(/ValidationPortal/);
    const invite = readFileSync(
      join(root, "app/api/validation/invite/route.ts"),
      "utf8",
    );
    expect(invite).toMatch(/rateLimit/);
    expect(invite).toMatch(/isValidInviteCode/);
  });

  it("exposes Wave 3 Quality Ledger and research export admin routes", () => {
    const ledger = readFileSync(
      join(root, "app/api/admin/quality-ledger/route.ts"),
      "utf8",
    );
    const research = readFileSync(
      join(root, "app/api/admin/research/export/route.ts"),
      "utf8",
    );
    expect(ledger).toMatch(/requireApiAdmin/);
    expect(research).toMatch(/requireApiAdmin/);
    expect(research).toMatch(/admin\.research\.export/);
  });

  it("preset preview resolves DB rows by presetSlug (W3-H1)", () => {
    const route = readFileSync(
      join(root, "app/api/admin/presets/preview/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/body\.presetSlug/);
    expect(route).toMatch(/\.eq\("slug", body\.presetSlug\)/);
  });
});
