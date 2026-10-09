import { describe, expect, it } from "vitest";
import { authErrorKey } from "@/lib/auth-error";

describe("authErrorKey", () => {
  it("maps Supabase auth codes to translated keys", () => {
    expect(authErrorKey({ code: "invalid_credentials", status: 400 })).toBe("invalidCredentials");
    expect(authErrorKey({ code: "email_not_confirmed" })).toBe("emailNotConfirmed");
    expect(authErrorKey({ code: "user_already_exists", status: 422 })).toBe("alreadyRegistered");
    expect(authErrorKey({ code: "weak_password" })).toBe("weakPassword");
    expect(authErrorKey({ code: "email_address_invalid" })).toBe("invalidEmail");
    expect(authErrorKey({ code: "signup_disabled" })).toBe("signupDisabled");
    expect(authErrorKey({ code: "over_email_send_rate_limit" })).toBe("rateLimited");
  });

  it("falls back on status when there is no code", () => {
    expect(authErrorKey({ status: 429 })).toBe("rateLimited");
    expect(authErrorKey({ status: 400 })).toBe("invalidCredentials");
    expect(authErrorKey({ status: 500 })).toBe("failed");
    expect(authErrorKey(null)).toBe("failed");
    expect(authErrorKey({ code: "something_new", status: 400 })).toBe("failed");
  });
});
