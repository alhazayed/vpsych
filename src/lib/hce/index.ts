export { isHceEnabledForSession } from "@/lib/hce/config";
export { runHceTurn, parseCaseSnapshot } from "@/lib/hce/orchestrator";
export {
  extractHceSessionSignals,
  finalizeHceSessionMemory,
  hceSignalsToAceHints,
} from "@/lib/hce/integrate/ace-hce";
export type { HceTurnResult, HceSessionSignals } from "@/lib/hce/types";
