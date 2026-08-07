# Phase 16 Evidence Policy

**Binding.** Violations are governance defects.

## Prohibited

Do **not** fabricate:

- Pilot institution profiles or satisfaction scores  
- Clinical realism / agreement / reliability numbers without observation  
- DR drills · PITR drills · restore proofs  
- Penetration tests  
- User feedback rows  
- Educational outcomes / research packs  

## Required behaviour

If evidence does not exist, systems and reports **must** show:

**Evidence Pending**

Never zero-fill fiction. Never simulate operational evidence for GA gates.

## Allowed observations

- Real DB counts (sessions, audit events, feedback, institution seed rows as counts)  
- Explicitly supplied institution pilot profiles from operators  
- Signed evidence log rows (DR/security) when present  
- `npm audit` results when executed  

## PHI

No PHI. Fictional standardized patients only. No `session_reports` narrative on therapist-facing surfaces.
