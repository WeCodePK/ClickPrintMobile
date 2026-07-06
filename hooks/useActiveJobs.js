import { useMemo } from "react";
import { useJobs } from "./useJobs";

const ACTIVE_STATUSES = ["submitted", "printing", "queued"];

export const useActiveJobs = () => {
	const { jobs, loading, error, refreshing, refresh, reload } = useJobs();

	const { activeJobs, inactiveJobs } = useMemo(() => {
		const active = [];
		const inactive = [];
		for (const t of jobs) {
			if (ACTIVE_STATUSES.includes(t.status?.toLowerCase())) {
				active.push(t);
			} else {
				inactive.push(t);
			}
		}
		return { activeJobs: active, inactiveJobs: inactive };
	}, [jobs]);

	return {
		activeJobs,
		inactiveJobs,
		allJobs: jobs,
		loading,
		error,
		refreshing,
		refresh,
		reload,
	};
};
