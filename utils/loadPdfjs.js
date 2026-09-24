// Loads pdf.js from CDN on demand for the web build only. Used to render PDF
// previews on browsers without a built-in PDF viewer (Android Chrome shows an
// "Open" placeholder for PDFs in an iframe instead of rendering them).

const PDFJS_VERSION = "4.10.38";
const BASE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;
const LIB_URL = `${BASE_URL}/pdf.min.mjs`;
const WORKER_URL = `${BASE_URL}/pdf.worker.min.mjs`;

let pdfjsPromise = null;

export const loadPdfjs = () => {
	if (typeof window === "undefined") {
		return Promise.reject(new Error("pdf.js can only load in a browser environment"));
	}
	if (pdfjsPromise) return pdfjsPromise;

	// pdf.js 4 ships only as an ES module. Import it through a Function so Metro
	// doesn't try to resolve and bundle the URL at build time. Created here, not
	// at module scope, so native engines never have to parse it.
	const importFromUrl = new Function("url", "return import(url)");

	pdfjsPromise = importFromUrl(LIB_URL)
		.then((pdfjs) => {
			pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
			return pdfjs;
		})
		.catch((err) => {
			pdfjsPromise = null;
			throw err;
		});

	return pdfjsPromise;
};
