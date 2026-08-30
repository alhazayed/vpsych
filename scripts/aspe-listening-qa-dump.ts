/**
 * Dump ASPE listening corpus + prepared text for the Node audio harness.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { aspeListeningCorpus, prepareArabicSpeechText } from "../src/lib/arabic-speech";

const outDir =
  process.env.ASPE_QA_OUT || "/opt/cursor/artifacts/aspe-listening-qa";
mkdirSync(outDir, { recursive: true });

const cases = aspeListeningCorpus().map((c) => ({
  id: c.id,
  group: c.group,
  input: c.input,
  aspeText: prepareArabicSpeechText(c.input),
  mustInclude: c.mustInclude ?? [],
  mustNotInclude: c.mustNotInclude ?? [],
}));

writeFileSync(
  `${outDir}/corpus-dump.json`,
  JSON.stringify(cases, null, 2),
  "utf8",
);
console.log(`Wrote ${cases.length} cases to ${outDir}/corpus-dump.json`);
