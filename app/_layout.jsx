//----------------------------------- IMPORTS -----------------------------------//

import { Stack } from "expo-router";

//----------------------------------- COMPONENTS -----------------------------------//

export default function RootLayout() {
	return (
		<Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
			<Stack.Screen name="(tabs)" options={{ animation: "none" }} />
			<Stack.Screen name="index" options={{ animation: "none" }} />
			<Stack.Screen name="otp" options={{ animation: "none" }} />
			<Stack.Screen name="profile-setup" options={{ animation: "none" }} />
		</Stack>
	);
}
