import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

describe("architecture invariants", () => {
  it("does not re-export ACE bridge from the CGE barrel (breaks ACE↔CGE cycle)", () => {
    const barrel = readFileSync(join(root, "lib/cge/index.ts"), "utf8");
    expect(barrel).not.toMatch(/export \* from ["']\.\/ace-bridge["']/);
  });

  it("requires admin auth on the OpenAI health probe", () => {
    const route = readFileSync(
      join(root, "app/api/health/openai/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/requireApiAdmin/);
    expect(route).toMatch(/OpenAI health probe failed|not configured/);
  });

  it("does not return raw AI failure detail from session end", () => {
    const route = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    expect(route).not.toMatch(/aiFailureDetail:/);
  });

  it("session start/message RPCs fall back when service role is unset", () => {
    const start = readFileSync(join(root, "app/api/sessions/route.ts"), "utf8");
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    expect(start).toMatch(/messageRpcClient/);
    expect(message).toMatch(/messageRpcClient/);
    expect(start).not.toMatch(/error: "Server misconfigured"/);
    expect(message).not.toMatch(/error: "Server misconfigured"/);
  });

  it("wires Conversation Behaviour Engine into the message route (Mission 7)", () => {
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    expect(message).toMatch(/planConversationBehaviour/);
    expect(message).toMatch(/behaviourReinforcement/);
    expect(message).toMatch(/CBE plan failed/);
  });

  it("provides App Router error boundaries", () => {
    expect(() =>
      readFileSync(join(root, "app/error.tsx"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(root, "app/(app)/error.tsx"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(root, "app/global-error.tsx"), "utf8"),
    ).not.toThrow();
  });

  it("exposes a public liveness probe at /api/health", () => {
    const route = readFileSync(join(root, "app/api/health/route.ts"), "utf8");
    expect(route).toMatch(/ok:\s*true/);
    expect(route).toMatch(/service:\s*"vpsych"/);
  });

  it("keeps /validation and invite redeem public for invited experts", () => {
    const mw = readFileSync(join(root, "lib/supabase/middleware.ts"), "utf8");
    expect(mw).toMatch(/path === "\/validation"/);
    expect(mw).toMatch(/path === "\/api\/validation\/invite"/);
    const page = readFileSync(join(root, "app/validation/page.tsx"), "utf8");
    expect(page).toMatch(/ValidationPortal/);
    const invite = readFileSync(
      join(root, "app/api/validation/invite/route.ts"),
      "utf8",
    );
    expect(invite).toMatch(/rateLimit/);
    expect(invite).toMatch(/isValidInviteCode/);
  });

  it("exposes Wave 3 Quality Ledger and research export admin routes", () => {
    const ledger = readFileSync(
      join(root, "app/api/admin/quality-ledger/route.ts"),
      "utf8",
    );
    const research = readFileSync(
      join(root, "app/api/admin/research/export/route.ts"),
      "utf8",
    );
    expect(ledger).toMatch(/requireApiAdmin/);
    expect(research).toMatch(/requireApiAdmin/);
    expect(research).toMatch(/admin\.research\.export/);
  });

  it("preset preview resolves DB rows by presetSlug (W3-H1)", () => {
    const route = readFileSync(
      join(root, "app/api/admin/presets/preview/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/body\.presetSlug/);
    expect(route).toMatch(/\.eq\("slug", body\.presetSlug\)/);
  });

  it("keeps Therapy Room Mode optional behind a feature flag", () => {
    const flag = readFileSync(
      join(root, "lib/therapy-room/feature-flag.ts"),
      "utf8",
    );
    const page = readFileSync(
      join(root, "app/(app)/sessions/[id]/page.tsx"),
      "utf8",
    );
    const start = readFileSync(join(root, "app/api/sessions/route.ts"), "utf8");
    expect(flag).toMatch(/NEXT_PUBLIC_THERAPY_ROOM_MODE/);
    expect(page).toMatch(/VoiceSession/);
    expect(page).toMatch(/TherapyRoomSession/);
    expect(page).toMatch(/isTherapyRoomModeEnabled/);
    expect(start).toMatch(/shouldUseTherapyRoom/);
    expect(start).toMatch(/interaction_mode/);
  });

  it("therapy-room private notes never enter the patient message API", () => {
    const room = readFileSync(
      join(root, "components/therapy-room/TherapyRoomSession.tsx"),
      "utf8",
    );
    expect(room).toMatch(/\/api\/sessions\/\$\{session\.id\}\/therapy-room/);
    expect(room).not.toMatch(/privateNotes.*submitConversationTurn/);
    expect(room).not.toMatch(/message: notes/);
  });

  it("Therapy Room hands-free conversation uses an explicit FSM", () => {
    const fsm = readFileSync(
      join(root, "lib/therapy-room/conversation-fsm.ts"),
      "utf8",
    );
    const room = readFileSync(
      join(root, "components/therapy-room/TherapyRoomSession.tsx"),
      "utf8",
    );
    const constraints = readFileSync(
      join(root, "lib/therapy-room/audio-constraints.ts"),
      "utf8",
    );
    expect(fsm).toMatch(/LISTENING/);
    expect(fsm).toMatch(/PROCESSING_STT/);
    expect(fsm).toMatch(/WAITING_GPT/);
    expect(fsm).toMatch(/AVATAR_SPEAKING/);
    expect(fsm).toMatch(/BARGE_IN/);
    expect(room).toMatch(/createConversationFsm/);
    expect(room).toMatch(/data-trm-hands-free/);
    expect(room).not.toMatch(/startRecording|toggleMic|click.*microphone/i);
    expect(constraints).toMatch(/autoGainControl:\s*true/);
    expect(constraints).toMatch(/echoCancellation:\s*true/);
    expect(constraints).toMatch(/noiseSuppression:\s*true/);
  });

  it("gates VMHC clinic routes and APIs behind FEATURE_THERAPY_ROOM", () => {
    const features = readFileSync(join(root, "lib/features.ts"), "utf8");
    expect(features).toMatch(/FEATURE_THERAPY_ROOM/);
    const clinicPage = readFileSync(
      join(root, "app/(app)/clinic/page.tsx"),
      "utf8",
    );
    expect(clinicPage).toMatch(/isTherapyRoomEnabled/);
    const notes = readFileSync(
      join(root, "app/api/sessions/[id]/notes/route.ts"),
      "utf8",
    );
    expect(notes).toMatch(/isTherapyRoomEnabled/);
    const supervisor = readFileSync(
      join(root, "app/api/sessions/[id]/supervisor/route.ts"),
      "utf8",
    );
    expect(supervisor).toMatch(/isTherapyRoomEnabled/);
    expect(supervisor).toMatch(/report:\s*null/);
  });

  it("does not feed VMHC private notes into the patient message route", () => {
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    expect(message).not.toMatch(/session_private_notes/);
    expect(message).not.toMatch(/private.?notes/i);
  });

  it("Emotion Engine soft-fails on the message path and exposes a session API", () => {
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    const emotionApi = readFileSync(
      join(root, "app/api/sessions/[id]/emotion/route.ts"),
      "utf8",
    );
    const barrel = readFileSync(join(root, "lib/emotion/index.ts"), "utf8");
    expect(message).toMatch(/processEmotionTurn/);
    expect(message).toMatch(/emotion engine soft-fail/);
    expect(message).toMatch(/emotion:\s*emotionPayload/);
    expect(emotionApi).toMatch(/rateLimit/);
    expect(emotionApi).toMatch(/ensureEmotionState|processEmotionTurn/);
    expect(barrel).toMatch(/tickEmotion/);
    expect(barrel).toMatch(/deriveExpression/);
  });

  it("Mission 8 adaptation is best-effort on the message route", () => {
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    const barrel = readFileSync(join(root, "lib/adaptation/index.ts"), "utf8");
    expect(message).toMatch(/processTherapistTurn/);
    expect(message).toMatch(/adaptationBlock/);
    expect(message).toMatch(/void saveAdaptationState/);
    expect(barrel).toMatch(/export \* from|from "@\/lib\/adaptation\/engine"/);
    expect(barrel).toMatch(/rapport/);
    expect(barrel).toMatch(/trust/);
  });

  it("Mission 4 long-term patient memory is wired best-effort on message + end", () => {
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    const end = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    const barrel = readFileSync(
      join(root, "lib/patient-memory/index.ts"),
      "utf8",
    );
    expect(message).toMatch(/prepareMemoryForTurn/);
    expect(end).toMatch(/runPatientMemoryAfterSession/);
    expect(barrel).toMatch(/summarize/);
    expect(barrel).toMatch(/compress/);
    expect(barrel).toMatch(/retrieve/);
  });

  it("wires Mission 10 Humanization Engine into the message route", () => {
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    const barrel = readFileSync(join(root, "lib/humanization/index.ts"), "utf8");
    expect(message).toMatch(/buildHumanizationTurn/);
    expect(message).toMatch(/humanizationEnabled/);
    expect(message).toMatch(/voiceHints/);
    expect(barrel).toMatch(/emotionTick/);
    expect(barrel).toMatch(/behaviorTick/);
    expect(barrel).toMatch(/memoryTick/);
    expect(barrel).toMatch(/voiceTick/);
    // Clinical gates must remain — humanity never overrides risk safety.
    const gates = readFileSync(
      join(root, "lib/humanization/clinical-gates.ts"),
      "utf8",
    );
    expect(gates).toMatch(/blocked during active risk/);
  });

  it("keeps Stage 2 canonical architecture documentation present", () => {
    const doc = readFileSync(
      join(process.cwd(), "docs/SOFTWARE_ARCHITECTURE.md"),
      "utf8",
    );
    expect(doc).toMatch(/Ownership matrix/);
    expect(doc).toMatch(/Dependency graph/);
    expect(doc).toMatch(/Runtime pipelines/);
    expect(doc).toMatch(/Prompt architecture/);
    expect(doc).toMatch(/Database architecture/);
    expect(doc).toMatch(/API map/);
    expect(doc).toMatch(/Extension points/);
    // Message-path order must stay aligned with the documented pipeline.
    expect(doc).toMatch(
      /Adaptation[\s\S]*resolveAvatar[\s\S]*Patient Memory[\s\S]*Emotion[\s\S]*CBE[\s\S]*Humanization/,
    );
  });

  it("keeps Stage 3 canonical clinical information model present", () => {
    const rootDocs = join(process.cwd(), "docs/clinical");
    const dataModel = readFileSync(
      join(rootDocs, "CLINICAL_DATA_MODEL.md"),
      "utf8",
    );
    const ontology = readFileSync(join(rootDocs, "PATIENT_ONTOLOGY.md"), "utf8");
    const gaps = readFileSync(
      join(rootDocs, "CLINICAL_GAP_ANALYSIS.md"),
      "utf8",
    );
    const roadmap = readFileSync(join(rootDocs, "CLINICAL_ROADMAP.md"), "utf8");
    expect(dataModel).toMatch(/PATIENT_ONTOLOGY/);
    expect(dataModel).toMatch(/Single patient ontology/);
    expect(ontology).toMatch(/SyntheticPatient/);
    expect(ontology).toMatch(/ClinicalCore/);
    expect(ontology).toMatch(/One owner per concept/);
    expect(gaps).toMatch(/Protective factors/);
    expect(gaps).toMatch(/Mental Status/);
    expect(roadmap).toMatch(/Critical/);
    // Required Stage 3 package files must exist.
    for (const name of [
      "PATIENT_LIFECYCLE.md",
      "CASE_MODEL.md",
      "DSM_MAPPING.md",
      "ICD_MAPPING.md",
      "SYMPTOM_MODEL.md",
      "MENTAL_STATUS_MODEL.md",
      "THERAPY_STATE_MODEL.md",
      "RISK_MODEL.md",
      "MEMORY_MODEL.md",
      "LIVING_ENVIRONMENT_MODEL.md",
      "CULTURAL_CONTEXT_MODEL.md",
    ]) {
      expect(() => readFileSync(join(rootDocs, name), "utf8")).not.toThrow();
    }
  });

  it("keeps Stage 4 canonical runtime cognitive architecture present", () => {
    const rootDocs = join(process.cwd(), "docs/runtime");
    const cognitive = readFileSync(
      join(rootDocs, "COGNITIVE_ARCHITECTURE.md"),
      "utf8",
    );
    const pipeline = readFileSync(join(rootDocs, "RUNTIME_PIPELINE.md"), "utf8");
    const ownership = readFileSync(
      join(rootDocs, "ENGINE_OWNERSHIP.md"),
      "utf8",
    );
    const debt = readFileSync(join(rootDocs, "RUNTIME_DEBT.md"), "utf8");
    expect(cognitive).toMatch(/one psychiatric patient mind|One mind/i);
    expect(cognitive).toMatch(/composition root/i);
    expect(pipeline).toMatch(/Adaptation/);
    expect(pipeline).toMatch(/Humanization/);
    expect(pipeline).toMatch(
      /Emotion[\s\S]*CBE[\s\S]*Humanization[\s\S]*Reply|cbe_direct/,
    );
    expect(ownership).toMatch(/case_memory/);
    expect(debt).toMatch(/RT-01/);
    for (const name of [
      "ENGINE_CONTRACTS.md",
      "ENGINE_INTERACTIONS.md",
      "ORCHESTRATION.md",
      "STATE_MACHINE.md",
      "FAILURE_RECOVERY.md",
      "LATENCY_BUDGET.md",
      "TOKEN_BUDGET.md",
      "PERFORMANCE_MODEL.md",
      "OBSERVABILITY.md",
    ]) {
      expect(() => readFileSync(join(rootDocs, name), "utf8")).not.toThrow();
    }
  });

  it("Stage 6 Clinical Intelligence layer is present and wired without replacing engines", () => {
    const barrel = readFileSync(
      join(root, "lib/clinical-intelligence/index.ts"),
      "utf8",
    );
    const decision = readFileSync(
      join(root, "lib/clinical-intelligence/decision.ts"),
      "utf8",
    );
    const promote = readFileSync(
      join(root, "lib/clinical-intelligence/promote.ts"),
      "utf8",
    );
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    const start = readFileSync(join(root, "app/api/sessions/route.ts"), "utf8");
    const generator = readFileSync(
      join(root, "lib/case-engine/generator.ts"),
      "utf8",
    );
    const types = readFileSync(join(root, "lib/types.ts"), "utf8");
    const memoryTypes = readFileSync(
      join(root, "lib/patient-memory/types.ts"),
      "utf8",
    );

    expect(barrel).toMatch(/clinical-intelligence\/decision/);
    expect(barrel).toMatch(/clinical-intelligence\/promote/);
    expect(barrel).toMatch(/clinical-intelligence\/longitudinal/);
    expect(decision).toMatch(/export function decidePatientTurn/);
    expect(promote).toMatch(/export function promoteClinicalIntelligence/);
    expect(message).toMatch(/decidePatientTurn/);
    expect(message).toMatch(/decision plan soft-fail/);
    expect(message).toMatch(/loadDyadClinicalCarry/);
    expect(start).toMatch(/loadDyadClinicalCarry/);
    expect(generator).toMatch(/promoteClinicalIntelligence/);
    expect(types).toMatch(/protective_factors\?/);
    expect(types).toMatch(/formulation\?/);
    expect(types).toMatch(/mse\?/);
    // Must not invent a parallel patient mind barrel that re-exports Emotion/CBE as owners
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/emotion["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/conversation-behaviour["']/);
    // LTM extensions are additive
    expect(memoryTypes).toMatch(/"belief"/);
    expect(memoryTypes).toMatch(/"protective"/);
    expect(memoryTypes).toMatch(/"previous_session"/);

    const ciDocs = join(process.cwd(), "docs/clinical-intelligence");
    expect(() => readFileSync(join(ciDocs, "README.md"), "utf8")).not.toThrow();
  });

  it("Stage 6 preserves Adaptation→resolve→Memory→Emotion→CBE→Humanization order", () => {
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    // Match call sites, not imports.
    const adp = message.indexOf("const adapted = processTherapistTurn");
    const resolve = message.indexOf("const resolved = resolveAvatar");
    const mem = message.indexOf("const memoryCtx = await prepareMemoryForTurn");
    const emo = message.indexOf("await processEmotionTurn");
    const cbe = message.indexOf("behaviourPlan = planConversationBehaviour");
    const decision = message.indexOf("decisionPlan = decidePatientTurn");
    const hum = message.indexOf("humanization = buildHumanizationTurn");
    expect(adp).toBeGreaterThan(-1);
    expect(resolve).toBeGreaterThan(adp);
    expect(mem).toBeGreaterThan(resolve);
    expect(emo).toBeGreaterThan(mem);
    expect(cbe).toBeGreaterThan(emo);
    expect(decision).toBeGreaterThan(cbe);
    expect(hum).toBeGreaterThan(decision);
  });

  it("Stage 7 Education layer observes ACE/assessment and never owns patient mind", () => {
    const barrel = readFileSync(join(root, "lib/education/index.ts"), "utf8");
    const bridge = readFileSync(
      join(root, "lib/education/session-bridge.ts"),
      "utf8",
    );
    const end = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    const cgeBarrel = readFileSync(join(root, "lib/cge/index.ts"), "utf8");
    const framework = readFileSync(
      join(root, "lib/education/competency-framework.ts"),
      "utf8",
    );

    expect(barrel).toMatch(/runEducationAfterAssessment/);
    expect(barrel).toMatch(/scoreEducationCompetencies/);
    expect(bridge).toMatch(/runAceAfterAssessment/);
    expect(bridge).toMatch(/Never writes patient clinical state|never touches patient/i);
    expect(end).toMatch(/runEducationAfterAssessment/);
    expect(end).not.toMatch(/from ["']@\/lib\/ace\/session-hook["']/);
    // CGE must still not re-export ace-bridge (comment mention is OK)
    expect(cgeBarrel).not.toMatch(/from\s+["']\.\/ace-bridge["']/);
    expect(cgeBarrel).not.toMatch(/export\s+\*\s+from\s+["']\.\/ace-bridge["']/);
    // Must not fork weightedOverall
    expect(framework).not.toMatch(/weightedOverall\s*\(/);
    expect(framework).toMatch(/weightedEducationOverall/);

    const eduDocs = join(process.cwd(), "docs/education");
    expect(() => readFileSync(join(eduDocs, "README.md"), "utf8")).not.toThrow();
    expect(() =>
      readFileSync(join(eduDocs, "IMPLEMENTATION.md"), "utf8"),
    ).not.toThrow();
  });

  it("Stage 8 Validation layer observes only and never owns patient mind", () => {
    const barrel = readFileSync(join(root, "lib/validation/index.ts"), "utf8");
    const bridge = readFileSync(
      join(root, "lib/validation/session-bridge.ts"),
      "utf8",
    );
    const end = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    const adminRoute = readFileSync(
      join(root, "app/api/admin/validation/route.ts"),
      "utf8",
    );
    const versions = readFileSync(
      join(root, "lib/validation/versions.ts"),
      "utf8",
    );

    expect(barrel).toMatch(/runValidationAfterAssessment/);
    expect(barrel).toMatch(/runValidationPipeline/);
    expect(bridge).toMatch(/Never writes clinical_snapshot/);
    expect(bridge).toMatch(/observational only|Observational/i);
    expect(end).toMatch(/runValidationAfterAssessment/);
    expect(end).toMatch(/validation soft-fail|Stage 8 Scientific Validation/);
    expect(adminRoute).toMatch(/requireApiAdmin/);
    expect(adminRoute).toMatch(/rateLimit/);
    expect(versions).toMatch(/VALIDATION_OWNERSHIP_RULE/);
    expect(versions).toMatch(/clinical_snapshot/);
    // Must not re-export patient cognition engines as owners
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/emotion["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/conversation-behaviour["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/clinical-intelligence["']/);

    const valDocs = join(process.cwd(), "docs");
    expect(() =>
      readFileSync(join(valDocs, "RESEARCH_ARCHITECTURE.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(valDocs, "VALIDATION_PIPELINE.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(valDocs, "PUBLICATION_GUIDE.md"), "utf8"),
    ).not.toThrow();
  });

  it("Stage 9 Supervisor AI observes therapists only and never owns patient mind", () => {
    const barrel = readFileSync(join(root, "lib/supervisor/index.ts"), "utf8");
    const bridge = readFileSync(
      join(root, "lib/supervisor/session-bridge.ts"),
      "utf8",
    );
    const versions = readFileSync(
      join(root, "lib/supervisor/versions.ts"),
      "utf8",
    );
    const end = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    const summary = readFileSync(
      join(root, "app/api/supervisor/summary/route.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(root, "app/api/admin/supervisor/route.ts"),
      "utf8",
    );

    expect(barrel).toMatch(/runSupervisorAfterAssessment/);
    expect(barrel).toMatch(/runSupervisorEngine/);
    expect(bridge).toMatch(/Never writes clinical_snapshot/);
    expect(bridge).toMatch(/Never owns Emotion|observes only/i);
    expect(versions).toMatch(/SUPERVISOR_OWNERSHIP_RULE/);
    expect(versions).toMatch(/clinical_snapshot/);
    expect(end).toMatch(/runSupervisorAfterAssessment/);
    expect(end).toMatch(/supervisor soft-fail|Stage 9 Supervisor/);
    expect(summary).toMatch(/rateLimit/);
    expect(admin).toMatch(/requireApiAdmin/);
    expect(admin).toMatch(/rateLimit/);

    // Must not re-export patient cognition owners
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/emotion["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/adaptation["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/clinical-intelligence["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/case-engine["']/);

    // Must not fork weightedOverall
    const evalSrc = readFileSync(
      join(root, "lib/supervisor/therapist-evaluation.ts"),
      "utf8",
    );
    expect(evalSrc).not.toMatch(/function weightedOverall\s*\(/);
    expect(evalSrc).toMatch(/weightedTherapistOverall/);

    const docs = join(process.cwd(), "docs");
    expect(() =>
      readFileSync(join(docs, "SUPERVISOR_ARCHITECTURE.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "COMPETENCY_FRAMEWORK.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "EDUCATIONAL_MODEL.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "SUPERVISION_PIPELINE.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "PORTFOLIO_MODEL.md"), "utf8"),
    ).not.toThrow();
  });

  it("Stage 11 Realtime owns presentation only and never owns patient mind", () => {
    const barrel = readFileSync(join(root, "lib/realtime/index.ts"), "utf8");
    const bridge = readFileSync(
      join(root, "lib/realtime/session-bridge.ts"),
      "utf8",
    );
    const versions = readFileSync(
      join(root, "lib/realtime/versions.ts"),
      "utf8",
    );
    const end = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    const summary = readFileSync(
      join(root, "app/api/realtime/summary/route.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(root, "app/api/admin/realtime/route.ts"),
      "utf8",
    );
    const stream = readFileSync(
      join(root, "app/api/sessions/[id]/message/stream/route.ts"),
      "utf8",
    );
    const pipeline = readFileSync(
      join(root, "lib/voice/conversation-pipeline.ts"),
      "utf8",
    );

    expect(barrel).toMatch(/runRealtimeAfterAssessment/);
    expect(barrel).toMatch(/runRealtimeEngine/);
    expect(barrel).toMatch(/createVoiceGateway/);
    expect(bridge).toMatch(/Never writes clinical_snapshot/);
    expect(bridge).toMatch(/Never owns Emotion|presentation/i);
    expect(versions).toMatch(/REALTIME_OWNERSHIP_RULE/);
    expect(versions).toMatch(/clinical_snapshot/);
    expect(end).toMatch(/runRealtimeAfterAssessment/);
    expect(end).toMatch(/realtime soft-fail|Stage 11 Realtime/);
    expect(summary).toMatch(/rateLimit/);
    expect(admin).toMatch(/requireApiAdmin/);
    expect(admin).toMatch(/rateLimit/);
    expect(stream).toMatch(/classicMessagePost|POST as classicMessagePost/);
    expect(stream).toMatch(/isRealtimeStreamingEnabled/);
    expect(pipeline).toMatch(/therapistInterrupted/);

    // Must not re-export patient cognition owners
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/emotion["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/adaptation["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/clinical-intelligence["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/case-engine["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/enterprise["']/);

    const docs = join(process.cwd(), "docs");
    expect(() =>
      readFileSync(join(docs, "REALTIME_ARCHITECTURE.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "VOICE_PIPELINE.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "AVATAR_ARCHITECTURE.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "STREAMING_ENGINE.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "MULTILINGUAL_ENGINE.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "PERFORMANCE_GUIDE.md"), "utf8"),
    ).not.toThrow();
  });

  it("Stage 10 Enterprise Platform owns tenancy only and never owns patient mind", () => {
    const barrel = readFileSync(join(root, "lib/enterprise/index.ts"), "utf8");
    const bridge = readFileSync(
      join(root, "lib/enterprise/session-bridge.ts"),
      "utf8",
    );
    const versions = readFileSync(
      join(root, "lib/enterprise/versions.ts"),
      "utf8",
    );
    const end = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    const summary = readFileSync(
      join(root, "app/api/enterprise/summary/route.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(root, "app/api/admin/enterprise/route.ts"),
      "utf8",
    );
    const verify = readFileSync(
      join(root, "app/api/enterprise/certificates/verify/route.ts"),
      "utf8",
    );
    const mw = readFileSync(join(root, "lib/supabase/middleware.ts"), "utf8");

    expect(barrel).toMatch(/runEnterpriseAfterAssessment/);
    expect(barrel).toMatch(/runEnterpriseEngine/);
    expect(barrel).toMatch(/assertTenantAccess/);
    expect(bridge).toMatch(/Never writes clinical_snapshot/);
    expect(bridge).toMatch(/Never owns Emotion|tenancy analytics only/i);
    expect(versions).toMatch(/ENTERPRISE_OWNERSHIP_RULE/);
    expect(versions).toMatch(/clinical_snapshot/);
    expect(end).toMatch(/runEnterpriseAfterAssessment/);
    expect(end).toMatch(/enterprise soft-fail|Stage 10 Enterprise/);
    expect(summary).toMatch(/rateLimit/);
    expect(admin).toMatch(/requireApiAdmin/);
    expect(admin).toMatch(/rateLimit/);
    expect(verify).toMatch(/verifyCertificate/);
    expect(verify).toMatch(/rateLimit/);
    expect(mw).toMatch(/\/api\/enterprise\/certificates\/verify/);

    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/emotion["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/adaptation["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/clinical-intelligence["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/case-engine["']/);
    expect(barrel).not.toMatch(/export \* from ["']@\/lib\/supervisor["']/);

    const docs = join(process.cwd(), "docs");
    expect(() =>
      readFileSync(join(docs, "ENTERPRISE_ARCHITECTURE.md"), "utf8"),
    ).not.toThrow();
    expect(() => readFileSync(join(docs, "TENANT_MODEL.md"), "utf8")).not.toThrow();
    expect(() => readFileSync(join(docs, "RBAC_MODEL.md"), "utf8")).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "ORGANIZATION_MODEL.md"), "utf8"),
    ).not.toThrow();
    expect(() => readFileSync(join(docs, "COURSE_ENGINE.md"), "utf8")).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "CERTIFICATION_ENGINE.md"), "utf8"),
    ).not.toThrow();
    expect(() =>
      readFileSync(join(docs, "ANALYTICS_ARCHITECTURE.md"), "utf8"),
    ).not.toThrow();
    expect(() => readFileSync(join(docs, "SECURITY_MODEL.md"), "utf8")).not.toThrow();
    expect(() => readFileSync(join(docs, "OBSERVABILITY.md"), "utf8")).not.toThrow();
    expect(() => readFileSync(join(docs, "API_GUIDE.md"), "utf8")).not.toThrow();
  });

  it("Stage 12 rate-limits scientific admin dashboards and OpenAI health", () => {
    const routes = [
      "app/api/admin/ale/route.ts",
      "app/api/admin/avi/route.ts",
      "app/api/admin/cfi/route.ts",
      "app/api/admin/cge/route.ts",
      "app/api/admin/eri/route.ts",
      "app/api/admin/rrs/route.ts",
      "app/api/admin/vqi/route.ts",
      "app/api/admin/quality-ledger/route.ts",
      "app/api/admin/ace/learners/route.ts",
      "app/api/health/openai/route.ts",
      "app/api/admin/ops/metrics/route.ts",
    ];
    for (const rel of routes) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src, rel).toMatch(/rateLimit/);
      expect(src, rel).toMatch(/requireApiAdmin/);
    }
  });

  it("Stage 12 ElevenLabs TTS uses AbortSignal timeout", () => {
    const service = readFileSync(
      join(root, "lib/voice/elevenlabs/service.ts"),
      "utf8",
    );
    expect(service).toMatch(/AbortSignal\.timeout/);
    expect(service).toMatch(/elevenLabsTimeoutMs/);
    expect(service).toMatch(/TTS_TIMEOUT/);
  });

  it("Stage 12 correlates STT → message → TTS with X-Request-Id", () => {
    const stt = readFileSync(
      join(root, "app/api/voice/transcribe/route.ts"),
      "utf8",
    );
    const msg = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    const tts = readFileSync(join(root, "app/api/voice/tts/route.ts"), "utf8");
    for (const src of [stt, msg, tts]) {
      expect(src).toMatch(/resolveRequestId/);
      expect(src).toMatch(/requestIdHeaders/);
    }
  });

  it("Stage 12 production certification docs exist and ownership is preserved", () => {
    const docs = join(process.cwd(), "docs");
    for (const name of [
      "PRODUCTION_READINESS.md",
      "SECURITY_AUDIT.md",
      "DEPLOYMENT_GUIDE.md",
      "DISASTER_RECOVERY.md",
      "INCIDENT_RESPONSE.md",
      "PERFORMANCE_REPORT.md",
      "RELEASE_CERTIFICATION.md",
      "OPERATIONS_RUNBOOK.md",
    ]) {
      expect(() => readFileSync(join(docs, name), "utf8")).not.toThrow();
    }
    expect(() =>
      readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8"),
    ).not.toThrow();

    const state = readFileSync(join(docs, "ARCHITECTURE_STATE.md"), "utf8");
    expect(state).toMatch(/Stage 12/);
    expect(state).toMatch(/Production Release Certification/);

    const ownership = readFileSync(
      join(docs, "runtime/ENGINE_OWNERSHIP.md"),
      "utf8",
    );
    expect(ownership).toMatch(/Forbidden ownership claims/);
    // Stage 12 may only harden cross-cutting controls — never own cognition.
    expect(ownership).toMatch(
      /Stage 12 \*\*does not\*\* own PatientDecisionPlan/,
    );
    expect(ownership).toMatch(
      /rate limits, timeouts, correlation, env checks, CI gates/,
    );
  });

  it("CIDP package exists without claiming Clinical Core ownership", () => {
    const cidp = join(process.cwd(), "docs/cidp");
    for (const name of [
      "README.md",
      "EXECUTIVE_DEPLOYMENT_REPORT.md",
      "INSTITUTIONAL_DEPLOYMENT_CHECKLIST.md",
      "ADMINISTRATOR_GUIDE.md",
      "FACULTY_GUIDE.md",
      "RESIDENT_GUIDE.md",
      "RESEARCH_GUIDE.md",
      "IT_OPERATIONS_GUIDE.md",
      "OPERATIONS_MANUAL.md",
      "SECURITY_REPORT.md",
      "DISASTER_RECOVERY_REPORT.md",
      "PILOT_REPORT_TEMPLATE.md",
      "GA_READINESS_REPORT.md",
      "RELEASE_BOARD_PACKAGE.md",
      "FEEDBACK_MANAGEMENT.md",
      "EXECUTIVE_LEADERSHIP_BRIEF.md",
      "HOSPITAL_ADMINISTRATION_GUIDE.md",
      "evidence/governance/GOVERNANCE_ATTESTATIONS.md",
      "evidence/security/SECURITY_EVIDENCE_LOG.md",
      "evidence/dr/DR_EVIDENCE_LOG.md",
    ]) {
      expect(() => readFileSync(join(cidp, name), "utf8")).not.toThrow();
    }

    const ga = readFileSync(join(cidp, "GA_READINESS_REPORT.md"), "utf8");
    expect(ga).toMatch(/Do NOT declare General Availability/);
    expect(ga).toMatch(/GO for CIDP/);

    const weekly = readFileSync(
      join(root, "app/api/admin/ops/cidp/weekly/route.ts"),
      "utf8",
    );
    expect(weekly).toMatch(/requireApiAdmin/);
    expect(weekly).toMatch(/buildWeeklyReports/);

    const ownership = readFileSync(
      join(process.cwd(), "docs/runtime/ENGINE_OWNERSHIP.md"),
      "utf8",
    );
    expect(ownership).toMatch(/CIDP ownership note/);
    expect(ownership).toMatch(/never patient-state writers/);

    const feedbackRoute = readFileSync(
      join(root, "app/api/feedback/route.ts"),
      "utf8",
    );
    expect(feedbackRoute).toMatch(/requireApiUser/);
    expect(feedbackRoute).toMatch(/rateLimit/);
    expect(feedbackRoute).not.toMatch(/clinical_snapshot/);

    const cidpRoute = readFileSync(
      join(root, "app/api/admin/ops/cidp/route.ts"),
      "utf8",
    );
    expect(cidpRoute).toMatch(/requireApiAdmin/);
    expect(cidpRoute).toMatch(/buildCidpDashboards/);
  });

  it("Phase 14 GA readiness program never owns Clinical Core", () => {
    const stage14 = join(process.cwd(), "docs/stage14");
    for (const name of [
      "README.md",
      "EXECUTIVE_SUMMARY.md",
      "GA_DECISION_FRAMEWORK.md",
      "RISK_REGISTER.md",
      "LESSONS_LEARNED_REGISTER.md",
      "RELEASE_BOARD_PACKAGE.md",
      "FINAL_V1_AUTHORIZATION_PACKAGE.md",
      "GLOBAL_INSTITUTIONAL_PILOT.md",
      "CLINICAL_EVIDENCE_FRAMEWORK.md",
    ]) {
      expect(() => readFileSync(join(stage14, name), "utf8")).not.toThrow();
    }

    const exec = readFileSync(join(stage14, "EXECUTIVE_SUMMARY.md"), "utf8");
    expect(exec).toMatch(/NO-GO for General Availability/);
    expect(exec).toMatch(/GO for CIDP/);

    const gates = readFileSync(
      join(root, "lib/ops/phase14-ga-gates.ts"),
      "utf8",
    );
    expect(gates).toMatch(/evaluateGaReadiness/);
    expect(gates).toMatch(/dr_drill_completed/);
    expect(gates).toMatch(/executive_release_board_authorization/);
    expect(gates).not.toMatch(/clinical_snapshot/);

    const readiness = readFileSync(
      join(root, "lib/ops/phase14-readiness.ts"),
      "utf8",
    );
    expect(readiness).toMatch(/Never writes Clinical Core/);

    const route = readFileSync(
      join(root, "app/api/admin/ops/phase14/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/requireApiAdmin/);
    expect(route).toMatch(/rateLimit/);
    expect(route).toMatch(/buildPhase14Readiness/);
    expect(route).not.toMatch(/clinical_snapshot/);

    const ownership = readFileSync(
      join(process.cwd(), "docs/runtime/ENGINE_OWNERSHIP.md"),
      "utf8",
    );
    expect(ownership).toMatch(/Phase 14 ownership note/);
    expect(ownership).toMatch(/never patient-state writers/);

    const riskLog = readFileSync(
      join(process.cwd(), "docs/cidp/evidence/risk/RISK_REGISTER.md"),
      "utf8",
    );
    expect(riskLog).toMatch(/RISK-P14-01/);
  });

  it("Phase 15 GA authorization package refuses GA without fabricating drills", () => {
    const stage15 = join(process.cwd(), "docs/stage15");
    for (const name of [
      "README.md",
      "GA_AUTHORIZATION.md",
      "FINAL_GA_READINESS_REPORT.md",
      "EXECUTIVE_BOARD_PACKAGE.md",
      "CLINICAL_VALIDATION_REPORT.md",
      "EDUCATIONAL_VALIDATION_REPORT.md",
      "RESEARCH_VALIDATION_REPORT.md",
      "SECURITY_CERTIFICATION_REPORT.md",
      "DISASTER_RECOVERY_CERTIFICATION.md",
      "INFRASTRUCTURE_CERTIFICATION.md",
      "PILOT_COMPLETION_REPORT.md",
      "RISK_CLOSURE_REPORT.md",
      "LESSONS_LEARNED_REPORT.md",
      "FINAL_RELEASE_NOTES.md",
    ]) {
      expect(() => readFileSync(join(stage15, name), "utf8")).not.toThrow();
    }

    const authDoc = readFileSync(join(stage15, "GA_AUTHORIZATION.md"), "utf8");
    expect(authDoc).toMatch(/NO-GO/);
    expect(authDoc).toMatch(/Do not authorize/);
    expect(authDoc).not.toMatch(/AUTHORIZED — tag v1\.0\.0/);

    const authCode = readFileSync(
      join(root, "lib/ops/phase15-ga-authorization.ts"),
      "utf8",
    );
    expect(authCode).toMatch(/evaluatePhase15Authorization/);
    expect(authCode).toMatch(/never writes Clinical Core/);
    expect(authCode).toMatch(/Fabricating DR\/PITR\/pilot evidence is prohibited/);

    const route = readFileSync(
      join(root, "app/api/admin/ops/phase15/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/requireApiAdmin/);
    expect(route).toMatch(/rateLimit/);
    expect(route).toMatch(/buildPhase15Readiness/);
    expect(route).not.toMatch(/clinical_snapshot/);

    const ownership = readFileSync(
      join(process.cwd(), "docs/runtime/ENGINE_OWNERSHIP.md"),
      "utf8",
    );
    expect(ownership).toMatch(/Phase 15 ownership note/);
    expect(ownership).toMatch(/never patient-state writers/);

    const rdl = readFileSync(
      join(process.cwd(), "docs/RELEASE_DECISION_LOG.md"),
      "utf8",
    );
    expect(rdl).toMatch(/RDL-032/);
    expect(rdl).toMatch(/GA NO-GO/);
  });

  it("Phase 16 execution evidence never fabricates pilots or drills", () => {
    const stage16 = join(process.cwd(), "docs/stage16");
    for (const name of [
      "README.md",
      "EVIDENCE_POLICY.md",
      "EXECUTION_CHARTER.md",
      "GA_READINESS_DASHBOARD.md",
      "WEEKLY_EXECUTIVE_REPORT.md",
      "MONTHLY_PILOT_REPORT.md",
      "FINAL_RELEASE_AUTHORIZATION_PACKAGE.md",
    ]) {
      expect(() => readFileSync(join(stage16, name), "utf8")).not.toThrow();
    }

    const policy = readFileSync(join(stage16, "EVIDENCE_POLICY.md"), "utf8");
    expect(policy).toMatch(/Evidence Pending/);
    expect(policy).toMatch(/Do \*\*not\*\* fabricate/);

    const state = readFileSync(
      join(root, "lib/ops/phase16-evidence-state.ts"),
      "utf8",
    );
    expect(state).toMatch(/EVIDENCE_PENDING/);
    expect(state).toMatch(/Never fabricate/);

    const institutions = readFileSync(
      join(root, "lib/ops/phase16-institutions.ts"),
      "utf8",
    );
    expect(institutions).toMatch(/do not invent pilots/);

    const gates = readFileSync(
      join(root, "lib/ops/phase16-ga-gates.ts"),
      "utf8",
    );
    expect(gates).toMatch(/penetration_test_completed/);
    expect(gates).toMatch(/Evidence Pending/);

    const route = readFileSync(
      join(root, "app/api/admin/ops/phase16/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/requireApiAdmin/);
    expect(route).toMatch(/rateLimit/);
    expect(route).toMatch(/buildPhase16Execution/);
    expect(route).toMatch(/institutions: \[\]/);
    expect(route).not.toMatch(/clinical_snapshot/);

    const ownership = readFileSync(
      join(process.cwd(), "docs/runtime/ENGINE_OWNERSHIP.md"),
      "utf8",
    );
    expect(ownership).toMatch(/Phase 16 ownership note/);
    expect(ownership).toMatch(/never fabricated operational evidence/);

    const rdl = readFileSync(
      join(process.cwd(), "docs/RELEASE_DECISION_LOG.md"),
      "utf8",
    );
    expect(rdl).toMatch(/RDL-033/);
  });

  it("Phase 3C — admin-test end gate precedes assessSession", () => {
    const end = readFileSync(
      join(root, "app/api/sessions/[id]/end/route.ts"),
      "utf8",
    );
    const skipIdx = end.indexOf("assertAdminTestSkipAllowed");
    const assessIdx = end.indexOf("assessSession({");
    expect(skipIdx).toBeGreaterThan(-1);
    expect(assessIdx).toBeGreaterThan(-1);
    expect(skipIdx).toBeLessThan(assessIdx);
    expect(end).toMatch(/admin\.avatar\.test_session\.forged_skip_denied/);
    expect(end).toMatch(/skippedAssessment:\s*true/);
  });

  it("Phase 3C — learner session create strips admin_test markers", () => {
    const start = readFileSync(join(root, "app/api/sessions/route.ts"), "utf8");
    expect(start).toMatch(/stripAdminTestMarker/);
    expect(start).not.toMatch(/withAdminTestMarker/);
    expect(start).not.toMatch(/adminTest/);
  });

  it("speech-text layer never writes display text or clinical records", () => {
    const files = [
      "lib/voice/speech-text/index.ts",
      "lib/voice/speech-text/router.ts",
      "lib/voice/speech-text/segment.ts",
      "lib/voice/speech-text/ar/normalize.ts",
      "lib/voice/speech-text/en/normalize.ts",
      "lib/voice/speech-text/lexicon-ar.ts",
    ];
    // Match executable code only — these table names legitimately appear in the
    // doc comments that explain the display/speech split.
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    for (const file of files) {
      const code = stripComments(readFileSync(join(root, file), "utf8"));
      // The speech representation is derived and discarded — it must never
      // touch persistence, the assessment path, or the clinical snapshot.
      expect(code, file).not.toMatch(/insert_assistant_message/);
      expect(code, file).not.toMatch(/session_messages/);
      expect(code, file).not.toMatch(/clinical_snapshot/);
      expect(code, file).not.toMatch(/from\s*\(\s*["']sessions["']\s*\)/);
      expect(code, file).not.toMatch(/@\/lib\/supabase/);
    }
  });

  it("the message route persists model output, never a speech representation", () => {
    const route = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/p_content:\s*replyMeta\.text/);
    // Speech preparation must not leak into the persistence path.
    expect(route).not.toMatch(/prepareSpeech/);
    expect(route).not.toMatch(/speech-text/);
  });

  it("browser SpeechRecognition cannot dispatch a patient turn", () => {
    const session = readFileSync(join(root, "components/VoiceSession.tsx"), "utf8");
    // Regression lock: a Web Speech `isFinal` result once auto-sent a turn, so
    // a mid-sentence pause made the patient answer incomplete speech.
    expect(session).not.toMatch(/autoSend/);
    const onResult = session.slice(
      session.indexOf("recognition.onresult"),
      session.indexOf("recognition.onerror"),
    );
    expect(onResult.length).toBeGreaterThan(0);
    expect(onResult).not.toMatch(/sendMessage/);
    expect(onResult).toMatch(/setDraft/);
  });

  it("does not send language_code to an ElevenLabs model that rejects it", () => {
    const service = readFileSync(
      join(root, "lib/voice/elevenlabs/service.ts"),
      "utf8",
    );
    expect(service).toMatch(/eleven_multilingual_v2/);
    expect(service).not.toMatch(/language_code:/);
    expect(service).toMatch(/LANGUAGE_CODE_UNSUPPORTED_NOTE/);
  });

  it("Phase 3C — admin test-session API is the sole marker writer", () => {
    const route = readFileSync(
      join(root, "app/api/admin/avatars/[id]/test-session/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/requireApiAdmin/);
    expect(route).toMatch(/withAdminTestMarker/);
    expect(route).toMatch(/assertAvatarEligibleForAdminTest/);
    expect(route).toMatch(/admin\.avatar\.test_session/);
    expect(route).toMatch(/createCaseForSession/);
  });
});
