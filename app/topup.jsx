//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import PullToRefreshScrollView from "../components/PullToRefreshScrollView";
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

const formatDateTime = (value) => {
	if (!value) return "";
	const d = new Date(value);
	if (isNaN(d.getTime())) return "";
	return d.toLocaleString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
};

// paymentProofFile is populated as { _id, name } by the API, but may be a bare id.
const getProofFileId = (topup) => {
	const proof = topup.paymentProofFile;
	return proof?._id || (typeof proof === "string" ? proof : null);
};

const getFileUrl = (fileId) => `${API_BASE_URL}/files/${fileId}`;

const formatDayLabel = (d) => {
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);
	if (d.toDateString() === today.toDateString()) return "Today";
	if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
	return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

// Groups top ups into one section per calendar day, keeping the API's newest-first order.
const groupTopupsByDate = (topups) => {
	const groups = new Map();
	for (const topup of topups) {
		const value = topup.createdAt || topup.date;
		const d = value ? new Date(value) : null;
		const valid = d && !isNaN(d.getTime());
		const key = valid ? d.toDateString() : "unknown";
		if (!groups.has(key)) {
			groups.set(key, { key, label: valid ? formatDayLabel(d) : "Unknown date", items: [] });
		}
		groups.get(key).items.push(topup);
	}
	return [...groups.values()];
};

//----------------------------------- COMPONENTS -----------------------------------//

const TopUpWallet = () => {
	const router = useRouter();

	const [topups, setTopups] = useState([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState(null);
	const [viewingProofId, setViewingProofId] = useState(null);

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

	const handleTopUp = () => {
		router.push("/topup-amount");
	};

	const handleTransferToFriends = () => {
		showAlert("Transfer to Friends functionality to be added soon!");
	};

	const topupGroups = groupTopupsByDate(topups);

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.replace("/(tabs)/home")} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Topup Wallet</Text>
				<View style={styles.placeholder} />
			</View>

			<PullToRefreshScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshing={refreshing}
				onRefresh={handleRefresh}
			>
				{/* Top up method options */}
				<Text style={styles.sectionTitle}>Choose a method</Text>

				<TouchableOpacity style={styles.optionCard} onPress={handleTopUp} activeOpacity={0.8}>
					<View style={[styles.optionIcon, { backgroundColor: "rgba(59, 158, 255, 0.12)" }]}>
						<Feather name="zap" size={24} color={colors.creditWallet} />
					</View>
					<View style={styles.optionInfo}>
						<Text style={styles.optionTitle}>Topup through Raast</Text>
						<Text style={styles.optionSubtitle}>Instant bank transfer via Raast</Text>
					</View>
					<Feather name="chevron-right" size={22} color={colors.textSecondary} />
				</TouchableOpacity>

				<TouchableOpacity style={styles.optionCard} onPress={handleTransferToFriends} activeOpacity={0.8}>
					<View style={[styles.optionIcon, { backgroundColor: "rgba(0, 217, 163, 0.12)" }]}>
						<Feather name="send" size={24} color={colors.primary} />
					</View>
					<View style={styles.optionInfo}>
						<Text style={styles.optionTitle}>Transfer to Friends</Text>
						<Text style={styles.optionSubtitle}>Transfer to another ClickPrint user</Text>
					</View>
					<Feather name="chevron-right" size={22} color={colors.textSecondary} />
				</TouchableOpacity>

				{/* Top up history */}
				<Text style={[styles.sectionTitle, styles.historyTitle]}>Your requests</Text>

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
					<View style={styles.groups}>
						{topupGroups.map((group) => (
							<View key={group.key}>
								<Text style={styles.groupLabel}>{group.label}</Text>
								<View style={styles.listCard}>
									{group.items.map((item, index) => (
										<TopupItem key={item._id || index} item={item} isLast={index === group.items.length - 1} onOpenProof={setViewingProofId} />
									))}
								</View>
							</View>
						))}
					</View>
				)}
			</PullToRefreshScrollView>

			<ProofViewer fileId={viewingProofId} onClose={() => setViewingProofId(null)} />
		</SafeAreaView>
	);
};

const TopupItem = ({ item, isLast, onOpenProof }) => {
	const statusKey = (item.status || "pending").toLowerCase();
	const statusConfig = STATUS_CONFIG[statusKey] || { label: item.status || "Pending", color: colors.textSecondary, bg: colors.background };
	const shopName = item.shop?.name;
	const date = formatDateTime(item.createdAt || item.date);
	const proofFileId = getProofFileId(item);

	return (
		<TouchableOpacity
			style={[styles.topupRow, !isLast && styles.topupRowBorder]}
			onPress={() => onOpenProof(proofFileId)}
			disabled={!proofFileId}
			activeOpacity={0.6}
		>
			{proofFileId ? (
				<Image source={{ uri: getFileUrl(proofFileId) }} style={styles.topupProof} contentFit="cover" transition={200} />
			) : (
				<View style={styles.topupIcon}>
					<Feather name="arrow-down" size={18} color={colors.primary} />
				</View>
			)}
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
		</TouchableOpacity>
	);
};

// Full-screen viewer for a top up's payment proof. Tap anywhere to close.
const ProofViewer = ({ fileId, onClose }) => {
	const insets = useSafeAreaInsets();

	return (
		<Modal visible={!!fileId} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
			<Pressable style={styles.viewerBackdrop} onPress={onClose}>
				{/* Sits behind the image, so it is covered once the image loads */}
				<ActivityIndicator size="large" color="#FFFFFF" style={styles.viewerSpinner} />
				{fileId ? <Image source={{ uri: getFileUrl(fileId) }} style={styles.viewerImage} contentFit="contain" transition={200} /> : null}
				<TouchableOpacity style={[styles.viewerClose, { top: insets.top + 12 }]} onPress={onClose}>
					<Feather name="x" size={22} color="#FFFFFF" />
				</TouchableOpacity>
			</Pressable>
		</Modal>
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
		paddingVertical: 12,
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
	groups: {
		gap: 18,
	},
	groupLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
		marginBottom: 8,
		marginLeft: 4,
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
	topupProof: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: colors.background,
	},
	viewerBackdrop: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.92)",
		justifyContent: "center",
		alignItems: "center",
	},
	viewerSpinner: {
		position: "absolute",
	},
	viewerImage: {
		width: "100%",
		height: "100%",
	},
	viewerClose: {
		position: "absolute",
		right: 16,
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(255, 255, 255, 0.15)",
		justifyContent: "center",
		alignItems: "center",
	},
});

export default TopUpWallet;
