"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function AppHeader({ profile }: { profile: Profile }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-[var(--line)] bg-[var(--surface)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/avatars" className="font-[family-name:var(--font-display)] text-lg tracking-tight text-[var(--ink)]">
          vpsych
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
          <Link href="/avatars" className="hover:text-[var(--ink)]">
            Avatars
          </Link>
          <Link href="/sessions" className="hover:text-[var(--ink)]">
            My sessions
          </Link>
          {profile.role === "admin" && (
            <>
              <Link href="/admin/reports" className="hover:text-[var(--ink)]">
                Reports
              </Link>
              <Link href="/admin/avatars" className="hover:text-[var(--ink)]">
                Manage avatars
              </Link>
            </>
          )}
          <span className="hidden sm:inline text-[var(--ink)]">
            {profile.display_name}
            {profile.role === "admin" ? " · Admin" : ""}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[var(--ink)] hover:bg-[var(--wash)]"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
