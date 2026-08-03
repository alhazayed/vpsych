import { describe, expect, it } from "vitest";
import {
  getLaunchAnalyticsConfig,
  hasAnyOptionalAnalytics,
} from "@/lib/launch/config";
import {
  PUBLIC_LAUNCH_CHECKLIST,
  buildLaunchReadinessDocument,
  launchRecommendation,
  scoreChecklist,
} from "@/lib/launch/checklist";
import { isSeoAssetPath, PUBLIC_INDEXABLE_PATHS } from "@/lib/seo/site";

describe("Mission 30 — Public Launch Certification", () => {
  it("scores the board checklist and returns NOT READY under current blockers", () => {
    const { score } = scoreChecklist();
    expect(score).toBeLessThan(75);
    const rec = launchRecommendation(score);
    expect(rec.verdict).toBe("NOT READY");
    expect(rec.symbol).toBe("❌");
  });

  it("includes release-train and production SEO as hard fails", () => {
    const fails = PUBLIC_LAUNCH_CHECKLIST.filter((i) => i.status === "fail").map(
      (i) => i.id,
    );
    expect(fails).toContain("release-train");
    expect(fails).toContain("seo-prod");
    expect(fails).toContain("monitoring");
  });

  it("exposes launch readiness document with checklist", () => {
    const doc = buildLaunchReadinessDocument();
    expect(doc.mission).toBe(30);
    expect(doc.checklist.length).toBeGreaterThanOrEqual(15);
    expect(doc.blockers.length).toBeGreaterThanOrEqual(3);
    expect(doc.verdict).toContain("NOT READY");
  });

  it("reads analytics config from env without inventing IDs", () => {
    const empty = getLaunchAnalyticsConfig({});
    expect(hasAnyOptionalAnalytics(empty)).toBe(false);
    const filled = getLaunchAnalyticsConfig({
      NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST123",
      NEXT_PUBLIC_CLARITY_PROJECT_ID: "claritytest",
    });
    expect(filled.gaMeasurementId).toBe("G-TEST123");
    expect(hasAnyOptionalAnalytics(filled)).toBe(true);
  });

  it("indexes release notes and launch readiness JSON", () => {
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/release-notes");
    expect(PUBLIC_INDEXABLE_PATHS).toContain("/launch-readiness.json");
    expect(isSeoAssetPath("/launch-readiness.json")).toBe(true);
  });
});
