/**
 * Shared password policy for signup (and future change-password flows).
 * Aligns UI strength meter with submit enforcement.
 */

export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  number: boolean;
  special: boolean;
};

export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function isPasswordPolicySatisfied(password: string): boolean {
  const c = passwordChecks(password);
  return c.length && c.upper && c.number && c.special;
}

export type PasswordStrength = "" | "weak" | "fair" | "good" | "strong";

export function passwordStrengthLevel(password: string): PasswordStrength {
  const checks = passwordChecks(password);
  const score = Object.values(checks).filter(Boolean).length;
  if (!password) return "";
  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score === 3) return "good";
  return "strong";
}
