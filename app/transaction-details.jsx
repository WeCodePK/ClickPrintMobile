//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../constants/colors";

//----------------------------------- CONSTANTS -----------------------------------//

const STATUS_CONFIG = {
	completed: { label: "Completed", color: colors.primary, bg: "rgba(0, 217, 163, 0.12)" },
	submitted: { label: "Submitted", color: colors.creditWallet, bg: "rgba(59, 158, 255, 0.12)" },
	processing: { label: "Processing", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)" },
	cancelled: { label: "Cancelled", color: colors.printRequest, bg: "rgba(255, 139, 123, 0.12)" },
	pending: { label: "Pending", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)" },
};

const SIDEDNESS_LABELS = {
	single: "Single Sided",
	long: "Double Sided (Long Edge)",
	short: "Double Sided (Short Edge)",
};

const formatSettingValue = (key, value) => {
	switch (key) {
		case "color":
			return value ? "Colored" : "Black & White";
		case "sidedness":
			return SIDEDNESS_LABELS[value] || value;
		case "orientation":
			return value.charAt(0).toUpperCase() + value.slice(1);
		default:
			return String(value);
	}
};

const SETTING_LABELS = {
	color: "Color",
	pageType: "Page Size",
	orientation: "Orientation",
	pagesPerSheet: "Pages Per Sheet",
	numberOfCopies: "Copies",
	pageSelection: "Page Selection",
	sidedness: "Sidedness",
};

//----------------------------------- COMPONENTS -----------------------------------//

const TransactionDetails = () => {
	const router = useRouter();
	const params = useLocalSearchParams();
	const transaction = JSON.parse(params.transaction);

	const statusConfig = STATUS_CONFIG[transaction.status] || {
		label: transaction.status,
		color: colors.textSecondary,
		bg: colors.background,
	};

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
				<Text style={styles.headerTitle}>Transaction Details</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
				{/* Summary Card */}
				<View style={styles.summaryCard}>
					<View style={styles.summaryIconContainer}>
						<Feather name="printer" size={32} color={colors.printRequest} />
					</View>
					<Text style={styles.summaryTitle}>Print Job</Text>
					<View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
						<Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
					</View>
					<Text style={styles.summaryDate}>{formatDateTime(transaction.timestamp)}</Text>
				</View>

				{/* Job Info */}
				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<Feather name="info" size={18} color={colors.printRequest} />
						<Text style={styles.sectionTitle}>Job Info</Text>
					</View>
					<View style={styles.card}>
						<InfoRow label="Job ID" value={transaction.id} mono />
						<InfoRow label="Total Files" value={`${transaction.fileCount} file${transaction.fileCount !== 1 ? "s" : ""}`} />
					</View>
				</View>

				{/* Files Section */}
				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<Feather name="file-text" size={18} color={colors.printRequest} />
						<Text style={styles.sectionTitle}>Files ({transaction.fileCount})</Text>
					</View>
					{transaction.files.map((file, index) => (
						<View key={file.hash} style={[styles.fileCard, index < transaction.files.length - 1 && styles.fileCardSpacing]}>
							<View style={styles.fileCardHeader}>
								<View style={styles.fileIcon}>
									<Feather name="file" size={16} color={colors.printRequest} />
								</View>
								<View style={styles.fileCardHeaderText}>
									<Text style={styles.fileLabel}>File {index + 1}</Text>
									<Text style={styles.fileHash} numberOfLines={1}>
										{file.hash}
									</Text>
								</View>
							</View>

							<View style={styles.settingsDivider} />

							{Object.entries(file.settings).map(([key, value], i, arr) => (
								<View key={key} style={[styles.settingRow, i < arr.length - 1 && styles.settingRowBorder]}>
									<Text style={styles.settingLabel}>{SETTING_LABELS[key] || key}</Text>
									<Text style={styles.settingValue}>{formatSettingValue(key, value)}</Text>
								</View>
							))}
						</View>
					))}
				</View>

				{/* Status History */}
				{transaction.statusHistory.length > 0 && (
					<View style={styles.section}>
						<View style={styles.sectionHeader}>
							<Feather name="clock" size={18} color={colors.printRequest} />
							<Text style={styles.sectionTitle}>Status History</Text>
						</View>
						<View style={styles.card}>
							{transaction.statusHistory.map((entry, index) => {
								const entryConfig = STATUS_CONFIG[entry.status] || { label: entry.status, color: colors.textSecondary, bg: colors.background };
								const isLast = index === transaction.statusHistory.length - 1;
								return (
									<View key={entry._id} style={styles.timelineItem}>
										<View style={styles.timelineLeft}>
											<View style={[styles.timelineDot, { backgroundColor: entryConfig.color }]} />
											{!isLast && <View style={styles.timelineLine} />}
										</View>
										<View style={[styles.timelineContent, !isLast && styles.timelineContentSpacing]}>
											<View style={styles.timelineRow}>
												<Text style={[styles.timelineStatus, { color: entryConfig.color }]}>{entryConfig.label}</Text>
												<Text style={styles.timelineBy}>by {entry.by}</Text>
											</View>
											<Text style={styles.timelineDate}>{formatDateTime(entry.at)}</Text>
										</View>
									</View>
								);
							})}
						</View>
					</View>
				)}
			</ScrollView>
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
	summaryIconContainer: {
		width: 72,
		height: 72,
		borderRadius: 20,
		backgroundColor: "#FFE8E5",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 16,
	},
	summaryTitle: {
		fontSize: 22,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 10,
	},
	statusBadge: {
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 20,
		marginBottom: 10,
	},
	statusText: {
		fontSize: 13,
		fontWeight: "700",
	},
	summaryDate: {
		fontSize: 13,
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
	card: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		paddingHorizontal: 16,
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
	fileCard: {
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
	fileCardSpacing: {
		marginBottom: 12,
	},
	fileCardHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 12,
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
	timelineItem: {
		flexDirection: "row",
	},
	timelineLeft: {
		alignItems: "center",
		width: 24,
		marginRight: 12,
		marginTop: 4,
	},
	timelineDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
	},
	timelineLine: {
		width: 2,
		flex: 1,
		backgroundColor: colors.borderLight,
		marginTop: 4,
	},
	timelineContent: {
		flex: 1,
		paddingTop: 0,
		paddingBottom: 16,
	},
	timelineContentSpacing: {
		paddingBottom: 20,
	},
	timelineRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 4,
	},
	timelineStatus: {
		fontSize: 14,
		fontWeight: "700",
	},
	timelineBy: {
		fontSize: 12,
		color: colors.textSecondary,
	},
	timelineDate: {
		fontSize: 12,
		color: colors.textSecondary,
	},
});

export default TransactionDetails;
