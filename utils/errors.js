import { ApiError } from "./api";

// One user-facing message per kind of failure, so screens never show raw
// errors like "HTTP error! status: 500" or "JSON Parse error".
//
// `fallback` is used for client errors (4xx) without a message from the
// backend, e.g. "Failed to save settings."
export const friendlyMessage = (err, fallback = "Something went wrong. Please try again.") => {
	if (!(err instanceof ApiError)) return fallback;
	switch (err.kind) {
		case "offline":
			return "You're offline. Check your connection and try again.";
		case "timeout":
			return "The connection is too slow right now. Please try again.";
		case "server":
		case "parse":
			return "ClickPrint is having trouble right now. Please try again in a moment.";
		case "auth":
			return "Your session has expired. Please log in again.";
		case "aborted":
			return "Cancelled.";
		default:
			return err.message || fallback;
	}
};

// True for failures caused by the connection rather than the request itself.
export const isConnectionError = (err) =>
	err instanceof ApiError && (err.kind === "offline" || err.kind === "timeout");

export default friendlyMessage;
