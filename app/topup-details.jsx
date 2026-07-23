//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

const formatDateTime = (value) => {
	if (!value) return "";
	const d = new Date(value);
	if (isNaN(d.getTime())) return "";
	return d.toLocaleString(undefined, {
		month: "long",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
};

//----------------------------------- COMPONENTS -----------------------------------//

const TopUpDetails = () => {
	const router = useRouter();
	const params = useLocalSearchParams();
	const topupId = params.topupId;

	// Render instantly from the list payload, then refresh from the endpoint.
	const [topup, setTopup] = useState(() => {
		try {
			return params.topup ? JSON.parse(params.topup) : null;
		} catch {
			return null;
		}
	});
	const [loading, setLoading] = useState(!params.topup);
	const [error, setError] = useState(null);
	const [downloading, setDownloading] = useState(false);

	useEffect(() => {
		fetchTopup();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [topupId]);

	const fetchTopup = async () => {
		try {
			setError(null);
			const token = await SecureStore.getItemAsync("authToken");
			const response = await fetch(`${API_BASE_URL}/topups/${topupId}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			setTopup(data.data?.topup || data.data || null);
		} catch (err) {
			console.error("Error fetching top up:", err);
			setError(err.message || "Failed to load top up details.");
		} finally {
			setLoading(false);
		}
	};

	const proofFile = topup?.paymentProofFile;
	const proofFileId = proofFile?._id || (typeof proofFile === "string" ? proofFile : null);
	const proofFileName = proofFile?.name || (proofFileId ? `payment-proof-${proofFileId}` : null);

	// Files require a Bearer token, so a plain URL open won't work — fetch the
	// bytes with auth and hand them to the platform's download/open mechanism.
	const handleDownloadProof = async () => {
		if (!proofFileId) return;
		try {
			setDownloading(true);
			const token = await SecureStore.getItemAsync("authToken");
			const url = `${API_BASE_URL}/files/${proofFileId}`;

			if (Platform.OS === "web") {
				const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
				if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
				const blob = await res.blob();
				const objectUrl = URL.createObjectURL(blob);
				const anchor = document.createElement("a");
				anchor.href = objectUrl;
				anchor.download = proofFileName;
				document.body.appendChild(anchor);
				anchor.click();
				anchor.remove();
				URL.revokeObjectURL(objectUrl);
			} else {
				// Legacy API supports request headers on download, which the new
				// File API does not expose yet.
				const FileSystem = await import("expo-file-system/legacy");
				const dest = FileSystem.cacheDirectory + proofFileName;
				const { uri } = await FileSystem.downloadAsync(url, dest, {
					headers: { Authorization: `Bearer ${token}` },
				});
				try {
					await Linking.openURL(uri);
				} catch {
					showAlert("Downloaded", `Payment proof saved to:\n${uri}`);
				}
			}
		} catch (err) {
			console.error("Error downloading proof:", err);
			showAlert("Download failed", "Could not download the payment proof. Please try again.");
		} finally {
			setDownloading(false);
		}
	};

	const statusKey = (topup?.status || "pending").toLowerCase();
	const statusConfig = STATUS_CONFIG[statusKey] || { label: topup?.status || "Pending", color: colors.textSecondary, bg: colors.background };

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Top Up Details</Text>
				<View style={styles.placeholder} />
			</View>

			{loading && !topup ? (
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={styles.loadingText}>Loading top up details...</Text>
				</View>
			) : error && !topup ? (
				<View style={styles.centerContainer}>
					<Feather name="alert-circle" size={48} color={colors.printRequest} />
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity style={styles.retryButton} onPress={fetchTopup}>
						<Text style={styles.retryButtonText}>Retry</Text>
					</TouchableOpacity>
				</View>
			) : topup ? (
				<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
					{/* Summary */}
					<View style={styles.summaryCard}>
						<View style={styles.summaryIcon}>
							<Feather name="arrow-down" size={30} color={colors.primary} />
						</View>
						<Text style={styles.summaryLabel}>Top Up Amount</Text>
						<Text style={styles.summaryAmount}>Rs. {topup.amount}</Text>
						<View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
							<Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
						</View>
					</View>

					{/* Details */}
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<Feather name="info" size={18} color={colors.printRequest} />
							<Text style={styles.sectionTitle}>Details</Text>
						</View>
						<View style={styles.card}>
							{topup.shop?.name ? <InfoRow label="Shop" value={topup.shop.name} /> : null}
							{topup.createdBy?.name ? <InfoRow label="Requested By" value={topup.createdBy.name} /> : null}
							{topup.createdBy?.number ? <InfoRow label="Contact" value={topup.createdBy.number} /> : null}
							<InfoRow label="Date" value={formatDateTime(topup.createdAt) || "—"} />
							<InfoRow label="Top Up ID" value={topup._id} mono last />
						</View>
					</View>

					{/* Payment Proof */}
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<Feather name="paperclip" size={18} color={colors.printRequest} />
							<Text style={styles.sectionTitle}>Payment Proof</Text>
						</View>
						{proofFileId ? (
							<View style={styles.proofCard}>
								<View style={styles.proofIcon}>
									<Feather name="file-text" size={20} color={colors.printRequest} />
								</View>
								<Text style={styles.proofName} numberOfLines={1} ellipsizeMode="middle">
									{proofFileName}
								</Text>
								<TouchableOpacity style={styles.downloadButton} onPress={handleDownloadProof} disabled={downloading}>
									{downloading ? (
										<ActivityIndicator size="small" color={colors.cardBackground} />
									) : (
										<>
											<Feather name="download" size={16} color={colors.cardBackground} />
											<Text style={styles.downloadButtonText}>Download</Text>
										</>
									)}
								</TouchableOpacity>
							</View>
						) : (
							<View style={styles.card}>
								<Text style={styles.emptyText}>No payment proof was attached to this request.</Text>
							</View>
						)}
					</View>
				</ScrollView>
			) : null}
		</SafeAreaView>
	);
};

const InfoRow = ({ label, value, mono = false, last = false }) => (
	<View style={[styles.infoRow, last && styles.infoRowLast]}>
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
	centerContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
		gap: 16,
	},
	loadingText: {
		fontSize: 16,
		color: colors.textSecondary,
	},
	errorText: {
		fontSize: 16,
		fontWeight: "600",
		color: colors.textPrimary,
		textAlign: "center",
	},
	retryButton: {
		backgroundColor: colors.primary,
		paddingHorizontal: 32,
		paddingVertical: 12,
		borderRadius: 12,
	},
	retryButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: colors.cardBackground,
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
		padding: 24,
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
	summaryIcon: {
		width: 64,
		height: 64,
		borderRadius: 18,
		backgroundColor: "rgba(0, 217, 163, 0.10)",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 16,
	},
	summaryLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textSecondary,
		marginBottom: 6,
	},
	summaryAmount: {
		fontSize: 34,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 14,
	},
	statusBadge: {
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 20,
	},
	statusText: {
		fontSize: 13,
		fontWeight: "700",
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
		paddingHorizontal: 16,
		paddingVertical: 4,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 13,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	infoRowLast: {
		borderBottomWidth: 0,
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
	proofCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	proofIcon: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: "#FFE8E5",
		justifyContent: "center",
		alignItems: "center",
	},
	proofName: {
		flex: 1,
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	downloadButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: colors.primary,
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 10,
	},
	downloadButtonText: {
		fontSize: 13,
		fontWeight: "700",
		color: colors.cardBackground,
	},
	emptyText: {
		fontSize: 14,
		color: colors.textSecondary,
		paddingVertical: 8,
	},
});

export default TopUpDetails;
