# Stage 10 — Scalability Report

## Horizontal assumptions

- Stateless Next.js on Vercel Fluid Compute  
- Tenant isolation in Postgres RLS (shared DB, shared schema, row keys)  
- In-memory enterprise store is process-local (mirrors Stage 8/9); durable truth in Postgres  

## Scaling hints (`buildObservabilitySnapshot`)

- ≥800 active sessions or queue &gt; 50 → warm pools + Upstash  
- p95 &gt; 3s or failure &gt; 2% → shed admin analytics  

## Capacity claim

Design envelope 100 orgs / 10k users / 1k concurrent sessions is unit-verified for isolation/RBAC throughput; live load certification remains an ops drill.
