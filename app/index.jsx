//----------------------------------- IMPORTS -----------------------------------//

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DismissKeyboard from "../components/DismissKeyboard";
import config from "../config/config";
import { colors } from "../constants/colors";
import { showAlert } from "../utils/alert";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;
const COUNTRY_CODE = "+92";

//----------------------------------- COMPONENTS -----------------------------------//

const KEYBOARD_EXTRA_OFFSET = 20;

const Login = () => {
	const router = useRouter();
	const [phone, setPhone] = useState("");
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

	const sanitizePhone = (raw) => {
		const digitsOnly = raw.replace(/[^0-9]/g, "");
		return digitsOnly.replace(/^0/, "");
	};

	const handlePhoneChange = (text) => {
		setPhone(sanitizePhone(text));
	};

	const isValidPhone = /^3\d{9}$/.test(phone);

	const handleContinue = async () => {
		if (!isValidPhone) {
			showAlert("Please enter a valid phone number.");
			return;
		}

		setLoading(true);
		console.log("Requesting OTP for:", phone);

		try {
			const response = await fetch(`${API_BASE_URL}/auth/otp`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ number: `92${phone}`, intent: 'user' }),
			});

			if (!response.ok) {
				showAlert("Error", "Failed to send OTP. Please try again.");
				console.error("OTP request failed with status:", response.status);
				return;
			}

			const data = await response.json();
			console.log(data.message);
			if (data.success) {
				router.replace({ pathname: "/otp", params: { phone: `92${phone}` } });
			} else {
				showAlert("Error", "Failed to send OTP. Please try again.");
				console.error("OTP request failed:", data.message);
			}

		} catch (error) {
			console.error("Error sending OTP:", error);
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
					<Text style={styles.subHeading}>Please enter your mobile number</Text>

					<View style={styles.phoneRow}>

						<View style={styles.countryBox}>
							<Text style={styles.countryCodeText}>🇵🇰 {COUNTRY_CODE}</Text>
						</View>


						<View style={styles.phoneBox}>
							<TextInput
								style={styles.input}
								placeholder="3012345678"
								placeholderTextColor="#999"
								keyboardType="number-pad"
								value={phone}
								onChangeText={handlePhoneChange}
								maxLength={10}
							/>
						</View>
					</View>

					<TouchableOpacity
						style={[styles.button, (!isValidPhone || loading) && styles.buttonDisabled]}
						disabled={!isValidPhone || loading}
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


	phoneRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 30,
	},

	countryBox: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgb(236, 228, 228)",
		paddingHorizontal: 14,
		height: 40,
		borderRadius: 25,
		marginRight: 10,
	},

	phoneBox: {
		flex: 1,
		backgroundColor: "rgb(236, 228, 228)",
		height: 40,
		borderRadius: 25,
		paddingHorizontal: 10,
		justifyContent: "center",
	},

	input: {
		fontSize: 16,
		color: "#000",
		// Remove the browser's default focus outline on web (renders as a
		// rectangle inside the pill-shaped input). No-op on native.
		...Platform.select({ web: { outlineStyle: "none" } }),
	},
	countryCodeText: {
		color: "#000",
		fontSize: 14,
		fontWeight: "500",
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

export default Login;
