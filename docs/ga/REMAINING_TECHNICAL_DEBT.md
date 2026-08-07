# Remaining Technical Debt — Post-CIDP

See also `docs/TECHNICAL_DEBT.md` and `docs/stage12/TECHNICAL_DEBT.md`.

| ID | Item | Severity | Blocks GA? |
|----|------|----------|------------|
| OPS-S12-01 | Vendor APM DSN | Medium | No (WARN) |
| OPS-S12-02 | Live DR restore drill evidence | Medium | **Yes** |
| OPS-S12-03 | Upstash confirmed in production | Medium | WARN → harden |
| SEC-S12-01 | Leaked-password protection | Medium | WARN |
| PILOT-01 | External pilot critical clearance | High | **Yes** |
| CLAIMS-01 | Validated competency instruments | High (claims) | Claims only |
| ENT-08 / RT-S11-02 | Multi-instance enterprise/realtime stores | Medium | Scale |
| FB-01 | Feedback store multi-instance without DB | Low | Mitigated by migration |
