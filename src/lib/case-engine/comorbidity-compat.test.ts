import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUILTIN_COMORBIDITY_RULES,
  BUILTIN_DISORDERS,
  DISORDER_IDS,
  findDisorderBySlug,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import {
  auditComorbidityCompatibilityMatrix,
  COMORBIDITY_RULE_SOURCE,
  getComorbidityCompatibility,
  listCompatibleComorbiditySlugs,
} from "@/lib/case-engine/comorbidity-compat";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import { validateCaseGeneration } from "@/lib/case-engine/validation";
import type { PersonaRow } from "@/lib/case-engine/types";

const jordanPersona: PersonaRow = {
  id: "persona-jordan",
  avatar_id: "avatar-jordan",
  slug: "jordan-hale",
  display_name: "Jordan Hale",
  identity: { age: 34, gender: "male" },
  traits: {},
  baseline_history: {},
  default_disorder_id: DISORDER_IDS.gad,
  is_active: true,
};

/**
 * Authored comorbidity pairs present in migration
 * `20260802181535_clinical_scenario_templates.sql` that involve disorders also
 * present in `BUILTIN_DISORDERS`. Documented for drift audit — not invented.
 */
const MIGRATION_AUTHORED_PAIRS_IN_BUILTIN_SCOPE: Array<{
  primary: string;
  comorbid: string;
  compatible: boolean;
}> = [
  { primary: "complex-ptsd", comorbid: "mdd-recurrent-moderate", compatible: true },
  { primary: "complex-ptsd", comorbid: "alcohol-use-disorder", compatible: true },
  { primary: "bipolar-mania", comorbid: "mdd-recurrent-moderate", compatible: false },
  { primary: "ptsd", comorbid: "bpd", compatible: true },
  { primary: "bpd", comorbid: "ptsd", compatible: true },
  { primary: "bpd", comorbid: "alcohol-use-disorder", compatible: true },
  { primary: "schizophrenia", comorbid: "mdd-recurrent-moderate", compatible: true },
  { primary: "adult-adhd", comorbid: "mdd-recurrent-moderate", compatible: true },
];

describe("comorbidity compatibility helpers", () => {
  it("authoritative source is BUILTIN_COMORBIDITY_RULES in catalog.ts", () => {
    expect(COMORBIDITY_RULE_SOURCE.module).toBe("src/lib/case-engine/catalog.ts");
    expect(COMORBIDITY_RULE_SOURCE.exportName).toBe("BUILTIN_COMORBIDITY_RULES");
    expect(COMORBIDITY_RULE_SOURCE.ruleCount).toBe(BUILTIN_COMORBIDITY_RULES.length);
    expect(COMORBIDITY_RULE_SOURCE.disorderCount).toBe(BUILTIN_DISORDERS.length);
  });

  it("bipolar-mania + complex-ptsd is unlisted (NEEDS AUTHORING)", () => {
    const result = getComorbidityCompatibility("bipolar-mania", "complex-ptsd");
    expect(result.status).toBe("unlisted");
    expect(result.previewAllowed).toBe(false);
    expect(result.code).toBe("comorbidity_unlisted");
    expect(result.rule).toBeNull();
    expect(listCompatibleComorbiditySlugs("bipolar-mania")).not.toContain(
      "complex-ptsd",
    );
  });

  it("accepts a supported authored comorbidity (MDD + GAD)", () => {
    const result = getComorbidityCompatibility(
      "mdd-recurrent-moderate",
      "gad-with-panic",
    );
    expect(result.code).toBe("ok");
    expect(result.previewAllowed).toBe(true);
    expect(result.status).toBe("compatible");
    expect(listCompatibleComorbiditySlugs("mdd-recurrent-moderate")).toContain(
      "gad-with-panic",
    );
  });

  it("rejects an authored incompatible pair (ADHD + PTSD)", () => {
    const result = getComorbidityCompatibility("adult-adhd", "ptsd");
    expect(result.code).toBe("comorbidity_incompatible");
    expect(result.previewAllowed).toBe(false);
    expect(result.status).toBe("impossible");
    expect(listCompatibleComorbiditySlugs("adult-adhd")).not.toContain("ptsd");
  });

  it("rejects a nonexistent comorbidity slug", () => {
    const result = getComorbidityCompatibility(
      "bipolar-mania",
      "not-a-real-disorder",
    );
    expect(result.code).toBe("unknown_disorder");
    expect(result.previewAllowed).toBe(false);
    expect(result.status).toBe("unknown_disorder");
  });

  it("allows primary-only (no comorbidity)", () => {
    const result = getComorbidityCompatibility("bipolar-mania", null);
    expect(result.code).toBe("ok");
    expect(result.previewAllowed).toBe(true);
  });

  it("rejects comorbidity that duplicates primary", () => {
    const result = getComorbidityCompatibility("bipolar-mania", "bipolar-mania");
    expect(result.code).toBe("comorbidity_duplicate_primary");
    expect(result.previewAllowed).toBe(false);
  });
});

