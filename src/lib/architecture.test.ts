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

  it("keeps legacy VoiceSession on /sessions/[id] when therapy room exists", () => {
    const sessionPage = readFileSync(
      join(root, "app/(app)/sessions/[id]/page.tsx"),
      "utf8",
    );
    expect(sessionPage).toMatch(/VoiceSession/);
    expect(sessionPage).not.toMatch(/TherapyRoom/);
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

  it("does not feed private notes into the patient message route", () => {
    const message = readFileSync(
      join(root, "app/api/sessions/[id]/message/route.ts"),
      "utf8",
    );
    expect(message).not.toMatch(/session_private_notes/);
    expect(message).not.toMatch(/private.?notes/i);
  });
});
