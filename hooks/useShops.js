import { useShopsQuery } from "./queries";

// All shops, from the cache first (works offline).
export const useShops = () => useShopsQuery();
