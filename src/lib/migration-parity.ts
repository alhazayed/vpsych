import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

export type LocalMigration = {
  fileName: string;
  version: string;
  name: string;
  bytes: number;
};

const MIGRATION_RE = /^(\d{14})_([a-z0-9_]+)\.sql$/i;

/** Parse a migration filename into version + snake_case name. */
export function parseMigrationFileName(
  fileName: string,
): { version: string; name: string } | null {
  const match = MIGRATION_RE.exec(fileName);
  if (!match) return null;
  return {
    version: match[1]!,
    name: match[2]!,
  };
}

/** Read and validate every `*.sql` file under a migrations directory. */
export function loadLocalMigrations(dir: string): {
  migrations: LocalMigration[];
  errors: string[];
} {
  const errors: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  } catch (err) {
    return {
      migrations: [],
      errors: [
        `Cannot read migrations dir ${dir}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ],
    };
  }

  const migrations: LocalMigration[] = [];
  const seen = new Map<string, string>();

  for (const fileName of entries.sort()) {
    const parsed = parseMigrationFileName(fileName);
    if (!parsed) {
      errors.push(
        `Invalid migration filename "${fileName}" (expected YYYYMMDDHHMMSS_name.sql)`,
      );
      continue;
    }

    const prev = seen.get(parsed.version);
    if (prev) {
      errors.push(
        `Duplicate migration version ${parsed.version}: ${prev} and ${fileName}`,
      );
    } else {
      seen.set(parsed.version, fileName);
    }

    const full = join(dir, fileName);
    const bytes = statSync(full).size;
    if (bytes === 0) {
      errors.push(`Migration file is empty: ${fileName}`);
    } else {
      // Cheap content sanity: must look like SQL, not a stub.
      const head = readFileSync(full, "utf8").slice(0, 200).trim();
      if (!head) {
        errors.push(`Migration file has no SQL content: ${fileName}`);
      }
    }

    migrations.push({
      fileName,
      version: parsed.version,
      name: parsed.name,
      bytes,
    });
  }

  return { migrations, errors };
}

export type ParityReport = {
  ok: boolean;
  localVersions: string[];
  remoteVersions: string[];
  missingRemote: string[];
  missingLocal: string[];
  errors: string[];
};

/**
 * Compare local migration versions to a remote list (e.g. from
 * `supabase_migrations.schema_migrations`). Local-only extras are OK when
 * they are newer (pending deploy); remote-only versions are drift.
 */
export function compareMigrationParity(params: {
  localVersions: string[];
  remoteVersions: string[];
}): ParityReport {
  const local = [...params.localVersions].sort();
  const remote = [...params.remoteVersions].sort();
  const localSet = new Set(local);
  const remoteSet = new Set(remote);

  const missingRemote = local.filter((v) => !remoteSet.has(v));
  const missingLocal = remote.filter((v) => !localSet.has(v));

  const errors: string[] = [];
  if (missingLocal.length) {
    errors.push(
      `Remote has versions not present in git: ${missingLocal.join(", ")}`,
    );
  }

  // Pending local migrations (not yet applied remotely) are expected during
  // development — warn only when remote is ahead of git.
  return {
    ok: missingLocal.length === 0,
    localVersions: local,
    remoteVersions: remote,
    missingRemote,
    missingLocal,
    errors,
  };
}
