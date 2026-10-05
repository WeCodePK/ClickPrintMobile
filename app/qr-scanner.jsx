//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	Easing,
	Linking,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../constants/colors";
import { fetchShop, queryKeys } from "../hooks/queries";
import { useFileSource } from "../hooks/useFileSource";
import { queryClient } from "../lib/queryClient";
import { createDraft } from "../services/drafts";
import { showAlert } from "../utils/alert";
import { ApiError } from "../utils/api";
import { friendlyMessage } from "../utils/errors";
import { newObjectId } from "../utils/objectId";
import { extractShopIdFromPayload } from "../utils/qrPayload";
import SecureStore from "../utils/storage";

//----------------------------------- CONSTANTS -----------------------------------//

const SCAN_BOX_SIZE = 260;

//----------------------------------- COMPONENTS -----------------------------------//

const QRScanner = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const draftIdRef = useRef(null);
	const [permission, requestPermission] = useCameraPermissions();
	const [scanned, setScanned] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [shopLoading, setShopLoading] = useState(false);
	const [torchOn, setTorchOn] = useState(false);
	const [showManualEntry, setShowManualEntry] = useState(false);
	const [manualCode, setManualCode] = useState("");
	const [scannedShop, setScannedShop] = useState(null);
	const scannedShopImage = useFileSource(scannedShop?.imageFile);
	const [scanError, setScanError] = useState(null); // { title, message }
	const scanLineAnim = useRef(new Animated.Value(0)).current;
	const hasProcessedRef = useRef(false);
	const cameraRef = useRef(null);
	// Keep a ref to the active video track so we can toggle torch on web.
	const videoTrackRef = useRef(null);

	// On web, expo-camera's enableTorch prop is a no-op. We grab the
	// underlying MediaStream track and apply the torch constraint directly.
	const toggleTorch = useCallback(async () => {
		const next = !torchOn;
		setTorchOn(next);

		if (Platform.OS !== "web") return; // native handled by enableTorch prop

		try {
			// Locate the track: either cached, or find it from the <video> element.
			let track = videoTrackRef.current;
			if (!track || track.readyState !== "live") {
				const video = document.querySelector("video");
				if (video && video.srcObject) {
					const tracks = video.srcObject.getVideoTracks();
					track = tracks[0] || null;
					videoTrackRef.current = track;
				}
			}
			if (track) {
				await track.applyConstraints({ advanced: [{ torch: next }] });
			}
		} catch (err) {
			console.warn("Torch toggle failed:", err);
		}
	}, [torchOn]);

	// Animated scan line
	useState(() => {
		Animated.loop(
			Animated.sequence([
				Animated.timing(scanLineAnim, {
					toValue: 1,
					duration: 2200,
					easing: Easing.inOut(Easing.ease),
					useNativeDriver: true,
				}),
				Animated.timing(scanLineAnim, {
					toValue: 0,
					duration: 2200,
					easing: Easing.inOut(Easing.ease),
					useNativeDriver: true,
				}),
			])
		).start();
	}, []);

	const scanLineTranslateY = scanLineAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [0, SCAN_BOX_SIZE - 4],
	});

	// Reset scanner to allow a new scan
	const resetScanner = useCallback(() => {
		setScanned(false);
		setProcessing(false);
		setScannedShop(null);
		setScanError(null);
		hasProcessedRef.current = false;
	}, []);

	const handleScanAgain = useCallback(() => {
		resetScanner();
	}, [resetScanner]);

	const handleShopId = useCallback(
		async (shopId) => {
			if (!shopId) {
				// Keep scanned=true so the camera doesn't keep firing.
				// Show error card instead of an alert.
				setProcessing(false);
				setScanError({
					title: "Invalid QR Code",
					message: "This QR code doesn't contain a valid shop link. Try scanning a ClickPrint shop QR code.",
				});
				return;
			}

			setProcessing(true);
			try {
				const token = await SecureStore.getItemAsync("authToken");
				if (!token) {
					showAlert("Not logged in", "Please log in to continue.", [
						{ text: "OK", onPress: () => router.back() },
					]);
					return;
				}

				// Fetch the shop details (a shop seen before comes from the cache,
				// so scanning works offline for known shops).
				let shop;
				try {
					shop = await queryClient.fetchQuery({
						queryKey: queryKeys.shop(shopId),
						queryFn: ({ signal }) => fetchShop(shopId, { signal }),
						staleTime: 5 * 60 * 1000,
					});
				} catch (err) {
					setProcessing(false);
					const notFound = err instanceof ApiError && err.kind === "client";
					setScanError(
						notFound
							? {
									title: "Shop Not Found",
									message: "The scanned QR code doesn't match any registered shop. Please try a different code.",
								}
							: {
									title: "Couldn't Look Up the Shop",
									message: friendlyMessage(err),
								}
					);
					return;
				}

				// Show the shop preview modal
				setScannedShop(shop);
				setProcessing(false);
			} catch (err) {
				console.error("QR scan error:", err);
				setProcessing(false);
				setScanError({
					title: "Something Went Wrong",
					message: err.message || "An error occurred while processing the QR code. Please try again.",
				});
			}
		},
		[router, resetScanner]
	);

	// Called when user taps "Select shop for printing" in the modal
	const handleSelectShopForPrinting = useCallback(async () => {
		if (!scannedShop) return;

		setShopLoading(true);
		try {
			const token = await SecureStore.getItemAsync("authToken");
			if (!token) {
				showAlert("Not logged in", "Please log in to continue.", [
					{ text: "OK", onPress: () => router.back() },
				]);
				return;
			}

			// Create a new draft for this shop. The id is made once per scanned
			// shop, so tapping again after a failure can't create a second draft.
			if (draftIdRef.current?.shop !== scannedShop._id) {
				draftIdRef.current = { shop: scannedShop._id, id: newObjectId() };
			}
			const draft = await createDraft({ id: draftIdRef.current.id, shop: scannedShop._id });
			const newDraftId = draft._id;
			router.replace(`/upload-document?draftId=${newDraftId}&shopId=${scannedShop._id}`);
		} catch (err) {
			console.error("Draft creation error:", err);
			showAlert("Couldn't start a print job", friendlyMessage(err, "Failed to start document upload."));
		} finally {
			setShopLoading(false);
		}
	}, [scannedShop, router]);

	const handleBarcodeScanned = useCallback(
		({ data }) => {
			if (hasProcessedRef.current || processing) return;
			hasProcessedRef.current = true;
			setScanned(true);

			const shopId = extractShopIdFromPayload(data);
			handleShopId(shopId);
		},
		[handleShopId, processing]
	);

	const handleManualSubmit = () => {
		if (!manualCode.trim()) return;
		const shopId = extractShopIdFromPayload(manualCode.trim());
		if (shopId) {
			hasProcessedRef.current = true;
			setScanned(true);
			setShowManualEntry(false);
			handleShopId(shopId);
		} else {
			showAlert("Invalid Code", "Please enter a valid shop ID or URL.");
		}
	};

	// ---- Permission States ----

	if (!permission) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
			</SafeAreaView>
		);
	}

	if (!permission.granted) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.permissionContainer}>
					<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
						<Feather name="arrow-left" size={24} color={colors.textPrimary} />
					</TouchableOpacity>

					<View style={styles.permissionContent}>
						<View style={styles.permissionIconContainer}>
							<Feather name="camera" size={48} color={colors.primary} />
						</View>
						<Text style={styles.permissionTitle}>Camera Access Required</Text>
						<Text style={styles.permissionDescription}>
							ClickPrint needs camera access to scan shop QR codes and start printing instantly.
						</Text>

						{permission.canAskAgain ? (
							<TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.85}>
								<Feather name="camera" size={18} color={colors.cardBackground} />
								<Text style={styles.permissionButtonText}>Allow Camera</Text>
							</TouchableOpacity>
						) : (
							<TouchableOpacity
								style={styles.permissionButton}
								onPress={() => Linking.openSettings()}
								activeOpacity={0.85}
							>
								<Feather name="settings" size={18} color={colors.cardBackground} />
								<Text style={styles.permissionButtonText}>Open Settings</Text>
							</TouchableOpacity>
						)}

						<TouchableOpacity
							style={styles.manualEntryLink}
							onPress={() => setShowManualEntry(true)}
							activeOpacity={0.7}
						>
							<Text style={styles.manualEntryLinkText}>Enter code manually instead</Text>
						</TouchableOpacity>
					</View>

					{showManualEntry && (
						<ManualEntrySheet
							value={manualCode}
							onChangeText={setManualCode}
							onSubmit={handleManualSubmit}
							onClose={() => setShowManualEntry(false)}
							processing={processing}
							bottomInset={insets.bottom}
						/>
					)}
				</View>
			</SafeAreaView>
		);
	}

	// ---- Scanner View ----

	return (
		<View style={styles.container}>
			<CameraView
				ref={cameraRef}
				style={StyleSheet.absoluteFill}
				facing="back"
				enableTorch={torchOn}
				barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
				onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
			/>

			{/* Overlay */}
			<View style={styles.overlay}>
				{/* Top bar */}
				<SafeAreaView style={styles.topBar} edges={["top"]}>
					<TouchableOpacity style={styles.topBarButton} onPress={() => router.back()} activeOpacity={0.8}>
						<Feather name="arrow-left" size={22} color="#fff" />
					</TouchableOpacity>
					<Text style={styles.topBarTitle}>Scan QR Code</Text>
					<TouchableOpacity
						style={[styles.topBarButton, torchOn && styles.topBarButtonActive]}
						onPress={toggleTorch}
						activeOpacity={0.8}
					>
						<Feather name={torchOn ? "zap" : "zap-off"} size={20} color="#fff" />
					</TouchableOpacity>
				</SafeAreaView>

				{/* Scan area */}
				<View style={styles.scanAreaContainer}>
					<View style={styles.scanBox}>
						{/* Corner brackets */}
						<View style={[styles.corner, styles.cornerTL]} />
						<View style={[styles.corner, styles.cornerTR]} />
						<View style={[styles.corner, styles.cornerBL]} />
						<View style={[styles.corner, styles.cornerBR]} />

						{/* Animated scan line */}
						{!scanned && (
							<Animated.View
								style={[
									styles.scanLine,
									{ transform: [{ translateY: scanLineTranslateY }] },
								]}
							/>
						)}

						{/* Processing indicator */}
						{processing && (
							<View style={styles.processingOverlay}>
								<ActivityIndicator size="large" color={colors.primary} />
								<Text style={styles.processingText}>Fetching shop details...</Text>
							</View>
						)}
					</View>
				</View>
				{/* Bottom section */}
				<View style={[styles.bottomSection, { paddingBottom: 60 + insets.bottom }]}>
					<Text style={styles.instructionText}>
						Point your camera at a shop's QR code
					</Text>

					<TouchableOpacity
						style={styles.manualEntryButton}
						onPress={() => setShowManualEntry(true)}
						activeOpacity={0.8}
					>
						<Feather name="edit-3" size={16} color={colors.primary} />
						<Text style={styles.manualEntryButtonText}>Enter code manually</Text>
					</TouchableOpacity>
				</View>
			</View>

			{/* Error Bottom Card */}
			{scanError && (
				<View style={styles.errorCardBackdrop} pointerEvents="box-none">
					<View style={[styles.errorCard, { paddingBottom: 24 + insets.bottom }]}>
						<View style={styles.errorCardHandle} />

						<View style={styles.errorIconContainer}>
							<Feather name="alert-circle" size={36} color={colors.danger} />
						</View>

						<Text style={styles.errorCardTitle}>{scanError.title}</Text>
						<Text style={styles.errorCardMessage}>{scanError.message}</Text>

						<TouchableOpacity
							style={styles.errorRetryButton}
							onPress={resetScanner}
							activeOpacity={0.85}
						>
							<Feather name="refresh-cw" size={18} color={colors.cardBackground} />
							<Text style={styles.errorRetryButtonText}>Try Again</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.errorManualButton}
							onPress={() => {
								setScanError(null);
								setShowManualEntry(true);
							}}
							activeOpacity={0.8}
						>
							<Feather name="edit-3" size={16} color={colors.primary} />
							<Text style={styles.errorManualButtonText}>Enter URL Manually</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}

			{/* Manual entry sheet */}
			{showManualEntry && (
				<ManualEntrySheet
					value={manualCode}
					onChangeText={setManualCode}
					onSubmit={handleManualSubmit}
					onClose={() => setShowManualEntry(false)}
					processing={processing}
					bottomInset={insets.bottom}
				/>
			)}

			{/* Shop Preview Modal */}
			<Modal
				visible={!!scannedShop}
				animationType="slide"
				transparent
				onRequestClose={handleScanAgain}
			>
				<View style={styles.modalBackdrop}>
					<View style={[styles.previewSheet, { paddingBottom: insets.bottom + 6 }]}>
						{/* Sheet Header Handle */}
						<View style={styles.sheetHandle} />

						{scannedShop && (
							<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
								{/* Shop Image & Name */}
								<View style={styles.shopHeaderRow}>
									{scannedShopImage ? (
										<Image
											source={scannedShopImage}
											style={styles.shopImage}
											contentFit="cover"
											transition={200}
										/>
									) : (
										<View style={styles.shopIconPlaceholder}>
											<Feather name="shopping-bag" size={28} color="#00D9A3" />
										</View>
									)}

									<View style={styles.shopTitleGroup}>
										<View style={styles.statusRow}>
											<View
												style={[
													styles.statusDot,
													scannedShop.isOnline ? styles.statusOnline : styles.statusOffline,
												]}
											/>
											<Text
												style={[
													styles.statusLabel,
													scannedShop.isOnline ? styles.statusLabelOnline : styles.statusLabelOffline,
												]}
											>
												{scannedShop.isOnline ? "Online • Ready to Print" : "Offline"}
											</Text>
										</View>
										<Text style={styles.shopNameText}>{scannedShop.name}</Text>
									</View>
								</View>

								{/* Address & Contact Details */}
								<View style={styles.detailsCard}>
									<View style={styles.detailItem}>
										<Feather name="map-pin" size={16} color="#00D9A3" style={styles.detailIcon} />
										<Text style={styles.detailText} numberOfLines={2}>
											{scannedShop.address || "Address not provided"}
										</Text>
									</View>

									{scannedShop.contactNumber ? (
										<View style={styles.detailItem}>
											<Feather name="phone" size={16} color="#00D9A3" style={styles.detailIcon} />
											<Text style={styles.detailText}>{scannedShop.contactNumber}</Text>
										</View>
									) : null}
								</View>

								{/* Primary Action Button: "Select shop for printing" */}
								<TouchableOpacity
									style={styles.primarySelectButton}
									onPress={handleSelectShopForPrinting}
									disabled={shopLoading}
									activeOpacity={0.88}
								>
									{shopLoading ? (
										<ActivityIndicator size="small" color="#FFF" />
									) : (
										<>
											<Feather name="printer" size={20} color="#FFF" style={{ marginRight: 8 }} />
											<Text style={styles.primarySelectButtonText}>Select shop for printing</Text>
											<Feather name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 6 }} />
										</>
									)}
								</TouchableOpacity>

								{/* Secondary Actions */}
								<View style={styles.sheetActionsRow}>
									<TouchableOpacity
										style={styles.secondarySheetButton}
										onPress={() => {
											const id = scannedShop._id;
											handleScanAgain();
											router.push(`/shop/${id}`);
										}}
									>
										<Feather name="info" size={16} color={colors.textPrimary} />
										<Text style={styles.secondarySheetButtonText}>View Shop Profile</Text>
									</TouchableOpacity>

									<TouchableOpacity
										style={styles.secondarySheetButton}
										onPress={handleScanAgain}
									>
										<Feather name="camera" size={16} color={colors.textPrimary} />
										<Text style={styles.secondarySheetButtonText}>Scan Another</Text>
									</TouchableOpacity>
								</View>
							</ScrollView>
						)}
					</View>
				</View>
			</Modal>
		</View>
	);
};

