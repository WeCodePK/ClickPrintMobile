//----------------------------------- IMPORTS -----------------------------------//

import { queryKeys } from "../hooks/queries";
import { queryClient } from "../lib/queryClient";
import { apiFetch, ApiError, isTransientError } from "../utils/api";
import { newObjectId } from "../utils/objectId";

//----------------------------------- CONSTANTS -----------------------------------//

// Attempts for submit/cancel, which check what happened before trying again.
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//----------------------------------- CACHE -----------------------------------//

// After a write, fetch fresh lists in the background.
const refreshLists = () => {
	queryClient.invalidateQueries({ queryKey: queryKeys.drafts });
	queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
	queryClient.invalidateQueries({ queryKey: queryKeys.history });
};

const cacheDraft = (draft) => {
	if (draft?._id) queryClient.setQueryData(queryKeys.draft(draft._id), draft);
	return draft;
};

//----------------------------------- DRAFTS -----------------------------------//

// Creates a draft. The id is made on the device and sent along, so retrying
// after a lost response returns the same draft instead of making a second one.
// Pass `id` to retry a specific earlier attempt.
export const createDraft = async ({ id = newObjectId(), shop, files, ...rest } = {}, options = {}) => {
	const body = await apiFetch("/drafts", {
		method: "POST",
		body: { _id: id, ...(shop && { shop }), ...(files && { files }), ...rest },
		idempotent: true,
		...options,
	});
	refreshLists();
	return cacheDraft(body?.data?.draft);
};

// PUT replaces the given fields, so sending it twice is harmless; it retries.
export const updateDraft = async (draftId, changes, options = {}) => {
	const body = await apiFetch(`/drafts/${draftId}`, { method: "PUT", body: changes, ...options });
	queryClient.invalidateQueries({ queryKey: queryKeys.drafts });
	return cacheDraft(body?.data?.draft);
};

// Prices the draft for its shop. Only recalculates, so it's safe to retry.
export const checkDraft = async (draftId, options = {}) => {
	const body = await apiFetch(`/drafts/${draftId}/check`, { method: "PATCH", idempotent: true, ...options });
	return cacheDraft(body?.data?.draft);
};

// A draft that's already gone (e.g. the first attempt went through) counts as deleted.
export const deleteDraft = async (draftId, options = {}) => {
	try {
		await apiFetch(`/drafts/${draftId}`, { method: "DELETE", ...options });
	} catch (err) {
		if (!(err instanceof ApiError && err.status === 404)) throw err;
	}
	queryClient.setQueryData(queryKeys.drafts, (drafts) => drafts?.filter((d) => d._id !== draftId));
	queryClient.removeQueries({ queryKey: queryKeys.draft(draftId) });
	refreshLists();
};

// Looks up a job by id, in Jobs or (once finished) History. Null if missing.
const findJob = async (jobId) => {
	try {
		const body = await apiFetch(`/jobs/${jobId}`, { retries: 1 });
		return body?.data?.job ?? null;
	} catch (err) {
		if (!(err instanceof ApiError && err.status === 404)) throw err;
	}
	const body = await apiFetch("/history", { retries: 1 });
	return (body?.data?.history || []).find((h) => h._id === jobId) ?? null;
};

// Submits a draft as a job. The job keeps the draft's _id, so when a response
// is lost (timeout, dropped connection, server error) we look for the job
// before trying again: if it exists, the submit went through.
export const submitDraft = async (draftId, paymentMethod, { onRetry } = {}) => {
	let lastError = null;
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		if (attempt > 0) {
			onRetry?.({ attempt, retries: MAX_ATTEMPTS - 1 });
			await sleep(RETRY_DELAY_MS * attempt);
		}
		try {
			const body = await apiFetch(`/drafts/${draftId}/submit`, {
				method: "PATCH",
				body: { paymentMethod },
				retries: 0,
			});
			refreshLists();
			return body?.data?.job ?? null;
		} catch (err) {
			// 404: the draft is gone — most likely an earlier attempt submitted it.
			const unclear = isTransientError(err) || (err instanceof ApiError && err.status === 404);
			if (!unclear) throw err;
			lastError = err;
		}
		try {
			const job = await findJob(draftId);
			if (job) {
				refreshLists();
				return job;
			}
		} catch {
			// Couldn't check either; try the submit again.
		}
		if (lastError.status === 404) throw lastError;
	}
	throw lastError;
};

//----------------------------------- JOBS -----------------------------------//

// Cancels a job. If the response is lost or the backend refuses the change
// (e.g. an earlier attempt already cancelled it), the job is looked up: already
// cancelled counts as success.
export const cancelJob = async (jobId) => {
	try {
		await apiFetch(`/jobs/${jobId}/status`, {
			method: "PATCH",
			body: { status: "cancelled" },
			idempotent: true,
			retries: 2,
		});
	} catch (err) {
		if (!(err instanceof ApiError) || err.kind === "auth" || err.kind === "aborted") throw err;
		let job = null;
		try {
			job = await findJob(jobId);
		} catch {
			throw err;
		}
		if (job?.status !== "cancelled") throw err;
	}
	queryClient.setQueryData(queryKeys.jobs, (jobs) => jobs?.filter((j) => j._id !== jobId));
	refreshLists();
};
