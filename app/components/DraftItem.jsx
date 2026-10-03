import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../constants/colors";

const DraftItem = ({ draft, onPress, onDelete, isLast = false }) => {
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

	const STAGE_CONFIG = {
		"Add settings": { label: "Add Settings", color: colors.printRequestDark, bg: "rgba(255, 139, 123, 0.16)" },
		"Select shop": { label: "Select Shop", color: "#C28A00", bg: "rgba(245, 197, 24, 0.16)" },
		"Ready": { label: "Ready", color: colors.primaryDark, bg: "rgba(0, 217, 163, 0.12)" },
	};
	const stageConfig = STAGE_CONFIG[stage] || STAGE_CONFIG["Add settings"];

	// Build subtitle parts like ActiveJobCard's "who" line: "shop · files · pages"
	const subtitleParts = [];
	if (shopName) subtitleParts.push(shopName);
	subtitleParts.push(`${fileCount} file${fileCount !== 1 ? "s" : ""}`);
	if (totalPages > 0) subtitleParts.push(`${totalPages} pg`);

	return (
		<View style={[styles.draftCard, isLast && styles.draftCardLast]}>
			<TouchableOpacity
				style={styles.draftTouchable}
				onPress={onPress}
				onLongPress={onDelete ? () => onDelete(draft._id) : undefined}
				activeOpacity={0.7}
				delayLongPress={400}
			>
				<View style={styles.draftIcon}>
					<Feather name="file-text" size={18} color={colors.primary} />
				</View>

				<View style={styles.draftInfo}>
					<Text style={styles.draftName} numberOfLines={1}>
						{primaryName}
						{extraCount > 0 && <Text style={styles.draftNameExtra}>  +{extraCount} more</Text>}
					</Text>
					<Text style={styles.who} numberOfLines={1}>
						{subtitleParts[0]}
						{subtitleParts.length > 1 && (
							<Text style={styles.whoSecondary}> · {subtitleParts.slice(1).join(" · ")}</Text>
						)}
					</Text>
				</View>

				<View style={styles.side}>
					{total > 0 && <Text style={styles.draftCost}>Rs. {total}</Text>}
					<View style={[styles.statusBadge, { backgroundColor: stageConfig.bg }]}>
						<Text style={[styles.statusText, { color: stageConfig.color }]}>{stageConfig.label}</Text>
					</View>
				</View>
			</TouchableOpacity>
		</View>
	);
};

const styles = StyleSheet.create({
	// ── Card container — matches ActiveJobCard.card exactly ──
	draftCard: {
		backgroundColor: colors.cardBackground,
		paddingVertical: 12,
		paddingLeft: 16,
		paddingRight: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	draftCardLast: {
		borderBottomWidth: 0,
	},
	// ── Inner touchable — matches ActiveJobCard.touchable exactly ──
	draftTouchable: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
	},
	// ── Icon tile — matches ActiveJobCard.iconContainer exactly ──
	draftIcon: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: colors.background,
		justifyContent: "center",
		alignItems: "center",
	},
	// ── Main info column — matches ActiveJobCard.main exactly ──
	draftInfo: {
		flex: 1,
		minWidth: 0,
		alignItems: "flex-start",
		gap: 5,
	},
	// ── Primary name — matches ActiveJobCard.jobCodeFallback ──
	draftName: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	draftNameExtra: {
		fontSize: 13,
		fontWeight: "500",
		color: colors.textSecondary,
	},
	// ── Subtitle line — matches ActiveJobCard.who / whoSecondary ──
	who: {
		maxWidth: "100%",
		fontSize: 12.5,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	whoSecondary: {
		fontWeight: "500",
		color: colors.textSecondary,
	},
	// ── Right side column — matches ActiveJobCard.side ──
	side: {
		alignItems: "center",
		gap: 6,
	},
	// ── Price — matches ActiveJobCard.price exactly ──
	draftCost: {
		fontSize: 14,
		fontWeight: "700",
		color: colors.primary,
		fontVariant: ["tabular-nums"],
	},
	// ── Status pill — matches ActiveJobCard.statusBadge / statusText ──
	statusBadge: {
		paddingHorizontal: 7,
		paddingVertical: 2,
		borderRadius: 100,
	},
	statusText: {
		fontSize: 10,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 0.3,
	},
});

export default DraftItem;
