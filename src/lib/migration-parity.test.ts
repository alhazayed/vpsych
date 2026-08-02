import { describe, expect, it } from "vitest";
import { join } from "path";
import {
  compareMigrationParity,
  loadLocalMigrations,
  parseMigrationFileName,
} from "./migration-parity";

describe("parseMigrationFileName", () => {
  it("parses timestamped snake_case names", () => {
    expect(parseMigrationFileName("20260730132727_vpsych_initial_schema.sql")).toEqual({
      version: "20260730132727",
      name: "vpsych_initial_schema",
    });
  });

  it("rejects malformed names", () => {
    expect(parseMigrationFileName("harden.sql")).toBeNull();
    expect(parseMigrationFileName("20260730_short.sql")).toBeNull();
  });
});

describe("loadLocalMigrations", () => {
  it("loads the repo migrations without structural errors", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const { migrations, errors } = loadLocalMigrations(dir);
    expect(errors).toEqual([]);
    expect(migrations.length).toBeGreaterThan(10);
    const versions = migrations.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
  });
});

describe("compareMigrationParity", () => {
  it("passes when remote is a subset of local (pending applies OK)", () => {
    const report = compareMigrationParity({
      localVersions: ["1", "2", "3"],
      remoteVersions: ["1", "2"],
    });
    expect(report.ok).toBe(true);
    expect(report.missingRemote).toEqual(["3"]);
    expect(report.missingLocal).toEqual([]);
  });

  it("fails when remote has versions missing from git", () => {
    const report = compareMigrationParity({
      localVersions: ["1", "2"],
      remoteVersions: ["1", "2", "9"],
    });
    expect(report.ok).toBe(false);
    expect(report.missingLocal).toEqual(["9"]);
  });
});
