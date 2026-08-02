import { describe, expect, it } from "vitest";
import { clientSafeError } from "./api-errors";

describe("clientSafeError", () => {
  it("returns fallback for empty errors", () => {
    expect(clientSafeError("Failed")).toBe("Failed");
  });

  it("allows short safe product messages", () => {
    expect(clientSafeError("Failed", "Session is not active")).toBe(
      "Session is not active",
    );
  });

  it("strips provider and secret-bearing messages", () => {
    expect(
      clientSafeError("Failed", "OPENAI_API_KEY is missing"),
    ).toBe("Failed");
    expect(
      clientSafeError("Failed", "ElevenLabs quota exceeded for plan"),
    ).toBe("Failed");
    expect(
      clientSafeError("Failed", "postgres exception: duplicate key"),
    ).toBe("Failed");
    expect(
      clientSafeError(
        "Failed",
        "Server misconfigured: set REPORT_WRITE_KEY or SUPABASE_SERVICE_ROLE_KEY",
      ),
    ).toBe("Failed");
  });
});
