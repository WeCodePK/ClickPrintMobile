import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../constants/colors";
import { useState, useEffect } from "react";
import SecureStore from "../../utils/storage";
import config from "../../config/config";

const STATUS_CONFIG = {
	submitted: { label: "Submitted", color: colors.creditWallet, bg: "rgba(59, 158, 255, 0.12)", icon: "send" },
	processing: { label: "Processing", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", icon: "loader" },
	pending: { label: "Pending", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", icon: "clock" },
};

const ActiveJobCard = ({ job, onPress }) => {
	const statusConfig = STATUS_CONFIG[job.status] || {
		label: job.status,
		color: colors.textSecondary,
		bg: colors.background,
		icon: "printer",
	};

	const [shopName, setShopName] = useState("Print Job");

	useEffect(() => {
		const fetchShopName = async () => {
			if (!job.shopId) return;
			try {
				const token = await SecureStore.getItemAsync("authToken");
				const res = await fetch(`${config.apiBaseUrl}/shops/${job.shopId}`, {
					headers: { Authorization: `Bearer ${token}` }
				});
				const data = await res.json();
				if (data.success && data.data?.shop?.name) {
					setShopName(data.data.shop.name);
				}
			} catch (e) {
				console.error("Error fetching shop name:", e);
			}
		};
		fetchShopName();
	}, [job.shopId]);

	return (
		<TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
			<View style={styles.cardLeft}>
				<View style={styles.iconContainer}>
					<Feather name="printer" size={18} color={colors.printRequest} />
					<View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
				</View>

				<View style={styles.jobInfo}>
					<Text style={styles.jobTitle}>{shopName}</Text>
				</View>
			</View>

			<View style={styles.cardRight}>
				<View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
					<View style={[styles.statusPulse, { backgroundColor: statusConfig.color }]} />
					<Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
				</View>
			</View>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 14,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		borderBottomWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
		marginBottom: 10,
	},
	cardLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		flex: 1,
	},
	iconContainer: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: colors.background,
		justifyContent: "center",
		alignItems: "center",
		position: "relative",
	},
	statusDot: {
		position: "absolute",
		top: -2,
		right: -2,
		width: 12,
		height: 12,
		borderRadius: 6,
		borderWidth: 2,
		borderColor: colors.cardBackground,
	},
	jobInfo: {
		flex: 1,
	},
	jobTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
		marginBottom: 3,
	},
	jobMeta: {
		flexDirection: "row",
		alignItems: "center",
	},
	jobMetaText: {
		fontSize: 12,
		color: colors.textSecondary,
	},
	jobMetaDot: {
		fontSize: 12,
		color: colors.textSecondary,
		opacity: 0.5,
	},
	cardRight: {
		alignItems: "flex-end",
		gap: 6,
	},
	jobCost: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	statusBadge: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 20,
		gap: 6,
	},
	statusPulse: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
	statusText: {
		fontSize: 11,
		fontWeight: "700",
	},
});

export default ActiveJobCard;
