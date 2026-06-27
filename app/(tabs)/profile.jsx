//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useRouter, useNavigation } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import avatar from "../../assets/profileAvatar.jpg";
import { colors } from "../../constants/colors";

// ----------------------------------- COMPONENTS -----------------------------------//

const Profile = () => {
	const [userName, setUserName] = useState("Loading...");
	const [avatarUri, setAvatarUri] = useState(null);
	const router = useRouter();
	const navigation = useNavigation();

	const loadProfileData = async () => {
		try {
			const name = (await SecureStore.getItemAsync("name")) ?? "John Doe";
			const cachedAvatar = await SecureStore.getItemAsync("avatarUri");
			setUserName(name);
			setAvatarUri(cachedAvatar);
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
				{/* Profile Header */}
				<View style={styles.profileHeader}>
					<Image 
						source={avatarUri ? { uri: avatarUri } : avatar} 
						style={styles.avatarContainer} 
					/>
					<Text style={styles.userName}>{userName}</Text>
				</View>

				{/* Profile Sections */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Account</Text>

					<TouchableOpacity
 						style={styles.menuItem}
 						onPress={() => {
							router.push("/edit-profile");
 						}}
 					>
 						<View style={styles.menuItemLeft}>
 							<Feather name="user" size={20} color={colors.textPrimary} />
 							<Text style={styles.menuItemText}>Edit Profile</Text>
 						</View>
 						<Feather name="chevron-right" size={20} color={colors.textSecondary} />
 					</TouchableOpacity>

				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Preferences</Text>

					<TouchableOpacity
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
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.menuItem}
						onPress={() => {
							Alert.alert("Funtionality to be added soon!");
						}}
					>
						<View style={styles.menuItemLeft}>
							<Feather name="settings" size={20} color={colors.textPrimary} />
							<Text style={styles.menuItemText}>Settings</Text>
						</View>
						<Feather name="chevron-right" size={20} color={colors.textSecondary} />
					</TouchableOpacity>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Help</Text>

					<TouchableOpacity
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
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.menuItem}
						onPress={handleContactSupport}
					>
						<View style={styles.menuItemLeft}>
							<Feather name="mail" size={20} color={colors.textPrimary} />
							<Text style={styles.menuItemText}>Contact Support</Text>
						</View>
						<Feather name="chevron-right" size={20} color={colors.textSecondary} />
					</TouchableOpacity>
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
		paddingBottom: 20,
	},
	profileHeader: {
		alignItems: "center",
		paddingVertical: 32,
		backgroundColor: colors.cardBackground,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
		marginBottom: 24,
	},
	avatarContainer: {
		width: 100,
		height: 100,
		borderRadius: 50,
		backgroundColor: colors.primary,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 16,
	},
	userName: {
		fontSize: 20,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 4,
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
