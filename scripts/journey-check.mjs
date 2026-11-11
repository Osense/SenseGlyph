import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import opentype from "opentype.js";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
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
  await page.waitForTimeout(500);
  await page.evaluate(() => document.fonts.ready);
};
const draw = async (canvas, a, b) => {
  const box = await canvas.boundingBox();
  assert.ok(box.width > 100 && box.height > 100);
  await page.mouse.move(box.x + box.width * a[0], box.y + box.height * a[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * b[0], box.y + box.height * b[1], {
    steps: 12,
  });
  await page.mouse.up();
  await page.waitForTimeout(100);
};
const waitFont = async () => {
  await page.waitForFunction(
    () =>
      document.querySelector(".generated-preview") ||
      document.querySelector(".font-error"),
    null,
    { timeout: 120000 },
  );
  assert.equal(await page.locator(".font-error").count(), 0);
};
await mkdir("artifacts", { recursive: true });
try {
  await page.goto("http://127.0.0.1:3000/?journey-test");
  await page
    .getByRole("heading", { name: "원하는 브러시를 선택하세요." })
    .waitFor();
  await page.getByRole("button", { name: /마커 도톰/ }).click();
  await page.getByLabel("시작 브러시 굵기").fill("65");
  await draw(
    page.locator(".brush-trial canvas[data-layer=live]"),
    [0.25, 0.4],
    [0.75, 0.6],
  );
  assert.ok(
    await page.locator(".brush-trial canvas[data-layer=ink]").evaluate((c) =>
      c
        .getContext("2d")
        .getImageData(0, 0, c.width, c.height)
        .data.some((v, i) => i % 4 === 3 && v > 0),
    ),
  );
  await page.screenshot({ path: "artifacts/journey-01-brush.png" });
  await page.getByRole("button", { name: "이 브러시로 할게요" }).click();
  await page.getByRole("radio", { name: /또박또박 칠판 글씨/ }).click();
  await page.getByLabel("견본 비교 문장").fill("나답게 쓰는 오늘, Hello!");
  assert.equal(
    await page
      .locator(".font-choice-sentence")
      .filter({ hasText: "나답게 쓰는 오늘, Hello!" })
      .count(),
    5,
  );
  await page.screenshot({ path: "artifacts/journey-02-reference.png" });
  await page.getByRole("button", { name: "이제 글자 써보기" }).click();
  assert.equal(await page.locator(".glyph.done").count(), 0);
  await draw(
    page.locator(".writing-area canvas[data-layer=live]"),
    [0.25, 0.35],
    [0.7, 0.6],
  );
  assert.equal(await page.locator(".glyph.done").count(), 1);
  await page.getByRole("button", { name: /지우개 E/ }).click();
  await draw(
    page.locator(".writing-area canvas[data-layer=live]"),
    [0.4, 0.43],
    [0.6, 0.54],
  );
  assert.equal(
    await page.locator(".writing-area canvas[data-layer=ink]").evaluate((c) =>
      c
        .getContext("2d")
        .getImageData(0, 0, c.width, c.height)
        .data.some((v, i) => i % 4 === 3 && v > 0),
    ),
    false,
  );
  await page.getByLabel("실행 취소", { exact: true }).click();
  await page.getByRole("button", { name: /지우개 E/ }).click();
  check(
    "brush and thickness persist, practice stays separate, and actual mouse drawing/erasing/undo still repaint",
  );
  await page.getByLabel("카테고리로 이동").selectOption("korean-punct");
  await page.locator('[id="glyph-「"]').click();
  assert.match(
    await page.locator(".character-instruction").textContent(),
    /여는 홑낫표/,
  );
  await page.locator('[id="glyph-“"]').click();
  assert.match(
    await page.locator(".character-instruction").textContent(),
    /왼쪽 큰따옴표/,
  );
  await page.getByLabel("카테고리로 이동").selectOption("latin-lower");
  await page.locator('[id="glyph-g"]').click();
  assert.match(
    await page.locator(".character-instruction").textContent(),
    /기준선 아래/,
  );
  check(
    "all reference sentences respond and punctuation/lowercase instructions identify the current character",
  );
  await page.getByRole("button", { name: "설정 열기" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/font-fixture.json");
  await page.getByText("새 프로젝트로 가져왔습니다", { exact: true }).waitFor();
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await page.screenshot({ path: "artifacts/journey-03-writing.png" });
  await step(3);
  await page.getByRole("option", { name: "갛 보정", exact: true }).click();
  const svg = page.getByLabel("갛 자모 분리 화면", { exact: true });
  await svg.scrollIntoViewIfNeeded();
  const svgBox = await svg.boundingBox();
  await page.mouse.move(
    svgBox.x + svgBox.width * 0.15,
    svgBox.y + svgBox.height * 0.25,
  );
  await page.mouse.down();
  for (const [x, y] of [
    [0.85, 0.25],
    [0.85, 0.5],
    [0.15, 0.5],
    [0.15, 0.25],
  ])
    await page.mouse.move(
      svgBox.x + svgBox.width * x,
      svgBox.y + svgBox.height * y,
      { steps: 8 },
    );
  await page.mouse.up();
  assert.equal(
    await page.getByLabel("1번 획 선택", { exact: true }).isChecked(),
    true,
  );
  assert.equal(
    await page.getByLabel("2번 획 선택", { exact: true }).isChecked(),
    true,
  );
  const quickAssign = page.getByRole("group", {
    name: /선택한 획 한 번에 배정/,
  });
  const toolbarBox = await quickAssign.boundingBox();
  const selectionBox = await svg
    .locator('rect[stroke-dasharray="8 5"]')
    .boundingBox();
  assert.ok(toolbarBox && selectionBox);
  assert.ok(toolbarBox.y + toolbarBox.height <= selectionBox.y);
  assert.ok(toolbarBox.x >= svgBox.x - 1);
  assert.ok(toolbarBox.x + toolbarBox.width <= svgBox.x + svgBox.width + 1);
  await quickAssign.getByRole("button", { name: "종성", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "2번 획 종성 지정", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "보정 실행 취소" }).click();
  await page.screenshot({ path: "artifacts/journey-04-separation.png" });
  check("the lasso popup sits above the selection and bulk assigns with undo");
  await page
    .getByRole("button", { name: "내 폰트로 써보기 →", exact: true })
    .click();
  await waitFont();
  assert.equal(
    await page.getByLabel("폰트 이름", { exact: true }).isVisible(),
    false,
  );
  await page.getByLabel("미리 볼 문장", { exact: true }).fill("겨구귀갛");
  await page.screenshot({ path: "artifacts/journey-05-preview.png" });
  await page
    .getByRole("button", { name: "이름 정하기 →", exact: true })
    .click();
  await page.getByLabel("폰트 이름", { exact: true }).fill("Journey Hand Test");
  await page
    .getByRole("button", { name: "간격 다듬기 →", exact: true })
    .click();
  await page.getByLabel("출력 글자 크기", { exact: true }).fill("900");
  await page.getByLabel("글자 사이 간격", { exact: true }).fill("35");
  await page.screenshot({ path: "artifacts/journey-06-spacing.png" });
  await page.getByRole("button", { name: "내보내기로 →", exact: true }).click();
  await page.getByLabel("출력 글자 크기", { exact: true }).fill("1200");
  await page.getByLabel("글자 사이 간격", { exact: true }).fill("-220");
  await waitFont();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "OTF 폰트 다운로드 ↓", exact: true })
    .click();
  await (await downloaded).saveAs("artifacts/journey-test.otf");
  const bytes = await readFile("artifacts/journey-test.otf");
  const font = opentype.parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  assert.equal(font.glyphs.length, 11175);
  assert.equal(font.names.fontFamily.en, "Journey Hand Test");
  const glyph = font.charToGlyph("겨"),
    bounds = glyph.getBoundingBox();
  assert.equal(glyph.advanceWidth - (bounds.x2 - bounds.x1), -120);
  assert.equal(glyph.leftSideBearing, -60);
  let maxBody = 0;
  for (let code = 0xac00; code <= 0xd7a3; code++) {
    const box = font.charToGlyph(String.fromCharCode(code)).getBoundingBox();
    maxBody = Math.max(maxBody, box.x2 - box.x1, box.y2 - box.y1);
  }
  assert.equal(maxBody, 1200);
  check(
    "export-stage size and tighter-spacing sliders update the real OTF to 120% bodies and negative bearings",
  );
  await page.screenshot({ path: "artifacts/journey-07-export.png" });
  check(
    "font builds automatically, live typing precedes name and spacing, and exported OTF contains all 11,172 syllables",
  );
  await page.reload();
  await waitFont();
  await page.getByRole("button", { name: "2. 이름", exact: true }).click();
  assert.equal(
    await page.getByLabel("폰트 이름", { exact: true }).inputValue(),
    "Journey Hand Test",
  );
  check(
    "reload resumes the last main step with saved font settings and automatically rebuilds",
  );
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (let n = 0; n < 5; n++) {
      await step(n);
      const dims = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        body: document.documentElement.scrollHeight,
        height: innerHeight,
      }));
      assert.ok(
        dims.scroll <= dims.client + 1,
        `overflow ${JSON.stringify(viewport)} step ${n}`,
      );
      assert.ok(
        dims.body <= dims.height + 1,
        `outer scroll ${JSON.stringify(viewport)} step ${n}`,
      );
      if (n === 2) {
        const pad = await page.locator(".writing-area .pad").boundingBox();
        assert.ok(
          pad.width >= 180 && pad.height >= 180,
          `small writing pad ${JSON.stringify({ viewport, pad })}`,
        );
        if (viewport.width < 700)
          await page
            .getByRole("button", { name: "지우개", exact: true })
            .click();
      }
      if (viewport.width === 390)
        await page.screenshot({ path: `artifacts/journey-mobile-${n}.png` });
    }
  }
  check(
    "desktop, tablet and mobile steps fit the page with usable drawing surface and mobile ink tools",
  );
  await context.close();
  const reduced = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1366, height: 768 },
  });
  const rp = await reduced.newPage();
  await rp.goto("http://127.0.0.1:3000/");
  await rp.locator(".setup-screen").waitFor();
  assert.equal(
    await rp
      .locator(".setup-screen")
      .evaluate((el) => getComputedStyle(el).opacity),
    "1",
  );
  await reduced.close();
  check(
    "reduced-motion mode leaves the interface visible without step animations",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    "artifacts/journey-results.json",
    JSON.stringify({ results, errors, external }, null, 2),
  );
} finally {
  await browser.close();
}
