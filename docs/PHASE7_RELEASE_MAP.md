# Phase 7 — Release Map (pre-merge, from live Git/GitHub)

Captured before any Phase 7 merge. Source of truth: `git fetch` + `gh pr view`.

## Topology

```text
main @ 5c0947e                                    [CURRENT PRODUCTION]
   ↑
PR #226 OPEN DRAFT / cursor/admin-console-ux-overhaul-fc9c @ 1887c1e
   ↑  (CI verify SUCCESS on this head)
PR #227 OPEN DRAFT / cursor/admin-learner-session-ops-fc9c @ 19dfb0b
   ↑
PR #228 OPEN DRAFT / cursor/admin-governance-tenancy-fc9c @ f1125d6
   ↑
PR #229 OPEN DRAFT / cursor/admin-production-activation-fc9c @ dfa78c3
```

Correction vs earlier notes: Phase 6 tip is **`cursor/admin-production-activation-fc9c` @ `dfa78c3`**, not the Phase 5 governance branch.

## Release candidate

```text
RELEASE BRANCH:     cursor/admin-production-activation-fc9c
RELEASE CANDIDATE:  dfa78c3
CURRENT MAIN:       5c0947e
AHEAD OF MAIN:      19 commits
MERGE-BASE:         5c0947e
```

| Phase | Included in candidate? | Marker commit | PR |
|-------|------------------------|---------------|-----|
| 1 | YES | `4bd68d4` | #226 |
| 2 | YES | `346e94d` | #226 |
| 3 | YES | `1887c1e` | #226 |
| 4 | YES | `1309c96` | #227 |
| 4.1 | YES | `130ea1d` | #227 |
| 5 | YES | `f1125d6` | #228 |
| 6 | YES | `b6fcb4e`…`dfa78c3` | #229 |

## Integrity checks (pre-merge)

| Check | Result |
|-------|--------|
| Unexpected roots outside src/messages/docs/.github/vercel/.env.example | none |
| New supabase migrations vs main | **0** |
| `UserRole` | `"therapist" \| "admin"` only |
| `vercel.json` crons | absent |
| expire-sessions route + Actions workflow | present on candidate |
| Historical NULL sessions (prod SQL) | **603 / 603** untouched |

## Strategy

**A — Sequential stacked merges into `main`** (preserve provenance):

```text
#226 → main  (CI already GREEN on 1887c1e)
#227 retarget base=main → merge
#228 retarget base=main → merge
#229 retarget base=main → merge
```

Do not squash the stack into a lossy single commit if merge commits can preserve history.

## Recommended next merge

```text
PR #226 / cursor/admin-console-ux-overhaul-fc9c → main
```
