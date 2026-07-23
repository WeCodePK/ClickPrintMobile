//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";
import { showAlert } from "../utils/alert";
import SecureStore from "../utils/storage";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

// Top ups are collected into a single centralised account managed by ClickPrint.
const CLICKPRINT_ACCOUNT_NAME = "ClickPrint";
const CLICKPRINT_EASYPAISA_NUMBER = "03235400291";

//----------------------------------- COMPONENTS -----------------------------------//

const TopUpConfirm = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams();
	const amount = params.amount;

	const [error, setError] = useState(null);
	const [proof, setProof] = useState(null); // ImagePicker asset
	const [submitting, setSubmitting] = useState(false);

	const handlePickProof = async () => {
		try {
			if (Platform.OS !== "web") {
				const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
				if (!permission.granted) {
					showAlert("Permission needed", "Please allow photo access to upload a payment screenshot.");
					return;
				}
			}
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ["images"],
				quality: 0.8,
			});
			if (!result.canceled && result.assets?.length > 0) {
				setProof(result.assets[0]);
			}
		} catch (err) {
			console.error("Error picking proof:", err);
			showAlert("Error", "Failed to pick image. Please try again.");
		}
	};

	// Upload the payment screenshot to the Files endpoint and return its id.
	const uploadProof = async (token) => {
		const formData = new FormData();
		const fileName = proof.fileName || `payment-proof.${(proof.uri.split(".").pop() || "jpg").split("?")[0]}`;
		if (Platform.OS === "web") {
			// On web FormData needs a real Blob; the picked uri is a blob: URL.
			let filePart = proof.file;
			if (!filePart) {
				const res = await fetch(proof.uri);
				filePart = await res.blob();
			}
			formData.append("file", filePart, fileName);
		} else {
			formData.append("file", {
				uri: proof.uri,
				name: fileName,
				type: proof.mimeType || "image/jpeg",
			});
		}
		// Payment screenshots are stored as-is, never converted.
		formData.append("convert", "false");

		const response = await fetch(`${API_BASE_URL}/files`, {
			method: "POST",
			headers: { Authorization: `Bearer ${token}` },
			body: formData,
		});
		const body = await response.json();
		if (response.status !== 201) {
			throw new Error(body.message || "Failed to upload payment proof.");
		}
		return body.data.file._id;
	};

	const handleConfirm = async () => {
		if (!proof) {
			showAlert("Payment proof required", "Please upload a screenshot of your payment to continue.");
			return;
		}
		try {
			setSubmitting(true);
			setError(null);
			const token = await SecureStore.getItemAsync("authToken");

			const paymentProofFile = await uploadProof(token);

			const payload = { amount: Number(amount), paymentProofFile };

			const response = await fetch(`${API_BASE_URL}/topups`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});
			const body = await response.json();
			if (response.status !== 201 && !response.ok) {
				throw new Error(body.message || "Failed to submit top up request.");
			}

			showAlert("Top Up Requested", "Your top up request has been submitted. It will be credited once ClickPrint confirms your payment.", [
				{ text: "OK", onPress: () => router.replace("/topup") },
			]);
		} catch (err) {
			console.error("Error submitting top up:", err);
			setError(err.message || "Failed to submit top up request. Please try again.");
			showAlert("Error", err.message || "Failed to submit top up request. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Confirm Top Up</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
				{/* Amount summary */}
				<View style={styles.amountCard}>
					<Text style={styles.amountLabel}>Top Up Amount</Text>
					<Text style={styles.amountValue}>Rs. {amount}</Text>
				</View>

				{/* ClickPrint payment details */}
				<Text style={styles.sectionTitle}>Pay to</Text>
				<View style={styles.card}>
					<View style={styles.shopRow}>
						<View style={styles.shopIcon}>
							<Feather name="credit-card" size={20} color={colors.primary} />
						</View>
						<View style={styles.shopInfo}>
							<Text style={styles.shopName}>{CLICKPRINT_ACCOUNT_NAME}</Text>
							<Text style={styles.shopAddress}>Official EasyPaisa account</Text>
						</View>
					</View>

					<View style={styles.divider} />

					<Text style={styles.walletLabel}>EasyPaisa Number</Text>
					<Text style={styles.walletNumber}>{CLICKPRINT_EASYPAISA_NUMBER}</Text>
				</View>

				{/* Instructions */}
				<View style={styles.infoBanner}>
					<Feather name="info" size={16} color={colors.creditWallet} />
					<Text style={styles.infoBannerText}>
						Transfer Rs. {amount} to the ClickPrint EasyPaisa number above, then attach a screenshot of the payment as proof. Your wallet is
						credited once ClickPrint confirms the payment.
					</Text>
				</View>

				{/* Payment proof (required) */}
				<Text style={styles.sectionTitle}>Payment Proof</Text>
				{proof ? (
					<View style={styles.proofCard}>
						<Image source={{ uri: proof.uri }} style={styles.proofImage} contentFit="cover" />
						<View style={styles.proofInfo}>
							<Text style={styles.proofName} numberOfLines={1}>
								{proof.fileName || "Payment screenshot"}
							</Text>
							<TouchableOpacity onPress={() => setProof(null)}>
								<Text style={styles.proofRemove}>Remove</Text>
							</TouchableOpacity>
						</View>
					</View>
				) : (
					<>
						<TouchableOpacity style={styles.uploadButton} onPress={handlePickProof}>
							<Feather name="upload" size={20} color={colors.primary} />
							<Text style={styles.uploadButtonText}>Upload payment screenshot</Text>
						</TouchableOpacity>
						<Text style={styles.requiredHint}>A payment screenshot is required to submit your top up.</Text>
					</>
				)}

				{error ? (
					<View style={styles.errorRow}>
						<Feather name="alert-circle" size={16} color={colors.printRequest} />
						<Text style={styles.inlineErrorText}>{error}</Text>
					</View>
				) : null}
			</ScrollView>

			<View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
				<TouchableOpacity style={[styles.confirmButton, (!proof || submitting) && styles.confirmButtonDisabled]} onPress={handleConfirm} disabled={!proof || submitting}>
					{submitting ? (
						<ActivityIndicator color={colors.cardBackground} />
					) : (
						<>
							<Text style={styles.confirmButtonText}>Confirm Top Up</Text>
							<Feather name="check" size={20} color={colors.cardBackground} />
						</>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingVertical: 16,
		backgroundColor: colors.cardBackground,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	backButton: {
		width: 40,
		height: 40,
		justifyContent: "center",
		alignItems: "center",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	placeholder: {
		width: 40,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		padding: 20,
		paddingBottom: 40,
	},
	amountCard: {
		backgroundColor: colors.primary,
		borderRadius: 20,
		padding: 24,
		alignItems: "center",
		marginBottom: 24,
		shadowColor: colors.shadowPrimary,
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.3,
		shadowRadius: 24,
		elevation: 6,
	},
	amountLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.cardBackground,
		opacity: 0.9,
		marginBottom: 8,
	},
	amountValue: {
		fontSize: 40,
		fontWeight: "700",
		color: colors.cardBackground,
	},
	sectionTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 12,
	},
	card: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
		marginBottom: 20,
	},
	shopRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	shopIcon: {
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: "rgba(0, 217, 163, 0.10)",
		justifyContent: "center",
		alignItems: "center",
	},
	shopInfo: {
		flex: 1,
	},
	shopName: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 2,
	},
	shopAddress: {
		fontSize: 13,
		color: colors.textSecondary,
		lineHeight: 18,
	},
	divider: {
		height: 1,
		backgroundColor: colors.borderLight,
		marginVertical: 16,
	},
	walletLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
		marginBottom: 6,
	},
	walletNumber: {
		fontSize: 22,
		fontWeight: "700",
		color: colors.textPrimary,
		letterSpacing: 1,
	},
	infoBanner: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 10,
		backgroundColor: "rgba(59, 158, 255, 0.08)",
		borderRadius: 12,
		padding: 14,
		marginBottom: 24,
	},
	infoBannerText: {
		flex: 1,
		fontSize: 13,
		color: colors.textPrimary,
		lineHeight: 19,
	},
	uploadButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 16,
		borderWidth: 1.5,
		borderColor: colors.primary,
		borderStyle: "dashed",
		borderRadius: 12,
		backgroundColor: "rgba(0, 217, 163, 0.04)",
	},
	uploadButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.primary,
	},
	requiredHint: {
		fontSize: 12,
		color: colors.textSecondary,
		marginTop: 8,
	},
	proofCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
		backgroundColor: colors.cardBackground,
		borderRadius: 12,
		padding: 12,
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	proofImage: {
		width: 56,
		height: 56,
		borderRadius: 10,
		backgroundColor: colors.background,
	},
	proofInfo: {
		flex: 1,
		gap: 6,
	},
	proofName: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	proofRemove: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.printRequest,
	},
	errorRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: 16,
	},
	inlineErrorText: {
		flex: 1,
		fontSize: 13,
		color: colors.printRequest,
		lineHeight: 18,
	},
	footer: {
		backgroundColor: colors.cardBackground,
		padding: 20,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
		shadowColor: colors.shadowMedium,
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 8,
	},
	confirmButton: {
		backgroundColor: colors.primary,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 16,
		borderRadius: 12,
		gap: 8,
	},
	confirmButtonDisabled: {
		opacity: 0.6,
	},
	confirmButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},
});

export default TopUpConfirm;
