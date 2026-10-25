/**
 * One <audio> element for every patient clip in a session.
 *
 * iOS/iPadOS (WebKit, so every browser there) only lets an element play
 * sound without a tap once that same element has played inside a tap. A new
 * `Audio()` per clip is never unlocked, so every patient line was blocked
 * until the trainee pressed "Play patient audio". Reusing one element, and
 * unlocking it on the trainee's first tap or key press, lets the rest of the
 * session play on its own.
 */

let element: HTMLAudioElement | null = null;
let unlocked = false;
/** A patient clip owns the element (loading, playing or paused mid-clip). */
let clipActive = false;

/** A 20 ms silent WAV (8 kHz, 8-bit mono), built once. */
let silentWavUri: string | null = null;
function silentWav(): string {
  if (silentWavUri) return silentWavUri;
  const samples = 160;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit silence
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  silentWavUri = `data:audio/wav;base64,${btoa(binary)}`;
  return silentWavUri;
}

/** The shared element patient clips play on. */
export function patientAudioElement(): HTMLAudioElement {
  if (!element) element = new Audio();
  return element;
}

export function patientAudioUnlocked(): boolean {
  return unlocked;
}

/**
 * Call synchronously inside a tap / key handler. Plays a silent clip on the
 * shared element so later clips may start without a tap. Does nothing once
 * unlocked, or while a patient clip is on the element.
 */
export function unlockPatientAudio(): void {
  if (unlocked || typeof Audio === "undefined") return;
  const audio = patientAudioElement();
  // Never swap out a patient clip; its own play() unlocks the element, and
  // the next tap tries again if it was blocked.
  if (clipActive) return;
  audio.src = silentWav();
  let attempt: Promise<void> | undefined;
  try {
    attempt = audio.play();
  } catch {
    return;
  }
  void Promise.resolve(attempt).then(
    () => {
      unlocked = true;
      if (!clipActive) audio.pause();
    },
    () => {
      /* still locked; the next tap tries again */
    },
  );
}

/** A patient clip takes (true) or gives back (false) the element. */
export function setPatientClipActive(active: boolean): void {
  clipActive = active;
}

/** Mark the element unlocked after a clip played on it. */
export function notePatientAudioPlayed(): void {
  unlocked = true;
}

/** Test seam: forget the element and its unlock state. */
export function resetPatientAudioForTests(): void {
  element = null;
  unlocked = false;
  clipActive = false;
}
