# Operator Runbook — Clinical Validation

## Bootstrap a study

```bash
# 1. Create study (admin session cookie / bearer as used by app)
POST /api/admin/cvp/studies
{ "slug": "cvp-pilot-2026", "title": "CVP Pilot 2026", "irbReference": "IRB-PENDING" }

# 2. Create or select institution
POST /api/admin/cvp/institutions
{ "slug": "demo-med", "name": "Demo Medical School", "countryCode": "US" }

# 3. Attach site
POST /api/admin/cvp/studies/{studyId}/sites
{ "institutionId": "...", "siteCode": "A" }

# 4. Invite reviewer
POST /api/admin/cvp/studies/{studyId}/invitations
{ "email": "reviewer@example.org", "institutionId": "...", "roleInStudy": "reviewer" }
# → save plaintext token once

# 5. Reviewer accepts at /validation/accept

# 6. Allocate avatars
POST /api/admin/cvp/studies/{studyId}/assignments
{ "enrollmentId": "...", "count": 3 }

# 7. Monitor /admin/validation ; export publication package when ready
```

## Stability notes

- Assignment allocation only chooses **which avatar**; case generation remains the existing session start path.  
- If CVP tables are missing, dashboards return empty + migration warning (non-fatal).  
- RC1 simulation code paths are not modified by CVP route handlers.
