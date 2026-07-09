// Development-only service worker.
//
// Its ONLY job is to satisfy Chrome-on-Android's installability requirement
// (a registered service worker with a fetch handler) so the "Install app"
// option appears while developing against the Metro dev server.
//
// It caches NOTHING. Navigations are passed straight through to the network,
// and all other requests (JS bundles, HMR, WebSocket) are left untouched — so
// it behaves exactly like having no service worker and never serves Metro a
// stale bundle.

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			// Drop any caches left behind by the production worker (sw.js) so a
			// dev session on the same origin never serves stale content.
			const keys = await caches.keys();
			await Promise.all(keys.map((key) => caches.delete(key)));
			await self.clients.claim();
		})()
	);
});

self.addEventListener("fetch", (event) => {
	// A real fetch handler is required for installability, but we only touch
	// top-level navigations and just re-fetch them from the network (no cache).
	// Everything else falls through to the browser untouched.
	if (event.request.mode === "navigate") {
		event.respondWith(fetch(event.request));
	}
});
