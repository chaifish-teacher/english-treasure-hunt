import { test, expect } from "@playwright/test";
import questions from "../../src/data/questions.json" with { type: "json" };
import hints from "../../src/data/hints.json" with { type: "json" };
import { GAS_API_URL } from "../../src/config.js";
const bank = new Map(questions.map((q) => [q.id, q]));
async function mockAPI(
  page,
  {
    failStart = false,
    failStartCount = 0,
    invalidId = false,
    failComplete = false,
    delayStart = 0,
  } = {},
) {
  const requests = [];
  let starts = 0;
  let completes = 0;
  await page.route(GAS_API_URL, async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    expect(route.request().headers()["content-type"]).toBe(
      "text/plain;charset=utf-8",
    );
    if (body.action === "start") {
      starts++;
      if (delayStart) await new Promise((r) => setTimeout(r, delayStart));
      if ((failStart && starts === 1) || starts <= failStartCount)
        return route.fulfill({ status: 503, body: "Unavailable" });
      return route.fulfill({
        json: invalidId
          ? { success: true }
          : { success: true, gameId: `test-game-${starts}` },
      });
    }
    completes++;
    if (failComplete && completes === 1)
      return route.fulfill({ status: 503, body: "Unavailable" });
    return route.fulfill({ json: { success: true } });
  });
  return requests;
}
async function login(page) {
  await page.goto("/");
  await page.getByLabel("Seat Number").fill("12");
  await page.getByRole("textbox", { name: /^Name/ }).fill("測試冒險者");
  await page.getByRole("button", { name: "Start Adventure" }).click();
}
async function assertNoOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function choose(page, fieldset, correct) {
  const id = Number(await fieldset.getAttribute("data-question-id"));
  const q = bank.get(id);
  const choice = correct
    ? q.correctChoiceId
    : q.choices.find((c) => c.id !== q.correctChoiceId).id;
  await fieldset.locator(`input[value="${choice}"]`).check();
}
async function mainAdventure(page, wrongIndexes = new Set()) {
  const chosen = [];
  for (let checkpoint = 0; checkpoint < 6; checkpoint++) {
    const cards = page.locator("fieldset.question-card");
    await expect(cards).toHaveCount(5);
    const hintId = Number(await cards.first().getAttribute("data-question-id"));
    await cards.first().locator("summary").click();
    await expect(cards.first().locator(".hint-content")).toContainText(
      hints[hintId].hint,
    );
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    const continueButton = page.getByRole("button", {
      name: "Continue Adventure",
    });
    await expect(continueButton).toBeDisabled();
    const content = await page.locator("main").innerText();
    expect(content).not.toMatch(
      /Initial Score|Correct Answer|Incorrect|Final Mastery|解析/,
    );
    for (let i = 0; i < 5; i++) {
      const card = cards.nth(i);
      chosen.push(Number(await card.getAttribute("data-question-id")));
      await choose(page, card, !wrongIndexes.has(checkpoint * 5 + i));
      if (i < 4) await expect(continueButton).toBeDisabled();
    }
    await assertNoOverflow(page);
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect(page.locator("fieldset")).toHaveCount(0);
    const eventNames = [
      "Treasure Map Fragment",
      "Ancient Compass",
      "Shipwreck Treasure Chest",
      "Ancient Temple Key",
      "Ruined Castle Gate",
      "Legendary Treasure Chamber",
    ];
    await expect(
      page.getByRole("heading", { name: eventNames[checkpoint] }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Back/ })).toHaveCount(0);
    if (checkpoint === 3)
      await page.getByRole("button", { name: "Enter Grammar Ruins" }).click();
    else if (checkpoint === 5)
      await page.getByRole("button", { name: "Open the Treasure" }).click();
    else await page.getByRole("button", { name: "Continue Adventure" }).click();
  }
  expect(new Set(chosen).size).toBe(30);
  return chosen;
}
test("start failure and retry; no game before a valid gameId", async ({
  page,
}) => {
  const requests = await mockAPI(page, { failStart: true });
  await login(page);
  await expect(page.getByRole("status")).toContainText(
    "Preparing your adventure",
  );
  await expect(page.locator("fieldset")).toHaveCount(0);
  await expect(page.locator("fieldset")).toHaveCount(5);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(requests.filter((r) => r.action === "start")).toHaveLength(2);
  expect(requests[0].requestId).toBeTruthy();
  expect(requests[1]).toEqual(requests[0]);
});
test("invalid ID is rejected with a friendly message", async ({ page }) => {
  await mockAPI(page, { invalidId: true });
  await login(page);
  await expect(page.getByRole("alert")).toContainText("目前無法連接成績系統");
  await expect(page.locator("fieldset")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Missing game ID");
});
test("required non-empty identity and rapid start taps only create one request", async ({
  page,
}) => {
  const requests = await mockAPI(page, { delayStart: 300 });
  await page.goto("/");
  const button = page.getByRole("button", { name: "Start Adventure" });
  await expect(button).toBeDisabled();
  await page.getByLabel("Seat Number").fill(" ");
  await page.getByRole("textbox", { name: /^Name/ }).fill("姓名");
  await expect(button).toBeDisabled();
  await page.getByLabel("Seat Number").fill("any-seat");
  await button.evaluate((el) => {
    el.click();
    el.click();
    el.click();
  });
  await expect(page.getByRole("status")).toContainText(
    "Preparing your adventure",
  );
  await expect(page.locator("fieldset")).toHaveCount(5);
  expect(requests).toHaveLength(1);
  expect(requests[0].seatNo).toBe("any-seat");
  expect(requests[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
});
test("full adventure goes straight to all-answer review; failed save retries same ID, Play Again and Exit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = await mockAPI(page, { failComplete: true });
  await login(page);
  const wrongIndexes = new Set([0, 1, 2, 3, 20, 21, 22]);
  const selectedIds = await mainAdventure(page, wrongIndexes);
  await expect(
    page.getByRole("heading", { name: "Adventure Complete!" }),
  ).toBeVisible();
  await expect(page.getByTestId("Vocabulary")).toHaveText("16/20");
  await expect(page.getByTestId("Grammar")).toHaveText("7/10");
  await expect(page.getByTestId("mastery")).toHaveText("23/30");
  await expect(
    page.getByRole("button", { name: "Start Mistake Challenge" }),
  ).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "Your result could not be saved yet.",
  );
  await expect(page.locator("details.review-card")).toHaveCount(30);
  await expect(page.locator(".answer-status.correct")).toHaveCount(23);
  await expect(page.locator(".answer-status.incorrect")).toHaveCount(7);
  for (let i = 0; i < 30; i++) {
    const card = page.locator("details.review-card").nth(i);
    expect(Number(await card.getAttribute("data-question-id"))).toBe(
      selectedIds[i],
    );
    await card.locator("summary").click();
    const q = bank.get(selectedIds[i]);
    const expectedChoice = wrongIndexes.has(i)
      ? q.choices.find((c) => c.id !== q.correctChoiceId)
      : q.choices.find((c) => c.id === q.correctChoiceId);
    const answers = card.locator("dd");
    await expect(answers.nth(0)).toHaveText(expectedChoice.text);
    await expect(answers.nth(1)).toHaveText(
      q.choices.find((c) => c.id === q.correctChoiceId).text,
    );
    await expect(card.locator(".review-choices li")).toHaveCount(4);
    await expect(card.locator(".explanation")).toContainText(q.explanation);
    await card.locator("summary").click();
  }
  await page.locator("details summary").first().click();
  await expect(page.locator("details[open]")).toContainText("Your Answer");
  await expect(page.locator("details[open]")).toContainText("Correct Answer");
  await expect(page.locator("details[open]")).toContainText("解析");
  for (const width of [375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await assertNoOverflow(page);
    await page.screenshot({
      path: `test-results/results-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Retry Save" }).evaluate((el) => {
    el.click();
    el.click();
  });
  await expect(page.getByRole("status")).toContainText(
    "Your result has been saved.",
  );
  const complete = requests.filter((r) => r.action === "complete");
  expect(complete).toHaveLength(2);
  expect(complete[0]).toEqual({
    action: "complete",
    gameId: "test-game-1",
    vocabularyScore: "16/20",
    grammarScore: "7/10",
    initialScore: "23/30",
    mistakeCount: 7,
    mistakeChallengeScore: "0/0",
    finalMasteryScore: "23/30",
  });
  expect(complete[1]).toEqual(complete[0]);
  await page.getByRole("button", { name: "Play Again" }).click();
  await expect(page.locator("fieldset")).toHaveCount(5);
  const starts = requests.filter((r) => r.action === "start");
  expect(starts[1]).toEqual({
    action: "start",
    seatNo: "12",
    name: "測試冒險者",
    requestId: expect.any(String),
  });
  expect(starts[1].requestId).not.toBe(starts[0].requestId);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Exit 登出", exact: true }).click();
  await expect(page.getByLabel("Seat Number")).toHaveValue("");
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue("");
  expect(requests.filter((r) => r.action === "complete")).toHaveLength(2);
  await page.getByLabel("Seat Number").fill("12");
  await page.getByRole("textbox", { name: /^Name/ }).fill("測試冒險者");
  await page.getByRole("button", { name: "Start Adventure" }).click();
  await expect(page.locator("fieldset")).toHaveCount(5);
  const afterExit = requests.filter((r) => r.action === "start").at(-1);
  expect(afterExit.requestId).not.toBe(starts[0].requestId);
  expect(afterExit.requestId).not.toBe(starts[1].requestId);
  expect(requests.filter((r) => r.action === "complete")).toHaveLength(2);
});
test("perfect score reviews all 30 correct questions and saves exactly once", async ({
  page,
}) => {
  const requests = await mockAPI(page);
  await login(page);
  await mainAdventure(page);
  await expect(
    page.getByRole("heading", { name: "Adventure Complete!" }),
  ).toBeVisible();
  await expect(page.getByTestId("mastery")).toHaveText("30/30");
  await expect(page.getByRole("status")).toContainText(
    "Your result has been saved.",
  );
  await expect(page.locator("details.review-card")).toHaveCount(30);
  await expect(page.locator(".answer-status.correct")).toHaveCount(30);
  await expect(page.locator(".answer-status.incorrect")).toHaveCount(0);
  await page.getByRole("button", { name: "Mute sound" }).click();
  await page.getByRole("button", { name: "Unmute sound" }).click();
  expect(requests.filter((r) => r.action === "complete")).toHaveLength(1);
});
for (const width of [375, 390, 430, 768, 1280]) {
  test(`layout and keyboard selection at ${width}px; no horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockAPI(page);
    await page.goto("/");
    await assertNoOverflow(page);
    await page.screenshot({
      path: `test-results/login-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("Seat Number").fill("12");
    await page.getByRole("textbox", { name: /^Name/ }).fill("測試冒險者");
    await page.getByRole("button", { name: "Start Adventure" }).click();
    await expect(page.locator("fieldset")).toHaveCount(5);
    const radio = page.locator("fieldset").first().getByRole("radio").first();
    await radio.focus();
    await page.keyboard.press("Space");
    await expect(radio).toBeChecked();
    await assertNoOverflow(page);
    const labels = await page
      .locator(".choice")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(labels.every((h) => h >= 44)).toBe(true);
    await page.screenshot({
      path: `test-results/questions-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}

test("three failures show existing error; unchanged manual Retry reuses requestId and does not duplicate start sequences", async ({
  page,
}) => {
  const requests = await mockAPI(page, { failStartCount: 3, delayStart: 100 });
  await login(page);
  await expect(
    page.getByRole("button", { name: "Start Adventure" }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Unable to connect");
  expect(requests).toHaveLength(3);
  expect(new Set(requests.map((r) => r.requestId)).size).toBe(1);
  await expect(page.getByLabel("Seat Number")).toHaveValue("12");
  await page.getByRole("button", { name: "Retry 重新連線" }).evaluate((el) => {
    el.click();
    el.click();
    el.click();
  });
  await expect(page.locator("fieldset")).toHaveCount(5);
  expect(requests).toHaveLength(4);
  expect(requests[3]).toEqual(requests[0]);
});

for (const field of ["seatNo", "name"]) {
  test(`changing ${field} after failed login creates a new requestId`, async ({
    page,
  }) => {
    const requests = await mockAPI(page, { failStartCount: 3 });
    await login(page);
    await expect(page.getByRole("alert")).toBeVisible();
    const input =
      field === "seatNo"
        ? page.getByLabel("Seat Number")
        : page.getByRole("textbox", { name: /^Name/ });
    await input.fill(field === "seatNo" ? "13" : "新冒險者");
    await page.getByRole("button", { name: "Retry 重新連線" }).click();
    await expect(page.locator("fieldset")).toHaveCount(5);
    expect(requests).toHaveLength(4);
    expect(requests[3].requestId).not.toBe(requests[0].requestId);
    expect(requests[3][field]).not.toBe(requests[0][field]);
  });
}

for (const width of [375, 390, 430]) {
  test(`question hints and translations expand accessibly at ${width}px without selecting an answer`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockAPI(page);
    await login(page);
    const cards = page.locator("fieldset.question-card");
    await expect(cards).toHaveCount(5);
    await expect(page.locator("details.question-hint[open]")).toHaveCount(0);
    for (let i = 0; i < 5; i++) {
      const card = cards.nth(i);
      const id = Number(await card.getAttribute("data-question-id"));
      const summary = card.locator("summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(card.locator(".hint-content")).toBeVisible();
      await expect(card.locator(".hint-content")).toContainText(hints[id].hint);
      await expect(card.locator(".hint-translation")).toContainText(
        hints[id].translation,
      );
      await assertNoOverflow(page);
    }
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Continue Adventure" }),
    ).toBeDisabled();
    await choose(page, cards.first(), true);
    await cards.first().locator("summary").click();
    await expect(
      cards.first().getByRole("radio", { checked: true }),
    ).toHaveCount(1);
    await page.screenshot({
      path: `test-results/hints-${width}.png`,
      fullPage: true,
    });
  });
}
