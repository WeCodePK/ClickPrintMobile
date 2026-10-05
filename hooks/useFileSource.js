import { useEffect, useState } from "react";
import config from "../config/config";
import SecureStore from "../utils/storage";

// Image source for a stored file. GET /files/:fileId requires the auth token,
// so it is sent as a header. Accepts a file id or a populated file object;
// returns null when there is no file.
//
//   const source = useFileSource(shop.imageFile);
//   {source ? <Image source={source} /> : <Placeholder />}
export const useFileSource = (file) => {
	const [token, setToken] = useState(null);

	useEffect(() => {
		SecureStore.getItemAsync("authToken").then(setToken).catch(() => {});
	}, []);

	const fileId = file && typeof file === "object" ? file._id : file;
	if (!fileId) return null;

	return {
		uri: `${config.apiBaseUrl}/files/${fileId}`,
		...(token && { headers: { Authorization: `Bearer ${token}` } }),
	};
};

export default useFileSource;
