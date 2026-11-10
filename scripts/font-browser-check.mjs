import { chromium } from "@playwright/test";
import opentype from "opentype.js";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1366, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [],
  external = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type()))
    console.log("BROWSER", message.type(), message.text());
});
page.on("request", (request) => {
  if (
    /^https?:/.test(request.url()) &&
    !request.url().startsWith("http://127.0.0.1:3000")
  )
    external.push(request.url());
});
const check = (text) => {
  results.push(text);
  console.log("PASS", text);
};
const waitForFont = async () => {
  await page.waitForFunction(
    () =>
      document.querySelector(".font-download") ||
      document.querySelector(".font-error"),
    undefined,
    { timeout: 180000 },
  );
  const error = (await page.locator(".font-error").count())
    ? await page.locator(".font-error").textContent()
    : "";
  if (error) throw Error(error);
};
await mkdir("artifacts", { recursive: true });
try {
  await page.goto("http://127.0.0.1:3000/?check=font");
  await page.getByRole("heading", { name: /겨.*쓰세요/ }).waitFor();
  const pad = await page.locator(".input-canvas").boundingBox();
  await page.mouse.move(pad.x + pad.width * 0.2, pad.y + pad.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(pad.x + pad.width * 0.5, pad.y + pad.height * 0.5, {
    steps: 15,
  });
  await page.mouse.up();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "폰트 만들기 →", exact: true })
    .click();
  await page.getByLabel("폰트 이름", { exact: true }).fill("Mouse Hand");
  await page
    .getByRole("button", { name: "폰트 생성하기", exact: true })
    .click();
  await waitForFont();
  const directDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "OTF 폰트 다운로드 ↓", exact: true })
    .click();
  await (await directDownload).saveAs("artifacts/validation-mouse.otf");
  const directBytes = await readFile("artifacts/validation-mouse.otf");
  const direct = opentype.parse(
    directBytes.buffer.slice(
      directBytes.byteOffset,
      directBytes.byteOffset + directBytes.byteLength,
    ),
  );
  assert.equal(direct.glyphs.length, 4);
  assert.ok(direct.charToGlyph("겨").path.commands.length > 3);
  assert.equal(direct.names.fontFamily.en, "Mouse Hand");
  await page.getByLabel("미리 볼 문장", { exact: true }).fill("겨 겨");
  assert.equal(
    await page.locator(".generated-preview .missing-glyph").count(),
    0,
  );
  check(
    "mouse drawing exports to a browser-loadable, parseable OTF with the written glyph",
  );
  await page.getByRole("button", { name: "폰트 만들기 닫기" }).click();

  await page.getByRole("button", { name: "설정 열기" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/font-fixture.json");
  await page.getByText("새 프로젝트로 가져왔습니다", { exact: true }).waitFor();
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await page
    .getByRole("button", { name: "폰트 만들기 →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "1. 자모 확인·보정", exact: true })
    .click();
  await page.getByRole("option", { name: "겨 보정", exact: true }).click();
  await page
    .getByRole("button", { name: "1번 획 중성 지정", exact: true })
    .click();
  await page.getByRole("button", { name: "폰트 만들기 닫기" }).click();
  await page.waitForTimeout(800);
  await page.reload();
  await page
    .getByRole("button", { name: "폰트 만들기 →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "1. 자모 확인·보정", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "1번 획 중성 지정", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByRole("button", { name: "이 글자 보정 초기화", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "1번 획 초성 지정", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.screenshot({
    path: "artifacts/font-separation.png",
    fullPage: true,
  });
  check(
    "manual component correction persists after reload and can return to automatic separation",
  );
  await page
    .getByRole("button", { name: "2. 폰트 생성·다운로드", exact: true })
    .click();
  await page.getByLabel("폰트 이름", { exact: true }).fill("나의 손글씨");
  const start = Date.now();
  await page
    .getByRole("button", { name: "폰트 생성하기", exact: true })
    .click();
  await waitForFont();
  const fullGenerationMs = Date.now() - start;
  const fullDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "OTF 폰트 다운로드 ↓", exact: true })
    .click();
  await (await fullDownload).saveAs("artifacts/validation-browser-hangul.otf");
  const bytes = await readFile("artifacts/validation-browser-hangul.otf");
  const font = opentype.parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  assert.equal(font.glyphs.length, 11175);
  for (let code = 0xac00; code <= 0xd7a3; code++)
    assert.ok(font.charToGlyphIndex(String.fromCharCode(code)) > 0);
  assert.equal(font.names.fontFamily.ko, "나의 손글씨");
  await page
    .getByLabel("미리 볼 문장", { exact: true })
    .fill("안녕하세요\n나의 글씨로 쓰는 새로운 이야기");
  assert.equal(
    await page.locator(".generated-preview .missing-glyph").count(),
    0,
  );
  assert.ok(
    await page.evaluate(() =>
      [...document.fonts].some(
        (font) =>
          font.family.startsWith("HanhoekPreview") && font.status === "loaded",
      ),
    ),
  );
  await page.screenshot({ path: "artifacts/font-export.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/font-export-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.equal(
    await page
      .locator(".font-workshop")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
  );
  const modalBounds = await page.locator(".font-workshop").boundingBox();
  assert.ok(modalBounds.x >= 0 && modalBounds.x + modalBounds.width <= 391);
  check(
    "worker generates all 11,172 syllables, loads the real OTF in FontFace and downloads it",
  );
  console.log("Full generation milliseconds:", fullGenerationMs);
  check("mobile export screen has no horizontal overflow");

  // Changes invalidate the generated font so users cannot download a stale result.
  await page.getByLabel("글자 사이 간격").fill("50");
  assert.equal(
    await page
      .getByRole("button", { name: "OTF 폰트 다운로드 ↓", exact: true })
      .count(),
    0,
  );
  check("changing font settings invalidates stale previews and downloads");
  await page.getByRole("button", { name: "폰트 만들기 닫기" }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
  });
  await page.goto("http://127.0.0.1:3000/");
  await page.getByRole("heading", { name: /겨.*쓰세요/ }).waitFor();
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "폰트 만들기 →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "폰트 생성하기", exact: true })
    .click();
  await waitForFont();
  check(
    "offline reload can launch the locally cached worker and generate an OTF",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  check("zero browser exceptions and external requests");
  await writeFile(
    "artifacts/font-browser-results.json",
    JSON.stringify(
      {
        results,
        fullGenerationMs,
        glyphs: font.glyphs.length,
        bytes: bytes.length,
        errors,
        external,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page
    .screenshot({ path: "artifacts/font-error.png", fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
