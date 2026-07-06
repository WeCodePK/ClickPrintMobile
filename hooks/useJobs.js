import { useCallback, useEffect, useState } from "react";
import { fetchJobs } from "../services/fetchJobs";
import { transformTransactions } from "../utils/transactionTransformer";

export const useJobs = () => {
	const [jobs, setJobs] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [refreshing, setRefreshing] = useState(false);

	const loadJobs = useCallback(async () => {
		try {
			setError(null);
			const data = await fetchJobs();
			const transformed = transformTransactions(data);
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
