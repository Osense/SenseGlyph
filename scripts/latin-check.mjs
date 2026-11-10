import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import opentype from "opentype.js";

const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    acceptDownloads: true,
  }),
  page = await context.newPage();
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
await mkdir("artifacts", { recursive: true });
try {
  await page.goto("http://127.0.0.1:3000/?check=latin");
  await page.getByRole("heading", { name: /겨.*쓰세요/ }).waitFor();
  await page
    .getByLabel("카테고리로 이동", { exact: true })
    .selectOption("latin-lower");
  await page.locator('[id="glyph-g"]').click();
  await page.getByRole("heading", { name: /g.*쓰세요/ }).waitFor();
  await page.getByRole("button", { name: "마커", exact: true }).click();
  await page.getByRole("slider", { name: "펜 굵기", exact: true }).fill("40");
  const pad = await page.locator(".input-canvas").boundingBox();
  await page.mouse.move(pad.x + pad.width * 0.4, pad.y + pad.height * 0.93);
  await page.mouse.down();
  await page.mouse.move(pad.x + pad.width * 0.43, pad.y + pad.height * 0.97, {
    steps: 8,
  });
  await page.mouse.up();
  await frames();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  assert.equal(
    await page.locator('[id="glyph-g"]').getAttribute("data-unsafe"),
    "false",
  );
  assert.equal(
    await page.locator('[id="glyph-g"]').getAttribute("data-review"),
    "false",
  );
  assert.equal(await page.locator(".pad-warning").count(), 0);
  await page.getByLabel("영문 기호 기준선 가이드", { exact: true }).waitFor();
  check(
    "a handwritten g descender below the Hangul boundary is saved and not marked red",
  );
  await page.mouse.click(pad.x + pad.width * 0.5, pad.y + pad.height * 0.999);
  await page.getByRole("alert").filter({ hasText: "안전영역" }).waitFor();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  await page.getByRole("button", { name: "다시 그리기", exact: true }).click();
  check("truly out-of-bounds English strokes are still rejected");
  const referenceStats = [];
  for (const name of [
    "단정한 고딕",
    "또렷한 명조",
    "부드러운 고운돋움",
    "편안한 손글씨",
    "자유로운 붓글씨",
  ]) {
    await page.getByRole("radio", { name: new RegExp(name) }).click();
    await page.evaluate(() => document.fonts.ready);
    await frames();
    const bounds = await page
      .locator('[data-layer="sample"]')
      .evaluate((canvas) => {
        const { width: w, height: h } = canvas,
          data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
        let left = 1000,
          right = 0,
          top = 1000,
          bottom = 0;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            if (data[(y * w + x) * 4 + 3] > 0) {
              left = Math.min(left, (x * 1000) / w);
              right = Math.max(right, ((x + 1) * 1000) / w);
              top = Math.min(top, (y * 1000) / h);
              bottom = Math.max(bottom, ((y + 1) * 1000) / h);
            }
        return { left, right, top, bottom };
      });
    assert.ok(
      bounds.top >= 39 &&
        bounds.bottom <= 991 &&
        bounds.left >= 39 &&
        bounds.right <= 961,
      name + " sample exceeds Latin limits " + JSON.stringify(bounds),
    );
    referenceStats.push({ name, ...bounds });
  }
  await page.screenshot({ path: "artifacts/latin-descender.png" });
  check(
    "all five English reference fonts fit the Latin safety area with a visible descender guide",
  );
  await page
    .getByLabel("카테고리로 이동", { exact: true })
    .selectOption("ascii-symbol");
  await page.locator('[id="glyph-,"]').click();
  const symbolPad = await page.locator(".input-canvas").boundingBox();
  await page.mouse.move(
    symbolPad.x + symbolPad.width * 0.5,
    symbolPad.y + symbolPad.height * 0.95,
  );
  await page.mouse.down();
  await page.mouse.move(
    symbolPad.x + symbolPad.width * 0.48,
    symbolPad.y + symbolPad.height * 0.97,
    { steps: 6 },
  );
  await page.mouse.up();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  assert.equal(
    await page.locator('[id="glyph-,"]').getAttribute("data-unsafe"),
    "false",
  );
  await page.screenshot({ path: "artifacts/symbol-safety.png" });
  check("low commas use a symbol safety area and are not falsely flagged");
  await page
    .getByRole("button", { name: "폰트 만들기 →", exact: true })
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
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "OTF 폰트 다운로드 ↓", exact: true })
    .click();
  await (await download).saveAs("artifacts/validation-descenders.otf");
  const bytes = await readFile("artifacts/validation-descenders.otf"),
    font = opentype.parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
  assert.ok(font.charToGlyph("g").getBoundingBox().y1 < -150);
  assert.ok(font.charToGlyph(",").getBoundingBox().y1 < -150);
  assert.ok(font.descender <= -200);
  check(
    "the real OTF preserves g and comma outlines below the baseline without clipping",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    "artifacts/latin-results.json",
    JSON.stringify({ results, referenceStats, errors, external }, null, 2),
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/latin-error.png" }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
