import { beforeEach, describe, expect, it } from "vitest";
import {
  createServerTiming,
  resetServerTimingInstance,
} from "@/lib/server-timing";

describe("createServerTiming", () => {
  beforeEach(() => resetServerTimingInstance());

  it("records phase durations, total, and cold/warm instance", () => {
    let t = 0;
    const timing = createServerTiming(() => t);
    t = 80;
    timing.mark("auth");
    t = 1000;
    timing.mark("stt");
    expect(timing.header()).toBe(
      'auth;dur=80.0, stt;dur=920.0, total;dur=1000.0, instance;desc="cold"',
    );
    const second = createServerTiming(() => t);
    expect(second.header()).toContain('instance;desc="warm"');
  });

  it("sanitizes phase names so the header cannot be broken", () => {
    let t = 0;
    const timing = createServerTiming(() => t);
    t = 5;
    timing.mark('bad, name;"x"');
    expect(timing.header().startsWith("bad__name__x_;dur=5.0")).toBe(true);
  });
});
