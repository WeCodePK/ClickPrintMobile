//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { loadPdfjs } from "../../../utils/loadPdfjs";
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

// Desktop browsers render PDFs in an iframe with their own viewer (zoom,
// download, print). Mobile browsers don't: Android Chrome shows an "Open"
// placeholder and iOS Safari only shows the first page, so those get pdf.js.
const hasInlinePdfViewer = () =>
	typeof navigator !== "undefined" &&
	navigator.pdfViewerEnabled === true &&
	!window.matchMedia?.("(pointer: coarse)").matches;

// Renders every page of the PDF onto canvases stacked in a scrollable column.
// Pages are appended as they finish so the first page shows up quickly.
const PdfJsPages = ({ data, onError }) => {
	const [container, setContainer] = useState(null);

	useEffect(() => {
		if (!container) return;
		let cancelled = false;
		let pdfDocument = null;
		(async () => {
			try {
				const pdfjs = await loadPdfjs();
				// pdf.js takes ownership of the buffer, so hand it a copy.
				pdfDocument = await pdfjs.getDocument({ data: data.slice(0), isEvalSupported: false }).promise;
				const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
				for (let i = 1; i <= pdfDocument.numPages && !cancelled; i++) {
					const page = await pdfDocument.getPage(i);
					const cssWidth = container.clientWidth - 24;
					const viewport = page.getViewport({ scale: cssWidth / page.getViewport({ scale: 1 }).width });
					const canvas = document.createElement("canvas");
					canvas.width = Math.floor(viewport.width * pixelRatio);
					canvas.height = Math.floor(viewport.height * pixelRatio);
					canvas.style.width = `${Math.floor(viewport.width)}px`;
					canvas.style.height = `${Math.floor(viewport.height)}px`;
					canvas.style.display = "block";
					canvas.style.margin = "0 auto 12px";
					canvas.style.backgroundColor = "#FFFFFF";
					await page.render({
						canvasContext: canvas.getContext("2d"),
						viewport,
						transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null,
					}).promise;
					if (cancelled) return;
					container.appendChild(canvas);
				}
			} catch (err) {
				console.error("Error rendering preview:", err);
				if (!cancelled) onError();
			}
		})();
		return () => {
			cancelled = true;
			pdfDocument?.destroy();
			container.replaceChildren();
		};
	}, [container, data, onError]);

	return (
		<div
			ref={setContainer}
			style={{ width: "100%", height: "100%", overflowY: "auto", padding: "12px 0", boxSizing: "border-box" }}
		/>
	);
};

// Web: file downloads need the auth header, so an iframe can't point at the
// API directly. Fetch the PDF version with the token, then show it through an
// object URL (desktop) or render it with pdf.js (mobile).
const WebPdfViewer = ({ fileId, fileName }) => {
	const [pdf, setPdf] = useState(null);
	const [error, setError] = useState(null);
	const [inlineViewer] = useState(hasInlinePdfViewer);
	const handleRenderError = useCallback(() => setError("Couldn't display the preview. Please try again."), []);

	useEffect(() => {
		let active = true;
		let url = null;
		setPdf(null);
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
				if (inlineViewer) {
					url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
					setPdf({ url });
				} else {
					const data = await blob.arrayBuffer();
					if (active) setPdf({ data });
				}
			} catch (err) {
				console.error("Error loading preview:", err);
				if (active) setError("Couldn't load the preview. Please try again.");
			}
		})();
		return () => {
			active = false;
			if (url) URL.revokeObjectURL(url);
		};
	}, [fileId, inlineViewer]);

	if (error) {
		return (
			<View style={styles.spinnerOverlay}>
				<Feather name="alert-circle" size={32} color={colors.dangerDark} />
				<Text style={[styles.spinnerText, { color: colors.dangerDark }]}>{error}</Text>
			</View>
		);
	}

	if (!pdf) {
		return (
			<View style={styles.spinnerOverlay}>
				<ActivityIndicator size="large" color={colors.primary} />
				<Text style={styles.spinnerText}>Loading document...</Text>
			</View>
		);
	}

	if (pdf.data) {
		return <PdfJsPages data={pdf.data} onError={handleRenderError} />;
	}

	return (
		<iframe
			src={pdf.url}
			style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#121212" }}
			title={fileName || "Document Preview"}
		/>
	);
};

// Web: the modal isn't a route, so the browser/phone back button would leave
// the upload screen entirely. While the modal is open, push a history entry
// (a copy of the router's current one, so expo-router still recognises it) and
// treat popping it as "close the preview".
const useWebBackToClose = (visible, onClose) => {
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		if (Platform.OS !== "web" || !visible) return;
		window.history.pushState({ ...window.history.state, previewModal: true }, "");
		const onPopState = () => onCloseRef.current?.();
		window.addEventListener("popstate", onPopState);
		return () => {
			window.removeEventListener("popstate", onPopState);
			// Closed another way (X button): drop our entry so back works normally.
			if (window.history.state?.previewModal) window.history.back();
		};
	}, [visible]);
};

const DocumentPreviewModal = ({ visible, fileId, fileName, numberOfPages, onClose }) => {
	useWebBackToClose(visible && !!fileId, onClose);

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
								<Text style={styles.headerTitle}>
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
