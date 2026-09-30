//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../constants/colors";
import { useDraftQuery, useShopQuery } from "../hooks/queries";
import { useRetryStatus } from "../hooks/useRetryStatus";
import { createDraft, updateDraft } from "../services/drafts";
import { friendlyMessage } from "../utils/errors";
import { addUploads, clearScope, removeUpload, retryUpload, useUploads } from "../utils/uploadManager";
import { newObjectId } from "../utils/objectId";
import { takeSharedFiles } from "../utils/sharedFiles";
import DocumentCard from "./components/uploadDocument/DocumentCard";
import DocumentPreviewModal from "./components/uploadDocument/DocumentPreviewModal";

//----------------------------------- HELPERS -----------------------------------//

// An upload manager item (utils/uploadManager.js) in the shape DocumentCard
// and the rest of this screen use.
const uploadToDocument = (item) => ({
	id: item.id,
	file: {
		name: item.name,
		size: item.size,
		mimeType: item.mimeType,
		numberOfPages: item.file?.numberOfPages,
	},
	name: item.name.replace(/\.[^/.]+$/, "") || "Document",
	fileId: item.file?._id,
	// "processing" is the last stage of uploading (the server converting it).
	status: item.status === "processing" ? "uploading" : item.status,
	progress: item.status === "processing" ? 1 : item.progress,
	errorMessage: item.errorMessage,
});

//----------------------------------- COMPONENTS -----------------------------------//

