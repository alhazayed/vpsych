/**
 * Sealed skill test case data.
 *
 * A skill test is an exam: the trainee must work the case out. Every row a
 * trainee can read (their assignment through `my_skill_tests()`, their own
 * test sessions) carries the supervisor's spec and the pinned case only as
 * AES-256-GCM ciphertext. The server opens it with a key derived from a
 * secret the browser never holds: REPORT_WRITE_KEY, or the Supabase service
 * role key when REPORT_WRITE_KEY is unset. Session end already needs one of
 * the two, so skill tests add no new configuration.
 *
 * Each blob is bound to its assignment and kind ("spec" or "case") through
 * the GCM additional data, so a blob copied onto another assignment, or a
 * spec passed off as a case, fails to open.
 */

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "crypto";

export type SealKind = "spec" | "case";

const VERSION = "v1";
const SALT = "vpsych-skill-test-seal";
const IV_BYTES = 12;

type SecretTag = "r" | "s";

function secretFor(tag: SecretTag): string | null {
  const raw =
    tag === "r"
      ? process.env.REPORT_WRITE_KEY
      : process.env.SUPABASE_SERVICE_ROLE_KEY;
  const value = raw?.trim() ?? "";
  return value || null;
}

/** The secret new blobs are sealed with: REPORT_WRITE_KEY first. */
function activeTag(): SecretTag | null {
  if (secretFor("r")) return "r";
  if (secretFor("s")) return "s";
  return null;
}

function keyFor(tag: SecretTag): Buffer | null {
  const secret = secretFor(tag);
  if (!secret) return null;
  return Buffer.from(
    hkdfSync("sha256", secret, SALT, `${VERSION}:${tag}`, 32),
  );
}

function aad(kind: SealKind, assignmentId: string): Buffer {
  return Buffer.from(`${VERSION}:${kind}:${assignmentId}`, "utf8");
}

/** True when the server can seal and open skill test data. */
export function canSealSkillTests(): boolean {
  return activeTag() !== null;
}

/**
 * Seal a JSON value for one assignment. Returns null when no server secret is
 * configured; callers turn that into a clear "skill tests unavailable" error.
 */
export function sealSkillTestValue(
  kind: SealKind,
  assignmentId: string,
  value: unknown,
): string | null {
  const tag = activeTag();
  const key = tag ? keyFor(tag) : null;
  if (!tag || !key) return null;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(kind, assignmentId));
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    tag,
    iv.toString("base64url"),
    body.toString("base64url"),
    authTag.toString("base64url"),
  ].join(".");
}

/**
 * Open a sealed value. Returns null when the blob is missing, malformed,
 * bound to another assignment or kind, or sealed with a secret this server
 * does not have.
 */
export function openSkillTestValue<T>(
  kind: SealKind,
  assignmentId: string,
  blob: string | null | undefined,
): T | null {
  if (!blob || typeof blob !== "string") return null;
  const parts = blob.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION) return null;
  const tag = parts[1];
  if (tag !== "r" && tag !== "s") return null;
  const key = keyFor(tag);
  if (!key) return null;
  try {
    const iv = Buffer.from(parts[2]!, "base64url");
    const body = Buffer.from(parts[3]!, "base64url");
    const authTag = Buffer.from(parts[4]!, "base64url");
    if (iv.length !== IV_BYTES || authTag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(aad(kind, assignmentId));
    decipher.setAuthTag(authTag);
    const json = Buffer.concat([
      decipher.update(body),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
