import { createHash, randomBytes } from "node:crypto";

/** Generate invite token (return plaintext once) + store only hash. */
export function mintInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashInvitationToken(token);
  return { token, tokenHash };
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(`cvp-invite:${token}`).digest("hex");
}

export function invitationExpiresAt(days = 21): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
