//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
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

// Dynamically resolve WebView on native platforms
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

//----------------------------------- HTML TEMPLATE -----------------------------------//

const generatePdfHtml = (pdfUrl, fileName) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=0.5, maximum-scale=5.0, user-scalable=yes">
  <title>${fileName ? fileName.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "Preview"}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      min-height: 100%;
      background-color: #121212;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #FFFFFF;
      overflow-x: auto;
    }
    #loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-top: 120px;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(0, 217, 163, 0.2);
      border-top-color: #00D9A3;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .loading-text {
      color: #00D9A3;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .loading-progress {
      color: #888888;
      font-size: 13px;
      margin-top: 6px;
    }
    #error-container {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 24px;
      text-align: center;
    }
    .error-title {
      color: #FF8B7B;
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .error-subtext {
      color: #A0A0A0;
      font-size: 13px;
      line-height: 1.4;
      margin-bottom: 20px;
      max-width: 280px;
    }
    .retry-btn {
      background: #00D9A3;
      color: #121212;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
    }
    #pages-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 14px 10px 40px 10px;
      gap: 16px;
    }
    .page-wrapper {
      position: relative;
      background: #FFFFFF;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
      border-radius: 4px;
      overflow: hidden;
      max-width: 100%;
    }
    canvas {
      display: block;
      max-width: 100%;
      height: auto !important;
    }
    .page-number {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.7);
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      backdrop-filter: blur(4px);
    }
  </style>
</head>
<body>
  <div id="loading-container">
    <div class="spinner"></div>
    <div class="loading-text">Loading Document Preview...</div>
    <div id="progress" class="loading-progress"></div>
  </div>

  <div id="error-container">
    <div class="error-title">Preview Unavailable</div>
    <div id="error-message" class="error-subtext">Could not load the document.</div>
    <button class="retry-btn" onclick="location.reload()">Retry</button>
  </div>

  <div id="pages-container"></div>

  <script>
    if (typeof pdfjsLib === 'undefined') {
      showError('Failed to load PDF viewer. Please check your internet connection.');
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      loadPdf();
    }

    function showError(msg) {
      document.getElementById('loading-container').style.display = 'none';
      const err = document.getElementById('error-container');
      err.style.display = 'flex';
      document.getElementById('error-message').innerText = msg;
    }

    async function loadPdf() {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: ${JSON.stringify(pdfUrl)},
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true
        });

        loadingTask.onProgress = function(p) {
          if (p.total > 0) {
            const percent = Math.round((p.loaded / p.total) * 100);
            document.getElementById('progress').innerText = percent + '%';
          }
        };

        const pdf = await loadingTask.promise;
        document.getElementById('loading-container').style.display = 'none';

        const container = document.getElementById('pages-container');

        for (let num = 1; num <= pdf.numPages; num++) {
          const page = await pdf.getPage(num);
          const unscaled = page.getViewport({ scale: 1.0 });
          const clientWidth = window.innerWidth || document.documentElement.clientWidth || 400;
          const targetWidth = Math.min(clientWidth - 20, 800);
          const scale = Math.max(targetWidth / unscaled.width, 1.5);
          const viewport = page.getViewport({ scale: scale });

          const wrapper = document.createElement('div');
          wrapper.className = 'page-wrapper';

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');

          wrapper.appendChild(canvas);

          if (pdf.numPages > 1) {
            const numEl = document.createElement('div');
            numEl.className = 'page-number';
            numEl.innerText = num + ' / ' + pdf.numPages;
            wrapper.appendChild(numEl);
          }

          container.appendChild(wrapper);

          await page.render({
            canvasContext: ctx,
            viewport: viewport
          }).promise;
        }
      } catch (err) {
        showError(err.message || 'Error rendering document.');
      }
    }
  </script>
</body>
</html>
`;

//----------------------------------- COMPONENTS -----------------------------------//

const DocumentPreviewModal = ({ visible, fileId, fileName, numberOfPages, onClose }) => {
	if (!visible || !fileId) return null;

	const fileUrl = `${API_BASE_URL}/files/${fileId}`;

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
							<iframe
								src={fileUrl}
								style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#121212" }}
								title={fileName || "Document Preview"}
							/>
						) : Platform.OS === "ios" && WebView ? (
							<WebView
								source={{ uri: fileUrl }}
								style={styles.webView}
								startInLoadingState={true}
								renderLoading={() => (
									<View style={styles.spinnerOverlay}>
										<ActivityIndicator size="large" color={colors.primary} />
										<Text style={styles.spinnerText}>Loading document...</Text>
									</View>
								)}
							/>
						) : WebView ? (
							<WebView
								source={{
									html: generatePdfHtml(fileUrl, fileName),
									baseUrl: API_BASE_URL,
								}}
								style={styles.webView}
								originWhitelist={["*"]}
								javaScriptEnabled={true}
								domStorageEnabled={true}
								allowFileAccess={true}
								allowUniversalAccessFromFileURLs={true}
								mixedContentMode="always"
								scalesPageToFit={true}
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
