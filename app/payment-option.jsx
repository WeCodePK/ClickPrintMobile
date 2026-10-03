//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../constants/colors";
import { useDraftQuery, useShopQuery } from "../hooks/queries";
import { useRetryStatus } from "../hooks/useRetryStatus";
import { submitDraft } from "../services/drafts";
import { showAlert } from "../utils/alert";
import { friendlyMessage } from "../utils/errors";

//----------------------------------- CONSTANTS -----------------------------------//

const formatCurrency = (amount) => `Rs. ${amount}`;

//----------------------------------- COMPONENTS -----------------------------------//

const PaymentOption = () => {
	const router = useRouter();
	const params = useLocalSearchParams();
	const insets = useSafeAreaInsets();

	const draftId = params.draftId;
	const shopId = params.shopId;
	const amount = Number(params.amount ?? 0);

	const draftQuery = useDraftQuery(draftId);
	const draft = draftQuery.data ?? null;

	const shopQuery = useShopQuery(shopId);
	const shopName = draft?.shop?.name || shopQuery.data?.name || "";
	const codLimit =
		typeof draft?.shop?.codLimit === "number"
			? draft.shop.codLimit
			: typeof shopQuery.data?.codLimit === "number"
				? shopQuery.data.codLimit
				: null;
	const codLimitKnown = codLimit !== null || shopQuery.isSuccess;
	const loadingShop = !codLimitKnown && shopQuery.isFetching;
	const shopLoadFailed = !codLimitKnown && shopQuery.isError && !shopQuery.isFetching;
	const fetchShop = () => shopQuery.refetch();

	const codAllowed = typeof codLimit === "number" && amount < codLimit;
	const [paymentMethod, setPaymentMethod] = useState(null);
	const [submitting, setSubmitting] = useState(false);
	const retry = useRetryStatus();

	const selectedMethod = codAllowed ? paymentMethod : "upfront";

	const codSubLabel = loadingShop
		? "Checking availability..."
		: shopLoadFailed
			? "Couldn't check availability. Check your connection."
			: typeof codLimit !== "number"
			? "Not available for this shop"
			: codAllowed
				? "Pay at the shop when you collect"
				: `Only for orders under ${formatCurrency(codLimit)}`;

	//----------------------------------- HANDLERS -----------------------------------//

	const handleBack = () => {
		router.back();
	};

	const handlePayUpfront = async () => {
		try {
			setSubmitting(true);
			router.push({
				pathname: "/topup",
				params: {
					shopId: shopId || "",
					draftId: draftId,
					amount: String(amount),
				},
			});
		} catch (err) {
			console.error("Error navigating to payment:", err);
			showAlert("Error", friendlyMessage(err, "Failed to proceed. Please try again."));
		} finally {
			setSubmitting(false);
			retry.reset();
		}
	};

	const handleCashOnDelivery = async () => {
		try {
			setSubmitting(true);
			await submitDraft(draftId, "cod", { onRetry: retry.onRetry });
			showAlert("Success", "Your print job has been submitted! Pay the shop on collection.", [
				{
					text: "OK",
					onPress: () => router.replace("/(tabs)/home"),
				},
			]);
		} catch (err) {
			console.error("Error submitting job:", err);
			showAlert("Couldn't submit the job", friendlyMessage(err, "Failed to submit draft. Please try again."));
		} finally {
			setSubmitting(false);
			retry.reset();
		}
	};

	const handleContinue = () => {
		if (selectedMethod === "cod") {
			handleCashOnDelivery();
		} else {
			handlePayUpfront();
		}
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={handleBack} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Payment Method</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				keyboardShouldPersistTaps="handled"
			>
				{/* Order Summary */}
				<View style={styles.summaryCard}>
					<View style={styles.summaryRow}>
						<View style={styles.summaryIconContainer}>
							<Feather name="shopping-bag" size={20} color={colors.printRequest} />
						</View>
						<View style={styles.summaryTextGroup}>
							<Text style={styles.summaryLabel}>Order Total</Text>
							<Text style={styles.summaryShop} numberOfLines={1}>
								{shopName || "Print Shop"}
							</Text>
						</View>
						<Text style={styles.summaryAmount}>{formatCurrency(amount)}</Text>
					</View>
				</View>

				{/* Payment Options */}
				<Text style={styles.sectionLabel}>Choose how you'd like to pay</Text>

				{/* Pay on Pickup */}
				<TouchableOpacity
					style={[
						styles.paymentCard,
						selectedMethod === "cod" && styles.paymentCardSelected,
						!codAllowed && styles.paymentCardDisabled,
					]}
					onPress={() => setPaymentMethod("cod")}
					disabled={!codAllowed || submitting}
					activeOpacity={0.8}
				>
					<View style={styles.paymentCardInner}>
						<View style={[styles.paymentIcon, !codAllowed && styles.paymentIconDisabled]}>
							<Feather
								name="truck"
								size={22}
								color={codAllowed ? colors.printRequest : colors.textSecondary}
							/>
						</View>
						<View style={styles.paymentTexts}>
							<Text style={[styles.paymentLabel, !codAllowed && styles.paymentLabelDisabled]}>
								Pay on Pickup
							</Text>
							<Text style={styles.paymentSubLabel}>{codSubLabel}</Text>
						</View>
						{loadingShop ? (
							<ActivityIndicator size="small" color={colors.textSecondary} />
						) : (
							<View style={[styles.radioOuter, selectedMethod === "cod" && styles.radioOuterActive]}>
								{selectedMethod === "cod" && <View style={styles.radioInner} />}
							</View>
						)}
					</View>
				</TouchableOpacity>

				{shopLoadFailed && !loadingShop && (
					<TouchableOpacity style={styles.retryButton} onPress={fetchShop} activeOpacity={0.7}>
						<Feather name="refresh-cw" size={14} color={colors.primary} />
						<Text style={styles.retryText}>Check Pay on Pickup again</Text>
					</TouchableOpacity>
				)}

				{/* Pay Upfront */}
				<TouchableOpacity
					style={[
						styles.paymentCard,
						selectedMethod === "upfront" && styles.paymentCardSelected,
					]}
					onPress={() => setPaymentMethod("upfront")}
					disabled={submitting}
					activeOpacity={0.8}
				>
					<View style={styles.paymentCardInner}>
						<View style={styles.paymentIcon}>
							<Feather name="credit-card" size={22} color={colors.printRequest} />
						</View>
						<View style={styles.paymentTexts}>
							<Text style={styles.paymentLabel}>Pay Upfront</Text>
							<Text style={styles.paymentSubLabel}>
								Transfer to the shop and upload your payment proof
							</Text>
						</View>
						<View style={[styles.radioOuter, selectedMethod === "upfront" && styles.radioOuterActive]}>
							{selectedMethod === "upfront" && <View style={styles.radioInner} />}
						</View>
					</View>
				</TouchableOpacity>
			</ScrollView>

			{/* Footer Continue Button */}
			<View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
				<TouchableOpacity
					style={[styles.submitButton, (!selectedMethod || submitting) && styles.submitButtonDisabled]}
					onPress={handleContinue}
					disabled={!selectedMethod || submitting}
				>
					{submitting ? (
						<>
							<ActivityIndicator size="small" color={colors.cardBackground} />
							{retry.label && <Text style={styles.submitButtonText}>{retry.label}</Text>}
						</>
					) : (
						<>
							<Text style={styles.submitButtonText}>
								{!selectedMethod
									? "Select a Payment Method"
									: selectedMethod === "cod"
										? "Submit Job"
										: "Continue to Payment"}
							</Text>
							<Feather name="arrow-right" size={20} color={colors.cardBackground} />
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
		paddingBottom: 140,
	},
	summaryCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		marginBottom: 24,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	summaryRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	summaryIconContainer: {
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: "#FFE8E5",
		justifyContent: "center",
		alignItems: "center",
	},
	summaryTextGroup: {
		flex: 1,
	},
	summaryLabel: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 2,
	},
	summaryShop: {
		fontSize: 12,
		color: colors.textSecondary,
		fontWeight: "500",
	},
	summaryAmount: {
		fontSize: 20,
		fontWeight: "800",
		color: colors.printRequest,
	},
	sectionLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textSecondary,
		marginBottom: 14,
	},
	paymentCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		marginBottom: 12,
		borderWidth: 2,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	paymentCardSelected: {
		borderColor: colors.printRequest,
		backgroundColor: "#FFF8F7",
	},
	paymentCardDisabled: {
		opacity: 0.6,
	},
	paymentCardInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
	},
	paymentIcon: {
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: "#FFE8E5",
		justifyContent: "center",
		alignItems: "center",
	},
	paymentIconDisabled: {
		backgroundColor: colors.background,
	},
	paymentTexts: {
		flex: 1,
	},
	paymentLabel: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 2,
	},
	paymentLabelDisabled: {
		color: colors.textSecondary,
	},
	paymentSubLabel: {
		fontSize: 13,
		color: colors.textSecondary,
		lineHeight: 18,
	},
	radioOuter: {
		width: 22,
		height: 22,
		borderRadius: 11,
		borderWidth: 2,
		borderColor: colors.textSecondary,
		justifyContent: "center",
		alignItems: "center",
	},
	radioOuterActive: {
		borderColor: colors.printRequest,
	},
	radioInner: {
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: colors.printRequest,
	},
	retryButton: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: 6,
		paddingVertical: 6,
		marginTop: -4,
		marginBottom: 12,
		marginLeft: 4,
	},
	retryText: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.primary,
	},
	footer: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: colors.cardBackground,
		padding: 20,
		paddingBottom: 28,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
		shadowColor: colors.shadowMedium,
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 8,
	},
	submitButton: {
		backgroundColor: colors.printRequest,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 16,
		borderRadius: 12,
		gap: 8,
	},
	submitButtonDisabled: {
		opacity: 0.6,
	},
	submitButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},
});

export default PaymentOption;
