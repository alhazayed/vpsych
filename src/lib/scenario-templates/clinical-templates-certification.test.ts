import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getBuiltinCatalog } from "@/lib/case-engine/catalog";
import {
  BUILTIN_TEMPLATES,
  findTemplateBySlug,
  listBuiltinTemplates,
} from "@/lib/scenario-templates/catalog";
import { validateTemplate } from "@/lib/scenario-templates/validation";

const root = join(process.cwd(), "src");

describe("Clinical Templates certification guards", () => {
  it("covers at least 10 enabled builtin templates across EN and AR", () => {
    const enabled = listBuiltinTemplates();
    expect(enabled.length).toBeGreaterThanOrEqual(10);
    expect(enabled.some((t) => t.language.toLowerCase().startsWith("ar"))).toBe(
      true,
    );
    expect(enabled.some((t) => t.language.toLowerCase().startsWith("en"))).toBe(
      true,
    );
  });

  it("does not bind the PTSD risk template to the MDD Maya persona", () => {
    const ptsd = findTemplateBySlug("ptsd-risk-assessment-en");
    expect(ptsd).toBeTruthy();
    expect(ptsd?.default_persona_slug).not.toBe("maya-chen");
  });

  it("aligns builtin ICD-11 codes with clinical certification fixes", () => {
    const catalog = getBuiltinCatalog();
    const bySlug = Object.fromEntries(
      catalog.disorders.map((d) => [d.slug, d]),
    );
    expect(bySlug.bpd?.icd11_code).toBe("6D10.1/6D11.5");
    expect(bySlug["bipolar-mania"]?.icd11_code).toBe("6A60.2");
    expect(bySlug.pdd?.icd11_code).toBe("6A72");
    expect(bySlug["complex-ptsd"]?.dsm5_code).toBeNull();
    expect(bySlug["complex-ptsd"]?.icd11_code).toBe("6B41");
    expect(bySlug["complex-ptsd"]?.package?.dsm5_optional).toBe(true);
  });

  it("validates every enabled builtin template", () => {
    for (const tpl of BUILTIN_TEMPLATES.filter((t) => t.enabled)) {
      const result = validateTemplate(tpl);
      expect(result.ok, `${tpl.slug}: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it("sanitizes template create/clone DB errors", () => {
    const route = readFileSync(
      join(root, "app/api/admin/templates/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/sanitizeDbError/);
    expect(route).not.toMatch(
      /return NextResponse\.json\(\{\s*error:\s*(cloneErr|createErr)\.message/,
    );
  });

  it("falls back to builtin objectives when DB child rows are empty", () => {
    const preview = readFileSync(
      join(root, "app/api/admin/templates/preview/route.ts"),
      "utf8",
    );
    expect(preview).toMatch(/dbObjectives\.length > 0/);
    expect(preview).toMatch(/builtin\?\.learning_objectives/);
    expect(preview).toMatch(/default_persona_slug: builtin\?\.default_persona_slug/);
  });
});
