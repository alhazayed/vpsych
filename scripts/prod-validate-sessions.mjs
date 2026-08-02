/**
 * Production validation: four therapist sessions on https://vpsych.vercel.app
 * Captures screenshots + network evidence for message/TTS/end APIs.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.VPSYCH_PROD_URL || "https://vpsych.vercel.app";
const SHARE = process.env.VPSYCH_SHARE || "";
const THERAPIST = {
  email: process.env.VPSYCH_AUDIT_THERAPIST_EMAIL || "",
  password: process.env.VPSYCH_AUDIT_THERAPIST_PASSWORD || "",
};
const ADMIN = {
  email: process.env.VPSYCH_AUDIT_ADMIN_EMAIL || "",
  password: process.env.VPSYCH_AUDIT_ADMIN_PASSWORD || "",
};
if (!THERAPIST.email || !THERAPIST.password || !ADMIN.email || !ADMIN.password) {
  console.error(
    "Set VPSYCH_AUDIT_THERAPIST_EMAIL/PASSWORD and VPSYCH_AUDIT_ADMIN_EMAIL/PASSWORD",
  );
  process.exit(1);
}
const OUT = process.env.VPSYCH_OUT || "/opt/cursor/artifacts/prod-validation";
const SHOTS = process.env.VPSYCH_SHOTS || "/opt/cursor/artifacts/screenshots/prod";

const FALLBACK_EN = [
  "I'm not sure how to answer that",
  "I've been feeling that way a lot lately",
  "haven't thought about it like that",
  "I zoned out for a second",
  "It's hard to put into words",
];

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  base: BASE,
  scenarios: [],
  adminReview: null,
  blockers: [],
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function shot(page, name) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function goto(page, urlPath) {
  const url = SHARE && urlPath === "/"
    ? `${BASE}/?_vercel_share=${SHARE}`
    : `${BASE}${urlPath}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
}

async function signOutIfNeeded(page) {
  await goto(page, "/avatars").catch(() => null);
  await sleep(800);
  if (page.url().includes("/login")) return;
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = ((await page.evaluate((el) => el.textContent, btn)) || "").trim();
    if (/sign out|تسجيل الخروج/i.test(text)) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => null),
        btn.click(),
      ]);
      await sleep(800);
      return;
    }
  }
}

async function login(page, creds, label) {
  await signOutIfNeeded(page);
  await goto(page, "/login");
  // Already authenticated users are redirected to /avatars
  if (!page.url().includes("/login")) {
    await signOutIfNeeded(page);
    await goto(page, "/login");
  }
  await page.waitForSelector("#email, input[type='email']", { timeout: 30000 });
  await page.evaluate(() => {
    const email = document.querySelector("#email, input[type='email']");
    const pass = document.querySelector("#password, input[type='password']");
    if (email) email.value = "";
    if (pass) pass.value = "";
  });
  await page.type("#email, input[type='email']", creds.email, { delay: 10 });
  await page.type("#password", creds.password, { delay: 10 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await sleep(1500);
  await shot(page, `${label}-login`);
  const url = page.url();
  if (url.includes("/login")) {
    const err = await page.evaluate(() => document.body.innerText.slice(0, 500));
    throw new Error(`Login failed for ${creds.email}: still on login. ${err}`);
  }
}

async function switchLocale(page, locale) {
  // Cookie is source of truth after middleware fix; also click the switcher so
  // preferred_language stays in sync for report language.
  await page.setCookie({
    name: "locale",
    value: locale,
    domain: new URL(BASE).hostname,
    path: "/",
  });
  await page.evaluate((next) => {
    const buttons = [...document.querySelectorAll("button[aria-pressed]")];
    for (const btn of buttons) {
      const text = (btn.textContent || "").trim();
      if (next === "en" && text === "EN") {
        btn.click();
        return;
      }
      if (next === "ar" && (text === "ع" || text.includes("ع"))) {
        btn.click();
        return;
      }
    }
  }, locale);
  await sleep(2000);
  // Re-assert cookie in case a race reset it, then soft-navigate so next-intl
  // and StartSessionButton see the selected locale.
  await page.setCookie({
    name: "locale",
    value: locale,
    domain: new URL(BASE).hostname,
    path: "/",
  });
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(1000);
  const cookie = (await page.cookies()).find((c) => c.name === "locale");
  if (cookie?.value !== locale) {
    throw new Error(
      `Locale cookie not set: expected ${locale}, got ${cookie?.value}`,
    );
  }
}

async function startAvatarSession(page, avatarNamePart) {
  await goto(page, "/avatars");
  await page.waitForSelector("article", { timeout: 30000 });
  await shot(page, `avatars-${avatarNamePart.replace(/\s+/g, "-").toLowerCase()}`);

  const articles = await page.$$("article");
  for (const article of articles) {
    const text = await page.evaluate((el) => el.innerText, article);
    if (!text.toLowerCase().includes(avatarNamePart.toLowerCase())) continue;
    const btn = await article.$("button");
    if (!btn) continue;
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
      btn.click(),
    ]);
    await sleep(1500);
    return page.url();
  }
  throw new Error(`Avatar not found: ${avatarNamePart}`);
}

/** Ensure voice mode is ON so patient TTS (ElevenLabs) runs after replies. */
async function ensureVoiceMode(page) {
  const toggles = await page.$$("button");
  for (const btn of toggles) {
    const text = ((await page.evaluate((el) => el.textContent, btn)) || "").trim();
    // Button label is the current mode: "Voice"/"صوت" = already on; "Text"/"نص" = off
    if (/^(Text|نص)$/i.test(text) || /text mode|لوحة المفاتيح|keyboard/i.test(text)) {
      await btn.click();
      await sleep(600);
      return;
    }
    if (/^(Voice|صوت)$/i.test(text) || /graphic_eq/i.test(text)) {
      return;
    }
  }
}

