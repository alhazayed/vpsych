# Wave 3 — Fictional Patient Integrity Certification

**Audit target:** production codebase `origin/main` @ `5aae13806c984cb19a9c2e920d14014b548d4400`  
**Date:** 2026-08-06  
**Scope:** Every patient generation / portrayal pathway for synthetic, fictional, non-identifiable standardized patients.

## Executive verdict

**Overall: PARTIAL (Conditional Pass) — Synthetic Patient Certification**

Production at `5aae138` uses **authored fictional personas** plus **procedural CaseInstance assembly** (diagnosis packages, difficulty, randomized non-diagnostic context). There is **no EHR/FHIR/medical-record ingest path**, **no patient-knowledge RAG**, and **no real-patient voice cloning**. PME is **not present** on this SHA.

The platform therefore meets the core production claim that simulated patients are **synthetic / fictional / non-PHI-sourced**. It does **not** fully satisfy a strict reading of “every patient is uniquely procedurally generated and incapable of echoing real patient content,” because identity/biography are fixed catalog personas and the LLM conversation path can improvise or echo therapist-pasted text.

| Criterion | Result |
|---|---|
| Procedurally generated (clinical case) | **PASS** |
| Procedurally generated (identity / full biography) | **PARTIAL** |
| Synthetic / fictional | **PASS** |
| Non-identifiable / no real-patient source | **PASS** |
| Incapable of reproducing a real patient | **PARTIAL** |

---

## Pathway results

### 1. Case-engine generator / `createCaseForSession` — **PARTIAL**

| Check | Result |
|---|---|
| Fresh immutable CaseInstance per session start | **PASS** |
| Diagnosis from disorder packages, not permanent persona ownership | **PASS** |
| Seeded PRNG contextual randomization (non-DSM) | **PASS** |
| Unique per-session identity generation | **FAIL** (identity from avatar/persona catalog) |

**Evidence**

- Generator produces immutable snapshot with unique `assessment_id`, `memory_scope: "case_instance"`, and `randomized_context` from fixed pools (`STRESSORS`, `FINANCES`, `RELATIONSHIPS`, `MINOR_EVENTS`, `OCCUPATION_VARIANTS`):

```205:284:src/lib/case-engine/generator.ts
/**
 * Module 7 — Case Generator.
 * Produces an immutable CaseInstanceSnapshot. Does not write to the database.
 */
export function generateCaseInstance(
  req: CaseGenerationRequest,
): GenerateCaseResult {
  // ...
  const seed =
    req.seed ??
    `${req.persona.slug}:${req.primaryDisorder.slug}:${req.locale}:${Date.now()}`;
  const rng = createRng(seed);
  const randomized = randomizeContext(rng);
  // ...
  const assessment_id = `VPSY-ASM-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const snapshot: CaseInstanceSnapshot = {
    version: 2,
    assessment_id,
    persona: {
      id: req.persona.id,
      slug: req.persona.slug,
      display_name: req.persona.display_name,
      avatar_id: req.avatarId,
    },
    // ...
    randomized_context: randomized,
    memory_scope: "case_instance",
    generated_at: new Date().toISOString(),
  };
```

- Session start always calls `createCaseForSession` before insert:

```96:111:src/app/api/sessions/route.ts
  const caseResult = await createCaseForSession(supabase, {
    avatar: typedAvatar,
    locale: effectiveLocale,
    therapistId: user.id,
    disorderSlug: body.disorderSlug ?? body.caseId,
    comorbiditySlugs: body.comorbiditySlugs,
    difficulty: body.difficulty,
    therapyModality: body.therapyModality,
    severity: body.severity,
    templateId: body.templateId,
    templateSlug: body.templateSlug,
    presetId: body.presetId,
    presetSlug: body.presetSlug,
    disorderSlugOverride: body.disorderSlugOverride,
  });
