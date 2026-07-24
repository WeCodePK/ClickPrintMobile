//----------------------------------- IMPORTS -----------------------------------//

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DismissKeyboard from "../components/DismissKeyboard";
import config from "../config/config";
import { colors } from "../constants/colors";
import { useAuth } from "../context/auth";
import { showAlert } from "../utils/alert";
import SecureStore from "../utils/storage";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;
const KEYBOARD_EXTRA_OFFSET = 20;

//----------------------------------- COMPONENTS -----------------------------------//

const ProfileSetup = () => {
	const router = useRouter();
	const { completeProfile } = useAuth();
	const [userName, setUserName] = useState("");
	const [loading, setLoading] = useState(false);
	const [keyboardOffset, setKeyboardOffset] = useState(0);

	useEffect(() => {
		if (Platform.OS === "web") {
			const viewport = typeof window !== "undefined" ? window.visualViewport : null;
			if (!viewport) return;

			const handleViewportChange = () => {
				const offset = window.innerHeight - viewport.height - viewport.offsetTop;
				setKeyboardOffset(offset > 0 ? offset + KEYBOARD_EXTRA_OFFSET : 0);
			};

			viewport.addEventListener("resize", handleViewportChange);
			viewport.addEventListener("scroll", handleViewportChange);

			return () => {
				viewport.removeEventListener("resize", handleViewportChange);
				viewport.removeEventListener("scroll", handleViewportChange);
			};
		}

		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

		const showSub = Keyboard.addListener(showEvent, (e) => {
			setKeyboardOffset(e.endCoordinates.height + KEYBOARD_EXTRA_OFFSET);
		});
		const hideSub = Keyboard.addListener(hideEvent, () => {
			setKeyboardOffset(0);
		});

		return () => {
			showSub.remove();
			hideSub.remove();
		};
	}, []);

	const trimmedName = userName.trim();

	const handleContinue = async () => {
		if (!trimmedName || loading) return;

		setLoading(true);

		try {
			const token = await SecureStore.getItemAsync("authToken");
			const userId = await SecureStore.getItemAsync("userId");

			const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ name: trimmedName }),
			});

			const data = await response.json();

			if (response.ok) {
				await completeProfile(data.data.user.name);
				router.replace("/(tabs)/home");
			} else {
				showAlert("Error", data.message || "Failed to save profile. Please try again.");
			}
		} catch (error) {
			console.error("Profile setup error:", error);
			if (error.message === "Network request failed") {
				showAlert("No Internet", "Please check your internet connection and try again.");
			} else {
				showAlert("Error", "An unexpected error occurred. Please try again.");
			}
		} finally {
			setLoading(false);
		}
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<View style={{ flex: 1, backgroundColor: colors.background }}>
			<DismissKeyboard>
				<SafeAreaView style={[styles.container, { paddingBottom: keyboardOffset }]}>
					<Text style={styles.heading}>Let&apos;s get started!</Text>
					<Text style={styles.subHeading}>What would you like us to call you?</Text>

					<View style={styles.inputBox}>
						<TextInput
							style={styles.input}
							placeholder="Enter your name"
							placeholderTextColor="#999"
							value={userName}
							onChangeText={setUserName}
							editable={!loading}
							autoFocus
						/>
					</View>

					<TouchableOpacity
						style={[styles.button, (!trimmedName || loading) && styles.buttonDisabled]}
						disabled={!trimmedName || loading}
						onPress={handleContinue}
					>
						{loading ? (
							<ActivityIndicator color="#fff" />
						) : (
							<>
								<Text style={styles.buttonText}>Continue</Text>
								<Ionicons name="arrow-forward" size={19} color={"#fff"} />
							</>
						)}
					</TouchableOpacity>
				</SafeAreaView>
			</DismissKeyboard>
		</View>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: 20,
		justifyContent: "center",
		marginBottom: 10,
	},
	heading: {
		fontSize: 28,
		color: colors.textPrimary,
		fontWeight: "bold",
		marginBottom: 10,
		marginTop: 100,
		marginLeft: 5,
	},
	subHeading: {
		fontSize: 16,
		color: colors.textPrimary,
		marginBottom: 40,
		marginTop: 5,
		marginLeft: 5,
	},
	inputBox: {
		backgroundColor: "rgb(236, 228, 228)",
		height: 40,
		borderRadius: 25,
		paddingHorizontal: 15,
		justifyContent: "center",
		marginBottom: 30,
	},
	input: {
		fontSize: 16,
		color: "#000",
		// Remove the browser's default focus outline on web (renders as a
		// rectangle inside the pill-shaped input). No-op on native.
		...Platform.select({ web: { outlineStyle: "none" } }),
	},
	button: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#FF4F00",
		paddingVertical: 15,
		borderRadius: 10,
		marginTop: "auto",
	},
	buttonDisabled: {
		backgroundColor: colors.navInactive,
		opacity: 1,
	},
	buttonText: {
		color: "#fff",
		fontSize: 16,
		marginRight: 10,
		fontWeight: "bold",
	},
});

export default ProfileSetup;
