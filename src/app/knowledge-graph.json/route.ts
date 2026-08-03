import { buildKnowledgeGraphDocument } from "@/lib/aeo/knowledge";

export const dynamic = "force-static";

export async function GET() {
  const doc = buildKnowledgeGraphDocument();
  return Response.json(doc, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
