import SecureStore from "../utils/storage";
import config from "../config/config";

const API_BASE_URL = config.apiBaseUrl;

// Fetch a single draft (fully populated: files, settings and shop) by id.
export const fetchDraft = async (draftId) => {
	const token = await SecureStore.getItemAsync("authToken");
	const response = await fetch(`${API_BASE_URL}/drafts/${draftId}`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	const data = await response.json();
	return data.data?.draft || null;
};

export default fetchDraft;
