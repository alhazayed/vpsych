import { describe, expect, it } from "vitest";
import { validateDsmIcd } from "./validation";
import type { DisorderRow } from "./types";

function disorder(
  partial: Partial<DisorderRow> & Pick<DisorderRow, "slug">,
): DisorderRow {
  return {
    id: partial.id ?? "00000000-0000-4000-8000-000000000001",
    slug: partial.slug,
    name: partial.name ?? partial.slug,
    dsm5_code: partial.dsm5_code ?? null,
    icd10_code: partial.icd10_code ?? null,
    icd11_code: partial.icd11_code ?? null,
    category: partial.category ?? "mood",
    min_age: partial.min_age ?? null,
    max_age: partial.max_age ?? null,
    allowed_genders: partial.allowed_genders ?? [],
    package: partial.package ?? {},
    is_active: partial.is_active ?? true,
  };
}

describe("validateDsmIcd clinical coding integrity", () => {
  it("accepts ICD-11-only Complex PTSD", () => {
    const issues = validateDsmIcd(
      disorder({
        slug: "complex-ptsd",
        dsm5_code: null,
        icd11_code: "6B41",
      }),
    );
    expect(issues).toEqual([]);
  });

  it("accepts disorders with both DSM-5 and ICD-11", () => {
    const issues = validateDsmIcd(
      disorder({
        slug: "mdd-recurrent-moderate",
        dsm5_code: "296.32",
        icd11_code: "6A71.1",
      }),
    );
    expect(issues).toEqual([]);
  });

  it("rejects disorders with neither code", () => {
    const issues = validateDsmIcd(
      disorder({
        slug: "unknown",
        dsm5_code: null,
        icd11_code: null,
      }),
    );
    expect(issues.some((i) => i.code === "clinical_code_missing")).toBe(true);
  });

  it("flags missing ICD-11 when only DSM-5 is present", () => {
    const issues = validateDsmIcd(
      disorder({
        slug: "legacy",
        dsm5_code: "296.32",
        icd11_code: null,
      }),
    );
    expect(issues.some((i) => i.code === "icd11_missing")).toBe(true);
  });
});
