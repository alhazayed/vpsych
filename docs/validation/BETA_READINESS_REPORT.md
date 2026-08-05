# Beta Readiness Assessment

**Program:** Mission 22 Workstream G  
**Engine:** `src/lib/validation/beta-readiness.ts`  
**Assessment date:** 2026-08-05  
**Program version:** 1.0.0

## Verdict

# CONDITIONAL GO

Proceed to **protocol execution and expert recruitment**, not broad public beta
or marketing claims of clinical validation.

## Domain scores (framework dry-run)

| Domain | Status | Notes |
|---|---|---|
| Clinical readiness | conditional | CFI/PMFI/HCFI structural OK; PAS human data absent |
| Educational readiness | conditional | LAS not yet collected |
| Scientific readiness | conditional | Protocols + engines shipped; preregistered human study pending |
| Operational readiness | ready | Regression suite green; migrations in repo |
| Conversation quality | conditional/ready | Automated QC OK; human EN/AR review pending |
| Research readiness | conditional | Export/API ready; data lock & blinding ops pending |

Exact numbers are recomputed live via `GET /api/admin/validation` → `beta`.

## Recommended participant profile

- ≥4 consultant psychiatrists (blind PAS)  
- ≥4 psychiatry residents  
- ≥2 clinical psychologists  
- ≥20 learners across med student / GP / psych tracks (LAS)  
- Optional: 2 SP educators for criterion arm  

## Recommended beta size

| Cohort | n |
|---|---|
| Clinicians | 12 |
| Learners | 40 |
| Cases | 24 |

## Success criteria (gate to Expert Beta)

1. PAS overall ≥ 70 with 95% CI lower ≥ 60 (n≥8)  
2. LAS overall ≥ 70 (n≥20)  
3. Suspected-AI rate ≤ 40% among consultants  
4. Therapy-response gradualism pass rate ≥ 80%  
5. CI green (lint / typecheck / test / build)  
6. EN + AR human conversation review without unresolved high-severity AI tells  

## Known limitations

- No PAS/LAS human ratings collected yet  
- PAB structural scaffolding ≠ SP criterion validity  
- Arabic primarily ar-JO  
- Competency assessment scores not psychometrically validated  
- Multi-session human longitudinal study not run  

## Risk register (abridged)

| Risk | L | I | Mitigation |
|---|---|---|---|
| Overclaiming realism | H | H | Public CONDITIONAL; ban marketing claims |
| AI leakage / fallback | M | H | aiSource flags; exclude fallback from PAS packs |
| Learner distress | M | M | Debrief + crisis resources + instructor oversight |
| AR dialect mismatch | M | M | Independent AR rater stream |

## Go-forward plan

1. Freeze protocol docs (this folder)  
2. Recruit clinician raters; run PAS packs  
3. Run LAS with supervised learners  
4. Recompute dashboard; promote verdict only when thresholds met  
5. Only then: **GO TO EXPERT BETA** or **GO TO LIMITED PILOT**
