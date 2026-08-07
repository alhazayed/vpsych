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
});
