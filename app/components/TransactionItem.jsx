import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../constants/colors";

const STATUS_CONFIG = {
	completed: { label: "Completed", color: colors.primary, bg: "rgba(0, 217, 163, 0.12)" },
	submitted: { label: "Submitted", color: colors.creditWallet, bg: "rgba(59, 158, 255, 0.12)" },
	processing: { label: "Processing", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)" },
	cancelled: { label: "Cancelled", color: colors.printRequest, bg: "rgba(255, 139, 123, 0.12)" },
	pending: { label: "Pending", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)" },
};

const TransactionItem = ({ transaction, onPress }) => {
	const statusConfig = STATUS_CONFIG[transaction.status] || { label: transaction.status, color: colors.textSecondary, bg: colors.background };
	const pageType = transaction.files?.[0]?.settings?.pageType;

	return (
		<TouchableOpacity style={styles.transactionCard} onPress={onPress} activeOpacity={0.7}>
			<View style={styles.transactionLeft}>
				<View style={styles.transactionIcon}>
					<Feather name="printer" size={18} color={colors.textSecondary} />
				</View>

				<View style={styles.transactionInfo}>
					<Text style={styles.transactionName}>Print Job</Text>
					<View style={styles.transactionDetails}>
						<Text style={styles.transactionTime}>{transaction.time}</Text>
						<Text style={styles.transactionDot}> • </Text>
						<Text style={styles.transactionFiles}>
							{transaction.fileCount} file{transaction.fileCount !== 1 ? "s" : ""}
						</Text>
						{pageType && (
							<>
								<Text style={styles.transactionDot}> • </Text>
								<Text style={styles.transactionSize}>{pageType}</Text>
							</>
						)}
					</View>
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
		alignItems: "flex-end",
		justifyContent: "center",
		gap: 6,
	},
	transactionCost: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
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
	},
	transactionName: {
		fontSize: 15,
		fontWeight: "500",
		color: colors.textPrimary,
		marginBottom: 4,
	},
	transactionDetails: {
		flexDirection: "row",
		alignItems: "center",
	},
	transactionTime: {
		fontSize: 13,
		color: colors.textSecondary,
		opacity: 0.7,
	},
	transactionDot: {
		fontSize: 13,
		color: colors.textSecondary,
		opacity: 0.5,
	},
	transactionFiles: {
		fontSize: 13,
		color: colors.textSecondary,
		opacity: 0.7,
	},
	transactionSize: {
		fontSize: 13,
		color: colors.textSecondary,
		opacity: 0.7,
	},
	statusBadge: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 20,
		marginLeft: 8,
	},
	statusText: {
		fontSize: 12,
		fontWeight: "600",
	},
});

export default TransactionItem;
