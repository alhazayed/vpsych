import { describe, expect, it } from "vitest";
import { apiError } from "./api-auth";

describe("api-auth helpers", () => {
  it("builds a consistent JSON error envelope", async () => {
    const res = apiError("Forbidden", 403, { code: "admin_required" });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "Forbidden",
      code: "admin_required",
    });
  });
});
