//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useState, useRef, useEffect } from "react";
import { ActivityIndicator, Dimensions, Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import { colors } from "../../../constants/colors";
import DropdownRow, { DROPDOWN_WIDTH } from "./DropdownRow";
import { defaultDuplexFor } from "../../../utils/draft";
import { exceedsPageCount, firstSharedPage } from "../../../utils/pageRanges";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const KEYBOARD_EXTRA_OFFSET = 20;



// Comma-separated pages and ranges; a range may be open-ended ("2-" = page 2 to the end).
const PAGE_RANGE_REGEX = /^(\d+(-\d*)?)(,\s*\d+(-\d*)?)*$/;

const isValidAdvancedRange = (value) => {
	if (!value || !PAGE_RANGE_REGEX.test(value.trim())) return false;
	const segments = value.trim().split(/,\s*/);
	for (const seg of segments) {
		if (seg.includes("-")) {
			const [start, end] = seg.split("-");
			const a = Number(start);
			if (a < 1) return false;
			if (end !== "" && Number(end) < a) return false;
		} else {
			if (Number(seg) < 1) return false;
		}
	}
	return true;
};

const PAGES_PER_SHEET_OPTIONS = [1, 2, 4, 6, 9, 16].map((n) => ({ label: String(n), value: n }));

const COLOR_OPTIONS = [
	{ label: "Black & White", value: "bw" },
	{ label: "Color", value: "color" },
];

const ORIENTATION_OPTIONS = [
	{ label: "Portrait", value: "portrait" },
	{ label: "Landscape", value: "landscape" },
];

// The backend's single `sidedness` field ("none" | "long" | "short") is shown as
// two controls: Print Sides (single/double) and, when double, the Duplex edge.
const PRINT_SIDES_OPTIONS = [
	{ label: "Double", value: "double" },
	{ label: "Single", value: "single" },
];

const DUPLEX_OPTIONS = [
	{ label: "Flip on Long Edge", value: "long" },
	{ label: "Flip on Short Edge", value: "short" },
];

const PAGE_SIZE_OPTIONS = [
	{ label: "A4", value: "A4" },
	{ label: "A3", value: "A3" },
];

const PAGE_RANGE_OPTIONS = [
	{ label: "All Pages", value: "all" },
	{ label: "Custom Range", value: "custom" },
];

// Short human label for a split's page range, e.g. "1" -> "Page 1",
// "2-" -> "Pages 2–end", "2-5" -> "Pages 2–5"; empty when no range is set.
const formatPageRange = (value) => {
	const v = (value || "").trim();
	if (!v) return "";
	const simple = /^(\d+)-(\d*)$/.exec(v);
	if (simple) {
		const [, start, end] = simple;
		if (!end) return `Pages ${start}–end`;
		return `Pages ${start}–${end}`;
	}
	if (/^\d+$/.test(v)) return `Page ${v}`;
	return `Pages ${v}`;
};

// Bytes -> "820 KB" / "2.4 MB".
const formatFileSize = (bytes) => {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

//----------------------------------- COMPONENT -----------------------------------//

const DocumentSettingsForm = ({
	documentName,
	numberOfPages,
	fileSize,
	settings,
	onSettingsChange,
	segments = [],
	currentSegmentIndex = 0,
	onSelectSegment,
	onAddSegment,
	onRemoveSegment,
	isSplit = false,
	showCopyToAll = false,
	onCopyToAll,
	onContinue,
	continueText,
	loading,
	error,
}) => {
	const extension = documentName.includes(".") ? documentName.split(".").pop().toUpperCase() : "FILE";
	// "12 pages · 2.4 MB" — each part only when known (the backend doesn't send size yet)
	const documentMeta = [
		numberOfPages != null && `${numberOfPages} ${numberOfPages === 1 ? "page" : "pages"}`,
		fileSize != null && formatFileSize(fileSize),
	]
		.filter(Boolean)
		.join(" · ");
	// Restore the page-range input from a saved selection.
	const initialPageSelection = (settings.pageSelection || "").trim();
	// When the document is split, each segment must name an explicit range, so the
	// custom range input is always shown (no "All" option).
	const [pageRange, setPageRange] = useState(initialPageSelection || isSplit ? "custom" : "all");
	const [rangeInput, setRangeInput] = useState(initialPageSelection);
	const [isRangeValid, setIsRangeValid] = useState(isValidAdvancedRange(initialPageSelection));
	const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
	const [keyboardOffset, setKeyboardOffset] = useState(0);
	const [footerHeight, setFooterHeight] = useState(140);
	const insets = useSafeAreaInsets();

	const scrollViewRef = useRef(null);
	const rangeInputRef = useRef(null);
	const activeInputRef = useRef(null);
	const scrollOffsetRef = useRef(0);

	const scrollInputIntoView = (ref, keyboardHeight) => {
		if (!ref?.current || !scrollViewRef.current) return;
		ref.current.measure((x, y, width, height, pageX, pageY) => {
			const windowHeight = Dimensions.get("window").height;
			const visibleBottom = windowHeight - keyboardHeight - footerHeight;
			const overflow = pageY + height - visibleBottom;
			if (overflow > 0) {
				scrollViewRef.current.scrollTo({ y: scrollOffsetRef.current + overflow, animated: true });
			}
		});
	};

	useEffect(() => {
		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

		const showSub = Keyboard.addListener(showEvent, (e) => {
			setKeyboardOffset(e.endCoordinates.height + KEYBOARD_EXTRA_OFFSET);
		});
		const hideSub = Keyboard.addListener(hideEvent, () => {
			setKeyboardOffset(0);
		});

		return () => {
			showSub.remove();
			hideSub.remove();
		};
	}, []);

	// Wait a tick after the content grows extra bottom padding (below) before
	// measuring/scrolling, otherwise the ScrollView clamps to its old (shorter) scroll range.
	useEffect(() => {
		if (keyboardOffset > 0 && activeInputRef.current) {
			const id = setTimeout(() => {
				scrollInputIntoView(activeInputRef.current, keyboardOffset);
			}, 50);
			return () => clearTimeout(id);
		}
	}, [keyboardOffset]);

	const colorMode = settings.color;
	const orientation = settings.orientation;
	const sidedness = settings.sidedness;
	const pageSize = settings.pageType;
	const pagesPerSheet = settings.pagesPerSheet;
	const numberOfCopies = settings.numberOfCopies;

	const isDoubleSided = sidedness !== "none";
	const duplexOverride = settings.duplexOverride ?? null;
	// The flip edge follows the orientation unless the user picked one explicitly.
	// Shown (greyed out) even when single-sided, as a preview of what Double would use.
	const duplexEdge = duplexOverride ?? defaultDuplexFor(orientation);

	//----------------------------------- HANDLERS -----------------------------------//

	const handlePageRangeChange = (value) => {
		setPageRange(value);
		if (value === "custom") {
			// Auto-focus the page range input after the dropdown closes and the input renders
			setTimeout(() => {
				focusInput(rangeInputRef);
			}, 300);
			return;
		}
		setRangeInput("");
		setIsRangeValid(false);
		onSettingsChange("pageSelection", "");
	};

	const handleRangeInputChange = (value) => {
		setRangeInput(value);
		const valid = isValidAdvancedRange(value);
		setIsRangeValid(valid);
		if (valid) {
			onSettingsChange("pageSelection", value.trim());
		}
	};


	const focusInput = (ref) => {
		setTimeout(() => {
			if (ref.current) {
				ref.current.focus();
			}
		}, 150);
	};

	const handleInputFocus = (event, ref) => {
		activeInputRef.current = ref;
		if (keyboardOffset > 0) {
			scrollInputIntoView(ref, keyboardOffset);
		}
	};

	const rangeBeyondEnd = isRangeValid && exceedsPageCount(rangeInput, numberOfPages);

	// When split, the first other split that shares a page with this one's range
	const rangeOverlap = (() => {
		if (!isSplit || !isRangeValid) return null;
		for (let i = 0; i < segments.length; i++) {
			if (i === currentSegmentIndex) continue;
			const page = firstSharedPage(rangeInput, segments[i].pageSelection);
			if (page !== null) return { splitIndex: i, page };
		}
		return null;
	})();

	const handlePrintSidesChange = (value) => {
		onSettingsChange("sidedness", value === "double" ? duplexEdge : "none");
	};

	const handleDuplexChange = (value) => {
		onSettingsChange("duplexOverride", value);
		onSettingsChange("sidedness", value);
	};

	const handleOrientationChange = (value) => {
		onSettingsChange("orientation", value);
		// Keep the flip edge in step with the orientation until the user overrides it
		if (isDoubleSided && !duplexOverride) {
			onSettingsChange("sidedness", defaultDuplexFor(value));
		}
	};

	const handleCopiesChange = (delta) => {
		const currentCopies = parseInt(numberOfCopies) || 1;
		const newCopies = Math.max(1, currentCopies + delta);
		onSettingsChange("numberOfCopies", newCopies.toString());
	};

	const isActionDisabled = () => {
		if (loading) return true;
		if (pageRange === "custom") return !isRangeValid;
		if (!colorMode || !orientation || !sidedness || !pageRange || !numberOfCopies || !pageSize) {
			return true;
		}
		return false;
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<View style={styles.container}>
			<ScrollView
				ref={scrollViewRef}
				style={styles.scrollView}
				contentContainerStyle={[styles.scrollContent, { paddingBottom: footerHeight + 10 + keyboardOffset }]}
				keyboardShouldPersistTaps="handled"
				onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
				scrollEventThrottle={16}
			>
				{/* Document Card */}
				<View style={styles.documentCard}>
					<View style={styles.documentIconContainer}>
						<Feather name="file-text" size={22} color={colors.primary} />
						<Text style={styles.extensionBadge}>{extension}</Text>
					</View>
					<View style={styles.documentInfo}>
						<Text style={styles.documentName} numberOfLines={2}>{documentName}</Text>
						{documentMeta.length > 0 && <Text style={styles.documentMeta}>{documentMeta}</Text>}
					</View>
				</View>

				{/* Page-range segments: split a single file so different pages print
				    with different settings (e.g. page 1 in color, the rest B&W). */}
				<View style={styles.segmentSection}>
					<View style={styles.segmentHeader}>
						<View style={styles.segmentHeaderText}>
							<Text style={styles.segmentTitle}>Split into parts</Text>
							<Text style={styles.segmentSubtitle}>Print different pages with different settings</Text>
						</View>
						<TouchableOpacity style={styles.addSegmentButton} onPress={onAddSegment}>
							<Feather name="plus" size={16} color={colors.printRequest} />
							<Text style={styles.addSegmentText}>Split</Text>
						</TouchableOpacity>
					</View>

					{isSplit && (
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.segmentChips}
							keyboardShouldPersistTaps="handled"
						>
							{segments.map((seg, i) => {
								const active = i === currentSegmentIndex;
								return (
									<TouchableOpacity
										key={i}
										style={[styles.segmentChip, active && styles.segmentChipActive]}
										onPress={() => onSelectSegment(i)}
										activeOpacity={0.8}
									>
										<View style={styles.segmentChipTextWrap}>
											<Text style={[styles.segmentChipTitle, active && styles.segmentChipTitleActive]} numberOfLines={1}>
												Split {i + 1}
											</Text>
											{!!formatPageRange(seg.pageSelection) && (
												<Text style={styles.segmentChipPages} numberOfLines={1}>
													{formatPageRange(seg.pageSelection)}
												</Text>
											)}
										</View>
										{segments.length > 1 && (
											<TouchableOpacity
												style={styles.segmentRemove}
												hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
												onPress={() => onRemoveSegment(i)}
											>
												<Feather name="x" size={14} color={colors.textSecondary} />
											</TouchableOpacity>
										)}
									</TouchableOpacity>
								);
							})}
						</ScrollView>
					)}
				</View>

				<View style={styles.settingsSection}>
					{/* Pages — locked to Custom Range when split, since each part names its own pages */}
					<View style={styles.pageRangeSection}>
						<DropdownRow
							label="Pages"
							options={PAGE_RANGE_OPTIONS}
							selectedValue={pageRange}
							onSelect={handlePageRangeChange}
							style={styles.pageRangeRow}
							disabled={isSplit}
						/>
						{/* Custom range input, sitting directly under the dropdown */}
						{pageRange === "custom" && (
							<View style={[styles.pageRangeControl, styles.pageRangeInputWrap]}>
								<TextInput
									ref={rangeInputRef}
									style={[
										styles.rangeInput,
										rangeInput.length > 0 &&
											(isRangeValid && !rangeBeyondEnd && !rangeOverlap ? styles.rangeInputValid : styles.rangeInputInvalid),
									]}
									placeholder="eg. 1-5, 8, 11-13"
									placeholderTextColor={colors.textSecondary}
									value={rangeInput}
									onChangeText={handleRangeInputChange}
									onFocus={(e) => handleInputFocus(e, rangeInputRef)}
									autoCapitalize="none"
									keyboardType="number-pad"
									returnKeyType="done"
								/>
								{rangeInput.length > 0 && !isRangeValid && (
									<Text style={styles.rangeHint}>Use commas and dashes, e.g. 1,3,5-8,10-</Text>
								)}
								{rangeBeyondEnd && (
									<Text style={styles.rangeHint}>
										This file only has {numberOfPages} {numberOfPages === 1 ? "page" : "pages"}
									</Text>
								)}
								{!rangeBeyondEnd && rangeOverlap && (
									<Text style={styles.rangeHint}>
										Page {rangeOverlap.page} is already in Split {rangeOverlap.splitIndex + 1}
									</Text>
								)}
							</View>
						)}
					</View>

					<DropdownRow
						label="Color"
						options={COLOR_OPTIONS}
						selectedValue={colorMode}
						onSelect={(val) => onSettingsChange("color", val)}
					/>

					<DropdownRow
						label="Print Sides"
						options={PRINT_SIDES_OPTIONS}
						selectedValue={isDoubleSided ? "double" : "single"}
						onSelect={handlePrintSidesChange}
					/>

					{/* Advanced settings — collapsed by default */}
					<TouchableOpacity
						style={styles.advancedSettingsToggle}
						onPress={() => setShowAdvancedSettings((prev) => !prev)}
						activeOpacity={0.7}
					>
						<Text style={styles.advancedSettingsTitle}>Advanced settings</Text>
						<Feather name={showAdvancedSettings ? "chevron-up" : "chevron-down"} size={20} color={colors.textPrimary} />
					</TouchableOpacity>

					{showAdvancedSettings && (
						<View style={styles.advancedSettingsPane}>
							<View style={styles.settingRow}>
								<Text style={styles.settingLabel}>Copies</Text>
								<View style={styles.copiesContainer}>
									<TouchableOpacity style={styles.copiesButton} onPress={() => handleCopiesChange(-1)}>
										<Feather name="minus" size={18} color={colors.textPrimary} />
									</TouchableOpacity>
									<Text style={styles.copiesValue}>{numberOfCopies}</Text>
									<TouchableOpacity style={styles.copiesButton} onPress={() => handleCopiesChange(1)}>
										<Feather name="plus" size={18} color={colors.textPrimary} />
									</TouchableOpacity>
								</View>
							</View>

							<DropdownRow
								label="Page Size"
								options={PAGE_SIZE_OPTIONS}
								selectedValue={pageSize}
								onSelect={(val) => onSettingsChange("pageType", val)}
							/>

							<DropdownRow
								label="Orientation"
								options={ORIENTATION_OPTIONS}
								selectedValue={orientation}
								onSelect={handleOrientationChange}
							/>

							<DropdownRow
								label="Duplex"
								options={DUPLEX_OPTIONS}
								selectedValue={duplexEdge}
								onSelect={handleDuplexChange}
								disabled={!isDoubleSided}
							/>

							<DropdownRow
								label="Pages per Sheet"
								options={PAGES_PER_SHEET_OPTIONS}
								selectedValue={pagesPerSheet}
								onSelect={(val) => onSettingsChange("pagesPerSheet", val)}
							/>
						</View>
					)}
				</View>

				{error && (
					<View style={styles.errorBox}>
						<Feather name="alert-circle" size={18} color={colors.printRequest} />
						<Text style={styles.errorText}>{error}</Text>
					</View>
				)}
			</ScrollView>

			{/* Footer Buttons */}
			<View
				style={[styles.footer, { paddingBottom: insets.bottom, bottom: keyboardOffset }]}
				onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
			>
				{/* Power action, demoted to a subtle ghost link */}
				{showCopyToAll && (
					<TouchableOpacity style={styles.copyAllButton} onPress={onCopyToAll} disabled={isActionDisabled()}>
						<Feather name="copy" size={16} color={colors.textSecondary} />
						<Text style={styles.copyAllText}>Apply these settings to all documents</Text>
					</TouchableOpacity>
				)}

				{/* Single primary action */}
				<TouchableOpacity
					style={[styles.submitButton, isActionDisabled() && styles.submitButtonDisabled]}
					onPress={onContinue}
					disabled={isActionDisabled()}
				>
					{loading ? (
						<ActivityIndicator size="small" color={colors.cardBackground} />
					) : (
						<>
							<Text style={styles.submitButtonText}>{continueText || "Review and continue"}</Text>
							<Feather name="arrow-right" size={20} color={colors.cardBackground} />
						</>
					)}
				</TouchableOpacity>
			</View>
		</View>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		backgroundColor: colors.cardBackground,
		flex: 1,
	},
	scrollView: {
		flex: 1,
		backgroundColor: colors.cardBackground,
	},
	scrollContent: {
		padding: 16,
	},
	documentCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		backgroundColor: colors.background,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.borderLight,
		padding: 10,
		marginBottom: 12,
	},
	documentIconContainer: {
		width: 36,
		height: 36,
		borderRadius: 10,
		backgroundColor: "rgba(0, 217, 163, 0.1)",
		justifyContent: "center",
		alignItems: "center",
	},
	extensionBadge: {
		fontSize: 8,
		fontWeight: "800",
		color: colors.primary,
		marginTop: 2,
	},
	documentInfo: {
		flex: 1,
	},
	documentName: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	documentMeta: {
		fontSize: 12,
		color: colors.textSecondary,
		marginTop: 2,
	},
	// Top line separates the split controls from the file card above
	segmentSection: {
		marginBottom: 12,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
	},
	segmentHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	// Fills the space up to the button, so the subtitle only wraps when it has to
	segmentHeaderText: {
		flex: 1,
	},
	segmentTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	segmentSubtitle: {
		fontSize: 12,
		color: colors.textSecondary,
		marginTop: 2,
	},
	addSegmentButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: colors.printRequest,
		backgroundColor: colors.cardBackground,
	},
	addSegmentText: {
		fontSize: 13,
		fontWeight: "700",
		color: colors.printRequest,
	},
	segmentChips: {
		gap: 10,
		paddingTop: 10,
		paddingBottom: 2,
	},
	segmentChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderRadius: 12,
		borderWidth: 1.5,
		borderColor: colors.borderLight,
		backgroundColor: colors.background,
		maxWidth: 220,
	},
	segmentChipActive: {
		borderColor: colors.printRequest,
		backgroundColor: "rgba(255, 139, 123, 0.08)",
	},
	segmentChipTextWrap: {
		flexShrink: 1,
	},
	segmentChipTitle: {
		fontSize: 13,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	segmentChipTitleActive: {
		color: colors.printRequest,
	},
	segmentChipPages: {
		fontSize: 11,
		fontWeight: "500",
		color: colors.textSecondary,
		marginTop: 2,
	},
	segmentRemove: {
		width: 22,
		height: 22,
		borderRadius: 11,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.cardBackground,
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	// Top line separates the settings from the split/page-ranges header above
	settingsSection: {
		marginBottom: 16,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
	},
	settingRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	settingLabel: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
		flexShrink: 0,
	},
	rangeInput: {
		borderWidth: 1.5,
		borderColor: colors.borderLight,
		borderRadius: 8,
		paddingVertical: 8,
		paddingHorizontal: 14,
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
		backgroundColor: colors.cardBackground,
	},
	pageRangeSection: {
		marginBottom: 12,
	},
	// The section around the row owns the bottom spacing (the range input sits between)
	pageRangeRow: {
		marginBottom: 0,
	},
	// Shared fixed width so the range input lines up exactly with the dropdown above it
	pageRangeControl: {
		width: DROPDOWN_WIDTH,
	},
	pageRangeInputWrap: {
		alignSelf: "flex-end",
		marginTop: 8,
	},
	advancedSettingsToggle: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		paddingTop: 12,
		paddingBottom: 4,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
	},
	advancedSettingsTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	advancedSettingsPane: {
		marginTop: 12,
	},
	rangeInputValid: {
		borderColor: "#2ECC71",
	},
	rangeInputInvalid: {
		borderColor: "#E74C3C",
	},
	rangeHint: {
		fontSize: 11,
		color: "#E74C3C",
		marginTop: 6,
		fontWeight: "500",
	},
	copiesContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	copiesButton: {
		width: 44,
		height: 36,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: colors.borderLight,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.background,
	},
	copiesValue: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
		minWidth: 30,
		textAlign: "center",
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
		gap: 10,
	},
	submitButton: {
		backgroundColor: colors.printRequest,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 16,
		borderRadius: 12,
		gap: 8,
		marginBottom: 10,
	},
	copyAllButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 10,
	},
	copyAllText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	submitButtonDisabled: {
		backgroundColor: colors.navInactive,
		opacity: 0.6,
	},
	submitButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},
});

export default DocumentSettingsForm;