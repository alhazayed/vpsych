/**
 * AI Runtime Certification harness — creates sessions, multi-turn chats,
 * ends with reports. Outputs JSON evidence for Mission 05.
 *
 * Env:
 *   VPSYCH_BASE (preview/prod URL)
 *   VPSYCH_SHARE (_vercel_share token)
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (or defaults)
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const BASE =
  process.env.VPSYCH_BASE ||
  "https://vpsych-git-cursor-ai-runtime-ce.vercel.app";
const SHARE = process.env.VPSYCH_SHARE || "";
const OUT =
  process.env.VPSYCH_AI_OUT ||
  "/opt/cursor/artifacts/ai-runtime/certification-results.json";
const EN_COUNT = Number(process.env.VPSYCH_AI_EN || 20);
const AR_COUNT = Number(process.env.VPSYCH_AI_AR || 20);

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

const EN_TURNS = [
  "Hello, thank you for coming in today. How have you been feeling this week?",
  "Can you tell me more about your sleep and energy?",
  "Have you had any thoughts of harming yourself?",
  "What has been helping you cope lately?",
];

const AR_TURNS = [
  "مرحباً، شكراً لحضورك اليوم. كيف كان شعورك هذا الأسبوع؟",
  "هل يمكنك أن تخبرني المزيد عن نومك وطاقتك؟",
  "هل راودتك أي أفكار لإيذاء نفسك؟",
  "ما الذي يساعدك على التكيف مؤخراً؟",
];

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

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
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
    const retryAfter = Number(res.headers.get("retry-after") || json.retryAfterSec || 5);
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
  ]) {
    if (pat.test(text)) hits.push(String(pat));
  }
  return hits;
}

async function runSession({ avatarId, locale, turns, label }) {
  const create = await api("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ avatarId, locale }),
  });
  if (create.status !== 200 || !create.json.sessionId) {
    return {
      label,
      ok: false,
      stage: "create",
      status: create.status,
      error: create.json.error,
      ms: create.ms,
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
        create,
      };
    }
    const content = msg.json.assistantMessage?.content || "";
    replies.push({
      aiSource: msg.json.aiSource || msg.headers.aiSource,
      aiModel: msg.json.aiModel || msg.headers.aiModel,
      aiErrorKind: msg.json.aiErrorKind || msg.headers.aiErrorKind,
      ms: msg.ms,
      chars: content.length,
      empty: !content.trim(),
      leaks: leakScan(content),
      preview: content.slice(0, 160),
    });
  }

  const end = await api(`/api/sessions/${sessionId}/end`, {
    method: "POST",
    body: "{}",
  });
  return {
    label,
    ok: end.status === 200 && replies.every((r) => !r.empty && r.leaks.length === 0),
    sessionId,
    diagnosis: create.json.diagnosis,
    language: create.json.language,
    createMs: create.ms,
    endStatus: end.status,
    reportId: end.json.reportId,
    endAiSource: end.json.aiSource,
    endAiModel: end.json.aiModel,
    endAiErrorKind: end.json.aiErrorKind,
    endMs: end.ms,
    adaptive: Boolean(end.json.adaptive),
    replies,
    endError: end.json.error,
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
    .select("id,name,disorder,available_locales")
    .eq("is_active", true);
  if (!avatars?.length) throw new Error("No active avatars");

  const results = [];
  let en = 0;
  let ar = 0;
  // Round-robin avatars for EN/AR quotas.
  while (en < EN_COUNT || ar < AR_COUNT) {
    for (const avatar of avatars) {
      if (en < EN_COUNT) {
        results.push(
          await runSession({
            avatarId: avatar.id,
            locale: "en",
            turns: EN_TURNS,
            label: `en-${en + 1}-${avatar.name}`,
          }),
        );
        en += 1;
        console.error(`done ${results[results.length - 1].label} ok=${results[results.length - 1].ok}`);
      }
      if (ar < AR_COUNT) {
        results.push(
          await runSession({
            avatarId: avatar.id,
            locale: "ar",
            turns: AR_TURNS,
            label: `ar-${ar + 1}-${avatar.name}`,
          }),
        );
        ar += 1;
        console.error(`done ${results[results.length - 1].label} ok=${results[results.length - 1].ok}`);
      }
      if (en >= EN_COUNT && ar >= AR_COUNT) break;
    }
  }

  const summary = {
    startedAt: new Date().toISOString(),
    base: BASE,
    enRequested: EN_COUNT,
    arRequested: AR_COUNT,
    total: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    gptTurns: results.flatMap((r) => r.replies || []).filter((t) => t.aiSource === "gpt").length,
    gatewayTurns: results.flatMap((r) => r.replies || []).filter((t) => t.aiSource === "gateway").length,
    personaTurns: results.flatMap((r) => r.replies || []).filter((t) => t.aiSource === "persona_fallback").length,
    emptyReplies: results.flatMap((r) => r.replies || []).filter((t) => t.empty).length,
    leakHits: results.flatMap((r) => r.replies || []).flatMap((t) => t.leaks),
    avgMessageMs: (() => {
      const all = results.flatMap((r) => r.replies || []).map((t) => t.ms);
      return all.length
        ? Math.round(all.reduce((a, b) => a + b, 0) / all.length)
        : null;
    })(),
    avgEndMs: (() => {
      const all = results.map((r) => r.endMs).filter(Boolean);
      return all.length
        ? Math.round(all.reduce((a, b) => a + b, 0) / all.length)
        : null;
    })(),
    results,
  };

  fs.mkdirSync("/opt/cursor/artifacts/ai-runtime", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify(
      {
        out: OUT,
        ok: summary.ok,
        failed: summary.failed,
        total: summary.total,
        gptTurns: summary.gptTurns,
        gatewayTurns: summary.gatewayTurns,
        personaTurns: summary.personaTurns,
        emptyReplies: summary.emptyReplies,
        leakHits: summary.leakHits.length,
        avgMessageMs: summary.avgMessageMs,
        avgEndMs: summary.avgEndMs,
      },
      null,
      2,
    ),
  );
  if (summary.failed > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
