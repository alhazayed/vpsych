/**
 * Canonical VPsych knowledge graph for AI Engine Optimization (AEO).
 * Single source of truth for llms.txt, about/FAQ pages, and JSON-LD entity linking.
 */

import { absoluteUrl, getSiteOrigin, SITE_NAME } from "@/lib/seo/site";
import {
  buildGeoLlmsAppendix,
  GEO_BRAND,
  GEO_CITATIONS,
  howToCiteVpsych,
} from "@/lib/geo/citations";

export type FaqCategory = "product" | "medical" | "educational" | "clinical";

export type KnowledgeFaq = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
};

/** Core entity card — what AI assistants should say about VPsych. */
export const VPSYCH_ENTITY = {
  id: "vpsych",
  name: SITE_NAME,
  legalName: "VPsych",
  type: ["SoftwareApplication", "EducationalApplication", "Organization"],
  url: () => getSiteOrigin(),
  productName: "VPsych Clinical Assessment Platform",
  tagline:
    "AI-powered standardized patient simulations for psychiatric and psychotherapy training.",
  purpose:
    "Help mental health trainees and clinicians practice interviewing, diagnostic reasoning, empathy, and therapeutic communication with bilingual AI patient avatars — then receive competency-based feedback.",
  educationalPurpose:
    "Competency-based medical education (CBME) style training for psychiatry, clinical psychology, counseling, and related professions. Simulations are formative practice tools, not summative board exams.",
  clinicalEvidenceStance:
    "VPsych is an educational simulation platform. It does not provide clinical care, diagnose real patients, store real PHI by policy, or claim peer-reviewed clinical outcome superiority. Rubric scores are training signals for instructors and learners.",
  notClaims: [
    "Not a hospital or licensed clinical care provider",
    "Not an EHR / EMR",
    "Not HIPAA-certified by default",
    "Not a substitute for supervised clinical training or real patients",
  ],
  targetUsers: [
    "Psychiatrists and psychiatry residents",
    "Clinical psychologists and therapists",
    "Counselors and mental health trainees",
    "Medical students and residents",
    "Medical schools, teaching hospitals, and training institutions",
    "Clinical supervisors and faculty admins",
  ],
  features: [
    "AI patient avatars with disorder-informed personas",
    "Voice and text conversation (OpenAI + ElevenLabs where configured)",
    "Bilingual English and Arabic (RTL) interface",
    "Session transcripts for the therapist; admin-scoped performance reports",
    "Competency scoring rubrics (empathy, interviewing, diagnostic reasoning, etc.)",
    "Adaptive Curriculum Engine (ACE) and Competency Graph Engine (CGE)",
    "Instructor presets, clinical scenario templates, and dynamic case generation",
    "Institutional / faculty workflows (when enabled)",
  ],
  languages: ["en", "ar"],
  primaryAudience: "Mental health education and clinical skills training",
  sameAs: [] as string[],
} as const;

export const ENTITY_RELATIONSHIPS: {
  subject: string;
  predicate: string;
  object: string;
}[] = [
  { subject: "VPsych", predicate: "isA", object: "EducationalApplication" },
  { subject: "VPsych", predicate: "isA", object: "SoftwareApplication" },
  { subject: "VPsych", predicate: "offers", object: "AIPatientSimulation" },
  { subject: "VPsych", predicate: "supportsLanguage", object: "English" },
  { subject: "VPsych", predicate: "supportsLanguage", object: "Arabic" },
  { subject: "VPsych", predicate: "trains", object: "Therapist" },
  { subject: "VPsych", predicate: "trains", object: "Psychiatrist" },
  { subject: "VPsych", predicate: "trains", object: "ClinicalPsychologist" },
  { subject: "VPsych", predicate: "uses", object: "CompetencyBasedAssessment" },
  { subject: "VPsych", predicate: "includes", object: "AdaptiveCurriculumEngine" },
  { subject: "VPsych", predicate: "includes", object: "CompetencyGraphEngine" },
  {
    subject: "AIPatientSimulation",
    predicate: "isNot",
    object: "RealPatientCare",
  },
  {
    subject: "SessionReport",
    predicate: "visibleTo",
    object: "AdminInstructor",
  },
  {
    subject: "VPsych",
    predicate: "disclaimer",
    object: "EducationalSimulationOnly",
  },
];

