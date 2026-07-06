import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { colors } from "../../../constants/colors";
import { useState } from "react";

const DocumentCard = ({ doc, index, onRemove }) => {
	const extension = doc.file.name ? doc.file.name.split(".").pop().toUpperCase() : "FILE";
	const [expanded, setExpanded] = useState(false);

	return (
		<View style={styles.documentCard}>
			<View style={styles.documentCardHeader}>
				<View style={styles.documentIconContainer}>
					<Feather name="file-text" size={22} color={colors.primary} />
					<Text style={styles.extensionBadge}>{extension}</Text>
				</View>
				<View style={styles.documentInfo}>
					<TouchableOpacity onPress={() => setExpanded((prev) => !prev)} activeOpacity={0.7}>
						<Text style={styles.documentOriginalName} numberOfLines={expanded ? undefined : 1}>
							{doc.file.name}
						</Text>
					</TouchableOpacity>
					<Text style={styles.documentFileSize}>{(doc.file.size / 1024).toFixed(2)} KB</Text>
				</View>
				{doc.status === "uploading" ? (
					<View style={styles.statusContainer}>
						<ActivityIndicator size="small" color={colors.primary} />
					</View>
				) : doc.status === "success" ? (
					<View style={styles.statusContainer}>
						<Feather name="check-circle" size={20} color={colors.primary} />
					</View>
				) : doc.status === "failed" ? (
					<View style={styles.statusContainer}>
						<Text style={styles.failedText}>Failed</Text>
					</View>
				) : (
					<TouchableOpacity style={styles.removeCardButton} onPress={() => onRemove(index)}>
						<Feather name="x" size={18} color={colors.printRequest} />
					</TouchableOpacity>
				)}
			</View>
		</View >
	);
};

export default DocumentCard;

const styles = StyleSheet.create({
	documentCard: {
		backgroundColor: colors.background,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.borderLight,
		padding: 14,
		marginBottom: 4,
	},
	documentCardHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	documentIconContainer: {
		width: 44,
		height: 44,
		borderRadius: 10,
		backgroundColor: "rgba(0, 217, 163, 0.1)",
		justifyContent: "center",
		alignItems: "center",
	},
	documentsList: {
		gap: 12,
	},
	extensionBadge: {
		fontSize: 8,
		fontWeight: "800",
		color: colors.primary,
		marginTop: 2,
	},
	documentInfo: {
		flex: 1,
	},
	documentOriginalName: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
		marginBottom: 2,
	},
	documentFileSize: {
		fontSize: 12,
		color: colors.textSecondary,
	},
	removeCardButton: {
		width: 32,
		height: 32,
		borderRadius: 8,
		backgroundColor: "rgba(255, 139, 123, 0.1)",
		justifyContent: "center",
		alignItems: "center",
	},
	statusContainer: {
		paddingHorizontal: 8,
		justifyContent: "center",
		alignItems: "center",
	},
	failedText: {
		color: colors.printRequest,
		fontSize: 12,
		fontWeight: "700",
	},
});
