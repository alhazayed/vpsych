# Release Notes — v1.0.0-rc.1

**Tag:** `v1.0.0-rc.1`  
**Certification:** `VPSYCH-1.0-RC1-STAGE12`  
**Merged:** PR [#176](https://github.com/alhazayed/vpsych/pull/176) → `main`  
**Date:** 2026-08-07

## Highlights

- Stages 1–12 complete and canonical.  
- Production hardening: admin rate limits, ElevenLabs timeouts, request correlation, ops metrics, CI audit/perf gates.  
- Limited Institutional Production authorized (RDL-028).

## CIDP follow-on (this program)

- Institutional feedback framework + migration  
- Production telemetry & dashboards  
- Faculty/Resident/Supervisor/Research manuals  
- GA readiness evaluation → **NO-GO for full GA** until pilot/DR residuals clear

## Breaking changes

None intentional for RC1 consumers.

## Upgrade

Pull `main` at/after `e201e2c`. CIDP adds `20260807184117_institutional_feedback_ga.sql` (applied on production during CIDP certification).
