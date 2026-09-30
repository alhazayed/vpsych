/**
 * Soft-release desktop verification against a Vercel PREVIEW (not production).
 * Desktop Chromium only. Does not claim iPhone/Safari support.
 *
 * Env:
 *   VPSYCH_PREVIEW_URL  — preview origin (required)
 *   VPSYCH_SHARE        — optional _vercel_share token (without query prefix)
 *   VPSYCH_AUDIT_THERAPIST_EMAIL / VPSYCH_AUDIT_THERAPIST_PASSWORD
 *   VPSYCH_OUT / VPSYCH_SHOTS — artifact dirs
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.VPSYCH_PREVIEW_URL;
const SHARE = process.env.VPSYCH_SHARE || "";
const THERAPIST = {
  email: process.env.VPSYCH_AUDIT_THERAPIST_EMAIL || "",
  password: process.env.VPSYCH_AUDIT_THERAPIST_PASSWORD || "",
};
if (!BASE || !THERAPIST.email || !THERAPIST.password) {
  console.error(
    "Set VPSYCH_PREVIEW_URL and VPSYCH_AUDIT_THERAPIST_EMAIL/PASSWORD",
  );
  process.exit(1);
}

const OUT = process.env.VPSYCH_OUT || "/opt/cursor/artifacts/soft-release-desktop";
const SHOTS =
  process.env.VPSYCH_SHOTS || "/opt/cursor/artifacts/screenshots/soft-release";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  base: BASE,
  browser: "Chromium (puppeteer-core / google-chrome)",
  os: process.platform,
  commitHint: process.env.VPSYCH_COMMIT || null,
  deploymentId: process.env.VPSYCH_DEPLOYMENT_ID || null,
  scope: "desktop-only soft-release preview",
  exclusions: ["iPhone", "iOS Safari", "mobile browser voice"],
  steps: [],
  network: [],
  classifications: {},
  blockers: [],
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function record(step, status, detail = {}) {
  report.steps.push({
    step,
    status,
    ts: new Date().toISOString(),
    ...detail,
  });
  console.log(`[${status}] ${step}`, detail.note || "");
}

async function shot(page, name) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function goto(page, urlPath) {
  const url =
    SHARE && (urlPath === "/" || urlPath.startsWith("/login"))
      ? `${BASE}${urlPath}${urlPath.includes("?") ? "&" : "?"}_vercel_share=${SHARE}`
      : `${BASE}${urlPath}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
}

function attachNetwork(page) {
  page.on("response", async (res) => {
    const url = res.url();
    if (!/\/api\/(sessions|voice)\//.test(url)) return;
    const headers = res.headers();
    let bodyPreview = "";
    let byteLen = null;
    try {
      const ct = headers["content-type"] || "";
      if (ct.includes("application/json")) {
        bodyPreview = (await res.text()).slice(0, 600);
      } else if (ct.includes("audio") || ct.includes("mpeg") || ct.includes("octet")) {
        const buf = await res.buffer();
        byteLen = buf.byteLength;
        bodyPreview = `[audio bytes=${byteLen} ct=${ct}]`;
      }
    } catch {
      /* ignore */
    }
    report.network.push({
      url,
      status: res.status(),
      method: res.request().method(),
      contentType: headers["content-type"] || null,
      contentLength: headers["content-length"] || byteLen,
      audioBytes: byteLen,
      bodyPreview,
      ts: new Date().toISOString(),
    });
  });
}

