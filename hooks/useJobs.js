import { useCallback, useEffect, useState } from "react";
import SecureStore from "../utils/storage";
import config from "../config/config";
import { transformTransactions } from "../utils/transactionTransformer";

const API_BASE_URL = config.apiBaseUrl;

export const useJobs = () => {
	const [jobs, setJobs] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [refreshing, setRefreshing] = useState(false);

	const loadJobs = useCallback(async () => {
		try {
			setError(null);
			const token = await SecureStore.getItemAsync("authToken");
			const userId = await SecureStore.getItemAsync("userId");
			if (!token || !userId) {
				setJobs([]);
				return;
			}
			const response = await fetch(`${API_BASE_URL}/jobs/user/${userId}`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			const transformed = transformTransactions(data.data?.jobs || []);
			setJobs(transformed);
		} catch (err) {
			setError(err.message || "Failed to fetch jobs");
			console.error("Error loading jobs:", err);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		loadJobs();
	}, [loadJobs]);

	const refresh = useCallback(async () => {
		setRefreshing(true);
		await loadJobs();
	}, [loadJobs]);

	return {
		jobs,
		loading,
		error,
		refreshing,
		refresh,
		reload: loadJobs,
	};
};
