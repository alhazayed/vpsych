import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkTsFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

describe("Phase 3C admin-test architecture", () => {
  it("only the admin test-session route calls withAdminTestMarker", () => {
    const files = walkTsFiles(root);
    const writers = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return (
        src.includes("withAdminTestMarker(") &&
        !f.endsWith("admin-test-session.ts")
      );
    });
    expect(writers).toEqual([
      join(root, "app/api/admin/avatars/[id]/test-session/route.ts"),
    ]);
  });

  it("VoiceSession and Therapy Room redirect admin tests away from learner complete", () => {
    const voice = readFileSync(
      join(root, "components/VoiceSession.tsx"),
      "utf8",
    );
    const room = readFileSync(
      join(root, "components/therapy-room/TherapyRoom.tsx"),
      "utf8",
    );
    const roomSession = readFileSync(
      join(root, "components/therapy-room/TherapyRoomSession.tsx"),
      "utf8",
    );
    for (const src of [voice, room, roomSession]) {
      expect(src).toMatch(/AdminTestBanner/);
      expect(src).toMatch(/admin\/avatars\/\$\{session\.avatar_id\}/);
      expect(src).toMatch(/skippedAssessment/);
    }
  });

  it("sessions list filters admin tests for non-admin learners", () => {
    const page = readFileSync(
      join(root, "app/(app)/sessions/page.tsx"),
      "utf8",
    );
    expect(page).toMatch(/isAdminTestSnapshot/);
    expect(page).toMatch(/profile\.role === "admin"/);
    expect(page).toMatch(/adminTestBadge/);
  });

  it("documents retention as a product decision in implementation helpers", () => {
    const helpers = readFileSync(
      join(root, "lib/admin/admin-test-session.ts"),
      "utf8",
    );
    expect(helpers).toMatch(/Retention policy remains a product decision/);
  });

  it("only admin test-session may allow inactive persona for case mint", () => {
    const testSession = readFileSync(
      join(root, "app/api/admin/avatars/[id]/test-session/route.ts"),
      "utf8",
    );
    const learnerCreate = readFileSync(
      join(root, "app/api/sessions/route.ts"),
      "utf8",
    );
    expect(testSession).toMatch(/allowInactivePersona:\s*true/);
    expect(learnerCreate).not.toMatch(/allowInactivePersona/);
  });
});
