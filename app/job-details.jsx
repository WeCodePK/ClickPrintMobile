//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import PullToRefreshScrollView from "../components/PullToRefreshScrollView";
import config from "../config/config";
import { colors } from "../constants/colors";
import { fetchTransactions } from "../services/fetchTransactions";
import showAlert from "../utils/alert";
import SecureStore from "../utils/storage";

//----------------------------------- CONSTANTS -----------------------------------//

// TODO: placeholder until the backend sends a per-job estimate as `job.eta`.
const PLACEHOLDER_ETA = "5 - 10 mins";

const PROGRESS_STEPS = ["submitted", "queued", "printing", "completed"];

// Where each non-step status sits on the progress bar.
const PROGRESS_ALIASES = { pending: 0, processing: 2 };

// Statuses that end the job: no time estimate, and the progress bar stops moving.
const FINAL_STATUSES = ["completed", "cancelled", "failed"];

// One fade out and back in of the current progress segment.
const SEGMENT_PULSE_DURATION = 1200;

// The estimate's glint, matching the home screen's active-job card: one sweep
// per cycle, and each slice of the band's opacity, softest at the edges.
const GLINT_DURATION = 1600;
const GLINT_SLICES = [0.2, 0.5, 0.8, 0.5, 0.2];
const GLINT_SLICE_WIDTH = 4;
const GLINT_WIDTH = GLINT_SLICES.length * GLINT_SLICE_WIDTH;

