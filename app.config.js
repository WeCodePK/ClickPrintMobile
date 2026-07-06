import "dotenv/config";
export default {
	expo: {
		name: "Click Print",
		slug: "Click Print",
		version: "1.0.0",
		orientation: "portrait",
		icon: "./assets/icon.png",
		scheme: "Click Print",
		userInterfaceStyle: "automatic",
		splash: {
			image: "./assets/icon.png",
			resizeMode: "cover",
			backgroundColor: "#fff",
		},
		newArchEnabled: true,
		ios: {
			supportsTablet: true,
		},
		android: {
			adaptiveIcon: {
				backgroundColor: "#E6F4FE",
				foregroundImage: "./assets/icon.png",
				backgroundImage: "./assets/icon.png",
				monochromeImage: "./assets/icon.png",
			},
			edgeToEdgeEnabled: true,
			predictiveBackGestureEnabled: false,
			package: "com.kamalhassan.printmanagementsystemclientapp",
		},
		web: {
			output: "static",
			favicon: "./assets/icon.png",
		},
		plugins: [
			"expo-router",
			"expo-font",
			"expo-web-browser",
			// Push Notification 1 :: Added expo-notification to plugins in config
			"expo-notifications",
			[
				"expo-splash-screen",
				{
					image: "./assets/icon.png",
					imageWidth: 200,
					resizeMode: "contain",
					backgroundColor: "#ffffff",
					dark: {
						backgroundColor: "#000000",
					},
				},
			],
		],
		experiments: {
			typedRoutes: true,
			reactCompiler: true,
		},
		extra: {
			router: {},
			eas: {
				projectId: "8f036921-80b8-45ba-9cfa-120c5411b3a6",
			},
			apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "https://clickprintbackend.wckd.pk/api",
		},
	},
};
