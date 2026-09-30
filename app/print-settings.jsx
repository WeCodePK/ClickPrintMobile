//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../constants/colors";
import { useDraftQuery, useShopQuery } from "../hooks/queries";
import { useRetryStatus } from "../hooks/useRetryStatus";
import { checkDraft, updateDraft } from "../services/drafts";
import { showAlert } from "../utils/alert";
import { DEFAULT_SETTINGS, documentsFromDraft, segmentsArrayFromDraft } from "../utils/draft";
import { friendlyMessage } from "../utils/errors";
import { exceedsPageCount, findSplitOverlap } from "../utils/pageRanges";
import DocumentSettingsForm from "./components/printSettings/DocumentSettingsForm";

//----------------------------------- HELPERS -----------------------------------//

// A segment is complete when every required field is set and copies is a valid
// count. Split documents (>1 segment) additionally require an explicit page
// range on each segment.
const isSegmentComplete = (s, isSplit) => {
	if (!s || !s.color || !s.pageType || !s.orientation || !s.sidedness || !s.numberOfCopies) return false;
	const copies = parseInt(s.numberOfCopies);
	if (isNaN(copies) || copies < 1) return false;
	if (isSplit && !(s.pageSelection || "").trim()) return false;
	return true;
};

// First problem with a document's settings as { segmentIndex, title, message },
// or null when it's ready: an incomplete segment, a page range past the end of
// the file (when its page count is known), or two splits that share a page.
const findDocProblem = (segments, docIndex, pageCount) => {
	const isSplit = segments.length > 1;
	const docLabel = `document ${docIndex + 1}`;
	for (let j = 0; j < segments.length; j++) {
		const where = isSplit ? `split ${j + 1} of ${docLabel}` : docLabel;
		if (!isSegmentComplete(segments[j], isSplit)) {
			return {
				segmentIndex: j,
				title: "Incomplete Settings",
				message: `Please complete the settings (including page range) for ${where}.`,
			};
		}
		if (exceedsPageCount(segments[j].pageSelection, pageCount)) {
			return {
				segmentIndex: j,
				title: "Pages Out of Range",
				message: `The page range for ${where} goes past the end of the file, which only has ${pageCount} ${pageCount === 1 ? "page" : "pages"}.`,
			};
		}
	}
	const overlap = isSplit ? findSplitOverlap(segments) : null;
	if (overlap) {
		return {
			segmentIndex: overlap.second,
			title: "Overlapping Pages",
			message: `Split ${overlap.first + 1} and split ${overlap.second + 1} of ${docLabel} both include page ${overlap.page}. Each page can only be in one split.`,
		};
	}
	return null;
};