function attachNetworkCapture(page) {
  const events = [];
  page.on("console", (msg) => {
    events.push({
      type: "console",
      level: msg.type(),
      text: msg.text(),
      ts: new Date().toISOString(),
    });
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (!/\/api\/(sessions|voice)\//.test(url)) return;
    const headers = res.headers();
    let bodyPreview = "";
    try {
      const ct = headers["content-type"] || "";
      if (ct.includes("application/json")) {
        bodyPreview = (await res.text()).slice(0, 800);
      } else if (ct.includes("audio") || ct.includes("mpeg")) {
        bodyPreview = `[audio bytes content-type=${ct} len≈${headers["content-length"] || "?"}]`;
      }
    } catch {
      /* ignore */
    }
    events.push({
      type: "network",
      url,
      status: res.status(),
      method: res.request().method(),
      headers: {
        "content-type": headers["content-type"],
        "x-voice-id": headers["x-voice-id"],
        "x-voice-locale": headers["x-voice-locale"],
        "x-voice-model": headers["x-voice-model"],
        "x-voice-source": headers["x-voice-source"],
        "x-voice-profile-id": headers["x-voice-profile-id"],
        "x-patient-provider": headers["x-patient-provider"],
        "x-patient-model": headers["x-patient-model"],
      },
      bodyPreview,
      ts: new Date().toISOString(),
    });
  });
  return events;
}

async function sendTurn(page, message) {
  const input = await page.$("form input, input.field-input, input[placeholder]");
  if (!input) throw new Error("Message input not found");
  await input.click({ clickCount: 3 });
  await input.type(message, { delay: 15 });
  await page.click('form button[type="submit"]');
  // Wait for assistant bubble or status change
  await sleep(8000);
}

function looksLikeFallback(text) {
  const t = text.toLowerCase();
  return FALLBACK_EN.some((f) => t.includes(f.toLowerCase()));
}

function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
}

async function collectTranscript(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll("section div.max-w-\\[92\\%\\], [class*='rounded-xl']")];
    // Prefer transcript panel messages
    const msgs = [];
    document.querySelectorAll("time").forEach((timeEl) => {
      const wrap = timeEl.closest("div.max-w-\\[92\\%\\]") || timeEl.parentElement?.parentElement;
      if (!wrap) return;
      const roleLabel = wrap.querySelector("p")?.textContent?.trim() || "";
      const content = wrap.textContent?.replace(roleLabel, "").replace(timeEl.textContent || "", "").trim() || "";
      msgs.push({
        roleLabel,
        time: timeEl.getAttribute("dateTime") || timeEl.textContent,
        content: content.slice(0, 500),
      });
    });
    return {
      msgs,
      bodySnippet: document.body.innerText.slice(0, 2500),
    };
  });
}

