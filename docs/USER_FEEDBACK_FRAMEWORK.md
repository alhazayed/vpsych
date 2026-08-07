# User Feedback Framework

**Code:** `src/lib/feedback/` · **API:** `POST /api/feedback` · **Admin:** `GET /api/admin/feedback`  
**Migration:** `20260807184117_institutional_feedback_ga.sql`

## Principles

1. Feedback is stored **independently** of patient cognition.  
2. Never modify patient state, clinical engines, or DecisionPlan.  
3. Metadata cannot carry `clinical_snapshot` / `case_memory` / LTM / DecisionPlan.  
4. Separate by role persona: resident, student, supervisor, faculty, clinician, researcher, administrator, institution.

## Severity

`critical` · `high` · `medium` · `low` · `wishlist`

Critical/High block GA promotion when open without mitigation.

## Example

```http
POST /api/feedback
Content-Type: application/json

{
  "role_persona": "resident",
  "category": "clinical_realism",
  "severity": "medium",
  "rating": 4,
  "body": "Patient felt appropriately guarded on PTSD case."
}
```
