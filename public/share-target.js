// "Share with ClickPrint" (Web Share Target API). Imported by sw.js and
// sw-dev.js via importScripts.
//
// The manifest's share_target makes the installed PWA show up in the Android
// share sheet. Sharing files (e.g. from WhatsApp) POSTs them here as
// multipart/form-data. The page can't read a POST body, so the worker stashes
// the files in a cache and redirects to the upload screen, which takes them out
// (utils/sharedFiles.js) and uploads them like picked files.
//
// SHARED_FILES_CACHE must match the name in utils/sharedFiles.js, and the
// workers' activate handlers must not delete it.
const SHARE_TARGET_PATH = "/share-target";
const SHARED_FILES_CACHE = "clickprint-shared-files";

self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== "POST" || url.origin !== self.location.origin || url.pathname !== SHARE_TARGET_PATH) {
		return;
	}

	event.respondWith(
		(async () => {
			try {
				const formData = await request.formData();
				const files = formData.getAll("files").filter((f) => f instanceof File);
				const cache = await caches.open(SHARED_FILES_CACHE);
				const batch = Date.now();
				// Keys sort in share order; the name rides along in a header since
				// a cached Response has no filename of its own.
				await Promise.all(
					files.map((file, i) =>
						cache.put(
							`/__shared-files/${batch}-${String(i).padStart(3, "0")}`,
							new Response(file, {
								headers: {
									"Content-Type": file.type || "application/octet-stream",
									"X-File-Name": encodeURIComponent(file.name || "Document"),
								},
							})
						)
					)
				);
			} catch (err) {
				console.error("Failed to receive shared files:", err);
			}
			// 303 turns the POST into a GET of the upload screen.
			return Response.redirect(new URL("/upload-document", self.location.origin).href, 303);
		})()
	);
});
