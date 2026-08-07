/**
 * Verify Therapy Room avatar TTS is audible (HTMLAudioElement plays speech).
 *
 *   EMAIL=... PASSWORD=... VPSYCH_BASE_URL=... [VPSYCH_SHARE=...] \
 *     node scripts/verify-avatar-playback.mjs
 *
 * Does not embed credentials. Saves TTS bytes, playback events, screenshots, video.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = (
  process.env.VPSYCH_BASE_URL ||
  process.env.PREVIEW_URL ||
  "https://vpsych.vercel.app"
).replace(/\/$/, "");
const SHARE = process.env.VPSYCH_SHARE || process.env.SHARE_TOKEN || "";
const EMAIL = process.env.EMAIL || "";
const PASSWORD = process.env.PASSWORD || "";
const OUT =
  process.env.VPSYCH_OUT ||
  "/opt/cursor/artifacts/silent-avatar-playback-verify";
const FAKE_AUDIO = process.env.FAKE_AUDIO || "/tmp/fake_speech_loop.wav";
const WAIT_MS = Number(process.env.WAIT_MS || "180000");

if (!EMAIL || !PASSWORD) {
  console.error("Set EMAIL and PASSWORD");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}
function withShare(url) {
  if (!SHARE) return url;
  const u = new URL(url);
  u.searchParams.set("_vercel_share", SHARE);
  return u.toString();
}

const report = { startedAt: new Date().toISOString(), base: BASE, ok: false };

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${FAKE_AUDIO}`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const context = await browser.newContext({
  permissions: ["microphone"],
  viewport: { width: 1280, height: 800 },
  recordVideo: {
    dir: path.join(OUT, "video"),
    size: { width: 1280, height: 720 },
  },
});

await context.addInitScript(() => {
  window.__playbackDiag = { events: [], snapshots: [] };
  const push = (type, detail) =>
    window.__playbackDiag.events.push({
      t: Date.now(),
      type,
      detail: detail ?? null,
    });
  const OrigAudio = window.Audio;
  window.Audio = function (...args) {
    const audio = new OrigAudio(...args);
    push("Audio_construct");
    for (const ev of [
      "loadedmetadata",
      "canplay",
      "playing",
      "pause",
      "ended",
      "error",
      "stalled",
      "abort",
      "waiting",
    ]) {
      audio.addEventListener(ev, () => {
        push(`audio_${ev}`, {
          muted: audio.muted,
          volume: audio.volume,
          playbackRate: audio.playbackRate,
          currentTime: audio.currentTime,
          readyState: audio.readyState,
          networkState: audio.networkState,
          paused: audio.paused,
        });
      });
    }
    const origPlay = audio.play.bind(audio);
    audio.play = () => {
      push("play_call", { muted: audio.muted, volume: audio.volume });
      return origPlay()
        .then(() => {
          push("play_resolved", {
            muted: audio.muted,
            volume: audio.volume,
            currentTime: audio.currentTime,
            readyState: audio.readyState,
          });
          window.__playbackDiag.snapshots.push({
            muted: audio.muted,
            volume: audio.volume,
            playbackRate: audio.playbackRate,
            currentTime: audio.currentTime,
            readyState: audio.readyState,
            networkState: audio.networkState,
          });
        })
        .catch((err) => {
          push("play_rejected", { name: err?.name, message: err?.message });
          throw err;
        });
    };
    return audio;
  };
  window.Audio.prototype = OrigAudio.prototype;
});

const page = await context.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  const text = msg.text();
  if (
    msg.type() === "error" ||
    /\[playback\]|NotAllowed|play\(\) rejected/i.test(text)
  ) {
    consoleErrors.push({ type: msg.type(), text });
    log("CONSOLE", msg.type(), text.slice(0, 200));
  }
});

page.on("response", async (res) => {
  if (!res.url().includes("/api/voice/tts")) return;
  const buf = await res.body().catch(() => null);
  const info = {
    status: res.status(),
    contentType: res.headers()["content-type"] || null,
    byteLength: buf?.length ?? 0,
    magic: buf
      ? Array.from(buf.slice(0, 4))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ")
      : null,
  };
  report.tts = info;
  log("TTS", JSON.stringify(info));
  if (buf?.length) fs.writeFileSync(path.join(OUT, "tts-response.mp3"), buf);
});

await page.goto(withShare(`${BASE}/`), {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await sleep(500);
await page.goto(withShare(`${BASE}/login`), {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/avatars|sessions|clinic/, { timeout: 60000 });
log("LOGIN_OK", page.url());

await page.goto(withShare(`${BASE}/avatars`), {
  waitUntil: "networkidle",
  timeout: 60000,
});
const therapyBtn = page.getByRole("button", { name: /Therapy Room/i });
if (!(await therapyBtn.count())) {
  throw new Error("Therapy Room mode toggle not found — flag not enabled?");
}
await therapyBtn.first().click();
log("MODE therapy_room");

const enter = page.getByRole("button", {
  name: /Enter Therapy Room|Start 40-min|voice session/i,
});
await enter.first().click();
await page.waitForURL(/\/sessions\//, { timeout: 60000 });
log("SESSION", page.url());

await page.waitForSelector('[data-trm-hands-free="true"]', { timeout: 30000 });
report.therapyRoomMounted = true;
await page.screenshot({
  path: path.join(OUT, "01-session-boot.png"),
  fullPage: true,
});

const bootDeadline = Date.now() + 15000;
let state = "";
while (Date.now() < bootDeadline) {
  state = await page.getAttribute(
    '[data-trm-hands-free="true"]',
    "data-conversation-state",
  );
  if (state === "LISTENING") break;
  if (state === "ERROR") throw new Error("boot ERROR");
  await sleep(250);
}
log("STATE", state);
await page.screenshot({
  path: path.join(OUT, "02-listening.png"),
  fullPage: true,
});

const deadline = Date.now() + WAIT_MS;
while (Date.now() < deadline) {
  const snap = await page.evaluate(() => {
    const st =
      document
        .querySelector('[data-trm-hands-free="true"]')
        ?.getAttribute("data-conversation-state") || "";
    return { st, diag: window.__playbackDiag };
  });
  const types = (snap.diag?.events || []).map((e) => e.type);
  log("tick", snap.st, types.slice(-8).join(",") || "(no audio events)");
  if (
    types.includes("play_resolved") &&
    (types.includes("audio_playing") ||
      types.includes("audio_ended") ||
      (snap.diag.snapshots[0]?.volume > 0 && !snap.diag.snapshots[0]?.muted))
  ) {
    await sleep(6000);
    break;
  }
  await sleep(2000);
}

const diag = await page.evaluate(() => window.__playbackDiag);
report.playback = diag;
report.consoleErrors = consoleErrors;
await page.screenshot({
  path: path.join(OUT, "03-after-turn.png"),
  fullPage: true,
});

const playResolved = (diag?.events || []).some((e) => e.type === "play_resolved");
const playRejected = (diag?.events || []).filter((e) => e.type === "play_rejected");
const constructed = (diag?.events || []).some((e) => e.type === "Audio_construct");
const playing = (diag?.events || []).some((e) => e.type === "audio_playing");
const badVol = (diag?.snapshots || []).some((s) => s.muted || s.volume === 0);
const playbackErrors = consoleErrors.filter((e) =>
  /\[playback\]|NotAllowed|play\(\) rejected/i.test(e.text),
);

report.ok =
  report.tts?.status === 200 &&
  (report.tts.byteLength ?? 0) > 1000 &&
  constructed &&
  playResolved &&
  playing &&
  playRejected.length === 0 &&
  !badVol &&
  playbackErrors.length === 0;

report.summary = {
  ttsBytes: report.tts?.byteLength ?? 0,
  ttsMagic: report.tts?.magic,
  ttsContentType: report.tts?.contentType,
  constructed,
  playResolved,
  playing,
  playRejected,
  badVol,
  playbackErrors,
  eventTypes: [...new Set((diag?.events || []).map((e) => e.type))],
  snapshots: diag?.snapshots ?? [],
};

const video = page.video();
await context.close();
await browser.close();
if (video) {
  try {
    const vp = await video.path();
    fs.renameSync(vp, path.join(OUT, "session-recording.webm"));
  } catch {
    /* ignore */
  }
}

if (fs.existsSync(path.join(OUT, "tts-response.mp3"))) {
  // leave file for ffmpeg volumedetect by caller
}

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(
  path.join(OUT, "playback-events.json"),
  JSON.stringify(diag, null, 2),
);
log("SUMMARY", JSON.stringify(report.summary, null, 2));
log("ok=", report.ok);
process.exit(report.ok ? 0 : 2);
