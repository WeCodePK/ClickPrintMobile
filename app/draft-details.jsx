//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	StatusBar,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "../constants/colors";
import { queryKeys, useDraftQuery, useShopQuery } from "../hooks/queries";
import { useRetryStatus } from "../hooks/useRetryStatus";
import { checkDraft, updateDraft } from "../services/drafts";
import { showAlert } from "../utils/alert";
import { documentsFromDraft, segmentsArrayFromDraft } from "../utils/draft";
import { friendlyMessage } from "../utils/errors";
import { onOnlineChange } from "../utils/network";

//----------------------------------- CONSTANTS -----------------------------------//

const SIDEDNESS_LABELS = {
	none: "Single Sided",
	long: "Double Sided (Long Edge)",
	short: "Double Sided (Short Edge)",
};

const DUPLEX_LABELS = {
	long: "Long Edge",
	short: "Short Edge",
};

const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "—");

// Laid out row by row in a two-column grid, matching job-details.jsx
const SETTINGS_LAYOUT = [
	{ label: "Size", format: (s) => s.pageType ?? "—" },
	{ label: "Orientation", format: (s) => capitalize(s.orientation) },
	{ label: "Color", format: (s) => (s.color ? "Colored" : "Black & White") },
	{ label: "Copies", format: (s) => s.numberOfCopies ?? "—" },
	{ label: "Pages", format: (s) => s.pageSelection || "All" },
	{ label: "Pages/Sheet", format: (s) => s.pagesPerSheet ?? "—" },
	{ label: "Sides", format: (s) => (s.sidedness && s.sidedness !== "none" ? "Double" : "Single") },
	{ label: "Duplex", format: (s) => DUPLEX_LABELS[s.sidedness] ?? "—" },
];

const formatCurrency = (amount) => `Rs. ${amount}`;

//----------------------------------- COMPONENTS -----------------------------------//

