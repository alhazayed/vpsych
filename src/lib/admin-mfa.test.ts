import { describe, expect, it } from "vitest";
import {
  evaluateAdminMfa,
  hasAdminMfaAssurance,
  isAdminMfaEnforced,
} from "./admin-mfa";

describe("admin MFA enforcement", () => {
  it("defaults to enforced in production", () => {
    expect(
      isAdminMfaEnforced({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("defaults to off outside production", () => {
    expect(
      isAdminMfaEnforced({ NODE_ENV: "development" } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      isAdminMfaEnforced({ NODE_ENV: "test" } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("honors explicit ADMIN_MFA_REQUIRED override", () => {
    expect(
      isAdminMfaEnforced({
        NODE_ENV: "development",
        ADMIN_MFA_REQUIRED: "true",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isAdminMfaEnforced({
        NODE_ENV: "production",
        ADMIN_MFA_REQUIRED: "false",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("accepts only aal2 as sufficient assurance", () => {
    expect(hasAdminMfaAssurance({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(
      true,
    );
    expect(hasAdminMfaAssurance({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(
      false,
    );
  });

  it("evaluateAdminMfa denies aal1 when enforced", () => {
    expect(
      evaluateAdminMfa({
        enforced: true,
        assurance: { currentLevel: "aal1", nextLevel: "aal2" },
      }),
    ).toEqual({
      ok: false,
      reason: "mfa_required",
      currentLevel: "aal1",
    });
  });

  it("evaluateAdminMfa allows aal1 when not enforced", () => {
    expect(
      evaluateAdminMfa({
        enforced: false,
        assurance: { currentLevel: "aal1", nextLevel: "aal2" },
      }),
    ).toEqual({ ok: true });
  });

  it("evaluateAdminMfa allows aal2 when enforced", () => {
    expect(
      evaluateAdminMfa({
        enforced: true,
        assurance: { currentLevel: "aal2", nextLevel: "aal2" },
      }),
    ).toEqual({ ok: true });
  });
});
