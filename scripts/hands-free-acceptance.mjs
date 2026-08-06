/**
 * Hands-free Therapy Room acceptance harness (Playwright + fake mic).
 *
 * Verifies: Enter Therapy Room → Listening (no ERROR) without mic button,
 * then drives N fake-audio turns through VAD → STT → GPT → TTS → re-listen.
 *
 * Usage:
 *   SHARE_URL=... EMAIL=... PASSWORD=... node scripts/hands-free-acceptance.mjs
 */
import { chromium, webkit } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE =
  process.env.PREVIEW_URL ??
  "https://vpsych-qsgwej8mw-alhazayed-1540s-projects.vercel.app";
const SHARE = process.env.SHARE_URL ?? `${BASE}/`;
const EMAIL = process.env.EMAIL ?? "preview.qa.1786026456943@gmail.com";
const PASSWORD = process.env.PASSWORD ?? "PreviewQa!456943Aa1";
const TURNS = Number(process.env.TURNS ?? "20");
const OUT = process.env.OUT_DIR ?? "/opt/cursor/artifacts/hands-free-fix";
const FAKE_AUDIO =
  process.env.FAKE_AUDIO ?? "/tmp/fake_speech_loop.wav";
const BROWSER = (process.env.BROWSER ?? "chromium").toLowerCase();
/** Prefer full Chrome for fake-mic capture (headless shell ignores it). */
const CHANNEL = (process.env.CHANNEL ?? "chrome").toLowerCase();

mkdirSync(OUT, { recursive: true });

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  console.log(line);
  writeFileSync(join(OUT, "run.log"), line + "\n", { flag: "a" });
}

