// Resolves the git commit SHA the current build is made from. Used by
// app.config.js (-> extra.commitSha, shown as "Build Number") and by
// scripts/build-web.js (-> stamped into dist/sw.js).
const { execSync } = require("child_process");

// CI providers expose the commit directly; checked in order.
const SHA_ENV_VARS = [
	"COMMIT_SHA", // manual override; also set by scripts/build-web.js
	"WORKERS_CI_COMMIT_SHA", // Cloudflare Workers Builds
	"GITHUB_SHA", // GitHub Actions
	"EAS_BUILD_GIT_COMMIT_HASH", // EAS Build
];

function git(args) {
	return execSync(`git ${args}`, { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] })
		.toString()
		.trim();
}

function resolveCommitSha() {
	for (const name of SHA_ENV_VARS) {
		const value = process.env[name]?.trim();
		if (value) return value;
	}

	// Local build: read from git and flag uncommitted changes.
	try {
		const sha = git("rev-parse HEAD");
		const dirty = git("status --porcelain") !== "";
		return dirty ? `${sha}-dirty` : sha;
	} catch {
		return "unknown";
	}
}

module.exports = { resolveCommitSha };
