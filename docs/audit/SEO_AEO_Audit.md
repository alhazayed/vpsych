# SEO / AEO / Discoverability Audit — Section K (DPI)

**Audit:** VEA-2026-08-05 · Production SHA `5aae138` · Observational only

## Live production checks

| Asset | Status | Evidence |
|---|---|---|
| `/robots.txt` | 200 | Allows `/`, login, signup, privacy, terms; disallows app/api/admin |
| `/sitemap.xml` | 200 | Public URLs; host `vpsych.vercel.app` |
| `/privacy`, `/terms` | 200 | Legal pages public |
| Homepage `<title>` / description | Present | Meta description about preset avatars + admin-only assessments |
| Open Graph / Twitter cards | **Absent** | No `og:` / `twitter:` in HTML |
| JSON-LD | **Absent** | No `application/ld+json` |
| `llms.txt` / AI citation pack | **Absent** | Not found |
| hreflang | **Absent** | Cookie locale, no alternate link tags |

---

## Dimension scores

| Dimension | Score |
|---|---:|
| SEO technical baseline | 62 |
| AEO (AI Engine Optimization) | 32 |
| Accessibility (discoverability overlap) | 55 |
| Structured data | 20 |
| Metadata richness | 45 |
| Search indexing readiness | 60 |
| AI citation readiness | 28 |
| Knowledge Graph readiness | 25 |

---

## Digital Presence Index (DPI)

**DPI = 52 / 100**

Baseline crawlability fixed and live (important post-V1 cert). Marketing/AEO surface remains thin — appropriate for a gated clinical trainer, weak for category leadership visibility.

---

## Findings

| ID | Sev | Finding | Root cause | Impact | Priority |
|---|---|---|---|---|---|
| DPI-H1 | High | No OG/social previews | Metadata incomplete | Poor professional sharing | P2 |
| DPI-H2 | High | No AEO pack (`llms.txt`, FAQ schema) | Deferred backlog | Invisible to AI answer engines | P2 |
| DPI-M1 | Medium | Landing claims conflict with SEO trust | Hardcoded stats | Brand risk if indexed | P0 (trust) |
| DPI-L1 | Low | Cookie locale without hreflang | Architecture choice | Duplicate/locale signals weak | P3 |

---

## Recommendations

| Rec | Impact | Priority |
|---|---|---|
| Fix trust copy before seeking indexation of marketing pages | Integrity | P0 |
| Add `metadataBase` + OG for homepage/legal | Sharing | P2 |
| Publish accurate `llms.txt` describing training-sim limits | AEO honesty | P2 |
| Do **not** index authenticated learning content | Privacy | Keep disallow |
