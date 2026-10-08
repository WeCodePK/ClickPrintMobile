const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const cacheSource = fs.readFileSync(path.join(root, "utils/shopImageCache.js"), "utf8");
let moduleVersion = 0;
const newLoader = () => import(`data:text/javascript;base64,${Buffer.from(`${cacheSource}\n// instance ${moduleVersion++}`).toString("base64")}`);
const imageResponse = () => new Response("image bytes", { headers: { "Content-Type": "image/png" } });

// Each load gets a fresh response body, like the browser's Cache Storage API.
const createCache = () => {
	const entries = new Map();
	return {
		entries,
		match: async (url) => entries.get(url)?.clone(),
		put: async (url, response) => { entries.set(url, response.clone()); },
	};
};

test("shop images are reused locally across screens and reloads", async (t) => {
	const originalFetch = globalThis.fetch;
	const originalCaches = globalThis.caches;
	t.after(() => {
		globalThis.fetch = originalFetch;
		if (originalCaches === undefined) delete globalThis.caches;
		else globalThis.caches = originalCaches;
	});
	const url = "https://api.example.com/api/files/shop-cover-1";
	const cache = createCache();
	const { loadShopImageBlob, SHOP_IMAGES_CACHE } = await newLoader();
	globalThis.caches = { open: async (name) => {
		assert.equal(name, SHOP_IMAGES_CACHE);
		return cache;
	} };
	let downloads = 0;
	globalThis.fetch = async () => { downloads++; return imageResponse(); };

	await t.test("first display downloads once; subsequent screens use the saved image", async () => {
		assert.equal(await (await loadShopImageBlob(url)).text(), "image bytes");
		assert.equal(await (await loadShopImageBlob(url)).text(), "image bytes");
		assert.equal(downloads, 1);
	});

	await t.test("a fresh app instance can display the saved image offline", async () => {
		const restarted = await newLoader();
		globalThis.fetch = async () => { throw new Error("Offline: network must not be called"); };
		assert.equal(await (await restarted.loadShopImageBlob(url)).text(), "image bytes");
	});

	await t.test("a changed file ID downloads the new image", async () => {
		globalThis.fetch = async () => { downloads++; return imageResponse(); };
		await loadShopImageBlob("https://api.example.com/api/files/shop-cover-2");
		assert.equal(downloads, 2);
	});

	await t.test("simultaneous list, callout and details share one download", async () => {
		let completeFetch;
		let concurrentDownloads = 0;
		globalThis.fetch = async () => {
			concurrentDownloads++;
			return new Promise((resolve) => { completeFetch = resolve; });
		};
		const concurrentUrl = "https://api.example.com/api/files/concurrent";
		const first = loadShopImageBlob(concurrentUrl);
		const second = loadShopImageBlob(concurrentUrl);
		const third = loadShopImageBlob(concurrentUrl);
		assert.equal(first, second);
		assert.equal(second, third);
		await new Promise((resolve) => setImmediate(resolve));
		completeFetch(imageResponse());
		await Promise.all([first, second, third]);
		assert.equal(concurrentDownloads, 1);
	});

	await t.test("HTTP failures and empty responses are not saved and can retry", async () => {
		const failureUrl = "https://api.example.com/api/files/retry";
		globalThis.fetch = async () => new Response("missing", { status: 404 });
		await assert.rejects(loadShopImageBlob(failureUrl), /404/);
		assert.equal(cache.entries.has(failureUrl), false);
		globalThis.fetch = async () => new Response("");
		await assert.rejects(loadShopImageBlob(failureUrl), /empty/);
		assert.equal(cache.entries.has(failureUrl), false);
		globalThis.fetch = async () => imageResponse();
		await loadShopImageBlob(failureUrl);
		assert.equal(cache.entries.has(failureUrl), true);
	});

	await t.test("disabled storage and failed writes still display downloaded images", async () => {
		globalThis.fetch = async () => imageResponse();
		delete globalThis.caches;
		assert.equal((await loadShopImageBlob(url)).size, 11);
		globalThis.caches = { open: async () => { throw new Error("Storage disabled"); } };
		assert.equal((await loadShopImageBlob(url)).size, 11);
		globalThis.caches = { open: async () => ({
			match: async () => undefined,
			put: async () => { throw new Error("Quota exceeded"); },
		}) };
		assert.equal((await loadShopImageBlob(url)).size, 11);
	});
});

for (const worker of ["sw.js", "sw-dev.js"]) {
	test(`${worker} preserves shop images when activating an update`, async () => {
		const handlers = {};
		const deleted = [];
		const self = {
			addEventListener: (name, handler) => { handlers[name] = handler; },
			clients: { claim: async () => {} },
		};
		const context = vm.createContext({
			self,
			caches: {
				keys: async () => ["clickprint-old-build", "clickprint-shop-images", "clickprint-pending-uploads"],
				delete: async (key) => { deleted.push(key); },
			},
			importScripts: (file) => vm.runInContext(fs.readFileSync(path.join(root, "public", file), "utf8"), context),
		});
		vm.runInContext(fs.readFileSync(path.join(root, "public", worker), "utf8"), context);
		let activation;
		handlers.activate({ waitUntil: (promise) => { activation = promise; } });
		await activation;
		assert.deepEqual(deleted, ["clickprint-old-build"]);
	});
}
