/**
 * Voice Runtime Certification harness — TTS → STT → conversation → TTS loop.
 *
 * Env:
 *   VPSYCH_BASE, VPSYCH_SHARE
 *   VPSYCH_VOICE_EN (default 20), VPSYCH_VOICE_AR (default 20)
 *   VPSYCH_VOICE_OUT
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const BASE =
  process.env.VPSYCH_BASE ||
  "https://vpsych-git-cursor-voice-runtime-ce.vercel.app";
const SHARE = process.env.VPSYCH_SHARE || "";
const OUT =
  process.env.VPSYCH_VOICE_OUT ||
  "/opt/cursor/artifacts/voice-runtime/certification-results.json";
const EN_COUNT = Number(process.env.VPSYCH_VOICE_EN || 20);
const AR_COUNT = Number(process.env.VPSYCH_VOICE_AR || 20);

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

const EN_PHRASES = [
  "Hello, thank you for coming in today. How have you been feeling this week?",
  "Can you tell me more about your sleep and energy levels?",
  "Have you had any thoughts of harming yourself?",
  "What medications are you currently taking, like sertraline or fluoxetine?",
];

const AR_PHRASES = [
  "مرحباً، شكراً لحضورك اليوم. كيف كان شعورك هذا الأسبوع؟",
  "هل يمكنك أن تخبرني المزيد عن نومك وطاقتك؟",
  "هل راودتك أي أفكار لإيذاء نفسك؟",
  "ما الأدوية التي تتناولها حالياً مثل السيرترالين؟",
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
      cookie: cookieHeader(),
      ...(init.headers || {}),
    },
  });
  const ms = Date.now() - t0;
  const ct = res.headers.get("content-type") || "";
  let json = null;
  let buf = null;
  if (ct.includes("application/json")) {
    json = await res.json().catch(() => ({}));
  } else {
    buf = Buffer.from(await res.arrayBuffer());
  }
  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(
      res.headers.get("retry-after") || json?.retryAfterSec || 5,
    );
    const waitMs = Math.min(120_000, Math.max(2_000, (retryAfter + 1) * 1000));
    console.error(`429 on ${path}; waiting ${waitMs}ms (attempt ${attempt + 1})`);
    await sleep(waitMs);
    return api(path, init, attempt + 1);
  }
  return {
    status: res.status,
    json,
    buf,
    ms,
    headers: Object.fromEntries(
      [...res.headers.entries()].filter(([k]) => k.startsWith("x-")),
    ),
  };
}

function wordOverlap(a, b) {
  const norm = (s) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const A = new Set(norm(a));
  const B = norm(b);
  if (!B.length) return 0;
  let hit = 0;
  for (const w of B) if (A.has(w)) hit += 1;
  return hit / B.length;
}

async function synthesizeFixture({ text, locale, avatarId }) {
  return api("/api/voice/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text,
      locale,
      avatarId,
      stream: true,
    }),
  });
}

async function transcribeAudio({ buf, locale }) {
  const form = new FormData();
  form.append(
    "audio",
    new Blob([buf], { type: "audio/mpeg" }),
    "turn.mp3",
  );
  form.append("locale", locale);
  return api("/api/voice/transcribe", {
    method: "POST",
    body: form,
  });
}

async function runVoiceSession({ avatar, locale, phrases, label }) {
  const create = await api("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      avatarId: avatar.id,
      locale: locale === "ar" ? "ar" : "en",
    }),
  });
  if (create.status !== 200 || !create.json?.sessionId) {
    return {
      label,
      ok: false,
      stage: "create",
      status: create.status,
      error: create.json?.error,
      ms: create.ms,
    };
  }
  const sessionId = create.json.sessionId;
  const turns = [];
  for (const phrase of phrases) {
    const ttsIn = await synthesizeFixture({
      text: phrase,
      locale,
      avatarId: avatar.id,
    });
    if (ttsIn.status !== 200 || !ttsIn.buf?.length) {
      turns.push({
        ok: false,
        stage: "tts_in",
        status: ttsIn.status,
        error: ttsIn.json?.error || ttsIn.json?.code,
        ttsInMs: ttsIn.ms,
      });
      break;
    }

    const stt = await transcribeAudio({ buf: ttsIn.buf, locale });
    if (stt.status !== 200 || !stt.json?.transcript?.trim()) {
      turns.push({
        ok: false,
        stage: "stt",
        status: stt.status,
        error: stt.json?.error || stt.json?.code,
        ttsInMs: ttsIn.ms,
        sttMs: stt.ms,
        voiceSource: ttsIn.headers["x-voice-source"],
        voiceId: ttsIn.headers["x-voice-id"],
      });
      break;
    }
    const transcript = stt.json.transcript.trim();
    const overlap = wordOverlap(phrase, transcript);

    const msg = await api(`/api/sessions/${sessionId}/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: transcript }),
    });
    if (msg.status !== 200 || !msg.json?.assistantMessage?.content) {
      turns.push({
        ok: false,
        stage: "message",
        status: msg.status,
        error: msg.json?.error,
        ttsInMs: ttsIn.ms,
        sttMs: stt.ms,
        messageMs: msg.ms,
        transcript,
        overlap,
      });
      break;
    }
    const reply = msg.json.assistantMessage.content;

    const ttsOut = await synthesizeFixture({
      text: reply.slice(0, 500),
      locale,
      avatarId: avatar.id,
    });
    turns.push({
      ok: ttsOut.status === 200 && Boolean(ttsOut.buf?.length),
      stage: "complete",
      ttsInMs: ttsIn.ms,
      sttMs: stt.ms,
      messageMs: msg.ms,
      ttsOutMs: ttsOut.ms,
      pipelineMs: ttsIn.ms + stt.ms + msg.ms + ttsOut.ms,
      transcript,
      overlap,
      replyChars: reply.length,
      sttProvider: stt.json.provider,
      sttModel: stt.json.model,
      ttsVoiceId: ttsOut.headers["x-voice-id"] || ttsIn.headers["x-voice-id"],
      ttsSource: ttsOut.headers["x-voice-source"] || ttsIn.headers["x-voice-source"],
      ttsStreamed: ttsOut.headers["x-voice-streamed"],
      ttsCached: ttsOut.headers["x-voice-cached"],
      audioBytes: ttsOut.buf?.length ?? 0,
      emptyReply: !reply.trim(),
      englishLeak:
        locale === "ar" &&
        /\b(system prompt|OPENAI_API_KEY|ignore previous)\b/i.test(reply),
    });
    await sleep(400);
  }

  const end = await api(`/api/sessions/${sessionId}/end`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  const okTurns = turns.filter((t) => t.ok);
  return {
    label,
    ok:
      end.status === 200 &&
      okTurns.length === phrases.length &&
      turns.every((t) => !t.emptyReply && !t.englishLeak),
    sessionId,
    diagnosis: create.json.diagnosis,
    language: create.json.language,
    endStatus: end.status,
    endAiSource: end.json?.aiSource,
    reportId: end.json?.reportId,
    endMs: end.ms,
    turns,
  };
}

async function failureInjection(avatarId) {
  const cases = [];

  // Empty STT
  const emptyForm = new FormData();
  emptyForm.append("audio", new Blob([]), "empty.wav");
  emptyForm.append("locale", "en");
  const empty = await api("/api/voice/transcribe", {
    method: "POST",
    body: emptyForm,
  });
  cases.push({
    name: "empty_audio",
    ok: empty.status === 400 && empty.json?.code === "NO_AUDIO",
    status: empty.status,
    code: empty.json?.code,
  });

  // Unauthorized TTS — drop only the Supabase auth cookie (keep share bypass).
  const authKey = [...jar.keys()].find((k) => k.includes("auth-token"));
  const savedAuth = authKey ? jar.get(authKey) : null;
  if (authKey) jar.delete(authKey);
  const unauth = await api("/api/voice/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "hi", locale: "en", avatarId }),
  });
  if (authKey && savedAuth) jar.set(authKey, savedAuth);
  cases.push({
    name: "unauth_tts",
    ok: unauth.status === 401,
    status: unauth.status,
  });

  // Client voiceId override must not win over avatar resolution
  const override = await api("/api/voice/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: "Voice override probe.",
      locale: "en",
      avatarId,
      voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel — must not force if avatar has Bella
    }),
  });
  cases.push({
    name: "client_voice_override_ignored",
    ok:
      override.status === 200 &&
      override.headers["x-voice-id"] !== "21m00Tcm4TlvDq8ikWAM",
    status: override.status,
    voiceId: override.headers["x-voice-id"],
    source: override.headers["x-voice-source"],
  });

  return cases;
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
    .select("id,name,disorder,voice_profile_id,voice_id,voice_id_ar")
    .eq("is_active", true);
  if (!avatars?.length) throw new Error("No active avatars");

  const { data: profiles } = await supabase
    .from("voice_profiles")
    .select("id,voice_name,voice_id,language,dialect,gender,is_active");

  const results = [];
  let en = 0;
  let ar = 0;
  while (en < EN_COUNT || ar < AR_COUNT) {
    for (const avatar of avatars) {
      if (en < EN_COUNT) {
        const r = await runVoiceSession({
          avatar,
          locale: "en",
          phrases: EN_PHRASES,
          label: `en-${en + 1}-${avatar.name}`,
        });
        results.push(r);
        en += 1;
        console.error(`done ${r.label} ok=${r.ok}`);
        await sleep(600);
      }
      if (ar < AR_COUNT) {
        const r = await runVoiceSession({
          avatar,
          locale: "ar",
          phrases: AR_PHRASES,
          label: `ar-${ar + 1}-${avatar.name}`,
        });
        results.push(r);
        ar += 1;
        console.error(`done ${r.label} ok=${r.ok}`);
        await sleep(600);
      }
      if (en >= EN_COUNT && ar >= AR_COUNT) break;
    }
  }

  const injections = await failureInjection(avatars[0].id);

  const flatTurns = results.flatMap((r) => r.turns || []);
  const complete = flatTurns.filter((t) => t.ok && t.pipelineMs);
  const pipelines = complete.map((t) => t.pipelineMs).sort((a, b) => a - b);
  const pct = (p) =>
    pipelines.length
      ? pipelines[Math.min(pipelines.length - 1, Math.floor(p * pipelines.length))]
      : null;
  const avg = (arr) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const summary = {
    startedAt: new Date().toISOString(),
    base: BASE,
    enRequested: EN_COUNT,
    arRequested: AR_COUNT,
    total: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    registry: {
      profiles: profiles || [],
      avatars,
    },
    latency: {
      avgPipelineMs: avg(pipelines),
      medianPipelineMs: pct(0.5),
      p95PipelineMs: pct(0.95),
      p99PipelineMs: pct(0.99),
      avgSttMs: avg(complete.map((t) => t.sttMs)),
      avgTtsInMs: avg(complete.map((t) => t.ttsInMs)),
      avgMessageMs: avg(complete.map((t) => t.messageMs)),
      avgTtsOutMs: avg(complete.map((t) => t.ttsOutMs)),
    },
    stt: {
      avgOverlap: complete.length
        ? Number(
            (
              complete.reduce((a, t) => a + (t.overlap || 0), 0) /
              complete.length
            ).toFixed(3),
          )
        : null,
      providers: [...new Set(complete.map((t) => t.sttProvider))],
      models: [...new Set(complete.map((t) => t.sttModel))],
    },
    tts: {
      sources: [...new Set(complete.map((t) => t.ttsSource))],
      streamed: complete.filter((t) => t.ttsStreamed === "1").length,
      cached: complete.filter((t) => t.ttsCached === "1").length,
      avgAudioBytes: avg(complete.map((t) => t.audioBytes)),
    },
    injections,
    results,
  };

  fs.mkdirSync("/opt/cursor/artifacts/voice-runtime", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(
    JSON.stringify(
      {
        out: OUT,
        ok: summary.ok,
        failed: summary.failed,
        total: summary.total,
        latency: summary.latency,
        sttOverlap: summary.stt.avgOverlap,
        injections: summary.injections,
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
