// Helpers for converting a backend draft into the shapes the print-flow
// screens use, and back. Kept in one place so upload-document, print-settings,
// shop-details and draft-details all hydrate a resumed draft identically.

// The default (empty) per-document settings used by print-settings.jsx.
export const DEFAULT_SETTINGS = {
	color: "bw",
	pageType: "A4",
	orientation: "portrait",
	pagesPerSheet: 1,
	numberOfCopies: "1",
	pageSelection: "",
	sidedness: "none",
};

// Backend stores `color` as a boolean and `numberOfCopies` as a number; the UI
// works with "color"/"bw" strings and a string copy count. Empty/unset settings
// fall back to the defaults so a half-finished draft still renders.
export const settingsFromBackend = (s) => {
	if (!s || Object.keys(s).length === 0) return { ...DEFAULT_SETTINGS };
	return {
		color: s.color ? "color" : "bw",
		pageType: s.pageType ?? DEFAULT_SETTINGS.pageType,
		orientation: s.orientation ?? DEFAULT_SETTINGS.orientation,
		pagesPerSheet: s.pagesPerSheet ?? DEFAULT_SETTINGS.pagesPerSheet,
		numberOfCopies: String(s.numberOfCopies ?? DEFAULT_SETTINGS.numberOfCopies),
		pageSelection: s.pageSelection ?? DEFAULT_SETTINGS.pageSelection,
		sidedness: s.sidedness ?? DEFAULT_SETTINGS.sidedness,
	};
};

// { fileId, name } entries used by print-settings / shop-details params.
export const documentsFromDraft = (draft) =>
	(draft?.files || []).map((f) => ({
		fileId: f.file?._id || f.file,
		name: f.file?.originalName || "File",
	}));

// Per-document settings array (UI shape) aligned with documentsFromDraft order.
export const settingsArrayFromDraft = (draft) =>
	(draft?.files || []).map((f) => settingsFromBackend(f.settings));

export default { DEFAULT_SETTINGS, settingsFromBackend, documentsFromDraft, settingsArrayFromDraft };
