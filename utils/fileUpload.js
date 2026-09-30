//----------------------------------- IMPORTS -----------------------------------//

import * as tus from "tus-js-client";
import config from "../config/config";
import { apiFetch } from "./api";
import { isOnline } from "./network";
import { tusUrlStorage } from "./tusUrlStorage";

//----------------------------------- CONSTANTS ------------------------------------//

const API_BASE_URL = config.apiBaseUrl;

// Small chunks keep what a dropped connection throws away small, and show
// steady progress on slow links.
const CHUNK_SIZE = 1024 * 1024;

// Retries inside one attempt (about 2.5 minutes in total). While offline tus
// stops retrying; the upload manager starts a new attempt once back online,
// which resumes from the last byte the server has.
const RETRY_DELAYS = [0, 1000, 3000, 5000, 10000, 15000, 30000, 30000, 30000, 30000];

// No progress for this long while sending means the connection has silently
// stalled: restart the request (it resumes where the server left off).
const STALL_MS = 30000;
const WATCHDOG_INTERVAL_MS = 5000;

// After the last byte is sent the server converts the file before answering,
// which can take a while for big documents.
const PROCESSING_TIMEOUT_MS = 3 * 60 * 1000;

// Friendlier messages for the tus error statuses the backend documents.
// Kept short: they're shown inline on the document card.
const STATUS_MESSAGES = {
	400: "Invalid file name",
	401: "Session expired",
	404: "Upload expired",
	410: "Upload expired",
	413: "Too large (max 100 MB)",
	422: "Can't convert this file",
};

//----------------------------------- HELPERS -----------------------------------//

// Network errors, server errors, and conflicts that a fresh HEAD resolves.
const shouldRetry = (err) => {
	if (!isOnline()) return false;
	const status = err.originalResponse?.getStatus() ?? 0;
	return status === 0 || status >= 500 || status === 409 || status === 423 || status === 429;
};

const errorFrom = (err) => {
	const res = err?.originalResponse;
	const status = res?.getStatus();
	let message = STATUS_MESSAGES[status];
	if (!message) {
		try {
			message = JSON.parse(res.getBody()).message;
		} catch {
			message = res ? "Upload failed" : "No connection";
		}
	}
	// `transient`: worth another attempt later (the file itself is fine).
	const transient = !status || status >= 500 || status === 409 || status === 423 || status === 429;
	return Object.assign(new Error(message), { status, transient });
};

//----------------------------------- UPLOAD -----------------------------------//

// Uploads a file to /files over tus (resumable, chunked). Network drops are
// retried and resumed from the last acknowledged byte, and a later call with
// the same `fingerprint` resumes an earlier unfinished attempt (after a
// reload, or the app being killed).
//
// `file` is a web File/Blob or a React Native `{ uri, name, type }` object.
// `name` must include the extension: the backend picks the converter from it.
// `onStage` is called with "uploading" or "processing" (all bytes sent, the
// server is converting the file).
//
// Returns `{ promise, abort }`. The promise resolves with the backend's File
// object and rejects with an Error carrying a user-facing message, `status`
// and `transient` (true when trying again later may work).
export const uploadFile = (file, { name, mimeType, token, onProgress, onStage, fingerprint }) => {
	let upload = null;
	let aborted = false;
	let settled = false;
	let watchdog = null;
	let lastProgressAt = Date.now();
	let processingSince = null;

	const promise = new Promise((resolve, reject) => {
		const finish = (fn, value) => {
			if (settled) return;
			settled = true;
			clearInterval(watchdog);
			fn(value);
		};

		// The upload id is the file id. If the server finished the file but its
		// answer never arrived (the connection dropped while it was converting),
		// the file exists: look it up instead of reporting a failure.
		const recover = async () => {
			const fileId = upload?.url?.split("/").pop();
			if (!fileId) return null;
			try {
				const body = await apiFetch(`/files/${fileId}/info`, { retries: 3 });
				return body?.data?.file ?? null;
			} catch {
				return null;
			}
		};

		const fail = async (err) => {
			if (aborted) return;
			const recovered = await recover();
			if (recovered) finish(resolve, recovered);
			else finish(reject, errorFrom(err));
		};

		upload = new tus.Upload(file, {
			endpoint: `${API_BASE_URL}/files`,
			headers: { Authorization: `Bearer ${token}` },
			metadata: {
				filename: name,
				filetype: mimeType || "application/octet-stream",
			},
			chunkSize: CHUNK_SIZE,
			retryDelays: RETRY_DELAYS,
			onShouldRetry: shouldRetry,
			urlStorage: tusUrlStorage,
			...(fingerprint && { fingerprint: () => Promise.resolve(fingerprint) }),
			removeFingerprintOnSuccess: true,
			onProgress: (sent, total) => {
				lastProgressAt = Date.now();
				onProgress?.(total ? sent / total : 0);
				if (total && sent >= total && processingSince === null) {
					processingSince = Date.now();
					onStage?.("processing");
				} else if (sent < total && processingSince !== null) {
					processingSince = null;
					onStage?.("uploading");
				}
			},
			onSuccess: ({ lastResponse }) => {
				try {
					finish(resolve, JSON.parse(lastResponse.getBody()).data.file);
				} catch {
					fail(null);
				}
			},
			onError: fail,
		});

		// Restarts a stalled request, or gives up waiting for the server to
		// finish converting and checks whether it did.
		watchdog = setInterval(async () => {
			if (aborted || settled) return;
			const now = Date.now();
			if (processingSince !== null) {
				if (now - processingSince > PROCESSING_TIMEOUT_MS) {
					await upload.abort().catch(() => {});
					fail(null);
				}
			} else if (now - lastProgressAt > STALL_MS && isOnline()) {
				lastProgressAt = now;
				await upload.abort().catch(() => {});
				if (!aborted && !settled) upload.start();
			}
		}, WATCHDOG_INTERVAL_MS);

		onStage?.("uploading");
		upload
			.findPreviousUploads()
			.then((previous) => {
				if (aborted) return;
				if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
				upload.start();
			})
			.catch(() => {
				if (!aborted) upload.start();
			});
	});

	const abort = () => {
		aborted = true;
		clearInterval(watchdog);
		upload?.abort().catch(() => {});
	};

	return { promise, abort };
};
