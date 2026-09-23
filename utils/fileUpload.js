//----------------------------------- IMPORTS -----------------------------------//

import * as tus from "tus-js-client";
import config from "../config/config";

//----------------------------------- CONSTANTS ------------------------------------//

const API_BASE_URL = config.apiBaseUrl;

// Friendlier messages for the tus error statuses the backend documents.
const STATUS_MESSAGES = {
	400: "Invalid file name",
	401: "Session expired, please log in again",
	404: "Upload expired, please try again",
	410: "Upload expired, please try again",
	413: "File is too large (max 100 MB)",
	422: "Couldn't convert this file",
};

//----------------------------------- UPLOAD -----------------------------------//

// Uploads a file to /files over tus (resumable, chunked). Network drops are
// retried and resumed from the last acknowledged byte. On web, a previous
// attempt for the same file (e.g. before a page reload) is resumed too.
//
// `file` is a web File/Blob or a React Native `{ uri, name, type }` object.
// `name` must include the extension: the backend picks the converter from it.
//
// Returns `{ promise, abort }`. The promise resolves with the backend's File
// object and rejects with an Error carrying a user-facing message and `status`.
export const uploadFile = (file, { name, mimeType, token, onProgress }) => {
	let upload = null;
	let aborted = false;

	const promise = new Promise((resolve, reject) => {
		upload = new tus.Upload(file, {
			endpoint: `${API_BASE_URL}/files`,
			headers: { Authorization: `Bearer ${token}` },
			metadata: {
				filename: name,
				filetype: mimeType || "application/octet-stream",
			},
			chunkSize: 5 * 1024 * 1024,
			retryDelays: [0, 1000, 3000, 5000, 10000],
			removeFingerprintOnSuccess: true,
			onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
			onSuccess: ({ lastResponse }) => {
				try {
					resolve(JSON.parse(lastResponse.getBody()).data.file);
				} catch {
					reject(new Error("Unexpected response from server"));
				}
			},
			onError: (err) => {
				const res = err.originalResponse;
				const status = res?.getStatus();
				let message = STATUS_MESSAGES[status];
				if (!message) {
					try {
						message = JSON.parse(res.getBody()).message;
					} catch {
						message = res ? "Upload failed" : "Network error, check your connection";
					}
				}
				reject(Object.assign(new Error(message), { status }));
			},
		});

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
		upload?.abort();
	};

	return { promise, abort };
};
