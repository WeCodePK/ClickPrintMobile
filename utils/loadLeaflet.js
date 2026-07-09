// Loads Leaflet (CSS + JS) from CDN on demand for the web build only.
// react-native-maps has no web support, so the web map is built on Leaflet +
// OpenStreetMap tiles (no API key required). This module is only imported from
// components/ShopsMap.web.jsx, so it never ends up in the native bundle.

const LEAFLET_VERSION = "1.9.4";
const CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

let leafletPromise = null;

export const loadLeaflet = () => {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return Promise.reject(new Error("Leaflet can only load in a browser environment"));
	}
	if (window.L) return Promise.resolve(window.L);
	if (leafletPromise) return leafletPromise;

	leafletPromise = new Promise((resolve, reject) => {
		if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = CSS_URL;
			document.head.appendChild(link);
		}

		const existing = document.querySelector(`script[src="${JS_URL}"]`);
		if (existing) {
			existing.addEventListener("load", () => resolve(window.L));
			existing.addEventListener("error", () => reject(new Error("Failed to load Leaflet")));
			return;
		}

		const script = document.createElement("script");
		script.src = JS_URL;
		script.async = true;
		script.onload = () => resolve(window.L);
		script.onerror = () => {
			leafletPromise = null;
			reject(new Error("Failed to load Leaflet"));
		};
		document.head.appendChild(script);
	});

	return leafletPromise;
};

export default loadLeaflet;
