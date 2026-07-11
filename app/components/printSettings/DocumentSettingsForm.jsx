//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useState, useRef, useEffect } from "react";
import { ActivityIndicator, Dimensions, Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import { colors } from "../../../constants/colors";
import SettingRow from "./SettingRow";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const KEYBOARD_EXTRA_OFFSET = 20;



const PAGE_RANGE_REGEX = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/;

const isValidAdvancedRange = (value) => {
	if (!value || !PAGE_RANGE_REGEX.test(value.trim())) return false;
	const segments = value.trim().split(/,\s*/);
	for (const seg of segments) {
		if (seg.includes("-")) {
			const [a, b] = seg.split("-").map(Number);
			if (a < 1 || b < a) return false;
		} else {
			if (Number(seg) < 1) return false;
		}
	}
	return true;
};

const SIDEDNESS_OPTIONS = [
	{ label: "Single", value: "none" },
	{ label: "Double: short edge", value: "short" },
	{ label: "Double: long edge", value: "long" },
];

// Short human label for a segment's page range, e.g. "" -> "All pages",
// "1" -> "Page 1", "2-" -> "Pages 2–end", "2-5" -> "Pages 2–5".
const formatPageRange = (value) => {
	const v = (value || "").trim();
	if (!v) return "All pages";
	const simple = /^(\d+)-(\d*)$/.exec(v);
	if (simple) {
		const [, start, end] = simple;
		if (!end) return `Pages ${start}–end`;
		return `Pages ${start}–${end}`;
	}
	if (/^\d+$/.test(v)) return `Page ${v}`;
	return `Pages ${v}`;
};

const segmentSummary = (seg) => `${seg.color === "color" ? "Color" : "B&W"} · ${seg.pageType}`;

//----------------------------------- COMPONENT -----------------------------------//

const DocumentSettingsForm = ({
	documentName,
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
	loading,
	error,
}) => {
	const extension = documentName.includes(".") ? documentName.split(".").pop().toUpperCase() : "FILE";
	// Restore the page-range inputs from a saved selection. A simple "start-end"
	// (or "start-") selection fills the two boxes; anything else is an advanced range.
	const initialPageSelection = (settings.pageSelection || "").trim();
	const simpleRangeMatch = /^(\d+)-(\d*)$/.exec(initialPageSelection);
	const initialAdvanced = initialPageSelection.length > 0 && !simpleRangeMatch;
	// When the document is split, each segment must name an explicit range, so the
	// custom range inputs are always shown (no "All" option).
	const [pageRange, setPageRange] = useState(initialPageSelection || isSplit ? "custom" : "all");
	const [startPage, setStartPage] = useState(simpleRangeMatch ? simpleRangeMatch[1] : "");
	const [endPage, setEndPage] = useState(simpleRangeMatch ? simpleRangeMatch[2] : "");
	const [advancedMode, setAdvancedMode] = useState(initialAdvanced);
	const [advancedRange, setAdvancedRange] = useState(initialAdvanced ? initialPageSelection : "");
	const [isAdvancedRangeValid, setIsAdvancedRangeValid] = useState(initialAdvanced);
	const [showPagesPerSheetDropdown, setShowPagesPerSheetDropdown] = useState(false);
	const [showSidednessDropdown, setShowSidednessDropdown] = useState(false);
	const [keyboardOffset, setKeyboardOffset] = useState(0);
	const [footerHeight, setFooterHeight] = useState(140);
	const insets = useSafeAreaInsets();

	const scrollViewRef = useRef(null);
	const startPageInputRef = useRef(null);
	const advancedRangeInputRef = useRef(null);
	const endPageInputRef = useRef(null);
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

	const selectedSidednessOption = SIDEDNESS_OPTIONS.find((opt) => opt.value === sidedness) || SIDEDNESS_OPTIONS[0];

	//----------------------------------- HANDLERS -----------------------------------//

	const handlePageRangeChange = (value) => {
		setPageRange(value);
		if (value === "custom") {
			// Auto-focus the page range input after the custom UI renders
			setTimeout(() => {
				focusInput(advancedMode ? advancedRangeInputRef : startPageInputRef);
			}, 300);
			return;
		}
		setStartPage("");
		setEndPage("");
		setAdvancedMode(false);
		setAdvancedRange("");
		setIsAdvancedRangeValid(false);
		onSettingsChange("pageSelection", "");
	};


	const handleAdvancedRangeChange = (value) => {
		setAdvancedRange(value);
		const valid = isValidAdvancedRange(value);
		setIsAdvancedRangeValid(valid);
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

	const toggleAdvancedMode = () => {
		setAdvancedMode((prev) => {
			const next = !prev;
			focusInput(next ? advancedRangeInputRef : startPageInputRef);
			return next;
		});
		setAdvancedRange("");
		setIsAdvancedRangeValid(false);
		setStartPage("");
		setEndPage("");
		onSettingsChange("pageSelection", "");
	};

	const handleStartPageChange = (value) => {
		setStartPage(value);
		updateSimplePageSelection(value, endPage);
	};

	const handleEndPageChange = (value) => {
		setEndPage(value);
		updateSimplePageSelection(startPage, value);
	};

	const updateSimplePageSelection = (start, end) => {
		const s = start.trim();
		const e = end.trim();
		if (!s) {
			onSettingsChange("pageSelection", "");
			return;
		}
		if (e) {
			onSettingsChange("pageSelection", `${s}-${e}`);
		} else {
			onSettingsChange("pageSelection", `${s}-`);
		}
	};

	const handleCopiesChange = (delta) => {
		const currentCopies = parseInt(numberOfCopies) || 1;
		const newCopies = Math.max(1, currentCopies + delta);
		onSettingsChange("numberOfCopies", newCopies.toString());
	};

	const isActionDisabled = () => {
		if (loading) return true;
		if (pageRange === "custom") {
			if (advancedMode) return !isAdvancedRangeValid;
			return !startPage || startPage.trim() === "";
		}
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
					<Text style={styles.documentName}>{documentName}</Text>
				</View>

				{/* Page-range segments: split a single file so different pages print
				    with different settings (e.g. page 1 in color, the rest B&W). */}
				<View style={styles.segmentSection}>
					<View style={styles.segmentHeader}>
						<View style={styles.segmentHeaderText}>
							<Text style={styles.segmentTitle}>Page ranges</Text>
							{!isSplit && (
								<Text style={styles.segmentSubtitle}>Print different pages with different settings</Text>
							)}
						</View>
						<TouchableOpacity style={styles.addSegmentButton} onPress={onAddSegment}>
							<Feather name="plus" size={16} color={colors.printRequest} />
							<Text style={styles.addSegmentText}>{isSplit ? "Add range" : "Split"}</Text>
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
											<Text style={[styles.segmentChipRange, active && styles.segmentChipRangeActive]} numberOfLines={1}>
												{formatPageRange(seg.pageSelection)}
											</Text>
											<Text style={styles.segmentChipSummary} numberOfLines={1}>{segmentSummary(seg)}</Text>
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
					{/* Pages Per Sheet */}
					<View style={styles.settingRow}>
						<Text style={styles.settingLabel}>Pages per Sheet</Text>
						<TouchableOpacity style={styles.dropdownButton} onPress={() => setShowPagesPerSheetDropdown(true)}>
							<Text style={styles.dropdownButtonText}>{pagesPerSheet}</Text>
							<Feather name="chevron-down" size={18} color={colors.textPrimary} />
						</TouchableOpacity>
					</View>

					<Modal visible={showPagesPerSheetDropdown} transparent animationType="fade" onRequestClose={() => setShowPagesPerSheetDropdown(false)}>
						<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPagesPerSheetDropdown(false)}>
							<View style={styles.dropdownModal}>
								<Text style={styles.dropdownModalTitle}>Pages per Sheet</Text>
								{[1, 2, 4, 6, 9, 16].map((num) => (
									<TouchableOpacity
										key={num}
										style={[styles.dropdownOption, pagesPerSheet === num && styles.dropdownOptionActive]}
										onPress={() => {
											onSettingsChange("pagesPerSheet", num);
											setShowPagesPerSheetDropdown(false);
										}}
									>
										<Text style={[styles.dropdownOptionText, pagesPerSheet === num && styles.dropdownOptionTextActive]}>
											{num}
										</Text>
										{pagesPerSheet === num && <Feather name="check" size={18} color={colors.printRequest} />}
									</TouchableOpacity>
								))}
							</View>
						</TouchableOpacity>
					</Modal>

					{/* Number of Copies */}
					<View style={styles.settingRow}>
						<Text style={styles.settingLabel}>Number of Copies</Text>
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

					{/* Color Mode */}
					<SettingRow
						label="Color Mode"
						options={[
							{ label: "Color", value: "color" },
							{ label: "B&W", value: "bw" },
						]}
						selectedValue={colorMode}
						onSelect={(val) => onSettingsChange("color", val)}
					/>

					{/* Orientation */}
					<SettingRow
						label="Orientation"
						options={[
							{ label: "Landscape", value: "landscape" },
							{ label: "Portrait", value: "portrait" },
						]}
						selectedValue={orientation}
						onSelect={(val) => onSettingsChange("orientation", val)}
					/>

					{/* Sidedness Dropdown */}
					<View style={styles.settingRow}>
						<Text style={styles.settingLabel}>Sidedness</Text>
						<TouchableOpacity style={styles.dropdownButton} onPress={() => setShowSidednessDropdown(true)}>
							<Text style={styles.dropdownButtonText}>{selectedSidednessOption.label}</Text>
							<Feather name="chevron-down" size={18} color={colors.textPrimary} />
						</TouchableOpacity>
					</View>

					<Modal visible={showSidednessDropdown} transparent animationType="fade" onRequestClose={() => setShowSidednessDropdown(false)}>
						<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSidednessDropdown(false)}>
							<View style={styles.dropdownModal}>
								<Text style={styles.dropdownModalTitle}>Sidedness</Text>
								{SIDEDNESS_OPTIONS.map((opt) => (
									<TouchableOpacity
										key={opt.value}
										style={[styles.dropdownOption, sidedness === opt.value && styles.dropdownOptionActive]}
										onPress={() => {
											onSettingsChange("sidedness", opt.value);
											setShowSidednessDropdown(false);
										}}
									>
										<Text style={[styles.dropdownOptionText, sidedness === opt.value && styles.dropdownOptionTextActive]}>
											{opt.label}
										</Text>
										{sidedness === opt.value && <Feather name="check" size={18} color={colors.printRequest} />}
									</TouchableOpacity>
								))}
							</View>
						</TouchableOpacity>
					</Modal>

					{/* Page Size */}
					<SettingRow
						label="Page Size"
						options={[
							{ label: "A3", value: "A3" },
							{ label: "A4", value: "A4" },
						]}
						selectedValue={pageSize}
						onSelect={(val) => onSettingsChange("pageType", val)}
					/>

					{/* Page Range — hidden when split, since each segment names its own range */}
					{!isSplit && (
						<SettingRow
							label="Page Range"
							options={[
								{ label: "Custom", value: "custom" },
								{ label: "All", value: "all" },
							]}
							selectedValue={pageRange}
							onSelect={handlePageRangeChange}
						/>
					)}

					{/* Adv Range Toggle*/}
					{(isSplit || pageRange === "custom") && (
						<View style={styles.customRangeContainer}>
							{isSplit && <Text style={styles.appliesToLabel}>Applies to pages</Text>}
							{/* Adv Range Toggle Button */}
							<TouchableOpacity
								style={[styles.advancedToggleButton, advancedMode && styles.advancedToggleButtonActive]}
								onPress={toggleAdvancedMode}
							>
								<Feather
									name={advancedMode ? "list" : "edit-3"}
									size={16}
									color={advancedMode ? colors.cardBackground : colors.printRequest}
								/>
								<Text style={[styles.advancedToggleText, advancedMode && styles.advancedToggleTextActive]}>
									{advancedMode ? "Simple Range" : "Advanced Range"}
								</Text>
							</TouchableOpacity>

							{advancedMode ? (
								/* Adv Range Input */
								<View>
									<Text style={styles.pageInputLabel}>Page Range</Text>
									<TextInput
										ref={advancedRangeInputRef}
										style={[
											styles.advancedRangeInput,
											advancedRange.length > 0 &&
											(isAdvancedRangeValid
												? styles.advancedRangeInputValid
												: styles.advancedRangeInputInvalid),
										]}
										placeholder="e.g. 1,3,16-20,25"
										placeholderTextColor={colors.textSecondary}
										value={advancedRange}
										onChangeText={handleAdvancedRangeChange}
										onFocus={(e) => handleInputFocus(e, advancedRangeInputRef)}
										autoCapitalize="none"
										returnKeyType="done"
									/>
									{advancedRange.length > 0 && !isAdvancedRangeValid && (
										<Text style={styles.advancedRangeHint}>Use commas and dashes, e.g. 1,3,16-20,25</Text>
									)}
								</View>
							) : (
								/* Simple Start/End Page Inputs */
								<View style={styles.pageInputRow}>
									<View style={styles.pageInputGroup}>
										<Text style={styles.pageInputLabel}>Start Page *</Text>
										<TextInput
											ref={startPageInputRef}
											style={styles.pageInput}
											keyboardType="number-pad"
											placeholder="1"
											placeholderTextColor={colors.textSecondary}
											value={startPage}
											onChangeText={handleStartPageChange}
											onFocus={(e) => handleInputFocus(e, startPageInputRef)}
											maxLength={4}
											returnKeyType="next"
										/>
									</View>

									<Text style={styles.pageRangeSeparator}>to</Text>

									<View style={styles.pageInputGroup}>
										<Text style={styles.pageInputLabel}>End Page </Text>
										<TextInput
											ref={endPageInputRef}
											style={styles.pageInput}
											keyboardType="number-pad"
											placeholder="End"
											placeholderTextColor={colors.textSecondary}
											value={endPage}
											onChangeText={handleEndPageChange}
											onFocus={(e) => handleInputFocus(e, endPageInputRef)}
											maxLength={4}
											returnKeyType="done"
										/>
									</View>
								</View>
							)}
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
						<Text style={styles.copyAllText}>Copy these settings to all documents</Text>
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
							<Text style={styles.submitButtonText}>Review &amp; Continue</Text>
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
		padding: 20,
	},
	documentCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		backgroundColor: colors.background,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.borderLight,
		padding: 14,
		marginBottom: 28,
	},
	documentIconContainer: {
		width: 44,
		height: 44,
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
	documentName: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
		flex: 1,
	},
	segmentSection: {
		marginBottom: 24,
	},
	segmentHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
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
		paddingTop: 14,
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
	segmentChipRange: {
		fontSize: 13,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	segmentChipRangeActive: {
		color: colors.printRequest,
	},
	segmentChipSummary: {
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
	appliesToLabel: {
		fontSize: 12,
		fontWeight: "700",
		color: colors.textSecondary,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 12,
	},
	settingsSection: {
		marginBottom: 28,
		marginTop: 4,
	},
	settingRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 20,
		paddingBottom: 20,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	settingLabel: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
		flexShrink: 0,
	},
	dropdownButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: colors.borderLight,
		backgroundColor: colors.background,
		minWidth: 150, // fixed instead of minWidth: 100
		gap: 8,
	},
	dropdownButtonText: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	dropdownModal: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		paddingVertical: 8,
		width: "75%",
		maxWidth: 300,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.15,
		shadowRadius: 24,
		elevation: 12,
	},
	dropdownModalTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
		paddingHorizontal: 20,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	dropdownOption: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 14,
		paddingHorizontal: 20,
	},
	dropdownOptionActive: {
		backgroundColor: "rgba(255, 139, 123, 0.08)",
	},
	dropdownOptionText: {
		fontSize: 15,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	dropdownOptionTextActive: {
		fontWeight: "700",
		color: colors.printRequest,
	},
	customRangeContainer: {
		backgroundColor: colors.background,
		borderRadius: 12,
		padding: 16,
		marginBottom: 20,
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	advancedToggleButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: colors.printRequest,
		backgroundColor: colors.cardBackground,
		marginBottom: 16,
		gap: 8,
	},
	advancedToggleButtonActive: {
		backgroundColor: colors.printRequest,
		borderColor: colors.printRequest,
	},
	advancedToggleText: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.printRequest,
	},
	advancedToggleTextActive: {
		color: colors.cardBackground,
	},
	advancedRangeInput: {
		borderWidth: 2,
		borderColor: colors.borderLight,
		borderRadius: 8,
		paddingVertical: 12,
		paddingHorizontal: 16,
		fontSize: 16,
		fontWeight: "600",
		color: colors.textPrimary,
		backgroundColor: colors.cardBackground,
	},
	advancedRangeInputValid: {
		borderColor: "#2ECC71",
	},
	advancedRangeInputInvalid: {
		borderColor: "#E74C3C",
	},
	advancedRangeHint: {
		fontSize: 11,
		color: "#E74C3C",
		marginTop: 6,
		fontWeight: "500",
	},
	pageInputRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	pageInputGroup: {
		flex: 1,
	},
	pageInputLabel: {
		fontSize: 12,
		fontWeight: "600",
		color: colors.textSecondary,
		marginBottom: 8,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	pageInput: {
		borderWidth: 1.5,
		borderColor: colors.borderLight,
		borderRadius: 8,
		paddingVertical: 12,
		paddingHorizontal: 16,
		fontSize: 16,
		fontWeight: "600",
		color: colors.textPrimary,
		backgroundColor: colors.cardBackground,
	},
	pageRangeSeparator: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textSecondary,
		paddingHorizontal: 12,
		marginTop: 20,
	},
	copiesContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 17,
	},
	copiesButton: {
		width: 40,
		height: 40,
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