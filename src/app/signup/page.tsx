"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function strengthMeta(password: string) {
  const checks = passwordChecks(password);
  const score = Object.values(checks).filter(Boolean).length;
  if (!password) return { label: "", width: "0%", color: "var(--primary)" };
  if (score <= 1)
    return { label: "Weak", width: "25%", color: "var(--error)" };
  if (score === 2)
    return { label: "Fair", width: "50%", color: "#F3650A" };
  if (score === 3)
    return { label: "Good", width: "75%", color: "var(--primary)" };
  return { label: "Strong", width: "100%", color: "var(--primary)" };
}

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [country, setCountry] = useState("");
  const [profession, setProfession] = useState("");
  const [organization, setOrganization] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const strength = useMemo(() => strengthMeta(password), [password]);
  const dirty =
    firstName ||
    lastName ||
    email ||
    password ||
    confirmPassword ||
    country ||
    profession ||
    organization;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const supabase = createClient();
    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          country: country || null,
          profession: profession || null,
          organization: organization || null,
          newsletter,
        },
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

  function resetForm() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setCountry("");
    setProfession("");
    setOrganization("");
    setAcceptedTerms(false);
    setNewsletter(false);
    setError(null);
    setInfo(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <nav className="sticky top-0 z-50 border-b border-[var(--outline-variant)] bg-[var(--surface)]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-10">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/vpsych-logo.png"
              alt="VPsych"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md object-cover"
            />
            <span className="font-[family-name:var(--font-headline)] text-xl font-bold text-[var(--primary)]">
              VPsych
            </span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <Link
              href="/#features"
              className="text-sm font-semibold tracking-wide text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
            >
              Solutions
            </Link>
            <Link
              href="/#features"
              className="text-sm font-semibold tracking-wide text-[var(--on-surface-variant)] hover:text-[var(--primary)]"
            >
              Clinical Tools
            </Link>
            <Link
              href="/login"
              className="rounded-[14px] border border-[var(--primary)] px-4 py-1.5 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary-fixed)]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex flex-grow items-center justify-center px-5 py-8">
        <div className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-sm fade-in-up">
          <div className="border-b border-[var(--outline-variant)] bg-[color-mix(in_srgb,var(--surface-container-low)_50%,transparent)] p-6 md:p-8">
            <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold tracking-tight text-[#12273C]">
              Create Your Account
            </h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              Join mental health professionals improving their clinical skills
              with AI.
            </p>
          </div>

          <form className="space-y-6 p-6 md:p-8" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  First Name
                </span>
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Jane"
                  className="field-input h-11"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  Last Name
                </span>
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Smith"
                  className="field-input h-11"
                />
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-xs font-semibold text-[var(--on-surface)]">
                Email Address
              </span>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane.smith@clinical.com"
                  className="field-input h-11 pr-10"
                />
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--outline-variant)]">
                  mail
                </span>
              </div>
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  Password
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="field-input h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--outline-variant)]"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  Confirm Password
                </span>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="field-input h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--outline-variant)]"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showConfirm ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </label>
            </div>

            <div className="space-y-2 rounded-lg border border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] bg-[var(--surface-container-low)] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
                  Password Strength
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: strength.color }}
                >
                  {strength.label}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-variant)]">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: strength.width,
                    backgroundColor: strength.color,
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-y-1 pt-1 text-[11px] font-semibold">
                {(
                  [
                    ["length", "8 Characters"],
                    ["upper", "Uppercase"],
                    ["number", "Number"],
                    ["special", "Special Character"],
                  ] as const
                ).map(([key, label]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-1.5 ${
                      checks[key]
                        ? "text-[var(--primary)]"
                        : "text-[var(--on-surface-variant)]"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {checks[key] ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  Country
                </span>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="field-input h-11"
                >
                  <option value="">Select Country</option>
                  <option value="US">United States</option>
                  <option value="UK">United Kingdom</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                  <option value="SA">Saudi Arabia</option>
                  <option value="AE">United Arab Emirates</option>
                  <option value="DE">Germany</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-semibold text-[var(--on-surface)]">
                  Profession
                </span>
                <select
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  className="field-input h-11"
                >
                  <option value="">Select Profession</option>
                  <option value="Psychiatrist">Psychiatrist</option>
                  <option value="Psychologist">Psychologist</option>
                  <option value="Counselor">Counselor</option>
                  <option value="Resident">Resident</option>
                  <option value="Medical Student">Medical Student</option>
                  <option value="Psychology Student">Psychology Student</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-xs font-semibold text-[var(--on-surface)]">
                Organization{" "}
                <span className="font-normal text-[var(--on-surface-variant)]">
                  (Optional)
                </span>
              </span>
              <input
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Clinical Practice / Hospital Name"
                className="field-input h-11"
              />
            </label>

            <div className="space-y-3 pt-2">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-[var(--outline-variant)] text-[var(--primary)]"
                  required
                />
                <span className="text-xs leading-relaxed text-[var(--on-surface-variant)]">
                  I agree to the{" "}
                  <span className="font-semibold text-[var(--primary)]">
                    Terms of Service
                  </span>{" "}
                  and{" "}
                  <span className="font-semibold text-[var(--primary)]">
                    Privacy Policy
                  </span>{" "}
                  regarding clinical data processing.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-[var(--outline-variant)] text-[var(--primary)]"
                />
                <span className="text-xs leading-relaxed text-[var(--on-surface-variant)]">
                  Subscribe to our Clinical Intelligence newsletter for monthly
                  AI mental health updates.
                </span>
              </label>
            </div>

            {error && <p className="text-sm text-[var(--error)]">{error}</p>}
            {info && <p className="text-sm text-[var(--primary)]">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--primary)] text-sm font-semibold uppercase tracking-wider text-white shadow-md transition hover:bg-[var(--primary-container)] disabled:opacity-60"
            >
              {loading ? "Creating…" : "Create Account"}
              <span className="material-symbols-outlined text-[20px]">
                arrow_forward
              </span>
            </button>
          </form>

          <div className="border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-6 text-center">
            <p className="text-sm text-[var(--on-surface-variant)]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="ml-1 font-bold text-[var(--primary)] hover:underline"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </main>

      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] flex h-16 items-center justify-between border-t border-[color-mix(in_srgb,var(--primary)_20%,transparent)] bg-[#12273C]/95 px-4 backdrop-blur-md md:px-10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary-fixed-dim)]">
              info
            </span>
            <p className="text-xs font-semibold text-white">
              Unsaved Registration Data
            </p>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-semibold text-white/70 hover:text-white"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() =>
                (
                  document.querySelector(
                    "form",
                  ) as HTMLFormElement | null
                )?.requestSubmit()
              }
              className="rounded-[14px] bg-[var(--primary)] px-6 py-2 text-xs font-semibold text-white"
            >
              Save & Continue
            </button>
          </div>
        </div>
      )}

      <footer className="w-full border-t border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] py-4">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 px-4 md:flex-row md:px-10">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-headline)] text-sm font-bold">
              VPsych
            </span>
            <span className="text-xs text-[var(--on-surface-variant)]">
              © {new Date().getFullYear()} VPsych. All rights reserved.
            </span>
          </div>
          <div className="flex gap-6 text-xs text-[var(--on-surface-variant)]">
            <span>Terms of Service</span>
            <span>Privacy Policy</span>
            <span>Contact Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
