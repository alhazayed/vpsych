/**
 * Voice QA instrumentation gate.
 *
 * This tooling holds raw clinical speech and raw patient audio in browser
 * memory. It exists so a human can evaluate Arabic pronunciation, prosody, and
 * latency against the audio the application actually produced — nothing here
 * is a product surface, and none of it may be on in production.
 *
 * Off unless `NEXT_PUBLIC_VOICE_QA` is explicitly "true". Read through this
 * function everywhere so there is exactly one place to audit, and so the
 * guardrail suite can assert the gate is never bypassed.
 *
 * The value is fixed by the build environment: Turbopack compiles this to a
 * lookup on a client env object populated at build time, so a deployment built
 * without the variable has no truthy value to find. It is a build-time
 * decision, not a runtime toggle — but note it is compiled as a lookup rather
 * than literally inlined, so do not rely on dead-code elimination to remove
 * whatever sits behind the gate. The caller lazy-loads the panel for that.
 */
export function isVoiceQaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VOICE_QA?.trim().toLowerCase() === "true";
}
