import { useHistoryQuery } from "./queries";

// The user's finished jobs (history), from the cache first (works offline).
export const useTransactions = () => useHistoryQuery();
