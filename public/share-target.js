// "Share with ClickPrint" (Web Share Target API). Imported by sw.js and
// sw-dev.js via importScripts.
//
// The manifest's share_target makes the installed PWA show up in the Android
// share sheet. Sharing files (e.g. from WhatsApp) POSTs them here as
// multipart/form-data. The page can't read a POST body, so the worker stashes
// the files in a cache and redirects to the upload screen, which takes them out
// (utils/sharedFiles.js) and uploads them like picked files.
//
// The manifest also declares title/text/url so captions (e.g. a WhatsApp
// image's) arrive as form fields, which are ignored here. Without them Chrome
// turns the text into a "shared.txt" file and sends that instead.
//
// The manifest's files.accept list is deliberately broad; the backend decides
// what's printable. It lists each MIME type AND extension instead of "*/*":
// in testing, no shared file got through with "*/*" on Chrome for Android.
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
			// Tells the upload screen when a share brought no files, so it can say
			// so instead of opening empty: "failed" if the body couldn't be read,
			// "empty" if it had no files.
			let shareStatus = null;
			// For an empty share, what did arrive: field names, kinds and sizes,
			// never contents. Shown on the upload screen to debug on-device.
			let received = null;
			try {
				const formData = await request.formData();
				console.log(
					"Share received:",
					[...formData.entries()].map(([key, value]) =>
						value instanceof File ? `${key}: file "${value.name}" (${value.type}, ${value.size} B)` : `${key}: "${value}"`
					)
				);
				const files = formData.getAll("files").filter((f) => f instanceof File);
				if (files.length === 0) {
					shareStatus = "empty";
					received =
						[...formData.entries()]
							.map(([key, value]) =>
								value instanceof File
									? `${key}: file ${value.type || "?"} ${value.size}B`
									: `${key}: text ${value.length} chars`
							)
							.join(", ") || "nothing";
				}
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
				shareStatus = "failed";
			}
			// 303 turns the POST into a GET of the upload screen.
			const target = new URL("/upload-document", self.location.origin);
			if (shareStatus) target.searchParams.set("share", shareStatus);
			if (received) target.searchParams.set("received", received);
			return Response.redirect(target.href, 303);
		})()
	);
});
