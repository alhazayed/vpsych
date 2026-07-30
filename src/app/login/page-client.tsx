"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 font-[family-name:var(--font-display)] text-2xl"
      >
        vpsych
      </Link>
      <h1 className="text-2xl text-[var(--ink)]">Sign in</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Therapist and admin accounts use email and password.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
        {error && <p className="text-sm text-[var(--warn)]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[var(--ink)] py-3 text-sm text-[var(--paper)] disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--muted)]">
        No account?{" "}
        <Link href="/signup" className="text-[var(--accent)] underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
