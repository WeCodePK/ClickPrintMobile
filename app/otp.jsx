//----------------------------------- IMPORTS -----------------------------------//

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DismissKeyboard from "../components/DismissKeyboard";
import config from "../config/config";
import { colors } from "../constants/colors";
import { useAuth } from "../context/auth";
import { showAlert } from "../utils/alert";
import SecureStore from "../utils/storage";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

const VerifyCode = () => {
	const router = useRouter();
	const params = useLocalSearchParams();
	const phoneNumber = params.phone;

	const [codes, setCodes] = useState(["", "", "", "", ""]);
	const [timer, setTimer] = useState(90);
	const [showErrorModal, setShowErrorModal] = useState(false);
	const [verifying, setVerifying] = useState(false);
	const [resending, setResending] = useState(false);
	const inputRefs = useRef([]);

	const { signIn } = useAuth();

	useEffect(() => {
		if (timer > 0) {
			const interval = setInterval(() => {
				setTimer((prev) => prev - 1);
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [timer]);

	const handleCodeChange = (value, index) => {
		if (value.length > 1) {

			const digits = value.replace(/\D/g, "").slice(0, 5 - index);
			if (!digits) return;
			const newCodes = [...codes];
			digits.split("").forEach((digit, i) => {
				newCodes[index + i] = digit;
			});
			setCodes(newCodes);
			const lastFilled = Math.min(index + digits.length - 1, 4);
			inputRefs.current[lastFilled]?.focus();
			if (newCodes.every((code) => code !== "") && !verifying) {
				handleVerify(newCodes.join(""));
			}
			return;
		}
		const newCodes = [...codes];
		newCodes[index] = value;
		setCodes(newCodes);
		if (value && index < 4) {
			inputRefs.current[index + 1]?.focus();
		}
		if (newCodes.every((code) => code !== "") && !verifying) {
			handleVerify(newCodes.join(""));
		}
	};

	const handleKeyPress = (e, index) => {
		if (e.nativeEvent.key === "Backspace" && !codes[index] && index > 0) {
			inputRefs.current[index - 1]?.focus();
		}
	};

	const handleVerify = async (code) => {
		if (verifying) return;
		setVerifying(true);
		try {
			const response = await fetch(`${API_BASE_URL}/auth/verify`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ code, number: phoneNumber, actor: "user" }),
			});
			const body = await response.json();
			if (body.success) {
				console.log(body);
				await signIn(body.data.token, body.data.user)
				console.log("OTP verified successfully for", phoneNumber);

	 			if (body.data.user && body.data.user.name) {
					await SecureStore.setItemAsync("name", body.data.user.name);
					router.replace("/(tabs)/home");
				} else {
					router.replace("/profile-setup");
				}
			} else {
				setShowErrorModal(true);
			}
		} catch (error) {
			console.error("Error verifying OTP:", error);
			setShowErrorModal(true);
		} finally {
			setVerifying(false);
		}
	};



	const handleResendCode = async () => {
		if (timer > 0 || resending) return;
		setResending(true);
		try {
			const response = await fetch(`${API_BASE_URL}/auth/otp`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ number: phoneNumber, intent: 'user' }),
			});
			const data = await response.json();
			if (data.success) {
				setCodes(["", "", "", "", ""]);
				setTimer(30);
				inputRefs.current[0]?.focus();
			} else {
				showAlert("Error", "Failed to send OTP. Please try again.");
				console.error("OTP request failed:", data.message);
			}
		} catch (error) {
			console.error("Error sending OTP:", error);
			showAlert("Error", "An unexpected error occurred. Please try again.");
		} finally {
			setResending(false);
		}
	};

	const handleClearAndRetry = () => {
		setShowErrorModal(false);
		setCodes(["", "", "", "", ""]);
		inputRefs.current[0]?.focus();
	};

	const handleBack = () => {
		setCodes(["", "", "", "", ""]);
		router.replace("/");
	};

	useFocusEffect(
		useCallback(() => {
			const onBackPress = () => {
				handleBack();
				return true; 
			};

			const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
			return () => subscription.remove();
		}, [])
	);

	const formatTimer = (seconds) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<DismissKeyboard>
		<SafeAreaView style={styles.container}>
			<TouchableOpacity style={styles.backButton} onPress={handleBack}>
				<Ionicons name="arrow-back" size={24} />
			</TouchableOpacity>

			<Text style={styles.title}>Enter verification code</Text>

			<View style={styles.instructionContainer}>
				<Text style={styles.instructionText}>We&apos;ve sent it to +{phoneNumber} via</Text>
				<View style={styles.whatsappContainer}>
					<Ionicons name="logo-whatsapp" size={18} color="#25D366" />
					<Text style={styles.whatsappText}>Whatsapp</Text>
				</View>
			</View>



			<View style={styles.codeContainer}>
				{codes.map((code, index) => (
					<TextInput
						key={index}
						ref={(ref) => (inputRefs.current[index] = ref)}
						style={styles.codeInput}
						value={code}
						onChangeText={(value) => handleCodeChange(value, index)}
						onKeyPress={(e) => handleKeyPress(e, index)}
						keyboardType="number-pad"
						selectTextOnFocus
						autoFocus={index === 0}
					/>
				))}
			</View>



			<View style={styles.timerContainer}>
				{timer > 0 ? (
					<Text style={styles.timerText}>Resend available in {formatTimer(timer)}</Text>
				) : (
					<View style={styles.actionContainer}>
						<TouchableOpacity onPress={handleResendCode} style={styles.resendButton} disabled={resending}>
							{resending ? (
								<ActivityIndicator color={colors.textPrimary} size="small" />
							) : (
								<Text style={styles.resendText}>Resend code</Text>
							)}
						</TouchableOpacity>
					</View>
				)}
			</View>

			<Modal visible={showErrorModal} transparent={true} animationType="slide" onRequestClose={() => setShowErrorModal(false)}>
				<View style={styles.errorModalOverlay}>
					<View style={styles.errorModalContent}>
						<Text style={styles.errorModalTitle}>Oops</Text>
						<Text style={styles.errorModalMessage}>Something went wrong. Please try again.</Text>

						<TouchableOpacity style={styles.errorCancelButton} onPress={() => setShowErrorModal(false)}>
							<Text style={styles.errorCancelText}>Cancel</Text>
							<Ionicons name="close" size={20} color="#FF4F00" />
						</TouchableOpacity>

						<TouchableOpacity style={styles.errorTryAgainButton} onPress={handleClearAndRetry}>
							<Text style={styles.errorTryAgainText}>Try again</Text>
							<Ionicons name="arrow-forward" size={20} color="#fff" />
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</SafeAreaView>
		</DismissKeyboard>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: 20,
		paddingTop: 20,
	},
	backButton: {
		marginBottom: 30,
		marginTop: 10,
	},
	title: {
		fontSize: 32,
		color: colors.textPrimary,
		fontWeight: "bold",
		marginBottom: 15,
	},
	instructionContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		marginBottom: 50,
	},
	instructionText: {
		fontSize: 16,
		color: colors.textPrimary,
		marginRight: 5,
	},
	whatsappContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
	},
	whatsappText: {
		fontSize: 16,
		color: colors.textPrimary,
		fontWeight: "600",
	},
	codeContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 40,
		gap: 15,
	},
	codeInput: {
		flex: 1,
		minWidth: 0,
		height: 60,
		borderBottomWidth: 2,
		borderBottomColor: "#938b8b",
		textAlign: "center",
		fontSize: 32,
		color: colors.textPrimary,
		fontWeight: "600",
		paddingVertical: 10,
		// Remove the browser's default focus outline on web (renders as a
		// solid rectangle around the input). No-op on native.
		...Platform.select({ web: { outlineStyle: "none" } }),
	},


	timerContainer: {
		marginTop: "auto",
		marginBottom: 30,
	},
	timerText: {
		textAlign: "center",
		fontSize: 16,
		color: colors.textSecondary,
	},
	actionContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
	},
	resendButton: {
		paddingVertical: 5,
	},
	resendText: {
		fontSize: 16,
		color: colors.textPrimary,
		fontWeight: "600",
		textDecorationLine: "underline",
	},
	errorModalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	errorModalContent: {
		backgroundColor: "#fff",
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		paddingTop: 30,
		paddingBottom: 50,
		paddingHorizontal: 25,
	},
	errorModalTitle: {
		fontSize: 28,
		fontWeight: "bold",
		color: "#000",
		marginBottom: 15,
		textAlign: "center",
	},
	errorModalMessage: {
		fontSize: 16,
		color: "#666",
		marginBottom: 30,
		textAlign: "center",
	},
	errorCancelButton: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#FF7F66",
		borderRadius: 12,
		paddingVertical: 15,
		paddingHorizontal: 20,
		marginBottom: 15,
		backgroundColor: "#fff",
	},
	errorCancelText: {
		fontSize: 16,
		color: "#FF4F00",
		fontWeight: "600",
	},
	errorTryAgainButton: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		backgroundColor: "#FF7F66",
		borderRadius: 12,
		paddingVertical: 15,
		paddingHorizontal: 20,
	},
	errorTryAgainText: {
		fontSize: 16,
		color: "#fff",
		fontWeight: "600",
	},
});

export default VerifyCode;