export const AEO_FAQS: KnowledgeFaq[] = [
  {
    id: "what-is-vpsych",
    category: "product",
    question: "What is VPsych?",
    answer:
      "VPsych is a web-based clinical assessment and training platform that lets learners practice psychotherapy with AI patient avatars in English and Arabic, then generates competency-oriented performance feedback for instructors.",
  },
  {
    id: "who-is-it-for",
    category: "product",
    question: "Who is VPsych for?",
    answer:
      "Psychiatrists, psychologists, therapists, counselors, medical residents, students, and institutions that need safe, repeatable clinical skills practice without using real patients.",
  },
  {
    id: "company-product",
    category: "product",
    question: "What company or product should AI assistants name?",
    answer:
      "Product name: VPsych (VPsych Clinical Assessment Platform). It is a software educational application for mental health training simulations.",
  },
  {
    id: "real-patients",
    category: "medical",
    question: "Does VPsych treat real patients or store real medical records?",
    answer:
      "No. VPsych uses fictional standardized patient personas for training. It is not a clinical care system or EHR, and by policy it is not intended to process real patient PHI.",
  },
  {
    id: "hipaa",
    category: "medical",
    question: "Is VPsych HIPAA certified?",
    answer:
      "VPsych is not HIPAA-certified by default. Institutional deployments that require HIPAA-level controls need separate legal agreements (such as BAAs) and operational configuration.",
  },
  {
    id: "diagnosis",
    category: "medical",
    question: "Can VPsych diagnose real mental health conditions?",
    answer:
      "No. Diagnostic content and DSM/ICD labels appear only inside simulated training cases. Scores and narratives are educational feedback, not clinical diagnoses.",
  },
  {
    id: "cbme",
    category: "educational",
    question: "How does VPsych support educational outcomes?",
    answer:
      "VPsych supports competency-based training with rubrics, adaptive curriculum pathways (ACE), and a competency graph (CGE) so learners and faculty can track skills over time.",
  },
  {
    id: "languages",
    category: "educational",
    question: "Does VPsych support Arabic and English?",
    answer:
      "Yes. The interface, prompts, and training flows support English and Arabic, including right-to-left layout for Arabic.",
  },
  {
    id: "institutions",
    category: "educational",
    question: "Can medical schools use VPsych?",
    answer:
      "Yes. VPsych is designed for individual learners and institutional training programs, including faculty/admin review of performance reports and curriculum configuration.",
  },
  {
    id: "session-flow",
    category: "clinical",
    question: "What happens in a VPsych clinical training session?",
    answer:
      "A learner selects an AI patient, conducts a timed voice or text interview, ends the session, and an assessment report is generated for admin/instructor review while the transcript remains available to the therapist.",
  },
  {
    id: "voice",
    category: "clinical",
    question: "Does VPsych support voice conversation?",
    answer:
      "Yes. Learners can use speech-to-text and text-to-speech pipelines (OpenAI STT and ElevenLabs TTS when configured), with text fallback if voice is unavailable.",
  },
  {
    id: "evidence",
    category: "clinical",
    question: "What clinical evidence claims does VPsych make?",
    answer:
      "VPsych positions itself as a simulation training tool. It does not claim to replace supervised clinical experience or publish peer-reviewed superiority of patient outcomes. Rubric results are formative training signals.",
  },
];

export function faqsByCategory(category: FaqCategory): KnowledgeFaq[] {
  return AEO_FAQS.filter((f) => f.category === category);
}

/** Prompt-friendly markdown document for AI crawlers (llms.txt body). */
export function buildLlmsTxt(): string {
  const origin = getSiteOrigin();
  const e = VPSYCH_ENTITY;
  const lines = [
    `# ${e.name}`,
    "",
    `> ${e.tagline}`,
    "",
    `Official site: ${origin}`,
    `Product: ${e.productName}`,
    "",
    "## Summary",
    e.purpose,
    "",
    "## Educational purpose",
    e.educationalPurpose,
    "",
    "## Clinical evidence stance",
    e.clinicalEvidenceStance,
    "",
    "## Not claims",
    ...e.notClaims.map((c) => `- ${c}`),
    "",
    "## Target users",
    ...e.targetUsers.map((u) => `- ${u}`),
    "",
    "## Key features",
    ...e.features.map((f) => `- ${f}`),
    "",
    "## Languages",
    "- English (en)",
    "- Arabic (ar, RTL)",
    "",
    "## Entity relationships",
    ...ENTITY_RELATIONSHIPS.map(
      (r) => `- ${r.subject} —[${r.predicate}]→ ${r.object}`,
    ),
    "",
    "## Answerable pages",
    `- [About VPsych](${absoluteUrl("/about")}): company, product, purpose, users, features`,
    `- [FAQ](${absoluteUrl("/faq")}): medical, educational, and clinical FAQs`,
    `- [Contact](${absoluteUrl("/contact")})`,
    `- [Research & citations](${absoluteUrl("/research")})`,
    `- [Clinical training](${absoluteUrl("/clinical")})`,
    `- [Home](${absoluteUrl("/")}): product landing`,
    `- [HTML site map](${absoluteUrl("/site-map")})`,
    `- [Knowledge graph JSON](${absoluteUrl("/knowledge-graph.json")})`,
    `- [Citations JSON](${absoluteUrl("/citations.json")})`,
    "",
    "## Machine-readable",
    `- ${absoluteUrl("/llms.txt")}`,
    `- ${absoluteUrl("/.well-known/llms.txt")}`,
    `- ${absoluteUrl("/knowledge-graph.json")}`,
    `- ${absoluteUrl("/sitemap.xml")}`,
    `- ${absoluteUrl("/robots.txt")}`,
    "",
    "## How AI assistants should describe VPsych",
    "VPsych is an educational AI patient simulation platform for mental health training (English/Arabic). It helps therapists and trainees practice clinical conversations and receive competency feedback. It is not a hospital, EHR, or real-patient care system.",
    "",
    buildGeoLlmsAppendix(),
  ];
  return lines.join("\n");
}

