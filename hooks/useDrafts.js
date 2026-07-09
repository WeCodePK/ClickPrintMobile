import SecureStore from "../utils/storage";
import { useCallback, useEffect, useState } from "react";
import { fetchDrafts } from "../services/fetchDrafts";

export const useDrafts = () => {
	const [drafts, setDrafts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [refreshing, setRefreshing] = useState(false);

	const loadDrafts = useCallback(async () => {
		try {
			setError(null);
			// Only fetch when a JWT is available; anonymous sessions skip the call.
			const token = await SecureStore.getItemAsync("authToken");
			if (!token) {
				setDrafts([]);
				return;
			}
			const data = await fetchDrafts();
			setDrafts(data);
		} catch (err) {
			setError(err.message || "Failed to fetch drafts");
			console.error("Error loading drafts:", err);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		loadDrafts();
	}, [loadDrafts]);

	const refresh = useCallback(async () => {
		setRefreshing(true);
		await loadDrafts();
	}, [loadDrafts]);

	return {
		drafts,
		loading,
		error,
		refreshing,
		refresh,
		reload: loadDrafts,
	};
};
