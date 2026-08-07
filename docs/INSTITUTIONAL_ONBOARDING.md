# Institutional Onboarding — Administrator Guide

**Role:** Institution administrator / program coordinator  
**Platform:** VPsych `1.0.0-rc.1`

## Prerequisites

- Production access to Vercel project + Supabase project (or delegated SaaS tenancy).  
- At least one `profiles.role = admin` user.  
- Institution row in `institutions` (Stage 10).

## Steps

1. **Identity** — Create faculty/resident accounts via signup; ban demo `*.vpsych.test`.  
2. **Roles** — Map enterprise membership roles (Stage 10 RBAC); platform `admin` sparingly.  
3. **Cohorts** — Use courses/assignments when available; otherwise share avatar catalog.  
4. **Security** — Enable leaked-password protection; confirm Upstash; review audit events.  
5. **Feedback** — Train users to submit role-tagged feedback (`USER_FEEDBACK_FRAMEWORK.md`).  
6. **Monitoring** — Bookmark `/api/admin/ops/metrics`, `/api/admin/ops/dashboards`, `/api/admin/ops/validation`.  
7. **Exit criteria** — No Critical feedback open; session completion stable; rollback drill scheduled.

## Never

- Never ask trainees to treat scores as validated credentials.  
- Never paste real patient PHI into the simulator.  
- Never enable experimental excellence engines without Board unlock.
