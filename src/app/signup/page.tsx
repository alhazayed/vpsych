"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    if (data.session) {
      router.push("/avatars");
      router.refresh();
      return;
    }
    setInfo("Check your email to confirm your account, then sign in.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="mb-8 font-[family-name:var(--font-display)] text-2xl"
      >
        vpsych
      </Link>
      <h1 className="text-2xl text-[var(--ink)]">Create therapist account</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        New accounts start as therapists. Admins are promoted in Supabase.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Display name</span>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
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
        {info && <p className="text-sm text-[var(--accent)]">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[var(--accent)] py-3 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--muted)]">
        Already registered?{" "}
        <Link href="/login" className="text-[var(--accent)] underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
