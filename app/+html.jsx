// Custom root HTML for the web build (static rendering only — this file has no
// effect on native). Expo Router wraps every web page in this document.
import { ScrollViewStyleReset } from "expo-router/html";

// App's off-white background (constants/colors.js -> colors.background). Used
// for the status bar (theme-color) and the Android nav bar (page background)
// on an installed PWA. A light color makes Android render dark status-bar text
// and dark nav buttons automatically.
const APP_BACKGROUND = "#F7F8FA";

// In production we register the caching worker (sw.js). In development we
// register a no-op worker (sw-dev.js) that caches nothing — it exists only to
// satisfy Android Chrome's installability check (a registered SW with a fetch
// handler) without interfering with Metro's fast refresh.
const swPath = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw-dev.js";

// Registration script, inlined so it runs before the React app hydrates.
const swRegistration = `
if ('serviceWorker' in navigator) {
	window.addEventListener('load', function () {
		navigator.serviceWorker.register('${swPath}').catch(function (err) {
			console.error('Service worker registration failed:', err);
		});
	});
}
`;

export default function Root({ children }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta httpEquiv="X-UA-Compatible" content="IE=edge" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
				/>

				{/* PWA */}
				<link rel="manifest" href="/manifest.json" />
				{/* Status bar color on an installed PWA. Light -> dark status-bar text. */}
				<meta name="theme-color" content={APP_BACKGROUND} />
				{/* Force light rendering so a dark-mode device doesn't darken the
				    system nav bar or draw a dark seam under the status bar. */}
				<meta name="color-scheme" content="light" />

				{/* iOS home-screen / standalone support */}
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-status-bar-style" content="default" />
				<meta name="apple-mobile-web-app-title" content="Click Print" />
				<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

				{/* Icons */}
				<link rel="icon" href="/favicon.png" />

				{/*
				  Disable body scrolling on web so ScrollView components behave
				  the same as on native. Remove if you want the default behavior.
				*/}
				<ScrollViewStyleReset />

				{/*
				  Set the document background so the Android system nav bar on an
				  installed PWA matches the app (light bg -> dark nav buttons).
				*/}
				<style
					dangerouslySetInnerHTML={{
						__html: `:root { color-scheme: light; } html, body { margin: 0; background-color: ${APP_BACKGROUND}; }`,
					}}
				/>

				<script dangerouslySetInnerHTML={{ __html: swRegistration }} />
			</head>
			<body>{children}</body>
		</html>
	);
}
