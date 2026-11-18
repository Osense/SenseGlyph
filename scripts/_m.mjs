import { chromium } from "playwright";
const b = await chromium.launch();
const W=+process.argv[2]||390, H=+process.argv[3]||844, tag=process.argv[4]||"a";
const c = await b.newContext({ viewport:{width:W,height:H}, locale:"ko-KR", deviceScaleFactor:2 });
await c.addInitScript(()=>{localStorage.setItem("senseglyph-session",JSON.stringify({name:"test",email:"",provider:"guest",since:1}));localStorage.setItem("senseglyph-writing-tips-v1","1");});
const p = await c.newPage(); p.on("pageerror",e=>console.log("ERR",e.message));
const info = async (n)=>{ const r=await p.evaluate(()=>{const m=document.querySelector("main");const sc=[...document.querySelectorAll("*")].filter(e=>e.scrollHeight>e.clientHeight+2&&getComputedStyle(e).overflowY.match(/auto|scroll/)).map(e=>(e.className+"").slice(0,30)+":"+e.scrollHeight+"/"+e.clientHeight);return {doc:document.documentElement.scrollHeight,sc};}); console.log(n,JSON.stringify(r)); await p.screenshot({path:`/tmp/gal/${tag}-${n}.png`}); };
for (const st of [0,1]) { await p.goto(`http://127.0.0.1:3000/?step=${st}`); await p.waitForTimeout(1500); await info("s"+st); }
await p.goto("http://127.0.0.1:3000/?step=2"); await p.waitForSelector(".input-canvas");
if (await p.locator(".sg-tips").count()) await p.click("text=건너뛰고 바로 쓰기");
for (const ch of ["겨","구"]) { await p.click(`#glyph-${ch}`); await p.waitForTimeout(250);
  const box = await p.locator(".input-canvas").boundingBox();
  for (const [a,bb] of [[[.3,.3],[.5,.7]],[[.6,.25],[.62,.8]],[[.45,.45],[.6,.47]]]) { await p.mouse.move(box.x+a[0]*box.width,box.y+a[1]*box.height); await p.mouse.down(); for(let i=1;i<=10;i++) await p.mouse.move(box.x+(a[0]+(bb[0]-a[0])*i/10)*box.width, box.y+(a[1]+(bb[1]-a[1])*i/10)*box.height); await p.mouse.up(); await p.waitForTimeout(80);} }
await p.waitForTimeout(900); await info("s2w");
await p.click('.sg-steps button:nth-child(4)'); await p.waitForTimeout(1200);
for (const tx of ["건너뛰고 바로 시작","건너뛰고 바로 쓰기"]) if (await p.locator(`text=${tx}`).count()) await p.click(`text=${tx}`);
await p.waitForTimeout(600); await info("s3");
await p.click('.sg-steps button:nth-child(5)'); await p.waitForTimeout(2500);
for (const tx of ["건너뛰고 바로 시작"]) if (await p.locator(`text=${tx}`).count()) await p.click(`text=${tx}`);
await p.waitForTimeout(800); await info("s4"); if (await p.locator(".fw-tabs button:nth-child(2)").isEnabled()) { await p.click(".fw-tabs button:nth-child(2)"); await p.waitForTimeout(6000); await info("s4e"); }
await b.close();
