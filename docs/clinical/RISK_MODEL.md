# Risk Model

**Owner (patient risk):** `ClinicalCore.risk_profile` (`RiskProfile` in `types.ts`)  
**Owner (safety communication):** `AvatarPersonality.safety_module`  
**Prompt:** Module 4 (overrides Modules 1–3)

---

## Purpose

Represent suicide/self-harm/violence/substance **flags** and safety communication rules for educational SP sessions — not a clinical decision-support device.

---

## Runtime RiskProfile

| Field | Type | Meaning |
|-------|------|---------|
| `suicidal_ideation` | `none` \| `passive` \| `active_no_plan` \| `active_with_plan` | SI level |
| `self_harm?` | boolean | NSSI / self-harm flag |
| `harm_to_others?` | boolean | Violence / HTO flag |
| `substance_use?` | boolean | Substance involvement flag (not pattern) |
| `escalation_rules?` | string | Free-text escalation guidance |

**Defaults:** `DisorderPackage.risk_defaults` at mint.

---

## SafetyModule (locale personality)

| Field | Role |
|-------|------|
| `crisis_resources[]` | name, contact, hours?, region? |
| `risk_disclosure_style` | How the SP speaks about risk |
| `boundary_rules[]` | Hard conversational boundaries |
| `escalation_language?` | Escalation phrasing |

---

## Prompt rules (Module 4)

- Injects boundary rules + full RiskProfile + disclosure style + crisis resources.  
- Forbids instructional detail on methods/means.  
- Overrides conflicting Modules 1–3 content.

---

## Downstream consumers

| Consumer | Use |
|----------|-----|
| Humanization clinical gates | Blocks humor/laughter etc. under active SI / self-harm / HTO |
| TRM chart risk alerts | Maps SI → alerts |
| Clinic urgency | routine → emergent |
| Assessment rubric | `risk_formulation`, `safety` |
| CBE / emotion classifiers | `safety_check` therapist move |
| CFI | risk_assessment dimension |

---

## Authored-only risk richness

Persona MSE `risk` prose may include C-SSRS-style narrative, static/dynamic factors, self-neglect, risk to dependents, protective factors. **Not** on RiskProfile. Engines must not parse persona JSON as runtime truth unless Case Engine promotes fields.

---

## Explicit gaps

| Concept | Status |
|---------|--------|
| Protective factors array on ClinicalCore | Missing (CFI notes package gap) |
| Self-neglect / dependents on RiskProfile | Missing |
| Structured substance pattern (amount, route, withdrawal) | Missing |
| Violence risk structured (static/dynamic tools) | Missing |
| C-SSRS typed instrument | Authored narrative only |

---

## Security & governance

- Educational simulation; index hard prohibitions include no suicide-attempt enactment instructional content.  
- Never claim validated clinical risk prediction.  
- Admin reports may discuss trainee risk assessment quality — separate from patient RiskProfile.
