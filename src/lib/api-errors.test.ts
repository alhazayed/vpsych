import { describe, expect, it } from "vitest";
import {
  ALLOWED_CLIENT_MESSAGES,
  clientSafeError,
  clientSafeStreamError,
} from "./api-errors";

describe("clientSafeError", () => {
  it("returns fallback for empty errors", () => {
    expect(clientSafeError("Failed")).toBe("Failed");
  });

  it("allows only allowlisted product messages", () => {
    expect(clientSafeError("Failed", "Session is not active")).toBe(
      "Session is not active",
    );
    expect(ALLOWED_CLIENT_MESSAGES.has("Session is not active")).toBe(true);
  });

  it("never returns SQL / provider / secret-bearing messages", () => {
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
        'duplicate key value violates unique constraint "sessions_pkey"',
      ),
    ).toBe("Failed");
    expect(
      clientSafeError("Failed", 'relation "session_messages" does not exist'),
    ).toBe("Failed");
    expect(
      clientSafeError(
        "Failed",
        "Server misconfigured: set REPORT_WRITE_KEY or SUPABASE_SERVICE_ROLE_KEY",
      ),
    ).toBe("Failed");
  });

  it("clientSafeStreamError never echoes Error.message", () => {
    expect(
      clientSafeStreamError(
        new Error('column "secret" of relation "x" does not exist'),
      ),
    ).toBe("Streaming turn failed");
  });
});
