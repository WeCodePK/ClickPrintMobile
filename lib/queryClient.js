//----------------------------------- IMPORTS -----------------------------------//

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { ApiError } from "../utils/api";
import { isOnline, onOnlineChange } from "../utils/network";

//----------------------------------- CONSTANTS -----------------------------------//

const DAY_MS = 24 * 60 * 60 * 1000;

// Saved data is kept for a week so the app still has something to show after
// a long stretch offline.
export const CACHE_MAX_AGE_MS = 7 * DAY_MS;

// Bump when the shape of cached data changes, to drop incompatible saved
// data. Deliberately not the build SHA: saved data must survive app updates.
export const CACHE_VERSION = "1";

//----------------------------------- CLIENT -----------------------------------//

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Show saved data first, whatever the connection; refetch when possible.
			networkMode: "offlineFirst",
			gcTime: CACHE_MAX_AGE_MS,
			staleTime: 30 * 1000,
			// apiFetch already retries transient failures, so only retry once
			// more here, and never on client/auth errors.
			retry: (failureCount, err) =>
				failureCount < 1 && !(err instanceof ApiError && (err.kind === "client" || err.kind === "auth")),
			refetchOnReconnect: true,
			refetchOnWindowFocus: true,
		},
		mutations: {
			networkMode: "always",
			retry: false,
		},
	},
});

export const persister = createAsyncStoragePersister({
	storage: AsyncStorage,
	key: "clickprint-query-cache",
	throttleTime: 1000,
});

export const persistOptions = {
	persister,
	maxAge: CACHE_MAX_AGE_MS,
	buster: CACHE_VERSION,
	dehydrateOptions: {
		// Only keep successful data; errors and in-flight queries aren't saved.
		shouldDehydrateQuery: (query) => query.state.status === "success",
	},
};

//----------------------------------- ONLINE / FOCUS -----------------------------------//

// Refetch stale queries when the connection returns (see utils/network.js).
onlineManager.setOnline(isOnline());
onlineManager.setEventListener((setOnline) => onOnlineChange(setOnline));

// Treat the app coming to the foreground as "focus" on native (web uses
// visibilitychange by default).
if (Platform.OS !== "web") {
	focusManager.setEventListener((handleFocus) => {
		const sub = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
		return () => sub.remove();
	});
}

// Drop everything cached for the signed-in user (called on sign out).
export const clearQueryCache = async () => {
	queryClient.clear();
	await persister.removeClient();
};

export default queryClient;
