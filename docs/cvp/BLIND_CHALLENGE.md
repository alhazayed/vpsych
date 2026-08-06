# Blind Psychiatrist Challenge — CVP Protocol

Extends `docs/ppp/BLIND_PSYCHIATRIST_PROTOCOL.md` with study binding.

## Flow

1. Coordinator allocates `allocation_arm = blind_challenge`.  
2. Reviewer completes session (or uses prepared transcript).  
3. Blind scorer submits `POST /api/cvp/blind-challenge` with `overallRealism` — condition stored as `unknown` for non-admins.  
4. Admin later sets/reveals `condition_code` (`ai_patient` | `human_sp`) for analysis.  
5. Dashboard aggregates mean realism and would-use %.

## Analysis hygiene

- Pre-register primary endpoint before unblinding.  
- Do not mix open PPP ratings into the blind primary analysis.  
- Report N, missingness, and scorer credentials.
