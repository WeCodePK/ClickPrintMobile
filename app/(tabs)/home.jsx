//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../../config/config";
import { colors } from "../../constants/colors";
import { useDrafts } from "../../hooks/useDrafts";
import DraftItem from "../components/DraftItem";

//----------------------------------- CONSTANTS -----------------------------------//

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

const HomePage = () => {
	const router = useRouter();
	const { drafts, loading, error, refresh, refreshing } = useDrafts();
	const [accountBalance, setAccountBalance] = useState(0);

	useEffect(() => {
		fetchBalance();
	}, []);

	useEffect(() => {
		if (error && error.includes("401")) {
			SecureStore.deleteItemAsync("authToken").then(() => router.replace("/"));
		}
	}, [error]);

	const fetchBalance = async () => {
		try {
			 const token = await SecureStore.getItemAsync("authToken");
			//const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI2YTQyNGUyODBhYWU1NTNlYTJmN2U5NmEiLCJzaWQiOiI2YTNjZGVkODcwNTY2OWE4ZjU5ODExMjUiLCJpYXQiOjE3ODI3NTc5MzksImV4cCI6MTc4NTM0OTkzOX0.cZtJT0CBeiieQphpcc5yZydkPIPIGqVKo_zoIjGPFXE";
			const response = await fetch(`${API_BASE_URL}/profile`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			const body = await response.json();
			console.log(body);
			if (body.success) {
				console.log("Balance:", body.data.profile.balance);
				setAccountBalance(body.data.profile.balance);
			}
		} catch (error) {
			console.error("Error fetching account balance:", error);
		}
	};

	const refreshAll = () => {
		refresh();
		fetchBalance();
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

						<TouchableOpacity style={styles.balanceCard}>
							<View style={styles.balanceContent}>
								<Text style={styles.balanceLabel}>Current Balance</Text>
								<Text style={styles.balanceAmount}>{accountBalance}</Text>
							</View>
						</TouchableOpacity>

						{/* Action Cards Column */}

						<View style={styles.actionCardsColumn}>
							{/* Credit Wallet Card */}

							<TouchableOpacity
								style={[styles.actionCard, styles.creditWalletCard]}
								onPress={() => {
									Alert.alert("Payment functionality to be added soon!");
								}}
							>
								<View style={styles.actionCardIcon}>
									<Feather name="arrow-down" size={18} color={colors.cardBackground} />
								</View>
								<Text style={styles.actionCardText}>Load Money</Text>
							</TouchableOpacity>

							{/* New Print Card */}

							<TouchableOpacity
								style={[styles.actionCard, styles.printRequestCard]}
								onPress={() => {
									router.push("/new-print");
								}}
							>
								<Text style={styles.actionCardText}>New Print</Text>
								<View style={styles.actionCardIconRight}>
									<Feather name="arrow-up-right" size={18} color={colors.cardBackground} />
								</View>
							</TouchableOpacity>
						</View>
					</View>
				</View>

				{/* User Drafts */}

				<View style={styles.transactionsContainer}>
					<View style={styles.historyHeader}>
						<Text style={styles.historyTitle}>My Drafts</Text>
					</View>
					{loading ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color={colors.primary} />
						</View>
					) : drafts.length === 0 ? (
						<View style={styles.emptyState}>
							<Text style={styles.emptyText}>No drafts yet</Text>
						</View>
					) : (
						drafts.map((draft) => (
							<DraftItem
								key={draft._id}
								draft={draft}
								onPress={() => router.push({ pathname: "/draft-details", params: { draft: JSON.stringify(draft) } })}
							/>
						))
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
		fontWeight: "500",
		color: colors.cardBackground,
		opacity: 0.9,
		marginBottom: 8,
		letterSpacing: 0.3,
	},
	balanceAmount: {
		fontSize: Math.min(SCREEN_WIDTH * 0.16, 52),
		fontWeight: "700",
		color: colors.cardBackground,
		letterSpacing: -2,
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
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.3,
		shadowRadius: 24,
		elevation: 6,
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
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: colors.cardOverlay,
		justifyContent: "center",
		alignItems: "center",
	},
	actionCardIconRight: {
		width: 44,
		height: 44,
		borderRadius: 12,
		backgroundColor: colors.cardOverlay,
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
	transactionsContainer: {
		backgroundColor: colors.cardBackground,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingHorizontal: 20,
		paddingTop: 24,
		paddingBottom: 20,
		marginTop: 12,
		flex: 1,
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
	},
	emptyText: {
		fontSize: 14,
		color: colors.textSecondary,
	},
});
export default HomePage;
