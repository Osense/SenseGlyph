import { chromium } from "playwright";
const b = await chromium.launch();
for (const [w,h] of [[390,844],[375,667],[360,740]]) {
  const c = await b.newContext({ viewport:{width:w,height:h}, locale:"ko-KR", hasTouch:true, isMobile:true, deviceScaleFactor:2 });
  await c.addInitScript(()=>{localStorage.setItem("senseglyph-session",JSON.stringify({name:"test",email:"",provider:"guest",since:1}));localStorage.setItem("senseglyph-writing-tips-v1","1");});
  const p = await c.newPage(); p.on("pageerror",e=>console.log("ERR",e.message));
  await p.goto("http://127.0.0.1:3000/?step=2"); await p.waitForSelector(".input-canvas"); await p.waitForTimeout(1200);
  const r = await p.evaluate(()=>({sh:document.documentElement.scrollHeight, pad:document.querySelector(".pad-sheet").getBoundingClientRect().width, rail:document.querySelector(".sg-rail").scrollWidth+"/"+document.querySelector(".sg-rail").clientWidth}));
  console.log(w,h,JSON.stringify(r));
  await p.screenshot({ path:`/tmp/gal/s2-${w}x${h}.png` });
  await c.close();
}
await b.close();
