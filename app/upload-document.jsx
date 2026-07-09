//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import SecureStore from "../utils/storage";
import { useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";
import DocumentCard from "./components/uploadDocument/DocumentCard";

//----------------------------------- CONSTANTS ------------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

const UploadDocument = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [documents, setDocuments] = useState([]);
	const [picking, setPicking] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState(null);


	const handleDocumentPick = async () => {
		try {
			setError(null);
			setPicking(true);

			const result = await DocumentPicker.getDocumentAsync({
				type: [
					"application/pdf",
					"application/msword",
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					"application/vnd.ms-excel",
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					"text/plain",
					"image/jpeg",
					"image/png",
					"image/jpg",
				],
				copyToCacheDirectory: true,
				multiple: true,
			});

			if (!result.canceled) {
				const newDocs = result.assets.map((file) => ({
					file,
					name: file.name ? file.name.replace(/\.[^/.]+$/, "") || "Document" : "Document",
					status: "idle",
				}));
				setDocuments((prev) => [...prev, ...newDocs]);
				setError(null);
			}
		} catch (err) {
			console.error("Error picking document:", err);
			setError("Failed to pick document. Please try again.");
		} finally {
			setPicking(false);
		}
	};

	const handleRemoveDocument = (index) => {
		setDocuments((prev) => prev.filter((_, i) => i !== index));
	};

	const handleContinue = async () => {
		setUploading(true);
		setError(null);
		const failedDocs = [];
		const documentArray = [];
		const token = await SecureStore.getItemAsync("authToken");
		try {
			const uploadPromises = documents.map(async (doc, index) => {
				setDocuments((prev) => {
					const newDocs = [...prev];
					newDocs[index] = { ...newDocs[index], status: "uploading" };
					return newDocs;
				});

				const formData = new FormData();
				if (Platform.OS === "web") {
					// On web, FormData needs a real Blob/File. Appending the RN
					// { uri, name, type } object would serialize to "[object Object]".
					// expo-document-picker exposes the browser File on `.file`; fall
					// back to fetching the blob: URL if it isn't present.
					let filePart = doc.file.file;
					if (!filePart) {
						const res = await fetch(doc.file.uri);
						filePart = await res.blob();
					}
					formData.append("file", filePart, doc.file.name);
				} else {
					formData.append("file", {
						uri: doc.file.uri,
						name: doc.file.name,
						type: doc.file.mimeType,
					});
				}
				const fileId = await uploadDocument(formData, doc.file.name, token);

				if (fileId) {
					documentArray.push({ fileId, name: doc.name || doc.file.name });
					setDocuments((prev) => {
						const newDocs = [...prev];
						newDocs[index] = { ...newDocs[index], status: "success" };
						return newDocs;
					});
				} else {
					failedDocs.push(doc.file.name);
					setDocuments((prev) => {
						const newDocs = [...prev];
						newDocs[index] = { ...newDocs[index], status: "failed" };
						return newDocs;
					});
				}
			});

			await Promise.all(uploadPromises);

			if (failedDocs.length === 0) {
				// Wait 500ms to show the checkmarks before navigating
				await new Promise((resolve) => setTimeout(resolve, 500));

				// Create a draft with just the file IDs
				const draftFiles = documentArray.map((doc) => ({ file: doc.fileId }));
				const draftResponse = await fetch(`${API_BASE_URL}/drafts`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ files: draftFiles }),
				});
				const draftData = await draftResponse.json();

				if (draftResponse.status !== 201) {
					throw new Error(draftData.message || "Failed to create draft.");
				}

				const draftId = draftData.data.draft._id;
				console.log("Draft created with ID:", draftId);

				setDocuments([]);
				router.push({
					pathname: "/print-settings",
					params: {
						draftId,
						documents: JSON.stringify(documentArray),
					},
				});
			} else {
				setError(`${failedDocs.length} document(s) failed to upload: ${failedDocs.join(", ")}. Please try again.`);
			}
		} catch (err) {
			console.error("Error uploading documents:", err);
			setError("Failed to upload documents. Please try again.");
		} finally {
			setUploading(false);
		}
	};

	const uploadDocument = async (formData, fileName, token) => {
		try {
			const response = await fetch(`${API_BASE_URL}/files`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
				body: formData,
			});
			const body = await response.json();
			console.log(fileName, " : ", body);
			if (response.status === 201) {
				console.log("Document uploaded successfully named ", fileName, " with id ", body.data.file._id);
				return body.data.file._id;
			} else {
				console.log("error in uploading document named ", fileName, ":", body.message);
				return null;
			}
		} catch (err) {
			console.error("Network error uploading ", fileName, ":", err);
			return null;
		}
	};

	const hasDocuments = documents.length > 0;
	const allNamesValid = documents.every((d) => d.name.trim());

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Upload Documents</Text>
				<View style={styles.placeholder} />
			</View>
			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
				<View style={styles.section}>


					{/* Empty state - upload area */}
					{!hasDocuments && !picking && (
						<TouchableOpacity style={styles.uploadArea} onPress={handleDocumentPick}>
							<Feather name="upload-cloud" size={48} color={colors.primary} />
							<Text style={styles.uploadText}>Upload Your Documents</Text>
							<Text style={styles.uploadSubtext}>Tap to select PDF, Word, Excel, or Image files</Text>
						</TouchableOpacity>
					)}

					{/* Loading state - document picker only */}
					{picking && (
						<View style={[styles.uploadArea, styles.uploadAreaFilled]}>
							<ActivityIndicator size="large" color={colors.primary} />
							<Text style={styles.uploadLoadingText}>Processing...</Text>
						</View>
					)}

					{/* Add more files button */}
					{hasDocuments && !picking && (
						<TouchableOpacity style={styles.addMoreButton} onPress={handleDocumentPick}>
							<Feather name="plus-circle" size={20} color={colors.primary} />
							<Text style={styles.addMoreButtonText}>Add More Documents</Text>
						</TouchableOpacity>
					)}

					{/* Document cards list */}
					{hasDocuments && (
						<View style={styles.documentsList}>
							{documents.map((doc, index) => (
								<DocumentCard key={`${doc.file.uri}-${index}`} doc={doc} index={index} onRemove={handleRemoveDocument} />
							))}
						</View>
					)}

					{error && (
						<View style={styles.errorBox}>
							<Feather name="alert-circle" size={18} color={colors.printRequest} />
							<Text style={styles.errorText}>{error}</Text>
						</View>
					)}
				</View>

			</ScrollView>
			<View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
				<TouchableOpacity
					style={[styles.continueButton, (!hasDocuments || !allNamesValid || uploading) && styles.continueButtonDisabled]}
					onPress={handleContinue}
					disabled={!hasDocuments || !allNamesValid || uploading}
				>
					{uploading ? (
						<ActivityIndicator color={colors.activityIndicator} />
					) : (
						<Text
							style={
								!hasDocuments || !allNamesValid || uploading
									? { color: "darkgrey" }
									: styles.continueButtonText
							}
						>
							Upload
						</Text>
					)}
				</TouchableOpacity>

			</View>
		</SafeAreaView>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingVertical: 16,
		backgroundColor: colors.cardBackground,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	backButton: {
		width: 40,
		height: 40,
		justifyContent: "center",
		alignItems: "center",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	placeholder: {
		width: 40,
	},
	scrollView: {
		flex: 1,
		backgroundColor: colors.cardBackground,
	},
	scrollContent: {
		padding: 20,
		paddingBottom: 160,
	},
	section: {
		marginBottom: 28,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 16,
	},
	uploadArea: {
		borderWidth: 2,
		borderColor: colors.borderLight,
		borderStyle: "dashed",
		borderRadius: 16,
		padding: 32,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.background,
		minHeight: 200,
	},
	uploadAreaFilled: {
		borderColor: colors.primary,
		backgroundColor: "rgba(0, 217, 163, 0.05)",
	},
	uploadText: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.textPrimary,
		marginTop: 16,
		marginBottom: 8,
		textAlign: "center",
	},
	uploadSubtext: {
		fontSize: 14,
		color: colors.textSecondary,
		textAlign: "center",
		lineHeight: 20,
	},
	uploadLoadingText: {
		fontSize: 16,
		color: colors.textSecondary,
		marginTop: 16,
	},
	// Add more button
	addMoreButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 14,
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderWidth: 1.5,
		borderColor: colors.primary,
		borderRadius: 12,
		borderStyle: "dashed",
		backgroundColor: "rgba(0, 217, 163, 0.04)",
		gap: 8,
	},
	addMoreButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.primary,
	},

	errorBox: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: "rgba(255, 139, 123, 0.1)",
		borderRadius: 12,
		padding: 12,
		marginTop: 16,
		gap: 12,
	},
	errorText: {
		fontSize: 13,
		color: colors.printRequest,
		flex: 1,
		lineHeight: 18,
	},

	// Footer
	footer: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: colors.cardBackground,
		padding: 20,
		paddingBottom: 28,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
		shadowColor: colors.shadowMedium,
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 8,
		gap: 12,
	},
	continueButton: {
		backgroundColor: colors.printRequest,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 16,
		borderRadius: 12,
		gap: 8,
	},
	continueButtonDisabled: {
		backgroundColor: colors.borderLight,
		opacity: 0.6,
	},
	continueButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: "#f4efefff",
	},
});

export default UploadDocument;
