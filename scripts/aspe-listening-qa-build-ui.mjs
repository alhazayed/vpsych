#!/usr/bin/env node
/**
 * Build a human-only ASPE listening QA UI from an existing manifest.
 * Does NOT call ElevenLabs. Does NOT auto-mark PASS.
 *
 * Usage:
 *   node scripts/aspe-listening-qa-build-ui.mjs
 *   ASPE_QA_OUT=/path/to/pack node scripts/aspe-listening-qa-build-ui.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR =
  process.env.ASPE_QA_OUT || "/opt/cursor/artifacts/aspe-listening-qa";

const STATUS = [
  "NOT REVIEWED",
  "PASS",
  "MINOR ISSUE",
  "CLINICALLY SIGNIFICANT ISSUE",
];

const SEVERITY = ["", "Critical", "High", "Medium", "Low"];

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function main() {
  const manifestPath = join(OUT_DIR, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const rows = manifest.rows || [];

  // Ensure human review fields exist; never invent PASS.
  for (const r of rows) {
    if (!r.humanStatus) r.humanStatus = "NOT REVIEWED";
    if (r.defectYesNo == null) r.defectYesNo = "";
    if (!r.severity) r.severity = "";
    if (!r.comment) r.comment = r.defect || "";
    // Preserve evidence-pending decision unless a human overrides offline.
    if (r.audioResult === "GENERATED_NOT_LISTENED" || !r.audioResult) {
      r.audioResult = "GENERATED_NOT_LISTENED";
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const reviewsTemplate = {
    schema: "aspe-listening-human-review.v1",
    decision: "EVIDENCE PENDING",
    note: "All statuses default to NOT REVIEWED. Only a human may set PASS.",
    reviewedAt: null,
    reviewer: null,
    reviews: rows.map((r) => ({
      id: r.id,
      category: r.category,
      input: r.input,
      aspeText: r.aspeText,
      humanStatus: "NOT REVIEWED",
      defectYesNo: "",
      severity: "",
      comment: "",
    })),
  };
  writeFileSync(
    join(OUT_DIR, "human-reviews.template.json"),
    JSON.stringify(reviewsTemplate, null, 2),
  );

  const cards = rows
    .map((r, idx) => {
      const origSrc = r.orig?.path
        ? `audio/${r.id}__orig.mp3`
        : "";
      const aspeSrc = r.aspe?.path
        ? `audio/${r.id}__aspe.mp3`
        : "";
      return `
<article class="card" id="${esc(r.id)}" data-id="${esc(r.id)}" data-index="${idx}">
  <header class="card-head">
    <div>
      <div class="id">${esc(r.id)}</div>
      <div class="cat">${esc(r.category)} · case ${idx + 1} / ${rows.length}</div>
    </div>
    <div class="status-pill" data-status-pill>NOT REVIEWED</div>
  </header>

  <div class="texts">
    <div>
      <div class="label">Original Arabic</div>
      <div class="text" dir="rtl" lang="ar">${esc(r.input)}</div>
    </div>
    <div>
      <div class="label">ASPE-prepared Arabic</div>
      <div class="text" dir="rtl" lang="ar">${esc(r.aspeText)}</div>
    </div>
  </div>

  <div class="players">
    <div class="player">
      <button type="button" class="play-btn" data-play="orig" ${origSrc ? "" : "disabled"}>Original ▶</button>
      ${origSrc ? `<audio preload="none" data-audio="orig" src="${esc(origSrc)}"></audio>` : `<div class="missing">Missing original audio</div>`}
    </div>
    <div class="player">
      <button type="button" class="play-btn aspe" data-play="aspe" ${aspeSrc ? "" : "disabled"}>ASPE ▶</button>
      ${aspeSrc ? `<audio preload="none" data-audio="aspe" src="${esc(aspeSrc)}"></audio>` : `<div class="missing">Missing ASPE audio</div>`}
    </div>
  </div>

  <div class="form">
    <label>Defect
      <select data-field="defectYesNo">
        <option value="">—</option>
        <option value="No">No</option>
        <option value="Yes">Yes</option>
      </select>
    </label>
    <label>Severity
      <select data-field="severity">
        ${SEVERITY.map((s) => `<option value="${esc(s)}">${s || "—"}</option>`).join("")}
      </select>
    </label>
    <label class="status-label">Human QA status
      <select data-field="humanStatus">
        ${STATUS.map((s) => `<option value="${esc(s)}"${s === "NOT REVIEWED" ? " selected" : ""}>${esc(s)}</option>`).join("")}
      </select>
    </label>
    <label class="comment-label">Comment
      <textarea data-field="comment" rows="2" placeholder="Pronunciation / stress / medical / number / dialect notes"></textarea>
    </label>
  </div>
</article>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>ASPE Human Listening QA — EVIDENCE PENDING</title>
  <style>
    :root {
      --bg: #10161c;
      --card: #171e26;
      --line: #2b3642;
      --text: #e8eef4;
      --muted: #9aa8b5;
      --accent: #3d8bfd;
      --aspe: #2f9e74;
      --warn: #c9852d;
      --bad: #c44c4c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
    }
    header.top {
      position: sticky; top: 0; z-index: 5;
      background: rgba(16,22,28,.96);
      border-bottom: 1px solid var(--line);
      padding: 0.85rem 1.25rem;
      backdrop-filter: blur(8px);
    }
    header.top h1 { margin: 0; font-size: 1.05rem; font-weight: 650; }
    header.top p { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.86rem; }
    .banner {
      margin: 1rem 1.25rem 0;
      padding: 0.75rem 1rem;
      border: 1px solid var(--warn);
      background: #2a2114;
      color: #f0d7a4;
      border-radius: 8px;
      font-size: 0.92rem;
    }
    .toolbar {
      display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
      margin: 1rem 1.25rem;
    }
    .toolbar button, .play-btn {
      appearance: none; border: 1px solid var(--line); background: #1d2630;
      color: var(--text); border-radius: 8px; padding: 0.55rem 0.85rem;
      cursor: pointer; font: inherit;
    }
    .toolbar button:hover, .play-btn:hover { border-color: #4a5a6b; }
    .play-btn { background: #243041; min-width: 8.5rem; }
    .play-btn.aspe { background: #1d342c; border-color: #2f5a48; }
    .play-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .counts { color: var(--muted); font-size: 0.88rem; margin-inline-start: auto; }
    main { max-width: 920px; margin: 0 auto; padding: 0 1.25rem 3rem; }
    .card {
      background: var(--card); border: 1px solid var(--line);
      border-radius: 12px; padding: 1rem; margin: 1rem 0;
    }
    .card-head { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    .id { font-weight: 700; font-size: 1rem; }
    .cat { color: var(--muted); font-size: 0.82rem; margin-top: 0.15rem; }
    .status-pill {
      font-size: 0.75rem; font-weight: 650; letter-spacing: 0.02em;
      border: 1px solid var(--line); border-radius: 999px; padding: 0.3rem 0.65rem;
      white-space: nowrap; color: var(--muted);
    }
    .status-pill[data-v="PASS"] { color: #8fe0b8; border-color: #2f9e74; }
    .status-pill[data-v="MINOR ISSUE"] { color: #f0d7a4; border-color: var(--warn); }
    .status-pill[data-v="CLINICALLY SIGNIFICANT ISSUE"] { color: #f0b4b4; border-color: var(--bad); }
    .texts { display: grid; gap: 0.75rem; margin: 0.9rem 0; }
    @media (min-width: 720px) { .texts { grid-template-columns: 1fr 1fr; } }
    .label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem; }
    .text {
      background: #10161c; border: 1px solid var(--line); border-radius: 8px;
      padding: 0.7rem 0.8rem; min-height: 3.2rem; white-space: pre-wrap;
    }
    .players { display: grid; gap: 0.6rem; margin: 0.75rem 0; }
    @media (min-width: 720px) { .players { grid-template-columns: 1fr 1fr; } }
    .player audio { width: 100%; margin-top: 0.4rem; }
    .missing { color: var(--bad); font-size: 0.85rem; margin-top: 0.4rem; }
    .form {
      display: grid; gap: 0.65rem; margin-top: 0.75rem;
      grid-template-columns: 1fr 1fr;
    }
    .form label { display: grid; gap: 0.3rem; font-size: 0.82rem; color: var(--muted); }
    .form .status-label, .form .comment-label { grid-column: 1 / -1; }
    select, textarea {
      width: 100%; background: #10161c; color: var(--text);
      border: 1px solid var(--line); border-radius: 8px; padding: 0.5rem 0.6rem;
      font: inherit;
    }
    footer.note {
      margin: 1.5rem 1.25rem 2rem; color: var(--muted); font-size: 0.85rem;
      max-width: 920px;
    }
  </style>
</head>
<body>
  <header class="top">
    <h1>ASPE Human Listening QA</h1>
    <p>Synthetic speech-validation corpus only — not clinical patient data. Decision remains <strong>EVIDENCE PENDING</strong> until you review.</p>
  </header>

  <div class="banner">
    No status is set to PASS automatically. Default for every case is <strong>NOT REVIEWED</strong>.
    Export your judgments before closing the tab.
  </div>

  <div class="toolbar">
    <button type="button" id="btn-export">Export reviews JSON</button>
    <button type="button" id="btn-import">Import reviews JSON</button>
    <input type="file" id="import-file" accept="application/json,.json" hidden />
    <button type="button" id="btn-clear">Reset local judgments</button>
    <div class="counts" id="counts"></div>
  </div>

  <main>
    ${cards}
  </main>

  <footer class="note">
    Generated from manifest (${esc(manifest.generatedAt || "unknown")}).
    Audio lives beside this file under <code>audio/*__orig.mp3</code> and <code>audio/*__aspe.mp3</code>.
    Production TTS behavior is not modified by this page.
  </footer>

<script>
const STORAGE_KEY = "aspe-listening-human-reviews-v1";
const DEFAULT_STATUS = "NOT REVIEWED";

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  updateCounts();
}
function updateCounts() {
  const cards = [...document.querySelectorAll(".card")];
  const store = loadStore();
  let reviewed = 0, pass = 0, minor = 0, clinical = 0;
  for (const card of cards) {
    const id = card.dataset.id;
    const st = (store[id] && store[id].humanStatus) || DEFAULT_STATUS;
    if (st !== DEFAULT_STATUS) reviewed++;
    if (st === "PASS") pass++;
    if (st === "MINOR ISSUE") minor++;
    if (st === "CLINICALLY SIGNIFICANT ISSUE") clinical++;
  }
  document.getElementById("counts").textContent =
    cards.length + " cases · " + reviewed + " reviewed · PASS " + pass +
    " · minor " + minor + " · clinical " + clinical + " · decision: EVIDENCE PENDING until human export";
}

function applyToCard(card, data) {
  const d = data || {};
  for (const field of ["defectYesNo", "severity", "humanStatus", "comment"]) {
    const el = card.querySelector('[data-field="' + field + '"]');
    if (!el) continue;
    if (field === "humanStatus") el.value = d.humanStatus || DEFAULT_STATUS;
    else el.value = d[field] || "";
  }
  const pill = card.querySelector("[data-status-pill]");
  const st = d.humanStatus || DEFAULT_STATUS;
  pill.textContent = st;
  pill.dataset.v = st;
}

function readCard(card) {
  return {
    id: card.dataset.id,
    category: card.querySelector(".cat")?.textContent?.split("·")[0]?.trim() || "",
    humanStatus: card.querySelector('[data-field="humanStatus"]').value || DEFAULT_STATUS,
    defectYesNo: card.querySelector('[data-field="defectYesNo"]').value || "",
    severity: card.querySelector('[data-field="severity"]').value || "",
    comment: card.querySelector('[data-field="comment"]').value || "",
  };
}

function stopOthers(except) {
  document.querySelectorAll("audio").forEach((a) => {
    if (a !== except) { a.pause(); a.currentTime = 0; }
  });
}

document.querySelectorAll(".card").forEach((card) => {
  card.querySelectorAll("[data-play]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const which = btn.getAttribute("data-play");
      const audio = card.querySelector('audio[data-audio="' + which + '"]');
      if (!audio) return;
      stopOthers(audio);
      if (audio.paused) audio.play();
      else { audio.pause(); audio.currentTime = 0; }
    });
  });
  card.querySelectorAll("[data-field]").forEach((el) => {
    el.addEventListener("change", () => {
      const store = loadStore();
      store[card.dataset.id] = readCard(card);
      saveStore(store);
      applyToCard(card, store[card.dataset.id]);
    });
    el.addEventListener("input", () => {
      const store = loadStore();
      store[card.dataset.id] = readCard(card);
      saveStore(store);
      applyToCard(card, store[card.dataset.id]);
    });
  });
});

// Hydrate from localStorage — never invent PASS for untouched cards.
const store = loadStore();
document.querySelectorAll(".card").forEach((card) => {
  applyToCard(card, store[card.dataset.id]);
});
updateCounts();

document.getElementById("btn-export").addEventListener("click", () => {
  const store = loadStore();
  const reviews = [...document.querySelectorAll(".card")].map((card) => {
    const base = store[card.dataset.id] || readCard(card);
    return {
      id: card.dataset.id,
      category: base.category || card.querySelector(".cat")?.textContent?.split("·")[0]?.trim() || "",
      input: card.querySelectorAll(".text")[0]?.textContent || "",
      aspeText: card.querySelectorAll(".text")[1]?.textContent || "",
      humanStatus: base.humanStatus || DEFAULT_STATUS,
      defectYesNo: base.defectYesNo || "",
      severity: base.severity || "",
      comment: base.comment || "",
    };
  });
  const reviewed = reviews.filter((r) => r.humanStatus !== DEFAULT_STATUS).length;
  const payload = {
    schema: "aspe-listening-human-review.v1",
    decision: reviewed === 0 ? "EVIDENCE PENDING" : "HUMAN REVIEW IN PROGRESS",
    exportedAt: new Date().toISOString(),
    note: "PASS is never automatic. Clinical GO requires human completion.",
    totalCases: reviews.length,
    reviewedCount: reviewed,
    reviews,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "aspe-human-reviews.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("import-file").click();
});
document.getElementById("import-file").addEventListener("change", async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  const list = data.reviews || [];
  const store = loadStore();
  for (const r of list) {
    if (!r || !r.id) continue;
    store[r.id] = {
      id: r.id,
      category: r.category || "",
      humanStatus: r.humanStatus || DEFAULT_STATUS,
      defectYesNo: r.defectYesNo || "",
      severity: r.severity || "",
      comment: r.comment || "",
    };
  }
  saveStore(store);
  document.querySelectorAll(".card").forEach((card) => applyToCard(card, store[card.dataset.id]));
  ev.target.value = "";
});

document.getElementById("btn-clear").addEventListener("click", () => {
  if (!confirm("Reset all local judgments to NOT REVIEWED?")) return;
  localStorage.removeItem(STORAGE_KEY);
  document.querySelectorAll(".card").forEach((card) => applyToCard(card, null));
  updateCounts();
});
</script>
</body>
</html>`;

  writeFileSync(join(OUT_DIR, "listen.html"), html);

  // Keep decision explicit in manifest.
  manifest.decision = "EVIDENCE PENDING";
  manifest.listened = 0;
  manifest.humanReviewUi = "listen.html";
  manifest.humanReviewsTemplate = "human-reviews.template.json";
  manifest.note =
    "Audio generated; human listening required. UI never auto-marks PASS.";
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // README for operators
  const readme = `# ASPE Human Listening QA Pack

**Decision: EVIDENCE PENDING** (until a human reviews)

## Contents

- \`listen.html\` — human listening UI
- \`audio/*__orig.mp3\` — Original Arabic → ElevenLabs
- \`audio/*__aspe.mp3\` — ASPE-prepared Arabic → ElevenLabs
- \`manifest.json\` — generation metadata (not clinical patient data)
- \`human-reviews.template.json\` — empty review sheet (all NOT REVIEWED)
- \`corpus-dump.json\` — synthetic text corpus used for TTS

## Open / listen

From this directory:

\`\`\`bash
python3 -m http.server 8765
\`\`\`

Then open: http://127.0.0.1:8765/listen.html

Or open \`listen.html\` directly in a browser (audio paths are relative).

## Record defects

For each case:

1. Click **Original ▶** then **ASPE ▶**
2. Set **Defect** Yes/No
3. Set **Severity** if Defect = Yes (Critical / High / Medium / Low)
4. Set **Human QA status**:
   - NOT REVIEWED (default)
   - PASS
   - MINOR ISSUE
   - CLINICALLY SIGNIFICANT ISSUE
5. Add a **Comment**
6. Click **Export reviews JSON** and save \`aspe-human-reviews.json\`

Nothing is marked PASS automatically.

## Scope boundary

This pack is synthetic speech-validation audio only.
It is separate from clinical transcripts, patient records, and production TTS behavior.
`;
  writeFileSync(join(OUT_DIR, "README.md"), readme);

  console.log(`Built UI for ${rows.length} cases at ${join(OUT_DIR, "listen.html")}`);
  console.log("Decision remains: EVIDENCE PENDING");
}

main();
