//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Dimensions, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../../config/config";
import { colors } from "../../constants/colors";
import { useAuth } from "../../context/auth";
import { useActiveJobs } from "../../hooks/useActiveJobs";
import { useDrafts } from "../../hooks/useDrafts";
import { showAlert } from "../../utils/alert";
import SecureStore from "../../utils/storage";
import ActiveJobCard from "../components/ActiveJobCard";
import DraftItem from "../components/DraftItem";

//----------------------------------- CONSTANTS -----------------------------------//

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

const HomePage = () => {
	const router = useRouter();
	const { drafts, loading, error, refresh, refreshing, reload } = useDrafts();
	const { activeJobs, loading: loadingJobs, refresh: refreshJobs, reload: reloadJobs } = useActiveJobs();
	const [userName, setUserName] = useState("");
	const { signOut } = useAuth();

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

	useEffect(() => {
		if (error && error.includes("401")) {
			signOut().then(() => router.replace("/"));
		}
	}, [error, router, signOut]);

	const refreshAll = () => {
		refresh();
		refreshJobs();
		loadUserData();
	};

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
							const token = await SecureStore.getItemAsync("authToken");
							const response = await fetch(`${API_BASE_URL}/drafts/${draftId}`, {
								method: "DELETE",
								headers: {
									Authorization: `Bearer ${token}`,
								},
							});
							if (response.ok) {
								reload();
							} else {
								showAlert("Failed to delete draft. Please try again.");
							}
						} catch (err) {
							console.error("Error deleting draft:", err);
							showAlert("Failed to delete draft. Please try again.");
						}
					},
				},
			]
		);
	}, [reload]);

	const handleDraftPress = (draft) => {
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
				params: { draft: JSON.stringify(draft) }
			});
		}
	};

	if (error) {
		return (
			<View style={styles.centerContainer}>
				<Text style={styles.errorText}>Error loading drafts</Text>
				<TouchableOpacity onPress={refresh} style={styles.retryButton}>
					<Text style={styles.retryText}>Retry</Text>
				</TouchableOpacity>
			</View>
		);
	}
	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
			>
				<View style={styles.topCardsContainer}>
					{/* Welcome Message */}
					<View style={styles.welcomeContainer}>
						<Text style={styles.welcomeGreeting}>Welcome back,</Text>
						<Text style={styles.welcomeName}>{userName || "User"}</Text>
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
					{/* User Drafts */}
					{!loading && (drafts.length > 0 || (!loadingJobs && activeJobs.length === 0)) && (
						<View style={styles.listCard}>
							<View style={styles.historyHeader}>
								<Text style={styles.historyTitle}>My Drafts</Text>
							</View>
							{drafts.length > 0 ? (
								<View>
									{drafts.map((draft) => (
										<DraftItem
											key={draft._id}
											draft={draft}
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

					{/* Active Jobs */}
					{!loadingJobs && activeJobs.length > 0 && (
						<View style={styles.listCard}>
							<View style={styles.activeJobsHeader}>
								<Text style={styles.activeJobsTitle}>Active Jobs</Text>
							</View>
							<View style={styles.innerListContainer}>
								{activeJobs.map((job) => (
									<ActiveJobCard
										key={job.id}
										job={job}
										onPress={() => router.push({ pathname: "/job-details", params: { transaction: JSON.stringify(job) } })}
									/>
								))}
							</View>
						</View>
					)}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	centerContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.background,
	},
	errorText: {
		fontSize: 16,
		color: colors.textPrimary,
		marginBottom: 16,
	},
	retryButton: {
		backgroundColor: colors.primary,
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 8,
	},
	retryText: {
		color: colors.cardBackground,
		fontWeight: "600",
		fontSize: 14,
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
	welcomeContainer: {
		paddingHorizontal: 4,
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
	historyHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 20,
	},
	historyTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: colors.textPrimary,
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

	activeJobsHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
		gap: 8,
	},
	activeJobsTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.textPrimary,
	},
});
export default HomePage;
