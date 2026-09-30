import { getRandomBytes } from "expo-crypto";

// A MongoDB ObjectId made on the device: 4 bytes of Unix seconds followed by
// 8 random bytes, as 24 hex characters. Sending one with a create request lets
// the backend recognise a retry of the same request instead of creating a
// duplicate (see createDraft in services/drafts.js).
export const newObjectId = () => {
	const seconds = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
	const random = Array.from(getRandomBytes(8), (b) => b.toString(16).padStart(2, "0")).join("");
	return seconds + random;
};

export default newObjectId;
