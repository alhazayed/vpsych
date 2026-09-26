# Phase 9 — AI Case Generation

**Status:** Implemented (server-side suggestions only)  
**Provider surface:** Existing `lib/ai/provider.ts` (OpenAI SDK or Vercel AI Gateway)

## Endpoints

| Route | Purpose | Rate limit |
|-------|---------|------------|
| `GET /api/admin/case-builder/catalogues` | Educational catalogues | 60/hr |
| `POST /api/admin/case-builder/generate` | Section AI (`symptoms` \| `context` \| `framework` \| `case`) | 30/hr |
| `POST /api/admin/case-builder/create` | Persist approved draft | 20/hr |

All require `requireApiAdmin` (role + AAL2 when MFA enforced) and audit logging on generate/create.

## Contract

1. Browser never holds provider keys.  
2. AI returns **suggestions** only — never writes avatars/cases directly.  
3. Invalid JSON / out-of-allowlist frameworks / empty payloads → **REJECT** (`422` / `AI_INVALID`).  
4. Missing AI keys / provider errors → `503` + `manualFallback: true` (manual authoring remains).  
5. Create includes AI narrative only when `sectionApprovals.generated` is true.

## Prompts

System prompt constrains output to fictional educational simulation, forbids real identifiers and proprietary DSM criterion dumps, and requires controlled therapy modality list for framework recommendations.

## Failure UX

Administrator sees: “AI generation is temporarily unavailable. You can continue manually.”
