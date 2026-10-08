import { describe, expect, it } from "vitest";
import {
  avatarDisplayName,
  avatarLocalNameSelect,
} from "@/lib/avatars/localized-name";

describe("avatarLocalNameSelect", () => {
  it("maps UI locales onto personality locales", () => {
    expect(avatarLocalNameSelect("ar")).toBe(
      "local_name:personalities->ar-JO->identity->>display_name",
    );
    expect(avatarLocalNameSelect("en")).toBe(
      "local_name:personalities->en-US->identity->>display_name",
    );
  });

  it("never puts anything but an xx-YY key into the select", () => {
    expect(avatarLocalNameSelect("en),secret:x")).toContain(
      "personalities->en-US->",
    );
  });
});

describe("avatarDisplayName", () => {
  it("prefers the authored local name", () => {
    expect(avatarDisplayName({ name: "Maya Chen", local_name: "ليان خوري" })).toBe(
      "ليان خوري",
    );
  });

  it("falls back to the canonical name", () => {
    expect(avatarDisplayName({ name: "Maya Chen", local_name: null })).toBe(
      "Maya Chen",
    );
    expect(avatarDisplayName({ name: "Maya Chen", local_name: "  " })).toBe(
      "Maya Chen",
    );
    expect(avatarDisplayName(null)).toBe("");
  });
});
