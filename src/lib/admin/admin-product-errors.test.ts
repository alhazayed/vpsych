import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  adminActionErrorKey,
  adminValidationIssues,
  educatorAdminError,
  extractAdminProductErrorCode,
} from "./admin-product-errors";

const LABELS = {
  lifecycle_immutable:
    "This Virtual Patient is published and cannot be edited. Duplicate it to create a new draft.",
  comorbidity_unlisted:
    "This diagnosis combination has not yet been authored for simulation.",
  comorbidity_incompatible:
    "This combination is not currently authored for simulation.",
  comorbidity_unavailable:
    "This combination is not currently authored for simulation.",
  MFA_REQUIRED:
    "Additional administrator verification is required. Please complete MFA.",
  mfa_required:
    "Additional administrator verification is required. Please complete MFA.",
  publish_not_ready:
    "This Virtual Patient is not ready to publish. Review Case Readiness and fix the items listed.",
  not_found: "That Virtual Patient could not be found.",
  forbidden: "You do not have permission to perform this action.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
} as const;

describe("admin-product-errors", () => {
  it("extracts known codes from strings and objects", () => {
    expect(extractAdminProductErrorCode("lifecycle_immutable")).toBe(
      "lifecycle_immutable",
    );
    expect(extractAdminProductErrorCode({ code: "MFA_REQUIRED" })).toBe(
      "MFA_REQUIRED",
    );
    expect(
      extractAdminProductErrorCode({ error: "comorbidity_unlisted" }),
    ).toBe("comorbidity_unlisted");
  });

  it("maps codes to educator copy", () => {
    expect(
      educatorAdminError("lifecycle_immutable", (k) => LABELS[k]),
    ).toContain("cannot be edited");
    expect(educatorAdminError("MFA_REQUIRED", (k) => LABELS[k])).toContain(
      "MFA",
    );
    expect(
      educatorAdminError("comorbidity_unlisted", (k) => LABELS[k]),
    ).toContain("authored for simulation");
  });

  it("does not treat ordinary prose as technical", () => {
    expect(
      educatorAdminError("Could not save Guided changes.", (k) => LABELS[k]),
    ).toBe("Could not save Guided changes.");
  });

  it("falls back when the message looks technical", () => {
    expect(
      educatorAdminError("postgres exception: duplicate key", (k) => LABELS[k], "Safe"),
    ).toBe("Safe");
  });
});

describe("adminActionErrorKey", () => {
  const load = (l: string) =>
    JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as {
      admin: { actionErrors: Record<string, string> };
    };

  it("never echoes the English server text; every key has EN and AR copy", () => {
    const keys = [
      adminActionErrorKey(403, "MFA_REQUIRED"),
      adminActionErrorKey(403),
      adminActionErrorKey(404),
      adminActionErrorKey(429),
      adminActionErrorKey(400),
      adminActionErrorKey(500),
      "network",
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of ["en", "ar"]) {
      for (const key of keys) {
        expect(load(l).admin.actionErrors[key], `${l}:${key}`).toEqual(expect.any(String));
      }
    }
  });

  it("keeps only the validator's issue text for a 400", () => {
    expect(
      adminValidationIssues({ error: [{ code: "x", message: "Name is required" }, "Bad slug"] }),
    ).toEqual(["Name is required", "Bad slug"]);
    expect(adminValidationIssues({ error: "relation does not exist" })).toEqual([]);
  });
});
