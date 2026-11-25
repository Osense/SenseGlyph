// build-font.ts 를 node 용으로 묶어 실행한다.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";

const out = "/tmp/senseglyph-quality-build.mjs";
await build({
  entryPoints: ["scripts/quality/build-font.ts"],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  logLevel: "error",
});
const run = spawnSync("node", [out, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(run.status ?? 1);
