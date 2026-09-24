// Production web build: `npm run build:web`.
//
// 1. Resolves the commit SHA once and passes it to Expo via COMMIT_SHA, so
//    app.config.js (extra.commitSha) and the stamped sw.js always agree.
// 2. Exports with --clear: Metro's transform cache doesn't key on env/config
//    values, so without it a rebuild can keep an old inlined SHA.
// 3. Stamps the SHA into dist/sw.js so its bytes change on every build, which
//    makes browsers install the new service worker.
// 4. Swaps dist/index.html from the dev manifest/home-screen title (which the
//    dev server serves straight from public/) to the production ones, and drops
//    dist/manifest-dev.json.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveCommitSha } = require("./commit-sha");

const PLACEHOLDER = "__COMMIT_SHA__";
const DIST = path.join(__dirname, "..", "dist");
const SW_PATH = path.join(DIST, "sw.js");
const INDEX_PATH = path.join(DIST, "index.html");
const DEV_MANIFEST_PATH = path.join(DIST, "manifest-dev.json");

// Each `from` must appear exactly once in public/index.html.
const INDEX_REPLACEMENTS = [
	{ from: 'href="/manifest-dev.json"', to: 'href="/manifest.json"' },
	{ from: 'name="apple-mobile-web-app-title" content="ClickPrintDev"', to: 'name="apple-mobile-web-app-title" content="ClickPrint"' },
];

function countOccurrences(haystack, needle) {
	return haystack.split(needle).length - 1;
}

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
const occurrences = countOccurrences(sw, PLACEHOLDER);
if (occurrences !== 1) {
	throw new Error(`Expected exactly one ${PLACEHOLDER} in ${SW_PATH}, found ${occurrences}`);
}
fs.writeFileSync(SW_PATH, sw.replace(PLACEHOLDER, sha));
console.log(`Stamped ${path.relative(process.cwd(), SW_PATH)} with ${sha}`);

let index = fs.readFileSync(INDEX_PATH, "utf8");
for (const { from, to } of INDEX_REPLACEMENTS) {
	const count = countOccurrences(index, from);
	if (count !== 1) {
		throw new Error(`Expected exactly one ${from} in ${INDEX_PATH}, found ${count}`);
	}
	index = index.replace(from, to);
}
fs.writeFileSync(INDEX_PATH, index);
fs.rmSync(DEV_MANIFEST_PATH, { force: true });
console.log(`Switched ${path.relative(process.cwd(), INDEX_PATH)} to the production manifest`);
