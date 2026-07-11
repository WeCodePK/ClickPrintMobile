//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import SecureStore from "../utils/storage";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { showAlert } from "../utils/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";
import { fetchDraft } from "../services/fetchDraft";
import { DEFAULT_SETTINGS, documentsFromDraft, segmentsArrayFromDraft } from "../utils/draft";
import DocumentSettingsForm from "./components/printSettings/DocumentSettingsForm";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- HELPERS -----------------------------------//

// A segment is complete when every required field is set and copies is a valid
// count. Split documents (>1 segment) additionally require an explicit page
// range on each segment so their ranges don't overlap or leave gaps.
const isSegmentComplete = (s, isSplit) => {
	if (!s || !s.color || !s.pageType || !s.orientation || !s.sidedness || !s.numberOfCopies) return false;
	const copies = parseInt(s.numberOfCopies);
	if (isNaN(copies) || copies < 1) return false;
	if (isSplit && !(s.pageSelection || "").trim()) return false;
	return true;
};

const isDocComplete = (segments) => {
	const isSplit = segments.length > 1;
	return segments.every((s) => isSegmentComplete(s, isSplit));
};

const newSegment = (from) => ({ ...(from || DEFAULT_SETTINGS), pageSelection: "" });

//----------------------------------- COMPONENTS -----------------------------------//

