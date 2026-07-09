import SecureStore from "../utils/storage";
import config from "../config/config";

const API_BASE_URL = config.apiBaseUrl;

export const fetchTransactions = async () => {
	const token = await SecureStore.getItemAsync("authToken");
	const response = await fetch(`${API_BASE_URL}/history`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
	const data = await response.json();
	return data.data;
};

export default fetchTransactions;
