import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import config from "../config/config";
import { loadShopImageBlob } from "../utils/shopImageCache";

export default function ShopImage({ imageFile, ...props }) {
	const url = imageFile ? `${config.apiBaseUrl}/files/${imageFile}` : null;
	const [cachedSource, setCachedSource] = useState(null);

	useEffect(() => {
		if (Platform.OS !== "web" || !url) return;
		let active = true;
		let objectUrl = null;

		loadShopImageBlob(url)
			.then((blob) => {
				if (!active) return;
				objectUrl = URL.createObjectURL(blob);
				setCachedSource({ url, uri: objectUrl });
			})
			.catch((error) => {
				if (!active) return;
				console.warn("Couldn't cache shop image:", error);
				// Preserve normal image loading if the server disallows CORS.
				setCachedSource({ url, uri: url });
			});

		return () => {
			active = false;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [url]);

	// Wait for the local lookup on web: rendering the remote URL first would
	// trigger a network request even when the image is already saved locally.
	const uri = Platform.OS === "web" ? (cachedSource?.url === url ? cachedSource.uri : null) : url;
	return <Image {...props} source={uri ? { uri } : null} cachePolicy="memory-disk" />;
}
