import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accessCookieValueForCode,
  configuredInviteCodes,
  isValidAccessCookie,
  isValidInviteCode,
  normalizeInviteCode,
} from "./invite";

describe("normalizeInviteCode", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeInviteCode("  rc1-preview ")).toBe("RC1-PREVIEW");
    expect(normalizeInviteCode("rc1 preview")).toBe("RC1PREVIEW");
  });
});

describe("configuredInviteCodes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses comma-separated env codes", () => {
    vi.stubEnv("VALIDATION_INVITE_CODES", " Alpha , beta,ALPHA ");
    expect(configuredInviteCodes()).toEqual(["ALPHA", "BETA"]);
  });

  it("falls back to RC1-PREVIEW outside production when unset", () => {
    vi.stubEnv("VALIDATION_INVITE_CODES", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(configuredInviteCodes()).toEqual(["RC1-PREVIEW"]);
  });

  it("returns empty in production when unset", () => {
    vi.stubEnv("VALIDATION_INVITE_CODES", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(configuredInviteCodes()).toEqual([]);
  });
});

describe("isValidInviteCode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a configured code case-insensitively", () => {
    vi.stubEnv("VALIDATION_INVITE_CODES", "EXPERT-42");
    expect(isValidInviteCode("expert-42")).toBe(true);
    expect(isValidInviteCode("wrong")).toBe(false);
    expect(isValidInviteCode("")).toBe(false);
  });
});

describe("access cookie", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a valid code into a verifiable cookie", () => {
    vi.stubEnv("VALIDATION_INVITE_CODES", "STUDY-A");
    const value = accessCookieValueForCode("study-a");
    expect(isValidAccessCookie(value)).toBe(true);
    expect(isValidAccessCookie("deadbeef")).toBe(false);
    expect(isValidAccessCookie(null)).toBe(false);
  });
});
