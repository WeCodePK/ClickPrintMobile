//----------------------------------- IMPORTS -----------------------------------//

import AsyncStorage from "@react-native-async-storage/async-storage";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useMemo, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { beginBusy } from "./busy";
import { uploadFile } from "./fileUpload";
import { isOnline, onOnlineChange } from "./network";
import { newObjectId } from "./objectId";
import { loadPendingFile, removePendingFile, savePendingFile } from "./pendingFiles";
import { getItemAsync } from "./storage";
import { forgetUploads } from "./tusUrlStorage";

//----------------------------------- CONSTANTS -----------------------------------//

// The queue (not the file bytes, see utils/pendingFiles.js) is saved here so
// uploads survive leaving the screen, a reload, or the app being killed.
const QUEUE_KEY = "clickprint-upload-queue";

// Finished uploads nobody claimed (e.g. an abandoned print job) are dropped
// after a week.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Between automatic attempts while online: 5s, 10s, 20s … up to 2 minutes.
// While offline, the next attempt waits for the connection instead.
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 2 * 60 * 1000;

const KEEP_AWAKE_TAG = "clickprint-uploads";

// status: "uploading" | "processing" (server converting) | "waiting" (will
// retry by itself) | "failed" (needs the user) | "success"
const ACTIVE = ["uploading", "processing"];
const PENDING = ["uploading", "processing", "waiting"];

//----------------------------------- STATE -----------------------------------//

// Items: { id, scope, name, mimeType, size, status, progress, errorMessage,
// file (the backend File once done), attempts, createdAt }. `scope` groups
// uploads by where they belong, e.g. "new" (a print job without a draft yet),
// "draft:<id>" or "proof:<draftId>".
let items = [];
const listeners = new Set();
// Per-item things that can't be saved: the source to upload from, the abort
// handle of the running attempt, and the retry timer.
const runtime = new Map();

let loaded = false;
let loadPromise = null;

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

const persist = () => {
	const saved = items.map(({ progress, ...item }) => ({
		...item,
		// A running attempt is resumed on the next launch.
		status: ACTIVE.includes(item.status) ? "waiting" : item.status,
	}));
	AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(saved)).catch(() => {});
};

const update = (id, changes, { save = true } = {}) => {
	let changed = false;
	items = items.map((item) => {
		if (item.id !== id) return item;
		changed = true;
		return { ...item, ...changes };
	});
	if (!changed) return;
	if (save) persist();
	syncKeepAwake();
	emit();
};

const getItem = (id) => items.find((item) => item.id === id);
const getRuntime = (id) => {
	if (!runtime.has(id)) runtime.set(id, {});
	return runtime.get(id);
};

// While something is uploading: keep the phone's screen on (native), since a
// sleeping phone suspends the app and the upload with it, and hold off the
// PWA's automatic reload (web, see utils/busy.js).
let endBusy = null;
const syncKeepAwake = () => {
	const active = items.some((item) => ACTIVE.includes(item.status));
	if (active === !!endBusy) return;
	if (active) {
		endBusy = beginBusy();
		if (Platform.OS !== "web") activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
	} else {
		endBusy();
		endBusy = null;
		if (Platform.OS !== "web") deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
	}
};

//----------------------------------- UPLOADING -----------------------------------//

const scheduleRetry = (id) => {
	const item = getItem(id);
	if (!item) return;
	const rt = getRuntime(id);
	clearTimeout(rt.retryTimer);
	// Offline: the online listener below starts it again.
	if (!isOnline()) return;
	const delay = Math.min(RETRY_BASE_MS * 2 ** Math.max(item.attempts - 1, 0), RETRY_MAX_MS);
	rt.retryTimer = setTimeout(() => start(id), delay);
};

// `force` skips the offline check (a fresh file or a tap on Retry always gets
// one attempt: the connectivity check can lag behind a flaky link).
const start = async (id, force = false) => {
	const item = getItem(id);
	if (!item || item.status === "success") return;
	const rt = getRuntime(id);
	if (rt.running) return;
	clearTimeout(rt.retryTimer);

	if (!force && !isOnline()) {
		update(id, { status: "waiting", errorMessage: "Waiting for connection" });
		return;
	}

	rt.running = true;
	update(id, { status: "uploading", errorMessage: null, attempts: (item.attempts || 0) + 1 });
	try {
		const source = rt.source || (await loadPendingFile(id, item));
		if (!source) {
			update(id, { status: "failed", errorMessage: "File no longer available. Remove it and add it again." });
			return;
		}
		rt.source = source;
		const token = await getItemAsync("authToken");
		const { promise, abort } = uploadFile(source, {
			name: item.name,
			mimeType: item.mimeType,
			token,
			fingerprint: id,
			onProgress: (progress) => update(id, { progress }, { save: false }),
			onStage: (stage) => update(id, { status: stage }, { save: false }),
		});
		rt.abort = abort;
		const file = await promise;
		if (!getItem(id)) return; // removed meanwhile
		update(id, { status: "success", progress: 1, file, errorMessage: null });
		rt.source = null;
		removePendingFile(id);
	} catch (err) {
		if (!getItem(id) || rt.removed) return;
		if (err?.transient) {
			update(id, {
				status: "waiting",
				errorMessage: isOnline() ? "Connection problem, retrying…" : "Waiting for connection",
			});
			scheduleRetry(id);
		} else {
			update(id, { status: "failed", errorMessage: err?.message || "Upload failed" });
		}
	} finally {
		rt.running = false;
		rt.abort = null;
	}
};

