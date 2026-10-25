import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  patientAudioElement,
  patientAudioUnlocked,
  resetPatientAudioForTests,
  setPatientClipActive,
  unlockPatientAudio,
} from "./patient-audio-element";

class FakeAudio {
  static instances = 0;
  static allowPlay = true;
  src = "";
  paused = true;
  play = vi.fn(() => {
    if (!FakeAudio.allowPlay) {
      return Promise.reject(Object.assign(new Error("blocked"), { name: "NotAllowedError" }));
    }
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  constructor() {
    FakeAudio.instances += 1;
  }
}

beforeEach(() => {
  FakeAudio.instances = 0;
  FakeAudio.allowPlay = true;
  vi.stubGlobal("Audio", FakeAudio);
  resetPatientAudioForTests();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("patient audio element", () => {
  it("hands out one element for the whole session", () => {
    expect(patientAudioElement()).toBe(patientAudioElement());
    expect(FakeAudio.instances).toBe(1);
  });

  it("unlocks by playing a silent clip on that same element, then pauses it", async () => {
    unlockPatientAudio();
    const audio = patientAudioElement() as unknown as FakeAudio;
    expect(audio.src.startsWith("data:audio/wav;base64,")).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(patientAudioUnlocked()).toBe(true);
    expect(audio.pause).toHaveBeenCalled();
    unlockPatientAudio();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("never swaps out a patient clip that owns the element", () => {
    const audio = patientAudioElement() as unknown as FakeAudio;
    audio.src = "blob:clip";
    setPatientClipActive(true);
    unlockPatientAudio();
    expect(audio.src).toBe("blob:clip");
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("stays locked when the browser refuses, so the next tap retries", async () => {
    FakeAudio.allowPlay = false;
    unlockPatientAudio();
    await Promise.resolve();
    await Promise.resolve();
    expect(patientAudioUnlocked()).toBe(false);
    FakeAudio.allowPlay = true;
    unlockPatientAudio();
    await Promise.resolve();
    await Promise.resolve();
    expect(patientAudioUnlocked()).toBe(true);
  });
});
