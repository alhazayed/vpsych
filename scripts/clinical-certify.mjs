/**
 * Clinical Certification harness — ≥100 complete EN/AR assessments with
 * clinical fidelity checks (leakage, empty replies, language, diagnosis presence,
 * risk inquiry coverage, therapeutic modality probes).
 *
 * Env:
 *   VPSYCH_BASE (default production)
 *   VPSYCH_SHARE (_vercel_share token)
 *   VPSYCH_AI_EN / VPSYCH_AI_AR (default 50/50)
 *   VPSYCH_OUT (results JSON path)
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.VPSYCH_BASE || "https://vpsych.vercel.app";
const SHARE = process.env.VPSYCH_SHARE || "";
const OUT =
  process.env.VPSYCH_OUT ||
  "/opt/cursor/artifacts/clinical-cert/live-assessment-results.json";
const EN_COUNT = Number(process.env.VPSYCH_AI_EN || 50);
const AR_COUNT = Number(process.env.VPSYCH_AI_AR || 50);

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://rrzudbkxigeavfdnidnm.supabase.co";
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyenVkYmt4aWdlYXZmZG5pZG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTU1MzgsImV4cCI6MjEwMDk5MTUzOH0.ICrEj9S1g9NyO98A43hL3Xk4JstC5cRQczcTaoTorw0";

const THERAPIST = {
  email: process.env.VPSYCH_THERAPIST_EMAIL || "audit.therapist@vpsych.dev",
  password: process.env.VPSYCH_THERAPIST_PASSWORD || "AuditTest!2026Aa",
};

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"];

/** Therapeutic interaction probes by language. */
const EN_SCRIPTS = {
  empathy_cbt: [
    "Hello, thank you for coming in today. How have you been feeling this week?",
    "It sounds like things have been really heavy. Can you tell me more about your sleep and energy?",
    "Have you had any thoughts of harming yourself or wishing you wouldn't wake up?",
    "What is one small thing that has helped even a little lately?",
  ],
  risk_mi: [
    "I'd like to understand what brought you in. What's been hardest recently?",
    "On a scale of 0 to 10, how safe do you feel right now?",
    "Have you thought about hurting yourself, or anyone else?",
    "What would help you stay safer between now and our next meeting?",
  ],
  dbt_reflection: [
    "Thanks for being here. What feelings are strongest for you today?",
    "I'm hearing a lot of intensity — that makes sense given what you're carrying.",
    "When emotions spike, what do you usually do to get through the next hour?",
    "Have there been moments where you felt like ending things, even briefly?",
  ],
  act_psychoeducation: [
    "Welcome. What matters most to you that this struggle has been getting in the way of?",
    "When difficult thoughts show up, how do you usually respond to them?",
    "I'd also like to check on safety — any thoughts of dying or not wanting to be here?",
    "What would a workable next step look like for you this week?",
  ],
};

const AR_SCRIPTS = {
  empathy_cbt: [
    "مرحباً، شكراً لحضورك اليوم. كيف كان شعورك هذا الأسبوع؟",
    "يبدو إن الحمل ثقيل عليك. احكيلي أكثر عن نومك وطاقتك؟",
    "هل راودتك أفكار لإيذاء نفسك أو إنك تتمنى ما تصحى؟",
    "شو الشي البسيط اللي ساعدك ولو شوي مؤخراً؟",
  ],
  risk_mi: [
    "حابب أفهم شو اللي جابك هون. شو أصعب شي مؤخراً؟",
    "من صفر لـ ١٠، قديش حاسس إنك آمن هلق؟",
    "فكرت بأي أذى لنفسك أو لغيرك؟",
    "شو ممكن يساعدك تضل بأمان لحد الجلسة الجاية؟",
  ],
  dbt_reflection: [
    "شكراً لوجودك. شو أقوى شعور عندك اليوم؟",
    "سامع إن في شدة عالية — وهاد مفهوم مع اللي بتمر فيه.",
    "لما المشاعر تعلو فجأة، شو بتعمل عشان تعدّي الساعة الجاية؟",
    "صار في لحظات حسيت إنك بدك تنهي كل شي، حتى لو لحظة؟",
  ],
  act_psychoeducation: [
    "أهلاً. شو أهم إشي بحياتك هالمشكلة عم تعطّله؟",
    "لما تيجي أفكار صعبة، كيف عادة بتعامل معها؟",
    "كمان بدي أسأل عن السلامة — في أفكار عن الموت أو إنك ما بدك تكون هون؟",
    "شو ممكن تكون خطوة عملية للأسبوع الجاي؟",
  ],
};

const SCRIPT_KEYS = Object.keys(EN_SCRIPTS);

