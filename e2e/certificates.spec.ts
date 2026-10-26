import { expect, test, type Browser, type Page } from "@playwright/test";
import { msLeftInWindow, totp } from "./totp";

// Verifiable certificates: the graduate (seeded by scripts/test-e2e.sh) cleared
// the Training Program, so a certificate was issued automatically. Anyone can
// check its number at /verify; an admin can revoke it and issue a new one.

const PASSWORD = process.env.E2E_PASSWORD ?? "";
const ADMIN = process.env.E2E_CERT_ADMIN_EMAIL ?? "";
const GRADUATE = process.env.E2E_GRADUATE_EMAIL ?? "";
const SHOTS = process.env.E2E_SCREENSHOT_DIR ?? "";
const NUMBER = /^VT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

test.beforeAll(() => {
  if (!PASSWORD || !ADMIN || !GRADUATE) {
    throw new Error("Run through scripts/test-e2e.sh (E2E_* env not set).");
  }
});

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function pickGraduate(page: Page) {
  const option = page.locator("option", { hasText: "Grace Graduate" });
  await expect(option).toContainText("10/10 patients completed");
  const value = await option.getAttribute("value");
  await page.getByLabel("Trainee", { exact: true }).selectOption(value!);
}

async function visitor(browser: Browser, baseURL: string, locale: "en" | "ar") {
  const context = await browser.newContext({ baseURL, bypassCSP: true });
  await context.addCookies([{ name: "locale", value: locale, url: baseURL }]);
  return { context, page: await context.newPage() };
}

test("certificates are recorded, verifiable and revocable", async ({ page, browser, baseURL }) => {
  await page.context().addCookies([{ name: "locale", value: "en", url: baseURL! }]);

  await test.step("admin signs in with a second factor", async () => {
    await page.goto("/login");
    await page.fill("#email", ADMIN);
    await page.fill("#password", PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    await page.goto("/admin/certificates");
    await page.waitForURL(/\/auth\/mfa\/enroll/);
    const secret = (await page.locator("code").first().innerText()).trim();
    if (msLeftInWindow() < 5_000) await page.waitForTimeout(msLeftInWindow() + 500);
    await page.getByLabel("Authentication code").fill(totp(secret));
    await page.getByRole("button", { name: "Confirm and continue" }).click();
    await expect(page).toHaveURL(/\/admin\/certificates$/);
  });

  const registry = page.getByRole("region", { name: "Issued certificates" });
  const row = registry.getByRole("row").filter({ hasText: "Grace Graduate" });
  let number = "";

  await test.step("the automatic certificate is listed as valid", async () => {
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Automatic");
    await expect(row).toContainText("Valid");
    number = (await row.getByRole("cell").first().innerText()).trim();
    expect(number).toMatch(NUMBER);
  });

  await test.step("the admin prints the recorded certificate", async () => {
    await pickGraduate(page);
    await expect(page.getByText(`Recorded certificate ${number}`)).toBeVisible();
    await expect(page.getByLabel("Name on the certificate")).toHaveValue("Grace Graduate");
    await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeEnabled();
    await expect(page.locator("article.certificate-sheet").first()).toContainText(
      `www.vtraining.app/verify?code=${number}`,
    );
    await shot(page, "admin-certificates-en");
  });

  await test.step("anyone can verify the number, in English and Arabic", async () => {
    const en = await visitor(browser, baseURL!, "en");
    // Typed loosely: lower case, no dashes.
    await en.page.goto(`/verify?code=${number.toLowerCase().replace(/-/g, "")}`);
    await expect(en.page.getByText("Valid certificate")).toBeVisible();
    await expect(en.page.getByText("Grace Graduate")).toBeVisible();
    await expect(en.page.getByText("not a clinical licence").first()).toBeVisible();
    await shot(en.page, "verify-valid-en");

    const api = await en.page.request.get(`/api/enterprise/certificates/verify?code=${number}`);
    expect(api.status()).toBe(200);
    expect(await api.json()).toMatchObject({ valid: true, certificate: { number } });

    await en.page.goto("/verify?code=VT-0000-0000-0000");
    await expect(en.page.getByText("No certificate has the number VT-0000-0000-0000")).toBeVisible();
    await en.context.close();

    const ar = await visitor(browser, baseURL!, "ar");
    await ar.page.goto(`/verify?code=${number}`);
    await expect(ar.page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(ar.page.getByText("شهادة سارية")).toBeVisible();
    await shot(ar.page, "verify-valid-ar");
    await ar.context.close();
  });

  await test.step("the admin revokes it and verification says so", async () => {
    await row.getByRole("button", { name: "Revoke" }).click();
    await row.getByLabel("Reason (optional)").fill("Name misspelled");
    await row.getByRole("button", { name: "Revoke certificate" }).click();
    await expect(row).toContainText("Revoked");
    await expect(row).toContainText("Name misspelled");

    const en = await visitor(browser, baseURL!, "en");
    await en.page.goto(`/verify?code=${number}`);
    await expect(en.page.getByText("This certificate was revoked")).toBeVisible();
    await shot(en.page, "verify-revoked-en");
    await en.context.close();
  });

  await test.step("the admin issues a new certificate", async () => {
    await page.reload();
    await pickGraduate(page);
    await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeDisabled();
    await page.getByRole("button", { name: "Issue certificate" }).click();
    await expect(page.getByText(/^Recorded certificate VT-/)).toBeVisible();
    await expect(page.getByText(`Recorded certificate ${number}`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeEnabled();
    await expect(registry.getByRole("row").filter({ hasText: "By an admin" })).toHaveCount(1);
  });

  await test.step("the graduate cannot issue or revoke", async () => {
    const grad = await visitor(browser, baseURL!, "en");
    await grad.page.goto("/login");
    await grad.page.fill("#email", GRADUATE);
    await grad.page.fill("#password", PASSWORD);
    await grad.page.click("button[type=submit]");
    await grad.page.waitForURL((url) => !url.pathname.startsWith("/login"));
    const res = await grad.page.request.post("/api/admin/certificates", {
      data: { userId: "00000000-0000-4000-8000-000000000000", recipientName: "x", locale: "en" },
    });
    expect([401, 403]).toContain(res.status());
    await grad.context.close();
  });
});