describe("Case Engine validation — preview generator path", () => {
  it("rejects bipolar-mania + complex-ptsd with comorbidity_unlisted", () => {
    const catalog = getBuiltinCatalog();
    const primary = findDisorderBySlug("bipolar-mania", catalog)!;
    const comorbid = findDisorderBySlug("complex-ptsd", catalog)!;
    const result = validateCaseGeneration(
      {
        persona: jordanPersona,
        avatarId: "avatar-jordan",
        primaryDisorder: primary,
        comorbidities: [comorbid],
        difficulty: "advanced",
        therapyModality: "family_therapy",
        locale: "ar-JO",
      },
      catalog,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "comorbidity_unlisted")).toBe(
        true,
      );
      expect(
        result.issues.some((i) =>
          i.message.includes("bipolar-mania + complex-ptsd"),
        ),
      ).toBe(true);
    }
  });

  it("generates a supported comorbidity preview (MDD + GAD)", () => {
    const catalog = getBuiltinCatalog();
    const result = generateCaseInstance({
      persona: jordanPersona,
      avatarId: "avatar-jordan",
      primaryDisorder: findDisorderBySlug("mdd-recurrent-moderate", catalog)!,
      comorbidities: [findDisorderBySlug("gad-with-panic", catalog)!],
      difficulty: "intermediate",
      therapyModality: "supportive",
      locale: "en-US",
      seed: "compat-mdd-gad",
    });
    expect(result.ok).toBe(true);
  });

  it("generates bipolar-mania with no comorbidity", () => {
    const catalog = getBuiltinCatalog();
    const result = generateCaseInstance({
      persona: jordanPersona,
      avatarId: "avatar-jordan",
      primaryDisorder: findDisorderBySlug("bipolar-mania", catalog)!,
      comorbidities: [],
      difficulty: "advanced",
      therapyModality: "family_therapy",
      locale: "ar-JO",
      seed: "compat-bipolar-solo",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects nonexistent comorbidity at validation when disorder missing", () => {
    // Unknown slugs never become DisorderRow — UI/API must reject before generate.
    expect(findDisorderBySlug("totally-fake-disorder")).toBeUndefined();
    const result = getComorbidityCompatibility(
      "mdd-recurrent-moderate",
      "totally-fake-disorder",
    );
    expect(result.code).toBe("unknown_disorder");
  });
});