async function login(page) {
  await goto(page, "/login");
  if (!page.url().includes("/login")) {
    // already authed somehow — continue
    record("login", "PASS", { note: `redirected to ${page.url()}` });
    return;
  }
  await page.waitForSelector("#email, input[type='email']", { timeout: 30000 });
  await page.type("#email, input[type='email']", THERAPIST.email, { delay: 8 });
  await page.type("#password", THERAPIST.password, { delay: 8 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await sleep(1500);
  await shot(page, "01-login");
  if (page.url().includes("/login")) {
    const err = await page.evaluate(() => document.body.innerText.slice(0, 400));
    record("login", "FAIL", { note: err });
    throw new Error("Login failed");
  }
  record("login", "PASS", { url: page.url() });
}

async function setLocale(page, locale) {
  await page.setCookie({
    name: "locale",
    value: locale,
    domain: new URL(BASE).hostname,
    path: "/",
  });
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(800);
  const cookie = (await page.cookies()).find((c) => c.name === "locale");
  if (cookie?.value !== locale) {
    throw new Error(`locale cookie=${cookie?.value}`);
  }
  record(`locale-${locale}`, "PASS");
}

async function startFirstAvatar(page) {
  await goto(page, "/avatars");
  await page.waitForSelector("article", { timeout: 45000 });
  await shot(page, "02-avatars");
  // Prefer the explicit start CTA — article also has Classic/Therapy Room toggles.
  const buttons = await page.$$("article button");
  let startBtn = null;
  for (const btn of buttons) {
    const text = ((await page.evaluate((el) => el.textContent, btn)) || "").trim();
    // EN: "Start 40-min voice session"; AR: localized CTA still contains mic icon + session wording
    if (
      (/start/i.test(text) && /session|voice|40/i.test(text)) ||
      /بدء|جلسة|صوت/.test(text)
    ) {
      startBtn = btn;
      break;
    }
  }
  if (!startBtn) {
    const labels = [];
    for (const btn of buttons) {
      labels.push(((await page.evaluate((el) => el.textContent, btn)) || "").trim());
    }
    throw new Error(`No avatar Start session button; labels=${JSON.stringify(labels)}`);
  }

  const navPromise = page
    .waitForFunction(
      () => /\/sessions\/[0-9a-f-]{36}|\/clinic\/room\/[0-9a-f-]{36}/i.test(location.pathname),
      { timeout: 90000 },
    )
    .catch(() => null);
  await startBtn.click();
  await navPromise;
  await sleep(2000);
  await shot(page, "03-session-started");
  const url = page.url();
  const m = url.match(/\/sessions\/([0-9a-f-]{36})|\/clinic\/room\/([0-9a-f-]{36})/i);
  const sessionId = m?.[1] || m?.[2] || null;
  if (!sessionId) {
    const body = await page.evaluate(() => document.body.innerText.slice(0, 800));
    record("session-create", "FAIL", { url, note: body });
    throw new Error(`Session did not start; url=${url}`);
  }
  record("session-create", "PASS", { url, sessionId });
  return { url, sessionId };
}

async function ensureTextMode(page) {
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = ((await page.evaluate((el) => el.textContent, btn)) || "").trim();
    // Label shows current mode. "Voice"/"صوت" means voice is on → click to text.
    if (/^(Voice|صوت)$/i.test(text)) {
      await btn.click();
      await sleep(500);
      return "switched-to-text";
    }
  }
  return "already-text-or-unknown";
}

async function ensureVoiceMode(page) {
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = ((await page.evaluate((el) => el.textContent, btn)) || "").trim();
    if (/^(Text|نص)$/i.test(text)) {
      await btn.click();
      await sleep(500);
      return "switched-to-voice";
    }
  }
  return "already-voice-or-unknown";
}

async function sendText(page, message) {
  const beforeMsg = report.network.filter((n) => /\/message/.test(n.url)).length;
  const beforeTts = report.network.filter((n) => /\/tts/.test(n.url)).length;
  const input = await page.$("form input, input.field-input, input[placeholder]");
  if (!input) throw new Error("Message input not found");
  await input.click({ clickCount: 3 });
  await input.type(message, { delay: 12 });
  await page.click('form button[type="submit"]');
  // Wait for message + optional TTS
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const msgs = report.network.filter((n) => /\/message/.test(n.url));
    if (msgs.length > beforeMsg) {
      const last = msgs[msgs.length - 1];
      if (last.status && last.status !== 0) break;
    }
  }
  await sleep(4000);
  const msgs = report.network.filter((n) => /\/message/.test(n.url)).slice(beforeMsg);
  const tts = report.network.filter((n) => /\/tts/.test(n.url)).slice(beforeTts);
  return { msgs, tts };
}

