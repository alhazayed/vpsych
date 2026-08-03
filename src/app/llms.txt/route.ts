import { buildLlmsTxt } from "@/lib/aeo/knowledge";

export const dynamic = "force-static";

/** Emerging AI crawler convention: https://llmstxt.org/ */
export async function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
