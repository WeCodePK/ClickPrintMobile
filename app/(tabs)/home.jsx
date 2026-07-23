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
	const [accountBalance, setAccountBalance] = useState(0);
	const { signOut } = useAuth();

	const fetchBalance = useCallback(async () => {
		try {
			const token = await SecureStore.getItemAsync("authToken");
			const userId = await SecureStore.getItemAsync("userId");
			if (!userId) return;
			const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (response.status === 401) {
				await SecureStore.deleteItemAsync("authToken");
				await SecureStore.deleteItemAsync("userId");
				await SecureStore.deleteItemAsync("name");
				router.replace("/");
				return;
			}
			const body = await response.json();
			if (body.success) {
				setAccountBalance(body.data.user.balance);
			}
		} catch (error) {
			console.error("Error fetching account balance:", error);
		}
	}, [router]);

	useEffect(() => {
		fetchBalance();
	}, [fetchBalance]);

	useFocusEffect(
		useCallback(() => {
			reload();
			reloadJobs();
			fetchBalance();
		}, [reload, reloadJobs, fetchBalance])
	);

	useEffect(() => {
		if (error && error.includes("401")) {
			signOut().then(() => router.replace("/"));
		}
	}, [error, router, signOut]);

	const refreshAll = () => {
		refresh();
		refreshJobs();
		fetchBalance();
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
					<View style={styles.cardsRow}>
						{/* Current Balance Card */}

						<View style={styles.balanceCard}>
							<View style={styles.balanceContent}>
								<Text style={styles.balanceLabel}>Current Balance</Text>
								<Text style={styles.balanceCurrency}>Rs.</Text>
								<Text style={styles.balanceAmount}>{accountBalance}</Text>
							</View>
						</View>

						{/* Action Cards Column */}

						<View style={styles.actionCardsColumn}>
							{/* Credit Wallet Card */}

							<TouchableOpacity
								style={[styles.actionCard, styles.creditWalletCard]}
								onPress={() => {
									router.push("/topup");
								}}
							>
								<View style={styles.actionCardIcon}>
									<Feather name="arrow-down" size={26} color={colors.cardBackground} />
								</View>
								<Text style={styles.actionCardText}>Top Up Wallet</Text>
							</TouchableOpacity>

							{/* New Print Card */}

							<TouchableOpacity
								style={[styles.actionCard, styles.printRequestCard]}
								onPress={() => {
									router.push("/upload-document");
								}}
							>
								<View style={styles.actionCardIconRight}>
									<Feather name="arrow-up-right" size={26} color={colors.cardBackground} />
								</View>
								<Text style={styles.actionCardText}>New Print Job</Text>
							</TouchableOpacity>
						</View>
					</View>
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
		padding: 20,
		maxWidth: 600,
		alignSelf: "center",
		width: "100%",
	},
	cardsRow: {
		flexDirection: "row",
		gap: 16,
		height: Math.min(SCREEN_HEIGHT * 0.35, 300),
		minHeight: 240,
	},
	balanceCard: {
		flex: 1,
		backgroundColor: colors.primary,
		borderRadius: 24,
		padding: 22,
		shadowColor: colors.shadowPrimary,
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.3,
		shadowRadius: 32,
		elevation: 8,
	},
	balanceContent: {
		flex: 1,
		justifyContent: "flex-start",
	},
	balanceLabel: {
		fontSize: 18,
		fontWeight: "600",
		color: colors.cardBackground,
		marginBottom: 8,
		letterSpacing: 0.3,
	},
	balanceCurrency: {
		fontSize: 35,
		fontWeight: "600",
		color: colors.cardBackground,
		letterSpacing: 0.3,
		marginTop: 12,
	},
	balanceAmount: {
		fontSize: Math.min(SCREEN_WIDTH * 0.16, 45),
		fontWeight: "700",
		color: colors.cardBackground,
		letterSpacing: -2,
	},
	viewTransactions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	viewTransactionsText: {
		fontSize: 18,
		fontWeight: "600",
		color: colors.cardBackground,
		lineHeight: 22,
	},
	actionCardsColumn: {
		flex: 1,
		gap: 16,
	},
	actionCard: {
		flex: 1,
		borderRadius: 24,
		padding: 20,
		justifyContent: "space-between",
	},
	creditWalletCard: {
		backgroundColor: colors.creditWallet,
		shadowColor: colors.shadowCreditWallet,
	},
	printRequestCard: {
		backgroundColor: colors.printRequest,
		shadowColor: colors.shadowPrintRequest,
	},
	actionCardIcon: {
		width: 35,
		height: 35,
		justifyContent: "center",
		alignItems: "center",
	},
	actionCardIconRight: {
		width: 35,
		height: 35,
		justifyContent: "center",
		alignItems: "center",
		alignSelf: "flex-end",
	},
	actionCardText: {
		fontSize: 18,
		fontWeight: "600",
		color: colors.cardBackground,
		lineHeight: 22,
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
