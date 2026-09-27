# Phase 10D — Administrator UX Audit (Read-Only Discovery)

**Phase:** 10D  
**Date (UTC):** 2026-09-27  
**Baseline:** Phase 10C-2 CLEAR — merge `71e36f16e89329ce21b4c55981292d64b7280d78`  
**Production:** `vpsych.vercel.app` / `dpl_3imnPZhKV6SUkuyXTR5DYQkSHgBM`  
**Branch:** `cursor/phase10d-admin-ux-fc9c`  
**Scope:** Read-only inspection of administrator-facing UI/workflows. No production merge from this document alone.

---

## 1. Executive summary

The administrator console is already a mature multi-surface product: Guided Case Builder (default), Advanced wizard, Case Readiness (Phase 10B), Guided Edit merge (Phase 10C-2), MFA/AAL2 gates, and lifecycle immutability.

For a **non-technical educator**, the primary friction is not missing clinical catalogues — presentation, goals, symptoms, and frameworks are already searchable/structured in Guided. The largest gaps are:

1. **Review / AI surfaces expose JSON and machine tokens** instead of readable summaries.
2. **Lifecycle and destructive actions** use native `prompt`/`confirm`, slug jargon, and publish without confirmation.
3. **Chrome/trust issues**: wrong sticky title on Learners; silent empty states when queries fail; admin error boundary steers to therapist “My Sessions”.
4. **Create-mode AI framework auto-applies** without Approve/Reject (edit mode already does it correctly).
5. **Advanced wizard lacks dirty-state protection** (silent loss when switching modes).
6. **Arabic admins** see English-hardcoded readiness/detail body and validation strings.

**No open P0 security or data-integrity defects** were found that require stopping UX work. Overview → Avatar redirect (historical) is fixed. Phase 10C-2 merge semantics and `20260927092011` ideal_guidelines preservation must not be weakened.

---

## 2. Surfaces inspected

| Surface | Path / component |
|---|---|
| Overview | `/admin` · `admin/page.tsx` |
| Virtual Patients library | `/admin/avatars` · `VirtualPatientLibrary.tsx` |
| Create | `/admin/avatars/new` · Guided + Advanced switches |
| Detail | `/admin/avatars/[id]` · `VirtualPatientDetail.tsx` |
| Edit | `/admin/avatars/[id]/edit` · Guided Edit + Advanced |
| Guided Case Builder | `GuidedCaseBuilder.tsx` · `lib/admin/case-builder/*` |
| Advanced wizard | `VirtualPatientWizard.tsx` |
| Case Readiness | `CaseReadinessPanel.tsx` · `readiness.ts` |
| Lifecycle actions | `VirtualPatientLifecycleActions.tsx` |
| Case Engine / Preview | `CaseEnginePanel.tsx` |
| Nav / shell | `admin-nav.ts` · `AdminSidebarNav.tsx` · `AppShell.tsx` |
| Help | `help/ContextualHelp.tsx` |
| Auth / MFA | `auth.ts` · `api-auth.ts` · middleware · `/auth/mfa` |
| i18n | `messages/en.json`, `messages/ar.json` |

---

## 3. Severity legend

| Sev | Meaning |
|---|---|
| **P0** | Security / data integrity / destructive workflow risk — stop unrelated UX if open |
| **P1** | Major usability or clinical-authoring workflow problem for non-technical educators |
| **P2** | Usability / accessibility / clarity improvement |
| **P3** | Cosmetic / minor |

---

## 4. Findings

### 4.1 Navigation & shell

