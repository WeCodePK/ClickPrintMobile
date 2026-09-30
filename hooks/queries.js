//----------------------------------- IMPORTS -----------------------------------//

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { apiFetch, ApiError } from "../utils/api";
import { friendlyMessage } from "../utils/errors";
import { getItemAsync } from "../utils/storage";
import { transformTransaction, transformTransactions } from "../utils/transactionTransformer";

//----------------------------------- KEYS -----------------------------------//

// Everything the app reads from the backend, cached (and saved on the device)
// under these keys. Raw backend shapes are stored; transforms run in `select`.
export const queryKeys = {
	drafts: ["drafts"],
	draft: (id) => ["draft", id],
	jobs: ["jobs"],
	job: (id) => ["job", id],
	history: ["history"],
	shops: ["shops"],
	shop: (id) => ["shop", id],
	services: (shopId) => ["services", shopId],
};

//----------------------------------- FETCHERS -----------------------------------//

const getUserId = () => getItemAsync("userId");

export const fetchDrafts = async ({ signal }) => {
	const userId = await getUserId();
	if (!userId) return [];
	const body = await apiFetch(`/drafts/user/${userId}`, { signal });
	return body?.data?.drafts || [];
};

export const fetchJobs = async ({ signal }) => {
	const userId = await getUserId();
	if (!userId) return [];
	const body = await apiFetch(`/jobs/user/${userId}`, { signal });
	return body?.data?.jobs || [];
};

export const fetchHistory = async ({ signal } = {}) => {
	const body = await apiFetch("/history", { signal });
	return body?.data?.history || [];
};

export const fetchShops = async ({ signal } = {}) => {
	const body = await apiFetch("/shops", { signal });
	return body?.data?.shops || [];
};

export const fetchShop = async (shopId, { signal } = {}) => {
	const body = await apiFetch(`/shops/${shopId}`, { signal });
	const shop = body?.data?.shop || null;
	if (!shop) throw new ApiError("parse", "Unexpected response from server");
	return shop;
};

export const fetchServices = async (shopId, { signal } = {}) => {
	const body = await apiFetch(`/services/${shopId}`, { signal });
	return body?.data?.services || [];
};

export const fetchDraft = async (draftId, { signal } = {}) => {
	const body = await apiFetch(`/drafts/${draftId}`, { signal });
	const draft = body?.data?.draft || null;
	if (!draft) throw new ApiError("parse", "Unexpected response from server");
	return draft;
};

// Once a job is completed, cancelled or failed the backend moves it out of
// Jobs into History (keeping its _id), so look for it there on a 404.
export const fetchJob = async (jobId, { signal } = {}) => {
	try {
		const body = await apiFetch(`/jobs/${jobId}`, { signal });
		return body?.data?.job ?? null;
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) {
			const history = await fetchHistory({ signal });
			return history.find((h) => h._id === jobId) ?? null;
		}
		throw err;
	}
};

//----------------------------------- HOOK HELPERS -----------------------------------//

// Adapts a query to the { loading, error, refreshing, refresh, reload } shape
// the screens use. `loading` is true only while there's nothing to show yet;
// `error` is set when the latest fetch failed, even if older data is shown.
const useListState = (query) => {
	const [refreshing, setRefreshing] = useState(false);
	const { refetch } = query;

	const refresh = useCallback(async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	}, [refetch]);

	const reload = useCallback(() => refetch(), [refetch]);

	return {
		loading: query.isPending,
		error: query.isError || query.isRefetchError ? friendlyMessage(query.error) : null,
		refreshing,
		refresh,
		reload,
		updatedAt: query.dataUpdatedAt || null,
	};
};

// Seeds a single-item query from a cached list so it renders instantly (and
// offline) while the fresh copy loads.
const useSeed = (listKey, id) => {
	const queryClient = useQueryClient();
	return {
		initialData: () => queryClient.getQueryData(listKey)?.find((item) => item._id === id),
		initialDataUpdatedAt: () => queryClient.getQueryState(listKey)?.dataUpdatedAt,
	};
};

//----------------------------------- HOOKS -----------------------------------//

export const useDraftsQuery = () => {
	const query = useQuery({ queryKey: queryKeys.drafts, queryFn: fetchDrafts });
	return { drafts: query.data ?? [], ...useListState(query) };
};

export const useJobsQuery = () => {
	const query = useQuery({ queryKey: queryKeys.jobs, queryFn: fetchJobs, select: transformTransactions });
	return { jobs: query.data ?? [], ...useListState(query) };
};

export const useHistoryQuery = () => {
	const query = useQuery({ queryKey: queryKeys.history, queryFn: fetchHistory, select: transformTransactions });
	return { transactions: query.data ?? [], ...useListState(query) };
};

export const useShopsQuery = () => {
	const query = useQuery({ queryKey: queryKeys.shops, queryFn: fetchShops, staleTime: 60 * 1000 });
	return { shops: query.data ?? [], ...useListState(query) };
};

export const useShopQuery = (shopId, options = {}) => {
	const seed = useSeed(queryKeys.shops, shopId);
	return useQuery({
		queryKey: queryKeys.shop(shopId),
		queryFn: ({ signal }) => fetchShop(shopId, { signal }),
		enabled: !!shopId,
		...seed,
		...options,
	});
};

export const useServicesQuery = (shopId) =>
	useQuery({
		queryKey: queryKeys.services(shopId),
		queryFn: ({ signal }) => fetchServices(shopId, { signal }),
		enabled: !!shopId,
	});

export const useDraftQuery = (draftId, options = {}) => {
	const seed = useSeed(queryKeys.drafts, draftId);
	return useQuery({
		queryKey: queryKeys.draft(draftId),
		queryFn: ({ signal }) => fetchDraft(draftId, { signal }),
		enabled: !!draftId,
		...seed,
		...options,
	});
};

// Raw backend job; use transformTransaction on it if the list shape is needed.
export const useJobQuery = (jobId, options = {}) =>
	useQuery({
		queryKey: queryKeys.job(jobId),
		queryFn: ({ signal }) => fetchJob(jobId, { signal }),
		enabled: !!jobId,
		...options,
	});

export { transformTransaction };
