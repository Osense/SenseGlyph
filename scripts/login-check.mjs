// 첫 화면 로그인(목업)과 프로필 창 점검
import { chromium } from "playwright";
const BASE = process.env.SENSEGLYPH_URL ?? "http://127.0.0.1:3000";
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " · " + detail : ""}`);
};
const browser = await chromium.launch();
const context = await browser.newContext({
  locale: "ko-KR",
  viewport: { width: 1180, height: 820 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE + "/");
await page.waitForSelector(".sg-login-card");
await page.screenshot({ path: "artifacts/login.png" });
check(
  "첫 화면은 로그인 창",
  await page.locator(".sg-login-card h1").isVisible(),
);
await page.click(".sg-login-primary");
await page.waitForSelector(".sg-login", { state: "detached" });
check("구글 버튼으로 로그인(목업)", true);
await page.click(".sg-profile-button");
await page.waitForSelector(".sg-account");
check(
  "프로필에 이름·이메일",
  (await page.locator(".sg-account-head").innerText()).includes(
    "user@gmail.com",
  ),
);
for (const tab of ["내 폰트 라이브러리", "결제 내역"]) {
  await page.click(`.sg-account-tabs button:has-text("${tab}")`);
  await page.waitForTimeout(150);
}
await page.screenshot({ path: "artifacts/account.png" });
check(
  "결제 내역 예시 표",
  (await page.locator(".sg-account-table tbody tr").count()) === 2,
);
await page.click('.sg-account-tabs button:has-text("회원정보")');
await page.click(".sg-account-logout");
await page.waitForSelector(".sg-login-card");
check("로그아웃하면 로그인 창", true);
await page.click(".sg-login-guest");
await page.waitForSelector(".sg-login", { state: "detached" });
await page.reload();
await page.waitForTimeout(800);
check(
  "다시 열어도 로그인 유지",
  (await page.locator(".sg-login").count()) === 0,
);
check("브라우저 오류 없음", !errors.length, errors.join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
