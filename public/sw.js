// Service worker for the Click Print PWA.
// Bump CACHE_VERSION whenever you want clients to drop their old cache.
const CACHE_VERSION = "v1";
const CACHE_NAME = `clickprint-${CACHE_VERSION}`;

// Take control as soon as the new worker is installed.
self.addEventListener("install", (event) => {
	self.skipWaiting();
});

// Clean up caches from previous versions.
self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
			);
			await self.clients.claim();
		})()
	);
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
					const response = await fetch(request);
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
