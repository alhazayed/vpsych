import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("enterprise compliance surfaces", () => {
  const legalPages = [
    "src/app/legal/privacy/page.tsx",
    "src/app/legal/terms/page.tsx",
    "src/app/legal/cookies/page.tsx",
    "src/app/legal/ai-disclosure/page.tsx",
    "src/app/legal/clinical-disclaimer/page.tsx",
    "src/app/legal/educational-disclaimer/page.tsx",
  ];

  it("ships required legal pages", () => {
    for (const p of legalPages) {
      expect(existsSync(join(root, p)), p).toBe(true);
    }
  });

  it("exposes DSAR export and delete APIs", () => {
    expect(existsSync(join(root, "src/app/api/account/export/route.ts"))).toBe(
      true,
    );
    expect(existsSync(join(root, "src/app/api/account/delete/route.ts"))).toBe(
      true,
    );
    expect(existsSync(join(root, "src/app/api/account/consent/route.ts"))).toBe(
      true,
    );
  });

  it("allows /legal as a public middleware path", () => {
    const mw = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/path\.startsWith\("\/legal"\)/);
  });

  it("persists signup consent metadata flags", () => {
    const signup = readFileSync(join(root, "src/app/signup/page.tsx"), "utf8");
    expect(signup).toMatch(/terms_accepted:\s*true/);
    expect(signup).toMatch(/ai_processing_accepted:\s*true/);
    expect(signup).toMatch(/LEGAL_PATHS/);
  });

  it("includes consent/retention migration", () => {
    expect(
      existsSync(
        join(
          root,
          "supabase/migrations/20260803210000_enterprise_compliance_consent_retention.sql",
        ),
      ),
    ).toBe(true);
  });
});