```

- Persona identity is loaded from `personas` / avatar fallback — not synthesized as a new human:

```51:70:src/lib/case-engine/persist.ts
function personaFromAvatar(avatar: Avatar, dbPersona?: PersonaRow | null): PersonaRow {
  if (dbPersona) return dbPersona;
  // ...
  return {
    id: avatar.id,
    avatar_id: avatar.id,
    slug: avatar.slug ?? avatar.id,
    display_name: avatar.name,
    identity: { age, gender, source: "avatar_fallback" },
    traits: {},
    baseline_history: {},
    // ...
  };
}
```

- Template/preset paths also call `generateCaseInstance` / `generateFromTemplate` / `generateFromPreset` and persist `case_instances` + empty `case_memory` (`persist.ts` ~301–851). Soft-fail paths may return snapshot-only when tables/FKs missing (migration not applied / legacy synthetic ids) — operational resilience, not a real-patient ingest path.

**Doc invariant:** “Persona must never permanently own a psychiatric disorder” (`docs/DYNAMIC_CLINICAL_CASE_ENGINE.md`).

---

### 2. Life history, family, occupation, education, social / therapy / medical / risk history — **PARTIAL**

| Check | Result |
|---|---|
| Histories are fictional authored training material | **PASS** |
| Histories procedurally generated per session | **FAIL** |
| Risk / psychiatric history from clinical packages + authored case files | **PASS** |
| Thin life-context overlays randomized per case | **PASS** |

**Evidence**

- Authoritative library declares fiction:

```24:24:personas/index.json
    "distribution_note": "These files contain clinical training material only. They describe fictional patients; no field refers to a real person.",
```

- Full biographies live in personality `case_file.identity` (e.g. Maya Chen San Jose/Seattle authored life; ليان خوري Amman; Jordan Hale Austin; رامي نصّار Irbid) — fixed catalog humans, not RNG identity.
- Runtime Module 2 injects identity slices (name, occupation, city, living/family) and substance localization — not a procedural biography synthesizer:

```142:169:src/lib/ai/prompt-engine.ts
MODULE 2 — AVATAR  (personality for {{session.locale}})
...
Identity: {{personality.identity.display_name}}, {{clinical_core.age}},
{{personality.identity.occupation}}, {{personality.identity.city}},
{{personality.identity.country}}.
Living situation: {{personality.identity.living_situation}}
Family: {{personality.identity.family_context}}
...
{{personality.case_file.history_localization.substance_and_medication_context}}
```

- Case-engine randomization explicitly limited to safe non-diagnostic colour (`generator.ts` 39–84; `docs/CLINICAL_SCENARIO_TEMPLATE_ENGINE.md` “Safe only: stressors, finances, minor events, occupation variants, timeline offsets”).
- DB `personas.baseline_history` seeded as placeholder, not live authored full history:

```398:400:supabase/migrations/20260802180922_dynamic_clinical_case_engine.sql
  jsonb_build_object(
    'note', 'Baseline medical/family history remains in legacy clinical_core.case_file until authored into disorder packages.'
  ),
```

- Risk profile comes from disorder packages / clinical_core (`generator.ts` `mergeClinicalCore` risk_defaults; `prompt-engine.ts` Module 4).

---

### 3. Session memory / `case_memory` / PME — **PARTIAL** (PME absent)

| Check | Result |
|---|---|
| PME on `main` @ 5aae138 | **N/A — not present** |
| `case_memory` created per case instance | **PASS** |
| `case_memory` read/updated during conversation | **FAIL** (write-once empty; never read in `src/`) |
| Conversation history isolated to current session | **PASS** |
| Cross-session longitudinal memory runtime | **PARTIAL** (schema/flag only; stubbed) |

**Evidence**

- Repo-wide search: no PME / Patient Memory Engine module on this SHA (branch `cursor/mission-21-pme-0594` exists elsewhere; not in `5aae138`).
- Only writes to `case_memory` are empty inserts in `persist.ts` (e.g. 831–837); **zero** `.from("case_memory")` reads under `src/`.
- Message path loads history by `session_id` only, last 20 turns:

```97:109:src/app/api/sessions/[id]/message/route.ts
  const { data: history } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  // ...
    replyMeta = await generatePatientReplyDetailed({
      avatar: resolved,
      history: (history ?? []) as Pick<SessionMessage, "role" | "content">[],
      userMessage: message,
    });
```

```129:135:src/lib/ai/patient-agent.ts
  const prior = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
```

- Template “longitudinal” memory mode is a no-op (both branches → `case_instance`):

```156:159:src/lib/scenario-templates/generate.ts
    memory_scope:
      template.memory_mode === "longitudinal"
        ? "case_instance"
        : "case_instance",
