import { expect, test, type Page } from "@playwright/test";
import { msLeftInWindow, totp } from "./totp";

// The core loop: a trainee signs in, runs a typed Therapy Room session, ends
// it, and the admin-only report exists for an admin but not for the trainee.
// There is no OpenAI key in this environment, so the patient answers with a
// persona fallback line and the report comes from the heuristic assessment.

const PASSWORD = process.env.E2E_PASSWORD ?? "";
const TRAINEE = process.env.E2E_TRAINEE_EMAIL ?? "";
const ADMIN = process.env.E2E_ADMIN_EMAIL ?? "";
const OPENING = "Hello, I'm Dr. Test. What brings you in today?";

test.beforeAll(() => {
  if (!PASSWORD || !TRAINEE || !ADMIN) {
    throw new Error("Run through scripts/test-e2e.sh (E2E_* env not set).");
  }
});

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "locale", value: "en", url: baseURL! }]);
});

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("trainee session ends in a report only an admin can read", async ({
  page,
  browser,
  baseURL,
}) => {
  await test.step("trainee signs in and starts a session", async () => {
    await signIn(page, TRAINEE);
    await page.goto("/avatars");
    await page
      .getByRole("button", { name: "Enter the therapy session" })
      .first()
      .click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]{36}$/);
  });
  const sessionId = new URL(page.url()).pathname.split("/").pop()!;

  await test.step("a typed turn gets a patient reply", async () => {
    const reply = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === `/api/sessions/${sessionId}/message`,
    );
    await page.fill("#trm-turn", OPENING);
    await page.press("#trm-turn", "Enter");
    const res = await reply;
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      assistantMessage?: { role?: string; content?: string };
      aiSource?: string;
    };
    expect(body.assistantMessage?.role).toBe("assistant");
    expect(body.assistantMessage?.content?.length).toBeGreaterThan(0);
    // No AI key here: the reply must be labelled as a fallback, never as GPT.
    expect(body.aiSource).toBe("persona_fallback");
  });

  await test.step("ending the session reaches the complete page", async () => {
    const ended = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === `/api/sessions/${sessionId}/end`,
    );
    await page.getByRole("button", { name: "End session" }).first().click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "End session" })
      .click();
    expect((await ended).status()).toBe(200);
    await page.waitForURL(`**/sessions/${sessionId}/complete`);
    await expect(
      page.getByRole("heading", { name: "Session complete" }),
    ).toBeVisible();
    await expect(page.getByText(OPENING)).toBeVisible();
  });

  await test.step("the trainee cannot open the admin report", async () => {
    await page.goto(`/admin/reports/${sessionId}`);
    await expect(page).not.toHaveURL(/\/admin\//);
    const api = await page.request.get(`/api/admin/reports/export`);
    expect(api.status()).toBe(403);
  });

  await test.step("an admin can read the report", async () => {
    // browser.newContext() does not inherit the config's `use` options.
    const adminContext = await browser.newContext({ baseURL, bypassCSP: true });
    await adminContext.addCookies([
      { name: "locale", value: "en", url: baseURL! },
    ]);
    const admin = await adminContext.newPage();
    await signIn(admin, ADMIN);
    await admin.goto(`/admin/reports/${sessionId}`);

    // Admins must enroll a second factor before any admin page opens.
    await admin.waitForURL(/\/auth\/mfa\/enroll/);
    const secret = (await admin.locator("code").first().innerText()).trim();
    if (msLeftInWindow() < 5_000) await admin.waitForTimeout(msLeftInWindow() + 500);
    await admin.getByLabel("Authentication code").fill(totp(secret));
    await admin.getByRole("button", { name: "Confirm and continue" }).click();

    await expect(admin).toHaveURL(new RegExp(`/admin/reports/${sessionId}$`));
    await expect(
      admin.getByText("Therapeutic alliance & empathy").first(),
    ).toBeVisible();
    await adminContext.close();
  });
});
