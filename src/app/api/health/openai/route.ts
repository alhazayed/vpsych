import { NextResponse } from "next/server";
import { openAIService } from "@/lib/ai/openai";

/**
 * OpenAI SDK health check.
 * New endpoint — does not alter existing product APIs.
 */
export async function GET() {
  const status = await openAIService.healthCheck();
  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
