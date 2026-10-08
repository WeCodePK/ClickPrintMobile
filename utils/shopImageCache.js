// Shared by every shop image on web. This cache survives page reloads and
// service worker updates (see APP_DATA_CACHES in public/share-target.js).
export const SHOP_IMAGES_CACHE = "clickprint-shop-images";
const pendingLoads = new Map();

const readShopImage = async (url) => {
	let cache = null;
	try {
		if (typeof caches !== "undefined") {
			cache = await caches.open(SHOP_IMAGES_CACHE);
			const cached = await cache.match(url);
			if (cached?.ok) {
				const blob = await cached.blob();
				if (blob.size > 0) return blob;
			}
		}
	} catch {
		// Storage may be disabled or full; still allow the image to load.
		cache = null;
	}

	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to load shop image: ${response.status}`);
	const blob = await response.blob();
	if (blob.size === 0) throw new Error("Shop image is empty");

	try {
		// Store just the image, without server Vary headers that could prevent
		// a later lookup by URL. File IDs identify each image version.
		await cache?.put(url, new Response(blob, {
			headers: { "Content-Type": blob.type || "application/octet-stream" },
		}));
	} catch {
		// A failed write must not hide an image that was already downloaded.
	}
	return blob;
};

export const loadShopImageBlob = (url) => {
	// List rows, map callouts and details can ask for the same file together.
	// Share the download, and allow failed downloads to retry on the next visit.
	if (!pendingLoads.has(url)) {
		const load = readShopImage(url).finally(() => pendingLoads.delete(url));
		pendingLoads.set(url, load);
	}
	return pendingLoads.get(url);
};
