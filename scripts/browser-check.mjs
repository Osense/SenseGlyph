import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1366, height: 1024 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (
    !r.url().startsWith("http://127.0.0.1:3000") &&
    !r.url().startsWith("blob:") &&
    !r.url().startsWith("data:")
  )
    external.push(r.url());
});
const results = [];
const check = (label) => {
  results.push(label);
  console.log("PASS", label);
};
try {
  await page.goto("http://127.0.0.1:3000");
  await page.getByRole("heading", { name: /겨.*쓰세요/ }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const pad = page.locator(".input-canvas");
  const box = await pad.boundingBox();
  const draw = async () => {
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
    await page.mouse.down();
    for (let i = 0; i < 20; i++)
      await page.mouse.move(
        box.x + box.width * (0.25 + i * 0.025),
        box.y + box.height * (0.3 + Math.sin(i / 4) * 0.1),
      );
    await page.mouse.up();
  };
  await draw();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  check("mouse input creates vector stroke");
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  await page.getByText("0획 · 자동 저장", { exact: true }).waitFor();
  await page.getByRole("button", { name: "다시 실행", exact: true }).click();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  check("undo and redo");
  await page.getByRole("button", { name: "다음 →", exact: true }).click();
  await page.getByRole("heading", { name: /구.*쓰세요/ }).waitFor();
  await page.getByRole("button", { name: "← 이전", exact: true }).click();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  check("glyph navigation retains stroke");
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  check("IndexedDB reload restores stroke");
  await page.getByRole("button", { name: "다시쓰기", exact: false }).click();
  await page.getByText("0획 · 자동 저장", { exact: true }).waitFor();
  await page.locator(".toast button").click();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  check("reset toast restores stroke");
  await page.getByRole("button", { name: "설정 열기" }).click();
  await page.getByLabel("2분할 세로", { exact: true }).uncheck();
  await page.getByLabel("글자 크기 가이드", { exact: true }).check();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSON 내보내기", exact: false })
    .click();
  const d = await download;
  await mkdir("artifacts", { recursive: true });
  await d.saveAs("artifacts/project-backup.json");
  const backup = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile("artifacts/project-backup.json", "utf8"),
  );
  assert.equal(backup.samples["겨"].strokes[0].points.length, 22);
  assert.equal(backup.samples["겨"].strokes[0].points[0].p, 0.5);
  assert.equal(backup.settings.grid.halfVertical, false);
  check("backup contains raw em points, pressure and settings");
  await page
    .locator("input[type=file]")
    .setInputFiles("artifacts/project-backup.json");
  await page.getByText("새 프로젝트로 가져왔습니다", { exact: true }).waitFor();
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  check("JSON import restores strokes as new project");
  await page.getByRole("button", { name: "보고 쓰기", exact: true }).click();
  await page.locator(".reference-canvas").waitFor();
  await page.getByRole("button", { name: "혼자 쓰기", exact: true }).click();
  assert.equal(await page.locator(".reference-canvas").count(), 0);
  await page.getByRole("button", { name: "따라 쓰기", exact: true }).click();
  await page.getByRole("slider", { name: "견본 농도" }).fill("40");
  check("all reference modes and opacity");
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("e");
  await page
    .getByRole("combobox", { name: "지우개 모드" })
    .selectOption("partial");
  const b = await pad.boundingBox();
  await page.mouse.click(
    b.x + b.width * 0.5,
    b.y + b.height * (0.3 + Math.sin(10 / 4) * 0.1),
  );
  await page.getByText("2획 · 자동 저장", { exact: true }).waitFor();
  await page.keyboard.press("Control+z");
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  await page
    .getByRole("combobox", { name: "지우개 모드" })
    .selectOption("stroke");
  await page.mouse.click(
    b.x + b.width * 0.5,
    b.y + b.height * (0.3 + Math.sin(10 / 4) * 0.1),
  );
  await page.getByText("0획 · 자동 저장", { exact: true }).waitFor();
  await page.keyboard.press("Control+z");
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  check("both erasers are undoable");
  await page.keyboard.press("p");
  // CDP supplies stylus pressure/tilt and a captured point outside the em box.
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("p");
  const client = await context.newCDPSession(page);
  const penBox = await pad.boundingBox();
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: penBox.x + penBox.width * 0.3,
    y: penBox.y + penBox.height * 0.7,
    button: "left",
    buttons: 1,
    pointerType: "pen",
    force: 0.2,
    tiltX: 25,
    tiltY: 10,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: penBox.x + penBox.width * 0.5,
    y: penBox.y + penBox.height * 0.7,
    button: "left",
    buttons: 1,
    pointerType: "pen",
    force: 0.8,
    tiltX: 35,
    tiltY: 15,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: penBox.x + penBox.width * 0.6,
    y: penBox.y + penBox.height * 0.7,
    button: "left",
    buttons: 1,
    pointerType: "pen",
    force: 0.6,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: penBox.x + penBox.width * 0.6,
    y: penBox.y + penBox.height * 0.7,
    button: "left",
    buttons: 0,
    pointerType: "pen",
  });
  await page.getByText("2획 · 자동 저장", { exact: true }).waitFor();
  await page.touchscreen.tap(penBox.x + 50, penBox.y + 50);
  await page.mouse.click(penBox.x + 60, penBox.y + 60);
  await page.getByText("2획 · 자동 저장", { exact: true }).waitFor();
  await page.getByRole("button", { name: "설정 열기" }).click();
  assert.equal(
    await page.getByLabel("펜으로만 쓰기", { exact: true }).isChecked(),
    true,
  );
  const penDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSON 내보내기", exact: false })
    .click();
  await (await penDownload).saveAs("artifacts/pen-backup.json");
  const penBackup = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile("artifacts/pen-backup.json", "utf8"),
  );
  const penPoints = penBackup.samples["겨"].strokes[1].points;
  assert.ok(penPoints.some((p) => p.p > 0.7));
  assert.ok(penPoints.some((p) => p.p < 0.3));
  assert.ok(penPoints.every((p) => p.x >= 40 && p.x <= 960));
  assert.ok(penPoints.some((p) => p.tiltX === 25));
  await page.getByLabel("펜으로만 쓰기", { exact: true }).uncheck();
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("Control+z");
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  check("stylus pressure, tilt, safe coordinates and palm rejection");
  await page.waitForTimeout(3100);
  await page.screenshot({ path: "artifacts/landscape.png", fullPage: true });
  await page.getByRole("button", { name: "설정 열기" }).click();
  await page.getByLabel("어두운 화면", { exact: true }).check();
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.screenshot({
    path: "artifacts/portrait-dark.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  check("portrait and dark mode without horizontal overflow");
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) =>
        navigator.serviceWorker.addEventListener("controllerchange", r, {
          once: true,
        }),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: /겨.*쓰세요/ }).waitFor();
  await page.getByText("1획 · 자동 저장", { exact: true }).waitFor();
  await page.getByRole("button", { name: "설정 열기" }).click();
  assert.equal(
    await page.getByLabel("2분할 세로", { exact: true }).isChecked(),
    false,
  );
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await page.getByRole("button", { name: "다음 →", exact: true }).click();
  await page.getByRole("heading", { name: /구.*쓰세요/ }).waitFor();
  check("offline reload, saved settings and navigation");
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  check("zero external requests and zero browser errors");
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify({ results, externalRequests: external, errors }, null, 2),
  );
} finally {
  await browser.close();
}
