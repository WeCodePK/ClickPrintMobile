//----------------------------------- IMPORTS -----------------------------------//

import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";
import * as Notifications from 'expo-notifications';
import { createAndroidNotificationChannel } from "../../services/notifications";

//----------------------------------- FOREGROUND NOTIFICATION -----------------------------------//

Notifications.setNotificationHandler({
  handleNotification: async () => ({
	shouldPlaySound: true,
	shouldSetBadge: false, // don't set badge count on app icon
	shouldShowBanner: true,
	shouldShowList: false, // don't persist in notification center
  }),
});

export default function Layout() {
	const insets = useSafeAreaInsets();

	useEffect(() => {
		(async () => {
			await createAndroidNotificationChannel();
		})();
	}, []);

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarStyle: {
					backgroundColor: colors.cardBackground,
					borderTopWidth: 1,
					borderTopColor: colors.borderLight,
					paddingTop: 10,
					paddingBottom: Math.max(insets.bottom, 5),
					height: 80 + Math.max(insets.bottom, 10),
					shadowColor: colors.shadowMedium,
					shadowOffset: { width: 0, height: -4 },
					shadowOpacity: 1,
					shadowRadius: 24,
					elevation: 12,
				},
				tabBarActiveTintColor: colors.navActive,
				tabBarInactiveTintColor: colors.navInactive,
				tabBarLabelStyle: {
					fontSize: 12,
					fontWeight: "500",
				},
				tabBarIconStyle: {
					marginBottom: -4,
				},
			}}
		>
			<Tabs.Screen
				name="home"
				options={{
					title: "Home",
					tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "home" : "home-outline"} size={20} color={color} />,
				}}
			/>

			<Tabs.Screen
				name="printHistory"
				options={{
					title: " History",
					tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "receipt" : "receipt-outline"} size={20} color={color} />,
				}}
			/>

			<Tabs.Screen
				name="profile"
				options={{
					title: "More",
					tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "menu" : "menu-outline"} size={20} color={color} />,
				}}
			/>
		</Tabs>
	);
}
