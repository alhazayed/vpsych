"use client";

import Image from "next/image";
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
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Image
          src="/vpsych-logo.png"
          alt="VPsych"
          width={40}
          height={40}
          className="h-10 w-10 rounded-lg object-cover"
        />
        <span className="font-[family-name:var(--font-headline)] text-2xl font-bold text-[var(--primary)]">
          VPsych
        </span>
      </Link>
      <h1 className="font-[family-name:var(--font-headline)] text-2xl font-semibold text-[var(--on-surface)]">
        Create therapist account
      </h1>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
        New accounts start as therapists. Admins are promoted in Supabase.
      </p>
      <form onSubmit={onSubmit} className="clinical-card mt-8 space-y-4 p-6">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--on-surface-variant)]">
            Display name
          </span>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--on-surface-variant)]">
            Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--on-surface-variant)]">
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
          />
        </label>
        {error && <p className="text-sm text-[var(--error)]">{error}</p>}
        {info && <p className="text-sm text-[var(--primary)]">{info}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--on-surface-variant)]">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-[var(--primary)] underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
