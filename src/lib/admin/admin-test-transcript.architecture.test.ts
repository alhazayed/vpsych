/**
 * Phase 4 P0-1 — Admin Test Transcript review surface guardrails.
 *
 * These are source-invariant assertions in the established style of
 * `src/lib/architecture.test.ts` and `admin-test-phase3c.architecture.test.ts`:
 * they read the shipped source and assert the security properties hold in the
 * code as written. The repository has no HTTP/component integration harness
 * (vitest runs `environment: node` over `src/**\/*.test.ts` and `.tsx` files are
 * not unit-tested), so runtime request tests are out of scope for P0-1.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");
const PAGE = join(root, "app/(app)/admin/test-sessions/[sessionId]/page.tsx");
const COMPONENT = join(root, "components/admin/AdminTestTranscript.tsx");
const AVATAR_PAGE = join(root, "app/(app)/admin/avatars/[id]/page.tsx");

const page = readFileSync(PAGE, "utf8");
const component = readFileSync(COMPONENT, "utf8");
const avatarPage = readFileSync(AVATAR_PAGE, "utf8");

describe("P0-1 transcript surface — authorization", () => {
  it("enforces admin authorization server-side via requireAdmin", () => {
    // requireAdmin() -> requireProfile() -> requireUser():
    //   anonymous      -> redirect("/login")
    //   non-admin role -> redirect("/avatars") + denied security audit
    expect(page).toMatch(/import\s*\{\s*requireAdmin\s*\}\s*from\s*"@\/lib\/auth"/);
    expect(page).toMatch(/await requireAdmin\(\)/);
  });

  it("uses the requireAdmin-scoped client and never a service role", () => {
    expect(page).toMatch(/const\s*\{\s*supabase\s*\}\s*=\s*await requireAdmin\(\)/);
    expect(page).not.toMatch(/createServiceClient/);
    expect(page).not.toMatch(/messageRpcClient/);
    expect(page).not.toMatch(/SERVICE_ROLE/);
    expect(component).not.toMatch(/createServiceClient|SERVICE_ROLE/);
  });

  it("does not introduce a parallel authorization path", () => {
    // No hand-rolled role checks, no api-auth handler helpers on a page.
    expect(page).not.toMatch(/requireApiAdmin/);
    expect(page).not.toMatch(/role\s*===\s*"admin"/);
    expect(page).not.toMatch(/user_metadata/);
  });

  it("keeps the transcript component free of any authorization decision", () => {
    // Match invocations, not the doc comment that points at the server gate.
    expect(component).not.toMatch(/requireAdmin\(|requireUser\(|requireProfile\(/);
    expect(component).not.toMatch(/createClient\(|\.from\(/);
    expect(component).toMatch(/must never be treated as a security boundary/);
  });
});

describe("P0-1 transcript surface — admin-test identification", () => {
  it("derives admin-test state from the persisted snapshot helper", () => {
    expect(page).toMatch(
      /import\s*\{\s*isAdminTestSnapshot\s*\}\s*from\s*"@\/lib\/admin\/admin-test-session"/,
    );
    expect(page).toMatch(
      /if\s*\(!isAdminTestSnapshot\(typed\.clinical_snapshot\)\)\s*notFound\(\)/,
    );
  });

  it("never accepts client-provided admin_test authorization signals", () => {
    expect(page).not.toMatch(/searchParams/);
    expect(page).not.toMatch(/adminTest=1/);
    expect(page).not.toMatch(/localStorage|sessionStorage/);
    // The only admin_test read is the server helper against the DB column.
    expect(page).not.toMatch(/admin_test\s*[:=]\s*true/);
  });

  it("gates on the marker before rendering any message content", () => {
    const gate = page.indexOf("if (!isAdminTestSnapshot(typed.clinical_snapshot)) notFound()");
    const messagesQuery = page.indexOf('.from("session_messages")');
    expect(gate).toBeGreaterThan(-1);
    expect(messagesQuery).toBeGreaterThan(-1);
    // Learner-session isolation: a non-admin-test id 404s before messages load.
    expect(gate).toBeLessThan(messagesQuery);
  });
});

describe("P0-1 transcript surface — read-only data handling", () => {
  it("only reads sessions and session_messages", () => {
    expect(page).toMatch(/\.from\("sessions"\)/);
    expect(page).toMatch(/\.from\("session_messages"\)/);
    expect(page).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  });

  it("never invokes the patient engine, voice pipeline, or assessment", () => {
    for (const src of [page, component]) {
      expect(src).not.toMatch(/generatePatientReply|patient-agent/);
      expect(src).not.toMatch(/assessSession|createCaseForSession/);
      expect(src).not.toMatch(/\/api\/voice\/|transcribe|elevenlabs/i);
      expect(src).not.toMatch(/insert_assistant_message|insert_system_message/);
    }
  });

  it("renders stored message content verbatim and preserves speaker roles", () => {
    expect(component).toMatch(/\{m\.content\}/);
    expect(component).toMatch(/system:/);
    expect(component).toMatch(/user:/);
    expect(component).toMatch(/assistant:/);
  });

  it("labels the transcript as a non-learner record from server state", () => {
    expect(page).toMatch(/AdminTestBanner/);
    expect(page).toMatch(/clinicalSnapshot=\{typed\.clinical_snapshot\}/);
    expect(page).toMatch(/notLearnerNotice/);
  });

  it("audits transcript access", () => {
    expect(page).toMatch(/logSecurityEvent/);
    expect(page).toMatch(/admin\.avatar\.test_session\.transcript_view/);
  });
});

describe("P0-1 transcript surface — scope containment", () => {
  it("adds no review workflow, scoring, or approval controls", () => {
    for (const src of [page, component]) {
      expect(src).not.toMatch(/approve|reject|verdict|sign-?off|rubric/i);
      expect(src).not.toMatch(/reviewerScore|rating|score=/i);
    }
  });

  it("lists avatar admin-test sessions from the shared server helper", () => {
    expect(avatarPage).toMatch(/isAdminTestSnapshot/);
    expect(avatarPage).toMatch(/testSessions/);
    expect(avatarPage).not.toMatch(/createServiceClient/);
  });

  it("introduces no migration alongside the surface", () => {
    const migrations = readdirSync(join(process.cwd(), "supabase/migrations"));
    expect(migrations.filter((f) => /transcript/i.test(f))).toEqual([]);
  });
});

describe("P0-1 transcript surface — Phase 3C behaviour preserved", () => {
  it("does not change the admin-test end redirect target", () => {
    for (const f of [
      "components/VoiceSession.tsx",
      "components/therapy-room/TherapyRoom.tsx",
      "components/therapy-room/TherapyRoomSession.tsx",
    ]) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src).toMatch(/admin\/avatars\/\$\{session\.avatar_id\}/);
    }
  });

  it("leaves the admin-test marker writer and learner strip untouched", () => {
    const helpers = readFileSync(join(root, "lib/admin/admin-test-session.ts"), "utf8");
    const learnerCreate = readFileSync(join(root, "app/api/sessions/route.ts"), "utf8");
    const endRoute = readFileSync(join(root, "app/api/sessions/[id]/end/route.ts"), "utf8");
    expect(helpers).toMatch(/export function withAdminTestMarker/);
    expect(learnerCreate).toMatch(/stripAdminTestMarker/);
    expect(endRoute).toMatch(/assertAdminTestSkipAllowed/);
    // The transcript surface must not call the marker writer.
    expect(page).not.toMatch(/withAdminTestMarker/);
  });
});