async function endSession(page) {
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = ((await page.evaluate((el) => el.textContent, btn)) || "").trim();
    if (/end session|ending|إنهاء/i.test(text) && !/end$/i.test(text.replace(/\s+/g, " "))) {
      // prefer End Session over End
    }
  }
  // Click the most specific end control
  let clicked = false;
  for (const btn of buttons) {
    const text = ((await page.evaluate((el) => el.textContent, btn)) || "").trim();
    if (/end session|إنهاء الجلسة/i.test(text)) {
      await btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    for (const btn of buttons) {
      const text = ((await page.evaluate((el) => el.textContent, btn)) || "").trim();
      if (text === "End" || text === "إنهاء") {
        await btn.click();
        clicked = true;
        break;
      }
    }
  }
  if (!clicked) throw new Error("End session button not found");
  await page.waitForFunction(
    () => location.pathname.includes("/complete"),
    { timeout: 120000 },
  ).catch(() => null);
  await sleep(2000);
}

async function runScenario(browser, scenario) {
  const page = await browser.newPage();
  const net = attachNetworkCapture(page);
  const result = {
    id: scenario.id,
    title: scenario.title,
    locale: scenario.locale,
    avatar: scenario.avatar,
    checks: {},
    network: [],
    console: [],
    errors: [],
    screenshots: [],
    sessionUrl: null,
    transcript: null,
  };

  try {
    await login(page, THERAPIST, scenario.id);
    result.checks.therapistLogin = true;

    await switchLocale(page, scenario.locale);
    result.screenshots.push(await shot(page, `${scenario.id}-locale`));

    const sessionUrl = await startAvatarSession(page, scenario.avatar);
    result.sessionUrl = sessionUrl;
    result.checks.avatarLoads = /\/sessions\//.test(sessionUrl);
    result.screenshots.push(await shot(page, `${scenario.id}-session-start`));

    await ensureVoiceMode(page);

    // Type via form — voice mode still allows typing + triggers ElevenLabs TTS
    await sendTurn(page, scenario.prompt1);
    await sleep(3000);
    await sendTurn(page, scenario.prompt2);
    await sleep(2000);

    result.screenshots.push(await shot(page, `${scenario.id}-transcript`));
    const transcript = await collectTranscript(page);
    result.transcript = transcript;

    const assistantTexts = transcript.msgs
      .filter((m) => !/you|أنت|انت/i.test(m.roleLabel))
      .map((m) => m.content);

    const patientReplies = assistantTexts.filter((t) => t && t.length > 5);
    result.checks.gptResponds = patientReplies.length >= 1;

    const messageCalls = net.filter(
      (e) => e.type === "network" && e.url.includes("/message") && e.method === "POST",
    );
    const ttsCalls = net.filter(
      (e) => e.type === "network" && e.url.includes("/voice/tts") && e.method === "POST",
    );

    result.checks.messageApiOk = messageCalls.some((c) => c.status === 200);
    result.checks.transcriptSaved = messageCalls.some(
      (c) => c.status === 200 && /userMessage|assistantMessage/.test(c.bodyPreview || ""),
    );

    // Session language from message API (must be ar-JO for Arabic scenarios)
    const localeFromApi = messageCalls
      .map((c) => {
        try {
          return JSON.parse(c.bodyPreview || "{}").locale;
        } catch {
          return null;
        }
      })
      .find(Boolean);
    result.sessionLocale = localeFromApi || null;
    if (scenario.locale === "ar") {
      result.checks.sessionLanguageAr = /^ar/i.test(String(localeFromApi || ""));
    } else {
      result.checks.sessionLanguageEn = /^en/i.test(String(localeFromApi || ""));
    }

    const aiSources = messageCalls
      .map((c) => {
        try {
          return JSON.parse(c.bodyPreview || "{}").aiSource;
        } catch {
          return c.headers?.["x-ai-source"];
        }
      })
      .filter(Boolean);
    result.aiSources = aiSources;

    // GPT-5 evidence: not pure fallback, and for AR has Arabic
    const joined = patientReplies.join("\n");
    const fallbackOnly =
      patientReplies.length > 0 &&
      patientReplies.every((t) => looksLikeFallback(t));
    const aiLive = aiSources.some((s) => s === "openai" || s === "gateway");
    // Require explicit provider signal when available; otherwise heuristic.
    result.checks.likelyLiveModel = aiSources.length
      ? aiLive
      : patientReplies.length > 0 && !fallbackOnly;
    result.checks.aiProviderLive = aiLive;
    if (scenario.locale === "ar") {
      result.checks.arabicReply = hasArabic(joined);
    } else {
      result.checks.englishReply = !hasArabic(joined) || /[A-Za-z]{10,}/.test(joined);
    }

    // ElevenLabs: audio response with voice headers
    const ttsOk = ttsCalls.find(
      (c) =>
        c.status === 200 &&
        (c.headers["content-type"] || "").includes("audio"),
    );
    result.checks.elevenLabsSpeaks = Boolean(ttsOk);
    if (ttsOk) {
      result.tts = {
        voiceId: ttsOk.headers["x-voice-id"],
        locale: ttsOk.headers["x-voice-locale"],
        model: ttsOk.headers["x-voice-model"],
        source: ttsOk.headers["x-voice-source"],
        profileId: ttsOk.headers["x-voice-profile-id"],
      };
    } else {
      const ttsErr = ttsCalls[ttsCalls.length - 1];
      result.ttsError = ttsErr || "no TTS request captured";
    }

    await endSession(page);
    result.screenshots.push(await shot(page, `${scenario.id}-complete`));
    result.checks.sessionEnded = page.url().includes("/complete");

    const endCalls = net.filter(
      (e) => e.type === "network" && e.url.includes("/end") && e.method === "POST",
    );
    result.checks.reportGenerated = endCalls.some(
      (c) => c.status === 200 && /"ok"\s*:\s*true/.test(c.bodyPreview || ""),
    );

    result.network = net.filter((e) => e.type === "network");
    result.console = net.filter((e) => e.type === "console");
  } catch (err) {
    result.errors.push(String(err?.stack || err));
    try {
      result.screenshots.push(await shot(page, `${scenario.id}-error`));
    } catch {
      /* ignore */
    }
  } finally {
    fs.writeFileSync(
      path.join(OUT, `${scenario.id}.json`),
      JSON.stringify(result, null, 2),
    );
    await page.close().catch(() => null);
  }
  return result;
}

