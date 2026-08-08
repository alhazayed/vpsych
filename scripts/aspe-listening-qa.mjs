#!/usr/bin/env node
/**
 * ASPE Arabic TTS listening QA harness.
 *
 * Generates side-by-side ElevenLabs audio on a stable TTS host:
 *   A) Original Arabic text → ElevenLabs
 *   B) Locally ASPE-prepared Arabic text → ElevenLabs
 *
 * Using a pre-ASPE TTS host for BOTH ensures we evaluate the current
 * branch's prepareArabicSpeech output, not a stale deploy.
 *
 * Requires session via /tmp/aspe_auth.json or ASPE_QA_EMAIL/PASSWORD.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://rrzudbkxigeavfdnidnm.supabase.co";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyenVkYmt4aWdlYXZmZG5pZG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTU1MzgsImV4cCI6MjEwMDk5MTUzOH0.ICrEj9S1g9NyO98A43hL3Xk4JstC5cRQczcTaoTorw0";

/** TTS host without ASPE mutation (so prepared text is what we send). */
const TTS_BASE =
  process.env.ASPE_QA_TTS_BASE ||
  "https://vpsych-l7qhputsx-alhazayed-1540s-projects.vercel.app";

const OUT_DIR =
  process.env.ASPE_QA_OUT || "/opt/cursor/artifacts/aspe-listening-qa";

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

function loadCorpus() {
  const dump = join(OUT_DIR, "corpus-dump.json");
  if (existsSync(dump)) {
    return JSON.parse(readFileSync(dump, "utf8"));
  }
  throw new Error(
    `Missing ${dump}. Run: npx tsx scripts/aspe-listening-qa-dump.ts first`,
  );
}

async function passwordLogin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(
      `Login failed: ${data.error_description || data.msg || res.status}`,
    );
  }
  return data;
}

function sessionCookie(auth) {
  const session = {
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expires_in: auth.expires_in ?? 3600,
    expires_at: auth.expires_at,
    token_type: "bearer",
    user: auth.user,
  };
  const raw =
    "base64-" + Buffer.from(JSON.stringify(session)).toString("base64");
  const name = "sb-rrzudbkxigeavfdnidnm-auth-token";
  const CHUNK = 3000;
  const chunks = [];
  for (let i = 0; i < raw.length; i += CHUNK) {
    chunks.push(raw.slice(i, i + CHUNK));
  }
  if (chunks.length === 1) return `${name}=${chunks[0]}`;
  return chunks.map((c, i) => `${name}.${i}=${c}`).join("; ");
}

