import { describe, expect, it } from "vitest";
import { tabKeyTarget } from "./tab-keys";

describe("tabKeyTarget", () => {
  it("moves right to the next tab in English and wraps", () => {
    expect(tabKeyTarget("ArrowRight", 0, 3, false)).toBe(1);
    expect(tabKeyTarget("ArrowRight", 2, 3, false)).toBe(0);
    expect(tabKeyTarget("ArrowLeft", 0, 3, false)).toBe(2);
  });

  it("reverses arrows in Arabic", () => {
    expect(tabKeyTarget("ArrowLeft", 0, 3, true)).toBe(1);
    expect(tabKeyTarget("ArrowRight", 0, 3, true)).toBe(2);
  });

  it("jumps with Home and End and ignores other keys", () => {
    expect(tabKeyTarget("Home", 2, 3, false)).toBe(0);
    expect(tabKeyTarget("End", 0, 3, true)).toBe(2);
    expect(tabKeyTarget("Enter", 1, 3, false)).toBeNull();
  });
});
