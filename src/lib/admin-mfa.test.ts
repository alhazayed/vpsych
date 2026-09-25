import { describe, expect, it } from "vitest";
import {
  ADMIN_MFA_CHALLENGE_PATH,
  ADMIN_MFA_ENROLL_PATH,
  adminMfaChallengeHref,
  adminMfaEnrollHref,
  adminMfaReturnPath,
  evaluateAdminMfa,
  hasAdminMfaAssurance,
  isAdminMfaBootstrapPath,
  isAdminMfaEnforced,
  resolveAdminPostLoginPath,
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

describe("admin MFA bootstrap paths", () => {
  it("recognizes challenge and enroll paths", () => {
    expect(isAdminMfaBootstrapPath(ADMIN_MFA_CHALLENGE_PATH)).toBe(true);
    expect(isAdminMfaBootstrapPath(ADMIN_MFA_ENROLL_PATH)).toBe(true);
    expect(isAdminMfaBootstrapPath("/admin")).toBe(false);
    expect(isAdminMfaBootstrapPath("/avatars")).toBe(false);
  });

  it("builds open-redirect-safe challenge and enroll hrefs", () => {
    expect(adminMfaChallengeHref("/admin")).toBe(
      "/auth/mfa?next=%2Fadmin",
    );
    expect(adminMfaEnrollHref("//evil.com")).toBe(
      "/auth/mfa/enroll?next=%2Fadmin",
    );
    expect(adminMfaReturnPath("/auth/mfa")).toBe("/admin");
    expect(adminMfaReturnPath("/login")).toBe("/admin");
  });

  it("routes AAL1 admin without factors to enroll", () => {
    expect(
      resolveAdminPostLoginPath({
        enforced: true,
        isAdmin: true,
        currentLevel: "aal1",
        verifiedTotpFactors: [],
        intendedNext: "/avatars",
      }),
    ).toBe("/auth/mfa/enroll?next=%2Fadmin");
  });

  it("routes AAL1 admin with verified factor to challenge", () => {
    expect(
      resolveAdminPostLoginPath({
        enforced: true,
        isAdmin: true,
        currentLevel: "aal1",
        verifiedTotpFactors: [{ id: "fac-1", status: "verified" }],
        intendedNext: "/admin/analytics",
      }),
    ).toBe("/auth/mfa?next=%2Fadmin%2Fanalytics");
  });

  it("routes AAL2 admin straight to intended path", () => {
    expect(
      resolveAdminPostLoginPath({
        enforced: true,
        isAdmin: true,
        currentLevel: "aal2",
        verifiedTotpFactors: [{ id: "fac-1", status: "verified" }],
        intendedNext: "/admin/sessions",
      }),
    ).toBe("/admin/sessions");
  });

  it("leaves therapists on avatar library", () => {
    expect(
      resolveAdminPostLoginPath({
        enforced: true,
        isAdmin: false,
        currentLevel: "aal1",
        verifiedTotpFactors: [],
        intendedNext: "/avatars",
      }),
    ).toBe("/avatars");
  });
});
