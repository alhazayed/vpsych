import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_TURN_MESSAGE_CHARS } from "./clinical-turn";

// The API cap and the database cap must agree, or one path lets through what
// the other rejects. Direct REST inserts only meet the database constraint.
describe("therapist message length cap", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20261009185408_session_messages_user_content_cap.sql",
    ),
    "utf8",
  );

  it("caps role = 'user' rows at the same length as the message API", () => {
    const match = sql.match(
      /check \(role <> 'user' or char_length\(content\) <= (\d+)\)/,
    );
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(MAX_TURN_MESSAGE_CHARS);
  });

  it("leaves assistant and system rows uncapped", () => {
    expect(sql).not.toMatch(/role\s*=\s*'assistant'/);
    expect(sql).not.toMatch(/role\s*=\s*'system'/);
  });
});
