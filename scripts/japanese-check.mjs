// 일본어 폰트 만들기 흐름 점검: 첫 화면 언어 선택 → 가나·한자 쓰기 → 폰트 완성 → TTF 내려받기
// 사용: npm run build && node scripts/serve.mjs (다른 터미널) → node scripts/japanese-check.mjs
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import opentype from "opentype.js";

const BASE = process.env.SENSEGLYPH_URL ?? "http://127.0.0.1:3000";
mkdirSync("artifacts", { recursive: true });
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " · " + detail : ""}`);
};
const browser = await chromium.launch();
const context = await browser.newContext({
  locale: "ko-KR",
  viewport: { width: 1180, height: 820 },
  acceptDownloads: true,
});
const page = await context.newPage();
// 로그인 화면(목업)은 건너뛴다
await page.addInitScript(() =>
  localStorage.setItem(
    "senseglyph-session",
    JSON.stringify({ name: "test", email: "", provider: "guest", since: 1 }),
  ),
);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(BASE + "/?step=0");
await page.waitForSelector(".setup-script");
await page.click('.setup-script [role="radio"]:has-text("日本語")');
await page.waitForTimeout(300);
check(
  "첫 화면에서 일본어 선택",
  (await page.getAttribute(
    '.setup-script [role="radio"]:has-text("日本語")',
    "aria-checked",
  )) === "true",
);
const steps = await page.locator(".sg-steps button").allInnerTexts();
check(
  "자모 나누기 단계 없음",
  !steps.join(" ").includes("자모"),
  steps.length + "단계",
);
await page.click(".journey-next");
await page.waitForSelector(".sg-ask");
check(
  "다음 단계 전에 묻기",
  (await page.locator("#sg-ask-question").innerText()).includes("이 도구로"),
);
await page.click(".sg-ask-yes");
await page.waitForSelector(".setup-fonts");
const fonts = await page.locator(".setup-fonts [role=radio]").allInnerTexts();
check("일본어 견본 3가지", fonts.length === 3 && /Klee One/.test(fonts[0]));
await page.click(".journey-next");
await page.click(".sg-ask-yes");
await page.waitForSelector(".input-canvas");
if (await page.locator(".sg-tips").count())
  await page.click("text=건너뛰고 바로 쓰기");
check("첫 글자는 あ", (await page.locator(".sg-char").innerText()) === "あ");
const lists = await page.locator(".sg-lists button").allInnerTexts();
check(
  "목록: ひらがな·カタカナ·漢字",
  ["ひらがな", "カタカナ", "필체 한자"].every((l) =>
    lists.some((x) => x.includes(l)),
  ),
  lists.map((l) => l.split("\n")[0]).join(" / "),
);
async function stroke(points) {
  const box = await page.locator(".input-canvas").boundingBox();
  const px = ([x, y]) => [
    box.x + (x / 1000) * box.width,
    box.y + (y / 1000) * box.height,
  ];
  await page.mouse.move(...px(points[0]));
  await page.mouse.down();
  for (let i = 1; i < points.length; i++)
    for (let t = 1; t <= 10; t++) {
      const [a, b] = [points[i - 1], points[i]];
      await page.mouse.move(
        ...px([
          a[0] + ((b[0] - a[0]) * t) / 10,
          a[1] + ((b[1] - a[1]) * t) / 10,
        ]),
      );
    }
  await page.mouse.up();
  await page.waitForTimeout(80);
}
// あ
await stroke([
  [250, 330],
  [720, 300],
]);
await stroke([
  [450, 180],
  [520, 800],
]);
await stroke([
  [600, 420],
  [300, 780],
  [260, 600],
  [700, 560],
  [760, 760],
]);
await page.screenshot({ path: "artifacts/ja-write.png" });
await page.click('.sg-tool-next');
await page.waitForTimeout(200);
check("다음 글자 い", (await page.locator(".sg-char").innerText()) === "い");
await stroke([
  [300, 300],
  [320, 700],
  [380, 760],
]);
await stroke([
  [650, 330],
  [700, 650],
]);
// 一 (필체 한자 목록)
await page.click('.sg-lists button:has-text("필체 한자")');
await page.waitForTimeout(200);
const kanji = await page.locator(".sg-char").innerText();
check("한자 목록은 필체 한자는 永부터", kanji === "永", kanji);
await stroke([
  [150, 500],
  [850, 490],
]);
await page.click('.sg-steps button:has-text("폰트 완성")');
await page.waitForSelector(".fw-preview canvas");
check(
  "단계 번호 04",
  (await page.locator(".fw-head .step-kicker").innerText()).startsWith("04"),
);
await page.click('button:has-text("폰트 만들기 →")');
await page.waitForSelector(".fw-badge.is-ok", { timeout: 240000 });
check("일본어 폰트 생성 완료", true);
await page.fill('[aria-label="일본어 폰트 이름"]', "わたしの字");
await page.fill('[aria-label="영문 폰트 이름"]', "MyHand");
await page.screenshot({ path: "artifacts/ja-output.png", fullPage: true });
await page.click(".fw-download");
await page.waitForSelector(".sg-pay");
await page.fill("#sg-pay-code", "권오현");
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 180000 }),
  page.click('.sg-pay-code button[type="submit"]'),
]);
const buffer = readFileSync(await download.path());
const font = opentype.parse(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
);
check(
  "일본어 이름",
  font.names.fontFamily.ja === "WSNS わたしの字",
  font.names.fontFamily.ja,
);
const has = (c) => font.charToGlyphIndex(c) > 0;
check(
  "쓴 글자 + 견본으로 채운 가나·상용한자",
  ["あ", "い", kanji, "ん", "ア", "国", "曜"].every(has),
  `${font.numGlyphs} glyphs · ` +
    ["あ", "い", kanji, "ん", "ア", "国", "曜"]
      .map((c) => c + has(c))
      .join(" "),
);
const square = font.charToGlyph("あ").advanceWidth;
check(
  "가나·한자·견본 글자 모두 전각",
  ["い", kanji, "ん", "国", "、"].every(
    (c) => font.charToGlyph(c).advanceWidth === square,
  ),
);
check("한글 없음", !has("가"));
check("브라우저 오류 없음", !errors.length, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
