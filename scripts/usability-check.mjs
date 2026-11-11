import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import opentype from "opentype.js";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1366, height: 1100 },
  deviceScaleFactor: 1,
  hasTouch: true,
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [],
  external = [],
  results = [];
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
const frames = () =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
const pixels = (layer) =>
  page.locator('[data-layer="' + layer + '"]').evaluate((canvas) => {
    const data = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]) count++;
    return count;
  });
await mkdir("artifacts", { recursive: true });
try {
  await page.goto("http://127.0.0.1:3000/?check=usability");
  await page.getByRole("heading", { name: /겨.*쓰세요/ }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const pad = await page.locator(".input-canvas").boundingBox();
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(pad.x + pad.width * 0.25, pad.y + pad.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(pad.x + pad.width * 0.65, pad.y + pad.height * 0.45, {
      steps: 12,
    });
    await page.mouse.up();
    await frames();
    assert.ok((await pixels("ink")) > 100);
    assert.equal(await pixels("live"), 0);
    await page.getByRole("heading", { level: 1 }).click();
    await page.keyboard.press("e");
    await page.mouse.click(
      pad.x + pad.width * 0.45,
      pad.y + pad.height * 0.375,
    );
    await frames();
    await page.getByText("0획 · 자동 저장", { exact: true }).waitFor();
    assert.equal(await pixels("ink"), 0);
    assert.equal(await pixels("live"), 0);
    await page.getByRole("heading", { level: 1 }).click();
    await page.keyboard.press("Control+z");
    await frames();
    assert.ok((await pixels("ink")) > 100);
    await page.keyboard.press("Control+Shift+z");
    await frames();
    assert.equal(await pixels("ink"), 0);
    await page.keyboard.press("p");
  }
  check(
    "repeated draw, erase, undo and redo repaint actual canvas pixels without stale frames",
  );
  for (const brush of ["펜", "마커", "붓", "연필", "납작펜"]) {
    await page.getByRole("button", { name: brush, exact: true }).click();
    await page.mouse.click(pad.x + pad.width * 0.45, pad.y + pad.height * 0.5);
    await frames();
    assert.ok((await pixels("ink")) > 0);
    await page.keyboard.press("Control+z");
    await frames();
    assert.equal(await pixels("ink"), 0);
  }
  check(
    "all five brushes show a short tap immediately and undo clears its actual pixels",
  );
  await page.mouse.move(pad.x + pad.width * 0.98, pad.y + pad.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(pad.x + pad.width * 0.99, pad.y + pad.height * 0.6, {
    steps: 4,
  });
  await page.mouse.up();
  await frames();
  await page.getByRole("alert").filter({ hasText: "안전영역" }).waitFor();
  assert.equal(await pixels("ink"), 0);
  await page.getByText("0획 · 자동 저장", { exact: true }).waitFor();
  await page.getByRole("button", { name: "다시 그리기", exact: true }).click();
  check(
    "out-of-safety strokes show an error and are rejected without damaging existing ink",
  );
  for (const name of [
    "정갈한 고딕",
    "책에 쓰는 명조",
    "통통한 캐릭터 글씨",
    "또박또박 칠판 글씨",
    "굵기가 살아 있는 붓글씨",
    "묵직한 포스터",
    "레트로 픽셀",
  ]) {
    const radio = page.getByRole("radio", { name: new RegExp(name) });
    await radio.click();
    assert.equal(await radio.getAttribute("aria-checked"), "true");
    await page.evaluate(() => document.fonts.ready);
    await frames();
    assert.ok((await pixels("sample")) > 100);
  }
  const extent = await page
    .locator('[data-layer="sample"]')
    .evaluate((canvas) => {
      const { width: w, height: h } = canvas,
        data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
      let maximum = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (data[(y * w + x) * 4 + 3] > 0)
            maximum = Math.max(
              maximum,
              Math.abs(((x + 0.5) * 1000) / w - 500) +
                Math.abs(((y + 0.5) * 1000) / h - 500),
            );
      return maximum;
    });
  assert.ok(extent <= 490);
  await page.waitForTimeout(700);
  await page.reload();
  await page.getByRole("radio", { name: /굵기가 살아 있는 붓글씨/ }).waitFor();
  assert.equal(
    await page
      .getByRole("radio", { name: /굵기가 살아 있는 붓글씨/ })
      .getAttribute("aria-checked"),
    "true",
  );
  check(
    "seven local reference fonts render, persist and fit within the diamond",
  );
  await page.getByRole("button", { name: "설정 열기" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/font-fixture.json");
  await page.getByText("새 프로젝트로 가져왔습니다", { exact: true }).waitFor();
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await page
    .getByRole("button", { name: "폰트 만들기 →", exact: true })
    .click();
  assert.equal(
    await page
      .getByLabel("분리한 자모로 아직 쓰지 않은 한글도 조합하기")
      .count(),
    0,
  );
  const metric = page.getByLabel("간격 기준선 실시간 견본", { exact: true });
  const before = await metric.evaluate((canvas) => canvas.toDataURL());
  await page.getByLabel("글자 사이 간격", { exact: true }).fill("90");
  await frames();
  const spaced = await metric.evaluate((canvas) => canvas.toDataURL());
  assert.notEqual(spaced, before);
  await page.getByLabel("기준선", { exact: true }).fill("870");
  await frames();
  assert.notEqual(
    await metric.evaluate((canvas) => canvas.toDataURL()),
    spaced,
  );
  check(
    "spacing and baseline sliders update an immediate vector/reference sample before font generation",
  );
  await page
    .getByRole("button", { name: "1. 자모 확인·보정", exact: true })
    .click();
  await page.getByRole("option", { name: "갛 보정", exact: true }).click();
  await page
    .getByRole("heading", { name: "획별 자모 배정", exact: true })
    .click();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("option", { name: "겪 보정", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page
      .getByRole("option", { name: "갛 보정", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page.getByRole("button", { name: "다음 보정 글자" }).tap();
  await page.getByRole("button", { name: "이전 보정 글자" }).tap();
  assert.equal(
    await page
      .getByRole("option", { name: "갛 보정", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  check(
    "character slide selector, keyboard arrows and tablet navigation buttons stay synchronized",
  );
  const svg = page.getByLabel("갛 자모 분리 화면", { exact: true });
  await svg.scrollIntoViewIfNeeded();
  let box = await svg.boundingBox();
  const drag = async (a, b) => {
    await page.mouse.move(box.x + box.width * a[0], box.y + box.height * a[1]);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * b[0], box.y + box.height * b[1], {
      steps: 10,
    });
    await page.mouse.up();
  };
  await drag([0.15, 0.25], [0.85, 0.5]);
  assert.equal(
    await page.getByLabel("1번 획 선택", { exact: true }).isChecked(),
    true,
  );
  assert.equal(
    await page.getByLabel("2번 획 선택", { exact: true }).isChecked(),
    true,
  );
  assert.equal(
    await page.getByLabel("3번 획 선택", { exact: true }).isChecked(),
    false,
  );
  await page
    .getByRole("button", { name: "1번 획 종성 지정", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "2번 획 종성 지정", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "보정 실행 취소" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "1번 획 초성 지정", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "2번 획 중성 지정", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  check(
    "marquee selection highlights rows and one part button assigns every selected stroke atomically with undo",
  );
  await svg.scrollIntoViewIfNeeded();
  box = await svg.boundingBox();
  const hit = await svg
    .locator('path[data-stroke-id="갛-cho"]')
    .evaluate((path) => {
      const bounds = path.getBBox();
      for (let y = bounds.y + 2; y < bounds.y + bounds.height; y += 3)
        for (let x = bounds.x + 2; x < bounds.x + bounds.width; x += 3)
          if (path.isPointInFill(new DOMPoint(x, y))) return { x, y };
      throw Error("no stroke interior");
    });
  await drag(
    [hit.x / 1000, hit.y / 1000],
    [hit.x / 1000 + 0.04, hit.y / 1000 + 0.035],
  );
  assert.equal(
    await page.getByLabel("2번 획 선택", { exact: true }).isChecked(),
    true,
  );
  await page.getByRole("button", { name: "부분 수정", exact: true }).click();
  await svg.scrollIntoViewIfNeeded();
  box = await svg.boundingBox();
  const anchor = svg.locator(
    'circle[data-stroke-id="갛-cho"][data-point-index="1"]',
  );
  const anchorBox = await anchor.boundingBox();
  await page.mouse.move(
    anchorBox.x + anchorBox.width / 2,
    anchorBox.y + anchorBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    anchorBox.x + anchorBox.width / 2 + box.width * 0.02,
    anchorBox.y + anchorBox.height / 2 + box.height * 0.02,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.getByRole("button", { name: "선택·이동", exact: true }).click();
  await svg.scrollIntoViewIfNeeded();
  box = await svg.boundingBox();
  const beforeUnsafe = await svg
    .locator('path[data-stroke-id="갛-cho"]')
    .getAttribute("d");
  const safeHit = await svg
    .locator('path[data-stroke-id="갛-cho"]')
    .evaluate((path) => {
      const b = path.getBBox();
      for (let y = b.y + 2; y < b.y + b.height; y += 3)
        for (let x = b.x + 2; x < b.x + b.width; x += 3)
          if (path.isPointInFill(new DOMPoint(x, y))) return { x, y };
    });
  await drag(
    [safeHit.x / 1000, safeHit.y / 1000],
    [safeHit.x / 1000 - 0.3, safeHit.y / 1000],
  );
  await page.getByRole("alert").filter({ hasText: "안전영역" }).waitFor();
  assert.equal(
    await svg.locator('path[data-stroke-id="갛-cho"]').getAttribute("d"),
    beforeUnsafe,
  );
  check(
    "unsafe correction drags are rejected and original corrections remain intact",
  );
  await page.getByRole("button", { name: "지금 저장", exact: true }).click();
  await page.getByText(/자동 저장 · 저장됨/).waitFor();
  await page.screenshot({ path: "artifacts/usability-editor.png" });
  await page.getByRole("button", { name: "폰트 만들기 닫기" }).click();
  await page.getByRole("button", { name: "설정 열기" }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSON 내보내기", exact: false })
    .click();
  await (await download).saveAs("artifacts/usability-backup.json");
  await page.getByRole("button", { name: "설정 닫기" }).click();
  const fixture = JSON.parse(
      await readFile("artifacts/font-fixture.json", "utf8"),
    ),
    backup = JSON.parse(
      await readFile("artifacts/usability-backup.json", "utf8"),
    ),
    correction = backup.fontPreparation.separations["갛"];
  assert.deepEqual(backup.samples["갛"].strokes, fixture.samples["갛"].strokes);
  assert.ok(
    Math.abs(
      correction.strokes[0].points[1].x -
        fixture.samples["갛"].strokes[0].points[1].x -
        60,
    ) < 2,
  );
  assert.ok(
    Math.abs(
      correction.strokes[1].points[0].x -
        fixture.samples["갛"].strokes[1].points[0].x -
        40,
    ) < 2,
  );
  assert.deepEqual(correction.strokes[2], fixture.samples["갛"].strokes[2]);
  assert.deepEqual(
    correction.strokes[0].points.map((p) => [p.p, p.t]),
    fixture.samples["갛"].strokes[0].points.map((p) => [p.p, p.t]),
  );
  check(
    "group translation and local point edits save corrected vectors without mutating original pressure/time data",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "폰트 만들기 →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "1. 자모 확인·보정", exact: true })
    .click();
  await page.getByRole("option", { name: "갛 보정", exact: true }).click();
  assert.ok(
    await page
      .getByLabel("갛 자모 분리 화면", { exact: true })
      .locator('path[data-stroke-id="갛-cho"]')
      .getAttribute("d"),
  );
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.screenshot({ path: "artifacts/usability-tablet.png" });
  const modal = await page.locator(".font-workshop").boundingBox();
  assert.ok(modal.x >= 0 && modal.x + modal.width <= 821);
  await page
    .getByRole("button", { name: "2. 폰트 생성·다운로드", exact: true })
    .click();
  await page
    .getByRole("button", { name: "폰트 생성하기", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector(".font-download") ||
      document.querySelector(".font-error"),
    undefined,
    { timeout: 120000 },
  );
  assert.equal(await page.locator(".font-error").count(), 0);
  const fontDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "OTF 폰트 다운로드 ↓", exact: true })
    .click();
  await (await fontDownload).saveAs("artifacts/validation-edited.otf");
  const fontBytes = await readFile("artifacts/validation-edited.otf"),
    font = opentype.parse(
      fontBytes.buffer.slice(
        fontBytes.byteOffset,
        fontBytes.byteOffset + fontBytes.byteLength,
      ),
    );
  assert.equal(font.glyphs.length, 11175);
  check(
    "corrections survive reload, tablet layout fits, and edited vectors generate a valid full Hangul OTF",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    "artifacts/usability-results.json",
    JSON.stringify({ results, errors, external }, null, 2),
  );
} catch (error) {
  await page
    .screenshot({ path: "artifacts/usability-error.png" })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
