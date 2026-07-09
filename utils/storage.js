//----------------------------------- IMPORTS -----------------------------------//

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

//----------------------------------- STORAGE -----------------------------------//

// expo-secure-store has no web implementation (SecureStore.setValueWithKeyAsync
// is undefined on web). This shim mirrors the SecureStore async API and falls
// back to localStorage on web, so the same calls work on Android, iOS and web.

const isWeb = Platform.OS === "web";

const getItemAsync = async (key) => {
	if (isWeb) {
		try {
			return window.localStorage.getItem(key);
		} catch {
			return null;
		}
	}
	return SecureStore.getItemAsync(key);
};

const setItemAsync = async (key, value) => {
	if (isWeb) {
		try {
			window.localStorage.setItem(key, value);
		} catch {
			// storage unavailable (private mode / quota) — ignore
		}
		return;
	}
	return SecureStore.setItemAsync(key, value);
};

const deleteItemAsync = async (key) => {
	if (isWeb) {
		try {
			window.localStorage.removeItem(key);
		} catch {
			// ignore
		}
		return;
	}
	return SecureStore.deleteItemAsync(key);
};

export default { getItemAsync, setItemAsync, deleteItemAsync };
export { getItemAsync, setItemAsync, deleteItemAsync };