// Everything waiting gets another go when the connection returns.
onOnlineChange((online) => {
	if (!online) return;
	items.filter((item) => item.status === "waiting").forEach((item) => start(item.id));
});

//----------------------------------- LOADING -----------------------------------//

const load = () => {
	if (loadPromise) return loadPromise;
	loadPromise = (async () => {
		try {
			const saved = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || "[]");
			const cutoff = Date.now() - MAX_AGE_MS;
			const known = new Set(items.map((item) => item.id));
			const restored = saved.filter((item) => item.createdAt > cutoff && !known.has(item.id));
			items = [...restored, ...items];
		} catch {
			// Unreadable queue: start fresh.
		}
		loaded = true;
		persist();
		emit();
		items.filter((item) => PENDING.includes(item.status)).forEach((item) => start(item.id));
	})();
	return loadPromise;
};

// Loads the saved queue and resumes unfinished uploads. Safe to call often.
export const initUploads = () => load();

//----------------------------------- API -----------------------------------//

// Adds files (document picker assets: { name, mimeType, size, uri, file? })
// to `scope` and starts uploading them. Returns the new item ids.
export const addUploads = async (scope, assets) => {
	await load();
	const now = Date.now();
	const added = assets.map((asset) => ({
		id: newObjectId(),
		scope,
		name: asset.name || "Document",
		mimeType: asset.mimeType || asset.file?.type || "application/octet-stream",
		size: asset.size ?? asset.file?.size ?? null,
		status: "uploading",
		progress: 0,
		errorMessage: null,
		file: null,
		attempts: 0,
		createdAt: now,
		asset,
	}));
	items = [...items, ...added.map(({ asset, ...item }) => item)];
	persist();
	emit();

	for (const { asset, ...item } of added) {
		const original =
			Platform.OS === "web"
				? asset.file || (await (await fetch(asset.uri)).blob())
				: { uri: asset.uri, name: item.name, type: item.mimeType };
		getRuntime(item.id).source = await savePendingFile(item.id, original, item);
		start(item.id, true);
	}
	return added.map((item) => item.id);
};

// Tries a failed or waiting upload again right away.
export const retryUpload = (id) => {
	const item = getItem(id);
	if (!item || item.status === "success" || getRuntime(id).running) return;
	update(id, { attempts: 0 });
	start(id, true);
};

// Stops and forgets an upload, and its saved copy.
export const removeUpload = (id) => {
	const rt = getRuntime(id);
	rt.removed = true;
	clearTimeout(rt.retryTimer);
	rt.abort?.();
	runtime.delete(id);
	items = items.filter((item) => item.id !== id);
	persist();
	syncKeepAwake();
	emit();
	removePendingFile(id);
	forgetUploads(id).catch(() => {});
};

// Forgets every upload in a scope (e.g. once its files are in a draft).
export const clearScope = (scope) => {
	items.filter((item) => item.scope === scope).forEach((item) => removeUpload(item.id));
};

// Moves a scope's uploads to another (e.g. "new" -> "draft:<id>").
export const moveScope = (from, to) => {
	items = items.map((item) => (item.scope === from ? { ...item, scope: to } : item));
	persist();
	emit();
};

// Forgets everything (on sign out).
export const clearAllUploads = () => {
	[...items].forEach((item) => removeUpload(item.id));
};

// Resolves with the backend File once upload `id` succeeds (however many
// retries or reconnects that takes); rejects if it fails for good or is
// removed. `onChange` gets the item on every update, e.g. for a status label.
export const waitForUpload = (id, onChange) =>
	new Promise((resolve, reject) => {
		const check = () => {
			const item = getItem(id);
			if (!item) {
				unsubscribe();
				reject(new Error("Upload cancelled"));
				return;
			}
			onChange?.(item);
			if (item.status === "success") {
				unsubscribe();
				resolve(item.file);
			} else if (item.status === "failed") {
				unsubscribe();
				reject(new Error(item.errorMessage || "Upload failed"));
			}
		};
		const unsubscribe = subscribe(check);
		check();
	});

// True while any upload is sending or being processed.
export const hasActiveUploads = () => items.some((item) => ACTIVE.includes(item.status));

// True while any upload hasn't finished (including ones waiting to retry).
export const hasPendingUploads = () => items.some((item) => PENDING.includes(item.status));

const getSnapshot = () => items;

// The uploads in `scope` (all scopes when omitted), re-rendering on change.
export const useUploads = (scope) => {
	const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	return useMemo(() => (scope ? all.filter((item) => item.scope === scope) : all), [all, scope]);
};

export const isUploadsLoaded = () => loaded;
export const subscribeUploads = subscribe;
