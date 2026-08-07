# Stage 8 — Performance Report

## Expectations

| Workload | Target |
|----------|--------|
| Single validation pipeline run | Sub-second typical |
| 500-session corpus generation | Covered in unit test &lt; 15s with 20 pipeline samples |
| Admin dashboard GET | Offline corpus fallback when memory empty |
| Session-end bridge | Soft-fail; must not block report persistence |

## Architecture impact

- No change to patient turn order (Adaptation→resolve→Memory→Emotion→CBE→Decision→Humanization).  
- No new writes on message path.  
- Validation runs after education on end path only.  
- Admin route rate-limited 30/h.

## Regression stance

Performance unchanged for patient reply latency. Validation cost is post-session observational.
