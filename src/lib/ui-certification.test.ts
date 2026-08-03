import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const root = process.cwd();

describe("UI/UX certification guards", () => {
  it("provides a skip-to-content control and target id", () => {
    const skip = readFileSync(
      join(root, "src/components/SkipToContent.tsx"),
      "utf8",
    );
    expect(skip).toMatch(/skipToContent/);
    expect(skip).toMatch(/#\$\{targetId\}|#main-content/);

    const shell = readFileSync(join(root, "src/components/AppShell.tsx"), "utf8");
    expect(shell).toMatch(/id="main-content"/);
    expect(shell).toMatch(/more_horiz|moreNavigation/);
  });

  it("exposes focus-visible and reduced-motion styles", () => {
    const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/\.skip-link/);
  });

  it("keeps robots.txt and legal pages publicly reachable from middleware", () => {
    const mw = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/\/robots\.txt/);
    expect(mw).toMatch(/\/privacy/);
    expect(mw).toMatch(/\/terms/);
    expect(existsSync(join(root, "public/robots.txt"))).toBe(true);
    expect(existsSync(join(root, "src/app/privacy/page.tsx"))).toBe(true);
    expect(existsSync(join(root, "src/app/terms/page.tsx"))).toBe(true);
  });

  it("uses a More sheet for admin mobile destinations instead of crowding the bar", () => {
    const shell = readFileSync(join(root, "src/components/AppShell.tsx"), "utf8");
    expect(shell).toMatch(/adminItems\.length > 0/);
    expect(shell).toMatch(/role="dialog"/);
    // Primary mobile bar should map therapist destinations, not the full admin list.
    expect(shell).toMatch(/primaryNav\.map/);
  });
});
