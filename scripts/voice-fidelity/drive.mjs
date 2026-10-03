/**
 * Voice fidelity browser harness — real Chromium, fake microphone.
 *
 *   node scripts/voice-fidelity/drive.mjs [--base <worktree-of-base-ref>]
 *
 * Requires `playwright-core` (install outside the repo or with --no-save) and
 * Chromium at $CHROMIUM_PATH (default: /opt/pw-browsers/chromium-1194/...).
 * See README.md. Prints results and writes results.json to the work dir.
 */
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright-core";

const HERE = new URL(".", import.meta.url).pathname;
const REPO = resolve(HERE, "../..");
const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = baseIdx >= 0 ? resolve(args[baseIdx + 1]) : null;
const WORK = join(tmpdir(), "vpsych-voice-fidelity");
const SITE = join(WORK, "site");
const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ESBUILD = join(REPO, "node_modules/.bin/esbuild");

await mkdir(join(SITE, "audio"), { recursive: true });
execFileSync("python3", [join(HERE, "gen-audio.py"), join(SITE, "audio")]);

const html = await readFile(join(HERE, "harness.html"), "utf8");
execFileSync(ESBUILD, [join(HERE, "after-entry.ts"), "--bundle", "--format=iife",
  `--tsconfig=${join(REPO, "tsconfig.json")}`, `--outfile=${join(SITE, "after.js")}`]);
await writeFile(join(SITE, "after.html"), html.replace("__BUNDLE__", "after"));
const variants = ["after"];
if (BASE) {
  const entry = join(BASE, ".voice-fidelity-before-entry.ts");
  await writeFile(entry, `import { startHandsFreeVad, startBargeInMonitor } from "@/lib/therapy-room/vad";
(window as unknown as { H: unknown }).H = { startHandsFreeVad, startBargeInMonitor, variant: "before" };\n`);
  execFileSync(ESBUILD, [entry, "--bundle", "--format=iife",
    `--tsconfig=${join(BASE, "tsconfig.json")}`, `--outfile=${join(SITE, "before.js")}`]);
  await writeFile(join(SITE, "before.html"), html.replace("__BUNDLE__", "before"));
  variants.unshift("before");
}

const types = { ".html": "text/html", ".js": "text/javascript", ".wav": "audio/wav" };
const server = createServer(async (req, res) => {
  const p = join(SITE, decodeURIComponent((req.url ?? "/").split("?")[0]));
  let body;
  try {
    body = await readFile(p);
  } catch {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": types[extname(p)] ?? "application/octet-stream" });
  res.end(body);
}).listen(8765);

async function run(variant, micFile, fn, arg) {
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${join(SITE, "audio", micFile)}%noloop`,
      "--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://localhost:8765/${variant}.html`);
  await page.waitForFunction(() => window.ready);
  const out = await page.evaluate(([f, a]) => window[f](a), [fn, arg]);
  await browser.close();
  if (errors.length) out.errors = errors;
  return out;
}

const results = { endpoint: {}, bargeIn: {}, queue: {} };
const cases = [];
for (const X of [300, 600, 900, 1200, 1500]) for (const v of variants) cases.push([v, X, "uncertain"]);
for (const X of [1200, 1500, 1800]) cases.push(["after", X, "incomplete"]);
for (const [v, X, kind] of cases) {
  const r = await run(v, `pause_${X}.wav`, "runEndpoint", { pause: X, kind });
  results.endpoint[`${v}_${X}_${kind}`] = r;
  console.log(`endpoint ${v} pause=${X}ms fragment=${kind} premature=${r.premature}`,
    `transcriptReadyAfterSpeechEnd=${Math.round(r.transcriptReadyAt - r.speechEnd)}ms`);
}
results.bargeIn.reference = await run("after", "bargein.wav", "runReference");
for (const v of variants) results.bargeIn[v] = await run(v, "bargein.wav", "runBargeIn");
results.queue.full = await run("after", "bargein.wav", "runQueue", 0);
results.queue.abort = await run("after", "bargein.wav", "runQueue", 1500);
for (const [k, v] of Object.entries({ ...results.bargeIn, queue: results.queue.full, queueAbort: results.queue.abort })) {
  console.log(k, JSON.stringify({ ...v, events: undefined }));
}
await writeFile(join(WORK, "results.json"), JSON.stringify(results, null, 2));
console.log(`results: ${join(WORK, "results.json")}`);
server.close();
