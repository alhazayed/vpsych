import { describe, expect, it } from "vitest";
import {
  isPasswordPolicySatisfied,
  passwordChecks,
  passwordStrengthLevel,
} from "./password-policy";

describe("password policy", () => {
  it("requires 8+ chars, upper, number, special", () => {
    expect(isPasswordPolicySatisfied("short1!")).toBe(false);
    expect(isPasswordPolicySatisfied("longenough1")).toBe(false);
    expect(isPasswordPolicySatisfied("Longenough!")).toBe(false);
    expect(isPasswordPolicySatisfied("Longenough1")).toBe(false);
    expect(isPasswordPolicySatisfied("Longenough1!")).toBe(true);
  });

  it("exposes granular checks and strength", () => {
    expect(passwordChecks("Aa1!")).toEqual({
      length: false,
      upper: true,
      number: true,
      special: true,
    });
    expect(passwordStrengthLevel("")).toBe("");
    expect(passwordStrengthLevel("abcdefgh")).toBe("weak");
    expect(passwordStrengthLevel("Abcdefgh1!")).toBe("strong");
  });
});
