//----------------------------------- IMPORTS -----------------------------------//

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

const ProfileSetup = () => {
	const router = useRouter();
	const [userName, setUserName] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	// Animations
	const scaleAnim = useRef(new Animated.Value(0)).current;
	const opacityAnim = useRef(new Animated.Value(0)).current;
	const slideAnim = useRef(new Animated.Value(50)).current;
	const buttonScaleAnim = useRef(new Animated.Value(1)).current;
	const checkmarkAnim = useRef(new Animated.Value(0)).current;


	const trimedName = userName.trim();

	useEffect(() => {
		// Entrance animation
		Animated.parallel([
			Animated.timing(scaleAnim, {
				toValue: 1,
				duration: 600,
				useNativeDriver: true,
			}),
			Animated.timing(opacityAnim, {
				toValue: 1,
				duration: 600,
				useNativeDriver: true,
			}),
			Animated.timing(slideAnim, {
				toValue: 0,
				duration: 600,
				useNativeDriver: true,
			}),
		]).start();
	}, [opacityAnim, scaleAnim, slideAnim]);

	const handleSubmit = async () => {
		const token = await SecureStore.getItemAsync("authToken");

		if (trimedName.length < 5 || trimedName.length > 20) {
			setError("Name must be between 5 and 20 characters.");
			return;
		}

		if (!/^[A-Za-z\s]+$/.test(trimedName)) {
			setError("Only letters and spaces are allowed.");
			return;
		}

		if (/\s{2,}/.test(trimedName)) {
			setError("Name cannot contain multiple consecutive spaces.");
			return;
		}

		setError("");
		setLoading(true);

		Animated.sequence([
			Animated.timing(buttonScaleAnim, {
				toValue: 0.95,
				duration: 100,
				useNativeDriver: true,
			}),
			Animated.timing(buttonScaleAnim, {
				toValue: 1,
				duration: 100,
				useNativeDriver: true,
			}),
		]).start();

		try {
			const response = await fetch(`${API_BASE_URL}/profile`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					name: trimedName,
				}),
			});

			const data = await response.json();

			if (response.ok) {
				await SecureStore.setItemAsync("name", data.data.profile.name);
				setSuccess(true);

				Animated.timing(checkmarkAnim, {
					toValue: 1,
					duration: 600,
					useNativeDriver: true,
				}).start();

				setTimeout(() => {
					router.replace("/(tabs)/home");
				}, 1500);
			} else {
				setError(data.message || "Failed to save profile");
				setLoading(false);
			}
		} catch (err) {
			console.error("Profile setup error:", err);
			setError("Connection error. Please check your internet and try again.");
			setLoading(false);
		}
	};

	const handleInputChange = (text) => {
		setUserName(text);
		if (error) setError("");
	};

	const inputScale = slideAnim.interpolate({
		inputRange: [0, 50],
		outputRange: [1, 0.95],
	});

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container}>
			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flexContainer}>
				<Animated.View
					style={[
						styles.content,
						{
							opacity: opacityAnim,
							transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
						},
					]}
				>
					{!success ? (
						<>
							{/* Header Section */}
							<View style={styles.headerSection}>
								<View style={styles.avatarPlaceholder}>
									<MaterialCommunityIcons name="account-circle" size={80} color={colors.primary} />
								</View>

								<Text style={styles.title}>Let&apos;s get started</Text>
								<Text style={styles.subtitle}>What would you like us to call you?</Text>
							</View>

							{/* Input Section */}
							<View style={styles.inputSection}>
								<Animated.View style={[styles.inputWrapper, { transform: [{ scale: inputScale }] }]}>
									<View style={[styles.inputContainer, error && styles.inputContainerError]}>
										<MaterialCommunityIcons
											name="pencil"
											size={20}
											color={error ? "#FF4F00" : colors.primary}
											style={styles.inputIcon}
										/>
										<TextInput
											style={styles.textInput}
											placeholder="Enter your name"
											placeholderTextColor={colors.textSecondary}
											value={userName}
											onChangeText={handleInputChange}
											editable={!loading}
											maxLength={20}
										/>
									</View>
								</Animated.View>

								{error ? (
									<Animated.View style={{ opacity: opacityAnim }}>
										<Text style={styles.errorText}>{error}</Text>
									</Animated.View>
								) : (
									<Text style={styles.helperText}>
										{trimedName.length}/20 characters (5-20 required)
									</Text>
								)}
							</View>

							{/* Submit Button */}
							<Animated.View
								style={{
									transform: [{ scale: buttonScaleAnim }],
								}}
							>
								<TouchableOpacity
									style={[
										styles.submitButton,
										(loading ||
											trimedName.length < 5 ||
											trimedName.length > 20) &&
										styles.submitButtonLoading,
									]}
									onPress={handleSubmit}
									disabled={loading || trimedName.length < 5 || trimedName.length > 20}
								>
									{loading ? (
										<View style={styles.loadingContainer}>
											<Text style={styles.submitButtonText}>Saving...</Text>
										</View>
									) : (
										<View style={styles.buttonContent}>
											<Text style={styles.submitButtonText}>Continue</Text>
											<MaterialCommunityIcons
												name="arrow-right"
												size={20}
												color="#fff"
												style={{ marginLeft: 10 }}
											/>
										</View>
									)}
								</TouchableOpacity>
							</Animated.View>

							{/* Bottom accent */}
							<View style={styles.bottomAccent} />
						</>
					) : (
						<View style={styles.successContainer}>
							<Animated.View
								style={{
									opacity: checkmarkAnim,
									transform: [
										{
											scale: checkmarkAnim.interpolate({
												inputRange: [0, 0.5, 1],
												outputRange: [0, 1.2, 1],
											}),
										},
									],
								}}
							>
								<MaterialCommunityIcons name="check-circle" size={100} color={colors.primary} />
							</Animated.View>
							<Text style={styles.successTitle}>Welcome, {userName}!</Text>
							<Text style={styles.successSubtitle}>Profile setup complete</Text>
						</View>
					)}
				</Animated.View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	flexContainer: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingHorizontal: 24,
		justifyContent: "space-between",
		paddingVertical: 20,
	},
	headerSection: {
		alignItems: "center",
		marginTop: 30,
		marginBottom: 50,
	},
	avatarPlaceholder: {
		marginBottom: 30,
	},
	title: {
		fontSize: 32,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 10,
		textAlign: "center",
	},
	subtitle: {
		fontSize: 16,
		color: colors.textSecondary,
		textAlign: "center",
		lineHeight: 22,
	},
	inputSection: {
		marginBottom: 30,
	},
	inputWrapper: {
		marginBottom: 12,
	},
	inputContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.cardBackground,
		borderRadius: 14,
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderWidth: 2,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowPrimary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 3,
	},
	inputContainerError: {
		borderColor: "#FF4F00",
		shadowColor: "#FF4F00",
		shadowOpacity: 0.15,
	},
	inputIcon: {
		marginRight: 12,
	},
	textInput: {
		flex: 1,
		fontSize: 16,
		color: colors.textPrimary,
		fontWeight: "500",
		paddingVertical: 8,
	},
	errorText: {
		fontSize: 14,
		color: "#FF4F00",
		fontWeight: "600",
		marginLeft: 4,
	},
	helperText: {
		fontSize: 13,
		color: colors.textSecondary,
		marginLeft: 4,
	},
	submitButton: {
		backgroundColor: colors.primary,
		borderRadius: 14,
		paddingVertical: 16,
		paddingHorizontal: 24,
		justifyContent: "center",
		alignItems: "center",
		shadowColor: colors.shadowPrimary,
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.3,
		shadowRadius: 12,
		elevation: 6,
		marginBottom: 20,
	},
	submitButtonLoading: {
		opacity: 0.8,
	},
	buttonContent: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	submitButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: "#fff",
	},
	loadingContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	bottomAccent: {
		height: 4,
		backgroundColor: colors.primary,
		borderRadius: 2,
		marginTop: "auto",
		opacity: 0.3,
		marginBottom: 10,
	},
	successContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	successTitle: {
		fontSize: 28,
		fontWeight: "700",
		color: colors.textPrimary,
		marginTop: 24,
		textAlign: "center",
	},
	successSubtitle: {
		fontSize: 16,
		color: colors.textSecondary,
		marginTop: 10,
		textAlign: "center",
	},
});

export default ProfileSetup;
