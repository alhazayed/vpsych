import { describe, expect, it } from "vitest";
import { flattenAdminNav } from "@/lib/admin/admin-nav";
import {
  ADMIN_MOBILE_BAR_HREFS,
  MOBILE_BAR_SLOTS,
  splitMobileNav,
} from "@/lib/mobile-nav";

const item = (href: string) => ({ href });

describe("splitMobileNav", () => {
  it("keeps every item in the bar when they fit", () => {
    const items = ["/a", "/b", "/c", "/d", "/e"].map(item);
    expect(splitMobileNav(items)).toEqual({ bar: items, overflow: [] });
  });

  it("moves the rest behind More and keeps nothing out of reach", () => {
    const items = ["/avatars", "/tests", "/sessions", "/feedback", "/supervise", "/admin"].map(item);
    const { bar, overflow } = splitMobileNav(items, ["/admin"]);
    expect(bar.length).toBe(MOBILE_BAR_SLOTS - 1);
    expect(bar.map((i) => i.href)).toEqual(["/avatars", "/tests", "/sessions", "/admin"]);
    expect(overflow.map((i) => i.href)).toEqual(["/feedback", "/supervise"]);
    expect([...bar, ...overflow].length).toBe(items.length);
  });

  it("works without pinned items", () => {
    const items = ["/a", "/b", "/c", "/d", "/e", "/f"].map(item);
    const { bar, overflow } = splitMobileNav(items);
    expect(bar.map((i) => i.href)).toEqual(["/a", "/b", "/c", "/d"]);
    expect(overflow.map((i) => i.href)).toEqual(["/e", "/f"]);
  });
});

describe("admin phone bar", () => {
  it("only lists real admin destinations and leaves a slot for More", () => {
    const hrefs = flattenAdminNav().map((i) => i.href);
    for (const href of ADMIN_MOBILE_BAR_HREFS) expect(hrefs).toContain(href);
    expect(ADMIN_MOBILE_BAR_HREFS).toContain("/admin/accounts");
    expect(ADMIN_MOBILE_BAR_HREFS.length).toBe(MOBILE_BAR_SLOTS - 1);
  });
});
