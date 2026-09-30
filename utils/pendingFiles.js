//----------------------------------- IMPORTS -----------------------------------//

import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

//----------------------------------- CONSTANTS -----------------------------------//

// Copies of files waiting to be uploaded, kept until their upload finishes so
// it can resume after a reload or the app being killed.
//   Web: a Cache Storage cache (same approach as the shared-files cache in
//        public/share-target.js; the service workers must not delete it).
//   Native: the app's document directory (the picker's cache copy can be
//        cleared by the OS).
export const PENDING_UPLOADS_CACHE = "clickprint-pending-uploads";
const NATIVE_DIR_NAME = "pending-uploads";

const isWeb = Platform.OS === "web";
const cacheKey = (id) => `/__pending-uploads/${encodeURIComponent(id)}`;
const nativeDir = () => new Directory(Paths.document, NATIVE_DIR_NAME);

//----------------------------------- API -----------------------------------//

// Saves the file for `id`. `source` is a web File/Blob, or a native picker
// asset ({ uri }). Resolves to the source to upload from; if saving fails
// (e.g. storage full) the original is used and the upload just won't survive
// a restart.
export const savePendingFile = async (id, source, { name, mimeType } = {}) => {
	try {
		if (isWeb) {
			if (typeof caches === "undefined") return source;
			const cache = await caches.open(PENDING_UPLOADS_CACHE);
			await cache.put(
				cacheKey(id),
				new Response(source, {
					headers: {
						"Content-Type": mimeType || source.type || "application/octet-stream",
						"X-File-Name": encodeURIComponent(name || source.name || "Document"),
					},
				})
			);
			return source;
		}
		const dir = nativeDir();
		dir.create({ idempotent: true, intermediates: true });
		const target = new File(dir, id);
		if (target.exists) target.delete();
		new File(source.uri).copy(target);
		return { ...source, uri: target.uri };
	} catch (err) {
		console.warn("Couldn't keep a copy of the file for resuming:", err);
		return source;
	}
};

// The saved file for `id` as an upload source, or null if there isn't one.
export const loadPendingFile = async (id, { name, mimeType } = {}) => {
	try {
		if (isWeb) {
			if (typeof caches === "undefined") return null;
			const cache = await caches.open(PENDING_UPLOADS_CACHE);
			const response = await cache.match(cacheKey(id));
			if (!response) return null;
			const blob = await response.blob();
			const savedName = decodeURIComponent(response.headers.get("X-File-Name") || "") || name || "Document";
			return new globalThis.File([blob], savedName, { type: blob.type || mimeType });
		}
		const file = new File(nativeDir(), id);
		return file.exists ? { uri: file.uri, name, type: mimeType } : null;
	} catch {
		return null;
	}
};

export const removePendingFile = async (id) => {
	try {
		if (isWeb) {
			if (typeof caches === "undefined") return;
			const cache = await caches.open(PENDING_UPLOADS_CACHE);
			await cache.delete(cacheKey(id));
			return;
		}
		const file = new File(nativeDir(), id);
		if (file.exists) file.delete();
	} catch {
		// Already gone.
	}
};
