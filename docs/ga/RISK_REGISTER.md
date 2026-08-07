# Risk Register — CIDP / GA

| ID | Risk | Severity | Mitigation | GA impact |
|----|------|----------|------------|-----------|
| R-GA-01 | Unvalidated score misuse | High | KNOWN_LIMITATIONS; faculty manuals | Blocks marketing GA claims |
| R-GA-02 | Pilot Critical defect undiscovered | High | Feedback severity + soak | NO-GO until clearance |
| R-GA-03 | DR restore untested live | Medium | DISASTER_RECOVERY + scheduled drill | NO-GO |
| R-GA-04 | In-memory RL / telemetry multi-instance | Medium | Upstash + APM | WARN |
| R-GA-05 | Provider outage | Medium | Persona fallback; text-only | Accepted RC1 |
| R-GA-06 | Feedback table not applied in prod | Medium | Migration + RM checklist | Deploy gate |
| R-GA-07 | Ownership regression | Critical | architecture.test.ts | CI blocks |
| R-GA-08 | Experimental engine merge | Medium | Board freeze | Policy |
