//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import {
	ActivityIndicator,
	Dimensions,
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

// Dynamically resolve native PDF and WebView modules
let Pdf = null;
let WebView = null;

if (Platform.OS !== "web") {
	try {
		const pdfModule = require("react-native-pdf");
		Pdf = pdfModule?.default || pdfModule;
	} catch (err) {
		console.warn("react-native-pdf load error:", err);
	}

	try {
		WebView = require("react-native-webview").WebView;
	} catch (err) {
		console.warn("react-native-webview load error:", err);
	}
}

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

const DocumentPreviewModal = ({ visible, fileId, fileName, numberOfPages, onClose }) => {
	const [useFallbackViewer, setUseFallbackViewer] = useState(false);
	const [pageCount, setPageCount] = useState(numberOfPages);

	if (!visible || !fileId) return null;

	const fileUrl = `${API_BASE_URL}/files/${fileId}`;
	const displayedPages = pageCount || numberOfPages;

	const handleClose = () => {
		setUseFallbackViewer(false);
		onClose();
	};

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="fade"
			statusBarTranslucent={true}
			onRequestClose={handleClose}
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
									{displayedPages ? `${displayedPages} ${displayedPages === 1 ? "page" : "pages"}` : "PDF Preview"}
								</Text>
							</View>
						</View>
						<TouchableOpacity
							style={styles.closeButton}
							onPress={handleClose}
							activeOpacity={0.7}
							hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
						>
							<Feather name="x" size={22} color="#FFFFFF" />
						</TouchableOpacity>
					</View>

					{/* Viewer Body */}
					<View style={styles.viewerContainer}>
						{Platform.OS === "web" ? (
							<iframe
								src={fileUrl}
								style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#121212" }}
								title={fileName || "Document Preview"}
							/>
						) : Pdf && !useFallbackViewer ? (
							<Pdf
								source={{ uri: fileUrl, cache: true }}
								style={styles.pdfView}
								trustAllCerts={false}
								onLoadComplete={(numPages) => {
									if (numPages) setPageCount(numPages);
								}}
								onError={(error) => {
									console.warn("react-native-pdf render error, falling back to embedded viewer:", error);
									setUseFallbackViewer(true);
								}}
								renderActivityIndicator={() => (
									<View style={styles.spinnerOverlay}>
										<ActivityIndicator size="large" color={colors.primary} />
										<Text style={styles.spinnerText}>Loading document...</Text>
									</View>
								)}
							/>
						) : WebView ? (
							<WebView
								source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}` }}
								style={styles.webView}
								startInLoadingState={true}
								renderLoading={() => (
									<View style={styles.spinnerOverlay}>
										<ActivityIndicator size="large" color={colors.primary} />
										<Text style={styles.spinnerText}>Loading document...</Text>
									</View>
								)}
							/>
						) : null}
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
	pdfView: {
		flex: 1,
		width: Dimensions.get("window").width,
		height: Dimensions.get("window").height,
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
