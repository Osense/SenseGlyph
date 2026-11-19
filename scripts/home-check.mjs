// 메인 화면(내 폰트 목록) 점검: 처음엔 목록, 최근 작업 '이어서 하기'로 마지막 글자로, 복제·이름 바꾸기·삭제
import { chromium } from "playwright";
const BASE = process.env.SENSEGLYPH_URL ?? "http://127.0.0.1:3000";
let failed = false;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed = true;
};
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1180, height: 820 },
  locale: "ko-KR",
});
await page.addInitScript(() => {
  localStorage.setItem(
    "senseglyph-session",
    JSON.stringify({ name: "test", email: "", provider: "guest", since: 1 }),
  );
  localStorage.setItem("senseglyph-writing-tips-v1", "1");
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE + "/");
await page.waitForSelector(".sg-home");
check(
  "처음 들어오면 메인 화면(목록)",
  await page.locator(".sg-home h1").isVisible(),
);
check(
  "아직 작업이 없으면 빈 안내",
  (await page.locator(".sg-home-recent").count()) === 0,
);
// 글씨를 쓰고 세 번째 글자까지 넘긴다
await page.goto(BASE + "/?step=2");
await page.waitForSelector(".input-canvas");
if (await page.locator(".sg-tips").count())
  await page.click("text=건너뛰고 바로 쓰기");
const box = await page.locator(".input-canvas").boundingBox();
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
await page.mouse.down();
for (let i = 1; i <= 12; i++)
  await page.mouse.move(
    box.x + box.width * (0.3 + i * 0.03),
    box.y + box.height * (0.3 + i * 0.03),
  );
await page.mouse.up();
await page.waitForTimeout(300);
await page.click(".sg-tool-next");
await page.waitForTimeout(200);
await page.click(".sg-tool-next");
await page.waitForTimeout(300);
const lastChar = (await page.locator(".sg-stage .sg-char").innerText()).trim();
await page.waitForTimeout(1200);
// 다시 처음으로 들어오면 목록, 최근 작업 강조
await page.goto(BASE + "/");
await page.waitForSelector(".sg-home-recent");
const where = await page.locator(".sg-home-recent .sg-home-where").innerText();
check("최근 작업 강조 카드와 마지막 자리", where.includes(lastChar), where);
await page.screenshot({ path: "artifacts/home.png" });
await page.click(".sg-home-resume");
await page.waitForSelector(".input-canvas");
const resumed = (await page.locator(".sg-stage .sg-char").innerText()).trim();
check(
  "이어서 하기로 쓰던 글자로 돌아감",
  resumed === lastChar,
  `${resumed} / ${lastChar}`,
);
// 머리글 '내 폰트'를 누르면 메인 화면 (로고는 WSNS studio 홈페이지로 이동)
await page.click('.sg-top-button:has-text("내 폰트")');
await page.waitForSelector(".sg-home-recent");
// 복제
await page.click(".sg-home-recent .sg-home-menu");
await page.click('[role="menuitem"]:has-text("복제")');
await page.waitForSelector(".sg-home-list article");
check(
  "복제하면 목록에 추가",
  (await page.locator(".sg-home-list article").count()) === 1,
);
// 이름 바꾸기(복제본)
await page.click(".sg-home-list article .sg-home-menu");
await page.click('[role="menuitem"]:has-text("이름 바꾸기")');
await page.fill(".sg-home-rename", "새 이름 테스트");
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
const renamed = await page.locator(".sg-home-name").allInnerTexts();
await page.screenshot({ path: "artifacts/home-rename.png" });
check(
  "이름 바꾸기",
  renamed.some((n) => n.includes("새 이름 테스트")),
  renamed.join(" / "),
);
// 삭제
await page.click(".sg-home-list article .sg-home-menu");
await page.click('[role="menuitem"]:has-text("삭제")');
await page.click(".sg-home-delete-confirm");
await page.waitForTimeout(600);
check("삭제", (await page.locator(".sg-home-list article").count()) === 0);
check("브라우저 오류 없음", !errors.length, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