const isDocComplete = (segments, docIndex, pageCount) => !findDocProblem(segments, docIndex, pageCount);

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

	const tabsScrollViewRef = useRef(null);
	const tabLayoutsRef = useRef({});
	const tabsContainerWidthRef = useRef(0);

	// Auto-scroll the tabs ScrollView so the active document tab stays centered and visible in view
	useEffect(() => {
		const scrollToCurrentDoc = () => {
			const layout = tabLayoutsRef.current[currentDocIndex];
			if (layout && tabsScrollViewRef.current) {
				const containerWidth = tabsContainerWidthRef.current || 0;
				const targetX = Math.max(0, layout.x - (containerWidth - layout.width) / 2);
				tabsScrollViewRef.current.scrollTo({
					x: targetX,
					animated: true,
				});
			}
		};

		scrollToCurrentDoc();
		const timer = setTimeout(scrollToCurrentDoc, 60);
		return () => clearTimeout(timer);
	}, [currentDocIndex]);

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
	const [submitting, setSubmitting] = useState(false);
	const retry = useRetryStatus();

	// Restore files + settings from the saved draft so resuming (or coming back
	// from shop selection) shows exactly what was persisted last. The cached
	// copy shows first (offline too); a fresher one replaces it until the user
	// starts editing.
	const { data: savedDraft, isPending: draftPending } = useDraftQuery(draftId);
	const hydrating = !!draftId && draftPending;
	const userEdited = useRef(false);
	useEffect(() => {
		if (!savedDraft || userEdited.current) return;
		const docs = documentsFromDraft(savedDraft);
		if (docs.length > 0) {
			// Keep details the draft doesn't carry (e.g. the local file size
			// passed from the upload screen); draft values win when present.
			setParsedDocuments((prev) => docs.map((doc) => ({ ...prev.find((p) => p.fileId === doc.fileId), ...doc })));
			setAllSegments(segmentsArrayFromDraft(savedDraft));
			setCurrentDocIndex(0);
			setCurrentSegmentIndex(0);
		}
	}, [savedDraft]);

	const savedShop = savedDraft?.shop;
	const draftShopId = savedShop?._id || (typeof savedShop === "string" ? savedShop : null) || params.shopId || null;
	const { data: draftShop } = useShopQuery(savedShop?.name ? null : draftShopId);
	const shopName = savedShop?.name || draftShop?.name || null;

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
		userEdited.current = true;
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
		userEdited.current = true;
		setAllSegments((prev) => {
			const updated = prev.map((segs) => segs.slice());
			updated[currentDocIndex] = [...updated[currentDocIndex], newSegment(currentSegments[safeSegmentIndex])];
			return updated;
		});
		setCurrentSegmentIndex(currentSegments.length);
	};

	const handleRemoveSegment = (index) => {
		userEdited.current = true;
		setAllSegments((prev) => {
			const updated = prev.map((segs) => segs.slice());
			updated[currentDocIndex] = updated[currentDocIndex].filter((_, i) => i !== index);
			return updated;
		});
		setCurrentSegmentIndex((prev) => (prev >= index && prev > 0 ? prev - 1 : prev));
	};

	const isLastDocument = currentDocIndex >= numberOfDocuments - 1;

	const handleProceedToNext = () => {
		// Validate current document segments before moving forward
		const problem = findDocProblem(allSegments[currentDocIndex] || [], currentDocIndex, parsedDocuments[currentDocIndex]?.numberOfPages);
		if (problem) {
			setCurrentSegmentIndex(problem.segmentIndex);
			showAlert(problem.title, problem.message);
			return;
		}
		if (currentDocIndex < numberOfDocuments - 1) {
			setCurrentDocIndex((prev) => prev + 1);
			setCurrentSegmentIndex(0);
		}
	};

	//--------------------------------------- SUBMIT --------------------------------------//

	const handleContinue = () => {
		// Validate everything, jumping to the first offending document/segment.
		for (let d = 0; d < allSegments.length; d++) {
			const problem = findDocProblem(allSegments[d], d, parsedDocuments[d]?.numberOfPages);
			if (problem) {
				setCurrentDocIndex(d);
				setCurrentSegmentIndex(problem.segmentIndex);
				showAlert(problem.title, problem.message);
				return;
			}
		}
		navigateToShopDetails();
	};

	const navigateToShopDetails = async () => {
		// Flatten every document's segments into one backend file entry each; a
		// split file becomes several entries sharing the same file id.
		try {
			setSubmitting(true);
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

			// Saving and pricing are both safe to repeat, so they retry on their own.
			await updateDraft(
				draftId,
				{ files, ...(draftShopId && { shop: draftShopId }) },
				{ onRetry: retry.onRetry }
			);

			if (draftShopId) {
				const checked = await checkDraft(draftId, { onRetry: retry.onRetry });
				router.push({ pathname: "/draft-details", params: { draftId: checked._id } });
				return;
			}

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
			showAlert("Couldn't save settings", friendlyMessage(err, "Failed to save settings. Please try again."));
		} finally {
			setSubmitting(false);
			retry.reset();
		}
	};

	// Back returns to the upload screen (which repopulates the draft's files).
	const handleBack = () => {
		if (draftId) {
			router.replace({ pathname: "/upload-document", params: { draftId, ...(draftShopId ? { shopId: draftShopId } : {}) } });
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

			{shopName && (
				<View style={styles.shopBanner}>
					<Feather name="map-pin" size={14} color={colors.primary} />
					<Text style={styles.shopBannerText} numberOfLines={1}>
						Printing at: <Text style={styles.shopBannerName}>{shopName}</Text>
					</Text>
				</View>
			)}

			{/* Document tabs — direct access to each file, with a completeness dot.
			    Only shown when there's more than one document. */}
			{numberOfDocuments > 1 && !hydrating && (
				<View
					style={styles.tabsWrapper}
					onLayout={(e) => {
						tabsContainerWidthRef.current = e.nativeEvent.layout.width;
					}}
				>
					<ScrollView
						ref={tabsScrollViewRef}
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.tabsContent}
					>
						{parsedDocuments.map((doc, index) => {
							const active = index === currentDocIndex;
							const complete = isDocComplete(allSegments[index] || [], index, doc.numberOfPages);
							const segCount = (allSegments[index] || []).length;
							return (
								<TouchableOpacity
									key={doc.fileId || index}
									style={[styles.tab, active && styles.tabActive]}
									onPress={() => handleSelectDocument(index)}
									onLayout={(e) => {
										tabLayoutsRef.current[index] = e.nativeEvent.layout;
									}}
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
					numberOfPages={currentDoc.numberOfPages}
					fileSize={currentDoc.size}
					settings={currentSegments[safeSegmentIndex]}
					onSettingsChange={handleSettingsChange}
					segments={currentSegments}
					currentSegmentIndex={safeSegmentIndex}
					onSelectSegment={handleSelectSegment}
					onAddSegment={handleAddSegment}
					onRemoveSegment={handleRemoveSegment}
					isSplit={isSplit}
					onContinue={isLastDocument ? handleContinue : handleProceedToNext}
					continueText={isLastDocument ? "Review and continue" : "Proceed to next document"}
					loading={submitting}
					loadingText={retry.label}
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
	tabsWrapper: {
		backgroundColor: colors.cardBackground,
	},
	// No bottom padding: with no divider, the form's own top padding spaces the file card
	tabsContent: {
		paddingHorizontal: 16,
		paddingTop: 12,
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

export default PrintSettings;
