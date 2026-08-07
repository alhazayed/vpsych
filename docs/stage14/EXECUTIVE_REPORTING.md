# Executive Reporting

## Automated weekly kinds

Produced by `buildWeeklyReports()` → `GET /api/admin/ops/cidp/weekly`:

| Kind | Audience |
|------|----------|
| `executive` | Executive Board |
| `clinical` | Clinical Leadership |
| `educational` | Education Leadership |
| `research` | Research Leadership |
| `security` | Security Team |
| `operations` | Operations Team / Institutional Administrators |

## Each report summarizes

Achievements · Risks · Open Critical Issues · Operational Metrics · Clinical Metrics · Educational Metrics · Security Metrics · Research Metrics · Recommendations

Archive markdown copies under `../cidp/reports/weekly/` as pilots produce weeks of evidence.

## Dual status line (mandatory)

Every executive-facing report must state: **CIDP: GO · GA: NO-GO** until gates PASS.