| ID | Sev | Screen | Component | Current behavior | Problem | Administrator impact | Recommended solution | Security / integrity | Safe in 10D? |
|---|---|---|---|---|---|---|---|---|---|
| NAV-01 | P0 (fixed) | Overview under AAL1 | Pre-8.9 `requireAdmin` + middleware | Deny → login → `/avatars` | Historical Overview → therapist Avatar catalog | Blocks admin work | Keep architecture tests; do not regress MFA helpers | Regression only | N/A (already fixed) |
| NAV-02 | P1 | `/admin/learners` | `AppShell.pageTitleKey` | Falls through to `"patientLibrary"` | Sticky title shows “Virtual Patient Library” on Learners | Wrong place signal | Add `learners` → dedicated title key | None | Yes |
| NAV-03 | P1 | Admin RSC error | `(app)/error.tsx` | Recovery CTA → `/sessions` | Educator exits console into therapist workspace | Confusion / lost admin context | Admin-aware recovery link to `/admin` when path starts with `/admin` | None | Yes |
| NAV-04 | P1 | Overview / library / content | Pages discard query `error` | Failed loads look like empty data | Misreads program state | Surface `ErrorState`; distinguish empty vs failed | None | Yes |
| NAV-05 | P2 | Mobile admin | `AdminMobilePrimaryNav` | Omits Learners / Virtual Patients | Extra drawer hops | Add VP (and optionally Learners) to primary strip | None | Yes |
| NAV-06 | P2 | Terminology | Nav vs URL / Voices | “Virtual Patients” vs `/admin/avatars` and “avatar” voice copy | Dual mental model | Prefer VP in copy; keep internal `avatars` paths | None | Yes |
| NAV-07 | P2 | Role labels | `AppShell` | “Administrator” vs “Clinical Supervisor” | Identity confusion | Align labels | None | Yes |
| NAV-08 | P3 | Learning IA | `admin-nav.ts` | “Learners” vs “Learners & Progress” | Near-duplicate names | Clarify subtitles | None | Yes |

**Navigation reliability:** Overview does **not** redirect to Virtual Patients. Direct URL, refresh, and AAL2 gates work via `requireAdmin()`. Do not weaken middleware/auth.

---

### 4.2 Guided Case Builder (create)

| ID | Sev | Screen | Component | Current behavior | Problem | Impact | Recommended solution | Security / integrity | Safe? |
|---|---|---|---|---|---|---|---|---|---|
| GB-01 | — | Presentation | Guided | Searchable grouped list | Already good | — | Preserve; i18n “DSM optional” | None | Maintain |
| GB-02 | — | Goals / symptoms | Guided | Searchable multi-select + custom | Already structured (not one-per-line) | — | Preserve; humanize salience chips | Schema unchanged | Maintain |
| GB-03 | — | Framework | Guided | `THERAPY_FRAMEWORKS` radios | Controlled catalogue | — | Preserve | Validation unchanged | Maintain |
| GB-04 | P1 | Framework AI (create) | `runGenerate("framework")` | Auto-applies to draft | Contradicts “you stay in control” | Silent AI overwrite of selection | Match edit: pending + Approve/Reject | No server change | Yes |
| GB-05 | P1 | Context / generate | Guided | `JSON.stringify` blobs | Unreadable for educators | Cannot review AI safely | Human-readable summary cards; keep JSON in AdvancedDetails | Suggestions remain reviewable | Yes |
| GB-06 | P1 | Review (create) | Guided review step | Section Approve toggles only | No summary of selected values | Approves blindly | Show presentation, goals, symptoms, framework, interaction summary | Approvals still required | Yes |
| GB-07 | P1 | Comorbidity | Guided | Absent | Only Advanced Case Engine | Educators miss unsupported combos | Optional Guided comorbidity step reusing Case Engine filters + server validation | Server remains authoritative | Yes (UI filter only) |
| GB-08 | P1 | Save draft (create) | Footer | Label implies progress save | Calls create API immediately | Unexpected patient creation | Rename to “Create draft now” / clarify copy | Lifecycle draft unchanged | Yes |
| GB-09 | P2 | Symptoms display | Guided | Raw `salience` / `uiCategory` | Jargon chips | Educator confusion | Map to i18n labels | None | Yes |
| GB-10 | P2 | ContextualHelp | Help control | Hardcoded “Close”; `Help: ${label}` EN | Breaks AR / a11y polish | i18n close + aria | None | Yes |
| GB-11 | P2 | Help coverage | Late steps | Review/create/save/voice lack help | Incomplete guidance | Add help where material | None | Yes |

