import { describe, expect, it, afterEach } from "vitest";
import { isTherapyRoomEnabled } from "./features";

describe("isTherapyRoomEnabled", () => {
  const prev = process.env.FEATURE_THERAPY_ROOM;
  const prevPub = process.env.NEXT_PUBLIC_FEATURE_THERAPY_ROOM;

  afterEach(() => {
    if (prev === undefined) delete process.env.FEATURE_THERAPY_ROOM;
    else process.env.FEATURE_THERAPY_ROOM = prev;
    if (prevPub === undefined) delete process.env.NEXT_PUBLIC_FEATURE_THERAPY_ROOM;
    else process.env.NEXT_PUBLIC_FEATURE_THERAPY_ROOM = prevPub;
  });

  it("defaults off", () => {
    delete process.env.FEATURE_THERAPY_ROOM;
    delete process.env.NEXT_PUBLIC_FEATURE_THERAPY_ROOM;
    expect(isTherapyRoomEnabled()).toBe(false);
  });

  it("enables on FEATURE_THERAPY_ROOM=true", () => {
    process.env.FEATURE_THERAPY_ROOM = "true";
    delete process.env.NEXT_PUBLIC_FEATURE_THERAPY_ROOM;
    expect(isTherapyRoomEnabled()).toBe(true);
  });
});
