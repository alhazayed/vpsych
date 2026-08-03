import { buildCitationsJson } from "@/lib/geo/citations";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(buildCitationsJson(), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
