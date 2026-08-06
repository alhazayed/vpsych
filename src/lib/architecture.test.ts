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

  it("keeps Therapy Room optional behind a single feature flag", () => {
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
    expect(flag).not.toMatch(/FEATURE_THERAPY_ROOM/);
    expect(page).toMatch(/VoiceSession/);
    expect(page).toMatch(/TherapyRoomSession/);
    expect(page).toMatch(/isTherapyRoomModeEnabled/);
    expect(start).toMatch(/shouldUseTherapyRoom/);
    expect(start).toMatch(/interaction_mode/);
  });

  it("therapy-room notes use canonical notes API, not the patient message body", () => {
    const room = readFileSync(
      join(root, "components/therapy-room/TherapyRoomSession.tsx"),
      "utf8",
    );
    expect(room).toMatch(/\/api\/sessions\/\$\{session\.id\}\/notes/);
    expect(room).toMatch(/\/api\/sessions\/\$\{session\.id\}\/therapy-room/);
    expect(room).not.toMatch(/privateNotes.*submitConversationTurn/);
    expect(room).not.toMatch(/message: notes/);
  });

  it("gates clinic workflow behind the same Therapy Room flag", () => {
    const clinicPage = readFileSync(
      join(root, "app/(app)/clinic/page.tsx"),
      "utf8",
    );
    expect(clinicPage).toMatch(/isTherapyRoomModeEnabled/);
    const notes = readFileSync(
      join(root, "app/api/sessions/[id]/notes/route.ts"),
      "utf8",
    );
    expect(notes).toMatch(/isTherapyRoomModeEnabled/);
    expect(notes).toMatch(/session_private_notes/);
    const supervisor = readFileSync(
      join(root, "app/api/sessions/[id]/supervisor/route.ts"),
      "utf8",
    );
    expect(supervisor).toMatch(/isTherapyRoomModeEnabled/);
    expect(supervisor).toMatch(/report:\s*null/);
  });

  it("does not feed private notes into the patient message route", () => {
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    expect(message).not.toMatch(/session_private_notes/);
    expect(message).not.toMatch(/private.?notes/i);
  });

  it("clinic room redirects to the canonical /sessions/[id] TherapyRoomSession", () => {
    const clinicRoom = readFileSync(
      join(root, "app/(app)/clinic/room/[sessionId]/page.tsx"),
      "utf8",
    );
    expect(clinicRoom).toMatch(/redirect\(`\/sessions\/\$\{sessionId\}`\)/);
    expect(clinicRoom).toMatch(/interaction_mode/);
    expect(clinicRoom).not.toMatch(/TherapyRoomSession/);
    expect(clinicRoom).not.toMatch(
      /from ["']@\/components\/therapy-room\/TherapyRoom["']/,
    );
  });

  it("does not keep a duplicate features.ts Therapy Room flag module", () => {
    expect(() =>
      readFileSync(join(root, "lib/features.ts"), "utf8"),
    ).toThrow();
  });
});
