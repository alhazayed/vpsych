/**
 * Quality Adaptation — degrade gracefully under poor network.
 */

import type {
  NetworkQuality,
  QualityAdaptationDecision,
} from "@/lib/realtime/types";

export function adaptQuality(
  network: NetworkQuality,
): QualityAdaptationDecision {
  switch (network) {
    case "excellent":
      return {
        network,
        ttsChunkChars: 180,
        maxOutputTokens: 220,
        preferLowBandwidth: false,
        speechRateScale: 1,
      };
    case "good":
      return {
        network,
        ttsChunkChars: 140,
        maxOutputTokens: 180,
        preferLowBandwidth: false,
        speechRateScale: 1,
      };
    case "fair":
      return {
        network,
        ttsChunkChars: 100,
        maxOutputTokens: 140,
        preferLowBandwidth: true,
        speechRateScale: 0.95,
      };
    case "poor":
      return {
        network,
        ttsChunkChars: 70,
        maxOutputTokens: 100,
        preferLowBandwidth: true,
        speechRateScale: 0.9,
      };
    case "offline":
      return {
        network,
        ttsChunkChars: 40,
        maxOutputTokens: 60,
        preferLowBandwidth: true,
        speechRateScale: 0.85,
      };
  }
}

export function estimateNetworkFromRtt(rttMs: number): NetworkQuality {
  if (!Number.isFinite(rttMs) || rttMs < 0) return "offline";
  if (rttMs < 80) return "excellent";
  if (rttMs < 180) return "good";
  if (rttMs < 350) return "fair";
  if (rttMs < 800) return "poor";
  return "offline";
}
