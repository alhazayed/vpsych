#!/usr/bin/env node
/**
 * Verify supabase/migrations structural integrity and optional remote parity.
 *
 * Always:
 *   - filenames match YYYYMMDDHHMMSS_name.sql
 *   - versions are unique
 *   - files are non-empty
 *
 * Remote parity (fails if remote has versions not in git):
 *   - When SUPABASE_DB_URL is set: query schema_migrations live.
 *   - Else: compare against scripts/remote-schema-migrations.snapshot.json
 *     (set VERIFY_REMOTE_SNAPSHOT=0 to skip).
 *
 * Exit 0 on success, 1 on failure.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Inline the structural rules so CI can run without a TS build step.
// Unit tests in src/lib/migration-parity.test.ts cover the TypeScript module.

const MIGRATION_RE = /^(\d{14})_([a-z0-9_]+)\.sql$/i;

function loadLocal(dir) {
  const errors = [];
  const migrations = [];
  const seen = new Map();
  const entries = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const fileName of entries) {
    const match = MIGRATION_RE.exec(fileName);
    if (!match) {
      errors.push(`Invalid migration filename "${fileName}"`);
      continue;
    }
    const version = match[1];
    const name = match[2];
    if (seen.has(version)) {
      errors.push(`Duplicate version ${version}: ${seen.get(version)} and ${fileName}`);
    } else {
      seen.set(version, fileName);
    }
    const full = join(dir, fileName);
    const bytes = statSync(full).size;
    if (bytes === 0 || !readFileSync(full, "utf8").trim()) {
      errors.push(`Empty migration: ${fileName}`);
    }
    migrations.push({ fileName, version, name, bytes });
  }
  return { migrations, errors };
}

async function fetchRemoteVersions(dbUrl) {
  // Optional dependency — only required for remote checks.
  let pg;
  try {
    pg = await import("pg");
  } catch {
    throw new Error(
      "Remote parity requested (SUPABASE_DB_URL set) but `pg` is not installed. " +
        "Omit SUPABASE_DB_URL for local-only checks, or `npm i -D pg`.",
    );
  }
  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows } = await client.query(
      "select version from supabase_migrations.schema_migrations order by version",
    );
    return rows.map((r) => String(r.version));
  } finally {
    await client.end();
  }
}

function compare(localVersions, remoteVersions) {
  const localSet = new Set(localVersions);
  const missingLocal = remoteVersions.filter((v) => !localSet.has(v));
  const remoteSet = new Set(remoteVersions);
  const missingRemote = localVersions.filter((v) => !remoteSet.has(v));
  return { missingLocal, missingRemote, ok: missingLocal.length === 0 };
}

async function main() {
  const dir = join(root, "supabase/migrations");
  const { migrations, errors } = loadLocal(dir);

  console.log(`Local migrations: ${migrations.length}`);
  for (const m of migrations) {
    console.log(`  ${m.version}  ${m.name}`);
  }

  if (errors.length) {
    console.error("\nStructural errors:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const localVersions = migrations.map((m) => m.version);
  let remote = null;
  let remoteSource = null;

  const dbUrl = process.env.SUPABASE_DB_URL?.trim();
  if (dbUrl) {
    console.log("\nComparing to remote supabase_migrations.schema_migrations …");
    remote = await fetchRemoteVersions(dbUrl);
    remoteSource = "SUPABASE_DB_URL";
  } else if (process.env.VERIFY_REMOTE_SNAPSHOT !== "0") {
    // Offline gate: compare against the checked-in production export.
    // Refresh scripts/remote-schema-migrations.snapshot.json after applying
    // new migrations to production (MCP list_migrations or schema_migrations).
    const snapshotPath = join(root, "scripts/remote-schema-migrations.snapshot.json");
    try {
      const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));
      remote = (snap.migrations ?? []).map((m) => String(m.version));
      remoteSource = `snapshot ${snap.capturedAt ?? ""} (${snap.project ?? ""})`.trim();
      console.log(`\nComparing to checked-in remote snapshot (${remoteSource}) …`);
    } catch (err) {
      console.log(
        "\nSkipping remote parity (SUPABASE_DB_URL unset; snapshot unreadable).",
      );
      console.log(err instanceof Error ? err.message : String(err));
      process.exit(0);
    }
  } else {
    console.log("\nSkipping remote parity (SUPABASE_DB_URL unset; snapshot disabled).");
    process.exit(0);
  }

  const { ok, missingLocal, missingRemote } = compare(localVersions, remote);

  if (missingRemote.length) {
    console.log(
      `Pending local (not yet on remote): ${missingRemote.join(", ") || "(none)"}`,
    );
  }
  if (missingLocal.length) {
    console.error(
      `Remote-only (missing from git): ${missingLocal.join(", ")}`,
    );
  }

  if (!ok) {
    console.error("\nMigration parity FAILED — remote is ahead of git.");
    process.exit(1);
  }

  console.log(`Migration parity OK (source: ${remoteSource}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
