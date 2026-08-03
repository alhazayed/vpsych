export const metadata = { title: "Privacy Policy · VPsych" };

export default function PrivacyPolicyPage() {
  return (
    <>
      <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold">
        Privacy Policy
      </h1>
      <p>
        VPsych (“we”, “us”) provides an <strong>educational clinical training
        simulation</strong>. This policy explains how we process personal data
        of learners, instructors, and administrators under applicable privacy
        laws including the EU/UK GDPR and, for U.S. educational institutions,
        FERPA-aligned institutional controls.
      </p>
      <h2 className="pt-4 text-xl font-semibold">1. Data we process</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Account data: name, email, organization, profession, language.</li>
        <li>
          Training activity: simulated therapy transcripts, session metadata,
          competency scores, adaptive curriculum state.
        </li>
        <li>
          Voice: microphone audio sent for speech-to-text; synthesized speech
          for the simulated patient.
        </li>
        <li>Technical: auth cookies, locale preference, security audit logs.</li>
      </ul>
      <h2 className="pt-4 text-xl font-semibold">2. Purposes & lawful bases</h2>
      <p>
        We process data to operate the training platform (contract / legitimate
        interests of institutional education), improve simulation quality, secure
        the service, and—only with opt-in—send product updates. We do{" "}
        <strong>not</strong> use VPsych to treat real patients or store real
        patient health records.
      </p>
      <h2 className="pt-4 text-xl font-semibold">3. Subprocessors</h2>
      <p>
        Infrastructure and AI providers process data on our instructions:
        Supabase (database/auth), Vercel (hosting), OpenAI (chat, assessment,
        STT), ElevenLabs (TTS), and optionally Upstash (rate limits). See the{" "}
        <a className="underline" href="/legal/ai-disclosure">
          AI Disclosure
        </a>
        .
      </p>
      <h2 className="pt-4 text-xl font-semibold">4. Retention</h2>
      <p>
        Default retention for completed training sessions is{" "}
        <strong>365 days</strong> unless your institution configures a different
        window (minimum 30 days). Admins may run retention purge. Auth accounts
        remain until deleted via Privacy settings or institutional request.
      </p>
      <h2 className="pt-4 text-xl font-semibold">5. Your rights</h2>
      <p>
        Subject to applicable law you may access, export, correct, restrict, or
        erase your data. In-product:{" "}
        <a className="underline" href="/account/privacy">
          Account → Privacy
        </a>{" "}
        (export & delete). Institutions acting as FERPA educational agencies
        remain responsible for student-record determinations.
      </p>
      <h2 className="pt-4 text-xl font-semibold">6. International transfers</h2>
      <p>
        Data may be processed in regions where our subprocessors operate.
        Institutions should execute DPAs/SCCs as required before EU/UK
        production use.
      </p>
      <h2 className="pt-4 text-xl font-semibold">7. Contact</h2>
      <p>
        privacy@vpsych.app · Institution admins should channel learner DSAR
        requests through their designated privacy officer when acting as
        controller.
      </p>
    </>
  );
}
