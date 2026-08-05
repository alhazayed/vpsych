# Therapy Response Validation

**Program:** Mission 22 Workstream D  
**Harness:** `src/lib/validation/therapy-response.ts`

## 1. Objective

Verify that PME patients evolve **gradually** and **plausibly** under distinct
interviewing styles — not with instant affect flips.

## 2. Styles tested

Supportive · CBT · Motivational Interviewing · DBT · Psychodynamic · Crisis

Each style runs a fixed 4-turn script through `processTherapistTurn`.

## 3. Outcomes measured

| Variable | Source |
|---|---|
| Trust Δ | `relationship.trust` |
| Alliance Δ | `relationship.alliance` |
| Disclosure readiness Δ | mean topic readiness |
| Hope Δ | `emotional_state.hope` |
| Resistance proxy | active defenses + negative trust |
| Gradualism | max per-turn trust jump ≤ 8 |
| Clinical plausibility | style-specific assertions |

## 4. Pass criteria

- Per style: `gradual && clinically_plausible`  
- Battery: pass rate ≥ 80%  

Warm/MI styles must not substantially reduce trust. Crisis may raise defenses
transiently (documented as expected).

## 5. Human confirmation

Harness results are **engineering evidence**. Clinician raters must confirm
plausibility of multi-session trajectories in the limited pilot.
