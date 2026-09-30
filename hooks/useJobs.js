import { useJobsQuery } from "./queries";

// The signed-in user's jobs, from the cache first (works offline).
export const useJobs = () => useJobsQuery();