async function adminReview(browser, sessionIds) {
  const page = await browser.newPage();
  const out = { checks: {}, screenshots: [], reports: [], errors: [] };
  try {
    // Sign out first
    await goto(page, "/avatars");
    const buttons = await page.$$("button");
    for (const btn of buttons) {
      const text = ((await page.evaluate((el) => el.textContent, btn)) || "").trim();
      if (/sign out|تسجيل الخروج/i.test(text)) {
        await btn.click();
        await sleep(1200);
        break;
      }
    }
    await login(page, ADMIN, "admin");
    out.checks.adminLogin = true;
    await goto(page, "/admin/reports");
    await sleep(1500);
    out.screenshots.push(await shot(page, "admin-reports"));
    const text = await page.evaluate(() => document.body.innerText);
    out.listText = text.slice(0, 3000);
    // Open newest report links
    const links = await page.$$('a[href*="/admin/reports/"]');
    const hrefs = [];
    for (const a of links.slice(0, 6)) {
      const href = await page.evaluate((el) => el.getAttribute("href"), a);
      if (href) hrefs.push(href);
    }
    for (const href of hrefs.slice(0, 4)) {
      await goto(page, href);
      await sleep(1000);
      const detail = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      const langMatch = detail.match(/\b(en-US|ar-JO|en|ar)\b/i);
      out.reports.push({ href, snippet: detail, languageHint: langMatch?.[1] || null });
      out.screenshots.push(
        await shot(page, `admin-report-${href.split("/").pop()?.slice(0, 8)}`),
      );
    }
    out.checks.adminCanReview = out.reports.length > 0;
  } catch (err) {
    out.errors.push(String(err?.stack || err));
  } finally {
    fs.writeFileSync(path.join(OUT, "admin-review.json"), JSON.stringify(out, null, 2));
    await page.close().catch(() => null);
  }
  return out;
}

