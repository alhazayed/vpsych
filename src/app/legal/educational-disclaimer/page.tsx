export const metadata = { title: "Educational Disclaimer · VPsych" };

export default function EducationalDisclaimerPage() {
  return (
    <>
      <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold">
        Educational Disclaimer
      </h1>
      <p>
        VPsych supports academic and professional skills practice. It does not
        grant degrees, licenses, board certification, or clinical privileges.
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Competency scores and adaptive curriculum suggestions are formative
          learning signals, not high-stakes summative credentials unless your
          institution separately validates them.
        </li>
        <li>
          FERPA: When used by U.S. educational agencies/institutions, student
          education records remain under institutional control. Institutions
          should designate VPsych appropriately in their FERPA directory of
          systems and limit access to school officials with legitimate
          educational interest.
        </li>
        <li>
          Research use of identifiable learner data requires institutional IRB /
          ethics approval and, where required, informed consent beyond this
          product disclaimer. Use the anonymized research export mode only as a
          starting point.
        </li>
        <li>
          Instructors remain responsible for academic integrity, assessment
          validity, and equitable access accommodations.
        </li>
      </ul>
    </>
  );
}
