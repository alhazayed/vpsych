export const metadata = { title: "Clinical Disclaimer · VPsych" };

export default function ClinicalDisclaimerPage() {
  return (
    <>
      <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold">
        Clinical Disclaimer
      </h1>
      <p>
        <strong>
          VPsych does not provide medical care, diagnosis, treatment, or crisis
          intervention.
        </strong>
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          All “patients” are fictional avatars generated for training. Do not
          enter real patient names, MRNs, or protected health information.
        </li>
        <li>
          Session reports are educational performance feedback for the learner,
          not clinical documentation.
        </li>
        <li>
          If you or someone else is in crisis, contact local emergency services
          or an appropriate crisis line — not VPsych.
        </li>
        <li>
          HIPAA: VPsych is designed for simulated training. Institutions that
          nonetheless determine HIPAA applies must execute BAAs and configure
          the environment accordingly; VPsych does not claim HIPAA
          certification by default.
        </li>
      </ul>
    </>
  );
}