const STATUS_CONFIG = {
	completed: { label: "Completed", color: colors.primary, bg: "rgba(0, 217, 163, 0.12)", icon: "check" },
	submitted: { label: "Submitted", color: colors.textSecondary, bg: "rgba(143, 155, 179, 0.12)", icon: "send" },
	processing: { label: "Processing", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", icon: "loader" },
	queued: { label: "Queued", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", icon: "clock" },
	printing: { label: "Printing", color: colors.primary, bg: "rgba(0, 217, 163, 0.12)", icon: "printer" },
	cancelled: { label: "Cancelled", color: colors.danger, bg: "rgba(255, 90, 95, 0.12)", icon: "x" },
	failed: { label: "Failed", color: colors.danger, bg: "rgba(255, 90, 95, 0.12)", icon: "alert-triangle" },
	pending: { label: "Pending", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", icon: "clock" },
};

const DUPLEX_LABELS = {
	long: "Long Edge",
	short: "Short Edge",
};

const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "—");

// Laid out row by row in a two-column grid, so each pair is [left column, right column].
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

const formatCurrency = (amount) => `Rs. ${amount ?? 0}`;

//----------------------------------- COMPONENTS -----------------------------------//

const TransactionDetails = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams();
	const transaction = JSON.parse(params.transaction);

	const [shopName, setShopName] = useState("Print Job");
	const [shopImageUrl, setShopImageUrl] = useState(null);
	const [cancelling, setCancelling] = useState(false);
	const [jobStatus, setJobStatus] = useState(transaction.status);
	const [job, setJob] = useState(null);
	const [showMoreDetails, setShowMoreDetails] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	// Prefer freshly fetched job data, fall back to the list payload for instant render.
	const files = job?.files ?? transaction.files ?? [];
	const cost = job?.cost ?? transaction.costBreakdown ?? null;
	const statusHistory = job?.statusHistory ?? transaction.statusHistory ?? [];
	const jobCode = job?.code ?? transaction.code;
	const hasCostBreakdown = !!cost && (cost.lines?.length > 0 || cost.extra?.length > 0);
	const additionalComments = (job?.additionalComments ?? transaction.additionalComments ?? "").trim();
	// The backend populates this as { _id, name }; the list data already holds just the id.
	const paymentProofFile = job?.paymentProofFile?._id ?? job?.paymentProofFile ?? transaction.paymentProofFile ?? null;
	const paymentProofName = job?.paymentProofFile?.name ?? transaction.paymentProofFileName ?? null;
	// What the More details section has to show, so dividers only go between blocks that are there.
	const hasComments = additionalComments.length > 0;
	const hasProof = !!paymentProofFile;
	const hasHistory = statusHistory.length > 0;
	const eta = job?.eta ?? transaction.eta ?? PLACEHOLDER_ETA;
	const fileCount = files.length;
	const totalPages = files.reduce((sum, f) => sum + (f.file?.numberOfPages || 0), 0);
	const totalCost = cost?.total ?? transaction.cost ?? 0;

	const CANCELLABLE_STATUSES = ["submitted", "queued", "pending", "processing"];

	const statusConfig = STATUS_CONFIG[jobStatus] || {
		label: jobStatus,
		color: colors.textSecondary,
		bg: colors.background,
	};

	const handleCancelJob = () => {
		showAlert(
			jobCode ? `Cancel Job #${jobCode}?` : "Cancel Job?",
			"Are you sure you want to cancel this job?",
			[
				{ text: "No", style: "cancel" },
				{
					text: "Cancel",
					style: "destructive",
					onPress: async () => {
						try {
							setCancelling(true);
							const token = await SecureStore.getItemAsync("authToken");
							const res = await fetch(
								`${config.apiBaseUrl}/jobs/${transaction.id}/status`,
								{
									method: "PATCH",
									headers: {
										"Content-Type": "application/json",
										Authorization: `Bearer ${token}`,
									},
									body: JSON.stringify({ status: "cancelled" }),
								}
							);
							const data = await res.json();
							if (res.ok && data.success !== false) {
								setJobStatus("cancelled");
							} else {
								showAlert("Error", data.message || "Failed to cancel the job.");
							}
						} catch (e) {
							console.error("Error cancelling job:", e);
							showAlert("Error", "Something went wrong. Please try again.");
						} finally {
							setCancelling(false);
						}
					},
				},
			]
		);
	};

	useEffect(() => {
		const fetchShopName = async () => {
			if (!transaction.shopId) return;
			try {
				const token = await SecureStore.getItemAsync("authToken");
				const res = await fetch(`${config.apiBaseUrl}/shops/${transaction.shopId}`, {
					headers: { Authorization: `Bearer ${token}` }
				});
				const data = await res.json();
				if (data.success && data.data?.shop?.name) {
					setShopName(data.data.shop.name);
				}
				if (data.success && data.data?.shop?.imageUrl) {
					setShopImageUrl(data.data.shop.imageUrl);
				}
			} catch (e) {
				console.error("Error fetching shop name:", e);
			}
		};
		fetchShopName();
	}, [transaction.shopId]);

	const fetchJob = useCallback(async () => {
		if (!transaction.id) return;
		try {
			const token = await SecureStore.getItemAsync("authToken");
			const res = await fetch(`${config.apiBaseUrl}/jobs/${transaction.id}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			let fetchedJob = null;
			if (res.ok) {
				const data = await res.json();
				fetchedJob = data.data?.job ?? null;
			} else if (res.status === 404) {
				// Once a job is completed, cancelled or failed the backend moves it out
				// of Jobs into History (keeping its _id), so look for it there instead.
				const history = await fetchTransactions();
				fetchedJob = history.find((h) => h._id === transaction.id) ?? null;
			}
			if (fetchedJob) {
				setJob(fetchedJob);
				setJobStatus(fetchedJob.status);
				if (fetchedJob.shop?.name) setShopName(fetchedJob.shop.name);
			}
		} catch (e) {
			console.error("Error fetching job:", e);
		}
	}, [transaction.id]);

	// Finished jobs come from History with everything already filled in, so only
	// jobs still in progress need fetching fresh.
	useEffect(() => {
		if (!FINAL_STATUSES.includes(transaction.status)) fetchJob();
	}, [fetchJob, transaction.status]);

	const handleRefresh = async () => {
		setRefreshing(true);
		await fetchJob();
		setRefreshing(false);
	};

	// Only jobs still in progress can change, so finished ones don't get pull-to-refresh.
	const isActive = !FINAL_STATUSES.includes(jobStatus);
	const ScrollContainer = isActive ? PullToRefreshScrollView : ScrollView;

	const formatDateTime = (isoString) => {
		const date = new Date(isoString);
		return date.toLocaleString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>{jobCode ? `Job #${jobCode}` : "Job Details"}</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollContainer
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				{...(isActive && { refreshing, onRefresh: handleRefresh })}
			>
				{/* Summary Card */}
				<View style={styles.summaryCard}>
					<View style={styles.summaryTop}>
						{FINAL_STATUSES.includes(jobStatus) ? (
							<Text style={[styles.summaryFinal, { color: statusConfig.color }]}>{statusConfig.label}</Text>
						) : (
							<View style={styles.etaBlock}>
								<Text style={styles.etaCaption}>Estimated time</Text>
								<EtaGlint eta={eta} />
							</View>
						)}
						<View style={styles.summaryBadges}>
							{jobCode && <Text style={styles.jobCode}>#{jobCode}</Text>}
							{!FINAL_STATUSES.includes(jobStatus) && (
								<View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
									<Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
								</View>
							)}
						</View>
					</View>

					<JobProgress status={jobStatus} color={statusConfig.color} />

					<View style={styles.summaryFooter}>
						{shopImageUrl ? (
							<Image source={{ uri: shopImageUrl }} style={styles.shopImage} contentFit="cover" transition={200} />
						) : (
							<Feather name="map-pin" size={14} color={colors.textSecondary} />
						)}
						<Text style={styles.summaryShop} numberOfLines={1}>
							{shopName}
							<Text style={styles.summaryFiles}>
								{" "}· {fileCount} file{fileCount !== 1 ? "s" : ""} · {totalPages} page{totalPages !== 1 ? "s" : ""}
							</Text>
						</Text>
					</View>
				</View>

				{/* Cost Breakdown */}
				{hasCostBreakdown && (
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<Feather name="dollar-sign" size={18} color={colors.primary} />
							<Text style={styles.sectionTitle}>Cost Breakdown</Text>
						</View>
						<View style={styles.card}>
							{(cost.lines || []).map((line, index) => (
								<View key={`line-${index}`} style={styles.costRow}>
									<Text style={styles.costLabel}>
										{line.item}
										<Text style={styles.costSubLabel}>
											{"  "}({line.quantity} × {formatCurrency(line.rate)})
										</Text>
									</Text>
									<Text style={styles.costValue}>{formatCurrency(line.subtotal)}</Text>
								</View>
							))}
							{(cost.extra || []).map((extra, index) => (
								<View key={`extra-${index}`} style={styles.costRow}>
									<Text style={styles.costLabel}>{extra.item}</Text>
									<Text style={styles.costValue}>{formatCurrency(extra.subtotal)}</Text>
								</View>
							))}
							<View style={styles.totalRow}>
								<Text style={styles.totalLabel}>Total</Text>
								<Text style={styles.totalValue}>{formatCurrency(totalCost)}</Text>
							</View>
						</View>
					</View>
				)}

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
							{/* Additional Comments */}
							{hasComments && (
								<View style={styles.section}>
									<View style={styles.sectionHeader}>
										<Feather name="message-square" size={18} color={colors.primary} />
										<Text style={styles.sectionTitle}>Additional Comments</Text>
									</View>
									<View style={styles.card}>
										<Text style={styles.commentsText}>{additionalComments}</Text>
									</View>
								</View>
							)}

							{/* Payment Proof */}
							{hasComments && hasProof && <View style={styles.detailsDivider} />}
							{hasProof && (
								<View style={styles.section}>
									<View style={styles.sectionHeader}>
										<Feather name="image" size={18} color={colors.primary} />
										<Text style={styles.sectionTitle}>Payment Proof</Text>
									</View>
									<PaymentProof fileId={paymentProofFile} fileName={paymentProofName} />
								</View>
							)}

							{/* Status History */}
							{(hasComments || hasProof) && hasHistory && <View style={styles.detailsDivider} />}
							{hasHistory && (
								<View style={styles.section}>
									<View style={styles.sectionHeader}>
										<Feather name="clock" size={18} color={colors.primary} />
										<Text style={styles.sectionTitle}>Status History</Text>
									</View>
									<View style={[styles.card, styles.historyList]}>
										{statusHistory.map((entry, index) => {
											const entryConfig = STATUS_CONFIG[entry.status] || { label: entry.status, color: colors.textSecondary, bg: colors.background };
											const isLast = index === statusHistory.length - 1;
											return (
												<View key={`${entry.status}-${index}`} style={styles.timelineItem}>
													<View style={styles.timelineLeft}>
														<View style={[styles.timelineIcon, { backgroundColor: entryConfig.bg }]}>
															<Feather name={entryConfig.icon || "circle"} size={14} color={entryConfig.color} />
														</View>
														{!isLast && <View style={styles.timelineLine} />}
													</View>
													<View style={[styles.timelineContent, !isLast && styles.timelineContentSpacing]}>
														<View style={[styles.timelinePill, { backgroundColor: entryConfig.bg }]}>
															<Text style={[styles.timelineStatus, { color: entryConfig.color }]}>{entryConfig.label}</Text>
														</View>
														<Text style={styles.timelineMeta}>
															{formatDateTime(entry.at)}
															{entry.by ? ` · by ${entry.by}` : ""}
														</Text>
													</View>
												</View>
											);
										})}
									</View>
								</View>
							)}

							{/* Files */}
							{(hasComments || hasProof || hasHistory) && <View style={styles.detailsDivider} />}
							<View style={styles.sectionHeader}>
								<Feather name="file-text" size={18} color={colors.primary} />
								<Text style={styles.sectionTitle}>Files</Text>
							</View>
							{files.map((file, index) => {
								const pages = file.file?.numberOfPages;
								return (
									<View key={file.file?._id ?? index} style={[styles.fileCard, index < files.length - 1 && styles.fileCardSpacing]}>
										<View style={styles.fileCardHeader}>
											<View style={styles.fileIndex}>
												<Text style={styles.fileIndexText}>{index + 1}</Text>
											</View>
											<Text style={styles.fileLabel} numberOfLines={1}>
												{file.file?.name || `File ${index + 1}`}
											</Text>
											{pages != null && (
												<Text style={styles.fileMeta}> · {pages} page{pages !== 1 ? "s" : ""}</Text>
											)}
										</View>

										<View style={styles.settingsGrid}>
											{SETTINGS_LAYOUT.map(({ label, format }) => (
												<View key={label} style={styles.settingCell}>
													<Text style={styles.settingLabel}>{label}</Text>
													<Text style={styles.settingValue}>{format(file.settings || {})}</Text>
												</View>
											))}
										</View>
									</View>
								);
							})}
						</View>
					)}
				</View>

			</ScrollContainer>

			{/* Cancel Job Button — pinned below the scroll so it's always reachable */}
			{CANCELLABLE_STATUSES.includes(jobStatus) && (
				<View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
					<TouchableOpacity
						style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
						onPress={handleCancelJob}
						disabled={cancelling}
						activeOpacity={0.7}
					>
						{cancelling ? (
							<ActivityIndicator size="small" color="#FFFFFF" />
						) : (
							<>
								<Feather name="x-circle" size={18} color="#FFFFFF" />
								<Text style={styles.cancelButtonText}>Cancel Job</Text>
							</>
						)}
					</TouchableOpacity>
				</View>
			)}
		</SafeAreaView>
	);
};

// The time estimate with a glint sweeping across it, the same effect as the home
// screen's active-job card: the band crosses in the first 60% of each cycle,
// then rests off to the right until the next.
const EtaGlint = ({ eta }) => {
	const sweep = useRef(new Animated.Value(0)).current;
	const [width, setWidth] = useState(0);

	useEffect(() => {
		// Snap back to 0 explicitly; the loop's own reset doesn't fire everywhere.
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(sweep, { toValue: 1, duration: GLINT_DURATION, easing: Easing.out(Easing.quad), useNativeDriver: true }),
				Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
			])
		);
		loop.start();
		return () => loop.stop();
	}, [sweep]);

	const translateX = sweep.interpolate({
		inputRange: [0, 0.6, 1],
		outputRange: [-GLINT_WIDTH, width, width],
	});

	return (
		<View style={styles.etaGlintWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
			<Text style={styles.etaValue}>{eta}</Text>
			{/* A soft band of card-coloured light, built from slices of rising then
			    falling opacity since there's no gradient library in the app. */}
			<Animated.View style={[styles.glint, { transform: [{ translateX }, { skewX: "-20deg" }] }]}>
				{GLINT_SLICES.map((opacity, i) => (
					<View key={i} style={[styles.glintSlice, { opacity }]} />
				))}
			</Animated.View>
		</View>
	);
};

// The uploaded payment screenshot as a thumbnail row; tapping it opens the
// full image. GET /files/:fileId is sent the auth token like other file reads.
const PaymentProof = ({ fileId, fileName }) => {
	const [token, setToken] = useState(null);
	const [viewing, setViewing] = useState(false);

	useEffect(() => {
		SecureStore.getItemAsync("authToken").then(setToken).catch(() => {});
	}, []);

	const source = {
		uri: `${config.apiBaseUrl}/files/${fileId}`,
		...(token && { headers: { Authorization: `Bearer ${token}` } }),
	};

	return (
		<>
			<TouchableOpacity style={[styles.card, styles.proofRow]} onPress={() => setViewing(true)} activeOpacity={0.7}>
				<Image source={source} style={styles.proofThumb} contentFit="cover" transition={200} />
				<View style={styles.proofText}>
					<Text style={styles.proofTitle} numberOfLines={1}>
						{fileName || "Payment screenshot"}
					</Text>
					<Text style={styles.proofHint}>Tap to view</Text>
				</View>
				<Feather name="maximize-2" size={16} color={colors.textSecondary} />
			</TouchableOpacity>

			<Modal visible={viewing} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewing(false)}>
				<Pressable style={styles.proofBackdrop} onPress={() => setViewing(false)}>
					<Image source={source} style={styles.proofFull} contentFit="contain" />
					<View style={styles.proofClose}>
						<Feather name="x" size={22} color="#FFFFFF" />
					</View>
				</Pressable>
			</Modal>
		</>
	);
};

