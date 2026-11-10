import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import opentype from "opentype.js";

const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    acceptDownloads: true,
  }),
  page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [],
  external = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:3000"))
    external.push(r.url());
});
const check = (message) => {
  results.push(message);
  console.log("PASS", message);
};
const waitForFont = async () => {
  await page.waitForFunction(
    () =>
      document.querySelector(".font-download") ||
      document.querySelector(".font-error"),
    undefined,
    { timeout: 120000 },
  );
  if (await page.locator(".font-error").count())
    throw Error(await page.locator(".font-error").textContent());
};
const downloadFont = async (path) => {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "OTF 폰트 다운로드 ↓", exact: true })
    .click();
  await (await pending).saveAs(path);
  const bytes = await readFile(path);
  return opentype.parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
};
await mkdir("artifacts", { recursive: true });
try {
  const project = JSON.parse(
    await readFile("artifacts/font-fixture.json", "utf8"),
  );
  project.fontPreparation = {
    separations: {},
    settings: {
      familyName: "Frame Fit Test",
      baseline: 800,
      letterSpacing: 0,
      includeComposed: true,
      bodySize: 840,
    },
  };
  for (const [char, sample] of Object.entries(project.samples)) {
    const assignments = {};
    for (const stroke of sample.strokes) {
      assignments[stroke.id] = stroke.id.split("-").at(-1);
      stroke.params.size *= 0.65;
      stroke.points = stroke.points.map((p) => ({
        ...p,
        x: 500 + (p.x - 500) * 0.65,
        y: 500 + (p.y - 500) * 0.65,
      }));
    }
    project.fontPreparation.separations[char] = {
      assignments,
      sourceUpdatedAt: sample.updatedAt,
    };
  }
  await writeFile(
    "artifacts/diamond-size-fixture.json",
    JSON.stringify(project),
  );
  await page.goto("http://127.0.0.1:3000/?check=font-layout");
  await page.getByRole("heading", { name: /겨.*쓰세요/ }).waitFor();
  await page.getByRole("button", { name: "설정 열기" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/diamond-size-fixture.json");
  await page.getByText("새 프로젝트로 가져왔습니다", { exact: true }).waitFor();
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await page
    .getByRole("button", { name: "폰트 만들기 →", exact: true })
    .click();
  const preview = page.getByLabel("간격 기준선 실시간 견본", { exact: true });
  const normalizationScale = Number(
    await preview.getAttribute("data-hangul-scale"),
  );
  assert.ok(normalizationScale > 1.5);
  assert.equal(await preview.getAttribute("data-body-size"), "840");
  await page
    .getByLabel("간격 기준선 견본 문장", { exact: true })
    .fill("겨구귀갛겪");
  await page.screenshot({ path: "artifacts/font-layout-comparison.png" });
  check(
    "diamond-sized input is enlarged automatically and input/output rows are visible before generation",
  );
  await page
    .getByRole("button", { name: "폰트 생성하기", exact: true })
    .click();
  await waitForFont();
  const font = await downloadFont("artifacts/validation-normalized.otf");
  assert.equal(font.glyphs.length, 11175);
  const dimensions = Object.keys(project.samples).map((char) => {
    const g = font.charToGlyph(char),
      b = g.getBoundingBox();
    return {
      char,
      width: b.x2 - b.x1,
      height: b.y2 - b.y1,
      gap: g.advanceWidth - (b.x2 - b.x1),
      lsb: g.leftSideBearing,
      x1: b.x1,
    };
  });
  assert.equal(
    Math.max(...dimensions.map((g) => Math.max(g.width, g.height))),
    840,
  );
  assert.ok(
    dimensions.every((g) => Math.abs(g.gap - 100) <= 1 && g.lsb === g.x1),
  );
  check(
    "the real full Hangul OTF uses 84% em bodies and consistent 100-unit visible edge spacing",
  );
  const originalHash = await preview.evaluate((canvas) => canvas.toDataURL());
  await page
    .getByRole("slider", { name: "출력 글자 크기", exact: true })
    .fill("940");
  await page
    .getByRole("slider", { name: "글자 사이 간격", exact: true })
    .fill("80");
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
  assert.notEqual(
    await preview.evaluate((canvas) => canvas.toDataURL()),
    originalHash,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "OTF 폰트 다운로드 ↓", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "폰트 생성하기", exact: true })
    .click();
  await waitForFont();
  const bigger = await downloadFont(
    "artifacts/validation-normalized-large.otf",
  );
  const larger = Object.keys(project.samples).map((char) => {
    const g = bigger.charToGlyph(char),
      b = g.getBoundingBox();
    return {
      width: b.x2 - b.x1,
      height: b.y2 - b.y1,
      gap: g.advanceWidth - (b.x2 - b.x1),
    };
  });
  assert.equal(
    Math.max(...larger.map((g) => Math.max(g.width, g.height))),
    940,
  );
  assert.ok(larger.every((g) => Math.abs(g.gap - 180) <= 1));
  check(
    "size and spacing sliders change the preview and the actual downloaded OTF by the same amounts",
  );
  await page.getByRole("button", { name: "폰트 만들기 닫기" }).click();
  await page.getByRole("button", { name: "설정 열기" }).click();
  const backupWait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSON 내보내기", exact: false })
    .click();
  await (await backupWait).saveAs("artifacts/normalization-backup.json");
  const backup = JSON.parse(
    await readFile("artifacts/normalization-backup.json", "utf8"),
  );
  assert.deepEqual(backup.samples, project.samples);
  assert.equal(backup.fontPreparation.settings.bodySize, 940);
  await page.getByRole("button", { name: "설정 닫기" }).click();
  check(
    "output normalization leaves original handwriting untouched and saves only output settings",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    "artifacts/font-layout-results.json",
    JSON.stringify(
      {
        results,
        scale: normalizationScale,
        dimensions,
        larger,
        errors,
        external,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page
    .screenshot({ path: "artifacts/font-layout-error.png" })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
