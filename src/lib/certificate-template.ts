/**
 * Printable pass certificate: the draft an admin edits on
 * /admin/certificates, its limits, and how it is kept in the admin's browser.
 * Pure. Issued certificates and their numbers are recorded separately
 * (`lib/certificate-registry.ts`); this file only shapes the printed sheet.
 */

export const CERTIFICATE_LOCALES = ["en", "ar"] as const;
export type CertificateLocale = (typeof CERTIFICATE_LOCALES)[number];

export const MAX_SIGNATORIES = 3;
/** Uploaded logo or signature image, before base64 (data URLs grow ~4/3). */
export const MAX_CERTIFICATE_IMAGE_BYTES = 512 * 1024;
export const CERTIFICATE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const CERTIFICATE_LIMITS = {
  heading: 80,
  intro: 120,
  achievement: 300,
  recipient: 120,
  instituteName: 120,
  signatoryName: 80,
  signatoryTitle: 80,
} as const;

/** The words printed on the sheet in one language. */
export type CertificateWording = {
  heading: string;
  intro: string;
  achievement: string;
  instituteName: string;
  signatories: Array<{ name: string; title: string }>;
};

/** Fixed sheet labels, from `admin.certificates.sheet` in that language. */
export type CertificateSheetLabels = {
  date: string;
  reference: string;
  inPartnershipWith: string;
  disclaimer: string;
  signature: string;
  /** Label before the verify link printed under the number. */
  verify: string;
};

/** Defaults for one language, from `admin.certificates.defaults`. */
export type CertificateDefaults = {
  heading: string;
  intro: string;
  achievement: string;
  signatoryTitle: string;
};

/** What the admin keeps between visits: wording per language, shared images. */
export type CertificateSettings = {
  locale: CertificateLocale;
  wording: Record<CertificateLocale, CertificateWording>;
  instituteLogo: string | null;
  /** One per signatory slot, shared by both languages. */
  signatures: Array<string | null>;
};

export function isCertificateLocale(value: unknown): value is CertificateLocale {
  return value === "en" || value === "ar";
}

export function defaultWording(defaults: CertificateDefaults): CertificateWording {
  return {
    heading: defaults.heading,
    intro: defaults.intro,
    achievement: defaults.achievement,
    instituteName: "",
    signatories: [{ name: "", title: defaults.signatoryTitle }],
  };
}

export function defaultCertificateSettings(
  locale: CertificateLocale,
  defaults: Record<CertificateLocale, CertificateDefaults>,
): CertificateSettings {
  return {
    locale,
    wording: { en: defaultWording(defaults.en), ar: defaultWording(defaults.ar) },
    instituteLogo: null,
    signatures: [null],
  };
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function isImageDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    CERTIFICATE_IMAGE_TYPES.some((type) => value.startsWith(`data:${type};base64,`)) &&
    value.length <= Math.ceil((MAX_CERTIFICATE_IMAGE_BYTES * 4) / 3) + 64
  );
}

function parseWording(raw: unknown, fallback: CertificateWording): CertificateWording {
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const signatories = Array.isArray(r.signatories)
    ? r.signatories.slice(0, MAX_SIGNATORIES).map((s) => {
        const o = s && typeof s === "object" ? (s as Record<string, unknown>) : {};
        return {
          name: clip(o.name, CERTIFICATE_LIMITS.signatoryName),
          title: clip(o.title, CERTIFICATE_LIMITS.signatoryTitle),
        };
      })
    : fallback.signatories;
  return {
    heading: typeof r.heading === "string" ? clip(r.heading, CERTIFICATE_LIMITS.heading) : fallback.heading,
    intro: typeof r.intro === "string" ? clip(r.intro, CERTIFICATE_LIMITS.intro) : fallback.intro,
    achievement:
      typeof r.achievement === "string"
        ? clip(r.achievement, CERTIFICATE_LIMITS.achievement)
        : fallback.achievement,
    instituteName: clip(r.instituteName, CERTIFICATE_LIMITS.instituteName),
    signatories,
  };
}

/**
 * Settings read back from localStorage. Anything malformed falls back to the
 * defaults instead of throwing, and both languages keep the same number of
 * signatories so the shared signature images line up.
 */
export function parseCertificateSettings(
  raw: string | null,
  fallback: CertificateSettings,
): CertificateSettings {
  if (!raw) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!parsed || typeof parsed !== "object") return fallback;
  const p = parsed as Record<string, unknown>;
  const w = p.wording && typeof p.wording === "object" ? (p.wording as Record<string, unknown>) : {};
  const en = parseWording(w.en, fallback.wording.en);
  const ar = parseWording(w.ar, fallback.wording.ar);
  const count = Math.max(1, Math.min(MAX_SIGNATORIES, en.signatories.length, ar.signatories.length));
  const signatures = Array.from({ length: count }, (_, i) => {
    const s = Array.isArray(p.signatures) ? p.signatures[i] : null;
    return isImageDataUrl(s) ? s : null;
  });
  return {
    locale: isCertificateLocale(p.locale) ? p.locale : fallback.locale,
    wording: {
      en: { ...en, signatories: padSignatories(en.signatories, count) },
      ar: { ...ar, signatories: padSignatories(ar.signatories, count) },
    },
    instituteLogo: isImageDataUrl(p.instituteLogo) ? p.instituteLogo : null,
    signatures,
  };
}

function padSignatories(
  list: CertificateWording["signatories"],
  count: number,
): CertificateWording["signatories"] {
  const out = list.slice(0, count);
  while (out.length < count) out.push({ name: "", title: "" });
  return out;
}

/** Why an uploaded image is refused, or null when it can be used. */
export function certificateImageProblem(file: {
  type: string;
  size: number;
}): "type" | "size" | null {
  if (!(CERTIFICATE_IMAGE_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size > MAX_CERTIFICATE_IMAGE_BYTES) return "size";
  return null;
}

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Unrecorded sheet reference, `VT-YYYYMMDD-XXXXXX`, used only while the
 * certificate records are not set up. It identifies a printout and cannot be
 * verified; recorded certificates use `VT-XXXX-XXXX-XXXX` from the database.
 */
export function certificateReference(
  issuedOn: string,
  random: () => number = Math.random,
): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(issuedOn) ? issuedOn.replace(/-/g, "") : "00000000";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)];
  }
  return `VT-${day}-${suffix}`;
}

/**
 * Long date in the certificate's language. Arabic uses the Levantine month
 * names (ar-JO) with Western digits, as Jordanian documents do.
 */
export function formatCertificateDate(issuedOn: string, locale: CertificateLocale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(issuedOn);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO-u-nu-latn" : "en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

/** Today as `YYYY-MM-DD` in the admin's own time zone. */
export function todayIsoDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
