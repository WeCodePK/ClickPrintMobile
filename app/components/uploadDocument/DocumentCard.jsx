import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { colors } from "../../../constants/colors";

const DocumentCard = ({ doc, number, onRemove, onRetry, onPreview }) => {
	const extension = doc.file.name ? doc.file.name.split(".").pop().toUpperCase() : "FILE";
	// Once every byte is sent the server still converts the file to PDF
	// before responding, which can take a few seconds.
	const processing = doc.status === "uploading" && (doc.progress ?? 0) >= 1;

	const removeButton = (
		<TouchableOpacity
			style={styles.removeCardButton}
			onPress={() => onRemove(doc.id)}
			activeOpacity={0.7}
			hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
		>
			<Feather name="trash-2" size={18} color={colors.dangerDark} />
		</TouchableOpacity>
	);

	// Tapping the card opens the preview once the file is on the server.
	// The remove/retry buttons inside handle their own taps.
	const canPreview = !!doc.fileId && doc.status !== "uploading" && doc.status !== "failed";

	return (
		<TouchableOpacity
			style={styles.documentCard}
			onPress={() => onPreview?.(doc.fileId, doc.file?.name || doc.name, doc.file?.numberOfPages)}
			disabled={!canPreview}
			activeOpacity={0.7}
		>
			<View style={styles.documentCardHeader}>
				{number != null && (
					<>
						<View style={styles.numberBadge}>
							<Text style={styles.numberText}>{number}</Text>
						</View>
						<View style={styles.numberDivider} />
					</>
				)}
				<View style={styles.documentIconContainer}>
					<Feather name="file-text" size={22} color={colors.textSecondary} />
					<Text style={styles.extensionBadge}>{extension}</Text>
				</View>
				<View style={styles.documentInfo}>
					<Text style={styles.documentOriginalName}>{doc.file.name}</Text>
					<View style={{ flexDirection: "col", alignItems: "start" }}>
						<Text style={styles.documentFileSize}>
							{[
								doc.file.size != null && `${(doc.file.size / 1024).toFixed(2)} KB`,
								doc.file.numberOfPages != null &&
									`${doc.file.numberOfPages} ${doc.file.numberOfPages === 1 ? "page" : "pages"}`,
							]
								.filter(Boolean)
								.join(" · ")}
						</Text>
						{doc.status === "uploading" && (
							<Text style={styles.statusText}>
								{processing ? "Processing..." : `Uploading ${Math.round((doc.progress ?? 0) * 100)}%`}
							</Text>
						)}
						{(doc.status === "success" || doc.existing) && (
							<View style={styles.uploadedRow}>
								<Feather name="check-circle" size={12} color={colors.primary} />
								<Text style={[styles.statusText, { marginTop: 0 }]}>Uploaded</Text>
							</View>
						)}
					</View>
				</View>
				{doc.status === "uploading" ? (
					<View style={styles.actionsContainer}>
						<ActivityIndicator size="small" color={colors.primary} />
						{removeButton}
					</View>
				) : (
					removeButton
				)}
			</View>
			{/* Full-width row under the card so the reason and Retry don't squeeze the file name */}
			{doc.status === "failed" && (
				<View style={styles.failedRow}>
					<Feather name="alert-circle" size={14} color={colors.dangerDark} />
					<Text style={styles.failedText}>{doc.errorMessage || "Upload failed"}</Text>
					<TouchableOpacity
						style={styles.retryButton}
						onPress={() => onRetry?.(doc.id)}
						activeOpacity={0.7}
						hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
					>
						<Feather name="refresh-cw" size={14} color={colors.textPrimary} />
						<Text style={styles.retryButtonText}>Retry</Text>
					</TouchableOpacity>
				</View>
			)}
		</TouchableOpacity>
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
	numberBadge: {
		width: 22,
		height: 22,
		borderRadius: 11,
		borderWidth: 1,
		borderColor: colors.borderLight,
		justifyContent: "center",
		alignItems: "center",
	},
	numberText: {
		fontSize: 12,
		fontWeight: "700",
		color: colors.textSecondary,
	},
	numberDivider: {
		width: 1,
		alignSelf: "stretch",
		backgroundColor: colors.borderLight,
	},
	documentIconContainer: {
		width: 44,
		height: 44,
		borderRadius: 10,
		backgroundColor: colors.borderLight,
		justifyContent: "center",
		alignItems: "center",
	},
	documentsList: {
		gap: 12,
	},
	extensionBadge: {
		fontSize: 8,
		fontWeight: "800",
		color: colors.textSecondary,
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
	actionsContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	retryButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		height: 32,
		paddingHorizontal: 12,
		borderRadius: 8,
		backgroundColor: colors.borderLight,
	},
	retryButtonText: {
		fontSize: 13,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	removeCardButton: {
		width: 32,
		height: 32,
		borderRadius: 8,
		backgroundColor: "rgba(211, 47, 47, 0.1)",
		justifyContent: "center",
		alignItems: "center",
	},
	uploadedRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		marginTop: 2,
	},
	statusText: {
		fontSize: 12,
		fontWeight: "600",
		color: colors.primary,
		marginTop: 2,
	},
	failedRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: 12,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
	},
	failedText: {
		flex: 1,
		color: colors.dangerDark,
		fontSize: 12,
		fontWeight: "700",
	},
});
