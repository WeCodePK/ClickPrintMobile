//----------------------------------- IMPORTS -----------------------------------//

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;
const COUNTRY_CODE = "+92";

//----------------------------------- COMPONENTS -----------------------------------//

const Login = () => {
	const router = useRouter();
	const [phone, setPhone] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {

		(async () => {
			try {
				const token = await SecureStore.getItemAsync("authToken");
				if (token) {
					const response = await fetch(`${API_BASE_URL}/profile`, {
						headers: { Authorization: `Bearer ${token}` },
					});
					if (response.ok) {
						const data = await response.json();
						if (data.data?.profile?.name) {
							await SecureStore.setItemAsync("name", data.data.profile.name);
						}
						router.replace("(tabs)/home");
						return;
					}
					await SecureStore.deleteItemAsync("authToken");
					await SecureStore.deleteItemAsync("name");
				}
			} catch (error) {
				console.log("Error validating token:", error);
			} finally {

				await SplashScreen.hideAsync();
			}
		})();
	}, [router]);

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
			Alert.alert("Please enter a valid phone number.");
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
				body: JSON.stringify({ number: `92${phone}` }),
			});

			if (!response.ok) {
				Alert.alert("Error", "Failed to send OTP. Please try again.");
				console.error("OTP request failed with status:", response.status);
				return;
			}

			const data = await response.json();
			console.log(data.message);
			if (data.success) {
				router.replace({ pathname: "/otp", params: { phone: `92${phone}` } });
			} else {
				Alert.alert("Error", "Failed to send OTP. Please try again.");
				console.error("OTP request failed:", data.message);
			}

		} catch (error) {
			console.error("Error sending OTP:", error);
			if (error.message === "Network request failed") {
				Alert.alert("No Internet", "Please check your internet connection and try again.");
			} else {
				Alert.alert("Error", "An unexpected error occurred. Please try again.");
			}
		} finally {
			setLoading(false);
		}
	};



	//----------------------------------- RENDER -----------------------------------//

	return (
		<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
			<TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
				<SafeAreaView style={styles.container}>
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
			</TouchableWithoutFeedback>
		</KeyboardAvoidingView>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: 20,
		justifyContent: "center",
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
		marginBottom: 40,
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
