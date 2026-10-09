import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_REPRODUCIBILITY,
  FEEDBACK_ROLES,
  FEEDBACK_SEVERITIES,
} from "@/lib/enterprise/feedback";

type Tree = { [key: string]: string | Tree };

const load = (locale: string) =>
  JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as Tree;

function leafKeys(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : leafKeys(v, `${prefix}${k}.`),
  );
}

const en = load("en");
const ar = load("ar");

describe("messages", () => {
  it("en and ar have the same keys (CLAUDE.md: add every key to both files)", () => {
    const enKeys = new Set(leafKeys(en));
    const arKeys = new Set(leafKeys(ar));
    expect([...enKeys].filter((k) => !arKeys.has(k))).toEqual([]);
    expect([...arKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("no Arabic string is empty", () => {
    const empty = leafKeys(ar).filter((k) => {
      const v = k.split(".").reduce<string | Tree>((t, p) => (t as Tree)[p], ar);
      return typeof v === "string" && v.trim() === "";
    });
    expect(empty).toEqual([]);
  });

  it("translates every feedback form option", () => {
    const keys = new Set(leafKeys(ar));
    const expected = [
      ...FEEDBACK_ROLES.map((r) => `feedback.roles.${r}`),
      ...FEEDBACK_SEVERITIES.map((s) => `feedback.severities.${s}`),
      ...FEEDBACK_REPRODUCIBILITY.map((r) => `feedback.reproducibility.${r}`),
      ...FEEDBACK_CATEGORIES.map((c) => `feedback.categories.${c}`),
    ];
    expect(expected.filter((k) => !keys.has(k))).toEqual([]);
  });

  it("uses Arabic plural forms for counts", () => {
    const t = createTranslator({ locale: "ar", messages: ar }) as unknown as (
      key: string,
      values: Record<string, string | number>,
    ) => string;
    expect(t("avatars.count", { count: 1, persona: "" })).toBe("شخصية واحدة نشطة");
    expect(t("avatars.count", { count: 3, persona: "" })).toBe("3 شخصيات نشطة");
    expect(t("avatars.count", { count: 11, persona: "" })).toBe("11 شخصية نشطة");
    expect(t("skillTests.trainee.progress", { held: 1, total: 4 })).toBe(
      "عُقدت 1 من 4 جلسات",
    );
    expect(t("course.expectedSessions", { n: 2 })).toBe("المدة المتوقعة: جلستان");
  });
});