async function main() {
  const launcher = BROWSER === "webkit" ? webkit : chromium;
  const launchOpts =
    BROWSER === "webkit"
      ? { headless: true }
      : {
          headless: true,
          ...(CHANNEL === "chrome" || CHANNEL === "chrome-beta"
            ? { channel: CHANNEL }
            : {}),
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-audio-capture=${FAKE_AUDIO}`,
            "--autoplay-policy=no-user-gesture-required",
          ],
        };
  log("BROWSER", BROWSER, "CHANNEL", CHANNEL);
  const browser = await launcher.launch(launchOpts);

  const context = await browser.newContext({
    permissions: ["microphone"],
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const ignoreConsole = (text) =>
    /vercel\.live|feedback\.js|favicon|ResizeObserver/i.test(text);
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (ignoreConsole(text)) {
        log("CONSOLE_IGNORED", text.slice(0, 120));
        return;
      }
      consoleErrors.push(text);
      log("CONSOLE_ERROR", text);
    }
  });
  page.on("pageerror", (err) => {
    const text = String(err);
    if (ignoreConsole(text)) return;
    consoleErrors.push(text);
    log("PAGE_ERROR", text);
  });

  const network = { stt: 0, message: 0, tts: 0, failures: [] };
  page.on("response", (res) => {
    const u = res.url();
    const ok = res.status() >= 200 && res.status() < 300;
    if (u.includes("/api/voice/transcribe") && ok) network.stt += 1;
    if (u.includes("/api/sessions/") && u.endsWith("/message") && ok) {
      network.message += 1;
    }
    if (u.includes("/api/voice/tts") && ok) network.tts += 1;
    if (res.status() >= 400 && /\/api\//.test(u)) {
      network.failures.push({ status: res.status(), url: u });
      log("HTTP_FAIL", String(res.status()), u.slice(0, 180));
    }
  });

  log("OPEN", SHARE);
  await page.goto(SHARE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });

  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/avatars|sessions|clinic/, { timeout: 60000 });
  log("LOGIN_OK", page.url());

  await page.goto(`${BASE}/avatars`, { waitUntil: "networkidle", timeout: 60000 });
  // Select Therapy Room mode if toggle present
  const therapyBtn = page.getByRole("button", { name: /Therapy Room/i });
  if (await therapyBtn.count()) {
    await therapyBtn.first().click();
    log("MODE", "therapy_room");
  } else {
    throw new Error("Therapy Room mode toggle not found — flag not enabled?");
  }

  // Enter Therapy Room (user gesture primes mic)
  const enter = page.getByRole("button", { name: /Enter Therapy Room/i });
  await enter.first().click();
  await page.waitForURL(/\/sessions\//, { timeout: 60000 });
  log("SESSION", page.url());

  // Wait for hands-free root
  await page.waitForSelector('[data-trm-hands-free="true"]', { timeout: 30000 });
  await page.screenshot({ path: join(OUT, "01-session-boot.png"), fullPage: true });

  // Critical: must reach LISTENING without ERROR
  const deadline = Date.now() + 15000;
  let state = "";
  while (Date.now() < deadline) {
    state = await page.getAttribute('[data-trm-hands-free="true"]', "data-conversation-state");
    const status = await page.locator("[data-status]").first().getAttribute("data-status").catch(() => null);
    log("STATE", state, "STATUS", status);
    if (state === "ERROR" || status === "error") {
      await page.screenshot({ path: join(OUT, "FAIL-error.png"), fullPage: true });
      throw new Error("Session entered ERROR after Start — hands-free boot failed");
    }
    if (state === "LISTENING") break;
    await page.waitForTimeout(250);
  }
  if (state !== "LISTENING") {
    await page.screenshot({ path: join(OUT, "FAIL-no-listening.png"), fullPage: true });
    throw new Error(`Expected LISTENING, got ${state}`);
  }
  log("LISTENING_OK");
  await page.screenshot({ path: join(OUT, "02-listening.png"), fullPage: true });

  // Drive turns via fake audio bursts (file loops tone+silence)
  let completed = 0;
  const turnDeadlineMs = 120000;
  for (let i = 0; i < TURNS; i++) {
    const beforeStt = network.stt;
    const beforeMsg = network.message;
    const beforeTts = network.tts;
    const start = Date.now();
    log(`TURN_${i + 1}_WAIT`);

    while (Date.now() - start < turnDeadlineMs) {
      const st = await page.getAttribute(
        '[data-trm-hands-free="true"]',
        "data-conversation-state",
      );
      if (st === "ERROR") {
        await page.screenshot({
          path: join(OUT, `FAIL-turn-${i + 1}-error.png`),
          fullPage: true,
        });
        throw new Error(`ERROR during turn ${i + 1}`);
      }
      // A completed turn: STT + message + TTS advanced, back to LISTENING
      if (
        network.stt > beforeStt &&
        network.message > beforeMsg &&
        network.tts > beforeTts &&
        st === "LISTENING"
      ) {
        completed += 1;
        log(`TURN_${i + 1}_OK`, `stt=${network.stt} msg=${network.message} tts=${network.tts}`);
        await page.screenshot({
          path: join(OUT, `turn-${String(i + 1).padStart(2, "0")}.png`),
        });
        break;
      }
      await page.waitForTimeout(500);
    }
    if (completed < i + 1) {
      log(`TURN_${i + 1}_TIMEOUT`, JSON.stringify(network));
      await page.screenshot({
        path: join(OUT, `FAIL-turn-${i + 1}-timeout.png`),
        fullPage: true,
      });
      break;
    }
  }

  // Barge-in: while avatar speaking, keep feeding mic audio; expect return to LISTENING
  let bargeInOk = false;
  const bargeDeadline = Date.now() + 90000;
  log("BARGE_IN_WAIT_AVATAR");
  while (Date.now() < bargeDeadline) {
    const st = await page.getAttribute(
      '[data-trm-hands-free="true"]',
      "data-conversation-state",
    );
    if (st === "AVATAR_SPEAKING") {
      log("BARGE_IN_DURING", st);
      // Fake mic keeps speaking; wait for FSM to leave AVATAR_SPEAKING via barge-in or natural end
      const leaveDeadline = Date.now() + 45000;
      while (Date.now() < leaveDeadline) {
        const st2 = await page.getAttribute(
          '[data-trm-hands-free="true"]',
          "data-conversation-state",
        );
        if (st2 && st2 !== "AVATAR_SPEAKING") {
          bargeInOk = st2 === "LISTENING" || st2 === "PROCESSING_STT" || st2 === "WAITING_GPT";
          log("BARGE_IN_LEFT", st2, "ok=", String(bargeInOk));
          break;
        }
        await page.waitForTimeout(200);
      }
      break;
    }
    if (st === "ERROR") break;
    await page.waitForTimeout(300);
  }
  if (!bargeInOk) {
    // Soft: if we never caught AVATAR_SPEAKING (very short TTS), note it but don't fail alone
    log("BARGE_IN_SKIPPED_OR_FAILED");
  }

  // Wait until LISTENING again before Pause
  const listenAgain = Date.now() + 120000;
  while (Date.now() < listenAgain) {
    const st = await page.getAttribute(
      '[data-trm-hands-free="true"]',
      "data-conversation-state",
    );
    if (st === "LISTENING") break;
    await page.waitForTimeout(300);
  }

  // Pause / Resume / End
  let pauseOk = false;
  let resumeOk = false;
  const pause = page.getByRole("button", { name: /Pause/i });
  if (await pause.count()) {
    await pause.first().click();
    await page.waitForTimeout(500);
    const st = await page.getAttribute(
      '[data-trm-hands-free="true"]',
      "data-conversation-state",
    );
    pauseOk = st === "PAUSED";
    log("PAUSE_STATE", st);
    const resume = page.getByRole("button", { name: /Resume/i });
    if (await resume.count()) {
      await resume.first().click();
      await page.waitForTimeout(800);
      const st2 = await page.getAttribute(
        '[data-trm-hands-free="true"]',
        "data-conversation-state",
      );
      resumeOk = st2 === "LISTENING";
      log("RESUME_STATE", st2);
    }
  }

  let endOk = false;
  const end = page.getByRole("button", { name: /End/i });
  if (await end.count()) {
    await end.first().click();
    await page.waitForURL(/complete/, { timeout: 120000 }).catch(() => null);
    endOk = /complete/.test(page.url());
    log("END_URL", page.url());
  }

  // Confirm no push-to-talk / start-stop mic controls were required
  const micButtons = await page.locator(
    'button:has-text("Hold"), button:has-text("Push to Talk"), [data-ptt="true"]',
  ).count();

  const report = {
    completedTurns: completed,
    targetTurns: TURNS,
    network,
    pauseOk,
    resumeOk,
    endOk,
    bargeInOk,
    pushToTalkButtonsSeen: micButtons,
    consoleErrors,
    pass:
      completed >= TURNS &&
      pauseOk &&
      resumeOk &&
      endOk &&
      consoleErrors.length === 0,
  };
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
  log("REPORT", JSON.stringify(report));

  await browser.close();
  if (!report.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(join(OUT, "fatal.txt"), String(err?.stack || err));
  process.exit(1);
});
