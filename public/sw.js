// Service worker for the Click Print PWA.
// BUILD_SHA is replaced with the git commit SHA by scripts/build-web.js. A new
// build changes these bytes, so the browser installs the new worker and the
// activate handler below drops the previous build's cache.
const BUILD_SHA = "__COMMIT_SHA__";
const CACHE_NAME = `clickprint-${BUILD_SHA}`;

// Receives files shared from other apps ("Share with ClickPrint").
importScripts("/share-target.js");

// Take control as soon as the new worker is installed.
self.addEventListener("install", (event) => {
	self.skipWaiting();
});

// Clean up caches from previous versions. Shared files waiting for the upload
// screen are kept.
self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME && key !== SHARED_FILES_CACHE)
					.map((key) => caches.delete(key))
			);
			await self.clients.claim();
		})()
	);
});

// Messages from the page (see components/ServiceWorkerUpdater.jsx):
// - GET_VERSION: reply with this worker's build, so the page can tell whether
//   it's running an older build.
// - SKIP_WAITING: activate now. Chrome sometimes leaves this worker waiting
//   despite the skipWaiting() in install, and calling it again unsticks it.
self.addEventListener("message", (event) => {
	if (event.data?.type === "GET_VERSION") {
		event.ports[0]?.postMessage({ sha: BUILD_SHA });
	} else if (event.data?.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

self.addEventListener("fetch", (event) => {
	const { request } = event;

	// Only handle same-origin GET requests; let everything else (e.g. API
	// calls to the backend, POSTs) hit the network normally.
	if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
		return;
	}

	// Page navigations: network-first so users get fresh content when online,
	// falling back to the cached page (or the app shell) when offline.
	if (request.mode === "navigate") {
		event.respondWith(
			(async () => {
				try {
					let response = await fetch(request);
					// Single-page build: servers without an SPA fallback 404 every
					// route but "/" when it's loaded directly (e.g. the share
					// redirect to /upload-document), so serve the app shell instead.
					if (response.status === 404) response = await fetch("/");
					const cache = await caches.open(CACHE_NAME);
					cache.put(request, response.clone());
					return response;
				} catch {
					const cached = await caches.match(request);
					return cached || (await caches.match("/")) || Response.error();
				}
			})()
		);
		return;
	}

	// Static assets (JS, CSS, images, fonts): stale-while-revalidate.
	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			const cached = await cache.match(request);
			const network = fetch(request)
				.then((response) => {
					if (response && response.status === 200) {
						cache.put(request, response.clone());
					}
					return response;
				})
				.catch(() => cached);
			return cached || network;
		})()
	);
});
