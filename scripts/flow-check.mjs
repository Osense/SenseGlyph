// 새 작업 흐름 브라우저 점검: 태블릿 가로·세로 쓰기 칸 크기, 실제 마우스 필기,
// 점선 밖 획 보존, 자모 나누기·다듬기 화면, 폰트 생성, 다운로드·공유.
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
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    locale: "ko-KR",
  });
  const page = await context.newPage();
  // 로그인 화면(목업)은 건너뛴다
  await page.addInitScript(() =>
    localStorage.setItem(
      "senseglyph-session",
      JSON.stringify({ name: "test", email: "", provider: "guest", since: 1 }),
    ),
  );
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE + "/?step=2");
  await page.waitForSelector(".pad-sheet");
  check(
    `${label}: 처음 들어오면 쓰기 팁 애니메이션`,
    await page.locator(".sg-tips").isVisible(),
  );
  await page.click("text=건너뛰고 바로 쓰기");
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
  const padWidth = () =>
    page.evaluate(() =>
      Math.round(
        document.querySelector(".pad-sheet").getBoundingClientRect().height,
      ),
    );
  for (let i = 0; i < 4; i++)
    await page.click('button[aria-label="쓰기 칸 더 작게"]');
  await page.waitForTimeout(300);
  const small = await padWidth();
  const label2 = await page.locator(".sg-size-value b").innerText();
  check(
    `${label}: 칸 크기 −로 줄이기 (숫자 표시)`,
    small < pad.size * 0.8 && Math.abs(+label2 - small) <= 4,
    small + "px / 표시 " + label2,
  );
  const smaller = page.locator('button[aria-label="쓰기 칸 더 작게"]');
  for (let i = 0; i < 20 && (await smaller.isEnabled()); i++)
    await smaller.click();
  await page.waitForTimeout(300);
  const smallest = await padWidth();
  check(`${label}: 가장 작은 칸 140px`, smallest <= 142, smallest + "px");
  await page.click('.sg-size button:has-text("가득")');
  await page.waitForTimeout(200);
  check(`${label}: '가득'으로 되돌리기`, (await padWidth()) >= pad.size - 2);
  await context.close();
}

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
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(BASE + "/?step=2");
await page.waitForSelector(".input-canvas");
if (await page.locator(".sg-tips").count())
  await page.click("text=건너뛰고 바로 쓰기");
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
  await page.locator(".sg-tips >> text=자모 나누기 안내").isVisible(),
);
await page.click("text=건너뛰고 바로 시작");
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
await page.click(".fw-download");
check(
  "이름 없이 누르면 고칠 점 팝업",
  await page
    .locator(".fw-blockers >> text=한글 폰트 이름을 넣어주세요!")
    .isVisible(),
);
await page.click("text=확인하고 고치기");
await page.fill('[aria-label="한글 폰트 이름"]', "시험 글씨");
await page.fill('[aria-label="영문 폰트 이름"]', "TestHand");
check(
  "이름의 띄어쓰기는 빠지고 영문은 소문자",
  (await page.inputValue('[aria-label="한글 폰트 이름"]')) === "시험글씨" &&
    (await page.inputValue('[aria-label="영문 폰트 이름"]')) === "testhand",
);
await page.click('button:has-text("이름 중복 확인")');
await page.waitForSelector(".fw-name-check .is-ok");
check("새 이름은 사용 가능", true);
await page.fill('[aria-label="한글 폰트 이름"]', "나눔 고딕");
await page.click('button:has-text("이름 중복 확인")');
check(
  "이미 있는 폰트 이름은 막기",
  await page
    .locator(".fw-name-check >> text=이미 있는 이름입니다.")
    .isVisible(),
);
check("견본 글꼴 대체 경고", await page.locator(".fw-fallback").isVisible());
check("출력 구성 구분 없음", !(await page.locator("text=프리미엄").count()));
await page.fill('[aria-label="한글 폰트 이름"]', "시험글씨");
await page.fill('[aria-label="영문 폰트 이름"]', "TestHand");
// Headless Chromium reports "download" for non-ASCII names; check the bytes instead.
const size = async (download) => statSync(await download.path()).size;
// 다운로드를 누르면 결제창(목업)이 뜨고, 코드 '권오현'으로 내려받는다.
await page.click(".fw-download");
await page.waitForSelector(".sg-pay");
check("다운로드 전 결제창", await page.locator(".sg-pay-button").isVisible());
await page.click(".sg-pay-agree input");
await page.click(".sg-pay-button");
await page.waitForSelector(".sg-pay-notice", { timeout: 5000 });
check("결제는 준비 중 안내", true);
await page.fill("#sg-pay-code", "틀린코드");
await page.click('.sg-pay-code button[type="submit"]');
check(
  "틀린 코드는 거절",
  await page.locator(".sg-pay-code .fw-error").isVisible(),
);
await page.fill("#sg-pay-code", "권오현");
const [first] = await Promise.all([
  page.waitForEvent("download", { timeout: 180000 }),
  page.click('.sg-pay-code button[type="submit"]'),
]);
check(
  "코드 없이 바로 다운로드 (기본 TTF)",
  (await size(first)) > 1000,
  first.suggestedFilename(),
);
check(
  "기본 선택은 TTF",
  /\.ttf 다운로드/.test(await page.locator(".fw-download").innerText()),
);
check(
  "다운로드 코드 창 없음",
  !(await page.locator("text=다운로드 코드").count()),
);
await page.click('.fw-formats label:has-text("OTF")');
const [second] = await Promise.all([
  page.waitForEvent("download", { timeout: 180000 }),
  page.click(".fw-download"),
]);
check("OTF 다운로드", (await size(second)) > 1000, second.suggestedFilename());
await page.click('.fw-formats label:has-text("굵기 3종 ZIP")');
const [weights] = await Promise.all([
  page.waitForEvent("download", { timeout: 300000 }),
  page.click(".fw-download"),
]);
{
  const { unzipSync } = await import("fflate");
  const { readFileSync } = await import("node:fs");
  const files = Object.keys(
    unzipSync(new Uint8Array(readFileSync(await weights.path()))),
  );
  check(
    "굵기 3종 ZIP (가는·보통·굵은 TTF·OTF)",
    files.length === 7 &&
      ["Light", "Regular", "Bold"].every((s) =>
        files.some((f) => f.endsWith("-" + s + ".ttf")),
      ),
    files.join(", "),
  );
}
await page.click('.fw-formats label:has-text("TTF")');
check(
  "안드로이드 설치 불가 안내",
  await page
    .locator("text=안드로이드 휴대폰·태블릿에서는 폰트를 직접 설치할 수 없어요")
    .isVisible(),
);
// 공유를 지원하지 않는 브라우저: 대신 보내는 방법을 안내
await page.evaluate(() => {
  Object.defineProperty(navigator, "canShare", {
    value: () => false,
    configurable: true,
  });
});
await page.click(".fw-share");
check(
  "공유 미지원 기기 안내",
  await page
    .locator("text=이 기기에서는 폰트 파일을 바로 공유할 수 없어요")
    .isVisible(),
);
await page.click('.font-flow-dialog button:has-text("닫기")');
// 공유를 지원하는 브라우저: 변환 후 공유 창으로 파일 전달
await page.evaluate(() => {
  Object.defineProperty(navigator, "canShare", {
    value: () => true,
    configurable: true,
  });
  Object.defineProperty(navigator, "share", {
    value: async (data) => {
      window.__shared = data.files[0].name + ":" + data.files[0].size;
    },
    configurable: true,
  });
});
await page.click(".fw-share");
await page.waitForSelector("text=보낼 준비가 됐어요", { timeout: 120000 });
await page.click('.font-flow-dialog button:has-text("공유하기")');
await page.waitForTimeout(300);
const shared = await page.evaluate(() => window.__shared ?? "");
check("공유 창으로 폰트 파일 전달", /\.ttf:\d{4,}/.test(shared), shared);
await page.screenshot({ path: "artifacts/flow-export.png", fullPage: true });
// 결제 후에는 잠기고, 고치려면 새 프로젝트로 복제한다.
check("결제 후 잠금 안내", await page.locator(".sg-locked-bar").isVisible());
check(
  "결제 후 이름 고정",
  await page
    .locator('[aria-label="한글 폰트 이름"]')
    .evaluate((el) => el.readOnly),
);
check(
  "결제한 폰트는 결제창 없이 다시 받기",
  await page.locator(".fw-purchased").isVisible(),
);
await page.click(".sg-locked-bar button");
await page.waitForSelector(".sg-rename-copy");
const copyName = await page.locator(".sg-rename-copy input").inputValue();
check(
  "결제한 프로젝트 이름에 폰트 이름 기록",
  / - .+의 복사본$/.test(copyName),
);
await page.fill(".sg-rename-copy input", "고친 손글씨");
await page.click('.sg-rename-copy button[type="submit"]');
await page.waitForTimeout(500);
check("복제하면 잠금 해제", !(await page.locator(".sg-locked-bar").count()));
check("브라우저 오류 없음", !errors.length, errors.join(" | "));
await browser.close();
writeFileSync("artifacts/flow-results.json", JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exit(1);
