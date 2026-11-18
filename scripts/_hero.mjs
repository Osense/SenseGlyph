import { chromium } from "playwright";
const b = await chromium.launch();
for (const [f,w,h,s] of [["hero",1440,756,2],["og",1200,630,1]]) {
  const c = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:s });
  const p = await c.newPage();
  await p.goto("file:///tmp/hero/"+f+".html");
  await p.evaluate(async()=>{await document.fonts.load('40px Hand','한오늘ㅎㅏㄴ');await document.fonts.load('40px "JetBrains Mono"','0');await document.fonts.ready});
  await p.waitForTimeout(800);
  await p.screenshot({ path:`/tmp/hero/${f}.png` }); await c.close();
}
await b.close();
