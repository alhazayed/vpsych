export const metadata = { title: "Cookie Policy · VPsych" };

export default function CookiePolicyPage() {
  return (
    <>
      <h1 className="font-[family-name:var(--font-headline)] text-3xl font-bold">
        Cookie Policy
      </h1>
      <p>
        This policy describes cookies and similar technologies used by VPsych.
      </p>
      <h2 className="pt-4 text-xl font-semibold">Essential cookies</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Authentication (Supabase)</strong> — session management;
          required to keep you signed in.
        </li>
        <li>
          <strong>locale</strong> — remembers UI language (en/ar); treated as
          strictly necessary for accessibility and localization.
        </li>
        <li>
          <strong>vpsych_cookie_consent</strong> — stores your cookie preference
          choice.
        </li>
      </ul>
      <h2 className="pt-4 text-xl font-semibold">Preference cookies</h2>
      <p>
        Optional preference cookies are disabled until you opt in via the cookie
        banner. We do not currently deploy third-party advertising or session
        replay trackers. If analytics are enabled later, they will require
        preference consent.
      </p>
      <h2 className="pt-4 text-xl font-semibold">Managing cookies</h2>
      <p>
        Use the on-site cookie banner or browser controls. Blocking essential
        cookies may prevent sign-in.
      </p>
    </>
  );
}
