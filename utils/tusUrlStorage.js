import AsyncStorage from "@react-native-async-storage/async-storage";

// Where tus remembers the server URL of each unfinished upload, so a later
// attempt (after a failure, a reload, or the app being killed) continues from
// the last byte the server has instead of starting over.
//
// tus-js-client's built-in storage uses localStorage, which doesn't exist on
// native, so resuming only worked within a single attempt there. This one is
// backed by AsyncStorage (localStorage on web, native storage elsewhere).

const PREFIX = "tus::";

const parse = (value) => {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
};

const findByPrefix = async (prefix) => {
	const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
	if (keys.length === 0) return [];
	const entries = await AsyncStorage.multiGet(keys);
	return entries
		.map(([key, value]) => {
			const upload = parse(value);
			return upload && { ...upload, urlStorageKey: key };
		})
		.filter(Boolean);
};

export const tusUrlStorage = {
	findAllUploads: () => findByPrefix(PREFIX),

	findUploadsByFingerprint: (fingerprint) => findByPrefix(`${PREFIX}${fingerprint}::`),

	removeUpload: (urlStorageKey) => AsyncStorage.removeItem(urlStorageKey),

	addUpload: async (fingerprint, upload) => {
		const key = `${PREFIX}${fingerprint}::${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
		await AsyncStorage.setItem(key, JSON.stringify(upload));
		return key;
	},
};

// Forgets every stored upload for this fingerprint (e.g. when the user removes
// the file, so a later file can't resume into it).
export const forgetUploads = async (fingerprint) => {
	const uploads = await tusUrlStorage.findUploadsByFingerprint(fingerprint);
	await Promise.all(uploads.map((upload) => tusUrlStorage.removeUpload(upload.urlStorageKey)));
};

export default tusUrlStorage;