```

- Authored case files *describe* multi-session memory rules (`personas/maya-chen.case.json` `consistency_rules.memory_rules`), but those rules are **not** wired through a `case_memory` runtime. Net integrity effect at `5aae138`: **no cross-session patient-memory leakage via `case_memory`**.

---

### 4. Conversation + prompt engine — **PASS** (Medium residual)

| Check | Result |
|---|---|
| Patient replies from authored prompt + case clinical_core | **PASS** |
| Role locked to fictional patient | **PASS** |
| No external medical-record retrieval in chat | **PASS** |
| Hard guarantee against echoing therapist-pasted real PHI | **PARTIAL** |

**Evidence**

- System prompt Modules 1–4: simulation patient, native identity, no clinical self-labelling, safety overrides (`src/lib/ai/prompt-engine.ts` 101–251).
- Diagnosis override preserves identity/biography while Module 1 owns syndrome (`src/lib/avatars/resolve.ts` `adaptPersonalityForCaseSnapshot`).
- Generation uses session-scoped history + system prompt only (`patient-agent.ts`); temperature `0.85` allows improvisation within role.
- **Residual Medium:** there is no content filter stripping therapist-supplied real identifiers from `userMessage` before model call (`message/route.ts` 32–41 length-checks only). Product copy warns users not to enter real PHI (`messages/en.json` privacy strings).

---

### 5. Voice generation — **PASS**

| Check | Result |
|---|---|
| TTS from premade ElevenLabs catalog / registry | **PASS** |
| No real-patient voice clone / STS ingest | **PASS** |
| STT is therapist speech → text only | **PASS** |

**Evidence**

- Pipeline: therapist audio → OpenAI STT → same message API → ElevenLabs TTS (`conversation-pipeline.ts` header + `runVoiceConversationTurn`).
- Voice registry documents Avatar → `voice_profile` → ElevenLabs id; legacy columns fallback (`registry.ts` 1–8).
- Premade voice seeds (Bella/Adam-class ids), not user uploads (`supabase/migrations/20260801160000_premade_elevenlabs_voices.sql`; `src/lib/voice/config.ts` defaults).
- TTS API accepts text + voice profile ids only (`src/app/api/voice/tts/route.ts`); multipart upload exists only for STT audio (`src/app/api/voice/transcribe/route.ts`), MIME allowlist excludes PDF (`stt-limits.test.ts`).

---

### 6. Knowledge retrieval — **PASS** (absent by design)

| Check | Result |
|---|---|
| Patient RAG / embeddings / vector retrieval | **Absent — PASS** |
| Clinical knowledge source | Authored personas + disorder packages + prompt assembly |

No patient-facing embedding/vector/Pinecone/similarity retrieval path under `src/` for session replies. “Knowledge” in CGE/ACE refers to learner competency graphs, not patient chart retrieval.

---

### 7. Cross-user / cross-session leakage (message RPCs + RLS) — **PASS** (High note)

| Check | Result |
|---|---|
| Session / message RLS ownership | **PASS** |
| `case_instance_id` rebinding guard | **PASS** |
| Case insert requires `created_by = auth.uid()` | **PASS** |
| App-layer session ownership on message route | **PASS** |
| `insert_assistant_message` body ownership under service_role | **PARTIAL** (app-enforced) |

**Evidence**

- Sessions SELECT/INSERT and messages SELECT/INSERT scoped to `therapist_id = auth.uid()` (+ admin):

```34:77:supabase/migrations/20260803021426_database_certification_hardening.sql
-- Therapists can view/create/update own sessions
-- session_messages SELECT: admin OR owning therapist
-- session_messages INSERT: role = 'user' AND owning active session
```

- Message route rejects non-owners before generation/RPC:

```54:57:src/app/api/sessions/[id]/message/route.ts
  if (typed.therapist_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
```

- Rebinding / ownership freeze:

```32:46:supabase/migrations/20260802230721_production_security_hardening_guards.sql
  if new.case_instance_id is distinct from old.case_instance_id then
    if old.case_instance_id is not null then
      raise exception 'Cannot rebind case_instance_id';
    end if;
    -- ... created_by must match therapist_id
```

- Final function body (`20260803194707_enterprise_security_cert_hardening.sql`) requires `service_role` and does **not** compare `auth.uid()` to `therapist_id` when service role is used. Grants were later restored for `authenticated` (`20260804055602`), but the body still rejects non–service-role callers. Integrity therefore depends on Route Handler ownership checks + `messageRpcClient` preferring service role (`src/lib/supabase/admin.ts`). Documented previously as H3 class risk for `case_memory` rebinding (`docs/PRODUCTION_SECURITY_CERTIFICATION.md`) — **fixed** for rebinding; conversation does not read `case_memory` at this SHA.

- `case_memory` RLS ties access to case creator / session therapist / admin (`20260802180922` policies 503–529).

---

### 8. Name reuse / biography realism — **PARTIAL** (Medium)

| Check | Result |
|---|---|
| Names are fictional catalog identities | **PASS** |
| Per-session unique naming | **FAIL** |
| High-realism biographies | **Intentional** (training fidelity) |

**Evidence**

- Production library is two cases × two locales = four fixed humans (`personas/index.json` cases; Maya Chen / ليان خوري / Jordan Hale / رامي نصّار).
- All trainees reuse the same display names and detailed life stories; only `randomized_context` and diagnosis/difficulty vary.
- Generator tests assert persona slug preserved while diagnosis swaps (`generator.test.ts` “keeps persona identity while swapping diagnosis”).
- **Risk:** coincidence with a real person is theoretically possible for common names; there is no collision-avoidance / name-pool rotation. Mitigated by explicit fictional labelling and no real-patient source data.

---

### 9. Paths that could ingest or echo real medical records — **PASS** (Medium residual echo)

| Path | Ingest real records? | Verdict |
|---|---|---|
| Session message JSON text | Therapist free text only | No chart ingest; echo residual |
| Voice STT multipart | Therapist audio only | **PASS** |
| TTS | Model text → speech | **PASS** |
| Admin template/preset/case preview | Synthetic generation | **PASS** |
| Assessment / ACE ingest | Session scores, not EHR | **PASS** |
| EHR / FHIR / PDF / HL7 APIs | **None found** | **PASS** |

API surface under `src/app/api/` is `sessions`, `voice`, `admin`, `ace`, `cge`, `health` — no medical-record import endpoints.

---

## Findings summary

### Critical
*None evidenced at `5aae138` for real-patient identity ingestion or cross-therapist transcript RLS bypass via documented app paths.*

### High
1. **`insert_assistant_message` service_role path lacks in-body therapist ownership check** (`supabase/migrations/20260803194707_enterprise_security_cert_hardening.sql` lines 25–28 vs older ownership logic in `20260802230703`). Mitigated by Route Handler checks; defense-in-depth regression vs prior RPC body. Severity for *fictional patient integrity* is High only if service-role misuse forges transcripts into another session — not a real-patient generation path.

### Medium
1. **Identity not procedurally unique per session** — fixed authored names/biographies reused globally (`personas/*`, `createCaseForSession` persona load).
2. **LLM improvisation / therapist PHI echo** — `temperature: 0.85`, no PHI scrubber on therapist turns (`patient-agent.ts`, `message/route.ts`).
3. **`case_memory` schema unused; authored multi-session memory rules not runtime-enforced** — integrity currently safer (no cross-session memory), but future PME/longitudinal wiring must preserve isolation.
4. **High-realism fixed biographies** increase coincidental resemblance risk without name-rotation controls.

### Low
1. Soft-fail snapshot-only case persist when migrations/FKs missing (`persist.ts`) — operational, not PHI.
2. In-process TTS cache keyed by text+voice (`elevenlabs/service.ts`) — shared cache of synthetic audio phrases, not cross-user patient charts.
3. Product copy correctly discloses fictional patients (`messages/en.json`).

---

## Overall Synthetic Patient Certification verdict

**CONDITIONAL PASS (PARTIAL) for production `5aae138`.**

VPsych at this SHA is certifiable as a **fictional standardized-patient training system**:

- Patients are **synthetic and fictionally authored**, with distribution language that they refer to no real person.
- Clinical presentations are **procedurally assembled** into immutable CaseInstances (disorder packages + difficulty/therapy + safe randomization).
- There is **no production pathway to ingest real medical records, EHR exports, or real-patient voice clones**.
- Session transcripts and case rows are **ownership-scoped**; conversation history does not pull other users’ sessions or `case_memory` contents.

It is **not** certifiable as fully “procedurally generated unique humans incapable of reproducing a real patient” without caveats: identity is catalog-fixed, and generative chat can echo or invent beyond the case file.

### Recommended certification statement (production)

> At git SHA `5aae138`, VPsych standardized patients are synthetic, fictionally authored training personas with procedurally generated clinical CaseInstances. The platform does not ingest real patient records. Residual risks: fixed-name reuse, LLM improvisation, and therapist-entered free text.

### Gaps to close for a strict full PASS (out of scope unless remediated)

1. Procedural or pooled unique identity generation (or explicit session-scoped aliasing) beyond the two-avatar library.
2. Prompt/runtime hard constraints against inventing PII not in the case file; optional therapist-message PHI scrubbing.
3. If/when PME lands: enforce `memory_scope` isolation and never share memory across therapists/cases.
4. Restore ownership check inside `insert_assistant_message` even for service_role callers (or bind RPC to verified session owner JWT claims).

---

*Evidence cited from repository files at SHA `5aae138` only. No findings invented without file:line support.*
