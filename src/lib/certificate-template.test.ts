import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_LIMITS,
  MAX_CERTIFICATE_IMAGE_BYTES,
  MAX_SIGNATORIES,
  certificateImageProblem,
  certificateReference,
  defaultCertificateSettings,
  formatCertificateDate,
  parseCertificateSettings,
  todayIsoDate,
} from "@/lib/certificate-template";

const DEFAULTS = {
  en: {
    heading: "Certificate of Completion",
    intro: "This certificate is awarded to",
    achievement: "for completing the program.",
    signatoryTitle: "Program Director",
  },
  ar: {
    heading: "شهادة إتمام",
    intro: "تُمنح هذه الشهادة إلى",
    achievement: "تقديرًا لإتمام البرنامج.",
    signatoryTitle: "مدير البرنامج",
  },
};

const fallback = defaultCertificateSettings("en", DEFAULTS);
const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("certificate settings", () => {
  it("starts from each language's own default wording", () => {
    expect(fallback.wording.en.heading).toBe("Certificate of Completion");
    expect(fallback.wording.ar.heading).toBe("شهادة إتمام");
    expect(fallback.wording.ar.signatories).toEqual([{ name: "", title: "مدير البرنامج" }]);
    expect(fallback.signatures).toEqual([null]);
  });

  it("falls back on empty, broken or non-object storage", () => {
    expect(parseCertificateSettings(null, fallback)).toBe(fallback);
    expect(parseCertificateSettings("{not json", fallback)).toBe(fallback);
    expect(parseCertificateSettings("42", fallback)).toBe(fallback);
  });

  it("keeps edited wording and clips over-long text", () => {
    const stored = JSON.stringify({
      locale: "ar",
      wording: {
        en: { ...fallback.wording.en, heading: "x".repeat(500) },
        ar: { ...fallback.wording.ar, instituteName: "جامعة" },
      },
      instituteLogo: PNG,
      signatures: [PNG],
    });
    const parsed = parseCertificateSettings(stored, fallback);
    expect(parsed.locale).toBe("ar");
    expect(parsed.wording.en.heading).toHaveLength(CERTIFICATE_LIMITS.heading);
    expect(parsed.wording.ar.instituteName).toBe("جامعة");
    expect(parsed.instituteLogo).toBe(PNG);
    expect(parsed.signatures).toEqual([PNG]);
  });

  it("drops images that are not png/jpeg/webp data URLs", () => {
    const stored = JSON.stringify({
      ...fallback,
      instituteLogo: "javascript:alert(1)",
      signatures: ["data:image/svg+xml;base64,PHN2Zz4="],
    });
    const parsed = parseCertificateSettings(stored, fallback);
    expect(parsed.instituteLogo).toBeNull();
    expect(parsed.signatures).toEqual([null]);
  });

  it("caps signatories and keeps both languages the same length", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `S${i}`, title: "T" }));
    const stored = JSON.stringify({
      ...fallback,
      wording: {
        en: { ...fallback.wording.en, signatories: many },
        ar: { ...fallback.wording.ar, signatories: many.slice(0, 2) },
      },
      signatures: [PNG, PNG, PNG, PNG],
    });
    const parsed = parseCertificateSettings(stored, fallback);
    expect(parsed.wording.en.signatories).toHaveLength(2);
    expect(parsed.wording.ar.signatories).toHaveLength(2);
    expect(parsed.signatures).toHaveLength(2);
    expect(MAX_SIGNATORIES).toBe(3);
  });
});

describe("certificate images", () => {
  it("accepts png, jpeg and webp up to the size cap", () => {
    expect(certificateImageProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(certificateImageProblem({ type: "image/webp", size: MAX_CERTIFICATE_IMAGE_BYTES })).toBeNull();
    expect(certificateImageProblem({ type: "image/svg+xml", size: 10 })).toBe("type");
    expect(certificateImageProblem({ type: "image/jpeg", size: MAX_CERTIFICATE_IMAGE_BYTES + 1 })).toBe("size");
  });
});

describe("certificate reference and date", () => {
  it("builds VT-date-suffix without look-alike characters", () => {
    const ref = certificateReference("2026-10-24", () => 0);
    expect(ref).toBe("VT-20261024-AAAAAA");
    expect(certificateReference("2026-10-24")).toMatch(/^VT-20261024-[A-HJ-NP-Z2-9]{6}$/);
    expect(certificateReference("bad")).toMatch(/^VT-00000000-/);
  });

  it("formats the date in the certificate's language", () => {
    expect(formatCertificateDate("2026-10-24", "en")).toBe("24 October 2026");
    expect(formatCertificateDate("2026-10-24", "ar")).toBe("24 تشرين الأول 2026");
    expect(formatCertificateDate("", "en")).toBe("");
  });

  it("gives today as a local YYYY-MM-DD", () => {
    expect(todayIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