const PrintSettings = () => {
	const router = useRouter();
	const params = useLocalSearchParams();

	const { documents, draftId } = params;

	const [parsedDocuments, setParsedDocuments] = useState(() => {
		try {
			return JSON.parse(documents || "[]");
		} catch (e) {
			console.error("Failed to parse documents param:", e);
			return [];
		}
	});
	const numberOfDocuments = parsedDocuments.length || 1;

	const [currentDocIndex, setCurrentDocIndex] = useState(0);
	const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

	// allSegments[docIndex] is an array of segments (page-range groups); each
	// segment is a full settings object. A document with no split is just one
	// segment covering all pages.
	const [allSegments, setAllSegments] = useState(() => {
		try {
			const parsed = JSON.parse(params.allSettings || "[]");
			if (parsed.length > 0) return parsed;
		} catch (e) {
			console.error("Failed to parse allSettings param:", e);
		}
		return Array.from({ length: parsedDocuments.length || 1 }, () => [{ ...DEFAULT_SETTINGS }]);
	});
	const [hydrating, setHydrating] = useState(!!draftId);

	// Restore files + settings from the saved draft so resuming (or coming back
	// from shop selection) shows exactly what was persisted last.
	useEffect(() => {
		if (!draftId) return;
		let active = true;
		(async () => {
			try {
				const draft = await fetchDraft(draftId);
				if (!active || !draft) return;
				const docs = documentsFromDraft(draft);
				if (docs.length > 0) {
					setParsedDocuments(docs);
					setAllSegments(segmentsArrayFromDraft(draft));
					setCurrentDocIndex(0);
					setCurrentSegmentIndex(0);
				}
			} catch (e) {
				console.error("Error loading draft settings:", e);
			} finally {
				if (active) setHydrating(false);
			}
		})();
		return () => {
			active = false;
		};
	}, [draftId]);

	useEffect(() => {
		if (!draftId && parsedDocuments.length === 0) {
			showAlert("Error", "Missing required document information.");
			router.replace("/(tabs)/home");
		}
	}, [router, draftId, parsedDocuments.length]);

	const currentSegments = allSegments[currentDocIndex] || [{ ...DEFAULT_SETTINGS }];
	const safeSegmentIndex = Math.min(currentSegmentIndex, currentSegments.length - 1);
	const isSplit = currentSegments.length > 1;

	//----------------------------------- SETTINGS MUTATIONS -----------------------------------//

	const handleSettingsChange = (field, value) => {
		setAllSegments((prev) => {
			const updated = prev.map((segs) => segs.slice());
			const seg = updated[currentDocIndex][safeSegmentIndex];
			updated[currentDocIndex][safeSegmentIndex] = { ...seg, [field]: value };
			return updated;
		});
	};

	const handleSelectDocument = (index) => {
		setCurrentDocIndex(index);
		setCurrentSegmentIndex(0);
	};

	const handleSelectSegment = (index) => {
		setCurrentSegmentIndex(index);
	};

	// Adds a page-range group seeded from the active segment's settings (so only
	// the range and the fields you want to differ need changing).
	const handleAddSegment = () => {
		setAllSegments((prev) => {
			const updated = prev.map((segs) => segs.slice());
			updated[currentDocIndex] = [...updated[currentDocIndex], newSegment(currentSegments[safeSegmentIndex])];
			return updated;
		});
		setCurrentSegmentIndex(currentSegments.length);
	};

	const handleRemoveSegment = (index) => {
		setAllSegments((prev) => {
			const updated = prev.map((segs) => segs.slice());
			updated[currentDocIndex] = updated[currentDocIndex].filter((_, i) => i !== index);
			return updated;
		});
		setCurrentSegmentIndex((prev) => (prev >= index && prev > 0 ? prev - 1 : prev));
	};

	// Copies the current document's segments (page ranges + settings) onto every
	// document, so identical assignments only need configuring once.
	const handleCopyToAll = () => {
		if (numberOfDocuments <= 1) return;
		showAlert("Copy to all documents", `Apply these settings to all ${numberOfDocuments} documents? This replaces their current settings.`, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Apply",
				onPress: () => {
					const template = currentSegments.map((s) => ({ ...s }));
					setAllSegments(Array.from({ length: numberOfDocuments }, () => template.map((s) => ({ ...s }))));
				},
			},
		]);
	};

	//--------------------------------------- SUBMIT --------------------------------------//

	const handleContinue = () => {
		// Validate everything, jumping to the first offending document/segment.
		for (let d = 0; d < allSegments.length; d++) {
			const segs = allSegments[d];
			const split = segs.length > 1;
			for (let j = 0; j < segs.length; j++) {
				if (!isSegmentComplete(segs[j], split)) {
					setCurrentDocIndex(d);
					setCurrentSegmentIndex(j);
					const where = split ? `part ${j + 1} of document ${d + 1}` : `document ${d + 1}`;
					showAlert("Incomplete Settings", `Please complete the settings (including page range) for ${where}.`);
					return;
				}
			}
		}
		navigateToShopDetails();
	};

	const navigateToShopDetails = async () => {
		// Flatten every document's segments into one backend file entry each; a
		// split file becomes several entries sharing the same file id.
		try {
			const token = await SecureStore.getItemAsync("authToken");
			const files = [];
			allSegments.forEach((segs, docIndex) => {
				segs.forEach((s) => {
					files.push({
						file: parsedDocuments[docIndex].fileId,
						settings: {
							color: s.color === "color",
							pageType: s.pageType,
							orientation: s.orientation,
							pagesPerSheet: s.pagesPerSheet,
							sidedness: s.sidedness,
							numberOfCopies: parseInt(s.numberOfCopies),
							pageSelection: s.pageSelection || "",
						},
					});
				});
			});

			const response = await fetch(`${API_BASE_URL}/drafts/${draftId}`, {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ files }),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.message || "Failed to save settings.");
			}

			console.log("Draft updated with settings:", data);

			router.push({
				pathname: "/shop-details",
				params: {
					draftId,
					documents: JSON.stringify(parsedDocuments),
					allSettings: JSON.stringify(allSegments),
				},
			});
		} catch (err) {
			console.error("Error updating draft with settings:", err);
			showAlert("Error", err.message || "Failed to save settings. Please try again.");
		}
	};

	// Back returns to the upload screen (which repopulates the draft's files).
	const handleBack = () => {
		if (draftId) {
			router.replace({ pathname: "/upload-document", params: { draftId } });
		} else {
			router.replace("/(tabs)/home");
		}
	};

	//----------------------------------- RENDER -----------------------------------//

	const currentDoc = parsedDocuments[currentDocIndex] || { name: "Document" };

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={handleBack} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Print Settings</Text>
				<View style={styles.placeholder} />
			</View>

			{/* Document tabs — direct access to each file, with a completeness dot.
			    Only shown when there's more than one document. */}
			{numberOfDocuments > 1 && !hydrating && (
				<View style={styles.tabsWrapper}>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.tabsContent}
					>
						{parsedDocuments.map((doc, index) => {
							const active = index === currentDocIndex;
							const complete = isDocComplete(allSegments[index] || []);
							const segCount = (allSegments[index] || []).length;
							return (
								<TouchableOpacity
									key={doc.fileId || index}
									style={[styles.tab, active && styles.tabActive]}
									onPress={() => handleSelectDocument(index)}
									activeOpacity={0.8}
								>
									<View style={[styles.tabDot, complete ? styles.tabDotComplete : styles.tabDotPending]} />
									<Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
										{doc.name}
									</Text>
									{segCount > 1 && (
										<View style={styles.tabBadge}>
											<Text style={styles.tabBadgeText}>{segCount}</Text>
										</View>
									)}
								</TouchableOpacity>
							);
						})}
					</ScrollView>
				</View>
			)}

			{hydrating ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={styles.loadingText}>Loading settings...</Text>
				</View>
			) : (
				<DocumentSettingsForm
					key={`${currentDocIndex}-${safeSegmentIndex}`}
					documentName={currentDoc.name}
					settings={currentSegments[safeSegmentIndex]}
					onSettingsChange={handleSettingsChange}
					segments={currentSegments}
					currentSegmentIndex={safeSegmentIndex}
					onSelectSegment={handleSelectSegment}
					onAddSegment={handleAddSegment}
					onRemoveSegment={handleRemoveSegment}
					isSplit={isSplit}
					showCopyToAll={numberOfDocuments > 1}
					onCopyToAll={handleCopyToAll}
					onContinue={handleContinue}
					loading={false}
					error={null}
				/>
			)}
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
	tabsWrapper: {
		backgroundColor: colors.cardBackground,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	tabsContent: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		gap: 8,
	},
	tab: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: colors.borderLight,
		backgroundColor: colors.background,
		maxWidth: 180,
	},
	tabActive: {
		borderColor: colors.printRequest,
		backgroundColor: "rgba(255, 139, 123, 0.08)",
	},
	tabDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	tabDotComplete: {
		backgroundColor: colors.primary,
	},
	tabDotPending: {
		backgroundColor: colors.navInactive,
	},
	tabText: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
		flexShrink: 1,
	},
	tabTextActive: {
		color: colors.printRequest,
	},
	tabBadge: {
		minWidth: 18,
		height: 18,
		borderRadius: 9,
		paddingHorizontal: 5,
		backgroundColor: colors.printRequest,
		justifyContent: "center",
		alignItems: "center",
	},
	tabBadgeText: {
		fontSize: 10,
		fontWeight: "800",
		color: colors.cardBackground,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.cardBackground,
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: colors.textSecondary,
	},
});

export default PrintSettings;