const DraftDetails = () => {
	const router = useRouter();
	const params = useLocalSearchParams();
	const insets = useSafeAreaInsets();

	// Screens navigate here with the draft id; the draft itself comes from the
	// cache (seeded by the pricing step), so it survives reloads and opens
	// offline. `draft` (a JSON copy) is still accepted from older links.
	const draftId =
		params.draftId ||
		(() => {
			try {
				return JSON.parse(params.draft)?._id;
			} catch {
				return null;
			}
		})();
	const queryClient = useQueryClient();
	const draftQuery = useDraftQuery(draftId);
	const draft = draftQuery.data ?? null;

	const shopId = draft?.shop?._id || (typeof draft?.shop === "string" ? draft.shop : null);
	// The draft can carry the shop unpopulated (id only) or without the COD
	// limit, so the (cached) shop record fills those in.
	const shopQuery = useShopQuery(shopId);
	const shopName = draft?.shop?.name || shopQuery.data?.name || "";

	const [additionalComments, setAdditionalComments] = useState(draft?.additionalComments || "");
	const [submitting, setSubmitting] = useState(false);
	const [showMoreDetails, setShowMoreDetails] = useState(false);
	const retry = useRetryStatus();

	// Comments typed before the draft finished loading aren't overwritten.
	const commentsTouched = useRef(false);
	useEffect(() => {
		if (draft && !commentsTouched.current) setAdditionalComments(draft.additionalComments || "");
	}, [draft]);

	// Any edit to a draft clears its price, so price it here when it has none.
	// Pricing needs the backend: offline, it runs again once reconnected.
	const [pricing, setPricing] = useState(false);
	const [pricingError, setPricingError] = useState(null);
	const priceDraft = useCallback(async () => {
		if (!draftId) return;
		setPricing(true);
		setPricingError(null);
		try {
			await checkDraft(draftId);
		} catch (err) {
			setPricingError(friendlyMessage(err, "Couldn't calculate the price."));
		} finally {
			setPricing(false);
		}
	}, [draftId]);
	const needsPrice = !!draft && !draft.cost;
	useEffect(() => {
		if (needsPrice && !pricing && !pricingError) priceDraft();
	}, [needsPrice, pricing, pricingError, priceDraft]);
	useEffect(() => {
		if (!pricingError) return;
		return onOnlineChange((online) => online && priceDraft());
	}, [pricingError, priceDraft]);

	if (!draft && draftQuery.isPending && draftId) {
		return (
			<SafeAreaView style={styles.container} edges={["top"]}>
				<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
				<View style={styles.emptyState}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
			</SafeAreaView>
		);
	}

	if (!draft) {
		return (
			<SafeAreaView style={styles.container} edges={["top"]}>
				<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
				<View style={styles.header}>
					<TouchableOpacity onPress={() => router.replace("/(tabs)/home")} style={styles.backButton}>
						<Feather name="arrow-left" size={24} color={colors.textPrimary} />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Draft Details</Text>
					<View style={styles.placeholder} />
				</View>
				<View style={styles.emptyState}>
					<Text style={styles.emptyText}>
						{draftQuery.isError
							? friendlyMessage(draftQuery.error, "This draft couldn't be loaded.")
							: "No draft information available."}
					</Text>
				</View>
			</SafeAreaView>
		);
	}

	const cost = draft.cost || {};
	const files = draft.files || [];

	const total = Number(cost.total ?? 0);

	//----------------------------------- HANDLERS -----------------------------------//

	// Back returns to shop selection so the user can change the shop; the draft
	// already holds the files/settings needed to repopulate the flow.
	const handleBack = () => {
		if (draft?._id) {
			router.replace({
				pathname: "/shop-details",
				params: {
					draftId: draft._id,
					documents: JSON.stringify(documentsFromDraft(draft)),
					allSettings: JSON.stringify(segmentsArrayFromDraft(draft)),
				},
			});
		} else {
			router.replace("/(tabs)/home");
		}
	};

	// Comments belong to the draft, so they are saved with a PUT before the job
	// leaves this screen; /submit only carries the payment method. The PUT
	// clears the draft's price on the backend, but comments don't change it, so
	// the cached price is kept (submit re-prices anyway).
	const saveAdditionalComments = async () => {
		const trimmed = additionalComments.trim();
		if (trimmed === (draft?.additionalComments || "").trim()) return;
		const previousCost = draft.cost;
		await updateDraft(draft._id, { additionalComments: trimmed }, { onRetry: retry.onRetry });
		queryClient.setQueryData(queryKeys.draft(draft._id), (d) => d && { ...d, cost: d.cost ?? previousCost });
	};

	const handleContinue = async () => {
		try {
			setSubmitting(true);
			await saveAdditionalComments();
			router.push({
				pathname: "/payment-option",
				params: {
					draftId: draft._id,
					shopId: shopId || "",
					amount: String(cost.total ?? 0),
				},
			});
		} catch (err) {
			console.error("Error saving comments:", err);
			showAlert("Couldn't save your comments", friendlyMessage(err, "Failed to save your comments. Please try again."));
		} finally {
			setSubmitting(false);
			retry.reset();
		}
	};

	// Group cost lines into a tree: Size -> Color -> Sidedness
	const groupCostLines = (lines) => {
		const tree = {};
		const others = [];
		(lines || []).forEach((line) => {
			const name = (line.item || "").toUpperCase();
			const isA3 = name.includes("A3");
			const isA4 = name.includes("A4");
			if (!isA3 && !isA4) {
				others.push(line);
				return;
			}
			const size = isA3 ? "A3" : "A4";
			const color = name.includes("COLOR") || name.includes("COLOUR") || name.includes("-CL") || name.includes(" CL") ? "Color" : "Black & White";
			const sided = name.includes("DOUBLE") || name.includes("LONG") || name.includes("SHORT") || name.includes("-DS") || name.includes(" DS") ? "Double Sided" : "Single Sided";

			if (!tree[size]) tree[size] = {};
			if (!tree[size][color]) tree[size][color] = [];
			tree[size][color].push({ ...line, label: sided });
		});
		return { tree, others };
	};
	const { tree: costTree, others: costOthers } = groupCostLines(cost.lines);

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={handleBack} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Draft Details</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				keyboardShouldPersistTaps="handled"
			>
				{/* Additional Comments — now on top */}
				<View style={styles.section}>
					<View style={styles.card}>
						<View style={[styles.cardHeader, styles.cardHeaderExpanded]}>
							<View style={styles.cardHeaderLeft}>
								<Feather name="message-square" size={18} color={colors.printRequest} />
								<Text style={styles.sectionTitle}>Additional Comments</Text>
							</View>
						</View>
						<View style={styles.cardContent}>
							<TextInput
								style={styles.commentsInputInner}
								placeholder="Anything the shop should know about this job? (optional)"
								placeholderTextColor={colors.textSecondary}
								value={additionalComments}
								onChangeText={(text) => {
									commentsTouched.current = true;
									setAdditionalComments(text);
								}}
								editable={!submitting}
								multiline
								textAlignVertical="top"
								maxLength={500}
							/>
						</View>
					</View>
				</View>

				{/* Cost Breakdown — always expanded, no toggle */}
				<View style={styles.section}>
					<View style={styles.card}>
						<View style={[styles.cardHeader, styles.cardHeaderExpanded]}>
							<View style={styles.cardHeaderLeft}>
								<Feather name="dollar-sign" size={18} color={colors.printRequest} />
								<Text style={styles.sectionTitle}>Cost Breakdown</Text>
							</View>
							{needsPrice && (
								pricingError ? (
									<TouchableOpacity style={styles.pricingRetryButton} onPress={priceDraft} activeOpacity={0.7}>
										<Feather name="refresh-cw" size={12} color={colors.primary} />
										<Text style={styles.pricingRetryText}>Retry</Text>
									</TouchableOpacity>
								) : (
									<ActivityIndicator size="small" color={colors.primary} />
								)
							)}
						</View>
						
						<View style={styles.cardContent}>
							{Object.keys(costTree).sort().map((size) => (
								<View key={size} style={styles.treeNodeSize}>
									<View style={styles.treeHeader}>
										<View style={styles.treeHeaderLeft}>
											<Feather name="file" size={16} color={colors.textSecondary} />
											<Text style={styles.treeSizeLabel}>{size}</Text>
										</View>
									</View>

									{Object.keys(costTree[size]).map((color) => (
										<View key={color} style={styles.treeNodeColor}>
											<View style={styles.treeColorHeader}>
												<View style={[styles.colorIndicator, color === "Color" && styles.colorIndicatorGradient]} />
												<Text style={styles.treeColorLabel}>{color}</Text>
											</View>
											{costTree[size][color].map((line, idx) => (
												<View key={idx} style={styles.treeNodeSided}>
													<View style={styles.treeSidedLeft}>
														<Feather name={line.label === "Double Sided" ? "copy" : "square"} size={14} color={colors.textSecondary} />
														<Text style={styles.treeSidedLabel}>{line.label}</Text>
														<Text style={styles.treeSidedQty}>({line.quantity})</Text>
													</View>
													<Text style={styles.treeSidedValue}>{formatCurrency(line.subtotal)}</Text>
												</View>
											))}
										</View>
									))}
								</View>
							))}

							{/* Other items not matching standard patterns */}
							{costOthers.map((line, index) => (
								<View key={`other-${index}`} style={styles.costRow}>
									<View style={styles.costRowLeft}>
										<Text style={styles.costLabel}>{line.item}</Text>
										<Text style={styles.costSubLabel}>{line.quantity} × {formatCurrency(line.rate)}</Text>
									</View>
									<Text style={styles.costValue}>{formatCurrency(line.subtotal)}</Text>
								</View>
							))}

							{(cost.extra || []).map((extra, index) => (
								<View key={`extra-${index}`} style={styles.costRow}>
									<View style={styles.costRowLeft}>
										<Text style={styles.costLabel}>{extra.item}</Text>
									</View>
									<Text style={styles.costValue}>{formatCurrency(extra.subtotal)}</Text>
								</View>
							))}
							<View style={[styles.totalRow, { paddingBottom: 0 }]}>
								<Text style={styles.totalLabel}>Total</Text>
								<Text style={styles.totalValue}>{formatCurrency(cost.total ?? 0)}</Text>
							</View>
						</View>
					</View>
				</View>

				{/* More Details — collapsed by default */}
				<View style={styles.section}>
					<TouchableOpacity
						style={styles.moreDetailsToggle}
						onPress={() => setShowMoreDetails((prev) => !prev)}
						activeOpacity={0.7}
					>
						<Text style={styles.moreDetailsTitle}>More details</Text>
						<Feather name={showMoreDetails ? "chevron-up" : "chevron-down"} size={20} color={colors.textPrimary} />
					</TouchableOpacity>

					{showMoreDetails && (
						<View style={styles.moreDetailsPane}>
							{/* Files Section — matching job-details.jsx style */}
							<View style={styles.sectionHeader}>
								<Feather name="file-text" size={18} color={colors.printRequest} />
								<Text style={styles.sectionTitle}>Files ({files.length})</Text>
							</View>
							{files.map((fileEntry, index) => {
								const pages = fileEntry.file?.numberOfPages;
								return (
									<View key={fileEntry.file?._id ?? index} style={[styles.fileCard, index < files.length - 1 && styles.fileCardSpacing]}>
										<View style={styles.fileCardHeader}>
											<View style={styles.fileIndex}>
												<Text style={styles.fileIndexText}>{index + 1}</Text>
											</View>
											<Text style={styles.fileLabel} numberOfLines={1}>
												{fileEntry.file?.name || `File ${index + 1}`}
											</Text>
											{pages != null && (
												<Text style={styles.fileMeta}> · {pages} page{pages !== 1 ? "s" : ""}</Text>
											)}
										</View>

										<View style={styles.settingsGrid}>
											{SETTINGS_LAYOUT.map(({ label, format }) => (
												<View key={label} style={styles.settingCell}>
													<Text style={styles.settingLabel}>{label}</Text>
													<Text style={styles.settingValue}>{format(fileEntry.settings || {})}</Text>
												</View>
											))}
										</View>
									</View>
								);
							})}
						</View>
					)}
				</View>
			</ScrollView>

			{/* Footer Continue Button */}
			<View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
				<TouchableOpacity
					style={[styles.submitButton, (submitting || needsPrice) && styles.submitButtonDisabled]}
					onPress={handleContinue}
					disabled={submitting || needsPrice}
				>
					{submitting ? (
						<>
							<ActivityIndicator size="small" color={colors.cardBackground} />
							{retry.label && <Text style={styles.submitButtonText}>{retry.label}</Text>}
						</>
					) : (
						<>
							<Text style={styles.submitButtonText}>Continue to Payment</Text>
							<Feather name="arrow-right" size={20} color={colors.cardBackground} />
						</>
					)}
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
};

