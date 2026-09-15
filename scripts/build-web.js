// Production web build: `npm run build:web`.
//
// 1. Resolves the commit SHA once and passes it to Expo via COMMIT_SHA, so
//    app.config.js (extra.commitSha) and the stamped sw.js always agree.
// 2. Exports with --clear: Metro's transform cache doesn't key on env/config
//    values, so without it a rebuild can keep an old inlined SHA.
// 3. Stamps the SHA into dist/sw.js so its bytes change on every build, which
//    makes browsers install the new service worker.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveCommitSha } = require("./commit-sha");

const PLACEHOLDER = "__COMMIT_SHA__";
const SW_PATH = path.join(__dirname, "..", "dist", "sw.js");

const sha = resolveCommitSha();
console.log(`Building web for commit ${sha}`);

const result = spawnSync("npx", ["expo", "export", "--platform", "web", "--clear"], {
	stdio: "inherit",
	shell: process.platform === "win32",
	env: { ...process.env, COMMIT_SHA: sha },
});
if (result.status !== 0) {
	process.exit(result.status ?? 1);
}

const sw = fs.readFileSync(SW_PATH, "utf8");
const occurrences = sw.split(PLACEHOLDER).length - 1;
if (occurrences !== 1) {
	throw new Error(`Expected exactly one ${PLACEHOLDER} in ${SW_PATH}, found ${occurrences}`);
}
fs.writeFileSync(SW_PATH, sw.replace(PLACEHOLDER, sha));
console.log(`Stamped ${path.relative(process.cwd(), SW_PATH)} with ${sha}`);
