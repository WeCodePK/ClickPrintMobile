import { useDraftsQuery } from "./queries";

// The signed-in user's drafts, from the cache first (works offline).
export const useDrafts = () => useDraftsQuery();
