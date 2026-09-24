// Files shared into the PWA from other apps ("Share with ClickPrint"). The
// service worker (public/share-target.js) stashes them in this cache; the
// upload screen takes them out once. Web only.

// Must match SHARED_FILES_CACHE in public/share-target.js.
const SHARED_FILES_CACHE = "clickprint-shared-files";

// Returns the waiting shared files as web File objects, in share order, and
// removes them so they're only added once. Resolves to [] when there are none.
export const takeSharedFiles = async () => {
	if (typeof caches === "undefined") return [];
	const cache = await caches.open(SHARED_FILES_CACHE);
	const requests = await cache.keys();
	const files = [];
	for (const request of requests) {
		const response = await cache.match(request);
		// If another caller already deleted this entry, it took the file.
		if (!response || !(await cache.delete(request))) continue;
		const blob = await response.blob();
		const name = decodeURIComponent(response.headers.get("X-File-Name") || "Document");
		files.push(new File([blob], name, { type: blob.type }));
	}
	return files;
};
