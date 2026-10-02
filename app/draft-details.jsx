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
import { checkDraft, submitDraft, updateDraft } from "../services/drafts";
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

const SETTING_LABELS = {
	color: "Color",
	pageType: "Page Size",
	orientation: "Orientation",
	pagesPerSheet: "Pages Per Sheet",
	numberOfCopies: "Copies",
	pageSelection: "Page Range",
	sidedness: "Sidedness",
};

const formatSettingValue = (key, value) => {
	switch (key) {
		case "color":
			return value ? "Colored" : "Black & White";
		case "sidedness":
			return SIDEDNESS_LABELS[value] || value;
		case "pageSelection":
			return value ? value : "All pages";
		case "orientation":
			return String(value).charAt(0).toUpperCase() + String(value).slice(1);
		default:
			return String(value);
	}
};

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
	const codLimit =
		typeof draft?.shop?.codLimit === "number"
			? draft.shop.codLimit
			: typeof shopQuery.data?.codLimit === "number"
				? shopQuery.data.codLimit
				: null;
	const codLimitKnown = codLimit !== null || shopQuery.isSuccess;
	const loadingShop = !codLimitKnown && shopQuery.isFetching;
	// The shop lookup failed (offline, timeout, server error), so whether COD is
	// allowed is unknown — distinct from a shop that has no COD limit.
	const shopLoadFailed = !codLimitKnown && shopQuery.isError && !shopQuery.isFetching;
	const fetchShop = () => shopQuery.refetch();

	const [paymentMethod, setPaymentMethod] = useState(null);
	const [additionalComments, setAdditionalComments] = useState(draft?.additionalComments || "");
	const [submitting, setSubmitting] = useState(false);
	const [expandedFiles, setExpandedFiles] = useState({});
	const [expandedSizes, setExpandedSizes] = useState({ A4: false, A3: false, Other: false });
	const [expandedCostSection, setExpandedCostSection] = useState(false);
	const [expandedFilesSection, setExpandedFilesSection] = useState(false);
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

	// COD is offered only while the job total stays under the shop's limit; an
	// unknown limit (shop without one, or a failed fetch) keeps the option off.
	const total = Number(cost.total ?? 0);
	const codAllowed = typeof codLimit === "number" && total < codLimit;
	// With COD unavailable there is nothing to choose, so upfront is implied.
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

	// Upfront payment continues on the top-up screen, so the comments are saved
	// here before navigating away.
	const handlePayUpfront = async () => {
		try {
			setSubmitting(true);
			await saveAdditionalComments();
			router.push({
				pathname: "/topup",
				params: {
					shopId: shopId || "",
					draftId: draft._id,
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

	// COD needs no payment proof, so the draft is submitted straight from here.
	// submitDraft checks whether a lost attempt went through before retrying,
	// so a bad connection can't create the job twice.
	const handleCashOnDelivery = async () => {
		try {
			setSubmitting(true);
			await saveAdditionalComments();
			await submitDraft(draft._id, "cod", { onRetry: retry.onRetry });
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

	const toggleFile = (id) => {
		setExpandedFiles((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const toggleSize = (size) => {
		setExpandedSizes((prev) => ({ ...prev, [size]: !prev[size] }));
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
			const color = name.includes("COLOR") || name.includes("COLOUR") ? "Color" : "Black & White";
			const sided = name.includes("DOUBLE") || name.includes("LONG") || name.includes("SHORT") ? "Double Sided" : "Single Sided";

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
				{/* Summary Card */}
				<View style={styles.summaryCard}>
					<View style={styles.summaryMain}>
						<View style={styles.summaryIconContainer}>
							<Feather name="file-text" size={20} color={colors.printRequest} />
						</View>
						<View style={styles.summaryTextGroup}>
							<Text style={styles.summaryTitle}>Draft Created</Text>
							<Text style={styles.summaryDate}>{files.length} file{files.length !== 1 ? "s" : ""}</Text>
						</View>
					</View>
					<View style={styles.summaryRight}>
						{needsPrice ? (
							pricingError ? (
								<TouchableOpacity style={styles.codRetryButton} onPress={priceDraft} activeOpacity={0.7}>
									<Feather name="refresh-cw" size={12} color={colors.primary} />
									<Text style={styles.codRetryText}>Retry</Text>
								</TouchableOpacity>
							) : (
								<ActivityIndicator size="small" color={colors.primary} style={styles.pricingSpinner} />
							)
						) : (
							<Text style={styles.summaryTotal}>{formatCurrency(cost.total ?? 0)}</Text>
						)}
						<View style={styles.shopBadge}>
							<Feather name="map-pin" size={10} color={colors.textSecondary} />
							<Text style={styles.shopBadgeText} numberOfLines={1}>{shopName || "Loading..."}</Text>
						</View>
					</View>
				</View>

				{/* Additional Comments */}
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

				{/* Cost Breakdown */}
				<View style={styles.section}>
					<View style={styles.card}>
						<TouchableOpacity 
							style={[styles.cardHeader, expandedCostSection && styles.cardHeaderExpanded]}
							onPress={() => setExpandedCostSection(!expandedCostSection)}
							activeOpacity={0.7}
						>
							<View style={styles.cardHeaderLeft}>
								<Feather name="dollar-sign" size={18} color={colors.printRequest} />
								<Text style={styles.sectionTitle}>Cost Breakdown</Text>
							</View>
							<Feather name={expandedCostSection ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
						</TouchableOpacity>
						
						{expandedCostSection && (
							<View style={styles.cardContent}>
								{Object.keys(costTree).sort().map((size) => (
									<View key={size} style={styles.treeNodeSize}>
										<TouchableOpacity 
											style={styles.treeHeader} 
											onPress={() => toggleSize(size)}
											activeOpacity={0.7}
										>
											<View style={styles.treeHeaderLeft}>
												<Feather name="file" size={16} color={colors.textSecondary} />
												<Text style={styles.treeSizeLabel}>{size}</Text>
											</View>
											<Feather name={expandedSizes[size] ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
										</TouchableOpacity>

										{expandedSizes[size] && Object.keys(costTree[size]).map((color) => (
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
						)}
					</View>
				</View>

				{/* Files Section */}
				<View style={styles.section}>
					<View style={styles.card}>
						<TouchableOpacity 
							style={[styles.cardHeader, expandedFilesSection && styles.cardHeaderExpanded]}
							onPress={() => setExpandedFilesSection(!expandedFilesSection)}
							activeOpacity={0.7}
						>
							<View style={styles.cardHeaderLeft}>
								<Feather name="file-text" size={18} color={colors.printRequest} />
								<Text style={styles.sectionTitle}>Files ({files.length})</Text>
							</View>
							<Feather name={expandedFilesSection ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
						</TouchableOpacity>

						{expandedFilesSection && (
							<View style={styles.cardContent}>
								{files.map((fileEntry, index) => {
									const key = `${fileEntry.file?._id || fileEntry.file}-${index}`;
									const isExpanded = expandedFiles[key];
									return (
										<View key={key} style={[styles.fileCardInner, index < files.length - 1 && styles.fileCardInnerBorder]}>
											<TouchableOpacity 
												style={styles.fileCardHeader}
												onPress={() => toggleFile(key)}
												activeOpacity={0.7}
											>
												<View style={styles.fileIcon}>
													<Feather name="file" size={16} color={colors.printRequest} />
												</View>
												<View style={styles.fileCardHeaderText}>
													<Text style={styles.fileLabel}>{fileEntry.file?.name || `File ${index + 1}`}</Text>
												</View>
												<Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
											</TouchableOpacity>

											{isExpanded && (
												<View style={styles.fileCardContent}>
													<View style={styles.settingsDivider} />
													{Object.entries(fileEntry.settings || {}).map(([sKey, value], i, arr) => (
														<View key={sKey} style={[styles.settingRow, i < arr.length - 1 && styles.settingRowBorder]}>
															<Text style={styles.settingLabel}>{SETTING_LABELS[sKey] || sKey}</Text>
															<Text style={styles.settingValue}>{formatSettingValue(sKey, value)}</Text>
														</View>
													))}
												</View>
											)}
										</View>
									);
								})}
							</View>
						)}
					</View>
				</View>

				{/* Payment Method */}
				<View style={styles.section}>
					<View style={styles.card}>
						<View style={[styles.cardHeader, styles.cardHeaderExpanded]}>
							<View style={styles.cardHeaderLeft}>
								<Feather name="credit-card" size={18} color={colors.printRequest} />
								<Text style={styles.sectionTitle}>Payment Method</Text>
							</View>
						</View>

						<View style={styles.cardContent}>
							<TouchableOpacity
								style={[
									styles.paymentOptionInner,
									styles.paymentOptionInnerBorder,
									!codAllowed && styles.paymentOptionDisabled,
								]}
								onPress={() => setPaymentMethod("cod")}
								disabled={!codAllowed || submitting}
								activeOpacity={0.8}
							>
								<View style={[styles.paymentIcon, !codAllowed && styles.paymentIconDisabled]}>
									<Feather
										name="truck"
										size={18}
										color={codAllowed ? colors.printRequest : colors.textSecondary}
									/>
								</View>
								<View style={styles.paymentTexts}>
									<Text style={[styles.paymentLabel, !codAllowed && styles.paymentLabelDisabled]}>
										Cash on Delivery
									</Text>
									<Text style={styles.paymentSubLabel}>{codSubLabel}</Text>
								</View>
								{loadingShop ? (
									<ActivityIndicator size="small" color={colors.textSecondary} />
								) : (
									<Feather
										name={selectedMethod === "cod" ? "check-circle" : "circle"}
										size={20}
										color={selectedMethod === "cod" ? colors.printRequest : colors.textSecondary}
									/>
								)}
							</TouchableOpacity>

							{shopLoadFailed && !loadingShop && (
								<TouchableOpacity style={styles.codRetryButton} onPress={fetchShop} activeOpacity={0.7}>
									<Feather name="refresh-cw" size={14} color={colors.primary} />
									<Text style={styles.codRetryText}>Check Cash on Delivery again</Text>
								</TouchableOpacity>
							)}

							<TouchableOpacity
								style={styles.paymentOptionInner}
								onPress={() => setPaymentMethod("upfront")}
								disabled={submitting}
								activeOpacity={0.8}
							>
								<View style={styles.paymentIcon}>
									<Feather name="credit-card" size={18} color={colors.printRequest} />
								</View>
								<View style={styles.paymentTexts}>
									<Text style={styles.paymentLabel}>Pay Upfront</Text>
									<Text style={styles.paymentSubLabel}>
										Transfer to the shop and upload your payment proof
									</Text>
								</View>
								<Feather
									name={selectedMethod === "upfront" ? "check-circle" : "circle"}
									size={20}
									color={selectedMethod === "upfront" ? colors.printRequest : colors.textSecondary}
								/>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</ScrollView>

			{/* Footer Continue Button */}
			<View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
				<TouchableOpacity
					style={[styles.submitButton, (!selectedMethod || submitting || needsPrice) && styles.submitButtonDisabled]}
					onPress={handleContinue}
					disabled={!selectedMethod || submitting || needsPrice}
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
										: "Pay Upfront"}
							</Text>
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
	summaryCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		flexDirection: "row",
		justifyContent: "space-between",
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
	summaryMain: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		flex: 1,
	},
	summaryIconContainer: {
		width: 48,
		height: 48,
		borderRadius: 12,
		backgroundColor: "#FFE8E5",
		justifyContent: "center",
		alignItems: "center",
	},
	summaryTextGroup: {
		flex: 1,
	},
	summaryTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 2,
	},
	summaryDate: {
		fontSize: 12,
		color: colors.textSecondary,
	},
	summaryRight: {
		alignItems: "flex-end",
		gap: 6,
		maxWidth: "40%",
	},
	summaryTotal: {
		fontSize: 18,
		fontWeight: "800",
		color: colors.printRequest,
	},
	shopBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	shopBadgeText: {
		fontSize: 11,
		color: colors.textSecondary,
		fontWeight: "500",
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
	fileCardInner: {
		paddingVertical: 12,
	},
	fileCardInnerBorder: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	fileCardHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	fileCardContent: {
		marginTop: 12,
	},
	fileIcon: {
		width: 36,
		height: 36,
		borderRadius: 10,
		backgroundColor: "#FFE8E5",
		justifyContent: "center",
		alignItems: "center",
	},
	fileCardHeaderText: {
		flex: 1,
	},
	fileLabel: {
		fontSize: 14,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 2,
	},
	fileHash: {
		fontSize: 11,
		color: colors.textSecondary,
		fontFamily: "monospace",
	},
	settingsDivider: {
		height: 1,
		backgroundColor: colors.borderLight,
		marginBottom: 12,
	},
	settingRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 9,
	},
	settingRowBorder: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	settingLabel: {
		fontSize: 13,
		color: colors.textSecondary,
		fontWeight: "500",
	},
	settingValue: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textPrimary,
		textAlign: "right",
		maxWidth: "55%",
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
	paymentOptionInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 12,
	},
	paymentOptionInnerBorder: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	paymentOptionDisabled: {
		opacity: 0.6,
	},
	paymentIcon: {
		width: 36,
		height: 36,
		borderRadius: 10,
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
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	paymentLabelDisabled: {
		color: colors.textSecondary,
	},
	pricingSpinner: {
		marginVertical: 8,
	},
	codRetryButton: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: 6,
		paddingVertical: 6,
		marginTop: -4,
		marginBottom: 8,
	},
	codRetryText: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.primary,
	},
	paymentSubLabel: {
		fontSize: 12,
		color: colors.textSecondary,
		marginTop: 2,
	},
});

export default DraftDetails;
