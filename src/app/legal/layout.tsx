import Link from "next/link";
import { LEGAL_PATHS, LEGAL_VERSION } from "@/lib/compliance/constants";

const NAV = [
  { href: LEGAL_PATHS.privacy, label: "Privacy Policy" },
  { href: LEGAL_PATHS.terms, label: "Terms of Service" },
  { href: LEGAL_PATHS.cookies, label: "Cookie Policy" },
  { href: LEGAL_PATHS.aiDisclosure, label: "AI Disclosure" },
  { href: LEGAL_PATHS.clinicalDisclaimer, label: "Clinical Disclaimer" },
  {
    href: LEGAL_PATHS.educationalDisclaimer,
    label: "Educational Disclaimer",
  },
] as const;

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[var(--surface)] text-[var(--on-surface)]">
      <header className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-headline)] text-lg font-bold text-[var(--primary)]"
          >
            VPsych
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--on-surface-variant)]">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-[var(--primary)] hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="mb-6 text-xs text-[var(--on-surface-variant)]">
          Document version {LEGAL_VERSION} · Educational training simulation ·
          Not a medical device
        </p>
        <article className="prose-legal space-y-4 text-sm leading-relaxed">
          {children}
        </article>
        <p className="mt-10 text-xs text-[var(--on-surface-variant)]">
          Questions: contact your institution administrator or{" "}
          <a className="underline" href="mailto:privacy@vpsych.app">
            privacy@vpsych.app
          </a>
          .
        </p>
      </main>
    </div>
  );
}
