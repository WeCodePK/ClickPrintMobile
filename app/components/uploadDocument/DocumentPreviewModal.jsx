//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Platform,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../../../config/config";
import { colors } from "../../../constants/colors";
import SecureStore from "../../../utils/storage";

let WebView = null;
if (Platform.OS !== "web") {
	try {
		WebView = require("react-native-webview").WebView;
	} catch (err) {
		console.warn("react-native-webview load error:", err);
	}
}

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

// Web: file downloads need the auth header, so an iframe can't point at the
// API directly. Fetch the PDF version with the token and show it through an
// object URL, which the browser's built-in PDF viewer renders.
const WebPdfViewer = ({ fileId, fileName }) => {
	const [objectUrl, setObjectUrl] = useState(null);
	const [error, setError] = useState(null);

	useEffect(() => {
		let active = true;
		let url = null;
		setObjectUrl(null);
		setError(null);
		(async () => {
			try {
				const token = await SecureStore.getItemAsync("authToken");
				const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: "application/pdf",
					},
				});
				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
				const blob = await response.blob();
				if (!active) return;
				url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
				setObjectUrl(url);
			} catch (err) {
				console.error("Error loading preview:", err);
				if (active) setError("Couldn't load the preview. Please try again.");
			}
		})();
		return () => {
			active = false;
			if (url) URL.revokeObjectURL(url);
		};
	}, [fileId]);

	if (error) {
		return (
			<View style={styles.spinnerOverlay}>
				<Feather name="alert-circle" size={32} color={colors.printRequest} />
				<Text style={[styles.spinnerText, { color: colors.printRequest }]}>{error}</Text>
			</View>
		);
	}

	if (!objectUrl) {
		return (
			<View style={styles.spinnerOverlay}>
				<ActivityIndicator size="large" color={colors.primary} />
				<Text style={styles.spinnerText}>Loading document...</Text>
			</View>
		);
	}

	return (
		<iframe
			src={objectUrl}
			style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#121212" }}
			title={fileName || "Document Preview"}
		/>
	);
};

const DocumentPreviewModal = ({ visible, fileId, fileName, numberOfPages, onClose }) => {
	if (!visible || !fileId) return null;

	const fileUrl = `${API_BASE_URL}/files/${fileId}`;
	const googleDocsUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`;

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="fade"
			statusBarTranslucent={true}
			onRequestClose={onClose}
		>
			<View style={styles.modalBackdrop}>
				<SafeAreaView style={styles.container} edges={["top", "bottom"]}>
					{/* Header */}
					<View style={styles.header}>
						<View style={styles.headerLeft}>
							<View style={styles.fileIconBadge}>
								<Feather name="file-text" size={18} color={colors.primary} />
							</View>
							<View style={styles.titleWrapper}>
								<Text style={styles.headerTitle} numberOfLines={1}>
									{fileName || "Document Preview"}
								</Text>
								<Text style={styles.headerSubtitle}>
									{numberOfPages ? `${numberOfPages} ${numberOfPages === 1 ? "page" : "pages"}` : "PDF Preview"}
								</Text>
							</View>
						</View>
						<TouchableOpacity
							style={styles.closeButton}
							onPress={onClose}
							activeOpacity={0.7}
							hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
						>
							<Feather name="x" size={22} color="#FFFFFF" />
						</TouchableOpacity>
					</View>

					{/* Viewer Body */}
					<View style={styles.viewerContainer}>
						{Platform.OS === "web" ? (
							<WebPdfViewer fileId={fileId} fileName={fileName} />
						) : WebView ? (
							<WebView
								source={{ uri: googleDocsUrl }}
								style={styles.webView}
								startInLoadingState={true}
								renderLoading={() => (
									<View style={styles.spinnerOverlay}>
										<ActivityIndicator size="large" color={colors.primary} />
										<Text style={styles.spinnerText}>Loading document...</Text>
									</View>
								)}
							/>
						) : (
							<iframe
								src={googleDocsUrl}
								style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#121212" }}
								title={fileName || "Document Preview"}
							/>
						)}
					</View>
				</SafeAreaView>
			</View>
		</Modal>
	);
};

export default DocumentPreviewModal;

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	modalBackdrop: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.94)",
	},
	container: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#1A1A1A",
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
	},
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
		marginRight: 12,
	},
	fileIconBadge: {
		width: 36,
		height: 36,
		borderRadius: 10,
		backgroundColor: "rgba(0, 217, 163, 0.15)",
		justifyContent: "center",
		alignItems: "center",
		marginRight: 12,
	},
	titleWrapper: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	headerSubtitle: {
		fontSize: 12,
		color: "#8E8E93",
		marginTop: 2,
	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "rgba(255, 255, 255, 0.15)",
		justifyContent: "center",
		alignItems: "center",
	},
	viewerContainer: {
		flex: 1,
		backgroundColor: "#121212",
	},
	webView: {
		flex: 1,
		backgroundColor: "#121212",
	},
	spinnerOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "#121212",
		justifyContent: "center",
		alignItems: "center",
	},
	spinnerText: {
		color: colors.primary,
		marginTop: 12,
		fontSize: 14,
		fontWeight: "500",
	},
});