// Bottom sheet for manual code entry
const ManualEntrySheet = ({ value, onChangeText, onSubmit, onClose, processing, bottomInset = 0 }) => {
	return (
		<View style={styles.manualSheet}>
			<View style={[styles.manualSheetContent, { paddingBottom: 24 + bottomInset }]}>
				<View style={styles.manualSheetHeader}>
					<Text style={styles.manualSheetTitle}>Enter Shop Code</Text>
					<TouchableOpacity onPress={onClose} hitSlop={8}>
						<Feather name="x" size={22} color={colors.textSecondary} />
					</TouchableOpacity>
				</View>

				<Text style={styles.manualSheetDescription}>
					Paste the shop URL or enter the shop ID from the QR code.
				</Text>

				<View style={styles.manualInputContainer}>
					<TextInput
						style={styles.manualInput}
						placeholder="Shop ID or URL..."
						placeholderTextColor={colors.textSecondary}
						value={value}
						onChangeText={onChangeText}
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="go"
						onSubmitEditing={onSubmit}
						editable={!processing}
						{...(Platform.OS === "web" ? { outlineStyle: "none" } : {})}
					/>
				</View>

				<TouchableOpacity
					style={[styles.manualSubmitButton, (!value.trim() || processing) && styles.manualSubmitButtonDisabled]}
					onPress={onSubmit}
					activeOpacity={0.85}
					disabled={!value.trim() || processing}
				>
					{processing ? (
						<ActivityIndicator size="small" color={colors.cardBackground} />
					) : (
						<>
							<Feather name="arrow-right" size={18} color={colors.cardBackground} />
							<Text style={styles.manualSubmitButtonText}>Continue</Text>
						</>
					)}
				</TouchableOpacity>
			</View>
		</View>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000",
	},
	centerContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.background,
	},

	// ---- Permission Screen ----
	permissionContainer: {
		flex: 1,
		backgroundColor: colors.background,
	},
	backButton: {
		marginTop: 8,
		marginLeft: 16,
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: colors.cardBackground,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	permissionContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 40,
		gap: 16,
	},
	permissionIconContainer: {
		width: 96,
		height: 96,
		borderRadius: 32,
		backgroundColor: "rgba(0, 217, 163, 0.12)",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 8,
	},
	permissionTitle: {
		fontSize: 22,
		fontWeight: "700",
		color: colors.textPrimary,
		textAlign: "center",
	},
	permissionDescription: {
		fontSize: 15,
		color: colors.textSecondary,
		textAlign: "center",
		lineHeight: 22,
	},
	permissionButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: colors.primary,
		paddingVertical: 14,
		paddingHorizontal: 32,
		borderRadius: 14,
		marginTop: 8,
		shadowColor: colors.shadowPrimary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 4,
	},
	permissionButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},
	manualEntryLink: {
		marginTop: 12,
		padding: 8,
	},
	manualEntryLinkText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.primary,
	},

	// ---- Scanner Overlay ----
	overlay: {
		...StyleSheet.absoluteFillObject,
		justifyContent: "space-between",
	},
	topBar: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	topBarButton: {
		width: 42,
		height: 42,
		borderRadius: 21,
		backgroundColor: "rgba(0, 0, 0, 0.45)",
		justifyContent: "center",
		alignItems: "center",
	},
	topBarButtonActive: {
		backgroundColor: colors.primary,
	},
	topBarTitle: {
		fontSize: 17,
		fontWeight: "700",
		color: "#fff",
		letterSpacing: 0.2,
	},

	// ---- Scan Box ----
	scanAreaContainer: {
		alignItems: "center",
		justifyContent: "center",
	},
	scanBox: {
		width: SCAN_BOX_SIZE,
		height: SCAN_BOX_SIZE,
		borderRadius: 24,
		overflow: "hidden",
		position: "relative",
	},
	corner: {
		position: "absolute",
		width: 36,
		height: 36,
		borderColor: colors.primary,
		borderWidth: 3.5,
	},
	cornerTL: {
		top: 0,
		left: 0,
		borderBottomWidth: 0,
		borderRightWidth: 0,
		borderTopLeftRadius: 24,
	},
	cornerTR: {
		top: 0,
		right: 0,
		borderBottomWidth: 0,
		borderLeftWidth: 0,
		borderTopRightRadius: 24,
	},
	cornerBL: {
		bottom: 0,
		left: 0,
		borderTopWidth: 0,
		borderRightWidth: 0,
		borderBottomLeftRadius: 24,
	},
	cornerBR: {
		bottom: 0,
		right: 0,
		borderTopWidth: 0,
		borderLeftWidth: 0,
		borderBottomRightRadius: 24,
	},
	scanLine: {
		position: "absolute",
		left: 12,
		right: 12,
		height: 3,
		borderRadius: 2,
		backgroundColor: colors.primary,
		shadowColor: colors.primary,
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.8,
		shadowRadius: 8,
		elevation: 3,
	},
	processingOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.6)",
		justifyContent: "center",
		alignItems: "center",
		borderRadius: 24,
		gap: 12,
	},
	processingText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#fff",
	},

	// ---- Bottom Section ----
	bottomSection: {
		alignItems: "center",
		gap: 16,
	},
	instructionText: {
		fontSize: 15,
		fontWeight: "600",
		color: "rgba(255, 255, 255, 0.8)",
		textAlign: "center",
	},
	manualEntryButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: "rgba(0, 217, 163, 0.15)",
		paddingVertical: 10,
		paddingHorizontal: 20,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "rgba(0, 217, 163, 0.3)",
	},
	manualEntryButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.primary,
	},

	// ---- Manual Entry Sheet ----
	manualSheet: {
		...StyleSheet.absoluteFillObject,
		justifyContent: "flex-end",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	manualSheetContent: {
		backgroundColor: colors.cardBackground,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingTop: 24,
		paddingHorizontal: 24,
		gap: 14,
	},
	manualSheetHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	manualSheetTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	manualSheetDescription: {
		fontSize: 14,
		color: colors.textSecondary,
		lineHeight: 20,
	},
	manualInputContainer: {
		backgroundColor: colors.background,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.borderLight,
		paddingHorizontal: 16,
		paddingVertical: 2,
	},
	manualInput: {
		fontSize: 16,
		color: colors.textPrimary,
		paddingVertical: 14,
		...Platform.select({ web: { outlineStyle: "none" } }),
	},
	manualSubmitButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: colors.primary,
		paddingVertical: 14,
		borderRadius: 14,
		marginTop: 4,
		shadowColor: colors.shadowPrimary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 4,
	},
	manualSubmitButtonDisabled: {
		opacity: 0.6,
	},
	manualSubmitButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},

	// ---- Error Bottom Card ----
	errorCardBackdrop: {
		...StyleSheet.absoluteFillObject,
		justifyContent: "flex-end",
		backgroundColor: "rgba(0, 0, 0, 0.45)",
	},
	errorCard: {
		backgroundColor: colors.cardBackground,
		borderTopLeftRadius: 28,
		borderTopRightRadius: 28,
		paddingTop: 12,
		paddingHorizontal: 24,
		alignItems: "center",
		gap: 10,
	},
	errorCardHandle: {
		width: 40,
		height: 5,
		borderRadius: 3,
		backgroundColor: colors.borderLight,
		marginBottom: 12,
	},
	errorIconContainer: {
		width: 72,
		height: 72,
		borderRadius: 36,
		backgroundColor: "rgba(255, 90, 95, 0.1)",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 4,
	},
	errorCardTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: colors.textPrimary,
		textAlign: "center",
	},
	errorCardMessage: {
		fontSize: 14,
		color: colors.textSecondary,
		textAlign: "center",
		lineHeight: 20,
		paddingHorizontal: 10,
		marginBottom: 6,
	},
	errorRetryButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: colors.primary,
		paddingVertical: 14,
		paddingHorizontal: 32,
		borderRadius: 14,
		alignSelf: "stretch",
		shadowColor: colors.shadowPrimary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 4,
	},
	errorRetryButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},
	errorManualButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
		alignSelf: "stretch",
		backgroundColor: colors.background,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	errorManualButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.primary,
	},

	// ---- Shop Preview Modal ----
	modalBackdrop: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.55)",
		justifyContent: "flex-end",
	},
	previewSheet: {
		backgroundColor: colors.cardBackground,
		borderTopLeftRadius: 28,
		borderTopRightRadius: 28,
		paddingTop: 12,
		paddingHorizontal: 20,
		maxHeight: "75%",
	},
	sheetHandle: {
		width: 40,
		height: 5,
		borderRadius: 3,
		backgroundColor: colors.borderLight,
		alignSelf: "center",
		marginBottom: 16,
	},
	sheetContent: {
		paddingBottom: 4,
		gap: 18,
	},
	shopHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
	},
	shopImage: {
		width: 64,
		height: 64,
		borderRadius: 16,
		backgroundColor: colors.background,
	},
	shopIconPlaceholder: {
		width: 64,
		height: 64,
		borderRadius: 16,
		backgroundColor: "rgba(0, 217, 163, 0.1)",
		justifyContent: "center",
		alignItems: "center",
	},
	shopTitleGroup: {
		flex: 1,
		gap: 6,
	},
	statusRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	statusDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	statusOnline: {
		backgroundColor: colors.primary,
	},
	statusOffline: {
		backgroundColor: colors.textSecondary,
	},
	statusLabel: {
		fontSize: 12,
		fontWeight: "600",
	},
	statusLabelOnline: {
		color: colors.primary,
	},
	statusLabelOffline: {
		color: colors.textSecondary,
	},
	shopNameText: {
		fontSize: 20,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	detailsCard: {
		backgroundColor: colors.background,
		borderRadius: 16,
		padding: 16,
		gap: 14,
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	detailItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 10,
	},
	detailIcon: {
		marginTop: 2,
	},
	detailText: {
		flex: 1,
		fontSize: 14,
		color: colors.textPrimary,
		lineHeight: 20,
	},
	primarySelectButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.primary,
		paddingVertical: 16,
		borderRadius: 16,
		shadowColor: colors.shadowPrimary,
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 1,
		shadowRadius: 16,
		elevation: 6,
	},
	primarySelectButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: "#FFF",
	},
	sheetActionsRow: {
		flexDirection: "row",
		gap: 10,
	},
	secondarySheetButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: colors.background,
		paddingVertical: 13,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	secondarySheetButtonText: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textPrimary,
	},
});

export default QRScanner;