---

### 4.3 Guided Edit

| ID | Sev | Screen | Component | Current behavior | Problem | Impact | Recommended solution | Security / integrity | Safe? |
|---|---|---|---|---|---|---|---|---|---|
| GE-01 | — | Merge | `guided-merge` + PATCH | Field-level merge | Correct 10C-2 contract | — | **Do not redesign** | Preserve extras migration | Maintain |
| GE-02 | P1 | Banner | Guided Edit | Shows `name · slug · lifecycleStatus` | Slug + raw lifecycle | Techy | Human lifecycle label; hide slug or label “Internal ID” secondary | None | Yes |
| GE-03 | P2 | Arabic line | Banner | Raw `missing`/`stub`/`authored` | Machine tokens | Humanize via i18n | None | Yes |
| GE-04 | P2 | Save toast | Guided | Appends raw `appliedFields` keys | Techy | Human field labels | None | Yes |
| GE-05 | — | Dirty | Guided | `beforeunload` + confirms | Good | — | Keep | None | Maintain |

---

### 4.4 Lifecycle, readiness, detail

| ID | Sev | Screen | Component | Current behavior | Problem | Impact | Recommended solution | Security / integrity | Safe? |
|---|---|---|---|---|---|---|---|---|---|
| LC-01 | P1 | Detail | Lifecycle actions | Publish has no confirm | Accidental publish risk | Add confirm when gates pass | Server still gates publish | Yes |
| LC-02 | P1 | Detail | Duplicate | `window.prompt` for slug | Inaccessible; jargon | Accessible dialog; optional auto-slug with editable display name | API still requires slug | Yes |
| LC-03 | P1 | Detail / Guided | Lifecycle copy | No educator descriptions | Unclear Draft/Testing/Published | Add short blurbs | Do not change transitions | Yes |
| LC-04 | P1 | Errors | Lifecycle / mutability | `lifecycle_immutable` product English not i18n | AR gap; jargon | Map codes → educator messages | Keep 409 semantics | Yes |
| RD-01 | P1 | Readiness | `readiness.ts` explanations | English-hardcoded item body | AR admin sees EN checklist | Message map by `code` / section id | Do not change gate math | Yes |
| RD-02 | P2 | Readiness | Panel | Remediation / `?focus=` unused | Can’t jump to fix | Render remediation; honor focus | None | Yes |
| DT-01 | P1 | Detail tabs | `VirtualPatientDetail` | Incomplete tab ARIA; heavy EN hardcoding | A11y + AR gap | tabpanel/controls; i18n tabs | None | Yes |

---

### 4.5 Advanced wizard

| ID | Sev | Screen | Component | Current behavior | Problem | Impact | Recommended solution | Security / integrity | Safe? |
|---|---|---|---|---|---|---|---|---|---|
| ADV-01 | P1 | Edit Advanced | `VirtualPatientWizard` | No dirty / `beforeunload` | Silent loss on switch/nav | Track dirty; confirm leave | Comment falsely claims wizard manages dirty | Yes |
| ADV-02 | P1 | Validation step | Wizard | Shows `issue.path` (`clinical_core.*`) | Tech paths | Humanize; keep path in expandable details | None | Yes |
| ADV-03 | P2 | Advanced | Fields | Slug + JSON advanced | Expected for power users | Keep Advanced; improve Guided as primary | None | Yes |

---

### 4.6 Accessibility / RTL / errors

