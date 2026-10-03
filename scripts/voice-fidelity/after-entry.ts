/**
 * Voice fidelity harness bundle entry (current tree). Built by drive.mjs with
 * esbuild; exposes the real voice-layer modules to harness.html. Not shipped.
 */
import { startBargeInMonitor, startHandsFreeVad } from "@/lib/therapy-room/vad";
import { createEndpointController } from "@/lib/voice/endpoint-controller";
import { playQueuedSpeech } from "@/lib/voice/speech-queue";

(window as unknown as { H: unknown }).H = {
  startHandsFreeVad,
  startBargeInMonitor,
  createEndpointController,
  playQueuedSpeech,
  variant: "after",
};
