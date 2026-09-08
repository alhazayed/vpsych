#!/usr/bin/env node
/**
 * Reject environment files that must never be versioned.
 * .env.example is intentionally allowed as a documented template.
 */
import { execFileSync } from "node:child_process";

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const prohibited = tracked.filter(
  (path) =>
    /(^|\/)\.env(?:\.[^/]+)?$/i.test(path) &&
    path !== ".env.example",
);

if (prohibited.length) {
  console.error("Refusing tracked environment files:");
  for (const path of prohibited) console.error("  - " + path);
  console.error(
    "Keep only .env.example in git; rotate any credential that was committed.",
  );
  process.exit(1);
}

console.log("Tracked environment-file guard passed.");
