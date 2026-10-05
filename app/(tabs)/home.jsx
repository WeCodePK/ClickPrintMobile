//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PullToRefreshScrollView from "../../components/PullToRefreshScrollView";
import { colors } from "../../constants/colors";
import { useActiveJobs } from "../../hooks/useActiveJobs";
import { useDrafts } from "../../hooks/useDrafts";
import StaleDataNotice from "../../components/StaleDataNotice";
import { cancelJob, createDraft, deleteDraft } from "../../services/drafts";
import { showAlert } from "../../utils/alert";
import { friendlyMessage } from "../../utils/errors";
import { useUploads } from "../../utils/uploadManager";
import SecureStore from "../../utils/storage";
import ActiveJobCard from "../components/ActiveJobCard";
import DraftItem from "../components/DraftItem";

//----------------------------------- CONSTANTS -----------------------------------//

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

//----------------------------------- HOOKS -----------------------------------//

// Unfinished print-job uploads grouped by job: "new" (no draft yet) or
// "draft:<id>". Payment proofs are left out; they belong to the top-up screen.
const useUploadGroups = () => {
	const uploads = useUploads();
	return useMemo(() => {
		const groups = new Map();
		for (const item of uploads) {
			if (item.scope !== "new" && !item.scope.startsWith("draft:")) continue;
			if (!groups.has(item.scope)) {
				groups.set(item.scope, {
					scope: item.scope,
					draftId: item.scope.startsWith("draft:") ? item.scope.slice(6) : null,
					total: 0,
					done: 0,
					waiting: false,
					failed: false,
				});
			}
			const group = groups.get(item.scope);
			group.total++;
			if (item.status === "success") group.done++;
			if (item.status === "waiting") group.waiting = true;
			if (item.status === "failed") group.failed = true;
		}
		return [...groups.values()];
	}, [uploads]);
};

//----------------------------------- COMPONENTS -----------------------------------//

