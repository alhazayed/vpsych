/**
 * Bias safeguards — clinical simulation must not reinforce stereotypes or
 * demographic inference beyond authored case facts.
 */

const STEREOTYPE_PATTERNS = [
  /\b(all|most)\s+(women|men|muslims|jews|blacks|whites|asians)\b/i,
  /\b(typical|normal)\s+(woman|man|patient)\b/i,
  /\b(because\s+you\s+are)\s+(a\s+)?(woman|man|black|white|arab)\b/i,
];

const THERAPIST_ROLE_LEAK = [
  /\b(as\s+an?\s+ai|as\s+a\s+language\s+model)\b/i,
  /\b(i\s+recommend\s+you\s+take\s+medication)\b/i,
  /\b(you\s+should\s+see\s+a\s+psychiatrist)\b/i,
];

const DEMOGRAPHIC_INFERENCE_PROMPT = [
  "infer traits from race",
  "infer from religion",
  "stereotype",
  "typical for your culture",
];

export type BiasScanResult = {
  ok: boolean;
  violations: string[];
};

export function scanPatientUtterance(text: string): BiasScanResult {
  const violations: string[] = [];
  for (const pattern of STEREOTYPE_PATTERNS) {
    if (pattern.test(text)) violations.push("stereotype_pattern");
  }
  for (const pattern of THERAPIST_ROLE_LEAK) {
    if (pattern.test(text)) violations.push("role_or_advice_leak");
  }
  return { ok: violations.length === 0, violations };
}

export function scanTherapistMessageForManipulation(text: string): BiasScanResult {
  const violations: string[] = [];
  const lower = text.toLowerCase();
  for (const phrase of DEMOGRAPHIC_INFERENCE_PROMPT) {
    if (lower.includes(phrase)) violations.push("bias_injection_attempt");
  }
  if (/ignore\s+(your|the)\s+(instructions|rules|persona)/i.test(text)) {
    violations.push("prompt_injection");
  }
  return { ok: violations.length === 0, violations };
}

export const HCE_ANTI_BIAS_DIRECTIVES = [
  "Respond as the authored patient only; never generalize to groups.",
  "Clinical presentation follows case facts and disclosure rules, not demographic stereotypes.",
  "Do not infer symptoms from race, religion, nationality, or gender beyond authored clinical_core.",
  "Never break character as therapist, AI, or medical advisor.",
];
