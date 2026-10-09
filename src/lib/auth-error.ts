/**
 * Maps a Supabase Auth error to a localized message key under `auth.errors`.
 * Supabase returns English messages ("Invalid login credentials"), so the
 * learner-facing copy is chosen from the stable error `code` / HTTP status
 * instead of echoing the provider text.
 */
export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "alreadyRegistered"
  | "weakPassword"
  | "invalidEmail"
  | "signupDisabled"
  | "rateLimited"
  | "failed";

export function authErrorKey(
  error: { code?: string | null; status?: number | null } | null | undefined,
): AuthErrorKey {
  switch (error?.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "alreadyRegistered";
    case "weak_password":
      return "weakPassword";
    case "email_address_invalid":
    case "validation_failed":
      return "invalidEmail";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signupDisabled";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rateLimited";
  }
  if (error?.status === 429) return "rateLimited";
  // Older GoTrue versions return 400 without a code for bad credentials.
  if (error?.status === 400 && !error.code) return "invalidCredentials";
  return "failed";
}
