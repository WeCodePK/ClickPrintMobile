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
SplashScreen.preventAutoHideAsync();

//----------------------------------- COMPONENTS -----------------------------------//

const Login = () => {
	const router = useRouter();
	const [countryCode, setCountryCode] = useState("+92");
	const [phone, setPhone] = useState("");
	const [showPicker, setShowPicker] = useState(false);
	const [loading, setLoading] = useState(false);
	const [isReady, setReady] = useState(false);

	useEffect(() => {
		(async () => {
			try {
				const token = await SecureStore.getItemAsync("authToken");
				if (token) {
					console.log("Token found:", token);
					await SplashScreen.hideAsync();
					router.replace("(tabs)/home");
				} else {
					setReady(true);
				}
			} catch (error) {
				console.log("Error fetching token:", error);
				setReady(true);
			}
		})();
	}, [router]);

	const onLayoutRootView = useCallback(async () => {
		if (isReady) {
			await SplashScreen.hideAsync();
		}
	}, [isReady]);

	if (!isReady) {
		return null;
	}

	const countryCodes = [{ label: "🇵🇰 Pakistan +92", value: "+92" }];

	const numberWithPlus = countryCode + phone;
	const number = numberWithPlus.slice(1);

	const isValidPhone = phone.length > 0 && phone.length <= 11 && /^[1-9]\d{7,14}$/.test(number);

	const handleContinue = async () => {
		if (!isValidPhone) {
			Alert.alert("Please enter a valid phone number.");
			return;
		}
		setLoading(true);
		console.log("Requesting OTP for:", number);
		try {

			const response = await fetch(`${API_BASE_URL}/auth/otp`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ number: number }),
			});
			const data = await response.json();
			console.log(data.message);
			if (data.success) {
				router.replace({ pathname: "/otp", params: { phone: number } });
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

	const selectCountryCode = (code) => {
		setCountryCode(code);
		setShowPicker(false);
	};

	const getSelectedCountryDisplay = () => {
		const selected = countryCodes.find((c) => c.value === countryCode);
		if (selected) {
			const parts = selected.label.split(" ");
			if (parts.length >= 3) {
				return `${parts[0]} ${parts[parts.length - 1]}`;
			}
			return selected.label;
		}
		return countryCode;
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
			<TouchableWithoutFeedback
				onPress={() => {
					Keyboard.dismiss();
					setShowPicker(false);
				}}
				accessible={false}
			>
				<SafeAreaView style={styles.container} onLayout={onLayoutRootView}>
					<Text style={styles.heading}>Let&apos;s get started!</Text>
					<Text style={styles.subHeading}>Please enter your mobile number</Text>

					<View style={styles.phoneRow}>
						{/* Country Code */}
						<View style={styles.countryCodeWrapper}>
							<TouchableOpacity style={styles.countryBox} onPress={() => setShowPicker(!showPicker)}>
								<Text style={styles.countryCodeText}>{getSelectedCountryDisplay()}</Text>
								<Ionicons name={showPicker ? "chevron-up" : "chevron-down"} size={18} color="#000" />
							</TouchableOpacity>

							{/* Dropdown */}
							{showPicker && (
								<View style={styles.dropdown}>
									{countryCodes.map((item) => (
										<TouchableOpacity
											key={item.value}
											style={[styles.dropdownOption, countryCode === item.value && styles.dropdownOptionSelected]}
											onPress={() => selectCountryCode(item.value)}
										>
											<Text
												style={[
													styles.dropdownOptionText,
													countryCode === item.value && styles.dropdownOptionTextSelected,
												]}
											>
												{item.label}
											</Text>
											{countryCode === item.value && <Ionicons name="checkmark" size={18} color="#FF4F00" />}
										</TouchableOpacity>
									))}
								</View>
							)}
						</View>

						{/* Phone Input */}
						<View style={styles.phoneBox}>
							<TextInput
								style={styles.input}
								placeholder="3012345678"
								placeholderTextColor="#999"
								keyboardType="number-pad"
								value={phone}
								onChangeText={setPhone}
								maxLength={15}
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
		alignItems: "flex-start",
		marginBottom: 30,
		position: "relative",
		zIndex: 1,
	},

	countryCodeWrapper: {
		position: "relative",
		zIndex: 10,
		marginRight: 10,
	},

	countryBox: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgb(236, 228, 228)",
		paddingHorizontal: 14,
		height: 40,
		borderRadius: 25,
		gap: 6,
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
	dropdown: {
		position: "absolute",
		top: 55,
		left: 0,
		right: 0,
		backgroundColor: "#fff",
		borderRadius: 12,
		paddingVertical: 8,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 8,
		elevation: 5,
		minWidth: 180,
		zIndex: 1000,
	},
	dropdownOption: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		marginHorizontal: 8,
		marginVertical: 2,
	},
	dropdownOptionSelected: {
		backgroundColor: "#fff3f0",
	},
	dropdownOptionText: {
		fontSize: 15,
		color: "#000",
		flex: 1,
	},
	dropdownOptionTextSelected: {
		color: "#FF4F00",
		fontWeight: "600",
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
