import { useCallback, useState } from "react";

// Tracks what a running request is doing, for button labels: pass `onRetry`
// to apiFetch / the services, show `label` (falling back to your own text).
//
//   const retry = useRetryStatus();
//   await updateDraft(id, changes, { onRetry: retry.onRetry });
//   <Text>{retry.label || "Continue"}</Text>
//   ... retry.reset() when done.
export const useRetryStatus = () => {
	const [label, setLabel] = useState(null);

	const onRetry = useCallback(({ attempt, retries, waitingForConnection }) => {
		setLabel(waitingForConnection ? "Waiting for connection…" : `Retrying (${attempt}/${retries})…`);
	}, []);

	const reset = useCallback(() => setLabel(null), []);

	return { label, onRetry, reset };
};

export default useRetryStatus;
