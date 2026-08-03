# VPsych Performance Certification — Mission 11

**Date:** 2026-08-03  
**Branch:** `cursor/performance-certification-8acf`  
**Roles:** Chief Performance Engineer / Cloud Architect / Frontend & Backend Perf / DB / SRE

---

## Performance Score

| Domain | Score (0–100) | Notes |
|---|---|---|
| Core Web Vitals (login mobile) | 78 → **86** | LCP 5.9s → 4.2s; CLS 0; FCP 0.9s |
| Frontend resources | **88** | Logo 1.1MB→5KB webp; icon font off login; EN skips Arabic font |
| Backend / API hot path | **84** | Message history capped; slim select |
| Database | **90** | FK indexes + RLS initplan on hot tables |
| AI latency | **70** | p50 ~2.7s turn (non-streaming remains) |
| Voice | **78** | Lead-in TTS split; remaining GPT wait |
| App workflows | **82** | Pagination; dynamic VoiceSession |
| **Overall** | **83** | |

### Verdict

**⚠ PERFORMANCE CERTIFIED WITH RECOMMENDATIONS**

---

## Performance Dashboard (measured)

### Core Web Vitals — `/login` (Lighthouse mobile, Slow 4G)

| Metric | Production baseline | After fixes (local build) |
|---|---|---|
| Performance score | 0.78 | **0.86** |
| FCP | 1.0s | **0.9s** |
| LCP | **5.9s** (Critical) | **4.2s** |
| CLS | 0 | 0 |
| TBT | 60ms | 30–40ms |
| TTI | 5.9s | 4.4s |
| Total byte weight | ~1003 KiB | **~609 KiB** |
| Material Symbols on login | 431 KB TTF | **0** (removed from path) |

Artifacts: `/opt/cursor/artifacts/perf-cert/lighthouse/`

### Production TTFB (HTML, share-authenticated)

| Path | TTFB (avg of 3) |
|---|---|
| `/` | ~140ms |
| `/login` | ~120ms |
| `/avatars` (redirect) | ~80ms |

### AI turn latency (prior live corpus, working preview)

| | |
|---|---|
| Samples | 40 message turns |
| p50 | **2732ms** |
| p95 | **6568ms** |
| avg | **3148ms** |

### Database advisors (pre-fix)

| Advisor | Count |
|---|---|
| `auth_rls_initplan` | 61 WARN |
| `unindexed_foreign_keys` | 29 WARN |
| `unused_index` | 34 INFO |
| `multiple_permissive_policies` | 43 WARN |

Hot-path FKs indexed + Case Engine / ACE / CGE RLS rewritten with `(select auth.uid())`.

---

## Latency Report

| Surface | Finding | Severity |
|---|---|---|
| Login LCP | Blocked by `font-display:block` icon font + 1.1MB logo | Critical → Fixed |
| `/api/sessions/:id/message` | Full transcript fetch every turn | Critical → Fixed (limit 40) |
| Voice TTS | Full-reply synthesize before first audio | High → Lead-in split |
| Patient GPT | Non-streaming `generateText` | High → Recommendation |
| Session end assessment | Full transcript + sequential ACE | Medium → Recommendation |
| Sessions / admin reports lists | Unbounded | High → Fixed (50 / 100) |

---

## Resource Usage

| Asset | Before | After |
|---|---|---|
| `vpsych-logo.png` | 1143 KB | **20 KB** (+ 5 KB webp) |
| Material Symbols | 940 KB TTF global | **258 KB woff2 subset**, auth-only |
| Montserrat weights | 500–800 | **600–700** |
| Noto Arabic on EN | Always | **Locale-gated** |

---

## Applied Fixes

1. **Icon font off login LCP path** — moved to `src/styles/material-symbols.css`; imported by AppShell/signup only; `font-display: optional`; woff2 subset of used glyphs.
2. **Logo compression** — 1024 PNG → 256 webp/png; `unoptimized` webp on chrome logos.
3. **Message hot path** — slim session select; newest-40 history page; `takeRecentMessages` helper.
4. **Voice lead-in TTS** — first sentence synthesizes/plays while remainder prefetches.
5. **`dynamic()` VoiceSession** — code-split session client bundle.
6. **List pagination** — sessions ≤50, admin reports ≤100.
7. **`next.config`** — `optimizePackageImports`, image `avif/webp` formats.
8. **DB migration** `20260803150000_performance_indexes_and_rls_initplan.sql` — covering FK indexes + RLS initplan (applied to Supabase).
9. **Locale-gated Arabic font variable** on root layout.

---

## Optimization Report / Remaining Recommendations

| Item | Priority | Rationale |
|---|---|---|
| Stream patient replies (`streamText` / SSE) | High | AI p50 ~2.7s dominates conversation UX |
| Further reduce Montserrat (subset / system fallback on auth) | Medium | Still ~163KB on login LCP path under Slow 4G |
| Parallelize session-end ACE/report work | Medium | Shorten “ending session” wait |
| Cache assembled system prompts per session | Medium | CPU/token on every turn |
| Remaining RLS initplan / permissive policy advisors | Low | Non-hot tables still WARN |

---

## Regression

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (pre-existing warnings only) |
| `npm run typecheck` | Pass |
| `npm test` | **173** passed |
| `npm run build` | Pass |

---

## Conclusion

**⚠ PERFORMANCE CERTIFIED WITH RECOMMENDATIONS**
