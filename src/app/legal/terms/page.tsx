export const metadata = { title: "Terms of Service · VPsych" };

export default function TermsPage() {
  return (
    <>
      <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold">
        Terms of Service
      </h1>
      <p>
        By creating a VPsych account or using the service you agree to these
        Terms. If you use VPsych through an institution, your institution’s
        agreement may also apply and prevail for conflicting institutional
        terms.
      </p>
      <h2 className="pt-4 text-xl font-semibold">1. Educational use only</h2>
      <p>
        VPsych is a <strong>simulation for clinical education and skills
        practice</strong>. It is not a medical device, not a diagnostic tool,
        and not a substitute for supervised clinical training, licensure, or
        professional judgment. See the{" "}
        <a className="underline" href="/legal/clinical-disclaimer">
          Clinical Disclaimer
        </a>{" "}
        and{" "}
        <a className="underline" href="/legal/educational-disclaimer">
          Educational Disclaimer
        </a>
        .
      </p>
      <h2 className="pt-4 text-xl font-semibold">2. Accounts</h2>
      <p>
        You must provide accurate registration information, safeguard
        credentials, and accept the Privacy Policy and AI Disclosure. You are
        responsible for activity under your account.
      </p>
      <h2 className="pt-4 text-xl font-semibold">3. Acceptable use</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Do not enter real patient identifiers or real PHI/ePHI into sessions.</li>
        <li>Do not attempt to bypass access controls or abuse AI/voice APIs.</li>
        <li>Do not use outputs to make clinical decisions about real patients.</li>
      </ul>
      <h2 className="pt-4 text-xl font-semibold">4. AI-generated content</h2>
      <p>
        Simulated patient replies and assessments may be inaccurate or
        incomplete. Humans remain responsible for educational interpretation.
      </p>
      <h2 className="pt-4 text-xl font-semibold">5. Intellectual property</h2>
      <p>
        Platform software, avatars, and curricula are owned by VPsych or its
        licensors. You retain rights in your original contributions subject to
        our license to operate the service.
      </p>
      <h2 className="pt-4 text-xl font-semibold">6. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, VPsych is provided “as is” for
        training. We are not liable for educational outcomes, licensing
        decisions, or clinical acts taken outside the simulation.
      </p>
      <h2 className="pt-4 text-xl font-semibold">7. Termination</h2>
      <p>
        You may delete your account via Privacy settings. We or your institution
        may suspend access for policy violations or security risk.
      </p>
    </>
  );
}
