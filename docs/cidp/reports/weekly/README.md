# Weekly CIDP Reports

Generate live reports:

```http
GET /api/admin/ops/cidp/weekly?weekEnding=YYYY-MM-DD
```

Admin auth required. Returns executive, clinical, and security markdown + structured highlights.

Archive exported JSON/markdown here per week for institutional audit folders (no PHI).
