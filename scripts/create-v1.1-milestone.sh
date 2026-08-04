#!/usr/bin/env bash
# One-time admin script: create GitHub milestone + labels for v1.1 deferred PRs.
# The cloud agent token cannot write milestones/labels (403). Run locally as repo admin:
#   bash scripts/create-v1.1-milestone.sh
set -euo pipefail

REPO="${REPO:-alhazayed/vpsych}"

gh milestone create "v1.1" \
  --repo "$REPO" \
  --description "Post-v1.0.0 deferred work. Do not merge before tag v1.0.0." \
  2>/dev/null || echo "Milestone v1.1 may already exist — continuing"

gh label create "v1.1" \
  --repo "$REPO" \
  --description "Deferred until after v1.0.0 public release" \
  --color "5319E7" \
  2>/dev/null || true

gh label create "status:deferred" \
  --repo "$REPO" \
  --description "Explicitly deferred; not abandoned" \
  --color "FBCA04" \
  2>/dev/null || true

PRS=(62 63 64 65 66 67 68 69 87 88 89 91 92 93 94 95 96 97 99)

for n in "${PRS[@]}"; do
  echo "Annotating #$n …"
  gh pr edit "$n" --repo "$REPO" \
    --add-label "v1.1,status:deferred" \
    --milestone "v1.1"
done

echo "Done. Canonical registry remains docs/V1_1_BACKLOG.md"
