/**
 * Optional envelope encryption for reviewer free-text.
 * When CQI_ENCRYPTION_KEY / REPORT_WRITE_KEY is unset, plaintext is stored
 * and protected by RLS only (documented limitation).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export type EncBlob = {
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
};

function keyBytes(): Buffer | null {
  const raw =
    process.env.CQI_ENCRYPTION_KEY?.trim() ||
    process.env.REPORT_WRITE_KEY?.trim() ||
    "";
  if (!raw || raw.length < 16) return null;
  return createHash("sha256").update(raw).digest();
}

export function encryptionEnabled(): boolean {
  return keyBytes() != null;
}

export function encryptText(plain: string): {
  free_text: string;
  free_text_enc: EncBlob | null;
} {
  const key = keyBytes();
  if (!key || !plain) {
    return { free_text: plain, free_text_enc: null };
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    free_text: "[encrypted]",
    free_text_enc: {
      alg: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: enc.toString("base64"),
    },
  };
}

export function decryptText(
  free_text: string,
  enc: EncBlob | null | undefined,
): string {
  if (!enc || enc.alg !== "aes-256-gcm") return free_text;
  const key = keyBytes();
  if (!key) return free_text;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(enc.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
    const out = Buffer.concat([
      decipher.update(Buffer.from(enc.ciphertext, "base64")),
      decipher.final(),
    ]);
    return out.toString("utf8");
  } catch {
    return free_text;
  }
}
