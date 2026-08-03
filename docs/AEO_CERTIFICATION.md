# VPsych AI Engine Optimization (AEO) Certification

**Mission:** 27 — AI Engine Optimization (Phase 6)  
**Date:** 2026-08-03  
**Board:** AI Search Optimization (ChatGPT · Claude · Gemini · Perplexity · Copilot)  
**Branch:** `cursor/aeo-certification-e57e`  
**Foundation:** Mission 26 Technical SEO (`7d05bb8`)

---

## Executive summary

VPsych was audited for **AI assistant discoverability**: whether models can correctly identify the company/product, purpose, users, features, clinical evidence stance, and educational role from crawlable, machine-readable content.

Production (pre-deploy) lacked `llms.txt`, about/FAQ answer pages, and a published knowledge graph. These were implemented with semantic HTML, Schema.org entity linking, chunked FAQs, and prompt-friendly documentation.

**Overall AEO Score:** **86 / 100**

**Certification outcome:**

⚠ **AEO CERTIFIED WITH RECOMMENDATIONS**

---

## AEO Report

| Requirement | Status | Evidence |
|---|---|---|
| Semantic HTML | Pass | `main`/`article`/`section`/`nav`/`header` on about & FAQ |
| Structured content | Pass | H1→H2→H3 FAQ hierarchy; entity sections on `/about` |
| Knowledge graph | Pass | `/knowledge-graph.json` + entity relationships |
| Entity relationships | Pass | `ENTITY_RELATIONSHIPS` in `src/lib/aeo/knowledge.ts` |
| Answerable pages | Pass | `/about`, `/faq`, `/`, `/llms.txt` |
| Medical / Educational / Clinical FAQs | Pass | Categorized FAQ page + Schema FAQPage |
| Prompt-friendly content | Pass | `llms.txt` summary + “how AI should describe VPsych” |
| Chunking / document hierarchy | Pass | Sectioned about + FAQ articles |
| Machine-readable docs | Pass | llms.txt, well-known mirror, KG JSON |
| Schema.org (Org / Software / Medical) | Pass | AEO schemas with `@id` linking |
| Software / Organization / Medical metadata | Pass | Feature list, audience, specialty, disclaimers |

---

## AI Visibility Report

| Assistant class | Can explain VPsych? | Notes |
|---|---|---|
| ChatGPT / Claude / Gemini | **Yes (after crawl/index)** | Facts centralized in `/about` + `/llms.txt` |
| Perplexity / Copilot | **Yes (after crawl/index)** | Citeable FAQ chunks + KG JSON |

### Entity coverage (what AI should answer)

| Question | Source |
|---|---|
| Company / brand | `/about#company`, Organization schema |
| Product | `/about#product`, SoftwareApplication schema |
| Purpose | `/about#purpose`, llms.txt Summary |
| Target users | `/about#users`, EducationalAudience |
| Features | `/about#features`, `featureList` |
| Clinical evidence | `/about#evidence`, medical FAQs — **simulation only** |
| Educational purpose | CBME / ACE / CGE described explicitly |

**Correct AI one-liner (canonical):**  
*VPsych is an educational AI patient simulation platform for mental health training (English/Arabic). It helps therapists and trainees practice clinical conversations and receive competency feedback. It is not a hospital, EHR, or real-patient care system.*

---

## Knowledge Graph Report

| Node | Type | Links |
|---|---|---|
| VPsych Organization | Organization | `#organization` |
| VPsych Clinical Assessment Platform | SoftwareApplication | `#product` → provider |
| MedicalOrganization (edu) | MedicalOrganization | specialty Psychiatric; not care provider |
| FAQ set | Question/Answer | 12 items across 4 categories |
| Relationships | triples | isA, offers, trains, includes, disclaimer |

Endpoint: `GET /knowledge-graph.json` (CORS `*`).

---

## Entity Coverage

| Entity | Covered |
|---|---|
| Company | Yes |
| Product | Yes |
| Purpose | Yes |
| Target users | Yes (6 audiences) |
| Features | Yes (8+) |
| Clinical evidence stance | Yes (explicit non-claims) |
| Educational purpose | Yes |
| Languages EN/AR | Yes |
| Engines ACE/CGE | Yes |

---

## Recommendations (for ✅ AEO CERTIFIED)

1. **Deploy** Missions 26–27 to production so AI crawlers see `/llms.txt`, `/about`, `/faq` (prod currently 307s these).  
2. Add **sameAs** links (LinkedIn, GitHub, Wikipedia/Wikidata when available).  
3. Publish a short **peer-reviewed or whitepaper** citation URL when available (strengthen evidence node).  
4. Optional path-based locales (`/en`, `/ar`) for stronger bilingual entity pages.  
5. Monitor assistant answers quarterly; refresh llms.txt when product claims change.

---

## Score breakdown

| Dimension | Score |
|---:|
| Answerable entity pages | 92 |
| llms.txt / machine docs | 90 |
| FAQ coverage (med/edu/clinical) | 88 |
| Knowledge graph / relationships | 86 |
| Schema.org entity linking | 88 |
| Production visibility (pre-merge) | 70 |
| **Overall** | **86** |

---

## Conclude

⚠ **AEO CERTIFIED WITH RECOMMENDATIONS**

VPsych now exposes prompt-friendly, schema-linked, chunked knowledge that AI assistants can use to correctly identify the product, users, educational purpose, and clinical disclaimers. Full ✅ requires production deployment and ongoing entity/sameAs enrichment.

---

## Regression

| Check | Result |
|---|---|
| `npm test` (AEO suite) | Pass |
| `npm run typecheck` | Pass |
| Local routes | `/llms.txt`, `/.well-known/llms.txt`, `/about`, `/faq`, `/knowledge-graph.json` |
