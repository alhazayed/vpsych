import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/ops/sentry-options";

Sentry.init(sentryBaseOptions());
