/**
 * Inspects a raw scanned string or URL payload and extracts the shopId / shop_id parameter.
 * Supports:
 * - https://app.clickprint.pk?shopId=<ID>
 * - https://app.clickprint.pk/download?shop_id=<ID>
 * - Query strings with shopId, shop_id, or shop
 * - Deep link schemes (clickprint://shop?shopId=<ID>)
 * - URL path segments (/shop/<ID>)
 * - JSON payloads ({"shopId": "<ID>"})
 * - Raw MongoDB ObjectIds (24-character hex strings)
 */
export function extractShopIdFromPayload(raw) {
	if (!raw || typeof raw !== "string") return null;
	const trimmed = raw.trim();

	// 1. Try URL parsing
	try {
		const urlString =
			trimmed.startsWith("http://") || trimmed.startsWith("https://")
				? trimmed
				: trimmed.includes("?") || trimmed.includes("/")
				? `https://${trimmed}`
				: null;

		if (urlString) {
			const url = new URL(urlString);
			const shopId =
				url.searchParams.get("shopId") ||
				url.searchParams.get("shop_id") ||
				url.searchParams.get("shop");
			if (shopId) return shopId;

			// Check path segments e.g. /shop/<ID>
			const segments = url.pathname.split("/").filter(Boolean);
			const shopIdx = segments.findIndex(
				(s) => s.toLowerCase() === "shop" || s.toLowerCase() === "shops"
			);
			if (shopIdx !== -1 && segments[shopIdx + 1]) {
				return segments[shopIdx + 1];
			}
		}
	} catch {
		// Ignore URL constructor parse errors and fallback to regex
	}

	// 2. Regex fallback for query parameters
	const queryMatch = trimmed.match(/[?&](?:shopId|shop_id|shop)=([a-zA-Z0-9_-]+)/i);
	if (queryMatch && queryMatch[1]) {
		return queryMatch[1];
	}

	// 3. JSON format fallback
	try {
		if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
			const parsed = JSON.parse(trimmed);
			if (parsed.shopId) return parsed.shopId;
			if (parsed.shop_id) return parsed.shop_id;
			if (parsed.shop) return parsed.shop;
		}
	} catch {
		// Ignore JSON parse errors
	}

	// 4. Raw 24-char hex MongoDB ObjectId
	if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
		return trimmed;
	}

	return null;
}

export default extractShopIdFromPayload;
