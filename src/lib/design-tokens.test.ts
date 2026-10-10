import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Reads the light-theme tokens from globals.css and checks the WCAG AA
// contrast pairs the design critique flagged, so a later palette tweak
// cannot quietly bring them back below the line.

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`token --${name} is not a hex colour in globals.css`);
  return match[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("design token contrast", () => {
  const surfaces = [
    "surface-container-lowest",
    "background",
    "surface-container-low",
    "surface-container",
  ];

  it.each(surfaces)("--outline text is at least 4.5:1 on --%s", (bg) => {
    expect(contrast(token("outline"), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(surfaces)(
    "--on-surface-variant text is at least 4.5:1 on --%s",
    (bg) => {
      expect(
        contrast(token("on-surface-variant"), token(bg)),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("form field borders are at least 3:1 against the field and page", () => {
    expect(
      contrast(token("field-border"), token("surface-container-lowest")),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(token("field-border"), token("background")),
    ).toBeGreaterThanOrEqual(3);
  });

  it("success chip text is at least 4.5:1 on its tinted chip", () => {
    // .status-chip-done paints #16a34a at 12% over white.
    const tint = "#" + [1, 3, 5]
      .map((i) => {
        const v = Math.round(
          parseInt("#16a34a".slice(i, i + 2), 16) * 0.12 + 255 * 0.88,
        );
        return v.toString(16).padStart(2, "0");
      })
      .join("");
    expect(contrast(token("success"), tint)).toBeGreaterThanOrEqual(4.5);
  });

  it("the fair password meter is at least 3:1 against its track", () => {
    expect(
      contrast(token("strength-fair"), token("surface-container-highest")),
    ).toBeGreaterThanOrEqual(3);
  });

  it("every colour token a component reads is defined", () => {
    // font-* come from next/font class names; trm-* are set per room in
    // inline styles by the Therapy Room.
    const files = readdirSync(join(process.cwd(), "src"), {
      recursive: true,
      encoding: "utf8",
    }).filter((f) => /\.(tsx|css)$/.test(f));
    const missing = new Set<string>();
    for (const file of files) {
      const text = readFileSync(join(process.cwd(), "src", file), "utf8");
      for (const m of text.matchAll(/var\(--([a-z0-9-]+)/g)) {
        const name = m[1];
        if (name.startsWith("font-") || name.startsWith("trm-")) continue;
        if (!new RegExp(`--${name}\\s*:`).test(css)) missing.add(name);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
