import { useEffect, useMemo, useState } from "react";
import config from "../config/config";
import { getItemAsync } from "../utils/storage";

// Image source for a stored file. GET /files/:fileId requires the auth token,
// so it is sent as a header. Accepts a file id or a populated file object;
// returns null while reading the token or when there is no file.
//
//   const source = useFileSource(shop.imageFile);
//   {source ? <Image source={source} /> : <Placeholder />}
export const useFileSource = (file) => {
	const [token, setToken] = useState(undefined);

	useEffect(() => {
		let active = true;
		getItemAsync("authToken")
			.then((value) => { if (active) setToken(value ?? null); })
			.catch(() => { if (active) setToken(null); });
		return () => { active = false; };
	}, []);

	const fileId = file && typeof file === "object" ? file._id : file;
	return useMemo(() => {
		if (!fileId || token === undefined) return null;
		return {
			uri: `${config.apiBaseUrl}/files/${fileId}`,
			...(token && { headers: { Authorization: `Bearer ${token}` } }),
		};
	}, [fileId, token]);
};

export default useFileSource;
