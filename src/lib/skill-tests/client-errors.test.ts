import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";
import {
  SKILL_TEST_FORM_CODES,
  skillTestCancelErrorKey,
  skillTestFormErrorKey,
  supervisorRoleErrorKey,
} from "./client-errors";

type Tree = Record<string, unknown>;

function text(tree: Tree, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node as Tree | undefined)?.[key], tree);
}

const FORM_KEYS = [
  ...SKILL_TEST_FORM_CODES.map((code) => skillTestFormErrorKey(400, code)),
  ...[401, 403, 429, 500].map((status) => skillTestFormErrorKey(status)),
];
const CANCEL_KEYS = [401, 403, 404, 409, 429, 500].map((s) => skillTestCancelErrorKey(s));
const ROLE_KEYS = [
  supervisorRoleErrorKey(403, "MFA_REQUIRED"),
  supervisorRoleErrorKey(409, "SUPERVISOR_NOT_UPDATED"),
  supervisorRoleErrorKey(429),
  supervisorRoleErrorKey(500),
];

describe("skill-test client error keys", () => {
  it("maps every route code to its own message, never the generic one", () => {
    for (const code of SKILL_TEST_FORM_CODES) {
      expect(skillTestFormErrorKey(400, code)).not.toBe("failed");
    }
    expect(skillTestFormErrorKey(429)).toBe("rateLimited");
    expect(skillTestFormErrorKey(500, "something_new")).toBe("failed");
  });

  it("tells the supervisor why a cancel or role change did not apply", () => {
    expect(skillTestCancelErrorKey(409, "skill_test_closed")).toBe("cancelClosed");
    expect(skillTestCancelErrorKey(429)).toBe("rateLimited");
    expect(supervisorRoleErrorKey(409, "SUPERVISOR_NOT_UPDATED")).toBe("notApplied");
    expect(supervisorRoleErrorKey(403, "MFA_REQUIRED")).toBe("mfaRequired");
  });

  it("has an English and an Arabic string for every key", () => {
    for (const messages of [en, ar] as Tree[]) {
      for (const key of FORM_KEYS) {
        expect(text(messages, `skillTests.form.errors.${key}`), key).toEqual(
          expect.any(String),
        );
      }
      for (const key of CANCEL_KEYS) {
        expect(text(messages, `skillTests.supervise.${key}`), key).toEqual(
          expect.any(String),
        );
      }
      for (const key of ROLE_KEYS) {
        expect(text(messages, `skillTests.admin.${key}`), key).toEqual(
          expect.any(String),
        );
      }
    }
  });
});
