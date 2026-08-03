import type { AppLocale } from "@/i18n/config";

export type LegalSection = { id: string; heading: string; body: string[] };

const TERMS: Record<AppLocale, LegalSection[]> = {
  en: [
    {
      id: "acceptance",
      heading: "1. Acceptance of terms",
      body: [
        "By creating a VPsych account or using the VPsych Clinical Assessment Platform, you agree to these Terms of Service. If you do not agree, do not use the service.",
      ],
    },
    {
      id: "purpose",
      heading: "2. Educational purpose",
      body: [
        "VPsych provides AI patient simulations for psychiatric and psychotherapy skills training. It is not a medical device, hospital system, electronic health record, or real-patient care platform.",
        "Outputs are for education and practice only. They do not constitute diagnosis, treatment, or clinical advice for real patients.",
      ],
    },
    {
      id: "accounts",
      heading: "3. Accounts and acceptable use",
      body: [
        "You must provide accurate registration information and keep credentials confidential. You may not upload real patient protected health information into the platform.",
        "You may not reverse engineer, abuse rate limits, or use the service to harm others or to practice outside applicable professional and institutional rules.",
      ],
    },
    {
      id: "institutions",
      heading: "4. Institutional use",
      body: [
        "University, residency, and hospital education programs may use VPsych under separate commercial terms. Faculty remain responsible for supervision and assessment decisions.",
      ],
    },
    {
      id: "ip",
      heading: "5. Intellectual property",
      body: [
        "VPsych, its software, personas, and documentation remain the property of VPsych and its licensors. You retain rights to your own notes and feedback you create, subject to privacy and institutional policies.",
      ],
    },
    {
      id: "disclaimer",
      heading: "6. Disclaimers and limitation",
      body: [
        "The service is provided “as is” for training. To the fullest extent permitted by law, VPsych disclaims warranties of fitness for a particular clinical purpose and liability for decisions made about real patients.",
      ],
    },
    {
      id: "contact",
      heading: "7. Contact",
      body: [
        "Questions about these terms: hello@vpsych.app or the Contact page.",
      ],
    },
  ],
  ar: [
    {
      id: "acceptance",
      heading: "1. قبول الشروط",
      body: [
        "بإنشاء حساب في VPsych أو استخدام منصة التقييم السريري، فإنك توافق على شروط الخدمة هذه. إذا لم توافق، فلا تستخدم الخدمة.",
      ],
    },
    {
      id: "purpose",
      heading: "2. الغرض التعليمي",
      body: [
        "يوفر VPsych محاكاة مرضى بالذكاء الاصطناعي لتدريب مهارات الطب النفسي والعلاج النفسي. وهو ليس جهازًا طبيًا ولا نظام مستشفى ولا سجلًا صحيًا إلكترونيًا ولا منصة رعاية لمرضى حقيقيين.",
        "المخرجات للتعليم والتدريب فقط، ولا تشكل تشخيصًا أو علاجًا أو مشورة سريرية لمرضى حقيقيين.",
      ],
    },
    {
      id: "accounts",
      heading: "3. الحسابات والاستخدام المقبول",
      body: [
        "يجب تقديم معلومات تسجيل دقيقة والحفاظ على سرية بيانات الدخول. لا يجوز رفع معلومات صحية محمية لمرضى حقيقيين إلى المنصة.",
        "لا يجوز الهندسة العكسية أو إساءة استخدام الحدود أو استخدام الخدمة لإيذاء الآخرين أو لممارسة خارج القواعد المهنية والمؤسسية المعمول بها.",
      ],
    },
    {
      id: "institutions",
      heading: "4. الاستخدام المؤسسي",
      body: [
        "يجوز للجامعات وبرامج الإقامة ومكاتب التعليم في المستشفيات استخدام VPsych بموجب شروط تجارية منفصلة. تبقى الهيئة التدريسية مسؤولة عن الإشراف وقرارات التقييم.",
      ],
    },
    {
      id: "ip",
      heading: "5. الملكية الفكرية",
      body: [
        "تبقى VPsych وبرمجياتها وشخصياتها ووثائقها ملكًا لـ VPsych ومرخّصيها. تحتفظ بحقوق ملاحظاتك وملاحظاتك الذاتية وفق سياسات الخصوصية والمؤسسة.",
      ],
    },
    {
      id: "disclaimer",
      heading: "6. إخلاء المسؤولية والحد منها",
      body: [
        "تُقدَّم الخدمة «كما هي» للتدريب. وإلى أقصى حد يسمح به القانون، يخلى VPsych مسؤوليته عن الضمانات المتعلقة بغرض سريري معين وعن القرارات المتعلقة بمرضى حقيقيين.",
      ],
    },
    {
      id: "contact",
      heading: "7. التواصل",
      body: [
        "للاستفسارات حول هذه الشروط: hello@vpsych.app أو صفحة التواصل.",
      ],
    },
  ],
};

