// 왼손잡이 모드·단계 질문·측면 '다음 글자' 버튼 점검
import { chromium } from "playwright";
const BASE = process.env.SENSEGLYPH_URL ?? "http://127.0.0.1:3000";
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " · " + detail : ""}`);
};
const browser = await chromium.launch();
const run = async (left, viewport, label) => {
  const context = await browser.newContext({ locale: "ko-KR", viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "senseglyph-session",
      JSON.stringify({ name: "test", email: "", provider: "guest", since: 1 }),
    ),
  );
  await page.goto(BASE + "/?step=0");
  await page.waitForSelector(".setup-hand");
  await page.locator(".setup-hand [role=radio]").nth(left ? 1 : 0).click();
  check(
    `${label}: 손 고르기`,
    (await page.locator(".setup-hand [aria-checked=true] strong").innerText()) ===
      (left ? "왼손" : "오른손"),
  );
  await page.click(".journey-next");
  await page.waitForSelector(".sg-ask");
  check(`${label}: 도구 단계에서 묻기`, await page.locator(".sg-ask-yes").isVisible());
  await page.click(".sg-ask-no");
  check(`${label}: '아니요'면 그대로`, await page.locator(".setup-hand").isVisible());
  await page.click(".journey-next");
  await page.click(".sg-ask-yes");
  await page.waitForSelector(".setup-fonts");
  await page.click(".journey-next");
  await page.click(".sg-ask-yes");
  await page.waitForSelector(".sg-rail-next");
  if (await page.locator(".sg-tips").count())
    await page.click("text=건너뛰고 바로 쓰기");
  const rail = await page.locator(".sg-rail").boundingBox();
  const stage = await page.locator(".sg-stage").boundingBox();
  if (viewport.width > 1000)
    check(
      `${label}: 도구 줄이 ${left ? "오른쪽" : "왼쪽"}`,
      left ? rail.x > stage.x : rail.x < stage.x,
    );
  else {
    const next = await page.locator(".sg-rail-next").boundingBox();
    const middle = viewport.width / 2;
    check(
      `${label}: '다음 글자'가 ${left ? "오른쪽" : "왼쪽"} 끝`,
      left ? next.x > middle : next.x < middle,
    );
  }
  const before = await page.locator(".sg-char").innerText();
  await page.click(".sg-rail-next");
  const after = await page.locator(".sg-char").innerText();
  check(`${label}: 측면 '다음 글자'로 넘기기`, before !== after, `${before} → ${after}`);
  await page.screenshot({ path: `artifacts/hand-${label}.png` });
  await page.click(".sg-next-step").catch(() => {});
  if (await page.locator(".sg-ask").count()) {
    check(
      `${label}: 자모 나누기 전에 묻기`,
      (await page.locator("#sg-ask-question").innerText()).includes("자모"),
    );
    await page.click(".sg-ask-stop input");
    await page.click(".sg-ask-yes");
    await page.click('.sg-steps button:has-text("글자 쓰기")');
    await page.click(".sg-next-step");
    check(`${label}: '묻지 않기' 뒤에는 바로 넘어감`, (await page.locator(".sg-ask").count()) === 0);
  }
  check(`${label}: 브라우저 오류 없음`, errors.length === 0, errors.join(" / "));
  await context.close();
};
await run(false, { width: 1366, height: 900 }, "오른손-가로");
await run(true, { width: 1366, height: 900 }, "왼손-가로");
await run(true, { width: 820, height: 1180 }, "왼손-세로");
await run(false, { width: 820, height: 1180 }, "오른손-세로");
await browser.close();
process.exit(failed ? 1 : 0);