const scenarios = [
  {
    id: "en-depression",
    title: "English Depression",
    locale: "en",
    avatar: "Maya",
    prompt1: "Hi Maya, thank you for coming in. How has your mood been this past week?",
    prompt2: "Tell me about your sleep and appetite lately.",
  },
  {
    id: "ar-depression",
    title: "Arabic Depression",
    locale: "ar",
    avatar: "Maya",
    prompt1: "مرحبا ليان، شكراً لوجودك اليوم. كيف كان مزاجك خلال الأسبوع الماضي؟",
    prompt2: "احكيلي عن نومك وشهيتك مؤخراً.",
  },
  {
    id: "en-gad",
    title: "English GAD",
    locale: "en",
    avatar: "Jordan",
    prompt1: "Hi Jordan, thanks for being here. What worries have been showing up most at work?",
    prompt2: "How is the worry affecting your sleep or concentration?",
  },
  {
    id: "ar-gad",
    title: "Arabic GAD",
    locale: "ar",
    avatar: "Jordan",
    prompt1: "مرحبا رامي، شكراً لوجودك. شو أكثر شي مقلقك هالفترة بالشغل؟",
    prompt2: "كيف بيأثر القلق على نومك أو تركيزك؟",
  },
];

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1400,900"],
  defaultViewport: { width: 1400, height: 900 },
});

try {
  // Warm share cookie
  if (SHARE) {
    const warm = await browser.newPage();
    await warm.goto(`${BASE}/?_vercel_share=${SHARE}`, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    await warm.close();
  }

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    if (i > 0) {
      // Give OpenAI rate-limit windows time to recover between scenarios.
      console.log("\n… cooling down 20s before next scenario");
      await sleep(20000);
    }
    console.log(`\n=== Running ${scenario.id} ===`);
    const result = await runScenario(browser, scenario);
    report.scenarios.push({
      id: result.id,
      title: result.title,
      locale: result.locale,
      checks: result.checks,
      errors: result.errors,
      tts: result.tts,
      ttsError: result.ttsError,
      sessionLocale: result.sessionLocale,
      aiSources: result.aiSources,
      sessionUrl: result.sessionUrl,
      patientSample: result.transcript?.msgs?.slice(-4),
    });
    console.log(JSON.stringify(result.checks, null, 2));
    if (result.errors.length) console.error(result.errors[0]);
  }

  console.log("\n=== Admin review ===");
  report.adminReview = await adminReview(browser, []);
  console.log(JSON.stringify(report.adminReview.checks, null, 2));
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(report, null, 2));
  console.log("\nWrote", path.join(OUT, "summary.json"));
}

// Exit non-zero if any hard check failed
const hard = ["therapistLogin", "avatarLoads", "gptResponds", "transcriptSaved", "sessionEnded", "reportGenerated"];
let failed = false;
for (const s of report.scenarios) {
  for (const k of hard) {
    if (!s.checks?.[k]) {
      console.error(`FAIL ${s.id}.${k}`);
      failed = true;
    }
  }
  if (s.locale === "ar" && s.checks && s.checks.arabicReply === false) {
    console.error(`FAIL ${s.id}.arabicReply`);
    failed = true;
  }
  if (s.locale === "ar" && s.checks && s.checks.sessionLanguageAr === false) {
    console.error(`FAIL ${s.id}.sessionLanguageAr`);
    failed = true;
  }
  if (!s.checks?.elevenLabsSpeaks) {
    console.error(`FAIL ${s.id}.elevenLabsSpeaks`);
    failed = true;
    if (s.ttsError?.bodyPreview?.includes("paid_plan_required")) {
      console.error(
        `  EXTERNAL: ElevenLabs paid_plan_required — upgrade API plan or use account-owned voices`,
      );
    }
  }
  if (!s.checks?.likelyLiveModel) {
    console.error(`FAIL ${s.id}.likelyLiveModel (possible fallback, not GPT-5)`);
    failed = true;
  }
}
if (!report.adminReview?.checks?.adminCanReview) {
  console.error("FAIL adminCanReview");
  failed = true;
}
process.exit(failed ? 1 : 0);
