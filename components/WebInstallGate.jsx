// Gates the app behind the web install page.
//
//   - Native (APK/iOS build): always renders the app. The install page is
//     web-only and completely ignored.
//   - Web, launched as an installed PWA (standalone): renders the app.
//   - Web, opened in a normal browser tab: renders the install page instead,
//     so the app itself never mounts.

import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import InstallScreen from "./InstallScreen";

// True when the page is running as an installed PWA rather than a browser tab.
const isStandalone = () => {
	if (typeof window === "undefined") return false;
	const displayModes = ["standalone", "fullscreen", "minimal-ui"];
	const matchesDisplayMode = displayModes.some(
		(mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches
	);
	// navigator.standalone is the iOS Safari equivalent.
	return matchesDisplayMode || window.navigator.standalone === true;
};

export default function WebInstallGate({ children }) {
	// "app" -> render children; "browser" -> render install page;
	// "loading" -> undecided (web only, before the client-side check runs).
	const [mode, setMode] = useState(Platform.OS === "web" ? "loading" : "app");

	useEffect(() => {
		if (Platform.OS !== "web") return;

		const decide = () => setMode(isStandalone() ? "app" : "browser");
		decide();

		// Re-evaluate if the display mode changes (e.g. the user installs the app
		// while this tab is open).
		const mql = window.matchMedia("(display-mode: standalone)");
		mql.addEventListener?.("change", decide);
		window.addEventListener("appinstalled", decide);
		return () => {
			mql.removeEventListener?.("change", decide);
			window.removeEventListener("appinstalled", decide);
		};
	}, []);

	// The app's own layout hides the splash once it's ready; hide it here too for
	// the install-page branch so it doesn't stay up.
	useEffect(() => {
		if (mode === "browser") SplashScreen.hideAsync().catch(() => {});
	}, [mode]);

	if (mode === "loading") return null;
	if (mode === "browser") return <InstallScreen />;
	return children;
}
