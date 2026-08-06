// Supabase Auth "Send Email" hook.
//
// When enabled (Dashboard → Authentication → Hooks → Send Email), Supabase Auth
// calls this function instead of using its built-in mailer. We render the email
// and send it through Resend's REST API.
//
// Required secrets (Dashboard → Edge Functions → Manage secrets):
//   RESEND_API_KEY          — a Resend API key with send permission
//   SEND_EMAIL_HOOK_SECRET  — the signing secret generated when you create the
//                             hook (looks like `v1,whsec_...`)
//   AUTH_EMAIL_FROM         — verified sender, e.g. `vpsych <no-reply@yourdomain>`
// Optional:
//   APP_URL                 — canonical app origin for confirm links
//                             (default https://vpsych.vercel.app). Prefer this
//                             over GoTrue /auth/v1/verify redirects so a
//                             misconfigured Auth Site URL cannot send users to
//                             http://localhost:3000 (blank page).
// SUPABASE_URL is injected automatically by the platform.
//
// Deployed with verify_jwt = false: the request is authenticated by the
// Standard Webhooks signature, not a Supabase JWT.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
};

type HookPayload = {
  user: { email: string };
  email_data: EmailData;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const EMAIL_FROM =
  Deno.env.get("AUTH_EMAIL_FROM") ?? "vpsych <no-reply@example.com>";
const DEFAULT_APP_URL = "https://vpsych.vercel.app";

// Copy per auth action. `signup` covers new-account confirmation.
const COPY: Record<
  string,
  { subject: string; heading: string; intro: string; cta: string }
> = {
  signup: {
    subject: "Confirm your vpsych account",
    heading: "Confirm your email",
    intro:
      "Welcome to vpsych. Confirm your email address to activate your therapist account and start practicing.",
    cta: "Confirm email",
  },
  invite: {
    subject: "You've been invited to vpsych",
    heading: "Accept your invitation",
    intro: "You've been invited to vpsych. Accept the invitation to get started.",
    cta: "Accept invitation",
  },
  magiclink: {
    subject: "Your vpsych sign-in link",
    heading: "Sign in to vpsych",
    intro: "Use the button below to sign in. This link can only be used once.",
    cta: "Sign in",
  },
  recovery: {
    subject: "Reset your vpsych password",
    heading: "Reset your password",
    intro:
      "We received a request to reset your password. If this wasn't you, you can safely ignore this email.",
    cta: "Reset password",
  },
  email_change: {
    subject: "Confirm your new vpsych email",
    heading: "Confirm your new email",
    intro: "Confirm this address to finish updating your vpsych email.",
    cta: "Confirm email",
  },
};

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "0.0.0.0"
  );
}

/**
 * Resolve the public app origin for confirm links.
 * Never return a loopback origin — that is what produced blank pages when
 * Auth Site URL was left at http://localhost:3000.
 */
function appOrigin(data: EmailData): string {
  const configured = (Deno.env.get("APP_URL") ?? "").trim().replace(/\/$/, "");
  if (configured) {
    try {
      const u = new URL(configured);
      if (!isLoopbackHost(u.hostname)) return u.origin;
    } catch {
      // fall through
    }
  }

  for (const candidate of [data.redirect_to, data.site_url]) {
    try {
      const u = new URL(candidate);
      if (!isLoopbackHost(u.hostname)) return u.origin;
    } catch {
      // try next
    }
  }

  return DEFAULT_APP_URL;
}

function nextPathForAction(action: string): string {
  if (action === "recovery") return "/auth/reset-password";
  if (action === "magiclink") return "/avatars";
  return "/avatars";
}

/**
 * App-hosted confirm URL. The browser hits vpsych directly with token_hash;
 * /auth/confirm calls verifyOtp — no GoTrue redirect allow-list involved.
 */
function confirmUrl(data: EmailData): string {
  const params = new URLSearchParams({
    token_hash: data.token_hash,
    type: data.email_action_type,
    next: nextPathForAction(data.email_action_type),
  });
  return `${appOrigin(data)}/auth/confirm?${params.toString()}`;
}

function renderHtml(
  copy: { heading: string; intro: string; cta: string },
  url: string,
  otp: string,
): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f3efe6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2a29;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fffdf8;border:1px solid #d5ddd6;border-radius:16px;padding:32px;">
            <tr><td style="font-size:20px;font-weight:700;letter-spacing:-0.02em;">vpsych</td></tr>
            <tr><td style="padding-top:20px;font-size:22px;font-weight:600;">${copy.heading}</td></tr>
            <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#5f6f6c;">${copy.intro}</td></tr>
            <tr>
              <td style="padding-top:24px;">
                <a href="${url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 24px;border-radius:9999px;">${copy.cta}</a>
              </td>
            </tr>
            <tr><td style="padding-top:20px;font-size:13px;line-height:1.6;color:#5f6f6c;">Or enter this code: <strong style="font-family:monospace;letter-spacing:2px;">${otp}</strong></td></tr>
            <tr><td style="padding-top:24px;font-size:12px;line-height:1.6;color:#8a978f;">If you didn't request this email, you can safely ignore it.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!RESEND_API_KEY || !HOOK_SECRET) {
    return json({ error: "Email hook is not configured" }, 500);
  }

  const raw = await req.text();
  const headers = Object.fromEntries(req.headers);

  let payload: HookPayload;
  try {
    // The Supabase-generated secret is prefixed with `v1,`; standardwebhooks
    // expects the `whsec_...` portion.
    const wh = new Webhook(HOOK_SECRET.replace(/^v1,/, ""));
    payload = wh.verify(raw, headers) as HookPayload;
  } catch (err) {
    console.error("Signature verification failed", err);
    return json({ error: "Invalid signature" }, 401);
  }

  const { user, email_data } = payload;
  const copy = COPY[email_data.email_action_type] ?? COPY.signup;
  const url = confirmUrl(email_data);
  const html = renderHtml(copy, url, email_data.token);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [user.email],
      subject: copy.subject,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend send failed", res.status, detail);
    // Signal a retriable error back to Supabase Auth.
    return json({ error: "Failed to send email", detail }, 502);
  }

  return json({}, 200);
});
