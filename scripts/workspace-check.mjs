import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1366, height: 768 },
  hasTouch: true,
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [],
  external = [],
  results = [],
  layouts = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (
    /^https?:/.test(request.url()) &&
    !request.url().startsWith("http://127.0.0.1:3000")
  )
    external.push(request.url());
});
const check = (message) => {
  results.push(message);
  console.log("PASS", message);
};
await mkdir("artifacts", { recursive: true });
const filters = page.getByRole("group", {
  name: "글자 목록 필터",
  exact: true,
});
try {
  await page.goto("http://127.0.0.1:3000/?check=workspace");
  await page.getByRole("heading", { name: /겨.*쓰세요/ }).waitFor();
  assert.match(
    await filters.getByRole("button", { name: /다시 확인/ }).textContent(),
    /0/,
  );
  const fixture = JSON.parse(
    await readFile("artifacts/font-fixture.json", "utf8"),
  );
  fixture.samples["겨"].strokes[0].points = fixture.samples[
    "겨"
  ].strokes[0].points.map((p) => ({ ...p, x: p.x - 400 }));
  fixture.samples["구"].needsReview = true;
  fixture.samples["귀"].status = "skipped";
  fixture.samples["갛"].strokes = [];
  fixture.samples["겪"].strokes = fixture.samples["겪"].strokes.slice(0, 1);
  fixture.samples["※"] = {
    char: "※",
    category: "korean-punct",
    status: "done",
    updatedAt: 1,
    strokes: [{ ...fixture.samples["겨"].strokes[0], id: "symbol" }],
  };
  await writeFile("artifacts/review-fixture.json", JSON.stringify(fixture));
  await page.getByRole("button", { name: "설정 열기" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/review-fixture.json");
  await page.getByText("새 프로젝트로 가져왔습니다", { exact: true }).waitFor();
  await page.getByRole("button", { name: "설정 닫기" }).click();
  assert.match(
    await filters.getByRole("button", { name: /다시 확인/ }).textContent(),
    /6/,
  );
  assert.match(
    await filters.getByRole("button", { name: /영역 벗어남/ }).textContent(),
    /2/,
  );
  assert.equal(
    await page.locator('[id="glyph-겨"]').getAttribute("data-unsafe"),
    "true",
  );
  assert.equal(
    await page.locator('[id="glyph-구"]').getAttribute("data-review"),
    "true",
  );
  const color = await page
    .locator('[id="glyph-겨"]')
    .evaluate((el) => getComputedStyle(el).borderColor);
  const rgb = color.match(/[\d.]+/g).map(Number);
  assert.ok(rgb[0] > rgb[1] * 1.5 && rgb[0] > rgb[2] * 1.5);
  check(
    "existing unsafe handwriting is red and all issue types are counted automatically",
  );
  await filters.getByRole("button", { name: /다시 확인/ }).click();
  assert.equal(await page.locator(".glyph-strip>.glyph").count(), 6);
  assert.equal(await page.locator('[id="glyph-※"]').count(), 1);
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("heading", { name: /구.*쓰세요/ }).waitFor();
  await page
    .getByRole("button", { name: "직접 표시 해제", exact: true })
    .click();
  await page.getByRole("heading", { name: /구.*쓰세요/ }).waitFor();
  assert.equal(await page.locator('[id="glyph-구"]').count(), 0);
  assert.equal(await page.locator(".glyph-strip>.glyph").count(), 5);
  await page.getByRole("button", { name: "다음 →", exact: true }).click();
  await page.getByRole("heading", { name: /귀.*쓰세요/ }).waitFor();
  check(
    "review-only navigation includes disabled categories and removing an issue does not jump away from the current letter",
  );
  await filters.getByRole("button", { name: /영역 벗어남/ }).click();
  assert.equal(await page.locator(".glyph-strip>.glyph").count(), 2);
  await page.getByRole("button", { name: "다음 →", exact: true }).click();
  await page.getByRole("heading", { name: /※.*쓰세요/ }).waitFor();
  await page.getByRole("button", { name: /다시쓰기/ }).click();
  assert.equal(await page.locator('[id="glyph-※"]').count(), 0);
  await page.getByRole("heading", { name: /※.*쓰세요/ }).waitFor();
  await filters.getByRole("button", { name: /다시 확인/ }).click();
  assert.equal(
    await page.locator('[id="glyph-※"]').getAttribute("data-review"),
    "true",
  );
  assert.match(
    await page.getByLabel("현재 글자 확인 상태", { exact: true }).textContent(),
    /다시 작성 필요/,
  );
  await filters.getByRole("button", { name: /^전체/ }).click();
  await page.getByRole("heading", { name: /※.*쓰세요/ }).waitFor();
  assert.equal(await page.locator('[id="glyph-※"]').count(), 1);
  check(
    "cleared unsafe letters stay in the rewrite list and category changes preserve the selected letter",
  );
  // Re-import the issue fixture so every responsive screenshot contains the same clear red indicators.
  await page.getByRole("button", { name: "설정 열기" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/review-fixture.json");
  await page.getByText("새 프로젝트로 가져왔습니다", { exact: true }).waitFor();
  await page.getByRole("button", { name: "설정 닫기" }).click();
  for (const [name, width, height] of [
    ["desktop", 1366, 768],
    ["laptop", 1280, 720],
    ["tablet-landscape", 1024, 768],
    ["tablet-portrait", 820, 1180],
    ["phone", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const info = await page.evaluate(() => {
      const pad = document.querySelector(".pad").getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        pad: { width: pad.width, height: pad.height, y: pad.y },
      };
    });
    assert.ok(
      info.scrollHeight <= height + 1,
      name + " page scroll: " + JSON.stringify(info),
    );
    assert.ok(info.scrollWidth <= width + 1, name + " horizontal overflow");
    assert.ok(info.pad.width >= 200, name + " drawing surface too small");
    assert.ok(
      Math.abs(info.pad.width - info.pad.height) < 1,
      name + " pad must remain square",
    );
    for (const locator of [
      page.getByRole("button", { name: "설정 열기" }),
      page.getByRole("button", { name: "폰트 만들기 →", exact: true }),
      filters.getByRole("button", { name: /다시 확인/ }),
      page.getByRole("button", { name: "다음 →", exact: true }),
      page.getByRole("button", { name: "실행 취소", exact: true }),
      page.getByRole("radio", { name: /자유로운 붓글씨/ }),
    ]) {
      const box = await locator.boundingBox();
      assert.ok(
        box &&
          box.x >= -1 &&
          box.y >= -1 &&
          box.x + box.width <= width + 1 &&
          box.y + box.height <= height + 1,
        name + " control clipped: " + (await locator.textContent()),
      );
    }
    layouts.push({ name, ...info });
    await page.screenshot({ path: "artifacts/workspace-" + name + ".png" });
  }
  check(
    "desktop, laptop, both tablet orientations and phone show the workspace without page scrolling",
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('[id="glyph-겪"]').click();
  await page.getByRole("button", { name: "자모 확인", exact: true }).click();
  await page.getByRole("option", { name: "겪 보정", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("option", { name: "겪 보정", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.getByRole("button", { name: "폰트 만들기 닫기" }).click();
  await page
    .getByRole("button", { name: "다시 확인 표시", exact: true })
    .click();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("heading", { name: /겨.*쓰세요/ }).waitFor();
  await filters.getByRole("button", { name: /다시 확인/ }).click();
  assert.ok((await page.locator(".glyph-strip>.glyph").count()) > 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  check(
    "manual notes persist and component issues open the matching correction character",
  );
  await writeFile(
    "artifacts/workspace-results.json",
    JSON.stringify({ results, layouts, errors, external }, null, 2),
  );
} catch (error) {
  await page
    .screenshot({ path: "artifacts/workspace-error.png" })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
