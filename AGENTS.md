<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single Next.js 16 (App Router) + Supabase app (`vpsych`). Commands live in `package.json`: `npm run dev` (port 3000), `npm run build`, `npm run lint`. Dependencies install with `npm install` (the startup update script). The `middleware`-deprecation warning at boot is benign.

### Required env vars (app won't reach Supabase without them)
The app reads env from process env and `.env.local` (gitignored). It needs the hosted Supabase project (`vpsych`, ref `rrzudbkxigeavfdnidnm`) — the schema and preset avatars are applied remotely, so there are no local SQL migrations to run. If `.env.local` is missing, create it with:

```
NEXT_PUBLIC_SUPABASE_URL=https://rrzudbkxigeavfdnidnm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>
```

The anon key is a publishable (RLS-protected) key; fetch the current value from the Supabase MCP (`get_publishable_keys` for project `rrzudbkxigeavfdnidnm`) if you don't have it. Nothing crashes at import/build time when these are absent — failures surface at request time (auth/DB calls).

### AI and voice are optional (graceful fallbacks)
- No `AI_GATEWAY_API_KEY` (or `OPENAI_API_KEY`) → patient replies and the post-session assessment use built-in heuristic fallbacks (no crash). `AI_MODEL` defaults to `openai/gpt-4o-mini`.
- Voice uses the browser Web Speech API (won't work headless). The live-session page has a text input ("Type a turn…") to drive a session without a mic — use it for automated testing.
- `/api/voice/transcribe` (Deepgram) returns 501 without `DEEPGRAM_API_KEY`; not needed since input defaults to the browser.

### Auth / roles gotchas
- Supabase Auth has email confirmation ON: signup does NOT auto-login (no session returned) and there's an email send rate limit; `example.com` addresses are rejected. To get a usable login in the cloud, create the user then confirm it via the Supabase MCP (`update auth.users set email_confirmed_at = now() where email = '...'`), then sign in at `/login`.
- New accounts are `therapist`. Promote to admin in SQL: `update public.profiles set role='admin' where id='<uuid>'`. Session reports are admin-only (RLS + `create_session_report` security-definer RPC); therapists cannot read them.
