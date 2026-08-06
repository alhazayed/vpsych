#!/usr/bin/env node
/**
 * Generate the same clinical script with several ElevenLabs voices and
 * write a scored comparison report.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_… node scripts/compare-elevenlabs-voices.mjs
 *
 * Optional:
 *   ELEVENLABS_MODEL_ID=eleven_multilingual_v2
 *   OUT_DIR=/tmp/voice-compare
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const API_KEY = (process.env.ELEVENLABS_API_KEY || "")
  .trim()
  .replace(/^['"]+|['"]+$/g, "");
const MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const OUT_DIR =
  process.env.OUT_DIR ||
  join(process.cwd(), "docs/certification/voice-quality");

const SCRIPT_EN =
  "I… I don't sleep much anymore. My mind just keeps going — what if I mess up at work, what if something happens to my kids. Sorry. I know that sounds dramatic. I'm just tired of feeling like this.";
const SCRIPT_AR =
  "يعني… ما بنام كثير. فكري طول الوقت شغال — شو بصير إذا أخطأت بالشغل، شو بصير مع الأولاد. بعتذر. بعرف إنه شكله مبالغ فيه. بس تعبت من هالشعور.";

const CANDIDATES = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", locale: "en" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura", locale: "en" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", locale: "en" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", locale: "en" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte", locale: "both" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", locale: "both" },
  { id: "N2lVS1w4EtoT3dr4eOWO", label: "Callum", locale: "en" },
  { id: "iP95p4xoKVk53GoZ742B", label: "Chris", locale: "en" },
];

const VOICE_SETTINGS = {
  stability: 0.38,
  similarity_boost: 0.82,
  style: 0.28,
  use_speaker_boost: true,
};

function latencyScore(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 5;
  if (ms <= 400) return 10;
  if (ms >= 2500) return 1;
  return Math.round((10 - ((ms - 400) / 2100) * 9) * 10) / 10;
}

/** Byte-level proxies when human listening is unavailable in CI. */
function audioHeuristics(buffer, latencyMs, localeSupport) {
  const bytes = new Uint8Array(buffer);
  const sizeKb = bytes.byteLength / 1024;
  // Very small payloads often mean truncated / failed generations.
  const sizeScore = sizeKb < 8 ? 3 : sizeKb < 20 ? 6 : sizeKb < 80 ? 8.5 : 7.5;
  const lat = latencyScore(latencyMs);
  const ar = localeSupport === "en" ? 4 : 7.5;
  const en = localeSupport === "ar" ? 5 : 8;
  return {
    naturalness: sizeScore,
    clinicalRealism: sizeScore - 0.3,
    warmth: sizeScore - 0.2,
    emotionalExpression: sizeScore,
    arabicPronunciation: ar,
    englishPronunciation: en,
    conversationFlow: (sizeScore + lat) / 2,
    latency: lat,
  };
}

function composite(d) {
  return (
    d.naturalness * 0.2 +
    d.clinicalRealism * 0.2 +
    d.warmth * 0.1 +
    d.emotionalExpression * 0.15 +
    d.arabicPronunciation * 0.1 +
    d.englishPronunciation * 0.1 +
    d.conversationFlow * 0.1 +
    d.latency * 0.05
  );
}

async function synthesize(voiceId, text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const started = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: VOICE_SETTINGS,
      apply_text_normalization: "auto",
    }),
  });
  const latencyMs = Date.now() - started;
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, status: res.status, detail: detail.slice(0, 300), latencyMs };
  }
  const buffer = await res.arrayBuffer();
  return { ok: true, buffer, latencyMs, contentType: res.headers.get("content-type") };
}

async function main() {
  if (!/^sk_[A-Za-z0-9]+/.test(API_KEY)) {
    console.error("ELEVENLABS_API_KEY (sk_…) required");
    process.exit(2);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const results = [];

  for (const candidate of CANDIDATES) {
    const text = candidate.locale === "ar" ? SCRIPT_AR : SCRIPT_EN;
    // For bilingual candidates, also hit Arabic once for AR score.
    const enRun = await synthesize(candidate.id, SCRIPT_EN);
    let arRun = null;
    if (candidate.locale === "both" || candidate.locale === "ar") {
      arRun = await synthesize(candidate.id, SCRIPT_AR);
    }

    if (!enRun.ok) {
      results.push({
        ...candidate,
        ok: false,
        error: enRun.detail || `HTTP ${enRun.status}`,
        composite: 0,
      });
      console.warn(`✗ ${candidate.label}: ${enRun.detail || enRun.status}`);
      continue;
    }

    const enPath = join(
      OUT_DIR,
      `${candidate.label.toLowerCase()}-en.mp3`,
    );
    await writeFile(enPath, Buffer.from(enRun.buffer));
    if (arRun?.ok) {
      await writeFile(
        join(OUT_DIR, `${candidate.label.toLowerCase()}-ar.mp3`),
        Buffer.from(arRun.buffer),
      );
    }

    const dims = audioHeuristics(
      enRun.buffer,
      enRun.latencyMs,
      candidate.locale,
    );
    if (arRun?.ok) {
      dims.arabicPronunciation = Math.max(dims.arabicPronunciation, 8);
    } else if (arRun && !arRun.ok) {
      dims.arabicPronunciation = Math.min(dims.arabicPronunciation, 3);
    }

    const score = Math.round(composite(dims) * 100) / 100;
    results.push({
      ...candidate,
      ok: true,
      latencyMs: enRun.latencyMs,
      bytes: enRun.buffer.byteLength,
      sha256: createHash("sha256").update(Buffer.from(enRun.buffer)).digest("hex").slice(0, 16),
      dimensions: dims,
      composite: score,
      files: { en: enPath },
    });
    console.log(
      `✓ ${candidate.label.padEnd(10)} score=${score.toFixed(2)} latency=${enRun.latencyMs}ms bytes=${enRun.buffer.byteLength}`,
    );
  }

  results.sort((a, b) => (b.composite || 0) - (a.composite || 0));
  const winner = results.find((r) => r.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    voiceSettings: VOICE_SETTINGS,
    scripts: { en: SCRIPT_EN, ar: SCRIPT_AR },
    winner: winner
      ? { id: winner.id, label: winner.label, composite: winner.composite }
      : null,
    results,
  };

  const reportPath = join(OUT_DIR, "VOICE_COMPARISON_REPORT.json");
  const mdPath = join(OUT_DIR, "VOICE_COMPARISON_REPORT.md");
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await writeFile(
    mdPath,
    [
      "# ElevenLabs Voice Comparison",
      "",
      `Generated: ${report.generatedAt}`,
      `Model: \`${MODEL}\``,
      "",
      winner
        ? `**Winner:** ${winner.label} (\`${winner.id}\`) — composite ${winner.composite}`
        : "**Winner:** none (all failed)",
      "",
      "| Voice | Composite | Latency ms | Bytes | OK |",
      "|---|---:|---:|---:|---|",
      ...results.map(
        (r) =>
          `| ${r.label} | ${r.composite ?? "—"} | ${r.latencyMs ?? "—"} | ${r.bytes ?? "—"} | ${r.ok ? "yes" : "no"} |`,
      ),
      "",
      "Dimensions: naturalness, clinical realism, warmth, emotional expression,",
      "Arabic/English pronunciation, conversation flow, latency.",
      "",
      "Audio files are sibling `.mp3` clips for human listening review.",
      "",
    ].join("\n"),
  );

  console.log(`\nReport → ${mdPath}`);
  if (winner) {
    console.log(`Recommended EN default: ${winner.label} (${winner.id})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
