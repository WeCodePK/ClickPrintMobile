import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { loadShopImageBlob } from "../utils/shopImageCache";

export default function ShopImage({ source, ...props }) {
	if (Platform.OS !== "web") {
		return <Image {...props} source={source} cachePolicy="memory-disk" />;
	}
	// A changed file or auth header starts a fresh attempt and releases the
	// previous blob URL. Accept the authenticated source from useFileSource.
	return <CachedShopImage key={JSON.stringify(source)} source={source} {...props} />;
}

function CachedShopImage({ source, ...props }) {
	const url = source?.uri;
	const headersKey = JSON.stringify(source?.headers || {});
	const [cachedSource, setCachedSource] = useState(null);

	useEffect(() => {
		if (!url) return;
		let active = true;
		let objectUrl = null;
		const headers = JSON.parse(headersKey);

		loadShopImageBlob(url, { headers })
			.then((blob) => {
				if (!active) return;
				objectUrl = URL.createObjectURL(blob);
				setCachedSource({ uri: objectUrl });
			})
			.catch((error) => {
				if (!active) return;
				console.warn("Couldn't cache shop image:", error);
				// Preserve authenticated image loading if caching is unavailable.
				setCachedSource({ uri: url, headers });
			});

		return () => {
			active = false;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [url, headersKey]);

	// Wait for the local lookup: rendering the remote URL first would trigger
	// a network request even when the image is already saved locally.
	return <Image {...props} source={cachedSource} cachePolicy="memory-disk" />;
}
