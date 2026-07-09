import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../constants/colors";
import { formatDate } from "../../utils/helper";

const DraftItem = ({ draft, onPress, onDelete }) => {
	const fileCount = draft.files?.length || 0;
	const total = draft.cost?.total || 0;

	return (
		<View style={styles.draftCard}>
			<TouchableOpacity style={styles.draftTouchable} onPress={onPress} activeOpacity={0.7}>
				<View style={styles.draftLeft}>
					<View style={styles.draftIcon}>
						<Feather name="file-text" size={18} color={colors.printRequest} />
					</View>

					<View style={styles.draftInfo}>
						<Text style={styles.draftName}>Draft</Text>
						<View style={styles.draftDetails}>
							{draft.createdAt && (
								<>
									<Text style={styles.draftMeta}>{formatDate(draft.createdAt)}</Text>
									<Text style={styles.draftDot}> • </Text>
								</>
							)}
							<Text style={styles.draftMeta}>
								{fileCount} file{fileCount !== 1 ? "s" : ""}
							</Text>
						</View>
					</View>
				</View>

				<View style={styles.draftRight}>
					{total > 0 && <Text style={styles.draftCost}>Rs. {total}</Text>}
					<Feather name="chevron-right" size={20} color={colors.textSecondary} />
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
		justifyContent: "space-between",
		alignItems: "center",
	},
	draftLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		flex: 1,
	},
	draftRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	draftCost: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
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
	draftName: {
		fontSize: 15,
		fontWeight: "500",
		color: colors.textPrimary,
		marginBottom: 4,
	},
	draftDetails: {
		flexDirection: "row",
		alignItems: "center",
	},
	draftMeta: {
		fontSize: 13,
		color: colors.textSecondary,
		opacity: 0.7,
	},
	draftDot: {
		fontSize: 13,
		color: colors.textSecondary,
		opacity: 0.5,
	},
	deleteButton: {
		padding: 10,
		marginLeft: 8,
		borderRadius: 10,
		backgroundColor: "rgba(255, 139, 123, 0.12)",
	},
});

export default DraftItem;
