import { buildLaunchReadinessDocument } from "@/lib/launch/checklist";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(buildLaunchReadinessDocument(), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