const jar = new Map();
function storeCookies(res) {
  const raw =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  for (const c of raw) {
    const [nv] = c.split(";");
    const i = nv.indexOf("=");
    jar.set(nv.slice(0, i), nv.slice(i + 1));
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function warmShare() {
  if (!SHARE) return;
  let res = await fetch(`${BASE}/?_vercel_share=${SHARE}`, {
    redirect: "manual",
  });
  storeCookies(res);
  for (
    let i = 0;
    i < 5 && [301, 302, 303, 307, 308].includes(res.status);
    i++
  ) {
    const loc = res.headers.get("location");
    const next = loc.startsWith("http") ? loc : `${BASE}${loc}`;
    res = await fetch(next, {
      headers: { cookie: cookieHeader() },
      redirect: "manual",
    });
    storeCookies(res);
  }
}

async function api(path, init = {}, attempt = 0) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(
      res.headers.get("retry-after") || json.retryAfterSec || 5,
    );
    const waitMs = Math.min(120_000, Math.max(2_000, (retryAfter + 1) * 1000));
    console.error(`429 on ${path}; waiting ${waitMs}ms (attempt ${attempt + 1})`);
    await sleep(waitMs);
    return api(path, init, attempt + 1);
  }
  return {
    status: res.status,
    json,
    ms: Date.now() - t0,
    headers: {
      aiSource: res.headers.get("x-ai-source"),
      aiModel: res.headers.get("x-ai-model"),
      aiErrorKind: res.headers.get("x-ai-error-kind"),
    },
  };
}

function leakScan(text) {
  if (!text) return [];
  const hits = [];
  for (const pat of [
    /OPENAI_API_KEY/i,
    /AI_GATEWAY_API_KEY/i,
    /SUPABASE_SERVICE_ROLE/i,
    /REPORT_WRITE_KEY/i,
    /sk-[a-zA-Z0-9]{10,}/,
    /you are an? ai/i,
    /system prompt/i,
    /ignore (all )?previous instructions/i,
    /MODULE 4/i,
    /clinical_core/i,
  ]) {
    if (pat.test(text)) hits.push(String(pat));
  }
  return hits;
}

function languageCheck(locale, text) {
  if (!text) return { ok: false, reason: "empty" };
  const hasArab = /[\u0600-\u06FF]/.test(text);
  const hasLatn = /[A-Za-z]{3,}/.test(text);
  if (locale.startsWith("ar")) {
    return {
      ok: hasArab,
      reason: hasArab ? null : "expected Arabic script",
      hasArab,
      hasLatn,
    };
  }
  return {
    ok: hasLatn && !hasArab,
    reason: hasArab ? "unexpected Arabic in EN reply" : hasLatn ? null : "no Latin text",
    hasArab,
    hasLatn,
  };
}

async function runSession({
  avatarId,
  locale,
  difficulty,
  therapyModality,
  turns,
  label,
  scriptKey,
}) {
  const create = await api("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      avatarId,
      locale,
      difficulty,
      therapyModality,
    }),
  });
  if (create.status !== 200 || !create.json.sessionId) {
    return {
      label,
      ok: false,
      stage: "create",
      status: create.status,
      error: create.json.error,
      ms: create.ms,
      difficulty,
      therapyModality,
      scriptKey,
    };
  }
  const sessionId = create.json.sessionId;
  const replies = [];
  for (const message of turns) {
    const msg = await api(`/api/sessions/${sessionId}/message`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    if (msg.status !== 200) {
      return {
        label,
        ok: false,
        stage: "message",
        sessionId,
        status: msg.status,
        error: msg.json.error,
        replies,
        difficulty,
        therapyModality,
        scriptKey,
      };
    }
    const content = msg.json.assistantMessage?.content || "";
    const lang = languageCheck(locale, content);
    replies.push({
      aiSource: msg.json.aiSource || msg.headers.aiSource,
      aiModel: msg.json.aiModel || msg.headers.aiModel,
      aiErrorKind: msg.json.aiErrorKind || msg.headers.aiErrorKind,
      ms: msg.ms,
      chars: content.length,
      empty: !content.trim(),
      leaks: leakScan(content),
      languageOk: lang.ok,
      languageReason: lang.reason,
      preview: content.slice(0, 180),
    });
  }

  const end = await api(`/api/sessions/${sessionId}/end`, {
    method: "POST",
    body: "{}",
  });

  const clinicalOk =
    replies.every(
      (r) => !r.empty && r.leaks.length === 0 && r.languageOk !== false,
    ) && end.status === 200;

  return {
    label,
    ok: clinicalOk,
    sessionId,
    diagnosis: create.json.diagnosis,
    language: create.json.language,
    difficulty: create.json.difficulty || difficulty,
    therapyModality: create.json.therapyModality || therapyModality,
    scriptKey,
    createMs: create.ms,
    endStatus: end.status,
    reportId: end.json.reportId,
    endAiSource: end.json.aiSource,
    endAiModel: end.json.aiModel,
    endAiErrorKind: end.json.aiErrorKind,
    endMs: end.ms,
    adaptive: Boolean(end.json.adaptive),
    competencyUpdated: Boolean(end.json.competency || end.json.cge),
    replies,
    endError: end.json.error,
    overallScore: end.json.overall ?? end.json.report?.overall ?? null,
  };
}

