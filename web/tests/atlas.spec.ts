import { expect, test } from "@playwright/test";

test("dark is the default and the saved appearance works across views and offline reloads", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/?candidate=P-09#card");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByText(/Saved for offline use/)).toBeVisible({
    timeout: 30000,
  });
  const location = page.url();
  await page.getByRole("button", { name: "Switch to light mode" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(page.url()).toBe(location);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/team.html");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.goto("/#compare");
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Activar modo claro" }),
  ).toBeVisible();
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Activar modo claro" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("site selection, reading goal and comparison slots survive navigation", async ({
  page,
}) => {
  await page.goto("/#explore");
  await page.getByLabel("Practice goal").selectOption("robot");
  await page.getByRole("searchbox").fill("P-19");
  await page.getByRole("link", { name: /Payunia P-19/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Payunia P-19",
  );
  await page.getByRole("button", { name: "Compare this record" }).click();
  const slots = page.locator(".record-column select");
  await expect(slots.nth(0)).toHaveValue("P-19");
  await expect(page.getByLabel("Practice goal")).toHaveValue("robot");
  await slots.nth(1).selectOption("P-09");
  await slots.nth(2).selectOption("CTRL-MEDANOS");
  await page
    .locator(".record-column")
    .nth(1)
    .getByRole("button", { name: "Open site record" })
    .click();
  await expect(page.locator("h1")).toHaveText("Payunia P-09");
  await page.goBack();
  await expect(slots.nth(0)).toHaveValue("P-19");
  await expect(slots.nth(1)).toHaveValue("P-09");
  await expect(slots.nth(2)).toHaveValue("CTRL-MEDANOS");
  await page.goForward();
  await expect(page.locator("h1")).toHaveText("Payunia P-09");
  await page.getByRole("button", { name: "Compare this record" }).click();
  await page.reload();
  await expect(slots.nth(2)).toHaveValue("CTRL-MEDANOS");
  await expect(page.getByText("Method reference control")).toBeVisible();
});

test("missing compatibility and unavailable records do not produce false scores", async ({
  page,
}) => {
  const raw = await (await page.request.get("/data/fichas/P-07.json")).json();
  await page.route("**/fichas/P-07.json", (route) =>
    route.fulfill({ json: { ...raw, C: null } }),
  );
  let unavailable = true;
  await page.route("**/fichas/P-09.json", (route) =>
    unavailable ? route.abort() : route.continue(),
  );
  await page.goto("/?sites=P-07,P-09,#compare");
  await expect(page.getByRole("alert")).toContainText("could not be read");
  await page.locator(".technical summary").first().click();
  await expect(page.locator(".carril-pista").first()).toHaveAccessibleName(
    /Compatibility unknown/,
  );
  unavailable = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".carril")).toHaveCount(2);
});

test("offline atlas opens a new deep link, charts and lunar lab without WebGL", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      return type.includes("webgl")
        ? null
        : Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(page.getByText(/Saved for offline use/)).toBeVisible({
    timeout: 30000,
  });
  await context.setOffline(true);
  await page.getByRole("button", { name: "View in 3D" }).click();
  await expect(page.getByText(/Interactive 3D is unavailable/)).toBeVisible();
  await page.goto("/?candidate=P-09#compare");
  await expect(page.locator(".record-column select").first()).toHaveValue(
    "P-09",
  );
  await page.locator(".technical summary").first().click();
  await expect(page.locator(".carril")).toHaveCount(2);
  await page.goto("/#worlds");
  await page.getByRole("button", { name: "Open illustrative 3D view" }).click();
  await expect(page.getByText(/Static illustrations/)).toBeVisible();
  await page.getByRole("button", { name: "Energy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Power from the three panels" }),
  ).toBeVisible();
  await page.goto("/#lab");
  await expect(page.getByText("Computed in your browser")).toBeVisible();
  await expect(page.locator(".condiciones strong").first()).toContainText("h", {
    timeout: 30000,
  });
});

test("Community, accounts, integrity verification and the SI guide remain reachable", async ({ page }) => {
  await page.route("**/api/**", route => route.abort());
  await page.goto("/#community");
  await expect(page.getByRole("heading", {level: 1})).toHaveText("Community");
  await expect(page.getByRole("heading", {name: "Accounts and Community run on the TERRA-X server"})).toBeVisible();
  await page.getByRole("link", {name: "Sign in", exact: true}).click();
  await expect(page).toHaveURL(/#account$/);
  await page.goto("/#checks");
  const manifest = await (await page.request.get("/data/manifest.json")).json();
  await page.getByRole("button", {name: "Check every file now"}).click();
  await expect(page.getByText(manifest.archivos.length + " of " + manifest.archivos.length + " files match", {exact: true})).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", {name: "TERRA-X SI assistant"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", {name: "TERRA-X SI assistant"})).toBeHidden();
});
