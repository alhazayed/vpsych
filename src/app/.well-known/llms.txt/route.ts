import { buildLlmsTxt } from "@/lib/aeo/knowledge";

export const dynamic = "force-static";

/** Well-known mirror of /llms.txt for AI crawlers. */
export async function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
