import "dotenv/config";
export default {
	expo: {
		name: "Click Print",
		slug: "Click-print",
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
			googleServicesFile: "./google-services.json",
			package: "com.clickprint.mobile",
			config: {
				googleMaps: {
					apiKey: process.env.GOOGLE_MAPS_API_KEY,
				},
			},
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
			"@react-native-community/datetimepicker",
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
				projectId: "dcfa1e7b-a3c9-4b15-91a9-5a7bba18f0d9"
			},
			apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "https://clickprintbackend.wckd.pk/api",
		},
	},
};
