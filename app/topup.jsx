//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";
import { showAlert } from "../utils/alert";
import SecureStore from "../utils/storage";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

const STATUS_CONFIG = {
	pending: { label: "Pending", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)" },
	approved: { label: "Approved", color: colors.primary, bg: "rgba(0, 217, 163, 0.12)" },
	declined: { label: "Declined", color: colors.printRequest, bg: "rgba(255, 139, 123, 0.12)" },
};

//----------------------------------- HELPERS -----------------------------------//

const formatDate = (value) => {
	if (!value) return "";
	const d = new Date(value);
	if (isNaN(d.getTime())) return "";
	return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

//----------------------------------- COMPONENTS -----------------------------------//

const TopUpWallet = () => {
	const router = useRouter();

	const [topups, setTopups] = useState([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(null);

	const fetchTopups = useCallback(async () => {
		try {
			setError(null);
			const token = await SecureStore.getItemAsync("authToken");
			const response = await fetch(`${API_BASE_URL}/topups`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			const list = data.data?.topups || data.data || data.topups || [];
			setTopups(Array.isArray(list) ? list : []);
		} catch (err) {
			console.error("Error fetching top ups:", err);
			setError(err.message || "Failed to load top up requests.");
		} finally {
			setLoading(false);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			fetchTopups();
		}, [fetchTopups])
	);

	const handleRefresh = async () => {
		setRefreshing(true);
		await fetchTopups();
		setRefreshing(false);
	};

	const handleRaast = () => {
		showAlert("Raast functionality to be added soon!");
	};

	const handleEasyPaisa = () => {
		router.push("/topup-amount");
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.replace("/(tabs)/home")} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Top Up Wallet</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
			>
				{/* Top up method options */}
				<Text style={styles.sectionTitle}>Choose a top up method</Text>

				<TouchableOpacity style={styles.optionCard} onPress={handleRaast} activeOpacity={0.8}>
					<View style={[styles.optionIcon, { backgroundColor: "rgba(59, 158, 255, 0.12)" }]}>
						<Feather name="zap" size={24} color={colors.creditWallet} />
					</View>
					<View style={styles.optionInfo}>
						<Text style={styles.optionTitle}>Top Up through Raast</Text>
						<Text style={styles.optionSubtitle}>Instant bank transfer via Raast</Text>
					</View>
					<Feather name="chevron-right" size={22} color={colors.textSecondary} />
				</TouchableOpacity>

				<TouchableOpacity style={styles.optionCard} onPress={handleEasyPaisa} activeOpacity={0.8}>
					<View style={[styles.optionIcon, { backgroundColor: "rgba(0, 217, 163, 0.12)" }]}>
						<Feather name="credit-card" size={24} color={colors.primary} />
					</View>
					<View style={styles.optionInfo}>
						<Text style={styles.optionTitle}>Top Up through EasyPaisa</Text>
						<Text style={styles.optionSubtitle}>Transfer to ClickPrint and upload your payment proof</Text>
					</View>
					<Feather name="chevron-right" size={22} color={colors.textSecondary} />
				</TouchableOpacity>

				{/* Top up history */}
				<Text style={[styles.sectionTitle, styles.historyTitle]}>Your Top Up Requests</Text>

				{loading ? (
					<View style={styles.loadingContainer}>
						<ActivityIndicator size="large" color={colors.primary} />
						<Text style={styles.loadingText}>Loading top up requests...</Text>
					</View>
				) : error ? (
					<View style={styles.emptyContainer}>
						<Feather name="alert-circle" size={40} color={colors.printRequest} />
						<Text style={styles.emptyText}>{error}</Text>
						<TouchableOpacity style={styles.retryButton} onPress={fetchTopups}>
							<Text style={styles.retryButtonText}>Retry</Text>
						</TouchableOpacity>
					</View>
				) : topups.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Feather name="inbox" size={40} color={colors.textSecondary} />
						<Text style={styles.emptyText}>No top up requests yet</Text>
					</View>
				) : (
					<View style={styles.listCard}>
						{topups.map((item, index) => (
							<TopupItem
								key={item._id || index}
								item={item}
								isLast={index === topups.length - 1}
								onPress={() =>
									router.push({
										pathname: "/topup-details",
										params: { topupId: item._id, topup: JSON.stringify(item) },
									})
								}
							/>
						))}
					</View>
				)}
			</ScrollView>
		</SafeAreaView>
	);
};

const TopupItem = ({ item, isLast, onPress }) => {
	const statusKey = (item.status || "pending").toLowerCase();
	const statusConfig = STATUS_CONFIG[statusKey] || { label: item.status || "Pending", color: colors.textSecondary, bg: colors.background };
	const shopName = item.shop?.name;
	const date = formatDate(item.createdAt || item.date);

	return (
		<TouchableOpacity style={[styles.topupRow, !isLast && styles.topupRowBorder]} onPress={onPress} activeOpacity={0.6}>
			<View style={styles.topupIcon}>
				<Feather name="arrow-down" size={18} color={colors.primary} />
			</View>
			<View style={styles.topupInfo}>
				<Text style={styles.topupAmount}>Rs. {item.amount}</Text>
				<View style={styles.topupMetaRow}>
					{shopName ? (
						<>
							<Text style={styles.topupMeta}>{shopName}</Text>
							{date ? <Text style={styles.topupDot}> • </Text> : null}
						</>
					) : null}
					{date ? <Text style={styles.topupMeta}>{date}</Text> : null}
				</View>
			</View>
			<View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
				<Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
			</View>
			<Feather name="chevron-right" size={20} color={colors.textSecondary} style={styles.topupChevron} />
		</TouchableOpacity>
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
		paddingBottom: 40,
	},
	sectionTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 14,
	},
	historyTitle: {
		marginTop: 28,
	},
	optionCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		marginBottom: 14,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
		gap: 14,
	},
	optionIcon: {
		width: 48,
		height: 48,
		borderRadius: 14,
		justifyContent: "center",
		alignItems: "center",
	},
	optionInfo: {
		flex: 1,
	},
	optionTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 4,
	},
	optionSubtitle: {
		fontSize: 13,
		color: colors.textSecondary,
		lineHeight: 18,
	},
	loadingContainer: {
		paddingVertical: 40,
		justifyContent: "center",
		alignItems: "center",
		gap: 12,
	},
	loadingText: {
		fontSize: 14,
		color: colors.textSecondary,
	},
	emptyContainer: {
		paddingVertical: 40,
		justifyContent: "center",
		alignItems: "center",
		gap: 12,
	},
	emptyText: {
		fontSize: 15,
		color: colors.textSecondary,
		textAlign: "center",
	},
	retryButton: {
		backgroundColor: colors.primary,
		paddingHorizontal: 24,
		paddingVertical: 10,
		borderRadius: 12,
		marginTop: 4,
	},
	retryButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.cardBackground,
	},
	listCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		paddingHorizontal: 4,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	topupRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 14,
		paddingHorizontal: 12,
		gap: 12,
	},
	topupRowBorder: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	topupIcon: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: "rgba(0, 217, 163, 0.10)",
		justifyContent: "center",
		alignItems: "center",
	},
	topupInfo: {
		flex: 1,
	},
	topupAmount: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 4,
	},
	topupMetaRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	topupMeta: {
		fontSize: 13,
		color: colors.textSecondary,
	},
	topupDot: {
		fontSize: 13,
		color: colors.textSecondary,
		opacity: 0.5,
	},
	statusBadge: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 20,
	},
	statusText: {
		fontSize: 12,
		fontWeight: "600",
	},
	topupChevron: {
		marginLeft: 4,
	},
});

export default TopUpWallet;
