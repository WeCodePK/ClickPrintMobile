import SecureStore from "../utils/storage";
import { useCallback, useEffect, useState } from "react";
import config from "../config/config";

const API_BASE_URL = config.apiBaseUrl;

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
			const userId = await SecureStore.getItemAsync("userId");
			if (!token || !userId) {
				setDrafts([]);
				return;
			}
			const response = await fetch(`${API_BASE_URL}/drafts/user/${userId}`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			setDrafts(data.data?.drafts || []);
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