// The four-step bar under the estimate, each segment labelled. Steps up to the
// current one are filled, and the current one keeps pulsing until the job is
// completed. Cancelled and failed jobs get a single solid bar instead.
const JobProgress = ({ status, color }) => {
	const pulse = useRef(new Animated.Value(1)).current;
	const statusLower = status?.toLowerCase();
	const isFinal = FINAL_STATUSES.includes(statusLower);

	useEffect(() => {
		if (isFinal) {
			pulse.setValue(1);
			return;
		}
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulse, { toValue: 0.3, duration: SEGMENT_PULSE_DURATION / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
				Animated.timing(pulse, { toValue: 1, duration: SEGMENT_PULSE_DURATION / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
			])
		);
		loop.start();
		return () => loop.stop();
	}, [isFinal, pulse]);

	if (statusLower === "cancelled" || statusLower === "failed") {
		return (
			<View style={styles.progressBarContainer}>
				<View style={[styles.progressSegment, styles.progressSegmentFull, { backgroundColor: color }]} />
			</View>
		);
	}

	const stepIndex = PROGRESS_STEPS.indexOf(statusLower);
	const currentIndex = stepIndex !== -1 ? stepIndex : (PROGRESS_ALIASES[statusLower] ?? 0);

	return (
		<View style={styles.progressBarContainer}>
			{PROGRESS_STEPS.map((step, index) => {
				const isCurrent = index === currentIndex;
				const isFilled = index <= currentIndex;
				return (
					<View key={step} style={styles.progressStep}>
						<Animated.View
							style={[
								styles.progressSegment,
								{ backgroundColor: isFilled ? color : colors.borderLight },
								isCurrent && !isFinal && { opacity: pulse },
							]}
						/>
						<Text
							style={[
								styles.progressLabel,
								isFilled && styles.progressLabelDone,
								isCurrent && { color, fontWeight: "700" },
							]}
							numberOfLines={1}
						>
							{STATUS_CONFIG[step].label}
						</Text>
					</View>
				);
			})}
		</View>
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
		paddingVertical: 10,
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
	summaryCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 20,
		padding: 20,
		marginBottom: 20,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	summaryTop: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	etaBlock: {
		flexShrink: 1,
	},
	etaCaption: {
		fontSize: 12,
		fontWeight: "500",
		color: colors.textSecondary,
		marginBottom: 2,
	},
	etaValue: {
		fontSize: 26,
		fontWeight: "800",
		color: colors.textPrimary,
		fontVariant: ["tabular-nums"],
	},
	etaGlintWrap: {
		alignSelf: "flex-start",
		overflow: "hidden",
	},
	glint: {
		position: "absolute",
		top: 0,
		bottom: 0,
		left: 0,
		flexDirection: "row",
	},
	glintSlice: {
		width: GLINT_SLICE_WIDTH,
		backgroundColor: colors.cardBackground,
	},
	summaryFinal: {
		fontSize: 26,
		fontWeight: "800",
	},
	summaryBadges: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	// Same `.job-code` badge as the home screen's active-job card.
	jobCode: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 6,
		overflow: "hidden",
		backgroundColor: "rgba(0, 217, 163, 0.14)",
		color: colors.textPrimary,
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0.6,
		fontVariant: ["tabular-nums"],
	},
	statusBadge: {
		paddingHorizontal: 12,
		paddingVertical: 5,
		borderRadius: 20,
	},
	statusText: {
		fontSize: 12,
		fontWeight: "700",
	},
	progressBarContainer: {
		flexDirection: "row",
		gap: 6,
		marginTop: 18,
	},
	progressStep: {
		flex: 1,
		minWidth: 0,
	},
	progressSegment: {
		height: 6,
		borderRadius: 3,
	},
	progressSegmentFull: {
		flex: 1,
	},
	progressLabel: {
		marginTop: 6,
		fontSize: 11,
		fontWeight: "500",
		color: colors.textSecondary,
	},
	progressLabelDone: {
		color: colors.textPrimary,
	},
	summaryFooter: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: 16,
		paddingTop: 14,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
	},
	shopImage: {
		width: 22,
		height: 22,
		borderRadius: 6,
	},
	summaryShop: {
		flex: 1,
		fontSize: 14,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	summaryFiles: {
		fontWeight: "500",
		color: colors.textSecondary,
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
	historyList: {
		paddingVertical: 16,
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
	detailsDivider: {
		height: 1,
		backgroundColor: colors.borderLight,
		marginBottom: 20,
	},
	moreDetailsPane: {
		marginTop: 12,
	},
	// A soft white tile: enough to group each file, without a card's border and shadow.
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
	proofRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	proofThumb: {
		width: 56,
		height: 56,
		borderRadius: 10,
		backgroundColor: colors.borderLight,
	},
	proofText: {
		flex: 1,
	},
	proofTitle: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	proofHint: {
		fontSize: 12,
		color: colors.textSecondary,
		marginTop: 2,
	},
	proofBackdrop: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.9)",
		justifyContent: "center",
		alignItems: "center",
	},
	proofFull: {
		width: "100%",
		height: "80%",
	},
	proofClose: {
		position: "absolute",
		top: 48,
		right: 20,
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(255, 255, 255, 0.15)",
		justifyContent: "center",
		alignItems: "center",
	},
	commentsText: {
		fontSize: 14,
		lineHeight: 20,
		color: colors.textPrimary,
	},
	// The shared card look for Cost Breakdown and the blocks in More details.
	card: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	costRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
		paddingVertical: 5,
	},
	costLabel: {
		flex: 1,
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	costSubLabel: {
		fontSize: 12,
		fontWeight: "500",
		color: colors.textSecondary,
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
		marginTop: 6,
		paddingTop: 10,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
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
	// Indented to line up with the file name, past the index circle.
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
	timelineItem: {
		flexDirection: "row",
	},
	timelineLeft: {
		alignItems: "center",
		width: 32,
		marginRight: 12,
	},
	timelineIcon: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	timelineLine: {
		width: 2,
		flex: 1,
		backgroundColor: "#E4E9F2",
		marginVertical: 4,
		borderRadius: 1,
	},
	timelineContent: {
		flex: 1,
		paddingTop: 4,
		paddingBottom: 4,
		alignItems: "flex-start",
	},
	timelineContentSpacing: {
		paddingBottom: 20,
	},
	timelinePill: {
		paddingHorizontal: 10,
		paddingVertical: 3,
		borderRadius: 999,
		marginBottom: 6,
	},
	timelineStatus: {
		fontSize: 13,
		fontWeight: "700",
	},
	timelineMeta: {
		fontSize: 12,
		color: colors.textSecondary,
	},
	footer: {
		paddingHorizontal: 20,
		paddingTop: 12,
		backgroundColor: colors.cardBackground,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
	},
	cancelButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: colors.dangerDark,
		paddingVertical: 16,
		borderRadius: 16,
	},
	cancelButtonDisabled: {
		opacity: 0.6,
	},
	cancelButtonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "700",
	},
});

export default TransactionDetails;