const UploadDocument = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	// `share` is set by the service worker when a share brought no files
	// (see public/share-target.js).
	const { draftId, share, received, shopId } = useLocalSearchParams();
	// Files already in the draft (when resuming one), and files uploading in
	// this print job. Uploads live in the app-wide upload manager, so they keep
	// going when this screen closes and resume after a reload or restart.
	const [existingDocs, setExistingDocs] = useState([]);
	const scope = draftId ? `draft:${draftId}` : "new";
	const uploads = useUploads(scope);
	const [picking, setPicking] = useState(false);
	const [uploading, setUploading] = useState(false);

	const [error, setError] = useState(null);
	const [previewDoc, setPreviewDoc] = useState(null);

	// The id for a new draft is made once, so pressing Continue again after a
	// failure retries the same draft instead of creating another.
	const newDraftIdRef = useRef(null);
	const retry = useRetryStatus();

	// Resuming an existing draft: show its already-uploaded files. We only have
	// their names/ids (not the original bytes), which is enough to display them
	// and keep them in the draft unless the user removes or adds files. The
	// cached copy shows first, so this works offline too.
	const draftQuery = useDraftQuery(draftId || null);
	const savedDraft = draftQuery.data;
	const hydrating = !!draftId && draftQuery.isPending;
	const hydrated = useRef(false);
	useEffect(() => {
		if (!savedDraft || hydrated.current) return;
		hydrated.current = true;
		const docs = (savedDraft.files || []).map((f) => {
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
		// A split file appears once per segment; list it once.
		setExistingDocs(docs.filter((doc, i) => docs.findIndex((d) => d.id === doc.id) === i));
	}, [savedDraft]);
	useEffect(() => {
		if (draftId && draftQuery.isError && !savedDraft) {
			setError(friendlyMessage(draftQuery.error, "Failed to load the saved documents. Please try again."));
		}
	}, [draftId, draftQuery.isError, draftQuery.error, savedDraft]);

	// The shop this job is for: from the query param, or the draft's own shop.
	const draftShop = savedDraft?.shop;
	const attachedShopId = shopId || draftShop?._id || (typeof draftShop === "string" ? draftShop : null);
	const { data: fetchedShop } = useShopQuery(draftShop?.name && !shopId ? null : attachedShopId);
	const attachedShop = (draftShop?.name && !shopId ? draftShop : fetchedShop) || null;

	// Files shared from another app ("Share with ClickPrint") wait in the
	// service worker's cache until this screen opens; add and upload them.
	// Skipped when resuming a draft, whose hydration replaces the list.
	useEffect(() => {
		if (Platform.OS !== "web" || draftId) return;
		if (share === "failed") {
			setError("Couldn't receive the shared files. Try sharing them again, or pick them here instead.");
		} else if (share === "empty") {
			// TEMP: `received` shows what the share did contain, to debug on-device.
			setError(
				`No files came through with that share. Try sharing them again, or pick them here instead. (Received: ${received || "?"})`
			);
		}
		let active = true;
		takeSharedFiles()
			.then((files) => {
				if (!active || files.length === 0) return;
				addDocuments(
					files.map((file) => ({ name: file.name, mimeType: file.type, size: file.size, file }))
				);
			})
			.catch((err) => {
				console.error("Error loading shared files:", err);
				setError("Failed to load the shared documents. Please try again.");
			});
		return () => {
			active = false;
		};
	}, [draftId, share, received]);

	// Adds picked or shared files (DocumentPicker asset shape) and starts
	// uploading each one.
	const addDocuments = (files) => {
		addUploads(scope, files).catch((err) => {
			console.error("Error adding documents:", err);
			setError("Couldn't add those files. Please try again.");
		});
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

			if (!result.canceled) addDocuments(result.assets);
		} catch (err) {
			console.error("Error picking document:", err);
			setError("Failed to pick document. Please try again.");
		} finally {
			setPicking(false);
		}
	};

	const handleRetryDocument = (id) => retryUpload(id);

	const handleRemoveDocument = (id) => {
		if (existingDocs.some((d) => d.id === id)) {
			setExistingDocs((prev) => prev.filter((d) => d.id !== id));
		} else {
			removeUpload(id);
		}
	};

	// Everything shown on the screen, in the DocumentCard shape.
	const documents = [...existingDocs, ...uploads.map(uploadToDocument)];

	const handleContinue = async () => {
		setUploading(true);
		setError(null);
		try {
			const successfulDocs = documents.filter((d) => d.status === "success" || d.existing);
			const documentArray = successfulDocs.map((doc) => ({
				fileId: doc.fileId,
				name: doc.name || doc.file.name,
				numberOfPages: doc.file?.numberOfPages,
				size: doc.file?.size,
			}));

			const effectiveShopId = attachedShop?._id || shopId || null;
			let targetDraftId = draftId;
			// Both calls are safe to repeat (the new draft's id is made here), so
			// they retry on their own over a bad connection.
			if (draftId) {
				const files = successfulDocs.map((doc) => {
					const entry = { file: doc.fileId };
					if (doc.settings && Object.keys(doc.settings).length > 0) entry.settings = doc.settings;
					return entry;
				});
				await updateDraft(draftId, { files, ...(effectiveShopId && { shop: effectiveShopId }) }, { onRetry: retry.onRetry });
			} else {
				if (!newDraftIdRef.current) newDraftIdRef.current = newObjectId();
				const draft = await createDraft(
					{
						id: newDraftIdRef.current,
						files: documentArray.map((doc) => ({ file: doc.fileId })),
						...(effectiveShopId && { shop: effectiveShopId }),
					},
					{ onRetry: retry.onRetry }
				);
				targetDraftId = draft._id;
			}

			// The files are in the draft now; the upload list isn't needed.
			clearScope(scope);

			router.push({
				pathname: "/print-settings",
				params: {
					draftId: targetDraftId,
					documents: JSON.stringify(documentArray),
					...(effectiveShopId ? { shopId: effectiveShopId } : {}),
				},
			});
		} catch (err) {
			console.error("Error continuing:", err);
			setError(friendlyMessage(err, "Failed to continue. Please try again."));
		} finally {
			setUploading(false);
			retry.reset();
		}
	};

	const hasDocuments = documents.length > 0;
	const anyUploading = documents.some((d) => d.status === "uploading" || d.status === "waiting");
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

			{attachedShop && (
				<View style={styles.shopBanner}>
					<Feather name="map-pin" size={15} color={colors.primary} />
					<Text style={styles.shopBannerText} numberOfLines={1}>
						Printing at: <Text style={styles.shopBannerName}>{attachedShop.name}</Text>
					</Text>
				</View>
			)}
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
						<View style={styles.continueBusy}>
							<ActivityIndicator color={colors.activityIndicator} />
							{retry.label && <Text style={styles.continueButtonText}>{retry.label}</Text>}
						</View>
					) : (
						<Text style={canContinue ? styles.continueButtonText : { color: "darkgrey" }}>
							{anyUploading ? "Waiting for uploads…" : "Continue"}
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
	continueBusy: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
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
	shopBanner: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgba(0, 217, 163, 0.12)",
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(0, 217, 163, 0.25)",
		gap: 8,
	},
	shopBannerText: {
		fontSize: 13,
		color: colors.textSecondary,
		flex: 1,
	},
	shopBannerName: {
		fontWeight: "700",
		color: colors.textPrimary,
	},
});

export default UploadDocument;