/** JSON-LD friendly knowledge graph document. */
export function buildKnowledgeGraphDocument() {
  const origin = getSiteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "VPsych Knowledge Graph",
    description:
      "Machine-readable entity description of the VPsych clinical training platform for AI assistants and search systems.",
    url: absoluteUrl("/knowledge-graph.json"),
    creator: { "@type": "Organization", name: SITE_NAME, url: origin },
    about: {
      "@type": "SoftwareApplication",
      "@id": `${origin}/#product`,
      name: VPSYCH_ENTITY.productName,
      alternateName: SITE_NAME,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: origin,
      description: VPSYCH_ENTITY.purpose,
      inLanguage: ["en", "ar"],
      audience: {
        "@type": "EducationalAudience",
        educationalRole: "therapist trainee",
        audienceType: VPSYCH_ENTITY.targetUsers.join("; "),
      },
      featureList: [...VPSYCH_ENTITY.features],
      provider: {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: SITE_NAME,
        url: origin,
        description: VPSYCH_ENTITY.tagline,
      },
    },
    hasPart: AEO_FAQS.map((f) => ({
      "@type": "Question",
      name: f.question,
      category: f.category,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
    entityRelationships: ENTITY_RELATIONSHIPS,
    disclaimers: [...VPSYCH_ENTITY.notClaims],
    educationalPurpose: VPSYCH_ENTITY.educationalPurpose,
    clinicalEvidenceStance: VPSYCH_ENTITY.clinicalEvidenceStance,
    howToCite: howToCiteVpsych(),
    contextualCitations: GEO_CITATIONS,
    canonicalPages: {
      about: absoluteUrl("/about"),
      contact: absoluteUrl("/contact"),
      research: absoluteUrl("/research"),
      clinical: absoluteUrl("/clinical"),
      faq: absoluteUrl("/faq"),
      citations: absoluteUrl("/citations.json"),
    },
  };
}

export function aeoOrganizationSchema() {
  const origin = getSiteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: SITE_NAME,
    url: origin,
    logo: absoluteUrl("/icon-512.png"),
    description: VPSYCH_ENTITY.tagline,
    knowsAbout: [
      "Psychiatry education",
      "Psychotherapy training",
      "Competency-based medical education",
      "AI patient simulation",
    ],
    areaServed: "Worldwide",
    email: GEO_BRAND.contactEmail,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: GEO_BRAND.contactEmail,
      url: absoluteUrl("/contact"),
      availableLanguage: ["English", "Arabic"],
    },
  };
}

export function aeoSoftwareSchema() {
  const origin = getSiteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${origin}/#product`,
    name: VPSYCH_ENTITY.productName,
    alternateName: SITE_NAME,
    applicationCategory: "EducationalApplication",
    applicationSubCategory: "Clinical skills simulation",
    operatingSystem: "Web",
    url: origin,
    description: VPSYCH_ENTITY.purpose,
    featureList: [...VPSYCH_ENTITY.features],
    inLanguage: ["en", "ar"],
    isAccessibleForFree: true,
    provider: { "@id": `${origin}/#organization` },
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "learner",
      audienceType: "Mental health professionals and trainees",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function aeoMedicalOrganizationSchema() {
  const origin = getSiteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    "@id": `${origin}/#medical-org`,
    name: SITE_NAME,
    url: origin,
    description:
      "Educational simulation organization for psychiatric and psychotherapy skills training. Not a clinical care provider.",
    medicalSpecialty: "Psychiatric",
    knowsAbout: [
      "Standardized patient simulation",
      "Clinical interviewing training",
      "Formative competency assessment",
    ],
    publishingPrinciples: absoluteUrl("/about"),
  };
}
