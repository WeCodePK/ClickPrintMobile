//----------------------------------- IMPORTS -----------------------------------//

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import appLogo from "../assets/icon.png";
import DismissKeyboard from "../components/DismissKeyboard";
import { colors } from "../constants/colors";
import { showAlert } from "../utils/alert";
import { apiFetch } from "../utils/api";
import { friendlyMessage, isConnectionError } from "../utils/errors";

//----------------------------------- CONSTANTS -----------------------------------//

const COUNTRY_CODE = "+92";

//----------------------------------- COMPONENTS -----------------------------------//

const KEYBOARD_EXTRA_OFFSET = 20;

const Login = () => {
	const router = useRouter();
	const [phone, setPhone] = useState("");
	const [loading, setLoading] = useState(false);
	const [keyboardOffset, setKeyboardOffset] = useState(0);
	const [phoneFocused, setPhoneFocused] = useState(false);

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
			// Not retried automatically: each request texts a new code.
			const data = await apiFetch("/auth/otp", {
				method: "POST",
				auth: false,
				retries: 0,
				body: { number: `92${phone}`, intent: "user" },
			});
			const otpConfig = data?.data?.config || {};
			router.replace({
				pathname: "/otp",
				params: {
					phone: `92${phone}`,
					codeLength: otpConfig.codeLength,
					resendInMs: otpConfig.resendInMs,
				},
			});
		} catch (error) {
			console.error("Error sending OTP:", error);
			if (isConnectionError(error)) {
				showAlert("No Internet", friendlyMessage(error));
			} else {
				showAlert("Couldn't send the code", friendlyMessage(error, "Failed to send OTP. Please try again."));
			}
		} finally {
			setLoading(false);
		}
	};



	//----------------------------------- RENDER -----------------------------------//

	return (
		<View style={{ flex: 1, backgroundColor: colors.background }}>
			<DismissKeyboard>
				{/* Keep the same bottom gap with the keyboard closed as the keyboard's extra offset
				    gives when it's open, so the button doesn't sit lower before the first focus. */}
				<SafeAreaView style={[styles.container, { paddingBottom: keyboardOffset || KEYBOARD_EXTRA_OFFSET }]}>
					{/* Logo + two-tone wordmark, as on ClickPrintDesktop's login screen */}
					<View style={styles.brandRow}>
						<Image source={appLogo} style={styles.logo} resizeMode="contain" />
						<Text style={styles.brandText}>
							Click<Text style={styles.brandTextAccent}>Print</Text>
						</Text>
					</View>

					<Text style={styles.heading}>Let&apos;s get started!</Text>
					<Text style={styles.subHeading}>Please enter your mobile number to receive a verification code</Text>

					<View style={styles.phoneRow}>

						<View style={styles.countryBox}>
							<Text style={styles.countryCodeText}>🇵🇰 {COUNTRY_CODE}</Text>
						</View>


						<View style={[styles.phoneBox, phoneFocused && styles.phoneBoxFocused]}>
							<TextInput
								style={styles.input}
								placeholder="3012345678"
								placeholderTextColor="#999"
								keyboardType="number-pad"
								value={phone}
								onChangeText={handlePhoneChange}
								onFocus={() => setPhoneFocused(true)}
								onBlur={() => setPhoneFocused(false)}
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
	brandRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		marginTop: 60,
		marginBottom: 40,
	},
	logo: {
		width: 42,
		height: 42,
		borderRadius: 8,
	},
	brandText: {
		fontSize: 18,
		fontWeight: "800",
		letterSpacing: -0.3,
		color: colors.textPrimary,
	},
	brandTextAccent: {
		color: colors.primary,
	},
	heading: {
		fontSize: 26,
		lineHeight: 32,
		fontWeight: "800",
		color: colors.textPrimary,
		marginBottom: 6,
	},
	subHeading: {
		fontSize: 15,
		lineHeight: 22,
		color: colors.textSecondary,
		marginBottom: 36,
	},

	// Squarish 48px fields, matching ClickPrintDesktop's .country-code / .phone-input.
	phoneRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		marginBottom: 24,
	},

	countryBox: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#E5E7EB",
		paddingHorizontal: 14,
		height: 48,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: "transparent",
	},

	phoneBox: {
		flex: 1,
		backgroundColor: "#E5E7EB",
		height: 48,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: "transparent",
		paddingHorizontal: 16,
		justifyContent: "center",
	},
	phoneBoxFocused: {
		backgroundColor: "#D1D5DB",
		borderColor: colors.primary,
	},

	input: {
		fontSize: 16,
		fontWeight: "500",
		color: colors.textPrimary,
		// Remove the browser's default focus outline on web (renders as a
		// rectangle inside the pill-shaped input). No-op on native.
		...Platform.select({ web: { outlineStyle: "none" } }),
	},
	countryCodeText: {
		color: colors.textPrimary,
		fontSize: 14,
		fontWeight: "500",
	},
	button: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#FF4F00",
		paddingVertical: 15,
		borderRadius: 12,
		marginTop: "auto",
		
		
	},
	buttonDisabled: {
		backgroundColor: colors.navInactive,
		opacity: 1,
	},

	buttonText: {
		color: "#fff",
		fontSize: 15,
		marginRight: 10,
		fontWeight: "600",
	},
});

export default Login;
