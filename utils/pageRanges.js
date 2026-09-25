// Helpers for page selections like "1-5, 8, 11-" (see DocumentSettingsForm).

// "1-5, 8, 11-" -> [{ start: 1, end: 5 }, { start: 8, end: 8 }, { start: 11, end: Infinity }].
// An open-ended range ("11-") runs to the end of the document. Assumes the
// selection has already passed the form's format check.
export const parsePageRanges = (selection) =>
	(selection || "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const [start, end] = part.split("-").map((n) => n.trim());
			const from = Number(start);
			if (!part.includes("-")) return { start: from, end: from };
			return { start: from, end: end === "" ? Infinity : Number(end) };
		});

// True when a selection asks for a page beyond the document's last page, e.g.
// "10-15" or "20-" on a 12-page file. An open-ended range only needs its start
// to exist. Unknown page counts (null/undefined) never count as exceeded.
export const exceedsPageCount = (selection, pageCount) => {
	if (pageCount == null) return false;
	return parsePageRanges(selection).some((r) => r.start > pageCount || (r.end !== Infinity && r.end > pageCount));
};

// First page two selections have in common, or null if they don't overlap.
export const firstSharedPage = (a, b) => {
	let shared = null;
	for (const x of parsePageRanges(a)) {
		for (const y of parsePageRanges(b)) {
			const from = Math.max(x.start, y.start);
			if (from <= Math.min(x.end, y.end) && (shared === null || from < shared)) shared = from;
		}
	}
	return shared;
};

// First pair of splits whose page selections overlap, as { first, second, page }
// (split indexes, 0-based), or null when every split covers distinct pages.
export const findSplitOverlap = (segments) => {
	for (let i = 0; i < segments.length; i++) {
		for (let j = i + 1; j < segments.length; j++) {
			const page = firstSharedPage(segments[i].pageSelection, segments[j].pageSelection);
			if (page !== null) return { first: i, second: j, page };
		}
	}
	return null;
};
