# VPsych Technical SEO Certification Report

**Mission:** 26 — Technical SEO Certification (Phase 6)  
**Date:** 2026-08-03  
**Roles:** Google Technical SEO · Search Console · Core Web Vitals · International SEO · Accessibility · Enterprise Web Architect  
**Branch:** `cursor/technical-seo-cert-e57e`  
**Audit basis:** Production `https://vpsych.vercel.app` (pre-fix) + local regression on fixed build  

---

## Executive summary

Production audit found **Critical** crawl blockers: `robots.txt` and `sitemap.xml` redirected unauthenticated users to `/login`, unknown URLs soft-404’d via login redirect, and the site lacked canonicals, hreflang, Open Graph/Twitter, JSON-LD, HTML sitemap, manifest icons, and RSS.

Verified remediations were implemented and regression-tested (Vitest, `next build`, Lighthouse, Cursor Browser).

**Overall SEO Score:** **88 / 100**

**Certification outcome:**

⚠ **SEO CERTIFIED WITH RECOMMENDATIONS**

---

## Production audit findings (before fix)

| Issue | Severity | Evidence |
|---|---|---|
| `/robots.txt` → 307 `/login` | Critical | curl production |
| `/sitemap.xml` → 307 `/login` | Critical | curl production |
| Soft 404: unknown paths → login | High | `/not-a-real-page` 307 |
| No canonical / hreflang / OG / Twitter | High | home HTML |
| No Schema.org JSON-LD | High | home HTML |
| No HTML sitemap / RSS / web manifest | Medium | 404/307 |
| Missing apple-touch / PNG icons | Medium | 404 |
| Thin EN/AR meta descriptions | Medium | `messages/*.json` |
| App shell indexable if crawled | Medium | no `noindex` |

---

## Fixes applied

1. **Private-prefix auth middleware** — unknown public URLs return real **404** (not login).  
2. **`/robots.txt`** via `src/app/robots.ts` — allow marketing/auth; disallow `/api/`, `/admin/`, `/avatars`, `/sessions`, `/learning`, `/faculty`.  
3. **XML sitemap index** `/sitemap.xml` + `/sitemaps/marketing.xml` + `/sitemaps/auth.xml` with xhtml hreflang.  
4. **HTML sitemap** `/site-map` with breadcrumb schema.  
5. **Metadata** — `metadataBase`, unique titles/descriptions, canonicals, `hreflang` via `?hl=en|ar`, Open Graph, Twitter Cards, icons, manifest, RSS alternate.  
6. **Schema.org** — Organization, SoftwareApplication, MedicalOrganization (education disclaimer), FAQPage, Article, BreadcrumbList, WebSite.  
7. **RSS** `/rss.xml`, **manifest**, PNG icons (32/192/512 + apple-touch).  
8. **App shell `noindex`**; improved EN/AR meta copy; responsive `sizes` + lazy hero/workflow images; heading hygiene.  
9. **`?hl=` locale** honored in middleware for crawlable bilingual variants.

---

## SEO Certification Report

| Check | Status |
|---|---|
| robots.txt | Pass (local regression) |
| sitemap.xml index | Pass |
| XML child sitemaps | Pass |
| HTML sitemap | Pass |
| Canonical URLs | Pass (per public page) |
| hreflang EN/AR + x-default | Pass (`?hl=`) |
| Arabic SEO (lang/dir + copy) | Pass |
| English SEO | Pass |
| Meta titles / descriptions | Pass (unique per public page) |
| Structured headings | Pass (single H1 landing) |
| Schema.org pack | Pass |
| OpenGraph / Twitter | Pass |
| Favicons / Manifest | Pass |
| RSS | Pass |
| Internal links / footer discovery | Pass |
| Broken links (public) | Pass |
| Real 404 (no soft-404) | Pass |
| Duplicate metadata / canonicals | Pass |
| Orphan public pages | Pass (all in sitemap + HTML map) |
| Indexability / crawlability | Pass (private noindex + robots disallow) |
| Lazy / responsive images | Pass |

---

## Core Web Vitals Report

Lighthouse (local production build, mobile-ish headless):

| Category | Score |
|---:|---:|
| SEO | **100** |
| Accessibility | **96** |
| Performance | **84** |

| Metric | Result | Note |
|---|---|---|
| LCP | ~4.5s | Hero PNG; compress/CDN/AVIF recommended |
| CLS | 0 | Pass |
| TBT | 30ms | Pass |
| FCP | 0.9s | Pass |
| INP | n/a in LH lab | Field data pending Search Console |

---

## Schema Validation

Emitted on `/` (7 graphs): Organization · SoftwareApplication · MedicalOrganization · WebSite · FAQPage · Article · BreadcrumbList.  
Breadcrumb on `/site-map`. Unit tests assert `@type` contracts.

---

## Indexability Report

| Surface | Index |
|---|---|
| `/`, `/login`, `/signup`, `/site-map` | index,follow |
| `/avatars`, `/sessions`, `/learning`, `/admin/*` | noindex + robots disallow |
| `/api/*` | disallow |
| Auth callback | disallow |

---

## Browser regression (Cursor Browser)

Screenshots: `/opt/cursor/artifacts/seo-cert/01-*.webp` … `08-404-page.webp`  
Confirmed: EN landing, AR RTL (`?hl=ar`), login, signup, HTML sitemap, robots.txt text, real 404.

---

## Recommendations (for ✅ SEO CERTIFIED)

1. Deploy this branch to production; re-verify `/robots.txt` + `/sitemap.xml` on `vpsych.vercel.app`.  
2. Compress hero/workflow to AVIF/WebP; target LCP &lt; 2.5s.  
3. Prefer path-based locales (`/en`, `/ar`) for stronger international SEO than `?hl=`.  
4. Submit sitemap in Google Search Console; monitor CWV field data.  
5. Add privacy/terms landing URLs when legal pages ship (M22).  
6. Set production `NEXT_PUBLIC_APP_URL=https://vpsych.vercel.app`.

---

## Score breakdown

| Area | Score |
|---:|
| Crawl / robots / sitemap | 95 |
| Metadata / hreflang / social | 92 |
| Schema.org | 90 |
| Indexability / soft-404 fix | 94 |
| CWV / performance | 78 |
| International (path locales) | 80 |
| **Overall** | **88** |

---

## Conclude

⚠ **SEO CERTIFIED WITH RECOMMENDATIONS**

Critical crawl blockers and missing technical SEO foundations are remediated in-repo with green tests, Lighthouse SEO 100, and browser regression. Full ✅ requires production deploy + LCP optimization + optional path-based locales.

---

## Regression

| Check | Result |
|---|---|
| `npm test` | Pass (incl. SEO suite) |
| `npm run typecheck` | Pass |
| `npm run build` | Pass (`/robots.txt`, `/sitemap.xml`, `/sitemaps/*`, `/rss.xml`, `/site-map`, `/manifest.webmanifest`) |
| Lighthouse SEO | 100 |
