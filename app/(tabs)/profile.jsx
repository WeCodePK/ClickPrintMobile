//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useRouter, useNavigation } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";

// ----------------------------------- COMPONENTS -----------------------------------//

const AnimatedMenuItem = ({ style, onPress, children }) => {
	const scale = useRef(new Animated.Value(1)).current;

	const handlePressIn = () => {
		Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
	};

	const handlePressOut = () => {
		Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
	};

	return (
		<TouchableOpacity onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1}>
			<Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
		</TouchableOpacity>
	);
};

const Profile = () => {
	const [userName, setUserName] = useState("Loading...");
	const router = useRouter();
	const navigation = useNavigation();

	const loadProfileData = async () => {
		try {
			const name = (await SecureStore.getItemAsync("name")) ?? "John Doe";
			setUserName(name);
		} catch (error) {
			console.error("Error loading profile data:", error);
		}
	};

	// Initial load
	useEffect(() => {
		loadProfileData();
	}, []);

	// Reload details when screen comes back into focus
	useEffect(() => {
		const unsubscribe = navigation.addListener("focus", () => {
			loadProfileData();
		});
		return unsubscribe;
	}, [navigation]);

	

    const handleContactSupport = async () => {
		const email = "sohailkhankmu@gmail.com";
		const url = `mailto:${email}? subject=ClickPrint%20Support`;
		try{
			await Linking.openURL(url);

		}catch (error){
			console.error("Error openning mail app:", error);
			Alert.alert("Contact Support", "Could not open your email application automatically. Please email us at: " + email);
		};

	};

	const handleLogout = () => {
		Alert.alert("Logout", "Are you sure you want to logout?", [
			{
				text: "Cancel",
				style: "cancel",
			},
			{
				text: "Logout",
				onPress: async () => {
					try {
						console.log("Logout pressed");
						await SecureStore.deleteItemAsync("authToken");
						await SecureStore.deleteItemAsync("name");
						await SecureStore.deleteItemAsync("avatarUri");
						router.replace("/");
					} catch (error) {
						console.error("Error during logout, maybe issue with deleting token:", error);
						Alert.alert("Error", "An error occurred while logging out. Please try again.");
					}
				},
			},
		]);
	};

	//----------------------------------- STYLES -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.sectionsContainer}>
				{/* Profile Sections */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Account</Text>

					{/* Profile Header */}
					<AnimatedMenuItem
						style={styles.menuItem}
						onPress={() => router.push("/edit-profile")}
					>
						<View style={styles.menuItemLeft}>
							<Feather name="user" size={20} color={colors.textPrimary} />
							<Text style={styles.userName} numberOfLines={1}>{userName}</Text>
						</View>
						<Feather name="chevron-right" size={20} color={colors.textSecondary} />
					</AnimatedMenuItem>

				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Settings</Text>

					<AnimatedMenuItem
						style={styles.menuItem}
						onPress={() => {
							Alert.alert("Funtionality to be added soon!");
						}}
					>
						<View style={styles.menuItemLeft}>
							<Feather name="bell" size={20} color={colors.textPrimary} />
							<Text style={styles.menuItemText}>Notifications</Text>
						</View>
						<Feather name="chevron-right" size={20} color={colors.textSecondary} />
					</AnimatedMenuItem>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Help</Text>

					<AnimatedMenuItem
						style={styles.menuItem}
						onPress={() => {
							router.push("/about");
						}}
					>
						<View style={styles.menuItemLeft}>
							<Feather name="help-circle" size={20} color={colors.textPrimary} />
							<Text style={styles.menuItemText}>About</Text>
						</View>
						<Feather name="chevron-right" size={20} color={colors.textSecondary} />
					</AnimatedMenuItem>

					<AnimatedMenuItem
						style={styles.menuItem}
						onPress={handleContactSupport}
					>
						<View style={styles.menuItemLeft}>
							<Feather name="mail" size={20} color={colors.textPrimary} />
							<Text style={styles.menuItemText}>Contact Support</Text>
						</View>
						<Feather name="chevron-right" size={20} color={colors.textSecondary} />
					</AnimatedMenuItem>
				</View>

				</View>

				{/* Logout Button */}
				<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
					<Feather name="log-out" size={20} color={colors.cardBackground} />
					<Text style={styles.logoutButtonText}>Logout</Text>
				</TouchableOpacity>
			</ScrollView>
		</SafeAreaView>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingTop: 20,
		paddingBottom: 20,
		justifyContent: "space-between",
	},
	sectionsContainer: {
		flex: 0,
	},

	userName: {
		fontSize: 16,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	section: {
		marginBottom: 24,
		paddingHorizontal: 20,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: "700",
		color: colors.textSecondary,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 12,
	},
	menuItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 14,
		paddingHorizontal: 16,
		backgroundColor: colors.cardBackground,
		borderRadius: 12,
		marginBottom: 8,
	},
	menuItemLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	menuItemText: {
		fontSize: 16,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	logoutButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		marginHorizontal: 20,
		paddingVertical: 14,
		backgroundColor: colors.printRequest,
		borderRadius: 12,
		marginTop: 12,
	},
	logoutButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: colors.cardBackground,
	},
});

export default Profile;
