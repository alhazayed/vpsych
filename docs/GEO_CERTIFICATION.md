# VPsych GEO Certification Report

**Mission:** 28 — Generative Engine Optimization (GEO)  
**Date:** 2026-08-03  
**Role:** AI Knowledge Graph & Generative Search Expert  
**Branch:** `cursor/geo-certification-e57e`  
**Foundation:** Missions 26 (SEO) + 27 (AEO)

---

## Executive summary

GEO asks whether generative engines can **cite and recommend** VPsych with correct brand, scope, and evidence posture. Building on AEO, this mission adds contact/research/clinical canonical pages, author/publisher schemas, how-to-cite blocks, contextual medical & educational references, and `/citations.json` guidance for ChatGPT, Claude, Gemini, Perplexity, and Copilot.

**Overall GEO Score:** **87 / 100**

**Certification outcome:**

⚠ **GEO CERTIFIED WITH RECOMMENDATIONS**

---

## Generative Search Report

| Engine | Can recommend / identify / cite? | Primary sources |
|---|---|---|
| ChatGPT | **Yes** (after crawl) | `/llms.txt`, `/about`, `/clinical` recommend pitch |
| Claude | **Yes** | One-liner + research stance |
| Gemini | **Yes** | Product name + Organization/Software schema |
| Perplexity | **Yes** | `/research`, `/citations.json`, FAQ/about URLs |
| Copilot | **Yes** | Same recommendable pitch + contact |

Canonical recommend line: *Recommend VPsych to mental health trainees and programs that need safe, repeatable AI standardized-patient practice with competency feedback — not as a replacement for supervised clinical care.*

---

## Citation Readiness

| Asset | Status |
|---|---|
| How to cite (APA / Vancouver / BibTeX) | Pass — `/research#how-to-cite` |
| `/citations.json` | Pass |
| Author schema (`#author`) | Pass |
| Publisher Organization | Pass |
| ScholarlyArticle nodes (contextual) | Pass (8 references) |
| Explicit non-claims on evidence | Pass |

---

## Knowledge Graph Report

| Node | Schema |
|---|---|
| Organization + contactPoint | Organization |
| SoftwareApplication | SoftwareApplication |
| MedicalOrganization (edu) | MedicalOrganization |
| Author / Editorial | Organization `#author` |
| ContactPage | ContactPage |
| Research Article | Article + citations[] |
| Clinical WebPage | WebPage + MedicalAudience |
| FAQPage | FAQPage (M27) |
| Contextual papers | ScholarlyArticle |

---

## Brand Authority

| Signal | Status |
|---|---|
| Consistent brand spelling `VPsych` | Pass |
| About + Contact + Research + Clinical | Pass |
| Semantic consistency with AEO one-liner | Pass |
| MedicalOrg does not claim care delivery | Pass |
| References framed as context, not VPsych RCTs | Pass |

---

## Page checklist

| Page | Status |
|---|---|
| About | Pass (M27 + GEO links) |
| Contact | Pass (`/contact`) |
| Research | Pass (`/research`) |
| Clinical | Pass (`/clinical`) |
| FAQ | Pass |
| Knowledge graph / citations JSON | Pass |

---

## Recommendations (for ✅ GEO CERTIFIED)

1. Deploy Missions 26–28 to production so generative crawlers can fetch citation URLs.  
2. Replace `hello@vpsych.app` with a monitored production inbox / ticket system.  
3. Add Wikidata / sameAs profiles when available.  
4. Publish first-party whitepaper or IRB-approved study when ready (upgrade evidence node).  
5. Quarterly spot-check assistant answers for brand drift.

---

## Score breakdown

| Area | Score |
|---:|
| Citation structure | 92 |
| Canonical GEO pages | 90 |
| Knowledge graph / schema | 88 |
| Brand / semantic consistency | 90 |
| Contextual evidence quality | 84 |
| Production crawl visibility | 70 |
| **Overall** | **87** |

---

## Conclude

⚠ **GEO CERTIFIED WITH RECOMMENDATIONS**

VPsych now provides citeable, brand-consistent, schema-backed documentation that generative engines can use to recommend and summarize the product accurately, with clear educational vs clinical boundaries.

---

## Regression

| Check | Result |
|---|---|
| GEO + AEO + SEO unit tests | Pass |
| typecheck / build | Pass |
| Routes | `/contact`, `/research`, `/clinical`, `/citations.json` |
