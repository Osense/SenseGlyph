import { readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function walk(dir) {
  const result = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) result.push(...(await walk(dir + "/" + e.name)));
    else if (!e.name.endsWith(".map") && e.name !== "sw.js")
      result.push("/" + (dir + "/" + e.name).slice(4));
  }
  return result;
}
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const assets = (await walk("out")).map((path) => base + path);
assets.push(base + "/");
const cache =
  "hanhoek-" +
  createHash("sha256")
    .update(assets.join("|") + Date.now())
    .digest("hex")
    .slice(0, 12);
await writeFile(
  "out/sw.js",
  `const CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(assets)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('hanhoek-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`,
);
console.log("Offline precache:", assets.length, "local assets");
