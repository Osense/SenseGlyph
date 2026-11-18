// 휴대폰 세로 점검: 단계마다 주요 버튼이 스크롤 없이 화면 안에 보이는지
import { chromium } from "playwright";
const BASE = process.env.SENSEGLYPH_URL ?? "http://127.0.0.1:3000";
let failed = false;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed = true;
};
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [375, 667]]) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, locale: "ko-KR" });
  await c.addInitScript(() => {
    localStorage.setItem("senseglyph-session", JSON.stringify({ name: "test", email: "", provider: "guest", since: 1 }));
    localStorage.setItem("senseglyph-writing-tips-v1", "1");
  });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const inView = (sel) =>
    p.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
    }, sel);
  const docFits = () => p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1);
  const tag = `${w}×${h}`;
  for (const st of [0, 1]) {
    await p.goto(BASE + `/?step=${st}`);
    await p.waitForSelector(".journey-next");
    check(`${tag} ${st + 1}단계: 다음 버튼이 아래에 늘 보임`, await inView(".journey-next"));
  }
  await p.goto(BASE + "/?step=2");
  await p.waitForSelector(".input-canvas");
  await p.waitForTimeout(600);
  check(`${tag} 글자 쓰기: 페이지 스크롤 없음`, await docFits());
  const railFits = await p.evaluate(() => { const r = document.querySelector(".sg-rail"); return r.scrollWidth <= r.clientWidth + 1; });
  check(`${tag} 글자 쓰기: 도구가 한 줄에 모두`, railFits);
  for (const [name, sel] of [["다음 글자", ".sg-tool-next"], ["도구 설정", '.sg-rail button[aria-haspopup="dialog"]'], ["쓰기 칸", ".input-canvas"], ["건너뛰기", ".sg-nav button:last-child"], ["나중에 다시 보기", ".sg-check-actions button"], ["글자 목록", ".sg-glyphs button"]])
    check(`${tag} 글자 쓰기: ${name} 보임`, await inView(sel));
  const pad = await p.evaluate(() => document.querySelector(".pad-sheet").getBoundingClientRect().width);
  check(`${tag} 글자 쓰기: 쓰기 칸 크기`, pad >= (h > 700 ? 280 : 180), Math.round(pad) + "px");
  const box = await p.locator(".input-canvas").boundingBox();
  await p.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(box.x + box.width * (0.3 + i * 0.04), box.y + box.height * (0.3 + i * 0.04));
  await p.mouse.up();
  await p.waitForTimeout(900);
  await p.click(".sg-steps button:nth-child(4)");
  await p.waitForSelector(".sg-sep-main");
  if (await p.locator("text=건너뛰고 바로 시작").count()) await p.click("text=건너뛰고 바로 시작");
  await p.waitForTimeout(500);
  check(`${tag} 자모 나누기: 페이지 스크롤 없음`, await docFits());
  for (const [name, sel] of [["폰트 다듬기", ".fw-sep-top > button:last-child"], ["편집 칸", ".separation-svg"], ["다시 쓰기", ".sg-sep-rewrite"], ["글자 띠", ".sg-sep .character-slider button"]])
    check(`${tag} 자모 나누기: ${name} 보임`, await inView(sel));
  await p.click(".sg-steps button:nth-child(5)");
  await p.waitForSelector(".fw-actions");
  await p.waitForTimeout(500);
  check(`${tag} 폰트 다듬기: 폰트 만들기 버튼이 아래에 보임`, await inView(".fw-actions button:last-child"));
  check(`${tag} 오류 없음`, !errors.length, errors.join(" / "));
  await c.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
