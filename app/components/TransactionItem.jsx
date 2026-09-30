import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../constants/colors";

const STATUS_CONFIG = {
	completed: { label: "Completed", color: colors.primary, bg: "rgba(0, 217, 163, 0.12)" },
	cancelled: { label: "Cancelled", color: colors.danger, bg: "rgba(255, 90, 95, 0.12)" },
	failed: { label: "Failed", color: colors.danger, bg: "rgba(255, 90, 95, 0.12)" },
};

const TransactionItem = ({ transaction, onPress }) => {
	const statusConfig = STATUS_CONFIG[transaction.status] || { label: transaction.status, color: colors.textSecondary, bg: colors.background };

	return (
		<TouchableOpacity style={styles.transactionCard} onPress={onPress} activeOpacity={0.7}>
			<View style={styles.transactionLeft}>
				<View style={styles.iconColumn}>
					<View style={styles.transactionIcon}>
						<Feather name="printer" size={18} color={colors.textSecondary} />
					</View>
					<Text style={styles.transactionTime} numberOfLines={1}>
						{transaction.time}
					</Text>
				</View>

				<View style={styles.transactionInfo}>
					{transaction.code ? (
						<Text style={styles.jobCode}>#{transaction.code}</Text>
					) : (
						<Text style={styles.transactionName}>Print Job</Text>
					)}
					<Text style={styles.transactionDetails} numberOfLines={1}>
						{transaction.shopName && <Text style={styles.shopName}>{transaction.shopName} · </Text>}
						{transaction.fileCount} file{transaction.fileCount !== 1 ? "s" : ""}
					</Text>
				</View>
			</View>

			<View style={styles.transactionRight}>
				{transaction.cost > 0 && (
					<Text style={styles.transactionCost}>Rs. {transaction.cost}</Text>
				)}
				<View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
					<Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
				</View>
			</View>
		</TouchableOpacity>
	);


};

const styles = StyleSheet.create({
	transactionCard: {
		backgroundColor: "transparent",
		padding: 16,
		paddingVertical: 12,
		marginBottom: 0,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	transactionLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		flex: 1,
	},

	transactionRight: {
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
	},
	transactionCost: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},


	// The printer tile with the job's time tucked underneath.
	iconColumn: {
		alignItems: "center",
		gap: 5,
	},
	transactionTime: {
		fontSize: 10,
		fontWeight: "600",
		color: colors.textSecondary,
		fontVariant: ["tabular-nums"],
	},
	transactionIcon: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: colors.background,
		justifyContent: "center",
		alignItems: "center",
	},
	transactionInfo: {
		flex: 1,
		minWidth: 0,
		alignItems: "flex-start",
		gap: 5,
	},
	// Same `.job-code` badge as the home screen's active-job card.
	jobCode: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 6,
		overflow: "hidden",
		backgroundColor: "rgba(0, 217, 163, 0.14)",
		color: colors.textPrimary,
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 0.6,
		fontVariant: ["tabular-nums"],
	},
	transactionName: {
		fontSize: 15,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	transactionDetails: {
		maxWidth: "100%",
		fontSize: 13,
		color: colors.textSecondary,
	},
	shopName: {
		fontWeight: "600",
		color: colors.textPrimary,
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
});

export default TransactionItem;
