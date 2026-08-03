import { SUBPROCESSORS } from "@/lib/compliance/constants";

export const metadata = { title: "AI Disclosure · VPsych" };

export default function AiDisclosurePage() {
  return (
    <>
      <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold">
        AI & Voice Processing Disclosure
      </h1>
      <p>
        VPsych uses artificial intelligence and voice services to power
        simulated patients, assessments, and speech features. By using these
        features you acknowledge the following.
      </p>
      <h2 className="pt-4 text-xl font-semibold">What is sent to AI providers</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Session prompts and recent conversation turns (chat).</li>
        <li>Completed transcripts for automated educational assessment.</li>
        <li>Microphone audio clips for speech-to-text (not stored as files in VPsych DB).</li>
        <li>Text for text-to-speech synthesis of the simulated patient.</li>
      </ul>
      <h2 className="pt-4 text-xl font-semibold">Providers</h2>
      <ul className="list-disc space-y-1 pl-5">
        {SUBPROCESSORS.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong> — {s.purpose} ({s.region})
          </li>
        ))}
      </ul>
      <h2 className="pt-4 text-xl font-semibold">Human oversight</h2>
      <p>
        AI output can be wrong. Assessments are educational feedback, not
        clinical evaluation of real patients. Instructors should review edge
        cases.
      </p>
      <h2 className="pt-4 text-xl font-semibold">Your choices</h2>
      <p>
        Consent is collected at signup (AI processing acceptance) and reflected
        on your profile. You may export or delete your account data under{" "}
        <a className="underline" href="/account/privacy">
          Privacy settings
        </a>
        . Institutions should execute DPAs with VPsych and relevant
        subprocessors before processing EU/UK personal data at scale.
      </p>
    </>
  );
}
