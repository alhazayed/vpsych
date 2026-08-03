#!/usr/bin/env node
/**
 * Production / preview smoke checks for DevOps certification.
 *
 * Usage:
 *   SMOKE_BASE_URL=https://vpsych.vercel.app node scripts/smoke-prod.mjs
 *   SMOKE_BASE_URL=... SMOKE_SHARE=... node scripts/smoke-prod.mjs
 */

const BASE = (process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
const SHARE = process.env.SMOKE_SHARE || "";
/** Vercel Deployment Protection automation bypass (preview/prod). */
const BYPASS =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
  process.env.SMOKE_PROTECTION_BYPASS ||
  "";

if (!BASE) {
  console.error("SMOKE_BASE_URL is required");
  process.exit(2);
}

function url(path) {
  const u = new URL(path, BASE);
  if (SHARE) u.searchParams.set("_vercel_share", SHARE);
  return u.toString();
}

function baseHeaders(extra = {}) {
  const headers = { ...extra };
  if (BYPASS) {
    headers["x-vercel-protection-bypass"] = BYPASS;
  }
  return headers;
}

async function check(name, path, opts = {}) {
  const expect = opts.expect ?? [200];
  const method = opts.method ?? "GET";
  const t0 = performance.now();
  const res = await fetch(url(path), {
    method,
    redirect: "manual",
    headers: baseHeaders(opts.headers),
    body: opts.body,
  });
  const ms = Math.round(performance.now() - t0);
  const body = await res.text().catch(() => "");
  const ok = expect.includes(res.status);
  console.log(
    JSON.stringify({
      name,
      path,
      status: res.status,
      ms,
      ok,
      sample: body.slice(0, 120),
    }),
  );
  if (!ok) {
    throw new Error(`${name}: expected ${expect.join("|")}, got ${res.status}`);
  }
  return { status: res.status, ms, body };
}

async function main() {
  const results = [];
  results.push(await check("login", "/login", { expect: [200] }));
  results.push(await check("health", "/api/health", { expect: [200] }));
  results.push(
    await check("sessions_unauth", "/api/sessions", {
      method: "POST",
      expect: [401],
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );

  const health = JSON.parse(results[1].body);
  if (!health.ok || health.service !== "vpsych") {
    throw new Error("health payload invalid");
  }

  console.log(
    JSON.stringify({
      ok: true,
      base: BASE,
      healthMs: results[1].ms,
      loginMs: results[0].ms,
    }),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
