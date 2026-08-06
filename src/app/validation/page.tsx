import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  VALIDATION_ACCESS_COOKIE,
  isValidAccessCookie,
} from "@/lib/validation/invite";
import { ValidationPortal } from "@/components/validation/ValidationPortal";

export default async function ValidationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const jar = await cookies();
  const initiallyUnlocked = isValidAccessCookie(
    jar.get(VALIDATION_ACCESS_COOKIE)?.value,
  );

  return (
    <ValidationPortal
      isAuthenticated={Boolean(user)}
      initiallyUnlocked={initiallyUnlocked}
    />
  );
}