const HomePage = () => {
	const router = useRouter();
	const { drafts, loading, error, refresh, refreshing, reload, updatedAt } = useDrafts();
	const { activeJobs, loading: loadingJobs, error: jobsError, refreshing: refreshingJobs, refresh: refreshJobs, reload: reloadJobs, updatedAt: jobsUpdatedAt } = useActiveJobs();
	const [userName, setUserName] = useState("");
	const uploadGroups = useUploadGroups();

	const loadUserData = useCallback(async () => {
		try {
			const name = (await SecureStore.getItemAsync("name")) || "User";
			setUserName(name);
		} catch (error) {
			console.error("Error loading user data:", error);
		}
	}, []);

	useEffect(() => {
		loadUserData();
	}, [loadUserData]);

	useFocusEffect(
		useCallback(() => {
			reload();
			reloadJobs();
			loadUserData();
		}, [reload, reloadJobs, loadUserData])
	);

	// A failed refresh keeps whatever was already loaded on screen and shows a
	// notice with a retry instead of replacing the whole page. (A 401 signs out
	// centrally, see utils/api.js.)
	const loadFailed = !!error || !!jobsError;
	const oldestUpdate = Math.min(updatedAt || Infinity, jobsUpdatedAt || Infinity);

	const refreshAll = () => {
		refresh();
		refreshJobs();
		loadUserData();
	};

	// Handle pending shop from external QR scan or browser onboarding
	useEffect(() => {
		(async () => {
			try {
				const pendingShopId = await SecureStore.getItemAsync("pendingShopId");
				if (pendingShopId) {
					const draft = await createDraft({ shop: pendingShopId });
					// Only forget the shop once its draft exists, so a failed
					// attempt (e.g. offline) is retried on the next visit.
					await SecureStore.deleteItemAsync("pendingShopId");
					router.push(`/upload-document?draftId=${draft._id}&shopId=${pendingShopId}`);
				}
			} catch (err) {
				console.error("Error processing pending shop:", err);
			}
		})();
	}, [router]);

	const handleCancelJob = useCallback((job) => {
		showAlert(
			job.code ? `Cancel Job #${job.code}?` : "Cancel Job?",
			"Are you sure you want to cancel this job?",
			[
				{ text: "No", style: "cancel" },
				{
					text: "Cancel",
					style: "destructive",
					onPress: async () => {
						try {
							await cancelJob(job.id);
						} catch (err) {
							console.error("Error cancelling job:", err);
							showAlert("Couldn't cancel the job", friendlyMessage(err, "Failed to cancel the job."));
						}
					},
				},
			]
		);
	}, []);

	const handleDeleteDraft = useCallback((draftId) => {
		showAlert(
			"Delete Draft",
			"Are you sure you want to delete this draft?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							await deleteDraft(draftId);
						} catch (err) {
							console.error("Error deleting draft:", err);
							showAlert("Couldn't delete the draft", friendlyMessage(err, "Failed to delete draft. Please try again."));
						}
					},
				},
			]
		);
	}, []);

	const handleDraftPress = (draft) => {
		// A draft with no files yet (e.g. started from a shop, then left before
		// uploading) resumes on the upload page, keeping its shop.
		if (!draft.files || draft.files.length === 0) {
			const shopId = draft.shop?._id || (typeof draft.shop === "string" ? draft.shop : null);
			router.push({
				pathname: "/upload-document",
				params: { draftId: draft._id, ...(shopId && { shopId }) },
			});
			return;
		}

		const documents = draft.files.map(f => ({
			fileId: f.file?._id || f.file,
			name: f.file?.name || `File`
		}));

		const hasMissingSettings = draft.files.some(f => !f.settings || Object.keys(f.settings).length === 0);

		if (hasMissingSettings) {
			router.push({
				pathname: "/print-settings",
				params: {
					draftId: draft._id,
					documents: JSON.stringify(documents)
				}
			});
		} else if (!draft.shop) {
			const allSettings = draft.files.map(f => f.settings || {});
			router.push({
				pathname: "/shop-details",
				params: {
					draftId: draft._id,
					documents: JSON.stringify(documents),
					allSettings: JSON.stringify(allSettings)
				}
			});
		} else {
			router.push({
				pathname: "/draft-details",
				params: { draftId: draft._id }
			});
		}
	};

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<PullToRefreshScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshing={refreshing || refreshingJobs}
				onRefresh={refreshAll}
			>
				<View style={styles.topCardsContainer}>
					{/* Welcome Message + Scan Button */}
					<View style={styles.welcomeRow}>
						<View style={styles.welcomeContainer}>
							<Text style={styles.welcomeGreeting}>Welcome back,</Text>
							<Text style={styles.welcomeName}>{userName || "User"}</Text>
						</View>
						<TouchableOpacity
							style={styles.scanHeaderBtn}
							activeOpacity={0.8}
							onPress={() => router.push("/qr-scanner")}
						>
							<Feather name="maximize" size={17} color={colors.primary} />
							<Text style={styles.scanHeaderBtnText}>Scan QR</Text>
						</TouchableOpacity>
					</View>

					{/* New Print Job Card */}
					<TouchableOpacity
						style={styles.newPrintJobCard}
						activeOpacity={0.85}
						onPress={() => {
							router.push("/upload-document");
						}}
					>
						<View style={styles.newPrintJobContent}>
							<View style={styles.newPrintJobHeader}>
								<View style={styles.newPrintJobBadge}>
									<Feather name="printer" size={24} color={colors.cardBackground} />
								</View>
								<View style={styles.newPrintJobArrow}>
									<Feather name="arrow-up-right" size={24} color={colors.cardBackground} />
								</View>
							</View>
							<View style={styles.newPrintJobTextGroup}>
								<Text style={styles.newPrintJobTitle}>New Print Job</Text>
								<Text style={styles.newPrintJobSubtitle}>
									Upload documents & start printing instantly
								</Text>
							</View>
						</View>
					</TouchableOpacity>


				</View>

				<View style={styles.listsWrapper}>
					{/* Print jobs with files still uploading (or uploaded but not yet
					    continued), so the user can get back to them. */}
					{uploadGroups.map((group) => (
						<TouchableOpacity
							key={group.scope}
							style={styles.uploadsCard}
							activeOpacity={0.8}
							onPress={() =>
								router.push(group.draftId ? `/upload-document?draftId=${group.draftId}` : "/upload-document")
							}
						>
							<Feather
								name={group.waiting ? "wifi-off" : group.done === group.total ? "check-circle" : "upload-cloud"}
								size={20}
								color={colors.primary}
							/>
							<View style={styles.uploadsCardTexts}>
								<Text style={styles.uploadsCardTitle}>
									{group.done === group.total
										? `${group.total} file${group.total === 1 ? "" : "s"} ready to print`
										: `Uploading ${group.done} of ${group.total} file${group.total === 1 ? "" : "s"}`}
								</Text>
								<Text style={styles.uploadsCardSubtitle}>
									{group.failed
										? "Some files need your attention"
										: group.waiting
											? "Waiting for connection, resumes automatically"
											: group.done === group.total
												? "Tap to continue your print job"
												: "Tap to view progress"}
								</Text>
							</View>
							<Feather name="chevron-right" size={20} color={colors.textSecondary} />
						</TouchableOpacity>
					))}

					<StaleDataNotice
						error={loadFailed ? error || jobsError : null}
						updatedAt={Number.isFinite(oldestUpdate) ? oldestUpdate : null}
						hasData={drafts.length > 0 || activeJobs.length > 0}
						onRetry={refreshAll}
						retrying={refreshing || refreshingJobs}
					/>

					{/* Active Jobs */}
					{!loadingJobs && activeJobs.length > 0 && (
						<View style={styles.listCard}>
							<View style={styles.sectionHeader}>
								<Text style={styles.sectionTitle}>Active Jobs</Text>
							</View>
							<View style={styles.innerListContainer}>
								{activeJobs.map((job, index) => (
									<ActiveJobCard
										key={job.id}
										job={job}
										isLast={index === activeJobs.length - 1}
										onCancel={handleCancelJob}
										onPress={() => router.push({ pathname: "/job-details", params: { id: job.id } })}
									/>
								))}
							</View>
						</View>
					)}

					{/* User Drafts — shown when there are drafts, or as the empty state when
					    there are no active jobs either, so the page is never blank. */}
					{!loading && (drafts.length > 0 || (!loadingJobs && activeJobs.length === 0 && !loadFailed)) && (
						<View style={styles.listCard}>
							<View style={styles.sectionHeader}>
								<Text style={styles.sectionTitle}>My Drafts</Text>
							</View>
							{drafts.length > 0 ? (
								<View style={styles.innerListContainer}>
									{drafts.map((draft, index) => (
										<DraftItem
											key={draft._id}
											draft={draft}
											isLast={index === drafts.length - 1}
											onPress={() => handleDraftPress(draft)}
											onDelete={handleDeleteDraft}
										/>
									))}
								</View>
							) : (
								<View style={styles.emptyState}>
									<Feather name="inbox" size={48} color={colors.textSecondary} />
									<Text style={styles.emptyText}>No drafts yet</Text>
								</View>
							)}
						</View>
					)}
				</View>
			</PullToRefreshScrollView>
		</SafeAreaView>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	uploadsCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		backgroundColor: colors.cardBackground,
		borderRadius: 12,
		padding: 14,
		marginBottom: 16,
	},
	uploadsCardTexts: {
		flex: 1,
	},
	uploadsCardTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	uploadsCardSubtitle: {
		fontSize: 12,
		color: colors.textSecondary,
		marginTop: 2,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 20,
		flexGrow: 1,
	},
	topCardsContainer: {
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 20,
		maxWidth: 600,
		alignSelf: "center",
		width: "100%",
		gap: 16,
	},
	welcomeRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 4,
	},
	welcomeContainer: {
		flex: 1,
	},
	scanHeaderBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "rgba(0, 217, 163, 0.12)",
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: "rgba(0, 217, 163, 0.3)",
	},
	scanHeaderBtnText: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.primary,
	},

	welcomeGreeting: {
		fontSize: 15,
		fontWeight: "500",
		color: colors.textSecondary,
		letterSpacing: 0.2,
		marginBottom: 2,
	},
	welcomeName: {
		fontSize: 26,
		fontWeight: "800",
		color: colors.textPrimary,
		letterSpacing: -0.5,
	},
	newPrintJobCard: {
		backgroundColor: colors.primary,
		borderRadius: 24,
		padding: 24,
		minHeight: 160,
		justifyContent: "center",
		shadowColor: colors.shadowPrintRequest,
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.35,
		shadowRadius: 20,
		elevation: 8,
	},
	newPrintJobContent: {
		justifyContent: "space-between",
		gap: 20,
	},
	newPrintJobHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	newPrintJobBadge: {
		width: 48,
		height: 48,
		borderRadius: 16,
		backgroundColor: "rgba(255, 255, 255, 0.22)",
		justifyContent: "center",
		alignItems: "center",
	},
	newPrintJobArrow: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "rgba(255, 255, 255, 0.22)",
		justifyContent: "center",
		alignItems: "center",
	},
	newPrintJobTextGroup: {
		gap: 6,
	},
	newPrintJobTitle: {
		fontSize: 24,
		fontWeight: "700",
		color: colors.cardBackground,
		letterSpacing: 0.2,
	},
	newPrintJobSubtitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "rgba(255, 255, 255, 0.85)",
		lineHeight: 18,
	},
	listsWrapper: {
		flex: 1,
		paddingHorizontal: 20,
		paddingBottom: 20,
		gap: 16,
	},
	listCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 24,
		padding: 20,
	},
	loadingContainer: {
		paddingVertical: 40,
		justifyContent: "center",
		alignItems: "center",
	},
	emptyState: {
		paddingVertical: 40,
		justifyContent: "center",
		alignItems: "center",
		gap: 12,
	},
	emptyText: {
		fontSize: 14,
		color: colors.textSecondary,
	},

	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
		gap: 8,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	innerListContainer: {
		borderRadius: 12,
		overflow: "hidden",
	},
});
export default HomePage;
