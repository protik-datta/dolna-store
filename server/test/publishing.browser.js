import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const adminOrigin = process.env.ADMIN_ORIGIN;
const storeOrigin = process.env.CLIENT_ORIGIN;
async function ready(origin) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Frontend did not start: ${origin}`);
}

test(
  "admin publication defaults, draft visibility and storefront refresh",
  { timeout: 180000 },
  async () => {
    assert.ok(
      adminOrigin && storeOrigin && process.env.TEST_BASE_URL,
      "Use npm run test:browser to start the isolated environment.",
    );
    const create = spawnSync(process.execPath, ["scripts/create-admin.js"], {
      encoding: "utf8",
      env: {
        ...process.env,
        ADMIN_EMAIL: process.env.TEST_ADMIN_EMAIL,
        ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD,
        ADMIN_NAME: "Publishing Test Admin",
      },
    });
    assert.equal(create.status, 0, create.stderr || create.stdout);
    await Promise.all([ready(adminOrigin), ready(storeOrigin)]);
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
      headless: true,
      args: ["--test-third-party-cookie-phaseout"],
    });
    const runtimeErrors = [];
    try {
      const context = await browser.newContext();
      context.on("page", (page) =>
        page.on("pageerror", (error) => runtimeErrors.push(error.message)),
      );
      const admin = await context.newPage();
      await admin.goto(`${adminOrigin}/login`);
      await admin
        .getByLabel("Email address")
        .fill(process.env.TEST_ADMIN_EMAIL);
      await admin
        .getByLabel("Password", { exact: true })
        .fill(process.env.TEST_ADMIN_PASSWORD);
      await admin.getByRole("button", { name: "Sign in", exact: true }).click();
      await admin.waitForURL(`${adminOrigin}/`);
      const store = await context.newPage();
      await store.goto(storeOrigin);
      await store
        .getByText("ক্রেতাদের মতামত শিগগিরই এখানে প্রকাশিত হবে।", {
          exact: true,
        })
        .waitFor();

      await admin
        .getByRole("link", { name: "Testimonials", exact: true })
        .click();
      await admin
        .getByRole("button", { name: "Add review", exact: true })
        .click();
      assert.equal(
        await admin.getByLabel("Show on website", { exact: true }).isChecked(),
        true,
      );
      await admin
        .getByLabel("Name", { exact: true })
        .fill("Default Published Reviewer");
      await admin
        .getByLabel("Review", { exact: true })
        .fill("This review should appear without selecting any extra option.");
      await admin
        .getByRole("button", { name: "Save & publish", exact: true })
        .click();
      await admin
        .getByText("Review published. It is visible on the website.", {
          exact: true,
        })
        .waitFor();
      await store.bringToFront();
      await store
        .locator(".review-card b", { hasText: "Default Published Reviewer" })
        .waitFor({ timeout: 35000 });
      console.log(
        "PASS: saving a new testimonial publishes it by default and updates an open storefront.",
      );

      const cookies = (await context.cookies(adminOrigin))
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
      const headers = {
        cookie: cookies,
        origin: adminOrigin,
        "X-Requested-With": "dolna-admin",
        "Content-Type": "application/json",
      };
      const apiRequest = async (path, method = "GET", body) => {
        const response = await fetch(
          `${process.env.TEST_BASE_URL}/api${path}`,
          {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
          },
        );
        assert.ok(
          response.ok,
          `${method} ${path}: ${response.status} ${await response.clone().text()}`,
        );
        return (await response.json()).data;
      };
      for (let index = 2; index <= 4; index++)
        await apiRequest("/admin/testimonials", "POST", {
          name: `Published Reviewer ${index}`,
          text: "Published customer feedback for the visibility regression.",
          rating: 5,
          isPublished: true,
        });
      await store.reload();
      await store
        .locator(".review-card b", { hasText: "Published Reviewer 4" })
        .waitFor();
      assert.equal(
        await store.locator(".review-card").count(),
        4,
        "all published reviews should render, including the fourth review",
      );

      const [review] = await apiRequest("/admin/testimonials");
      await store.bringToFront();
      await apiRequest(`/admin/testimonials/${review._id}/publish`, "PATCH", {
        isPublished: false,
      });
      await store
        .locator(".review-card b", { hasText: review.name })
        .waitFor({ state: "hidden", timeout: 35000 });
      console.log(
        "PASS: an open storefront automatically removes an unpublished review without a page reload.",
      );

      await admin.bringToFront();
      await admin
        .getByRole("button", { name: "Add review", exact: true })
        .click();
      await admin.getByLabel("Name", { exact: true }).fill("Draft Reviewer");
      await admin
        .getByLabel("Review", { exact: true })
        .fill("This review must remain hidden until published.");
      await admin.getByLabel("Show on website", { exact: true }).uncheck();
      await admin
        .getByRole("button", { name: "Save as draft", exact: true })
        .click();
      await admin
        .getByText("Review saved as a draft. It is hidden from the website.", {
          exact: true,
        })
        .waitFor();
      assert.ok(
        !(await apiRequest("/testimonials")).some(
          (review) => review.name === "Draft Reviewer",
        ),
      );
      await admin
        .getByRole("row")
        .filter({ hasText: "Draft Reviewer" })
        .getByRole("button", { name: "Draft — click to publish", exact: true })
        .click();
      await admin
        .getByRole("row")
        .filter({ hasText: "Draft Reviewer" })
        .getByRole("button", { name: "Live on website", exact: true })
        .waitFor();
      await store.bringToFront();
      await store
        .locator(".review-card b", { hasText: "Draft Reviewer" })
        .waitFor({ timeout: 35000 });
      console.log(
        "PASS: drafts stay hidden and one-click publication makes them visible.",
      );

      await admin.bringToFront();
      await admin.getByRole("link", { name: "Products", exact: true }).click();
      await admin
        .getByRole("button", { name: "Add product", exact: true })
        .click();
      assert.equal(
        await admin.getByLabel("Show on website", { exact: true }).isChecked(),
        true,
      );
      await admin
        .getByLabel("Product name", { exact: true })
        .fill("Default Published Dolna");
      await admin
        .getByLabel("Collection", { exact: true })
        .fill("Publishing Tests");
      await admin.getByLabel("Price (BDT)", { exact: true }).fill("100");
      await admin
        .getByRole("button", { name: "Save & publish", exact: true })
        .click();
      await admin
        .getByText("Product published. It is visible on the website.", {
          exact: true,
        })
        .waitFor();
      await store.goto(`${storeOrigin}/shop`);
      await store
        .getByRole("heading", { name: "Default Published Dolna", exact: true })
        .waitFor();
      console.log(
        "PASS: saving a product with the default settings makes it visible in the shop.",
      );

      const errorPage = await context.newPage();
      await errorPage.route("**/api/testimonials", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Temporary catalogue failure",
          }),
        }),
      );
      await errorPage.goto(storeOrigin);
      await errorPage
        .getByRole("alert")
        .filter({ hasText: "Temporary catalogue failure" })
        .waitFor();
      assert.equal(
        await errorPage
          .getByText("ক্রেতাদের মতামত শিগগিরই এখানে প্রকাশিত হবে।", {
            exact: true,
          })
          .count(),
        0,
      );
      await errorPage.unroute("**/api/testimonials");
      await errorPage
        .getByRole("button", { name: "আবার চেষ্টা করুন", exact: true })
        .click();
      await errorPage.locator(".review-card").first().waitFor();
      assert.deepEqual(runtimeErrors, []);
      console.log(
        "PASS: API errors show a retry action instead of pretending that the catalogue is empty.",
      );
    } finally {
      await browser.close();
    }
  },
);
