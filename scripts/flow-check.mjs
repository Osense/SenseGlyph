// 새 작업 흐름 브라우저 점검: 태블릿 가로·세로 쓰기 칸 크기, 실제 마우스 필기,
// 점선 밖 획 보존, 자모 나누기·다듬기 화면, 폰트 생성, 다운로드 코드.
// 사용: npm run build && npm start (다른 터미널) → npm run test:flow
import { chromium } from "playwright";
import { mkdirSync, statSync, writeFileSync } from "node:fs";

const BASE = process.env.SENSEGLYPH_URL ?? "http://127.0.0.1:3000";
mkdirSync("artifacts", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " · " + detail : ""}`);
};
const browser = await chromium.launch();
const errors = [];

for (const [label, viewport] of [
  ["tablet-landscape", { width: 1180, height: 820 }],
  ["tablet-portrait", { width: 820, height: 1180 }],
]) {
  const context = await browser.newContext({ viewport, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE + "/?step=2");
  await page.waitForSelector(".pad-sheet");
  await page.waitForTimeout(600);
  const pad = await page.evaluate(() => {
    const r = document.querySelector(".pad-sheet").getBoundingClientRect();
    return {
      size: Math.round(r.width),
      overflow: document.documentElement.scrollHeight > innerHeight + 1,
    };
  });
  check(
    `${label}: 쓰기 칸이 화면 높이의 절반 이상`,
    pad.size >= viewport.height * 0.5 || pad.size >= viewport.width * 0.75,
    pad.size + "px",
  );
  check(`${label}: 페이지가 화면 밖으로 넘치지 않음`, !pad.overflow);
  await page.screenshot({ path: `artifacts/flow-${label}.png` });
  await page.click('.sg-size button:has-text("더 작게")');
  await page.waitForTimeout(300);
  const small = await page.evaluate(() =>
    Math.round(
      document.querySelector(".pad-sheet").getBoundingClientRect().width,
    ),
  );
  check(`${label}: 칸 크기 '더 작게'`, small < pad.size * 0.7, small + "px");
  await page.click('.sg-size button:has-text("채우기")');
  await context.close();
}

const context = await browser.newContext({
  viewport: { width: 1180, height: 820 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(BASE + "/?step=2");
await page.waitForSelector(".input-canvas");
let seed = 3;
const jitter = () =>
  ((seed = (seed * 9301 + 49297) % 233280) / 233280 - 0.5) * 6;
async function stroke(points) {
  const box = await page.locator(".input-canvas").boundingBox();
  const px = ([x, y]) => [
    box.x + (x / 1000) * box.width,
    box.y + (y / 1000) * box.height,
  ];
  await page.mouse.move(...px(points[0]));
  await page.mouse.down();
  for (let i = 1; i < points.length; i++)
    for (let t = 1; t <= 12; t++) {
      const [a, b] = [points[i - 1], points[i]];
      await page.mouse.move(
        ...px([
          a[0] + ((b[0] - a[0]) * t) / 12 + jitter(),
          a[1] + ((b[1] - a[1]) * t) / 12 + jitter(),
        ]),
      );
    }
  await page.mouse.up();
  await page.waitForTimeout(80);
}
const glyphs = {
  겨: [
    [
      [230, 300],
      [470, 270],
      [430, 700],
    ],
    [
      [580, 240],
      [610, 780],
    ],
    [
      [460, 420],
      [590, 440],
    ],
    [
      [450, 560],
      [590, 590],
    ],
  ],
  구: [
    [
      [300, 330],
      [700, 300],
      [680, 470],
    ],
    [
      [200, 560],
      [800, 600],
    ],
    [
      [505, 580],
      [480, 800],
    ],
  ],
};
for (const [char, strokes] of Object.entries(glyphs)) {
  await page.click(`#glyph-${char}`);
  await page.waitForTimeout(250);
  for (const points of strokes) await stroke(points);
}
// A stroke that runs past the dotted line is kept (with a notice), not discarded.
await page.click("#glyph-귀");
await page.waitForTimeout(250);
await stroke([
  [500, 200],
  [520, 990],
]);
const kept = await page.locator(".sg-check-head span").innerText();
check("점선 밖으로 나간 획도 저장", kept.startsWith("1"), kept);
check("점선 밖 획 알림 표시", await page.locator(".pad-warning").isVisible());
await page.waitForTimeout(900);

