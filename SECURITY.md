# Security

## Reporting a vulnerability

Email the repository owner (`alhazayed`) with:

- Affected URL / API route
- Reproduction steps
- Impact assessment (data exposure, privilege escalation, etc.)

Do **not** open a public GitHub issue for sensitive findings.

## Operational security baseline

- Prefer `REPORT_WRITE_KEY` over long-lived `SUPABASE_SERVICE_ROLE_KEY` for report writes.
- Keep `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, and Upstash tokens in Vercel/Supabase secret stores only.
- Preview deployments are protected with Vercel Authentication (SSO).
- Production liveness: `GET /api/health` (no secrets, no upstream I/O).
- CI runs `npm audit --audit-level=high` on every PR.

## Secret rotation (runbook)

1. Rotate the provider key (OpenAI / ElevenLabs / Upstash / Supabase).
2. Update Vercel Production + Preview environment variables.
3. Redeploy production (`vercel promote` or empty commit on `main`).
4. Smoke: `SMOKE_BASE_URL=https://vpsych.vercel.app npm run test:smoke`.
5. Invalidate old keys at the provider.
