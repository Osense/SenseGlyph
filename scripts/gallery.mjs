// 디자인 점검용 화면 모음 캡처: node scripts/gallery.mjs [출력폴더] [뷰포트들]
import { chromium } from "playwright";
const BASE = process.env.SENSEGLYPH_URL ?? "http://127.0.0.1:3000";
const out = process.argv[2] ?? "/tmp/gal";
const only = (process.argv[3] ?? "tab,port,phone").split(",");
const views = {
  tab: { width: 1180, height: 820 },
  port: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
};
const browser = await chromium.launch();
for (const v of only) {
  for (const dark of [false, true]) {
    const context = await browser.newContext({
      viewport: views[v],
      locale: "ko-KR",
      hasTouch: v !== "tab",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("ERR", v, e.message));
    const tag = `${out}/${v}${dark ? "-dark" : ""}`;
    await page.goto(BASE + "/");
    await page.waitForTimeout(1200);
    if (!dark) await page.screenshot({ path: `${tag}-login.png` });
    await page.evaluate((dark) => {
      localStorage.setItem(
        "senseglyph-session",
        JSON.stringify({
          name: "오현",
          email: "",
          provider: "guest",
          since: 1,
        }),
      );
      localStorage.setItem(
        "hanhoek-ui",
        JSON.stringify({
          dark,
          hand: "right",
          askSteps: false,
          theme: "osns-light",
          journeyVersion: 2,
        }),
      );
      localStorage.setItem("senseglyph-writing-tips-v1", "1");
    }, dark);
    for (const step of [0, 1, 2, 3, 4]) {
      await page.goto(BASE + "/?step=" + step);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${tag}-step${step}.png` });
    }
    if (v === "tab") {
      await page.goto(BASE + "/?step=2");
      await page.waitForTimeout(1200);
      for (const [name, open] of [
        ["settings", 'button[aria-label="설정 열기"]'],
        ["tools", '.sg-rail button:has-text("도구 설정")'],
        ["account", ".sg-profile-button"],
        ["projects", 'button:has-text("내 폰트")'],
      ]) {
        await page.click(open);
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${tag}-dlg-${name}.png` });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
      }
    }
    await context.close();
  }
}
await browser.close();
