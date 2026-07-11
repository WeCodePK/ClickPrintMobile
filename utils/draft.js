// Helpers for converting a backend draft into the shapes the print-flow
// screens use, and back. Kept in one place so upload-document, print-settings,
// shop-details and draft-details all hydrate a resumed draft identically.
//
// A single uploaded file can be split into several "segments", each covering a
// page range with its own print settings (e.g. page 1 in color, the rest B&W).
// The backend stores each segment as its own entry in `draft.files` — multiple
// entries sharing the same `file` id, differing by `settings.pageSelection`.
// The UI groups those entries back into one document with an array of segments.

// The default (empty) per-segment settings used by print-settings.jsx.
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

const fileIdOf = (f) => f.file?._id || f.file;

// { fileId, name } entries — one per unique file, in first-seen order. Because a
// split file appears as several `draft.files` entries, we dedupe by file id so a
// document is only listed once.
export const documentsFromDraft = (draft) => {
	const seen = new Map();
	for (const f of draft?.files || []) {
		const id = fileIdOf(f);
		if (!seen.has(id)) {
			seen.set(id, { fileId: id, name: f.file?.originalName || "File" });
		}
	}
	return Array.from(seen.values());
};

// Per-document array of segments (each a UI settings object), grouped by file
// and aligned with documentsFromDraft order. A file with no stored settings
// still yields a single default segment so it renders.
export const segmentsArrayFromDraft = (draft) => {
	const groups = new Map();
	for (const f of draft?.files || []) {
		const id = fileIdOf(f);
		if (!groups.has(id)) groups.set(id, []);
		groups.get(id).push(settingsFromBackend(f.settings));
	}
	return Array.from(groups.values()).map((segs) => (segs.length ? segs : [{ ...DEFAULT_SETTINGS }]));
};

// Flatten a Segment[][] (per-document segments) into a flat Settings[] — one
// entry per segment. Used where each segment is treated independently, e.g.
// shop capability scoring.
export const flattenSegments = (segmentsArray) => (segmentsArray || []).flat();

export default {
	DEFAULT_SETTINGS,
	settingsFromBackend,
	documentsFromDraft,
	segmentsArrayFromDraft,
	flattenSegments,
};
