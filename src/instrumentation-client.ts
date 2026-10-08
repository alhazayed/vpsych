import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/ops/sentry-options";

// No Session Replay: it would record on-screen transcripts.
Sentry.init(sentryBaseOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