await page.click('.sg-steps button:has-text("자모 나누기")');
await page.waitForSelector(".separation-editor");
check(
  "자모 나누기 화면",
  await page.locator(".sg-sep-char strong").isVisible(),
);
check(
  "처음 들어오면 사용법 애니메이션",
  await page.locator(".sg-tutorial").isVisible(),
);
await page.click("text=알겠어요");
const fits = await page.evaluate(
  () =>
    document.querySelector(".sg-sep-main").getBoundingClientRect().bottom <=
    innerHeight,
);
check("자모 나누기 작업 영역이 한 화면에 들어옴", fits);
await page.locator(".separation-svg path[data-stroke-id]").nth(1).click();
check(
  "획을 누르면 초·중·종성 버튼",
  await page.locator(".quick-assign").isVisible(),
);
check(
  "이대로 좋아요 버튼 없음",
  !(await page.locator("text=이대로 좋아요").count()),
);
await page.click("text=이 글자 다시 쓰기");
await page.waitForSelector(".sg-rewrite .input-canvas");
{
  const box = await page.locator(".sg-rewrite .input-canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.52, {
    steps: 8,
  });
  await page.mouse.up();
}
await page.click("text=다 썼어요 · 자모 나누기로");
check(
  "다시 쓰고 자모 나누기로 바로 돌아옴",
  !(await page.locator(".sg-rewrite").count()) &&
    (await page.locator(".separation-editor").isVisible()),
);
await page.click('.sg-steps button:has-text("폰트 완성")');
await page.waitForSelector(".fw-preview canvas");
await page.fill('[aria-label="미리 볼 문장"]', "겨구귀");
await page.click('.fw-card button:has-text("단정하게")');
await page.waitForTimeout(800);
check(
  "정돈 미리보기",
  await page.locator(".fw-preview figure.is-corrected").isVisible(),
);
await page.screenshot({ path: "artifacts/flow-refine.png", fullPage: true });
await page.click('button:has-text("폰트 만들기 →")');
await page.waitForSelector(".fw-badge.is-ok", { timeout: 180000 });
check("폰트 생성 완료", true);
check(
  "결제·가격 문구 없음",
  !(await page.content()).match(/원\s*·|프로모션|19,900|29,900/),
);
check(
  "이름 칸은 비어 있고 안내 문구만",
  (await page.inputValue('[aria-label="한글 폰트 이름"]')) === "" &&
    (await page.getAttribute(
      '[aria-label="한글 폰트 이름"]',
      "placeholder",
    )) === "여기에 이름을 넣어주세요!",
);
check(
  "이름 없이는 다운로드 비활성",
  await page.locator(".fw-download").isDisabled(),
);
check("견본 글꼴 대체 경고", await page.locator(".fw-fallback").isVisible());
check("출력 구성 구분 없음", !(await page.locator("text=프리미엄").count()));
await page.fill('[aria-label="한글 폰트 이름"]', "시험글씨");
await page.fill('[aria-label="영문 폰트 이름"]', "TestHand");
await page.click(".fw-download");
await page.fill('[aria-label="다운로드 코드"]', "아무거나");
await page.click("text=확인하고 내려받기");
check("틀린 코드 거절", await page.locator(".fw-code .fw-error").isVisible());
await page.fill('[aria-label="다운로드 코드"]', " osns ");
const [first] = await Promise.all([
  page.waitForEvent("download", { timeout: 180000 }),
  page.click("text=확인하고 내려받기"),
]);
// Headless Chromium reports "download" for non-ASCII names; check the bytes instead.
const size = async (download) => statSync(await download.path()).size;
check(
  "코드 확인 후 다운로드",
  (await size(first)) > 1000,
  first.suggestedFilename(),
);
await page.click('.fw-formats label:has-text("OTF")');
const [second] = await Promise.all([
  page.waitForEvent("download", { timeout: 180000 }),
  page.click(".fw-download"),
]);
check(
  "같은 탭에서는 코드를 다시 묻지 않음",
  (await size(second)) > 1000,
  second.suggestedFilename(),
);
await page.screenshot({ path: "artifacts/flow-export.png", fullPage: true });
check("브라우저 오류 없음", !errors.length, errors.join(" | "));
await browser.close();
writeFileSync("artifacts/flow-results.json", JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exit(1);
