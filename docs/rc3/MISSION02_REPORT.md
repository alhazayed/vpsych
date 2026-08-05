# RC3 Wave 1 — Mission 02: Authentication / Authorization

**Verdict: PASS**  
**Evidence ID:** `RC3-W1-EV-20260805T1305Z`  
**Environment:** https://vpsych.vercel.app · Supabase `rrzudbkxigeavfdnidnm`  
**Preflight:** `scripts/rc3-credential-gate-preflight.mjs` **PASS** (Vault-injected session)

## Credential gate (binding)

| Check | Result |
|---|---|
| Vault passwords match Auth bcrypt | PASS (both accounts) |
| Therapist email local `audit.therapist` | PASS (after Vault inject) |
| Admin email local `audit.admin` | PASS (after Vault inject) |
| Password-grant diagonal matrix | PASS `200/400/400/200` |
| Browser therapist login → `/avatars` role THERAPIST | PASS |
| Browser admin login → `/avatars` role CLINICAL SUPERVISOR / ADMINISTRATOR | PASS |

**Note:** Persistent Cursor secrets at agent boot were still email-swapped + stale passwords (lengths 21/17 vs Vault 29/29). Session corrected from Vault before Missions. Release Manager must still update persistent Cursor env secrets.

## Authorization matrix

| Check | Therapist | Admin | Anon |
|---|---|---|---|
| `/api/health/openai` | **403** | **200** | **401** |
| `/api/admin/disorders` | **403** | **200** | **401** |
| `/admin` UI | denied / not in therapist nav | **200** reachable | **307** login |
| Bearer-only (no SSR cookie) | 401 | 401 | — |
| `session_reports` REST SELECT | `[]` (RLS) | rows visible | 401 permission denied |
| Roles from `profiles.role` | `therapist` | `admin` | — |

## Public / anon

| Check | Result |
|---|---|
| Protected app routes | 307 → `/login?next=…` |
| Anon API JSON 401 | `/api/sessions`, `/api/admin/*`, `/api/voice/*`, `/api/health/openai` |
| Locale cookie | `Secure; SameSite=lax` |
| Demo accounts | remain banned (not used) |

## Defects

None open for Mission 02.

## Sign-off

Mission 02 **PASS**.
