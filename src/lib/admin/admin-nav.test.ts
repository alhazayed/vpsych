import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_SECTIONS,
  filterAdminNavItems,
  findAdminNavItem,
  flattenAdminNav,
} from "@/lib/admin/admin-nav";
import {
  formatSessionDuration,
  sessionStatusTone,
  shortSessionId,
} from "@/lib/admin/session-ops";

describe("admin-nav IA", () => {
  it("exposes hierarchical sections without inventing routes", () => {
    const hrefs = flattenAdminNav().map((i) => i.href);
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/sessions");
    expect(hrefs).toContain("/admin/reports");
    expect(hrefs).toContain("/admin/content");
    expect(hrefs).toContain("/admin/analytics");
    expect(hrefs).toContain("/admin/avatars");
    expect(hrefs).toContain("/admin/diagnostics");
    expect(hrefs).not.toContain("/admin/integrations");
    expect(hrefs).not.toContain("/dashboard");
  });

  it("keeps section ids stable for persistence", () => {
    expect(ADMIN_NAV_SECTIONS.map((s) => s.id)).toEqual([
      "overview",
      "learning",
      "simulations",
      "assessment",
      "content",
      "organization",
      "analytics",
      "research",
      "system",
    ]);
  });

  it("matches nested session and report routes", () => {
    expect(findAdminNavItem("/admin/sessions/abc")?.href).toBe(
      "/admin/sessions",
    );
    expect(findAdminNavItem("/admin/reports/sess-1")?.href).toBe(
      "/admin/reports",
    );
  });

  it("filters command palette by label and keywords", () => {
    const resolve = (key: string) =>
      ({
        overview: "Overview",
        sessions: "Sessions",
        virtualPatients: "Virtual Patients",
        performanceReports: "Performance Reports",
        contentLibrary: "Content",
        analyticsOverview: "Analytics",
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

    expect(
      filterAdminNavItems("session", resolve).some(
        (i) => i.href === "/admin/sessions",
      ),
    ).toBe(true);
    expect(
      filterAdminNavItems("analytics", resolve).some(
        (i) => i.href === "/admin/analytics",
      ),
    ).toBe(true);
  });

  it("does not exceed a reasonable expanded depth of sections", () => {
    for (const section of ADMIN_NAV_SECTIONS) {
      expect(section.items.length).toBeLessThanOrEqual(6);
    }
    expect(flattenAdminNav().length).toBeLessThanOrEqual(20);
  });
});

describe("session-ops helpers", () => {
  it("formats duration and status tones from real statuses only", () => {
    expect(sessionStatusTone("completed")).toBe("active");
    expect(sessionStatusTone("expired")).toBe("warning");
    expect(sessionStatusTone("active")).toBe("info");
    expect(shortSessionId("abcdef12-3456")).toBe("abcdef12");
    const start = "2026-09-20T10:00:00.000Z";
    const end = "2026-09-20T10:45:00.000Z";
    expect(formatSessionDuration(start, end)).toBe("45m");
  });
});
