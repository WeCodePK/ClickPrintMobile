//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";
import { uploadFile } from "../utils/fileUpload";
import SecureStore from "../utils/storage";
import DocumentCard from "./components/uploadDocument/DocumentCard";
import DocumentPreviewModal from "./components/uploadDocument/DocumentPreviewModal";

//----------------------------------- CONSTANTS ------------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

const UploadDocument = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { draftId } = useLocalSearchParams();
	const [documents, setDocuments] = useState([]);
	const [picking, setPicking] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [hydrating, setHydrating] = useState(!!draftId);
	const [error, setError] = useState(null);
	const [previewDoc, setPreviewDoc] = useState(null);
	// Abort handles for in-flight uploads, keyed by document id.
	const abortersRef = useRef({});

	// Stop in-flight uploads when leaving the screen.
	useEffect(() => {
		const aborters = abortersRef.current;
		return () => Object.values(aborters).forEach((abort) => abort());
	}, []);

	// Resuming an existing draft: pull the already-uploaded files from the
	// backend so they show up here. We only have their names/ids (not the
	// original bytes), which is enough to display them and keep them in the
	// draft unless the user removes or adds files.
	useEffect(() => {
		if (!draftId) return;
		let active = true;
		(async () => {
			try {
				const token = await SecureStore.getItemAsync("authToken");
				const response = await fetch(`${API_BASE_URL}/drafts/${draftId}`, {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});
				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
				const data = await response.json();
				const draft = data.data?.draft || null;
				if (!active || !draft) return;
				const existingDocs = (draft.files || []).map((f) => {
					const originalName = f.file?.name || "Document";
					const fileId = f.file?._id || f.file;
					return {
						id: fileId,
						// Synthetic file object so DocumentCard can show the name/extension/pages.
						file: { name: originalName, numberOfPages: f.file?.numberOfPages },
						name: originalName.replace(/\.[^/.]+$/, "") || "Document",
						fileId,
						settings: f.settings || {},
						existing: true,
						status: "idle",
					};
				});
				setDocuments(existingDocs);
			} catch (err) {
				console.error("Error loading draft files:", err);
				setError("Failed to load the saved documents. Please try again.");
			} finally {
				if (active) setHydrating(false);
			}
		})();
		return () => {
			active = false;
		};
	}, [draftId]);


	const updateDocument = (id, changes) => {
		setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d)));
	};

	// Uploads one picked document over tus, tracking progress on its card.
	// Failures stay on the card with the reason so the user can retry or remove.
	const startUpload = async (doc) => {
		updateDocument(doc.id, { status: "uploading", progress: 0, errorMessage: null });
		try {
			const token = await SecureStore.getItemAsync("authToken");
			let source;
			if (Platform.OS === "web") {
				source = doc.file.file || (await (await fetch(doc.file.uri)).blob());
			} else {
				source = { uri: doc.file.uri, name: doc.file.name, type: doc.file.mimeType };
			}

			const { promise, abort } = uploadFile(source, {
				name: doc.file.name,
				mimeType: doc.file.mimeType,
				token,
				onProgress: (progress) => updateDocument(doc.id, { progress }),
			});
			abortersRef.current[doc.id] = abort;

			const uploaded = await promise;
			console.log("Document uploaded successfully named ", doc.file.name, " with id ", uploaded._id);
			updateDocument(doc.id, {
				status: "success",
				fileId: uploaded._id,
				file: { ...doc.file, numberOfPages: uploaded.numberOfPages },
			});
		} catch (err) {
			console.log("error in uploading document named ", doc.file.name, ":", err.message);
			updateDocument(doc.id, { status: "failed", errorMessage: err.message || "Upload failed" });
		} finally {
			delete abortersRef.current[doc.id];
		}
	};

	const handleDocumentPick = async () => {
		try {
			setError(null);
			setPicking(true);

			// No type filter: the backend decides which formats it accepts.
			const result = await DocumentPicker.getDocumentAsync({
				copyToCacheDirectory: true,
				multiple: true,
			});

			if (!result.canceled) {
				const newDocs = result.assets.map((file) => ({
					id: Math.random().toString(),
					file,
					name: file.name ? file.name.replace(/\.[^/.]+$/, "") || "Document" : "Document",
					status: "uploading",
					progress: 0,
				}));
				setDocuments((prev) => [...prev, ...newDocs]);
				newDocs.forEach(startUpload);
			}
		} catch (err) {
			console.error("Error picking document:", err);
			setError("Failed to pick document. Please try again.");
		} finally {
			setPicking(false);
		}
	};

	const handleRetryDocument = (id) => {
		const doc = documents.find((d) => d.id === id);
		if (doc) startUpload(doc);
	};

	const handleRemoveDocument = (id) => {
		abortersRef.current[id]?.();
		delete abortersRef.current[id];
		setDocuments((prev) => prev.filter((d) => d.id !== id));
	};

	const handleContinue = async () => {
		setUploading(true);
		setError(null);
		try {
			const token = await SecureStore.getItemAsync("authToken");
			const successfulDocs = documents.filter((d) => d.status === "success" || d.existing);
			const documentArray = successfulDocs.map((doc) => ({ fileId: doc.fileId, name: doc.name || doc.file.name }));

			let targetDraftId = draftId;
			if (draftId) {
				const files = successfulDocs.map((doc) => {
					const entry = { file: doc.fileId };
					if (doc.settings && Object.keys(doc.settings).length > 0) entry.settings = doc.settings;
					return entry;
				});
				const updateResponse = await fetch(`${API_BASE_URL}/drafts/${draftId}`, {
					method: "PUT",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ files }),
				});
				const updateData = await updateResponse.json();
				if (!updateResponse.ok) {
					throw new Error(updateData.message || "Failed to update draft.");
				}
				console.log("Draft updated with files:", targetDraftId);
			} else {
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
				if (!draftResponse.ok) {
					throw new Error(draftData.message || "Failed to create draft.");
				}

				targetDraftId = draftData.data.draft._id;
				console.log("Draft created with ID:", targetDraftId);
			}

			router.push({
				pathname: "/print-settings",
				params: {
					draftId: targetDraftId,
					documents: JSON.stringify(documentArray),
				},
			});
		} catch (err) {
			console.error("Error continuing:", err);
			setError("Failed to continue. Please try again.");
		} finally {
			setUploading(false);
		}
	};

	const hasDocuments = documents.length > 0;
	const anyUploading = documents.some((d) => d.status === "uploading");
	const failedDocs = documents.filter((d) => d.status === "failed");
	// Continue waits for every upload to finish and for failed ones to be
	// retried or removed, so nothing is dropped from the draft silently.
	const canContinue = hasDocuments && !anyUploading && failedDocs.length === 0 && !uploading;

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.replace("/(tabs)/home")} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Upload Documents</Text>
				<View style={styles.placeholder} />
			</View>
			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
				<View style={styles.section}>

					{/* Loading saved draft files */}
					{hydrating && (
						<View style={[styles.uploadArea, styles.uploadAreaFilled]}>
							<ActivityIndicator size="large" color={colors.primary} />
							<Text style={styles.uploadLoadingText}>Loading your documents...</Text>
						</View>
					)}

					{/* Empty state - upload area */}
					{!hydrating && !hasDocuments && !picking && (
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

					{/* Derived from the list, so it stays accurate as files are retried, removed or added */}
					{failedDocs.length > 0 && (
						<View style={styles.errorBox}>
							<Feather name="alert-circle" size={18} color={colors.dangerDark} />
							<Text style={styles.errorText}>
								{failedDocs.length} document(s) failed to upload. Retry or remove them to continue.
							</Text>
						</View>
					)}

					{error && (
						<View style={styles.errorBox}>
							<Feather name="alert-circle" size={18} color={colors.dangerDark} />
							<Text style={styles.errorText}>{error}</Text>
						</View>
					)}

					{/* Document cards list */}
					{hasDocuments && (
						<View style={styles.documentsList}>
							{documents.map((doc, index) => (
								<DocumentCard
									key={doc.id}
									doc={doc}
									number={index + 1}
									onRemove={handleRemoveDocument}
									onRetry={handleRetryDocument}
									onPreview={(fileId, name, numberOfPages) =>
										setPreviewDoc({ fileId, name, numberOfPages })
									}
								/>
							))}
						</View>
					)}
				</View>

			</ScrollView>
			<View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
				<TouchableOpacity
					style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
					onPress={handleContinue}
					disabled={!canContinue}
				>
					{uploading ? (
						<ActivityIndicator color={colors.activityIndicator} />
					) : (
						<Text style={canContinue ? styles.continueButtonText : { color: "darkgrey" }}>
							{anyUploading ? "Uploading..." : "Continue"}
						</Text>
					)}
				</TouchableOpacity>

			</View>

			<DocumentPreviewModal
				visible={!!previewDoc}
				fileId={previewDoc?.fileId}
				fileName={previewDoc?.name}
				numberOfPages={previewDoc?.numberOfPages}
				onClose={() => setPreviewDoc(null)}
			/>
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
		paddingVertical: 10,
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
		marginBottom: 14,
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
		backgroundColor: "rgba(211, 47, 47, 0.1)",
		borderRadius: 12,
		padding: 12,
		marginBottom: 14,
		gap: 12,
	},
	errorText: {
		fontSize: 13,
		color: colors.dangerDark,
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
		backgroundColor: colors.primary,
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