const PRIVACY: Record<AppLocale, LegalSection[]> = {
  en: [
    {
      id: "scope",
      heading: "1. Scope",
      body: [
        "This Privacy Policy explains how VPsych handles account data and educational simulation data. VPsych is designed so that real patient clinical records are not required and should not be entered.",
      ],
    },
    {
      id: "collect",
      heading: "2. Data we collect",
      body: [
        "Account data such as name, email, organization, profession, and locale preference.",
        "Training session artifacts such as simulated transcripts, scores, and competency reports tied to fictional AI patients.",
        "Technical logs needed for security, reliability, and abuse prevention.",
      ],
    },
    {
      id: "cookies",
      heading: "3. Cookies and similar technologies",
      body: [
        "Essential cookies support authentication, locale (language/RTL), and security. Optional analytics cookies are used only if you accept them in the cookie banner.",
        "You can change cookie preferences later via the cookie controls or by clearing site data.",
      ],
    },
    {
      id: "use",
      heading: "4. How we use data",
      body: [
        "To operate training sessions, generate educational feedback, support faculty review where enabled, improve product reliability, and communicate about your account.",
        "We do not sell personal information.",
      ],
    },
    {
      id: "sharing",
      heading: "5. Sharing",
      body: [
        "Processors such as hosting, authentication, and AI inference providers process data to deliver the service under contractual safeguards.",
        "Institutional admins may see learner reports when your organization enables faculty workflows.",
      ],
    },
    {
      id: "rights",
      heading: "6. Your choices",
      body: [
        "You may request access, correction, or deletion of account data by contacting hello@vpsych.app, subject to legal and security retention needs.",
      ],
    },
    {
      id: "contact",
      heading: "7. Contact",
      body: [
        "Privacy questions: hello@vpsych.app or /contact.",
      ],
    },
  ],
  ar: [
    {
      id: "scope",
      heading: "1. النطاق",
      body: [
        "توضح سياسة الخصوصية هذه كيفية تعامل VPsych مع بيانات الحساب وبيانات المحاكاة التعليمية. صُمّم VPsych بحيث لا تُطلب سجلات مرضى حقيقية ولا ينبغي إدخالها.",
      ],
    },
    {
      id: "collect",
      heading: "2. البيانات التي نجمعها",
      body: [
        "بيانات الحساب مثل الاسم والبريد والمؤسسة والمهنة وتفضيل اللغة.",
        "مخرجات جلسات التدريب مثل النصوص المحاكية والدرجات وتقارير الكفاءة المرتبطة بمرضى خياليين بالذكاء الاصطناعي.",
        "سجلات تقنية للأمان والموثوقية ومنع الإساءة.",
      ],
    },
    {
      id: "cookies",
      heading: "3. ملفات تعريف الارتباط والتقنيات المشابهة",
      body: [
        "تدعم ملفات تعريف الارتباط الأساسية المصادقة واللغة (واتجاه الواجهة) والأمان. تُستخدم ملفات التحليلات الاختيارية فقط إذا قبلتها في لافتة ملفات تعريف الارتباط.",
        "يمكنك تغيير التفضيلات لاحقًا عبر عناصر التحكم أو بمسح بيانات الموقع.",
      ],
    },
    {
      id: "use",
      heading: "4. كيف نستخدم البيانات",
      body: [
        "لتشغيل جلسات التدريب وتوليد ملاحظات تعليمية ودعم مراجعة الهيئة التدريسية عند التمكين وتحسين الموثوقية والتواصل بشأن حسابك.",
        "لا نبيع المعلومات الشخصية.",
      ],
    },
    {
      id: "sharing",
      heading: "5. المشاركة",
      body: [
        "قد يعالج مزودو الاستضافة والمصادقة والاستدلال بالذكاء الاصطناعي البيانات لتقديم الخدمة بموجب ضمانات تعاقدية.",
        "قد يرى مسؤولو المؤسسة تقارير المتعلمين عند تفعيل مسارات الهيئة التدريسية.",
      ],
    },
    {
      id: "rights",
      heading: "6. خياراتك",
      body: [
        "يمكنك طلب الوصول إلى بيانات الحساب أو تصحيحها أو حذفها عبر hello@vpsych.app مع مراعاة متطلبات الاحتفاظ القانونية والأمنية.",
      ],
    },
    {
      id: "contact",
      heading: "7. التواصل",
      body: [
        "لأسئلة الخصوصية: hello@vpsych.app أو /contact.",
      ],
    },
  ],
};

export function getTermsSections(locale: AppLocale): LegalSection[] {
  return TERMS[locale] ?? TERMS.en;
}

export function getPrivacySections(locale: AppLocale): LegalSection[] {
  return PRIVACY[locale] ?? PRIVACY.en;
}
