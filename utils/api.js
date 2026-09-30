//----------------------------------- IMPORTS -----------------------------------//

import config from "../config/config";
import { beginBusy } from "./busy";
import { isOnline, recheckConnection, reportSlow, waitForOnline } from "./network";
import { getItemAsync } from "./storage";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

// Per-attempt limits. Writes get longer: the server may do real work (pricing,
// creating the job) before it answers.
const READ_TIMEOUT_MS = 15000;
const WRITE_TIMEOUT_MS = 30000;

// A request still running after this long flags the connection as slow.
const SLOW_AFTER_MS = 5000;

// Backoff between attempts: 1s, 2s, 4s, 8s (+ up to 30% jitter).
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 8000;

// While offline, a retry waits this long for the connection to come back
// before giving up with an "offline" error.
const OFFLINE_WAIT_MS = 30000;

//----------------------------------- ERRORS -----------------------------------//

// kind: "offline" | "timeout" | "server" | "auth" | "client" | "parse" | "aborted"
export class ApiError extends Error {
	constructor(kind, message, { status = 0, data = null } = {}) {
		super(message);
		this.name = "ApiError";
		this.kind = kind;
		this.status = status;
		this.data = data;
	}
}

// Failures where the request may or may not have reached the server, so it's
// worth trying again (or, for non-idempotent writes, checking what happened).
export const isTransientError = (err) =>
	err instanceof ApiError && (err.kind === "offline" || err.kind === "timeout" || err.kind === "server");

//----------------------------------- 401 HANDLING -----------------------------------//

// Registered by AuthProvider: signs out and returns to login. Several requests
// can fail with 401 together, so it only fires once until the next sign in.
let unauthorizedHandler = null;
let unauthorizedFired = false;

export const setUnauthorizedHandler = (handler) => {
	unauthorizedHandler = handler;
	unauthorizedFired = false;
	return () => {
		if (unauthorizedHandler === handler) unauthorizedHandler = null;
	};
};

export const resetUnauthorized = () => {
	unauthorizedFired = false;
};

const notifyUnauthorized = () => {
	if (unauthorizedFired || !unauthorizedHandler) return;
	unauthorizedFired = true;
	unauthorizedHandler();
};

//----------------------------------- HELPERS -----------------------------------//

const sleep = (ms, signal) =>
	new Promise((resolve) => {
		const timer = setTimeout(done, ms);
		function done() {
			clearTimeout(timer);
			signal?.removeEventListener("abort", done);
			resolve();
		}
		signal?.addEventListener("abort", done);
	});

const backoff = (attempt) => {
	const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
	return delay + Math.random() * delay * 0.3;
};

const isJsonResponse = (response) => (response.headers.get("content-type") || "").includes("application/json");

// One attempt: fetch with a timeout, then classify the outcome.
const attempt = async (url, init, { timeout, signal }) => {
	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeout);
	const slowTimer = setTimeout(reportSlow, SLOW_AFTER_MS);
	const onAbort = () => controller.abort();
	signal?.addEventListener("abort", onAbort);

	try {
		let response;
		try {
			response = await fetch(url, { ...init, signal: controller.signal });
		} catch {
			if (signal?.aborted) throw new ApiError("aborted", "Request cancelled");
			if (timedOut) throw new ApiError("timeout", "The request timed out");
			recheckConnection();
			throw new ApiError("offline", "No connection");
		}

		// Proxies (e.g. Cloudflare 502/524) answer with HTML, not JSON.
		let data = null;
		if (isJsonResponse(response)) {
			try {
				data = await response.json();
			} catch {
				if (timedOut) throw new ApiError("timeout", "The request timed out");
				throw new ApiError(response.ok ? "parse" : "server", "Unexpected response from server", {
					status: response.status,
				});
			}
		} else if (response.ok && response.status !== 204) {
			throw new ApiError("parse", "Unexpected response from server", { status: response.status });
		}

		if (response.ok) return data;

		const message = data?.message || `Request failed (${response.status})`;
		if (response.status === 401) throw new ApiError("auth", message, { status: 401, data });
		// 429 is the backend refusing (e.g. too many OTP tries), so it's shown
		// as-is rather than retried.
		if (response.status >= 500 || response.status === 408) {
			throw new ApiError("server", message, { status: response.status, data });
		}
		throw new ApiError("client", message, { status: response.status, data });
	} finally {
		clearTimeout(timer);
		clearTimeout(slowTimer);
		signal?.removeEventListener("abort", onAbort);
	}
};

//----------------------------------- API -----------------------------------//

// Calls the backend and resolves with the parsed JSON body
// ({ success, message, data }). Rejects with an ApiError.
//
// options:
//   method       HTTP method (default GET)
//   body         object, sent as JSON
//   auth         send the stored token (default true); a 401 then signs out
//   idempotent   safe to send twice (default: true for GET/HEAD/PUT/DELETE)
//   retries      extra attempts for transient failures (default 4 when
//                idempotent, else 0)
//   timeout      per-attempt timeout in ms
//   signal       AbortSignal to cancel
//   onRetry      called before each retry with { attempt, retries, waitingForConnection }
export const apiFetch = async (path, options = {}) => {
	const {
		method = "GET",
		body,
		auth = true,
		headers: extraHeaders,
		timeout,
		signal,
		onRetry,
	} = options;
	const upper = method.toUpperCase();
	const isRead = upper === "GET" || upper === "HEAD";
	const idempotent = options.idempotent ?? (isRead || upper === "PUT" || upper === "DELETE");
	const retries = options.retries ?? (idempotent ? 4 : 0);

	const headers = { Accept: "application/json", ...extraHeaders };
	if (body !== undefined) headers["Content-Type"] = "application/json";
	if (auth) {
		const token = await getItemAsync("authToken");
		if (token) headers.Authorization = `Bearer ${token}`;
	}

	const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
	const init = { method: upper, headers, ...(body !== undefined && { body: JSON.stringify(body) }) };
	const perAttemptTimeout = timeout ?? (isRead ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);

	// Writes hold off the PWA's automatic reload until they finish.
	const endBusy = isRead ? () => {} : beginBusy();
	try {
		return await send(url, init, { retries, signal, onRetry, auth, perAttemptTimeout });
	} finally {
		endBusy();
	}
};

const send = async (url, init, { retries, signal, onRetry, auth, perAttemptTimeout }) => {
	for (let n = 0; ; n++) {
		// Before a retry, wait for the network rather than burning attempts. The
		// first attempt always goes out: the connectivity check can lag behind
		// reality on a flaky link, and a failed attempt is cheap.
		if (n > 0 && !isOnline()) {
			onRetry?.({ attempt: n, retries, waitingForConnection: true });
			const back = await waitForOnline({ timeout: OFFLINE_WAIT_MS, signal });
			if (signal?.aborted) throw new ApiError("aborted", "Request cancelled");
			if (!back) throw new ApiError("offline", "No connection");
		}

		try {
			return await attempt(url, init, { timeout: perAttemptTimeout, signal });
		} catch (err) {
			if (err.kind === "auth" && auth) notifyUnauthorized();
			if (!isTransientError(err) || n >= retries || signal?.aborted) throw err;
			onRetry?.({ attempt: n + 1, retries, waitingForConnection: false });
			await sleep(backoff(n), signal);
			if (signal?.aborted) throw new ApiError("aborted", "Request cancelled");
		}
	}
};

export default apiFetch;
