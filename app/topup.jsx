//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Platform,
	ScrollView,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";
import { showAlert } from "../utils/alert";
import { getItemAsync } from "../utils/storage";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

const TopUpPage = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams();

	let draft = null;
	if (params.draft) {
		try {
			draft = JSON.parse(params.draft);
		} catch (e) {
			console.error("Failed to parse draft param:", e);
		}
	}

	const draftId = params.draftId || draft?._id || "";
	const shopId = params.shopId || draft?.shop?._id || (typeof draft?.shop === "string" ? draft.shop : "");
	const amount = params.amount || String(draft?.cost?.total ?? "0");

	const [shop, setShop] = useState(null);
	const [wallet, setWallet] = useState(null);
	const [loadingShop, setLoadingShop] = useState(!!shopId);

	const [pickedImage, setPickedImage] = useState(null);
	const [uploading, setUploading] = useState(false);
	const [uploadedFile, setUploadedFile] = useState(null);

	const [submittingJob, setSubmittingJob] = useState(false);
	const [copied, setCopied] = useState(false);

	// Fetch shop and wallet details via /api/shops/:shopId
	useEffect(() => {
		const fetchShopDetails = async () => {
			if (!shopId) return;
			try {
				setLoadingShop(true);
				const token = await getItemAsync("authToken");
				const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (response.ok) {
					const data = await response.json();
					const shopData = data.data?.shop || data.data;
					if (shopData) {
						setShop(shopData);
						if (shopData.wallet) {
							setWallet(shopData.wallet);
						}
					}
				}
			} catch (err) {
				console.error("Failed to fetch shop details:", err);
			} finally {
				setLoadingShop(false);
			}
		};

		fetchShopDetails();
	}, [shopId]);

	// Copy account number
	const handleCopyNumber = async () => {
		const num = wallet?.number;
		if (!num) return;
		try {
			await Clipboard.setStringAsync(num);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy account number:", err);
		}
	};

	// Image picker for payment proof
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
				setPickedImage(result.assets[0]);
				setUploadedFile(null);
			}
		} catch (err) {
			console.error("Error picking proof:", err);
			showAlert("Error", "Failed to pick image. Please try again.");
		}
	};

	// Upload payment proof via /api/files
	const handleUploadProof = async () => {
		if (!pickedImage) {
			showAlert("No image selected", "Please choose a payment screenshot to upload.");
			return;
		}
		try {
			setUploading(true);
			const token = await getItemAsync("authToken");
			const formData = new FormData();
			const fileName =
				pickedImage.fileName ||
				`payment-proof.${(pickedImage.uri.split(".").pop() || "jpg").split("?")[0]}`;

			if (Platform.OS === "web") {
				let filePart = pickedImage.file;
				if (!filePart) {
					const res = await fetch(pickedImage.uri);
					filePart = await res.blob();
				}
				formData.append("file", filePart, fileName);
			} else {
				formData.append("file", {
					uri: pickedImage.uri,
					name: fileName,
					type: pickedImage.mimeType || "image/jpeg",
				});
			}
			formData.append("convert", "false");

			const response = await fetch(`${API_BASE_URL}/files`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body: formData,
			});
			const body = await response.json();
			if (!response.ok || !body.success) {
				throw new Error(body.message || "Failed to upload payment proof.");
			}

			const fileRecord = body.data?.file || body.data;
			setUploadedFile(fileRecord);
			showAlert("Proof Uploaded", "Payment proof uploaded successfully! You can now submit your job.");
		} catch (err) {
			console.error("Error uploading payment proof:", err);
			showAlert("Upload Failed", err.message || "Failed to upload payment proof. Please try again.");
		} finally {
			setUploading(false);
		}
	};

	// Submit Job via /api/drafts/:draftId/submit
	const handleSubmitJob = async () => {
		if (!uploadedFile) {
			showAlert(
				"Payment Proof Required",
				"Please upload your payment proof before submitting the job."
			);
			return;
		}

		if (!draftId) {
			showAlert("Error", "Draft ID is missing. Cannot submit job.");
			return;
		}

		try {
			setSubmittingJob(true);
			const token = await getItemAsync("authToken");
			console.log("Submitting draft ID:", draftId);
			const response = await fetch(`${API_BASE_URL}/drafts/${draftId}/submit`, {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
			const data = await response.json();
			if (response.ok && data.success) {
				showAlert("Success", "Your print job has been submitted!", [
					{
						text: "OK",
						onPress: () => router.replace("/(tabs)/home"),
					},
				]);
			} else {
				console.log("Failed to submit draft response:", data);
				throw new Error(data.message || "Failed to submit job.");
			}
		} catch (err) {
			console.error("Error submitting job:", err);
			showAlert("Error", err.message || "Failed to submit draft. Please try again.");
		} finally {
			setSubmittingJob(false);
		}
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />

			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Pay Upfront</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{/* Upfront Amount Summary */}
				<View style={styles.amountCard}>
					<Text style={styles.amountLabel}>Total Amount to Pay</Text>
					<Text style={styles.amountValue}>Rs. {amount}</Text>
					{shop?.name ? <Text style={styles.amountShop}>Shop: {shop.name}</Text> : null}
					{draft?.files?.length ? (
						<Text style={styles.amountFiles}>
							{draft.files.length} document{draft.files.length !== 1 ? "s" : ""}
						</Text>
					) : null}
				</View>

				{/* Shop Wallet Section matching screenshot */}
				<View style={styles.walletSection}>
					<View style={styles.walletHeaderRow}>
						<View style={styles.walletIconContainer}>
							<Feather name="credit-card" size={20} color="#00D9A3" />
						</View>
						<View style={styles.walletHeaderTexts}>
							<Text style={styles.walletTitle}>Wallet</Text>
							<Text style={styles.walletSubtitle}>
								Transfer your upfront payment to the shop&apos;s account below:
							</Text>
						</View>
					</View>

					{loadingShop ? (
						<View style={styles.loadingShopBox}>
							<ActivityIndicator size="small" color={colors.primary} />
							<Text style={styles.loadingShopText}>Loading shop wallet details...</Text>
						</View>
					) : (
						<>
							{/* Row 1: Bank / Wallet Provider */}
							<Text style={styles.fieldLabel}>BANK / WALLET PROVIDER</Text>
							<View style={styles.fieldBox}>
								<Text style={styles.fieldValue}>
									{wallet?.bank || shop?.name || "Not specified"}
								</Text>
							</View>

							{/* Row 2: Account Title (Separate Row) */}
							<Text style={styles.fieldLabel}>ACCOUNT TITLE</Text>
							<View style={styles.fieldBox}>
								<Text style={styles.fieldValue} numberOfLines={1} ellipsizeMode="tail">
									{wallet?.title || "Not specified"}
								</Text>
							</View>

							{/* Row 3: IBAN / Account Number (Separate Row) */}
							<Text style={styles.fieldLabel}>IBAN / ACCOUNT NUMBER</Text>
							<View style={[styles.fieldBox, styles.numberBox]}>
								<Text style={styles.fieldValue} numberOfLines={1} ellipsizeMode="middle">
									{wallet?.number || "Not specified"}
								</Text>
								{wallet?.number ? (
									<TouchableOpacity
										onPress={handleCopyNumber}
										style={styles.copyIconButton}
										activeOpacity={0.7}
									>
										<Feather
											name={copied ? "check" : "copy"}
											size={18}
											color={copied ? colors.primary : colors.textSecondary}
										/>
									</TouchableOpacity>
								) : null}
							</View>

							{/* Explanatory note */}
							<Text style={styles.supportNote}>
								Supports 24-character IBAN, 8–20 digit bank account number, or mobile wallet (e.g. 03XXXXXXXXX).
							</Text>
						</>
					)}
				</View>

				{/* Payment Proof Section */}
				<View style={styles.proofSection}>
					<View style={styles.sectionHeader}>
						<Feather name="file-text" size={18} color={colors.primary} />
						<Text style={styles.sectionTitle}>Payment Proof</Text>
					</View>

					{pickedImage ? (
						<View style={styles.proofPreviewCard}>
							<Image
								source={{ uri: pickedImage.uri }}
								style={styles.proofImagePreview}
								contentFit="cover"
							/>
							<View style={styles.proofDetails}>
								<Text style={styles.proofFileName} numberOfLines={1}>
									{pickedImage.fileName || "payment-proof.jpg"}
								</Text>
								{uploadedFile ? (
									<View style={styles.uploadedBadge}>
										<Feather name="check-circle" size={14} color={colors.primary} />
										<Text style={styles.uploadedBadgeText}>Proof Uploaded</Text>
									</View>
								) : (
									<Text style={styles.pendingUploadText}>Not uploaded yet</Text>
								)}
								<TouchableOpacity
									style={styles.changeImageButton}
									onPress={handlePickProof}
									disabled={uploading}
								>
									<Text style={styles.changeImageText}>Change Image</Text>
								</TouchableOpacity>
							</View>
						</View>
					) : (
						<TouchableOpacity
							style={styles.pickButton}
							onPress={handlePickProof}
							activeOpacity={0.8}
						>
							<View style={styles.pickIconWrapper}>
								<Feather name="image" size={24} color={colors.primary} />
							</View>
							<Text style={styles.pickButtonTitle}>Select Payment Screenshot</Text>
							<Text style={styles.pickButtonSub}>
								Attach a screenshot of your bank transfer or mobile wallet payment
							</Text>
						</TouchableOpacity>
					)}

					{/* Upload Payment Proof Button */}
					{pickedImage && !uploadedFile ? (
						<TouchableOpacity
							style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
							onPress={handleUploadProof}
							disabled={uploading}
							activeOpacity={0.8}
						>
							{uploading ? (
								<ActivityIndicator size="small" color={colors.cardBackground} />
							) : (
								<>
									<Feather name="upload" size={18} color={colors.cardBackground} />
									<Text style={styles.uploadButtonText}>Upload Payment Proof</Text>
								</>
							)}
						</TouchableOpacity>
					) : null}

					{uploadedFile ? (
						<View style={styles.uploadSuccessBanner}>
							<Feather name="check" size={18} color={colors.primary} />
							<Text style={styles.uploadSuccessText}>
								Payment proof uploaded. Ready to submit job!
							</Text>
						</View>
					) : null}
				</View>
			</ScrollView>

			{/* Footer with Submit Job Button */}
			<View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
				<TouchableOpacity
					style={[
						styles.submitJobButton,
						(!uploadedFile || submittingJob) && styles.submitJobButtonDisabled,
					]}
					onPress={handleSubmitJob}
					disabled={!uploadedFile || submittingJob}
					activeOpacity={0.8}
				>
					{submittingJob ? (
						<ActivityIndicator size="small" color={colors.cardBackground} />
					) : (
						<>
							<Text style={styles.submitJobButtonText}>Submit Job</Text>
							<Feather name="send" size={20} color={colors.cardBackground} />
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
		paddingVertical: 14,
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
		paddingBottom: 140,
	},
	amountCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 18,
		padding: 20,
		alignItems: "center",
		marginBottom: 20,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	amountLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 6,
	},
	amountValue: {
		fontSize: 32,
		fontWeight: "800",
		color: colors.textPrimary,
	},
	amountShop: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.primaryDark,
		marginTop: 6,
	},
	amountFiles: {
		fontSize: 12,
		color: colors.textSecondary,
		marginTop: 4,
	},
	walletSection: {
		backgroundColor: "#F8FAFC",
		borderRadius: 18,
		padding: 18,
		marginBottom: 20,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	walletHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 18,
		gap: 12,
	},
	walletIconContainer: {
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: "#E6FBF5",
		borderWidth: 1,
		borderColor: "#A7F3D0",
		justifyContent: "center",
		alignItems: "center",
	},
	walletHeaderTexts: {
		flex: 1,
	},
	walletTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: "#1E293B",
	},
	walletSubtitle: {
		fontSize: 12,
		color: "#64748B",
		marginTop: 2,
		lineHeight: 16,
	},
	loadingShopBox: {
		paddingVertical: 20,
		alignItems: "center",
		gap: 8,
	},
	loadingShopText: {
		fontSize: 13,
		color: colors.textSecondary,
	},
	fieldLabel: {
		fontSize: 11,
		fontWeight: "700",
		color: "#64748B",
		letterSpacing: 0.5,
		textTransform: "uppercase",
		marginBottom: 6,
	},
	fieldBox: {
		backgroundColor: "#FFFFFF",
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginBottom: 14,
		justifyContent: "center",
	},
	numberBox: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	fieldValue: {
		fontSize: 14,
		fontWeight: "600",
		color: "#1E293B",
	},
	copyIconButton: {
		padding: 4,
		marginLeft: 4,
	},
	supportNote: {
		fontSize: 11,
		color: "#94A3B8",
		lineHeight: 16,
		marginTop: -4,
	},
	proofSection: {
		backgroundColor: colors.cardBackground,
		borderRadius: 18,
		padding: 18,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
		marginBottom: 20,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 14,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	pickButton: {
		borderWidth: 1.5,
		borderStyle: "dashed",
		borderColor: colors.borderLight,
		borderRadius: 14,
		padding: 24,
		alignItems: "center",
		backgroundColor: "#FAFBFC",
	},
	pickIconWrapper: {
		width: 52,
		height: 52,
		borderRadius: 14,
		backgroundColor: "rgba(0, 217, 163, 0.12)",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 10,
	},
	pickButtonTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 4,
	},
	pickButtonSub: {
		fontSize: 12,
		color: colors.textSecondary,
		textAlign: "center",
		lineHeight: 16,
	},
	proofPreviewCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#FAFBFC",
		borderRadius: 14,
		padding: 12,
		borderWidth: 1,
		borderColor: colors.borderLight,
		gap: 12,
	},
	proofImagePreview: {
		width: 70,
		height: 70,
		borderRadius: 10,
		backgroundColor: "#E2E8F0",
	},
	proofDetails: {
		flex: 1,
	},
	proofFileName: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
		marginBottom: 4,
	},
	uploadedBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		marginTop: 2,
	},
	uploadedBadgeText: {
		fontSize: 12,
		fontWeight: "600",
		color: colors.primary,
	},
	pendingUploadText: {
		fontSize: 12,
		color: colors.textSecondary,
		marginTop: 2,
	},
	changeImageButton: {
		marginTop: 8,
	},
	changeImageText: {
		fontSize: 12,
		fontWeight: "600",
		color: colors.creditWallet,
	},
	uploadButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.printRequest,
		borderRadius: 14,
		paddingVertical: 14,
		marginTop: 14,
		gap: 8,
	},
	uploadButtonDisabled: {
		opacity: 0.6,
	},
	uploadButtonText: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.cardBackground,
	},
	uploadSuccessBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: "rgba(0, 217, 163, 0.12)",
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		marginTop: 14,
	},
	uploadSuccessText: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.primaryDark,
		flex: 1,
	},
	footer: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: colors.cardBackground,
		paddingHorizontal: 20,
		paddingTop: 16,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 8,
	},
	submitJobButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.printRequest,
		borderRadius: 16,
		paddingVertical: 16,
		gap: 10,
		shadowColor: colors.shadowPrimary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 4,
	},
	submitJobButtonDisabled: {
		backgroundColor: colors.borderLight,
		shadowOpacity: 0,
		elevation: 0,
	},
	submitJobButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},
});

export default TopUpPage;
