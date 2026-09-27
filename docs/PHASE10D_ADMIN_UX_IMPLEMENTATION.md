# Phase 10D — Administrator UX Implementation

**Phase:** 10D  
**Date (UTC):** 2026-09-27  
**Baseline:** Phase 10C-2 CLEAR — merge `71e36f16e89329ce21b4c55981292d64b7280d78`  
**Production baseline:** `vpsych.vercel.app` / `dpl_3imnPZhKV6SUkuyXTR5DYQkSHgBM`  
**Branch:** `cursor/phase10d-admin-ux-fc9c`  
**PR:** https://github.com/alhazayed/vpsych/pull/253  
**Production verification status:** **NOT CLAIMED** — LOCAL PASS only for this phase.

---

## 1. Executive summary

Phase 10D makes the administrator console usable by a psychiatry/education administrator who does not understand software engineering terminology, while preserving Phases 8–10C-2 security, lifecycle immutability, Guided Edit merge semantics, and Case Readiness authority.

Read-only audit first (`docs/PHASE10D_ADMIN_UX_AUDIT.md`) found **no open P0** security/data-integrity defects. Implementation focused on justified P1/P2 items: humanized Guided AI/review, lifecycle confirmations, chrome/trust fixes, create-mode AI Approve/Reject, Advanced dirty protection, educator error mapping, ContextualHelp i18n, and accessibility basics.

**Verdict:** LOCAL PASS. Preview/production CLEAR is out of scope until separately verified.

---

## 2. Initial audit findings

See `docs/PHASE10D_ADMIN_UX_AUDIT.md` for the full discovery table.

Headline gaps before implementation:

1. Guided AI/review exposed JSON and machine tokens.
2. Lifecycle used `window.prompt` / no publish confirm.
3. Learners sticky title wrong; admin error CTA steered to therapist sessions.
4. Create-mode AI framework auto-applied without Approve/Reject.
5. Advanced wizard lacked dirty/`beforeunload`.
6. Arabic admins saw English-hardcoded readiness body / help Close.

---

## 3. P0 / P1 / P2 / P3 findings

| Sev | Status |
|---|---|
| **P0** | None open (NAV-01 historical Overview→Avatars already fixed; regression preserved) |
| **P1** | Implemented (shell, Guided AI/review, lifecycle dialogs, errors, Advanced dirty, create draft wording, tab ARIA start) |
| **P2** | Partially implemented (ContextualHelp i18n, salience labels, readiness remediation display, comorbidity Advanced hint) |
| **P3** | Deferred (nav subtitle polish) |

**Deferred with rationale (GB-07 Guided comorbidity):** Guided create/edit APIs have no comorbidity persistence field. Adding a Guided comorbidity step without write-path support would mislead educators. Comorbidity remains in Advanced Case Engine with authoritative server filters (`comorbidity-compat`). Documented as NEEDS UX surface on Guided only after persistence exists — **do not invent clinical rules**.

---

## 4. Implemented changes

### Global / chrome
- `AppShell`: `/admin/learners` → sticky title `Learners` (EN/AR).
- `(app)/error.tsx`: admin paths recover to `/admin` instead of `/sessions`.
- `ContextualHelp`: i18n Close + aria-label; Escape; light focus management.

### Guided Case Builder
- Create-mode AI framework suggestions require Approve / Reject / Regenerate (no silent apply).
- Structured context + generated case shown as human summary cards; raw JSON under `AdvancedDetails`.
- Create Review shows selected values, separates AI vs administrator content, states “Nothing will be published yet.”
- Footer/create CTA: “Create draft now” + hint that nothing publishes.
- Guided Edit banner: human lifecycle label + description; Internal ID secondary; Arabic authorship humanized.
- Applied-field save toast uses field labels, not raw keys.
- Symptom salience chips use i18n (`presenting` / `elicited` / `hidden`).
- Presentation step notes comorbidity is configured in Advanced.
- Product error mapping for create/save failures.

### Lifecycle
- Publish confirmation dialog (server gates unchanged).
- Accessible duplicate dialog (replaces `window.prompt`); API still requires slug.
- Status blurbs for Draft / Testing / Published / Archived.
- Immutable edit hint for published/archived.
- Educator mapping for `lifecycle_immutable` and related codes.

### Advanced wizard
- Dirty detection vs baseline snapshot; `beforeunload`; `onDirtyChange`.
- Mode switches confirm when Advanced is dirty.
- Validation technical paths moved under Advanced details.

### Readiness / detail
- Case Readiness panel shows remediation under incomplete items (same Phase 10B engine).
- Detail tabs: `tabpanel` / `aria-controls` / arrow-key navigation.

---

## 5. Files changed

| Area | Files |
|---|---|
| Audit / docs | `docs/PHASE10D_ADMIN_UX_AUDIT.md`, `docs/PHASE10D_ADMIN_UX_IMPLEMENTATION.md` |
| i18n | `messages/en.json`, `messages/ar.json` |
| Shell / errors | `src/components/AppShell.tsx`, `src/app/(app)/error.tsx` |
| Help | `src/components/admin/help/ContextualHelp.tsx` |
| Guided | `GuidedCaseBuilder.tsx`, `CreatePatientModeSwitch.tsx`, `EditPatientModeSwitch.tsx` |
| Lifecycle / detail | `VirtualPatientLifecycleActions.tsx`, `VirtualPatientDetail.tsx`, `CaseReadinessPanel.tsx` |
| Advanced | `VirtualPatientWizard.tsx` |
| Lib | `admin-product-errors.ts` (+test), `humanize-guided.ts` (+test), `case-builder/index.ts` |

---

## 6. APIs changed

