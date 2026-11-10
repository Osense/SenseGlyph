import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    acceptDownloads: true,
  }),
  page = await context.newPage();
page.setDefaultTimeout(15000);
const results = [],
  errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:3000"))
    external.push(r.url());
});
const check = (msg) => {
  results.push(msg);
  console.log("PASS", msg);
};
const step = async (n) => {
  await page.locator(".journey-track button").nth(n).click();
  await page.waitForTimeout(450);
};
const backup = async (path) => {
  await page.getByRole("button", { name: "설정 열기" }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSON 내보내기 ↓", exact: true })
    .click();
  await (await pending).saveAs(path);
  await page.getByRole("button", { name: "설정 닫기" }).click();
  return JSON.parse(await readFile(path, "utf8"));
};
try {
  const fixture = JSON.parse(
    await readFile("artifacts/font-fixture.json", "utf8"),
  );
  const originalName = fixture.name;
  const strokes = fixture.samples["갛"].strokes;
  for (let i = 0; i < 7; i++)
    strokes.push({
      ...structuredClone(strokes[0]),
      id: "extra-cho-" + i,
      order: strokes.length,
    });
  strokes.push({
    ...structuredClone(strokes[2]),
    id: "extra-jong",
    order: strokes.length,
  });
  await writeFile(
    "artifacts/regions-project-fixture.json",
    JSON.stringify(fixture),
  );
  await page.goto("http://127.0.0.1:3000/?regions-projects");
  await page.getByRole("button", { name: "설정 열기" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/regions-project-fixture.json");
  await page.getByText("새 프로젝트로 가져왔습니다", { exact: true }).waitFor();
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await step(3);
  await page.getByRole("option", { name: "갛 보정", exact: true }).click();
  const svg = page.getByLabel("갛 자모 분리 화면", { exact: true });
  // The judged regions are drawn from the reference font's real jamo shapes.
  const regionsOf = async (target) =>
    (await page.waitForTimeout(250)) ||
    target
      .locator("[data-reference-regions=true]")
      .evaluate((e) =>
        ["href", "x", "y", "width", "height"].map((a) => e.getAttribute(a)),
      );
  const boxes = () => regionsOf(svg);
  const sansBoxes = await boxes();
  await step(1);
  await page.getByRole("radio", { name: /편안한 손글씨/ }).click();
  await step(3);
  await page.getByRole("option", { name: "갛 보정", exact: true }).click();
  assert.notDeepEqual(await boxes(), sansBoxes);
  await page.getByText(/편안한 손글씨 견본의 실제 ‘갛’ 자모 모양/).waitFor();
  await page.getByRole("option", { name: "겪 보정", exact: true }).click();
  const otherBoxes = await regionsOf(
    page.getByLabel("겪 자모 분리 화면", { exact: true }),
  );
  assert.notDeepEqual(otherBoxes, sansBoxes);
  await page.getByRole("option", { name: "갛 보정", exact: true }).click();
  check(
    "actual font and character changes produce distinct reference-ink-derived jamo regions",
  );
  await svg.scrollIntoViewIfNeeded();
  await page
    .locator(".stroke-assignments")
    .evaluate((e) => (e.scrollTop = 350));
  const sb = await svg.boundingBox(),
    bounds = await svg.locator('[data-stroke-id="갛-jong"]').evaluate((e) => {
      const r = e.getBBox();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
  const poly = [
    [bounds.x - 25, bounds.y - 25],
    [bounds.x + bounds.w + 25, bounds.y - 20],
    [bounds.x + bounds.w + 35, bounds.y + bounds.h + 10],
    [bounds.x + bounds.w / 2, bounds.y + bounds.h + 30],
    [bounds.x - 25, bounds.y + bounds.h + 10],
    [bounds.x - 25, bounds.y - 25],
  ];
  const coords = ([x, y]) => [
    sb.x + (sb.width * x) / 1000,
    sb.y + (sb.height * y) / 1000,
  ];
  await page.mouse.move(...coords(poly[0]));
  await page.mouse.down();
  for (const p of poly.slice(1))
    await page.mouse.move(...coords(p), { steps: 6 });
  assert.equal(await svg.locator("[data-lasso=true]").count(), 1);
  await page.screenshot({ path: "artifacts/lasso-selection.png" });
  await page.mouse.up();
  await page.waitForTimeout(450);
  assert.equal(
    await page.getByLabel("3번 획 선택", { exact: true }).isChecked(),
    true,
  );
  assert.equal(
    await page.getByLabel("11번 획 선택", { exact: true }).isChecked(),
    true,
  );
  assert.deepEqual(
    await page
      .locator("[data-assignment-id]")
      .evaluateAll((es) => es.slice(0, 2).map((e) => e.dataset.assignmentId)),
    ["갛-jong", "extra-jong"],
  );
  assert.ok(
    (await page.locator(".stroke-assignments").evaluate((e) => e.scrollTop)) <
      1,
  );
  await page
    .getByRole("button", { name: "3번 획 초성 지정", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "11번 획 초성 지정", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "보정 실행 취소" }).click();
  await page.screenshot({ path: "artifacts/lasso-ranked-rows.png" });
  check(
    "freeform lasso selects ink, slides selected rows to the top, scrolls the list up, and bulk assigns without renumbering",
  );
  await page
    .getByRole("button", { name: "1번 획 중성 지정", exact: true })
    .click();
  const saved = await backup("artifacts/project-before-new.json");
  assert.deepEqual(saved.samples, fixture.samples);
  await page
    .getByRole("button", { name: "처음부터 다시하기", exact: true })
    .click();
  await page.getByLabel("새 프로젝트 이름").fill("실험 폰트");
  await page
    .getByRole("button", { name: "새 폰트 시작하기 →", exact: true })
    .click();
  await page.locator(".setup-screen").waitFor();
  await step(2);
  assert.equal(await page.locator(".glyph.done").count(), 0);
  const pad = page.locator(".writing-area canvas[data-layer=live]"),
    pb = await pad.boundingBox();
  await page.mouse.move(pb.x + pb.width * 0.4, pb.y + pb.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(pb.x + pb.width * 0.6, pb.y + pb.height * 0.6, {
    steps: 8,
  });
  await page.mouse.up();
  // Start another project immediately: even a pending debounce must be preserved.
  await page
    .getByRole("button", { name: "처음부터 다시하기", exact: true })
    .click();
  await page.getByLabel("새 프로젝트 이름").fill("실험 폰트");
  await page
    .getByRole("button", { name: "새 폰트 시작하기 →", exact: true })
    .click();
  await page.locator(".setup-screen").waitFor();
  await page
    .getByRole("button", { name: "처음부터 다시하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "실험 폰트 프로젝트 열기", exact: true })
    .click();
  await page.locator(".writing-area").waitFor();
  assert.equal(await page.locator(".glyph.done").count(), 1);
  check(
    "new projects start empty with unique names and preserve even the last just-written stroke in the previous project",
  );
  await page
    .getByRole("button", { name: "처음부터 다시하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: originalName + " 프로젝트 열기", exact: true })
    .click();
  const restored = await backup("artifacts/project-reopened.json");
  assert.equal(restored.id, saved.id);
  assert.deepEqual(restored.samples, saved.samples);
  assert.deepEqual(restored.fontPreparation, saved.fontPreparation);
  await page.reload();
  await page.locator(".writing-area").waitFor();
  assert.equal(await page.locator(".glyph.done").count(), 138);
  check(
    "original project ID, every vector and manual correction survive switching and browser reload",
  );
  await page
    .getByRole("button", { name: "처음부터 다시하기", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", {
        name: originalName + " 프로젝트 삭제",
        exact: true,
      })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "실험 폰트 (2) 프로젝트 삭제", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "실험 폰트 (2) 프로젝트 열기", exact: true })
      .count(),
    1,
  );
  await page.getByRole("button", { name: "취소", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "실험 폰트 (2) 프로젝트 열기", exact: true })
      .count(),
    1,
  );
  await page
    .getByRole("button", { name: "실험 폰트 (2) 프로젝트 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "확인하고 삭제", exact: true })
    .click();
  await page
    .getByRole("button", { name: "실험 폰트 (2) 프로젝트 열기", exact: true })
    .waitFor({ state: "detached" });
  assert.equal(
    await page
      .getByRole("button", { name: "실험 폰트 프로젝트 열기", exact: true })
      .count(),
    1,
  );
  await page.screenshot({ path: "artifacts/project-manager.png" });
  check(
    "old projects remain until explicit confirmed deletion, and the active project cannot be deleted accidentally",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/project-manager-mobile.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "프로젝트 관리 닫기" }).click();
  assert.equal(await page.locator(".save-state").isVisible(), true);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    "artifacts/regions-projects-results.json",
    JSON.stringify({ results, errors, external }, null, 2),
  );
} finally {
  await browser.close();
}