describe("compatibility matrix audit", () => {
  it("reports no orphan rules or duplicate keys in builtin matrix", () => {
    const audit = auditComorbidityCompatibilityMatrix();
    expect(audit.orphanRules).toEqual([]);
    expect(audit.duplicateRuleKeys).toEqual([]);
  });

  it("flags bipolar-mania + complex-ptsd as UI-selectable-unsupported under legacy all-active pairing", () => {
    const audit = auditComorbidityCompatibilityMatrix();
    const row = audit.uiSelectableUnsupported.find(
      (r) => r.primary === "bipolar-mania" && r.comorbid === "complex-ptsd",
    );
    expect(row).toBeDefined();
    expect(row!.code).toBe("comorbidity_unlisted");
    expect(row!.previewAllowed).toBe(false);
  });

  it("bipolar-mania has zero preview-allowed comorbidities in builtin matrix", () => {
    expect(listCompatibleComorbiditySlugs("bipolar-mania")).toEqual([]);
    const audit = auditComorbidityCompatibilityMatrix();
    const supported = audit.uiSelectableSupported.filter(
      (r) => r.primary === "bipolar-mania",
    );
    expect(supported).toEqual([]);
  });

  it("documents migration↔builtin drift for authored pairs (report only)", () => {
    const missingFromBuiltin: string[] = [];
    for (const pair of MIGRATION_AUTHORED_PAIRS_IN_BUILTIN_SCOPE) {
      const compat = getComorbidityCompatibility(pair.primary, pair.comorbid);
      if (pair.compatible && compat.code !== "ok") {
        missingFromBuiltin.push(`${pair.primary}+${pair.comorbid}`);
      }
      if (!pair.compatible && compat.code === "comorbidity_unlisted") {
        // Authored impossible rule missing from builtin → treated as unlisted
        missingFromBuiltin.push(`${pair.primary}+${pair.comorbid}(impossible)`);
      }
    }
    // Drift is expected until a dedicated sync PR — assert audit surface is stable.
    expect(missingFromBuiltin.length).toBeGreaterThan(0);
    expect(missingFromBuiltin).toContain("complex-ptsd+mdd-recurrent-moderate");
    expect(missingFromBuiltin).toContain(
      "bipolar-mania+mdd-recurrent-moderate(impossible)",
    );
    // The reported bug pair is NOT in migration either.
    expect(
      MIGRATION_AUTHORED_PAIRS_IN_BUILTIN_SCOPE.some(
        (p) => p.primary === "bipolar-mania" && p.comorbid === "complex-ptsd",
      ),
    ).toBe(false);
  });

  it("lists reserved DISORDER_IDS missing from BUILTIN_DISORDERS (orphaned ids)", () => {
    const builtinIds = new Set(BUILTIN_DISORDERS.map((d) => d.id));
    const orphanIds = Object.entries(DISORDER_IDS)
      .filter(([, id]) => !builtinIds.has(id))
      .map(([key]) => key)
      .sort();
    // Present in DISORDER_IDS / DB seeds but not in builtin packages used by preview.
    expect(orphanIds).toEqual(
      expect.arrayContaining([
        "asd",
        "eating",
        "ocd",
        "pdd",
        "schizoaffective",
        "socialAnxiety",
      ]),
    );
  });
});

describe("Preview Generator UI + API wiring (source guards)", () => {
  it("CaseEnginePanel filters comorbidities via listCompatibleComorbiditySlugs", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/admin/CaseEnginePanel.tsx"),
      "utf8",
    );
    expect(src).toMatch(/listCompatibleComorbiditySlugs/);
    expect(src).toMatch(/getComorbidityCompatibility/);
    expect(src).toMatch(/comorbidityBlocked/);
    expect(src).toMatch(/comorbidityUnavailable/);
    expect(src).toMatch(/comorbidityNeedsAuthoring/);
    expect(src).toMatch(/ContextualHelp/);
    expect(src).toMatch(/comorbidityHelp/);
    expect(src).toMatch(/findDisorderBySlug/);
  });

  it("preview API rejects unknown comorbidity slugs and keeps structured issues", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/api/admin/cases/preview/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/Unknown comorbidity/);
    expect(src).toMatch(/unknown_disorder/);
    expect(src).toMatch(/issues:/);
    expect(src).toMatch(/generateCaseInstance/);
    // Must not silently filter unknown comorbidities away.
    expect(src).not.toMatch(
      /\.map\(\(s\) => findDisorderBySlug\(s, catalog\)\)\s*\.filter\(Boolean\)/,
    );
  });

  it("EN and AR comorbidity help strings exist", () => {
    const en = JSON.parse(
      readFileSync(join(process.cwd(), "messages/en.json"), "utf8"),
    ) as { admin: { cases: Record<string, string> } };
    const ar = JSON.parse(
      readFileSync(join(process.cwd(), "messages/ar.json"), "utf8"),
    ) as { admin: { cases: Record<string, string> } };
    expect(en.admin.cases.comorbidityHelp).toMatch(/authored training scenario/);
    expect(ar.admin.cases.comorbidityHelp.length).toBeGreaterThan(20);
    expect(en.admin.cases.comorbidityUnavailable).toMatch(/\{name\}/);
    expect(ar.admin.cases.comorbidityUnavailable).toMatch(/\{name\}/);
    expect(en.admin.cases.comorbidityNeedsAuthoring).toMatch(/Requires case authoring/);
  });
});
