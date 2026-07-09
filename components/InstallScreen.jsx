// Web-only install page shown when the app is opened in a browser tab (not yet
// installed as a PWA). Renders an "Install app" button that triggers Chrome's
// Richer Install UI via the captured `beforeinstallprompt` event, with an iOS
// "Add to Home Screen" fallback since Safari has no install prompt.

import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const isIOS = () =>
	typeof navigator !== "undefined" &&
	(/iphone|ipad|ipod/i.test(navigator.userAgent) ||
		// iPadOS 13+ reports as Mac but is touch-capable.
		(/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

export default function InstallScreen() {
	const [canInstall, setCanInstall] = useState(false);

	useEffect(() => {
		if (Platform.OS !== "web") return;

		const sync = () => setCanInstall(!!window.__bipEvent);
		sync(); // the event may have fired before this screen mounted

		window.addEventListener("bip-ready", sync);
		window.addEventListener("appinstalled", sync);
		return () => {
			window.removeEventListener("bip-ready", sync);
			window.removeEventListener("appinstalled", sync);
		};
	}, []);

	const handleInstall = async () => {
		const promptEvent = window.__bipEvent;
		if (!promptEvent) return;
		promptEvent.prompt();
		try {
			await promptEvent.userChoice;
		} finally {
			// The event can only be used once. If the user dismissed it, they can
			// still install from the browser menu.
			window.__bipEvent = null;
			setCanInstall(false);
		}
	};

	const ios = isIOS();

	return (
		<View style={styles.container}>
			<View style={styles.card}>
				<Image
					source={{ uri: "/icons/icon-192.png" }}
					style={styles.icon}
					resizeMode="contain"
				/>
				<Text style={styles.title}>Install ClickPrint</Text>
				<Text style={styles.subtitle}>
					Add ClickPrint to your device for a full-screen, app-like experience.
				</Text>

				{canInstall ? (
					<TouchableOpacity style={styles.button} onPress={handleInstall} activeOpacity={0.85}>
						<Text style={styles.buttonText}>Install app</Text>
					</TouchableOpacity>
				) : ios ? (
					<View style={styles.instructions}>
						<Text style={styles.instructionsTitle}>To install on iOS</Text>
						<Text style={styles.instructionsText}>
							1. Tap the <Text style={styles.bold}>Share</Text> icon in Safari.
						</Text>
						<Text style={styles.instructionsText}>
							2. Choose <Text style={styles.bold}>Add to Home Screen</Text>.
						</Text>
					</View>
				) : (
					<View style={styles.instructions}>
						<Text style={styles.instructionsText}>
							Installation isn&apos;t available in this browser yet. Open this page in
							Chrome or Edge, or use the browser menu and choose{" "}
							<Text style={styles.bold}>Install app</Text>.
						</Text>
					</View>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#F7F8FA",
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
	card: {
		width: "100%",
		maxWidth: 420,
		backgroundColor: "#FFFFFF",
		borderRadius: 24,
		paddingVertical: 40,
		paddingHorizontal: 28,
		alignItems: "center",
		shadowColor: "rgba(143, 155, 179, 0.4)",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 1,
		shadowRadius: 24,
	},
	icon: {
		width: 96,
		height: 96,
		borderRadius: 22,
		marginBottom: 24,
	},
	title: {
		fontSize: 26,
		fontWeight: "bold",
		color: "#1A1F36",
		marginBottom: 10,
		textAlign: "center",
	},
	subtitle: {
		fontSize: 15,
		color: "#8F9BB3",
		textAlign: "center",
		lineHeight: 22,
		marginBottom: 28,
	},
	button: {
		backgroundColor: "#FF4F00",
		paddingVertical: 15,
		paddingHorizontal: 40,
		borderRadius: 12,
		width: "100%",
		alignItems: "center",
	},
	buttonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "bold",
	},
	instructions: {
		width: "100%",
		backgroundColor: "#F7F8FA",
		borderRadius: 12,
		padding: 18,
	},
	instructionsTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#1A1F36",
		marginBottom: 8,
	},
	instructionsText: {
		fontSize: 14,
		color: "#1A1F36",
		lineHeight: 22,
	},
	bold: {
		fontWeight: "700",
	},
});
