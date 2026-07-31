import { describe, expect, it } from "vitest";
import { localeNativeName, localeNativeNames } from "./locale-names";

describe("localeNativeName", () => {
  it("returns the language's own name, never a translation", () => {
    expect(localeNativeName("ar-JO")).toBe("العربية");
    expect(localeNativeName("en-US")).toBe("English");
  });

  it("resolves from the base language, so future dialects work", () => {
    expect(localeNativeName("ar")).toBe("العربية");
    expect(localeNativeName("ar-EG")).toBe("العربية");
    expect(localeNativeName("en-GB")).toBe("English");
  });

  it("falls back to the tag for unknown locales", () => {
    expect(localeNativeName("fr-FR")).toBe("fr-FR");
  });

  it("handles blank input", () => {
    expect(localeNativeName("")).toBe("");
    expect(localeNativeName("   ")).toBe("");
  });
});

describe("localeNativeNames", () => {
  it("maps an avatar's authored locales", () => {
    expect(localeNativeNames(["ar-JO", "en-US"])).toEqual([
      "العربية",
      "English",
    ]);
  });

  it("de-duplicates locales sharing a language", () => {
    expect(localeNativeNames(["ar-JO", "ar-EG"])).toEqual(["العربية"]);
  });

  it("returns [] when there is no inventory", () => {
    expect(localeNativeNames(null)).toEqual([]);
    expect(localeNativeNames(undefined)).toEqual([]);
    expect(localeNativeNames([])).toEqual([]);
  });
});
