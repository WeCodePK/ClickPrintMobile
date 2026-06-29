//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

const SIDEDNESS_LABELS = {
	single: "Single Sided",
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
	pageSelection: "Page Selection",
	sidedness: "Sidedness",
};

const formatSettingValue = (key, value) => {
	switch (key) {
		case "color":
			return value ? "Colored" : "Black & White";
		case "sidedness":
			return SIDEDNESS_LABELS[value] || value;
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
	const [submitting, setSubmitting] = useState(false);

	let draft = null;
	try {
		draft = JSON.parse(params.draft);
	} catch (e) {
		console.error("Failed to parse draft param:", e);
	}

	if (!draft) {
		return (
			<SafeAreaView style={styles.container} edges={["top"]}>
				<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
				<View style={styles.header}>
					<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
						<Feather name="arrow-left" size={24} color={colors.textPrimary} />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Draft Details</Text>
					<View style={styles.placeholder} />
				</View>
				<View style={styles.emptyState}>
					<Text style={styles.emptyText}>No draft information available.</Text>
				</View>
			</SafeAreaView>
		);
	}

	const cost = draft.cost || {};
	const files = draft.files || [];

	//----------------------------------- HANDLERS -----------------------------------//

	const handleSubmitDraft = async () => {
		try {
			setSubmitting(true);
			const token = await SecureStore.getItemAsync("authToken");
			const response = await fetch(`${API_BASE_URL}/drafts/${draft._id}/submit`, {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
			const data = await response.json();
			if (response.ok) {
				console.log("Draft submitted successfully:", data);
				Alert.alert("Success", "Your print job has been submitted!", [
					{
						text: "OK",
						onPress: () => router.replace("/"),
					},
				]);
			} else {
				console.log("Error submitting draft:", data);
				throw new Error(data.message || "Failed to submit draft.");
			}
		} catch (err) {
			console.error("Error submitting draft:", err);
			Alert.alert("Error", err.message || "Failed to submit draft. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Draft Details</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
				{/* Summary Card */}
				<View style={styles.summaryCard}>
					<View style={styles.summaryIconContainer}>
						<Feather name="file-text" size={32} color={colors.printRequest} />
					</View>
					<Text style={styles.summaryTitle}>Draft Created</Text>
					<Text style={styles.summaryTotal}>{formatCurrency(cost.total ?? 0)}</Text>
					<Text style={styles.summaryDate}>{files.length} file{files.length !== 1 ? "s" : ""}</Text>
				</View>

				{/* Draft Info */}
				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<Feather name="info" size={18} color={colors.printRequest} />
						<Text style={styles.sectionTitle}>Draft Info</Text>
					</View>
					<View style={styles.card}>
						<InfoRow label="Draft ID" value={draft._id} mono />
						<InfoRow label="Shop" value={draft.forShop} mono />
						<InfoRow label="Total Files" value={`${files.length} file${files.length !== 1 ? "s" : ""}`} />
					</View>
				</View>

				{/* Cost Breakdown */}
				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<Feather name="dollar-sign" size={18} color={colors.printRequest} />
						<Text style={styles.sectionTitle}>Cost Breakdown</Text>
					</View>
					<View style={styles.card}>
						{(cost.lines || []).map((line, index) => {
							const [code, qty, rate, lineTotal] = line;
							return (
								<View key={`line-${index}`} style={styles.costRow}>
									<View style={styles.costRowLeft}>
										<Text style={styles.costLabel}>{code}</Text>
										<Text style={styles.costSubLabel}>{qty} × {formatCurrency(rate)}</Text>
									</View>
									<Text style={styles.costValue}>{formatCurrency(lineTotal)}</Text>
								</View>
							);
						})}
						{(cost.extra || []).map((extra, index) => {
							const [label, amount] = extra;
							return (
								<View key={`extra-${index}`} style={styles.costRow}>
									<View style={styles.costRowLeft}>
										<Text style={styles.costLabel}>{label}</Text>
									</View>
									<Text style={styles.costValue}>{formatCurrency(amount)}</Text>
								</View>
							);
						})}
						<View style={styles.totalRow}>
							<Text style={styles.totalLabel}>Total</Text>
							<Text style={styles.totalValue}>{formatCurrency(cost.total ?? 0)}</Text>
						</View>
					</View>
				</View>

				{/* Files Section */}
				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<Feather name="file-text" size={18} color={colors.printRequest} />
						<Text style={styles.sectionTitle}>Files ({files.length})</Text>
					</View>
					{files.map((file, index) => (
						<View key={`${file.fileId}-${index}`} style={[styles.fileCard, index < files.length - 1 && styles.fileCardSpacing]}>
							<View style={styles.fileCardHeader}>
								<View style={styles.fileIcon}>
									<Feather name="file" size={16} color={colors.printRequest} />
								</View>
								<View style={styles.fileCardHeaderText}>
									<Text style={styles.fileLabel}>File {index + 1}</Text>
									<Text style={styles.fileHash} numberOfLines={1}>
										{file.fileId}
									</Text>
								</View>
							</View>

							<View style={styles.settingsDivider} />

							{Object.entries(file.settings || {}).map(([key, value], i, arr) => (
								<View key={key} style={[styles.settingRow, i < arr.length - 1 && styles.settingRowBorder]}>
									<Text style={styles.settingLabel}>{SETTING_LABELS[key] || key}</Text>
									<Text style={styles.settingValue}>{formatSettingValue(key, value)}</Text>
								</View>
							))}
						</View>
					))}
				</View>
			</ScrollView>

			{/* Footer Submit Button */}
			<View style={styles.footer}>
				<TouchableOpacity
					style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
					onPress={handleSubmitDraft}
					disabled={submitting}
				>
					{submitting ? (
						<ActivityIndicator size="small" color={colors.cardBackground} />
					) : (
						<>
							<Text style={styles.submitButtonText}>Submit Draft</Text>
							<Feather name="send" size={20} color={colors.cardBackground} />
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
	summaryTotal: {
		fontSize: 28,
		fontWeight: "800",
		color: colors.printRequest,
		marginBottom: 6,
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
		color: colors.printRequest,
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
		backgroundColor: colors.navInactive,
		opacity: 0.6,
	},
	submitButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},
});

export default DraftDetails;
