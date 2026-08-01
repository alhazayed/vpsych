import { describe, expect, it } from "vitest";
import { isConfiguredSecret } from "@/lib/env";

describe("isConfiguredSecret", () => {
  it("rejects empty and placeholder values", () => {
    expect(isConfiguredSecret(undefined)).toBe(false);
    expect(isConfiguredSecret("")).toBe(false);
    expect(isConfiguredSecret("test")).toBe(false);
    expect(isConfiguredSecret("changeme")).toBe(false);
    expect(isConfiguredSecret("your-api-key")).toBe(false);
    expect(isConfiguredSecret("<secret>")).toBe(false);
  });

  it("accepts real-looking secrets", () => {
    expect(isConfiguredSecret("sk-proj-abcdefghijklmnop")).toBe(true);
    expect(
      isConfiguredSecret(
        "069ef12bcba624f851642136e80f0c8ab149032b7a0c69c74da43de89534d26b",
      ),
    ).toBe(true);
  });
});