async function synthesize(cookie, text) {
  const res = await fetch(`${TTS_BASE}/api/voice/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Accept: "audio/mpeg, application/json",
    },
    body: JSON.stringify({ text, locale: "ar", stream: false }),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    ok: res.ok,
    status: res.status,
    contentType: res.headers.get("content-type"),
    voiceId: res.headers.get("x-voice-id"),
    bytes: buf.length,
    body: buf,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(join(OUT_DIR, "audio"), { recursive: true });

  let auth;
  if (process.env.ASPE_QA_EMAIL && process.env.ASPE_QA_PASSWORD) {
    auth = await passwordLogin(
      process.env.ASPE_QA_EMAIL,
      process.env.ASPE_QA_PASSWORD,
    );
  } else if (existsSync("/tmp/aspe_auth.json")) {
    auth = JSON.parse(readFileSync("/tmp/aspe_auth.json", "utf8"));
  } else {
    throw new Error(
      "Set ASPE_QA_EMAIL/PASSWORD or provide /tmp/aspe_auth.json",
    );
  }

  let cookie = sessionCookie(auth);
  let cookieB = cookie;
  if (process.env.ASPE_QA_EMAIL_B && process.env.ASPE_QA_PASSWORD_B) {
    const authB = await passwordLogin(
      process.env.ASPE_QA_EMAIL_B,
      process.env.ASPE_QA_PASSWORD_B,
    );
    cookieB = sessionCookie(authB);
    console.log("Using secondary account for prepared half");
  }

  const corpus = loadCorpus().slice(
    0,
    Number.isFinite(LIMIT) ? LIMIT : undefined,
  );
  const rows = [];

  console.log(`Generating ${corpus.length} A/B pairs on ${TTS_BASE}`);

  for (const c of corpus) {
    const row = {
      id: c.id,
      category: c.group,
      input: c.input,
      aspeText: c.aspeText ?? "",
      orig: null,
      aspe: null,
      audioResult: "PENDING_LISTEN",
      defect: "",
      severity: "",
      action: "",
    };

    try {
      const a = await synthesize(cookie, c.input);
      const aPath = join(OUT_DIR, "audio", `${c.id}__orig.mp3`);
      if (a.ok && a.contentType?.includes("audio")) {
        writeFileSync(aPath, a.body);
        row.orig = {
          path: aPath,
          bytes: a.bytes,
          voiceId: a.voiceId,
          status: a.status,
        };
      } else {
        row.orig = {
          error: a.body.toString("utf8").slice(0, 200),
          status: a.status,
        };
      }
    } catch (e) {
      row.orig = { error: String(e) };
    }

    await new Promise((r) => setTimeout(r, 350));

    try {
      const b = await synthesize(cookieB, c.aspeText || c.input);
      const bPath = join(OUT_DIR, "audio", `${c.id}__aspe.mp3`);
      if (b.ok && b.contentType?.includes("audio")) {
        writeFileSync(bPath, b.body);
        row.aspe = {
          path: bPath,
          bytes: b.bytes,
          voiceId: b.voiceId,
          status: b.status,
        };
      } else {
        row.aspe = {
          error: b.body.toString("utf8").slice(0, 200),
          status: b.status,
        };
      }
    } catch (e) {
      row.aspe = { error: String(e) };
    }

    row.audioResult =
      row.orig?.path && row.aspe?.path
        ? "GENERATED_NOT_LISTENED"
        : "GENERATION_FAILED";
    rows.push(row);
    console.log(
      `${c.id}: orig=${row.orig?.bytes ?? "fail"} aspe=${row.aspe?.bytes ?? "fail"}`,
    );
    await new Promise((r) => setTimeout(r, 350));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    ttsBase: TTS_BASE,
    method:
      "A=original text, B=local ASPE prepareArabicSpeechText → same ElevenLabs host",
    totalCases: rows.length,
    generatedPairs: rows.filter((r) => r.orig?.path && r.aspe?.path).length,
    listened: 0,
    decision: "EVIDENCE PENDING",
    note: "Audio files generated; listening scores require actual playback review.",
    rows,
  };

  writeFileSync(
    join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  const md = [
    "# ASPE Arabic TTS Listening QA",
    "",
    `| Generated | ${manifest.generatedAt} |`,
    `| TTS host | ${TTS_BASE} |`,
    `| Method | ${manifest.method} |`,
    `| Cases | ${manifest.totalCases} |`,
    `| Audio pairs generated | ${manifest.generatedPairs} |`,
    `| Listened | ${manifest.listened} |`,
    `| Decision | **${manifest.decision}** |`,
    "",
    "| ID | Category | Input | ASPE Output | Audio Result | Defect | Severity | Action |",
    "|----|----------|-------|-------------|--------------|--------|----------|--------|",
    ...rows.map((r) => {
      const input = (r.input || "").replace(/\|/g, "\\|").slice(0, 60);
      const aspeText = (r.aspeText || "").replace(/\|/g, "\\|").slice(0, 60);
      return `| ${r.id} | ${r.category} | ${input} | ${aspeText} | ${r.audioResult} | ${r.defect || "—"} | ${r.severity || "—"} | ${r.action || "—"} |`;
    }),
    "",
  ].join("\n");
  writeFileSync(join(OUT_DIR, "QA_TABLE.md"), md);

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<meta charset="utf-8"/>
<title>ASPE Listening QA</title>
<style>
  body{font-family:system-ui,sans-serif;margin:1.5rem;background:#0f1419;color:#e7ecf1}
  h1{font-size:1.25rem}
  .card{border:1px solid #2a3440;border-radius:8px;padding:1rem;margin:1rem 0}
  .meta{opacity:.75;font-size:.85rem;white-space:pre-wrap}
  audio{width:100%;margin:.4rem 0}
  .label{font-size:.8rem;opacity:.8}
</style>
<h1>ASPE Arabic TTS — Original vs Prepared</h1>
<p class="meta">A = original · B = ASPE-prepared (local engine). Do not mark GO without playback.</p>
${rows
  .map(
    (r) => `<div class="card" id="${r.id}">
  <strong>${r.id}</strong> · ${r.category}
  <div class="meta">Input: ${(r.input || "").replace(/</g, "&lt;")}</div>
  <div class="meta">ASPE: ${(r.aspeText || "").replace(/</g, "&lt;")}</div>
  <div class="label">A — Original</div>
  ${r.orig?.path ? `<audio controls src="audio/${r.id}__orig.mp3"></audio>` : "<div>FAILED</div>"}
  <div class="label">B — ASPE prepared</div>
  ${r.aspe?.path ? `<audio controls src="audio/${r.id}__aspe.mp3"></audio>` : "<div>FAILED</div>"}
</div>`,
  )
  .join("\n")}
</html>`;
  writeFileSync(join(OUT_DIR, "listen.html"), html);

  console.log(`\nWrote ${join(OUT_DIR, "manifest.json")}`);
  console.log(
    `Pairs generated: ${manifest.generatedPairs}/${manifest.totalCases}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