async function endSession(page) {
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = ((await page.evaluate((el) => el.textContent, btn)) || "").trim();
    if (/end session|إنهاء|complete|마침|finish/i.test(text)) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 120000 }).catch(() => null),
        btn.click(),
      ]);
      await sleep(3000);
      // confirm dialogs
      const confirms = await page.$$("button");
      for (const c of confirms) {
        const t = ((await page.evaluate((el) => el.textContent, c)) || "").trim();
        if (/confirm|yes|إنهاء|ok|end/i.test(t)) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: "networkidle2", timeout: 120000 }).catch(() => null),
            c.click(),
          ]);
          break;
        }
      }
      await sleep(5000);
      await shot(page, "09-session-ended");
      const endCalls = report.network.filter((n) => /\/end/.test(n.url));
      record("session-end", endCalls.some((e) => e.status >= 200 && e.status < 300) ? "PASS" : "PARTIAL", {
        endCalls,
        url: page.url(),
      });
      return;
    }
  }
  record("session-end", "BLOCKED", { note: "End Session control not found" });
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  attachNetwork(page);
  await page.evaluateOnNewDocument(() => {
    const g = window;
    g.__VPSYCH_SOFT_RELEASE_AUDIO__ = {
      playCalls: 0,
      playResolved: 0,
      playRejected: 0,
      playingEvents: 0,
      errors: 0,
      lastCurrentTime: 0,
    };
    const OriginalAudio = g.Audio;
    g.Audio = function (...args) {
      const audio = new OriginalAudio(...args);
      audio.addEventListener("playing", () => {
        g.__VPSYCH_SOFT_RELEASE_AUDIO__.playingEvents += 1;
      });
      audio.addEventListener("error", () => {
        g.__VPSYCH_SOFT_RELEASE_AUDIO__.errors += 1;
      });
      const origPlay = audio.play.bind(audio);
      audio.play = () => {
        g.__VPSYCH_SOFT_RELEASE_AUDIO__.playCalls += 1;
        return origPlay()
          .then((v) => {
            g.__VPSYCH_SOFT_RELEASE_AUDIO__.playResolved += 1;
            g.__VPSYCH_SOFT_RELEASE_AUDIO__.lastCurrentTime = audio.currentTime;
            return v;
          })
          .catch((err) => {
            g.__VPSYCH_SOFT_RELEASE_AUDIO__.playRejected += 1;
            throw err;
          });
      };
      return audio;
    };
    g.Audio.prototype = OriginalAudio.prototype;
  });

  try {
    // Seed share cookie/path first
    if (SHARE) {
      await page.goto(`${BASE}/?_vercel_share=${SHARE}`, {
        waitUntil: "networkidle2",
        timeout: 90000,
      });
      await sleep(1000);
    }

    await login(page);
    await setLocale(page, "en");
    const { sessionId } = await startFirstAvatar(page);
    report.sessionId = sessionId;

    const textMode = await ensureTextMode(page);
    record("text-mode", "PASS", { note: textMode });

    // EN text turns
    const t1 = await sendText(
      page,
      "Hello, thank you for coming today. How have you been feeling this week?",
    );
    await shot(page, "04-en-turn1");
    const t1ok = t1.msgs.some((m) => m.status === 200);
    const t1super = t1.msgs.some((m) => m.status === 409);
    record("en-text-turn-1", t1ok ? "PASS" : t1super ? "PARTIAL" : "FAIL", {
      msgs: t1.msgs.map((m) => ({ status: m.status, preview: m.bodyPreview?.slice(0, 200) })),
    });
    if (!t1ok) report.blockers.push("EN text turn 1 did not return 200");

    const t2 = await sendText(
      page,
      "Can you tell me more about what has been most difficult for you lately?",
    );
    await shot(page, "05-en-turn2");
    record("en-text-turn-2", t2.msgs.some((m) => m.status === 200) ? "PASS" : "FAIL", {
      msgs: t2.msgs.map((m) => ({ status: m.status, preview: m.bodyPreview?.slice(0, 200) })),
    });

    // Rapid consecutive turns (stale / supersede stress)
    const rapid = [];
    await Promise.all([
      (async () => {
        rapid.push(await sendText(page, "What else is on your mind right now?"));
      })(),
      (async () => {
        await sleep(300);
        rapid.push(await sendText(page, "Sorry — one more thing: how is your sleep?"));
      })(),
    ]).catch((e) => {
      record("rapid-turns", "PARTIAL", { note: String(e) });
    });
    const rapidStatuses = rapid.flatMap((r) => r.msgs.map((m) => m.status));
    record("rapid-turns", rapidStatuses.includes(200) ? "PASS" : "PARTIAL", {
      statuses: rapidStatuses,
      note: "409 superseded is acceptable; need at least one 200",
    });
    await shot(page, "06-rapid-turns");

    // Voice mode + TTS (desktop Chromium). Mic STT may use fake device.
    const voiceMode = await ensureVoiceMode(page);
    record("voice-mode", "PASS", { note: voiceMode });
    const beforeTts = report.network.filter((n) => /\/tts/.test(n.url)).length;
    const tv = await sendText(
      page,
      "I hear that this has been really hard. What would feel most helpful to talk about next?",
    );
    // Extra wait for progressive TTS chunks
    await sleep(12000);
    await shot(page, "07-voice-tts-turn");
    const ttsAfter = report.network.filter((n) => /\/tts/.test(n.url)).slice(beforeTts);
    const ttsOk = ttsAfter.filter((t) => t.status === 200 && (t.audioBytes || 0) > 0);
    record(
      "desktop-tts",
      ttsOk.length > 0 ? "PASS" : ttsAfter.some((t) => t.status === 200) ? "PARTIAL" : "FAIL",
      {
        ttsCount: ttsAfter.length,
        okWithBytes: ttsOk.length,
        samples: ttsAfter.slice(0, 8).map((t) => ({
          status: t.status,
          audioBytes: t.audioBytes,
          contentType: t.contentType,
        })),
        messageStatuses: tv.msgs.map((m) => m.status),
      },
    );
    if (ttsOk.length === 0) {
      report.classifications.desktopTts = "NOT VERIFIED — no audio bytes observed";
    } else if (ttsOk.length === 1) {
      report.classifications.desktopTts = "PARTIALLY VERIFIED — single TTS (legacy or one chunk)";
    } else {
      report.classifications.desktopTts = "PARTIALLY VERIFIED — multiple TTS chunks (progressive likely); HTMLAudio play()/playing not instrumented in headless";
    }

    // Playback probe via page evaluate (best-effort)
    const playbackProbe = await page.evaluate(async () => {
      const audios = [...document.querySelectorAll("audio")];
      const hooked = window.__VPSYCH_SOFT_RELEASE_AUDIO__ || null;
      return {
        audioElements: audios.length,
        hooked,
        states: audios.map((a) => ({
          src: (a.currentSrc || a.src || "").slice(0, 80),
          paused: a.paused,
          currentTime: a.currentTime,
          readyState: a.readyState,
          error: a.error?.code ?? null,
        })),
      };
    });
    const hooked = playbackProbe.hooked;
    if (hooked && hooked.playResolved > 0) {
      record("html-audio-probe", "PASS", playbackProbe);
      report.classifications.desktopPlayback =
        "PARTIALLY VERIFIED — Audio.play() resolved in Chromium headless; audible speaker output not confirmed";
    } else if (hooked && hooked.playCalls > 0) {
      record("html-audio-probe", "PARTIAL", playbackProbe);
      report.classifications.desktopPlayback =
        "PARTIALLY VERIFIED — play() attempted; resolve/playing incomplete in headless";
    } else {
      record("html-audio-probe", "BLOCKED", playbackProbe);
      report.classifications.desktopPlayback =
        "NOT VERIFIED — no Audio.play() hooks observed (TTS bytes may still succeed)";
    }

    report.classifications.bargeIn =
      "NOT VERIFIED in this headless run (requires live mic VAD on desktop Chrome)";
    report.classifications.repeat =
      "NOT VERIFIED — Therapy Room Repeat control not exercised in this script";
    report.classifications.stt =
      "NOT VERIFIED — fake media device may not produce real STT; text path used to drive TTS";

    await endSession(page);

    // Arabic session (new)
    await setLocale(page, "ar");
    const ar = await startFirstAvatar(page);
    report.arabicSessionId = ar.sessionId;
    await ensureTextMode(page);
    const arTurn = await sendText(
      page,
      "مرحبا، كيف حالك اليوم؟ أخبرني بما تشعر به.",
    );
    await sleep(8000);
    await shot(page, "08-ar-turn");
    const arOk = arTurn.msgs.some((m) => m.status === 200);
    const arBody = arTurn.msgs.map((m) => m.bodyPreview || "").join("\n");
    const hasArabic = /[\u0600-\u06FF]/.test(arBody);
    const dir = await page.evaluate(() => document.documentElement.getAttribute("dir"));
    record("arabic-text", arOk && hasArabic ? "PASS" : arOk ? "PARTIAL" : "FAIL", {
      hasArabic,
      dir,
      statuses: arTurn.msgs.map((m) => m.status),
      preview: arBody.slice(0, 300),
    });
    report.classifications.arabic =
      arOk && hasArabic
        ? "PARTIALLY VERIFIED — Arabic reply observed; TTS/chunking/RTL UI smoke only"
        : "NOT VERIFIED";

    // End Arabic session best-effort
    await endSession(page).catch(() => null);
  } catch (e) {
    report.blockers.push(String(e?.stack || e));
    record("fatal", "FAIL", { note: String(e) });
    try {
      await shot(page, "99-fatal");
    } catch {
      /* ignore */
    }
  } finally {
    report.finishedAt = new Date().toISOString();
    const outFile = path.join(OUT, "soft-release-desktop-report.json");
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
    console.log("Wrote", outFile);
    await browser.close();
  }

  if (report.blockers.length) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