//----------------------------------- HELPERS -----------------------------------//

const InfoRow = ({ label, value, mono = false }) => (
	<View style={styles.infoRow}>
		<Text style={styles.infoLabel}>{label}</Text>
		<Text style={[styles.infoValue, mono && styles.infoValueMono]} numberOfLines={1} ellipsizeMode="middle">
			{value}
		</Text>
	</View>
);

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
	emptyState: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	emptyText: {
		fontSize: 14,
		color: colors.textSecondary,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		padding: 20,
		paddingBottom: 140,
	},
	section: {
		marginBottom: 20,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 12,
	},
	sectionTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	card: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	cardHeaderExpanded: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	cardHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	cardContent: {
		paddingHorizontal: 16,
		paddingBottom: 16,
	},
	commentsInputInner: {
		minHeight: 96,
		backgroundColor: colors.background,
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 14,
		color: colors.textPrimary,
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 13,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	infoLabel: {
		fontSize: 14,
		color: colors.textSecondary,
		fontWeight: "500",
	},
	infoValue: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
		maxWidth: "55%",
		textAlign: "right",
	},
	infoValueMono: {
		fontFamily: "monospace",
		fontSize: 12,
		color: colors.textSecondary,
	},
	costRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 13,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	costRowLeft: {
		flex: 1,
	},
	costLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	costSubLabel: {
		fontSize: 12,
		color: colors.textSecondary,
		marginTop: 2,
	},
	costValue: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	totalRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 14,
	},
	totalLabel: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	totalValue: {
		fontSize: 18,
		fontWeight: "800",
		color: colors.primary,
	},
	treeNodeSize: {
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	treeHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
	},
	treeHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	treeSizeLabel: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	treeNodeColor: {
		marginLeft: 16,
		marginTop: 8,
		paddingLeft: 12,
		borderLeftWidth: 1,
		borderLeftColor: colors.borderLight,
	},
	treeColorHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 8,
	},
	colorIndicator: {
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: "#4A5568", // Gray for B&W
	},
	colorIndicatorGradient: {
		backgroundColor: colors.primary, // Could use a gradient background in a real app, fallback to primary
	},
	treeColorLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	treeNodeSided: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 6,
		paddingLeft: 16,
	},
	treeSidedLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	treeSidedLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	treeSidedQty: {
		fontSize: 12,
		color: colors.textSecondary,
	},
	treeSidedValue: {
		fontSize: 14,
		fontWeight: "700",
		color: colors.primary,
	},
	pricingRetryButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingVertical: 4,
		paddingHorizontal: 8,
	},
	pricingRetryText: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.primary,
	},
	// File card styles — matching job-details.jsx
	fileCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 12,
		padding: 12,
	},
	fileCardSpacing: {
		marginBottom: 8,
	},
	fileCardHeader: {
		flexDirection: "row",
		alignItems: "center",
	},
	fileIndex: {
		flexShrink: 0,
		minWidth: 22,
		height: 22,
		paddingHorizontal: 6,
		borderRadius: 11,
		marginRight: 8,
		backgroundColor: "rgba(0, 217, 163, 0.12)",
		alignItems: "center",
		justifyContent: "center",
	},
	fileIndexText: {
		fontSize: 12,
		fontWeight: "700",
		color: colors.primaryDark,
	},
	fileLabel: {
		flexShrink: 1,
		fontSize: 14,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	fileMeta: {
		flexShrink: 0,
		fontSize: 12,
		color: colors.textSecondary,
		fontWeight: "500",
	},
	settingsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		marginTop: 8,
		paddingLeft: 30,
		rowGap: 8,
	},
	settingCell: {
		width: "50%",
		paddingRight: 8,
	},
	settingLabel: {
		fontSize: 11,
		color: colors.textSecondary,
		fontWeight: "500",
	},
	settingValue: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textPrimary,
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
	moreDetailsToggle: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		paddingTop: 12,
		paddingBottom: 4,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
	},
	moreDetailsTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	moreDetailsPane: {
		paddingTop: 16,
	},
});

export default DraftDetails;