**None.**  
`GET/PATCH /api/admin/case-builder/[id]`, create, generate, publish, duplicate, readiness — contracts unchanged. Client UX only.

---

## 7. Database changes

**None.**  
Migration `20260927092011_preserve_ideal_guidelines_extras.sql` untouched and must remain.

---

## 8. Security impact

| Control | Impact |
|---|---|
| MFA / AAL2 | Unchanged |
| HMAC | Unchanged |
| RLS | Unchanged |
| Rate limiting | Unchanged |
| Audit logging | Unchanged (lifecycle still posts to existing routes) |
| Lifecycle immutability | Unchanged (UI confirms; server still 409) |
| Guided Edit merge | Unchanged (field-level merge only) |
| AI | Still server-only suggestions; create framework no longer auto-applies client-side |
| Secrets | No new client secrets |
| Auto-publish | Still impossible from Guided create/edit |

---

## 9. Guided Builder changes

Progressive disclosure preserved. Catalogues (presentation, goals, symptoms, frameworks) unchanged. AI suggestions labeled and reviewable. Review summarizes selections before “Create draft now.”

---

## 10. Guided Edit changes

Merge-only semantics preserved. Banner/help/errors humanized. Dirty guards retained. No full-patient reconstruction.

---

## 11. AI behavior

- Suggestions only; Approve / Reject / Regenerate on framework (create + edit).
- Symptom accept-selected / reject-all unchanged.
- Structured context requires approve.
- Unavailable AI → nontechnical continue-manually message.
- Never publishes; never writes from the browser without admin API + MFA.

---

## 12. Arabic / RTL behavior

- New strings added to `messages/ar.json` (contextual help, product errors, lifecycle dialogs, Guided labels).
- Authored Arabic content path unchanged (merge preserves Arabic; stub classification unchanged).
- Readiness item *explanations* remain English-hardcoded in `readiness.ts` (server authority). Panel chrome is i18n; full explanation localization is a follow-up (do not change gate math).

---

## 13. Accessibility

- ContextualHelp: Escape, aria-expanded/controls, Close focus return.
- Lifecycle dialogs: `role="dialog"`, Escape, initial focus.
- Detail tabs: tablist/tab/tabpanel + arrow keys.
- Visible focus styles retained/extended on tabs.

---

## 14. Lifecycle behavior

Semantics unchanged. UX clarifies Draft / Testing / Published / Archived and Duplicate → New Draft. Publish requires confirmation when gates pass; blocked publish still surfaces readiness.

---

## 15. Test results (LOCAL)

| Gate | Result |
|---|---|
| `npm test` | **PASS — 1051** (was 1044; +7 new Phase 10D unit tests) |
| `npm run lint` | **0 errors** (13 pre-existing warnings) |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** |

Artifacts: `/opt/cursor/artifacts/phase10d-*.log`

---

## 16. Security regression results (LOCAL)

Focused suites covering MFA, report signing, architecture invariants, edit integrity, Guided Edit merge, readiness, lifecycle, rate limit, security headers/audit, comorbidity compat, and new product-error/humanize helpers:

**PASS** (see `/opt/cursor/artifacts/phase10d-security-regression.log`).

Phase 10C-2 merge invariants remain covered by `guided-edit.test.ts` (27) + `edit-integrity.test.ts` (12).

---

## 17. Preview verification

**Not run in this agent turn as production CLEAR.** Deploy preview and exercise:

LOGIN → MFA → Admin → Create Virtual Patient → Guided → Review → Create Draft → Guided Edit one field → Save → reject AI → published immutability → duplicate → Arabic preservation.

---

## 18. Production verification status

**NOT CLEAR.**  
Production remains at Phase 10C-2 baseline until this PR is merged and production-verified separately. Do not treat LOCAL PASS as production PASS.

---

## 19. Known limitations

1. Guided comorbidity authoring still Advanced-only (no Guided persistence).
2. Readiness item explanations still English in `readiness.ts`.
3. Detail tab labels still English-hardcoded (ARIA fixed).
4. Duplicate API still requires internal ID (slug); UI labels it “Internal ID” but does not invent a second identifier.
5. No autosave / revision history (out of scope).
6. No browser E2E recorded in this run — unit/integration + build only.

---

## 20. Recommended next phase

1. Preview + production admin workflow smoke (manual) before claiming CLEAR.  
2. Optional Phase 10D.1: Guided comorbidity step **only if** create/PATCH persistence is designed without inventing clinical rules.  
3. Localize readiness explanation map by `code` without changing gate math.  
4. i18n remaining Detail chrome.  
5. Do **not** start Phase 10C-3 from this branch.

---

## Acceptance checklist

- [x] Actual admin UI audited before implementation  
- [x] Audit document exists  
- [x] Contextual help improved where material  
- [x] Guided Builder clearer; AI reviewable  
- [x] Clinical presentation searchable (pre-existing, preserved)  
- [x] Unsupported comorbidities remain blocked (Case Engine)  
- [x] Session goals / symptoms structured (pre-existing, preserved + salience labels)  
- [x] Therapeutic approach uses `THERAPY_FRAMEWORKS`  
- [x] Guided Edit merge-only  
- [x] Dirty-state protection (Guided + Advanced)  
- [x] Readiness uses Phase 10B authority  
- [x] Lifecycle semantics unchanged; publish confirm added  
- [x] Published/archived immutable  
- [x] No client secrets / MFA / HMAC / RLS / rate-limit changes  
- [x] No auto-publish  
- [x] npm test / lint / typecheck / build PASS locally  
- [x] Security regression PASS locally  
- [ ] Preview verification  
- [ ] Production CLEAR — **explicitly not claimed**