| ID | Sev | Finding | Safe? |
|---|---|---|---|
| A11Y-01 | P1 | Detail tabs missing `tabpanel` / keyboard | Yes |
| A11Y-02 | P2 | ContextualHelp no focus trap; hardcoded Close | Yes |
| A11Y-03 | P2 | Case Engine difficulty/modality raw enums | Yes |
| RTL-01 | P1 | Readiness / Detail / validation English body under AR | Yes |
| ERR-01 | P1 | Client surfaces product codes inconsistently; Case Engine comorbidity mapping is the gold standard | Yes |

---

### 4.7 Security / data-integrity (verified unchanged)

| Control | Status |
|---|---|
| MFA / AAL2 (`requireAdmin` / `requireApiAdmin`) | Intact |
| HMAC / RLS / rate limit / audit | Intact (no Phase 8 file changes planned) |
| Published / archived immutability | Intact (`assertAvatarContentMutable`) |
| Guided Edit merge-only | Intact |
| ideal_guidelines extras migration `20260927092011` | Must preserve |
| No auto-publish | Intact |
| AI server-only suggestions | Intact (create framework auto-apply is client UX bug, not server bypass) |
| Arabic independence | Intact |

**No P0 open.** If implementation discovers a new P0, stop unrelated UX and report.

---

## 5. What is already good (do not break)

- Guided is default create/edit progressive wizard.
- Searchable clinical presentation, goals, symptoms catalogues.
- Therapy frameworks from authoritative `THERAPY_FRAMEWORKS`.
- Comorbidity unsupported messaging in Case Engine (Advanced) is clear.
- Guided Edit merge + Review Changes + dirty guards.
- Case Readiness panel hides machine codes from primary UI (explanations need i18n).
- Publish blocked when unreadiness with callout.

---

## 6. Phase 10D implementation priority (justified by this audit)

### Must implement (P1, safe)

1. Fix Learners sticky title + admin error recovery CTA.  
2. Humanize Guided Edit banner / applied-field feedback / Arabic authorship labels.  
3. Create Review content summary.  
4. Create-mode AI framework Approve/Reject (no silent apply).  
5. Replace AI JSON dumps with human-readable summaries (AdvancedDetails for raw).  
6. Lifecycle: publish confirm; accessible duplicate dialog; lifecycle blurbs.  
7. Map `lifecycle_immutable` / common API codes to educator i18n strings.  
8. Advanced wizard dirty-state protection.  
9. Clarify create “Save draft” wording.  
10. Detail tab ARIA basics + start i18n for Detail chrome.

### Should implement (P2)

11. ContextualHelp Close/aria i18n + review/create help.  
12. Symptom salience/category labels.  
13. Query failure `ErrorState` on Overview/library.  
14. Readiness remediation links / focus.  
15. Voice/assign copy “avatar” → “Virtual Patient” where user-facing.

### Out of scope / document only

- New comorbidity clinical ontology or second readiness engine.  
- Autosave / revision history.  
- Renaming DB `avatars` table or routes.  
- Inventing DSM/ICD codes or symptom taxonomy beyond catalogues.  
- Phase 10C-3.  
- New migrations unless proven necessary (expect **none**).

---

## 7. Clinical data-model notes (no inventing)

| Topic | Finding |
|---|---|
| Presentation catalogue | Stable ~11 active training presentations — use as-is |
| Comorbidity | Authoritative compatibility in Case Engine; Guided lacks UI — NEEDS UX surface, not new rules |
| Symptoms | Curated library + free custom; no separate ontology required |
| Goals | Curated session goals + custom |
| Frameworks | `TherapyModality` / `THERAPY_FRAMEWORKS` |
| AI | Advisory only; must stay reviewable |

---

## 8. Acceptance for moving to implementation

- [x] Actual admin UI audited before code changes  
- [x] Findings classified P0–P3 with security notes  
- [x] No open P0 blocking UX work  
- [x] Implementation plan preserves Phases 8–10C-2 invariants  

**Next:** Implement §6 Must/Should items on this branch; run full regression; produce `docs/PHASE10D_ADMIN_UX_IMPLEMENTATION.md`; open PR — **do not merge**.
