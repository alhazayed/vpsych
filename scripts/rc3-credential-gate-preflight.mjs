#!/usr/bin/env node
/**
 * RC3 credential-gate preflight (RDL-009 / standing recommendation).
 *
 * Detects the three injection failure modes that previously burned full agent
 * cycles: missing vars (RDL-006), placeholders (RDL-007), swapped emails
 * (RDL-008) — then proves password-grant for both accounts (Phase 3a).
 *
 * Usage:
 *   node scripts/rc3-credential-gate-preflight.mjs
 *
 * Requires env:
 *   VPSYCH_AUDIT_THERAPIST_EMAIL
 *   VPSYCH_AUDIT_THERAPIST_PASSWORD
 *   VPSYCH_AUDIT_ADMIN_EMAIL
 *   VPSYCH_AUDIT_ADMIN_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL   (or SUPABASE_URL)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)
 *
 * Exit 0 = gate green for Wave 1 dispatch. Exit 1 = STOP.
 * Never prints password values.
 */

const REQUIRED = [
  "VPSYCH_AUDIT_THERAPIST_EMAIL",
  "VPSYCH_AUDIT_THERAPIST_PASSWORD",
  "VPSYCH_AUDIT_ADMIN_EMAIL",
  "VPSYCH_AUDIT_ADMIN_PASSWORD",
];

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`OK:   ${msg}`);
}

async function passwordGrant(url, anonKey, email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  return {
    status: res.status,
    hasToken: Boolean(body.access_token),
  };
}

async function main() {
  console.log("RC3 credential-gate preflight\n");

  // --- Phase 2: eight checks ---
  for (const key of REQUIRED) {
    const val = process.env[key];
    if (!val) fail(`${key}: MISSING`);
    else ok(`${key}: present`);
  }
  for (const key of REQUIRED) {
    const val = process.env[key];
    if (!val) continue;
    if (val === key) fail(`${key}: PLACEHOLDER (value equals key name)`);
    else ok(`${key}: real value`);
  }

  const tEmail = process.env.VPSYCH_AUDIT_THERAPIST_EMAIL || "";
  const aEmail = process.env.VPSYCH_AUDIT_ADMIN_EMAIL || "";
  if (/^audit\.therapist@/.test(tEmail)) ok("therapist email local part");
  else fail(`therapist email: WRONG/SWAPPED (expected local audit.therapist)`);
  if (/^audit\.admin@/.test(aEmail)) ok("admin email local part");
  else fail(`admin email: WRONG/SWAPPED (expected local audit.admin)`);

  if (process.exitCode === 1) {
    console.error("\nPhase 2 failed — do not dispatch Wave 1.");
    process.exit(1);
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    fail("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
    console.error("\nCannot run Phase 3a without Supabase URL + anon key.");
    process.exit(1);
  }

  // --- Phase 3a ---
  console.log("\nPhase 3a password-grant:");
  const t = await passwordGrant(
    supabaseUrl,
    anonKey,
    tEmail,
    process.env.VPSYCH_AUDIT_THERAPIST_PASSWORD,
  );
  const a = await passwordGrant(
    supabaseUrl,
    anonKey,
    aEmail,
    process.env.VPSYCH_AUDIT_ADMIN_PASSWORD,
  );

  if (t.status === 200 && t.hasToken) ok(`therapist HTTP ${t.status} token=true`);
  else fail(`therapist HTTP ${t.status} token=${t.hasToken}`);

  if (a.status === 200 && a.hasToken) ok(`admin HTTP ${a.status} token=true`);
  else fail(`admin HTTP ${a.status} token=${a.hasToken}`);

  // --- Phase 3b diagonal sanity (optional but cheap) ---
  console.log("\nPhase 3b matrix:");
  const combos = [
    [tEmail, process.env.VPSYCH_AUDIT_THERAPIST_PASSWORD, "THERAPIST", 200],
    [tEmail, process.env.VPSYCH_AUDIT_ADMIN_PASSWORD, "ADMIN", 400],
    [aEmail, process.env.VPSYCH_AUDIT_THERAPIST_PASSWORD, "THERAPIST", 400],
    [aEmail, process.env.VPSYCH_AUDIT_ADMIN_PASSWORD, "ADMIN", 200],
  ];
  for (const [email, pw, label, expected] of combos) {
    const r = await passwordGrant(supabaseUrl, anonKey, email, pw);
    const local = email.split("@")[0];
    if (r.status === expected) {
      ok(`${local} + ${label}_pw -> HTTP ${r.status}`);
    } else {
      fail(`${local} + ${label}_pw -> HTTP ${r.status} (expected ${expected})`);
    }
  }

  if (process.exitCode === 1) {
    console.error("\nPREFLIGHT FAIL — stop certification; open an RDL entry.");
    process.exit(1);
  }
  console.log("\nPREFLIGHT PASS — safe to dispatch a fresh Wave 1 agent.");
}

main().catch((err) => {
  console.error("PREFLIGHT ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
