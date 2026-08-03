import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Skip static assets. /api/health is still matched but short-circuits in
     * updateSession before any Supabase Auth call.
     */
    "/((?!_next/static|_next/image|favicon.ico|avatars/.*|fonts/.*|stitch/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff|woff2)$).*)",
  ],
};
