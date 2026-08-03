# VPsych Public Launch Certification Report

**Mission:** 30 — Public Launch Certification  
**Date:** 2026-08-03  
**Role:** Independent Public Launch Board  
**Branch:** `cursor/public-launch-cert-e57e`  
**Foundation:** Missions 26–29 (SEO / AEO / GEO / Brand) on Phase 6 train · Production `main` still at Mission 03

---

## Executive summary

The Phase 6 feature train has strong marketing, SEO, AEO, GEO, brand, legal, and consent *code*. Production does **not** yet expose that train: `/robots.txt`, `/about`, and `/terms` still soft-redirect (HTTP 307). Analytics IDs are not configured, monitoring is incomplete, and the Mission 25 executive board previously withheld Phase 5 approval.

**Overall Launch Score:** **45 / 100**

**Launch Recommendation:** Do not announce a public launch. Merge and deploy Phase 6 (M26–M29), verify webmaster + GA/Clarity with consent, prove auth email, and add baseline monitoring first.

**Certification outcome:**

❌ **NOT READY**

Machine-readable checklist: `/launch-readiness.json`

---

## Public Launch Checklist

| Area | Status | Notes |
|---|---|---|
| SEO (branch) | Pass | M26 score 88 |
| SEO (production) | **Fail** | robots/about/terms 307 on `vpsych.vercel.app` |
| AEO | Partial | On branch, not production |
| GEO | Partial | On branch, not production |
| Brand / Marketing | Partial | On branch, not production |
| Documentation | Pass | Release notes + cert docs |
| Support | Partial | Help/Contact on branch; inbox ops unconfirmed |
| Legal | Partial | Terms/Privacy on branch; production blocked |
| Analytics (GA4 / Clarity) | Partial | Consent-gated loaders; IDs unset |
| Meta Pixel / LinkedIn | N/A | Optional env-gated loaders |
| Cookie consent gating | Pass | Analytics scripts require consent |
| Email | Partial | Resend hook exists; delivery unproven |
| Domains | Partial | `*.vercel.app` default; custom apex undocumented |
| SSL / HSTS | Pass | Observed on production host |
| Monitoring | **Fail** | No Sentry / public health on this train |
| Performance | Partial | Lighthouse ~84; LCP weak |
| Phase 6 release train | **Fail** | M26–M29 not on `main` |

---

## Marketing Readiness

| Item | Status |
|---|---|
| Landing + pricing CTAs (branch) | Ready |
| Open Graph / Twitter previews | Ready |
| Social ad pixels | Optional scaffolding only |
| Production marketing parity | **Not ready** |

---

## Trust Readiness

| Item | Status |
|---|---|
| Terms / Privacy / Cookie consent (branch) | Ready |
| Help + Contact | Partial (ops inbox) |
| Clinical / research disclaimers | Ready on branch |
| Production legal crawlability | **Not ready** |

---

## Documentation Readiness

| Item | Status |
|---|---|
| `/release-notes` + `docs/RELEASE_NOTES.md` | Pass |
| M26–M30 certification reports | Pass |
| Launch readiness JSON | Pass |
| Runbook for GSC/Bing/GA go-live | Partial (env-documented in `.env.example`) |

---

## Verification & analytics (code readiness)

| Capability | Code | Production config |
|---|---|---|
| Google Search Console meta | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Unset / unverified |
| Bing Webmaster meta | `NEXT_PUBLIC_BING_SITE_VERIFICATION` | Unset / unverified |
| GA4 | Consent-gated `gtag` | ID unset |
| Microsoft Clarity | Consent-gated script | ID unset |
| Meta Pixel | Optional | N/A until campaigns |
| LinkedIn Insight | Optional | N/A until campaigns |

---

## Score breakdown

| Area | Score |
|---:|
| Phase 6 product surfaces (branch) | 86 |
| Production parity | 20 |
| Analytics & verification ops | 40 |
| Trust / legal live | 35 |
| Monitoring & performance ops | 35 |
| Documentation | 90 |
| **Overall Launch Score** | **45** |

---

## Hard blockers

1. Phase 6 (M26–M29) not merged/deployed to production.  
2. Production SEO/legal routes still soft-gated (307).  
3. No public monitoring / error tracking baseline.  
4. GA4 / Clarity / webmaster verification not configured in deploy env.  
5. Auth email delivery and monitored `hello@vpsych.app` not proven for launch day.

---

## Path to ⚠ / ✅

**To ⚠ READY WITH RECOMMENDATIONS (≥75):** merge/deploy M26–M29; confirm robots/sitemap/terms/privacy 200; set GSC+Bing verification; set GA4+Clarity with consent; smoke-test signup/reset email; staff Contact inbox.

**To ✅ READY FOR PUBLIC LAUNCH (≥90):** plus public health/Sentry (or equivalent), CWV field monitoring, attributed social proof, billing for paid plans, and a clean executive re-review superseding M25.

---

## Conclude

❌ **NOT READY**

VPsych is **not** cleared for public launch announcement. The Phase 6 train is close in code; production release-train parity and launch ops remain open.

---

## Regression

| Check | Result |
|---|---|
| Launch unit tests | Pass |
| typecheck / build | Pass |
| Routes | `/release-notes`, `/launch-readiness.json` |
| Production probe (2026-08-03) | robots/about/terms → 307 |
