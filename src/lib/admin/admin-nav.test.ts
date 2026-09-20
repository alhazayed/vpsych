import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_SECTIONS,
  filterAdminNavItems,
  findAdminNavItem,
  flattenAdminNav,
} from "@/lib/admin/admin-nav";

describe("admin-nav IA", () => {
  it("exposes hierarchical sections without inventing routes", () => {
    const hrefs = flattenAdminNav().map((i) => i.href);
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/reports");
    expect(hrefs).toContain("/admin/avatars");
    expect(hrefs).toContain("/admin/diagnostics");
    expect(hrefs).not.toContain("/admin/integrations");
    expect(hrefs).not.toContain("/dashboard");
  });

  it("keeps section ids stable for persistence", () => {
    expect(ADMIN_NAV_SECTIONS.map((s) => s.id)).toEqual([
      "overview",
      "learning",
      "assessment",
      "content",
      "organization",
      "research",
      "system",
    ]);
  });

  it("matches nested report routes to assessment", () => {
    const item = findAdminNavItem("/admin/reports/sess-1");
    expect(item?.href).toBe("/admin/reports");
  });

  it("filters command palette by label and keywords", () => {
    const resolve = (key: string) =>
      ({
        overview: "Overview",
        virtualPatients: "Virtual Patients",
        performanceReports: "Performance Reports",
        operations: "Operations",
        systemHealth: "System Health",
        learnersProgress: "Learners & Progress",
        competencies: "Competencies",
        voices: "Voices",
        cases: "Cases",
        templates: "Templates",
        presets: "Presets",
        enterprise: "Enterprise",
        feedback: "Feedback",
        validation: "Validation",
      })[key] ?? key;

    const byKeyword = filterAdminNavItems("cidp", resolve);
    expect(byKeyword.some((i) => i.href === "/admin/cidp")).toBe(true);

    const byLabel = filterAdminNavItems("virtual", resolve);
    expect(byLabel.some((i) => i.href === "/admin/avatars")).toBe(true);
  });

  it("does not exceed a reasonable expanded depth of sections", () => {
    for (const section of ADMIN_NAV_SECTIONS) {
      expect(section.items.length).toBeLessThanOrEqual(6);
    }
    expect(flattenAdminNav().length).toBeLessThanOrEqual(16);
  });
});
