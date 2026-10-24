/* eslint-disable @next/next/no-img-element -- uploaded logos and signatures are data URLs */
import type {
  CertificateLocale,
  CertificateSheetLabels,
  CertificateWording,
} from "@/lib/certificate-template";
import { formatCertificateDate } from "@/lib/certificate-template";

/**
 * One A4 landscape certificate. Colours are fixed, not theme tokens: this is
 * paper, and it must look the same in dark mode and when printed. Sizes use
 * container units so the on-screen preview and the printed sheet match.
 */
export function CertificateSheet({
  locale,
  wording,
  labels,
  recipient,
  issuedOn,
  reference,
  instituteLogo,
  signatures,
}: {
  locale: CertificateLocale;
  wording: CertificateWording;
  labels: CertificateSheetLabels;
  recipient: string;
  issuedOn: string;
  reference: string;
  instituteLogo: string | null;
  signatures: Array<string | null>;
}) {
  const institute = wording.instituteName.trim();
  return (
    <div className="@container w-full">
      <article
        lang={locale}
        dir={locale === "ar" ? "rtl" : "ltr"}
        className="certificate-sheet relative aspect-[297/210] w-full overflow-hidden bg-[#fffdf8] text-[#1b2a41]"
        style={{ fontFamily: "var(--font-text)" }}
      >
        <div className="absolute inset-[2.2cqw] border-[0.35cqw] border-[#8c2f39]" />
        <div className="absolute inset-[3cqw] border-[0.12cqw] border-[#b08d3c]" />

        <div className="absolute inset-[5cqw] flex flex-col items-center text-center">
          <header className="flex w-full items-center justify-between gap-[2cqw]">
            <div className="flex items-center gap-[1.2cqw]">
              <img
                src="/vtraining-logo.png"
                alt=""
                className="h-[6cqw] w-[6cqw] rounded-[0.8cqw] object-cover"
              />
              <span
                dir="ltr"
                className="text-[3cqw] font-bold tracking-tight text-[#8c2f39]"
                style={{ fontFamily: "var(--font-headline)" }}
              >
                Vtraining
              </span>
            </div>
            {institute || instituteLogo ? (
              <div className="flex max-w-[45%] items-center gap-[1.2cqw]">
                {institute ? (
                  <span className="text-end text-[1.5cqw] leading-tight text-[#1b2a41]">
                    <span className="block text-[1.05cqw] uppercase tracking-[0.12em] text-[#6b7280]">
                      {labels.inPartnershipWith}
                    </span>
                    <span className="font-semibold">{institute}</span>
                  </span>
                ) : null}
                {instituteLogo ? (
                  <img
                    src={instituteLogo}
                    alt={institute}
                    className="h-[6cqw] max-w-[14cqw] object-contain"
                  />
                ) : null}
              </div>
            ) : null}
          </header>

          <h1
            className="mt-[3cqw] text-[4.6cqw] font-semibold leading-tight text-[#8c2f39]"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            {wording.heading}
          </h1>
          <div className="mt-[1cqw] h-[0.15cqw] w-[18cqw] bg-[#b08d3c]" />

          <p className="mt-[2.4cqw] text-[1.8cqw] text-[#4b5563]">{wording.intro}</p>
          <p
            className="mt-[1.2cqw] min-h-[4.5cqw] border-b-[0.12cqw] border-[#b08d3c] px-[3cqw] text-[3.6cqw] font-semibold leading-tight"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            {recipient}
          </p>
          <p className="mt-[2cqw] max-w-[75%] text-[1.75cqw] leading-relaxed text-[#374151]">
            {wording.achievement}
          </p>

          <footer className="mt-auto w-full">
            <div className="flex items-end justify-center gap-[5cqw]">
              {wording.signatories.map((s, i) => (
                <div key={i} className="flex w-[22cqw] flex-col items-center">
                  <div className="flex h-[6cqw] w-full items-end justify-center">
                    {signatures[i] ? (
                      <img
                        src={signatures[i]!}
                        alt={labels.signature}
                        className="max-h-[6cqw] max-w-full object-contain"
                      />
                    ) : null}
                  </div>
                  <div className="mt-[0.4cqw] h-[0.1cqw] w-full bg-[#1b2a41]" />
                  <p className="mt-[0.6cqw] text-[1.45cqw] font-semibold">{s.name}</p>
                  <p className="text-[1.2cqw] text-[#4b5563]">{s.title}</p>
                </div>
              ))}
            </div>
            <div className="mt-[2cqw] flex items-end justify-between text-[1.15cqw] text-[#4b5563]">
              <span>
                {labels.date}: {formatCertificateDate(issuedOn, locale)}
              </span>
              <span className="max-w-[50%] text-[1cqw] text-[#6b7280]">{labels.disclaimer}</span>
              <span>
                {labels.reference}: <span dir="ltr">{reference}</span>
              </span>
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