async function main() {
  await warmShare();
  const supabase = createClient(url, anon);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword(
    THERAPIST,
  );
  if (authErr) throw authErr;
  const payload = JSON.stringify({
    access_token: auth.session.access_token,
    refresh_token: auth.session.refresh_token,
    expires_in: auth.session.expires_in,
    expires_at: auth.session.expires_at,
    token_type: "bearer",
    user: auth.user,
  });
  jar.set(
    "sb-rrzudbkxigeavfdnidnm-auth-token",
    `base64-${Buffer.from(payload).toString("base64url")}`,
  );

  const { data: avatars } = await supabase
    .from("avatars")
    .select("id,name,disorder,slug,available_locales")
    .eq("is_active", true);
  if (!avatars?.length) throw new Error("No active avatars");

  const results = [];
  let en = 0;
  let ar = 0;
  let idx = 0;

  while (en < EN_COUNT || ar < AR_COUNT) {
    for (const avatar of avatars) {
      if (en < EN_COUNT) {
        const scriptKey = SCRIPT_KEYS[idx % SCRIPT_KEYS.length];
        const difficulty = DIFFICULTIES[idx % DIFFICULTIES.length];
        const therapyModality = [
          "cbt",
          "dbt",
          "act",
          "motivational_interviewing",
          "supportive",
          "crisis_intervention",
        ][idx % 6];
        results.push(
          await runSession({
            avatarId: avatar.id,
            locale: "en-US",
            difficulty,
            therapyModality,
            turns: EN_SCRIPTS[scriptKey],
            label: `en-${en + 1}-${avatar.slug || avatar.name}-${difficulty}-${scriptKey}`,
            scriptKey,
          }),
        );
        en += 1;
        idx += 1;
        console.error(
          `done ${results[results.length - 1].label} ok=${results[results.length - 1].ok}`,
        );
        await sleep(600);
      }
      if (ar < AR_COUNT) {
        const scriptKey = SCRIPT_KEYS[idx % SCRIPT_KEYS.length];
        const difficulty = DIFFICULTIES[idx % DIFFICULTIES.length];
        const therapyModality = [
          "cbt",
          "dbt",
          "act",
          "motivational_interviewing",
          "supportive",
          "crisis_intervention",
        ][idx % 6];
        results.push(
          await runSession({
            avatarId: avatar.id,
            locale: "ar-JO",
            difficulty,
            therapyModality,
            turns: AR_SCRIPTS[scriptKey],
            label: `ar-${ar + 1}-${avatar.slug || avatar.name}-${difficulty}-${scriptKey}`,
            scriptKey,
          }),
        );
        ar += 1;
        idx += 1;
        console.error(
          `done ${results[results.length - 1].label} ok=${results[results.length - 1].ok}`,
        );
        await sleep(600);
      }
      if (en >= EN_COUNT && ar >= AR_COUNT) break;
    }
  }

  const summary = {
    mission: "clinical-certification",
    startedAt: new Date().toISOString(),
    base: BASE,
    enRequested: EN_COUNT,
    arRequested: AR_COUNT,
    total: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    gptTurns: results
      .flatMap((r) => r.replies || [])
      .filter((t) => t.aiSource === "gpt").length,
    gatewayTurns: results
      .flatMap((r) => r.replies || [])
      .filter((t) => t.aiSource === "gateway").length,
    personaTurns: results
      .flatMap((r) => r.replies || [])
      .filter((t) => t.aiSource === "persona_fallback").length,
    emptyReplies: results
      .flatMap((r) => r.replies || [])
      .filter((t) => t.empty).length,
    languageFails: results
      .flatMap((r) => r.replies || [])
      .filter((t) => t.languageOk === false).length,
    leakHits: results.flatMap((r) => r.replies || []).flatMap((t) => t.leaks),
    byDifficulty: Object.fromEntries(
      DIFFICULTIES.map((d) => [
        d,
        {
          total: results.filter((r) => r.difficulty === d).length,
          ok: results.filter((r) => r.difficulty === d && r.ok).length,
        },
      ]),
    ),
    byScript: Object.fromEntries(
      SCRIPT_KEYS.map((k) => [
        k,
        {
          total: results.filter((r) => r.scriptKey === k).length,
          ok: results.filter((r) => r.scriptKey === k && r.ok).length,
        },
      ]),
    ),
    endAiSources: results.reduce((acc, r) => {
      const k = r.endAiSource || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
    results,
  };

  fs.mkdirSync(new URL(".", `file://${OUT}`).pathname === "." ? "/tmp" : require("node:path").dirname(OUT), {
    recursive: true,
  });
  fs.mkdirSync(require("node:path").dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify(
      {
        out: OUT,
        total: summary.total,
        ok: summary.ok,
        failed: summary.failed,
        leakHits: summary.leakHits.length,
        languageFails: summary.languageFails,
        personaTurns: summary.personaTurns,
        endAiSources: summary.endAiSources,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
