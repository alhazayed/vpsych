/**
 * Time budgets for model calls, sized so every fallback in the chain still
 * runs inside the route's `maxDuration`.
 *
 * Before these existed the SDK retried 3 times at 60 s and `withOpenAIRetry`
 * retried on top, so one slow model call could outlast the function and the
 * gateway / persona / heuristic fallbacks never ran.
 *
 * Route `maxDuration` values are literals in each route file (Next requires
 * static exports); `time-budget.test.ts` checks they cover these budgets.
 */

/** One patient-reply model attempt (OpenAI or Gateway). */
export const PATIENT_REPLY_TIMEOUT_MS = 20_000;

/** One speech-to-text attempt (`withOpenAIRetry` makes up to 2). */
export const STT_TIMEOUT_MS = 25_000;

/** `maxDuration` (seconds) the transcribe route declares. */
export const STT_ROUTE_MAX_DURATION_SEC = 60;

/** One examiner model attempt (primary, fallback model, or Gateway). */
export const ASSESSMENT_TIMEOUT_MS = 90_000;

/**
 * Examiner calls are not retried in place: the failover chain (primary →
 * fallback model → Gateway → heuristic) is the retry.
 */
export const ASSESSMENT_RETRY_ATTEMPTS = 1;

/** `maxDuration` (seconds) the message, stream and end routes declare. */
export const SESSION_ROUTE_MAX_DURATION_SEC = 300;
