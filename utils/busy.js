// Tracks work that must not be interrupted by a page reload (the PWA's
// automatic update, see components/ServiceWorkerUpdater.jsx): writes to the
// backend such as submitting a job (utils/api.js) and running uploads
// (utils/uploadManager.js).

let busyCount = 0;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

// Marks the start of busy work; call the returned function when it ends.
export const beginBusy = () => {
	busyCount++;
	let ended = false;
	emit();
	return () => {
		if (ended) return;
		ended = true;
		busyCount--;
		emit();
	};
};

export const isBusy = () => busyCount > 0;

// Calls `callback` once nothing is busy (right away if already idle).
// Returns a function that cancels the wait.
export const whenIdle = (callback) => {
	if (!isBusy()) {
		callback();
		return () => {};
	}
	const check = () => {
		if (isBusy()) return;
		listeners.delete(check);
		callback();
	};
	listeners.add(check);
	return () => listeners.delete(check);
};
