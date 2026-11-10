// Builds the static site for GitHub Pages (https://osense.github.io/SenseGlyph/)
// and force-pushes it to the gh-pages branch of the origin remote.
// Usage: npm run deploy
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const base = "/SenseGlyph";
const run = (command, options = {}) =>
  execSync(command, { stdio: "inherit", ...options });
const remote = execSync("git remote get-url origin").toString().trim();

run("npm run build", { env: { ...process.env, NEXT_PUBLIC_BASE_PATH: base } });
// Pages runs Jekyll by default, which drops folders starting with "_" (_next).
writeFileSync("out/.nojekyll", "");
run("git init -q -b gh-pages", { cwd: "out" });
run("git add -A", { cwd: "out" });
run('git commit -q -m "Deploy SenseGlyph to GitHub Pages"', { cwd: "out" });
run(`git push -f "${remote}" gh-pages`, { cwd: "out" });
console.log("Deployed to https://osense.github.io" + base + "/");
