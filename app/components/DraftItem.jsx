import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../constants/colors";
import { formatDate } from "../../utils/helper";

// Collapse a per-file setting across the draft: a single shared value shows as
// that value, differing values show as "Mixed".
const summarize = (files, key, format) => {
	const values = [...new Set(files.map((f) => f.settings?.[key]))];
	if (values.length === 0 || values[0] === undefined) return null;
	if (values.length > 1) return "Mixed";
	return format(values[0]);
};

const DraftItem = ({ draft, onPress, onDelete }) => {
	const files = draft.files || [];
	const fileCount = files.length;
	const total = draft.cost?.total || 0;
	const shopName = draft.shop?.name;

	const primaryName = files[0]?.file?.name || "Document";
	const extraCount = Math.max(0, fileCount - 1);
	const totalPages = files.reduce((sum, f) => sum + (f.file?.numberOfPages || 0), 0);

	// Which step the draft is waiting on — mirrors home's handleDraftPress routing.
	const configuredFiles = files.filter((f) => f.settings && Object.keys(f.settings).length > 0);
	const hasMissingSettings = fileCount === 0 || configuredFiles.length < fileCount;
	const stage = hasMissingSettings ? "Add settings" : !draft.shop ? "Select shop" : "Ready";
	const isReady = stage === "Ready";

	const colorLabel = summarize(configuredFiles, "color", (v) => (v ? "Color" : "B&W"));
	const sizeLabel = summarize(configuredFiles, "pageType", (v) => v);
	const settingsLabel = [colorLabel, sizeLabel].filter(Boolean).join(" · ");

	return (
		<View style={styles.draftCard}>
			<TouchableOpacity style={styles.draftTouchable} onPress={onPress} activeOpacity={0.7}>
				<View style={styles.draftIcon}>
					<Feather name="file-text" size={18} color={colors.printRequest} />
				</View>

				<View style={styles.draftInfo}>
					{/* Name + cost */}
					<View style={styles.titleRow}>
						<Text style={styles.draftName} numberOfLines={1}>
							{primaryName}
							{extraCount > 0 && <Text style={styles.draftNameExtra}>  +{extraCount} more</Text>}
						</Text>
						{total > 0 && <Text style={styles.draftCost}>Rs. {total}</Text>}
					</View>

					{/* Meta line */}
					<View style={styles.draftDetails}>
						{draft.createdAt && (
							<>
								<Text style={styles.draftMeta}>{formatDate(draft.createdAt)}</Text>
								<Text style={styles.draftDot}>•</Text>
							</>
						)}
						<Text style={styles.draftMeta}>
							{fileCount} file{fileCount !== 1 ? "s" : ""}
						</Text>
						{totalPages > 0 && (
							<>
								<Text style={styles.draftDot}>•</Text>
								<Text style={styles.draftMeta}>
									{totalPages} page{totalPages !== 1 ? "s" : ""}
								</Text>
							</>
						)}
					</View>

					{/* Chips */}
					<View style={styles.chipsRow}>
						<View style={[styles.pill, isReady ? styles.pillReady : styles.pillPending]}>
							{isReady ? (
								<Feather name="check-circle" size={11} color={colors.primaryDark} />
							) : (
								<Feather name="alert-circle" size={11} color={colors.printRequestDark} />
							)}
							<Text style={[styles.pillText, isReady ? styles.pillTextReady : styles.pillTextPending]}>{stage}</Text>
						</View>

						{shopName && (
							<View style={styles.infoChip}>
								<Feather name="map-pin" size={11} color={colors.textSecondary} />
								<Text style={styles.infoChipText} numberOfLines={1}>
									{shopName}
								</Text>
							</View>
						)}

						{settingsLabel !== "" && (
							<View style={styles.infoChip}>
								<Feather name="sliders" size={11} color={colors.textSecondary} />
								<Text style={styles.infoChipText}>{settingsLabel}</Text>
							</View>
						)}
					</View>
				</View>
			</TouchableOpacity>

			{onDelete && (
				<TouchableOpacity
					onPress={() => onDelete(draft._id)}
					hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
					style={styles.deleteButton}
				>
					<Feather name="trash-2" size={16} color={colors.printRequest} />
				</TouchableOpacity>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	draftCard: {
		backgroundColor: "transparent",
		paddingVertical: 12,
		paddingLeft: 16,
		paddingRight: 8,
		flexDirection: "row",
		alignItems: "center",
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	draftTouchable: {
		flex: 1,
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 12,
	},
	draftIcon: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: colors.background,
		justifyContent: "center",
		alignItems: "center",
	},
	draftInfo: {
		flex: 1,
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 8,
		marginBottom: 4,
	},
	draftName: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
		flex: 1,
	},
	draftNameExtra: {
		fontSize: 13,
		fontWeight: "500",
		color: colors.textSecondary,
	},
	draftCost: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.printRequest,
	},
	draftDetails: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 6,
		marginBottom: 8,
	},
	draftMeta: {
		fontSize: 12,
		color: colors.textSecondary,
	},
	draftDot: {
		fontSize: 12,
		color: colors.textSecondary,
		opacity: 0.5,
	},
	chipsRow: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 6,
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 8,
	},
	pillReady: {
		backgroundColor: "rgba(0, 217, 163, 0.12)",
	},
	pillPending: {
		backgroundColor: "rgba(255, 139, 123, 0.12)",
	},
	pillText: {
		fontSize: 11,
		fontWeight: "700",
	},
	pillTextReady: {
		color: colors.primaryDark,
	},
	pillTextPending: {
		color: colors.printRequestDark,
	},
	infoChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 8,
		backgroundColor: colors.background,
		borderWidth: 1,
		borderColor: colors.borderLight,
		maxWidth: 160,
	},
	infoChipText: {
		fontSize: 11,
		fontWeight: "500",
		color: colors.textSecondary,
	},
	deleteButton: {
		padding: 10,
		marginLeft: 8,
		borderRadius: 10,
		backgroundColor: "rgba(255, 139, 123, 0.12)",
	},
});

export default DraftItem;
