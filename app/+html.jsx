// Custom root HTML for the web build (static rendering only — this file has no
// effect on native). Expo Router wraps every web page in this document.
import { ScrollViewStyleReset } from "expo-router/html";

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
				<meta name="theme-color" content="#FF4F00" />

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

				<script dangerouslySetInnerHTML={{ __html: swRegistration }} />
			</head>
			<body>{children}</body>
		</html>
	);
}
