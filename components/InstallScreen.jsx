// Web-only landing + install page shown when the app is opened in a browser tab
// (not yet installed as a PWA). This is what end users see after scanning the QR
// code displayed at a partner print shop, so it doubles as the product's landing
// page: an animated hero, "how it works", benefits, and an FAQ — all lifted from
// the ClickPrint marketing site (clickprint.wckd.pk) design system — wrapped
// around the real install action.
//
// It renders Chrome's Richer Install UI via the captured `beforeinstallprompt`
// event, with an iOS "Add to Home Screen" fallback since Safari has no prompt.
//
// The whole screen is DOM-based (plain HTML elements + injected CSS keyframes)
// rather than React Native primitives: WebInstallGate only ever mounts it on the
// web, and the animation-heavy scene is far cleaner as real markup. The native
// guard below ensures it stays inert if it is ever pulled into a native bundle.

import { useEffect, useState } from "react";
import { Platform } from "react-native";

const isIOS = () =>
	typeof navigator !== "undefined" &&
	(/iphone|ipad|ipod/i.test(navigator.userAgent) ||
		// iPadOS 13+ reports as Mac but is touch-capable.
		(/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

const scrollTo = (id) => {
	if (typeof document === "undefined") return;
	document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

// Figure out which browser/form-factor the user is on so we can show the exact
// menu path to install the PWA. Order matters: Edge/Opera/Samsung all embed
// "Chrome" (or "Safari") in their UA string, so they must be tested first.
const detectPlatform = () => {
	if (typeof navigator === "undefined") return { browser: "generic", mobile: false, ios: false };
	const ua = navigator.userAgent;
	const ios = isIOS();
	const mobile = ios || /android|mobile/i.test(ua);
	let browser = "generic";
	if (/Edg\/|EdgiOS|EdgA/i.test(ua)) browser = "edge";
	else if (/SamsungBrowser/i.test(ua)) browser = "samsung";
	else if (/OPR\/|OPiOS|Opera|OPT\//i.test(ua)) browser = "opera";
	else if (/FxiOS|Firefox/i.test(ua)) browser = "firefox";
	else if (/CriOS|Chrome|Chromium/i.test(ua)) browser = "chrome";
	else if (/Safari/i.test(ua)) browser = "safari";
	return { browser, mobile, ios };
};

// Step-by-step install instructions per browser. Every branch returns real,
// actionable steps for the user's current browser — we never tell them to
// switch browsers. Steps are JSX so we can bold the buttons/menus they tap.
function getInstallGuide({ browser, mobile, ios }) {
	// ---- iOS: every browser routes through the OS "Add to Home Screen" sheet,
	// only the entry point differs. ----
	if (ios) {
		if (browser === "chrome")
			return {
				title: "Add ClickPrint to your Home Screen",
				steps: [
					<>Tap the <b>Share</b> icon (a square with an up arrow) in the toolbar.</>,
					<>Scroll down and choose <b>Add to Home Screen</b>.</>,
					<>Tap <b>Add</b> — ClickPrint lands on your home screen like a native app.</>,
				],
			};
		if (browser === "edge")
			return {
				title: "Add ClickPrint to your Home Screen",
				steps: [
					<>Tap the <b>⋯</b> menu at the bottom, then choose <b>Share</b>.</>,
					<>Scroll down and choose <b>Add to Home Screen</b>.</>,
					<>Tap <b>Add</b> to finish.</>,
				],
			};
		if (browser === "firefox")
			return {
				title: "Add ClickPrint to your Home Screen",
				steps: [
					<>Tap the <b>☰</b> menu, then choose <b>Share</b>.</>,
					<>Choose <b>Add to Home Screen</b> from the share sheet.</>,
					<>Tap <b>Add</b> to finish.</>,
				],
			};
		// Safari (and any other iOS browser)
		return {
			title: "Add ClickPrint to your Home Screen",
			steps: [
				<>Tap the <b>Share</b> icon (a square with an up arrow) in Safari&apos;s toolbar.</>,
				<>Scroll down and choose <b>Add to Home Screen</b>.</>,
				<>Tap <b>Add</b> — ClickPrint appears like a native app.</>,
			],
		};
	}

	// ---- Chrome (Android + desktop) ----
	if (browser === "chrome")
		return mobile
			? {
					title: "Install ClickPrint",
					steps: [
						<>Tap the <b>⋮</b> menu in the top-right corner.</>,
						<>Tap <b>Add to Home screen</b> (or <b>Install app</b>).</>,
						<>Tap <b>Install</b> to confirm.</>,
					],
				}
			: {
					title: "Install ClickPrint",
					steps: [
						<>Click the <b>install</b> icon (a screen with a down arrow) at the right of the address bar. If it isn&apos;t there, open the <b>⋮</b> menu.</>,
						<>Choose <b>Install ClickPrint</b>.</>,
						<>Click <b>Install</b> to confirm.</>,
					],
				};

	// ---- Microsoft Edge (Android + desktop) ----
	if (browser === "edge")
		return mobile
			? {
					title: "Install ClickPrint",
					steps: [
						<>Tap the <b>⋯</b> menu at the bottom.</>,
						<>Tap <b>Add to phone</b> (under <b>Apps</b>, choose <b>Install this site as an app</b>).</>,
						<>Tap <b>Install</b> to confirm.</>,
					],
				}
			: {
					title: "Install ClickPrint",
					steps: [
						<>Click the <b>install</b> icon in the address bar, or open the <b>⋯</b> menu and choose <b>Apps</b>.</>,
						<>Select <b>Install this site as an app</b>.</>,
						<>Click <b>Install</b> to confirm.</>,
					],
				};

	// ---- Samsung Internet (Android) ----
	if (browser === "samsung")
		return {
			title: "Install ClickPrint",
			steps: [
				<>Tap the <b>≡</b> menu (or the <b>install</b> icon in the toolbar).</>,
				<>Tap <b>Add page to</b>, then <b>Home screen</b>.</>,
				<>Tap <b>Add</b> to confirm.</>,
			],
		};

	// ---- Opera (Android + desktop) ----
	if (browser === "opera")
		return mobile
			? {
					title: "Install ClickPrint",
					steps: [
						<>Tap the Opera <b>menu</b> (the <b>O</b> or <b>⋮</b> icon).</>,
						<>Tap <b>Home screen</b> (or <b>Add to Home screen</b>).</>,
						<>Tap <b>Add</b> to confirm.</>,
					],
				}
			: {
					title: "Install ClickPrint",
					steps: [
						<>Click the <b>install</b> icon in the address bar, or open the Opera <b>menu</b>.</>,
						<>Choose <b>Install ClickPrint</b>.</>,
						<>Click <b>Install</b> to confirm.</>,
					],
				};

	// ---- Firefox (Android installs PWAs; desktop keeps it as a pinned web app) ----
	if (browser === "firefox")
		return mobile
			? {
					title: "Install ClickPrint",
					steps: [
						<>Tap the <b>⋮</b> menu in the toolbar.</>,
						<>Tap <b>Install</b> (or <b>Add to Home screen</b>).</>,
						<>Confirm to add ClickPrint to your home screen.</>,
					],
				}
			: {
					title: "Keep ClickPrint one click away",
					steps: [
						<>Tap the <b>Install ClickPrint</b> button above to open the app.</>,
						<>To keep it handy, open the <b>≡</b> menu and choose <b>Bookmark current tab</b>, or drag this tab to your bookmarks bar.</>,
						<>Reopen it any time from your bookmarks — it runs full-screen like an app.</>,
					],
				};

	// ---- Safari on macOS (Add to Dock) ----
	if (browser === "safari")
		return {
			title: "Add ClickPrint to your Dock",
			steps: [
				<>Click the <b>Share</b> icon in Safari&apos;s toolbar.</>,
				<>Choose <b>Add to Dock</b>.</>,
				<>Click <b>Add</b> — ClickPrint opens in its own window like an app.</>,
			],
		};

	// ---- Anything else ----
	return {
		title: "Install ClickPrint",
		steps: [
			<>Open your browser&apos;s <b>menu</b>.</>,
			<>Look for <b>Install app</b> or <b>Add to Home Screen</b>.</>,
			<>Confirm to add ClickPrint to your device.</>,
		],
	};
}

export default function InstallScreen() {
	const [canInstall, setCanInstall] = useState(false);
	const [showHelp, setShowHelp] = useState(false);

	useEffect(() => {
		if (Platform.OS !== "web") return;

		// Preserve shopId from external camera scan (e.g. https://app.clickprint.pk?shopId=...)
		if (typeof window !== "undefined") {
			try {
				const searchParams = new URLSearchParams(window.location.search);
				const shopId = searchParams.get("shopId") || searchParams.get("shop_id") || searchParams.get("shop");
				if (shopId) {
					window.localStorage?.setItem("pendingShopId", shopId);
				}
			} catch {
				// ignore
			}
		}

		const sync = () => setCanInstall(!!window.__bipEvent);
		sync(); // the event may have fired before this screen mounted

		window.addEventListener("bip-ready", sync);
		window.addEventListener("appinstalled", sync);
		return () => {
			window.removeEventListener("bip-ready", sync);
			window.removeEventListener("appinstalled", sync);
		};
	}, []);

	// Native safety net — this component is web-only, but never render DOM tags
	// on a native renderer if it somehow gets there.
	if (Platform.OS !== "web") return null;

	const platform = detectPlatform();
	const ios = platform.ios;
	const guide = getInstallGuide(platform);

	const handleInstall = async () => {
		const promptEvent = window.__bipEvent;
		if (!promptEvent) {
			// No native prompt available (iOS Safari, Firefox, etc.) — reveal the
			// manual steps instead.
			setShowHelp(true);
			scrollTo("install");
			return;
		}
		promptEvent.prompt();
		try {
			await promptEvent.userChoice;
		} finally {
			// The event can only be used once. If the user dismissed it, they can
			// still install from the browser menu.
			window.__bipEvent = null;
			setCanInstall(false);
		}
	};

	const ctaLabel = canInstall ? "Install ClickPrint " : ios ? "Add to Home Screen" : "Install ClickPrint";

	return (
		<div className="cp-page">
			<style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />

			{/* ----------------------------------- HERO ---------------------------------- */}
			<section id="top" className="cp-hero">
				<div className="cp-hero-glow" />
				<div className="cp-in cp-hero-grid">
					<div className="cp-hero-copy">
						<h1 className="cp-h1 cp-rise" style={{ animationDelay: ".08s" }}>
							Print anything.
							<br />
							Skip the <span className="cp-grad">queue.</span>
						</h1>
						<p className="cp-sub cp-rise" style={{ animationDelay: ".14s" }}>
							Upload your documents, pay in a tap, and pick up your prints the moment
							they&apos;re ready — all<br/>from your phone. 
						</p>

						<div className="cp-cta-row cp-rise" style={{ animationDelay: ".2s" }}>
							<button className="cp-btn cp-btn-primary cp-btn-pulse" onClick={handleInstall}>
								{ctaLabel}
							</button>
						</div>

						<div className="cp-trust cp-rise" style={{ animationDelay: ".26s" }}>
							Works on Android &amp; iOS · No app store needed
						</div>

						{showHelp && (
							<div id="install" className="cp-help cp-rise" style={{ animationDelay: ".3s" }}>
								<div className="cp-help-title">{guide.title}</div>
								<ol className="cp-help-steps">
									{guide.steps.map((step, i) => (
										<li key={i}>{step}</li>
									))}
								</ol>
							</div>
						)}
					</div>

					{/* animated phone -> printer flow scene, with a scroll cue beneath it */}
					<div className="cp-scene-col cp-rise" style={{ animationDelay: ".18s" }}>
						<HeroScene />
						<a className="cp-scroll" onClick={() => scrollTo("how")} aria-label="See how it works">
							<span className="cp-scroll-label">See how it works</span>
							<span className="cp-scroll-chevron">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
									<path d="M5 8.5 12 15l7-6.5" />
									<path d="M5 13.5 12 20l7-6.5" opacity=".45" />
								</svg>
							</span>
						</a>
					</div>
				</div>
			</section>

			{/* ------------------------------- HOW IT WORKS ------------------------------ */}
			<section id="how" className="cp-section">
				<div className="cp-in">
					<div className="cp-head">
						<div className="cp-kicker" style={{ color: "var(--blue)" }}>
							Up and printing in a minute
						</div>
						<h2 className="cp-h2">How ClickPrint works</h2>
					</div>
					<div className="cp-grid cp-grid-4">
						{STEPS.map((s) => (
							<div key={s.n} className="cp-card cp-card-hover">
								<div className="cp-step-badge" style={{ background: s.bg, color: s.fg }}>
									{s.n}
								</div>
								<h3 className="cp-card-title">{s.title}</h3>
								<p className="cp-card-text">{s.text}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* --------------------------------- FAQ ------------------------------------- */}
			<section id="faq" className="cp-section">
				<div className="cp-in cp-faq-wrap">
					<div className="cp-head">
						<div className="cp-kicker" style={{ color: "var(--blue)" }}>
							Good to know
						</div>
						<h2 className="cp-h2">Questions, answered.</h2>
					</div>
					{FAQS.map((f, i) => (
						<details key={f.q} className="cp-faq" open={i === 0}>
							<summary>
								{f.q}
								<span className="cp-plus">+</span>
							</summary>
							<div className="cp-ans">{f.a}</div>
						</details>
					))}
				</div>
			</section>

			{/* ------------------------------- FINAL CTA --------------------------------- */}
			<section className="cp-section">
				<div className="cp-in">
					<div className="cp-final">
						<div className="cp-final-blob cp-final-blob-a" />
						<div className="cp-final-blob cp-final-blob-b" />
						<h2 className="cp-final-title">Ready to skip the queue?</h2>
						<p className="cp-final-sub">
							Install ClickPrint and send your first print job in under a minute.
						</p>
						<button className="cp-btn cp-btn-primary cp-btn-lg" onClick={handleInstall}>
							{ctaLabel}
						</button>
					</div>
				</div>
			</section>

			{/* --------------------------------- FOOTER ---------------------------------- */}
			<footer className="cp-footer">
				<div className="cp-in">
					<div className="cp-footer-grid">
						<div>
							<a className="cp-logo cp-logo-footer" onClick={() => scrollTo("top")}>
								<span>ClickPrint</span>
							</a>
							<p className="cp-footer-blurb">
								Order prints from nearby shops, right from your phone. Upload, pay, and pick
								up — no queues, no cash, no friction.
							</p>
						</div>

						<div>
							<div className="cp-footer-head">Get in touch</div>
							<a href="https://wecode.com.pk/contact" target="_blank" rel="noreferrer">
								Contact us
							</a>
							<a href="mailto:support@wecode.com.pk">support@wecode.com.pk</a>
							<a href="https://wa.me/923235400291" target="_blank" rel="noreferrer">
								WhatsApp: +92 323 5400291
							</a>
						</div>
					</div>
					<div className="cp-footer-bar">
						<div>
							© 2026 ClickPrint. A product of{" "}
							<a href="https://wecode.com.pk/" target="_blank" rel="noreferrer">
								WeCode
							</a>
							.
						</div>
						<div className="cp-footer-legal">
							<a href="https://wecode.com.pk/privacy" target="_blank" rel="noreferrer">
								Privacy
							</a>
							<a href="https://wecode.com.pk/terms" target="_blank" rel="noreferrer">
								Terms
							</a>
							<a href="https://wecode.com.pk/refund" target="_blank" rel="noreferrer">
								Refund
							</a>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}

// --------------------------------- HERO SCENE ------------------------------- //
// Animated "your document flows from phone to printer" illustration, rebuilt
// from the marketing site's hero. Pure CSS/SVG, no assets required.

function HeroScene() {
	return (
		<div className="cp-scene cp-rise" style={{ animationDelay: ".18s" }}>
			{/* floating document chips */}
			<span className="cp-chip cp-chip-1" />
			<span className="cp-chip cp-chip-2" />
			<span className="cp-chip cp-chip-3" />

			{/* dashed flow path phone -> printer */}
			<svg className="cp-flow" viewBox="0 0 420 480" fill="none">
				<path
					d="M150 150 C 250 150, 250 300, 330 320"
					stroke="#3B9EFF"
					strokeWidth="3"
					strokeLinecap="round"
					strokeDasharray="2 12"
					opacity=".55"
					className="cp-flow-path"
				/>
			</svg>

			{/* phone */}
			<div className="cp-phone">
				<div className="cp-phone-screen">
					<div className="cp-notch" />
					<div className="cp-app">
						<div className="cp-app-title">Upload document</div>
						<div className="cp-app-sub">Jani Print Shop · COMSATS</div>
						<div className="cp-doc">
							<div className="cp-doc-thumb">
								<span />
								<span />
								<span />
							</div>
							<div className="cp-doc-meta">
								<div className="cp-doc-name">Thesis.pdf</div>
								<div className="cp-doc-info">24 pages · Color · A4</div>
							</div>
						</div>
						<div className="cp-opts">
							<div className="cp-opt">
								<div className="cp-opt-k">COPIES</div>
								<div className="cp-opt-v">2</div>
							</div>
							<div className="cp-opt">
								<div className="cp-opt-k">SIDES</div>
								<div className="cp-opt-v">Both</div>
							</div>
						</div>
						<div className="cp-pay">Pay &amp; send to shop</div>
					</div>
				</div>
			</div>

			{/* scan badge — the QR you just scanned */}
			<div className="cp-qr">
				<svg viewBox="0 0 100 100" className="cp-qr-svg" aria-hidden="true">
					<g fill="#12233f">
						{/* finder patterns */}
						<path d="M8 8h26v26H8zM14 14v14h14V14z" fillRule="evenodd" />
						<path d="M66 8h26v26H66zM72 14v14h14V14z" fillRule="evenodd" />
						<path d="M8 66h26v26H8zM14 72v14h14V72z" fillRule="evenodd" />
						{/* matrix dots */}
						<rect x="42" y="10" width="6" height="6" />
						<rect x="52" y="10" width="6" height="6" />
						<rect x="42" y="20" width="6" height="6" />
						<rect x="42" y="42" width="6" height="6" />
						<rect x="52" y="42" width="6" height="6" />
						<rect x="62" y="42" width="6" height="6" />
						<rect x="42" y="52" width="6" height="6" />
						<rect x="72" y="52" width="6" height="6" />
						<rect x="82" y="52" width="6" height="6" />
						<rect x="52" y="62" width="6" height="6" />
						<rect x="42" y="72" width="6" height="6" />
						<rect x="62" y="72" width="6" height="6" />
						<rect x="52" y="82" width="6" height="6" />
						<rect x="72" y="72" width="6" height="6" />
						<rect x="82" y="82" width="6" height="6" />
						<rect x="10" y="42" width="6" height="6" />
						<rect x="20" y="52" width="6" height="6" />
					</g>
				</svg>
				<span className="cp-qr-scan" />
			</div>

			{/* printer */}
			<div className="cp-printer">
				<div className="cp-eject">
					<div className="cp-page-out cp-page-out-1">
						<span /> <span /> <span />
					</div>
					<div className="cp-page-out cp-page-out-2">
						<span /> <span />
					</div>
				</div>
				<div className="cp-printer-body">
					<div className="cp-printer-slot" />
					<div className="cp-printer-row">
						<div className="cp-printer-leds">
							<span className="cp-led-on" />
							<span className="cp-led-off" />
						</div>
						<div className="cp-printer-brand">CLICKPRINT</div>
					</div>
					<div className="cp-printer-status">
						<span className="cp-spinner" />
						<span className="cp-printer-status-text">Printing job #4821…</span>
					</div>
				</div>
				<div className="cp-printer-tray" />
			</div>
		</div>
	);
}

// ----------------------------------- DATA ----------------------------------- //

const STEPS = [
	{
		n: "1",
		bg: "rgba(59,158,255,.12)",
		fg: "var(--blue)",
		title: "Install the app",
		text: "Tap install and ClickPrint lands on your home screen. No app store, no waiting.",
	},
	{
		n: "2",
		bg: "rgba(0,217,163,.12)",
		fg: "var(--green-dark)",
		title: "Upload your document",
		text: "Pick any PDF or doc, then choose color, copies, page range and single or double sided.",
	},
	{
		n: "3",
		bg: "rgba(255,139,123,.14)",
		fg: "var(--coral-deep)",
		title: "Pay in a tap",
		text: "Check out securely in the app. No cash, no change, no friction.",
	},
	{
		n: "4",
		bg: "rgba(0,217,163,.12)",
		fg: "var(--green-dark)",
		title: "Collect your prints",
		text: "We notify you the moment they're ready. Walk up to the counter and grab them.",
	},
];

const FAQS = [
	{
		q: "Do I need an account to print?",
		a: "You can browse nearby shops right away. A quick phone-number sign-in is all it takes to place your first order — no lengthy forms.",
	},
	{
		q: "How do I pay for my prints?",
		a: "Everything is paid inside the app before your job is sent to the shop. No cash, no change, and no borrowing someone's USB drive.",
	},
	{
		q: "Are my documents private?",
		a: "Your files are sent securely to the single shop you choose and are only used to fulfil your order. They aren't shared with anyone else.",
	},
	{
		q: "How long until my prints are ready?",
		a: "Most jobs are printed within minutes. You'll get a notification the moment yours is done, so you never have to wait around guessing.",
	},
	{
		q: "What files can I print?",
		a: "PDFs, Word documents, images and more — with color, copies, page-range and single or double-sided options you set before you pay.",
	},
	{
		q: "What does it cost?",
		a: "You only pay the shop's printing rate, shown clearly before you confirm. Installing the app and browsing shops is completely free.",
	},
];

// ----------------------------------- STYLES --------------------------------- //

const PAGE_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap");

.cp-page {
	--navy: #12233f;
	--navy-deep: #0d1b31;
	--ink: #1a1f36;
	--body: #5b6480;
	--muted: #8f9bb3;
	--coral: #ff8b7b;
	--coral-deep: #ff7b6b;
	--blue: #3b9eff;
	--green: #00d9a3;
	--green-dark: #00a982;
	--cloud: #f7f8fa;
	--line: #e4e9f2;
	--accent: #ff4f00;

	height: 100vh;
	height: 100dvh;
	overflow-y: auto;
	overflow-x: hidden;
	-webkit-overflow-scrolling: touch;
	background: var(--cloud);
	color: var(--ink);
	font-family: "Manrope", system-ui, sans-serif;
	-webkit-font-smoothing: antialiased;
	scroll-behavior: smooth;
}
.cp-page *, .cp-page *::before, .cp-page *::after { box-sizing: border-box; }
.cp-page ::selection { background: var(--coral); color: #fff; }

.cp-in { width: 100%; max-width: 1160px; margin: 0 auto; padding: 0 20px; }
@media (min-width: 640px) { .cp-in { padding: 0 24px; } }

/* ---- buttons ---- */
.cp-btn {
	font-family: "Manrope", sans-serif;
	font-weight: 700;
	font-size: 15px;
	border: none;
	cursor: pointer;
	border-radius: 14px;
	padding: 14px 26px;
	transition: transform .12s ease, box-shadow .25s ease, background .2s ease;
	line-height: 1;
	white-space: nowrap;
}
.cp-btn:hover { transform: translateY(-2px); }
.cp-btn:active { transform: scale(.97); }
.cp-btn-primary { background: var(--accent); color: #fff; box-shadow: 0 12px 30px rgba(255,79,0,.34); }
.cp-btn-primary:hover { box-shadow: 0 16px 40px rgba(255,79,0,.46); }
.cp-btn-ghost { background: #fff; color: var(--ink); box-shadow: 0 2px 10px rgba(143,155,179,.16); border: 1.5px solid var(--line); }
.cp-btn-sm { padding: 11px 18px; font-size: 14px; border-radius: 12px; }
.cp-btn-lg { padding: 16px 38px; font-size: 16.5px; font-weight: 800; }
.cp-btn-pulse { animation: cpPulse 2.6s ease-in-out infinite; }

.cp-logo { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; }
.cp-logo img { width: 34px; height: 34px; border-radius: 9px; display: block; }
.cp-logo span { font-family: "Sora", sans-serif; font-weight: 700; font-size: 18px; color: var(--ink); letter-spacing: -.3px; }

/* ---- hero ---- */
.cp-hero { position: relative; overflow: hidden; padding: clamp(36px, 6vw, 68px) 0 clamp(72px, 8vw, 104px); }
.cp-hero-glow {
	position: absolute; inset: 0; pointer-events: none;
	background:
		radial-gradient(1000px 520px at 82% -8%, rgba(59,158,255,.10), transparent 60%),
		radial-gradient(760px 480px at 6% 12%, rgba(0,217,163,.09), transparent 62%);
}
.cp-hero-grid {
	position: relative;
	display: grid; grid-template-columns: 1fr; gap: 40px; align-items: center;
}
@media (min-width: 960px) { .cp-hero-grid { grid-template-columns: 1.02fr .98fr; gap: 44px; } }
.cp-hero-copy { text-align: center; }
@media (min-width: 960px) { .cp-hero-copy { text-align: left; } }

.cp-h1 {
	font-family: "Sora", sans-serif; font-weight: 800;
	font-size: clamp(33px, 6.4vw, 56px); line-height: 1.06;
	letter-spacing: -1.4px; margin: 0 0 18px;
}
.cp-grad { background: linear-gradient(135deg, #1b3a6b, #18b8c9); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.cp-sub { font-size: clamp(15.5px, 2vw, 18.5px); line-height: 1.6; color: var(--body); max-width: 520px; margin: 0 auto 28px; }
@media (min-width: 960px) { .cp-sub { margin: 0 0 30px; } }

.cp-cta-row { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
@media (min-width: 960px) { .cp-cta-row { justify-content: flex-start; } }
.cp-trust { font-size: 12.5px; font-weight: 600; color: var(--muted); margin-top: 16px; }

.cp-help {
	margin-top: 20px; text-align: left;
	background: #fff; border: 1.5px solid var(--line);
	border-radius: 16px; padding: 18px 20px;
	box-shadow: 0 10px 30px rgba(143,155,179,.14);
	max-width: 520px; margin-left: auto; margin-right: auto;
}
@media (min-width: 960px) { .cp-help { margin-left: 0; } }
.cp-help-title { font-family: "Sora", sans-serif; font-weight: 700; font-size: 15px; margin-bottom: 10px; }
.cp-help-steps { margin: 0; padding-left: 20px; color: var(--body); font-size: 14px; line-height: 1.9; }
.cp-help-text { margin: 0; color: var(--body); font-size: 14px; line-height: 1.65; }
.cp-help b { color: var(--ink); }

/* ---- scroll cue (under the hero scene) ---- */
.cp-scene-col { display: flex; flex-direction: column; align-items: center; }
.cp-scroll {
	display: inline-flex; flex-direction: column; align-items: center; gap: 6px;
	margin-top: clamp(28px, 5vw, 48px); cursor: pointer; color: var(--muted);
	transition: color .2s;
}
.cp-scroll:hover { color: var(--ink); }
.cp-scroll-label { font-size: 11px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; }
.cp-scroll-chevron {
	display: flex; align-items: center; justify-content: center;
	color: var(--accent); animation: cpScrollHint 1.8s ease-in-out infinite;
}
.cp-scroll-chevron svg { width: 26px; height: 26px; }

/* ---- hero scene ---- */
.cp-scene {
	position: relative; width: 100%; max-width: 460px;
	height: clamp(320px, 78vw, 470px);
	margin: 0 auto;
}
.cp-chip {
	position: absolute; border-radius: 8px; background: #fff;
	box-shadow: 0 8px 20px rgba(143,155,179,.16);
	width: clamp(34px, 8vw, 46px); height: clamp(42px, 10vw, 58px);
}
.cp-chip-1 { left: 6%; top: 60%; --r: -8deg; animation: cpFloatUp 7s ease-in infinite; }
.cp-chip-2 { left: 44%; top: 78%; --r: 10deg; animation: cpFloatUp 8.5s ease-in 1.6s infinite; }
.cp-chip-3 { left: 76%; top: 66%; --r: -5deg; animation: cpFloatUp 7.8s ease-in 3.1s infinite; }

.cp-flow { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; display: none; }
@media (min-width: 640px) { .cp-flow { display: block; } }
.cp-flow-path { animation: cpDash 1.1s linear infinite; }

.cp-phone {
	position: absolute; left: 2%; top: 12px;
	width: clamp(140px, 40vw, 214px); height: clamp(280px, 80vw, 428px);
	background: var(--navy); border-radius: clamp(26px, 6vw, 38px);
	padding: 11px; box-shadow: 0 30px 60px rgba(18,35,63,.28);
	animation: cpBob 5s ease-in-out infinite;
}
.cp-phone-screen { position: relative; width: 100%; height: 100%; background: var(--cloud); border-radius: clamp(20px, 5vw, 29px); overflow: hidden; }
.cp-notch { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 40%; height: 20px; background: var(--navy); border-radius: 0 0 14px 14px; z-index: 3; }
.cp-app { padding: 30px clamp(10px, 3vw, 16px) 0; }
.cp-app-title { font-family: "Sora", sans-serif; font-weight: 700; font-size: clamp(11px, 2.6vw, 15px); color: var(--ink); }
.cp-app-sub { font-size: clamp(9px, 2vw, 11px); color: var(--muted); font-weight: 600; margin-top: 2px; }
.cp-doc { margin-top: 14px; background: #fff; border-radius: 16px; padding: 12px; box-shadow: 0 8px 20px rgba(143,155,179,.12); display: flex; gap: 10px; align-items: center; }
.cp-doc-thumb { position: relative; flex: none; width: clamp(28px, 7vw, 38px); height: clamp(34px, 9vw, 46px); border-radius: 6px; background: linear-gradient(135deg, var(--blue), #2A8AEF); }
.cp-doc-thumb span { position: absolute; left: 6px; height: 3px; border-radius: 2px; background: rgba(255,255,255,.8); }
.cp-doc-thumb span:nth-child(1) { right: 6px; top: 9px; }
.cp-doc-thumb span:nth-child(2) { right: 9px; top: 17px; opacity: .7; }
.cp-doc-thumb span:nth-child(3) { right: 7px; top: 25px; opacity: .7; }
.cp-doc-meta { flex: 1; min-width: 0; }
.cp-doc-name { font-size: clamp(10px, 2.4vw, 12px); font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cp-doc-info { font-size: clamp(8.5px, 2vw, 10.5px); color: var(--muted); font-weight: 600; margin-top: 2px; }
.cp-opts { display: flex; gap: 8px; margin-top: 12px; }
.cp-opt { flex: 1; background: #fff; border-radius: 11px; padding: 9px 4px; text-align: center; box-shadow: 0 4px 12px rgba(143,155,179,.1); }
.cp-opt-k { font-size: clamp(7.5px, 1.8vw, 9px); color: var(--muted); font-weight: 700; letter-spacing: .4px; }
.cp-opt-v { font-size: clamp(11px, 2.6vw, 13px); font-weight: 800; color: var(--ink); margin-top: 2px; }
.cp-pay { margin-top: 14px; background: var(--green); border-radius: 13px; padding: 12px; text-align: center; color: #fff; font-family: "Sora", sans-serif; font-weight: 700; font-size: clamp(10px, 2.5vw, 13.5px); box-shadow: 0 10px 22px rgba(0,217,163,.32); animation: cpTap 3.2s ease-in-out infinite; }

.cp-qr {
	position: absolute; right: 4%; top: 10px;
	width: clamp(76px, 18vw, 112px); height: clamp(76px, 18vw, 112px);
	background: #fff; border-radius: 20px; padding: 11px;
	box-shadow: 0 18px 40px rgba(59,158,255,.25); overflow: hidden;
	animation: cpBob 6s ease-in-out .5s infinite;
}
.cp-qr-svg { width: 100%; height: 100%; display: block; }
.cp-qr-scan { position: absolute; left: 11px; right: 11px; height: 3px; border-radius: 3px; background: linear-gradient(90deg, transparent, var(--green), transparent); box-shadow: 0 0 10px rgba(0,217,163,.8); animation: cpScan 2.4s ease-in-out infinite; }

.cp-printer { position: absolute; right: 1%; bottom: 8px; width: clamp(132px, 34vw, 210px); }
.cp-eject { position: absolute; left: 16%; right: 16%; top: -8px; height: 72px; pointer-events: none; }
.cp-page-out { position: absolute; left: 0; right: 0; top: 0; height: clamp(44px, 11vw, 66px); background: #fff; border-radius: 5px; box-shadow: 0 8px 18px rgba(143,155,179,.18); transform-origin: top; }
.cp-page-out-1 { animation: cpEject 3s ease-in infinite; }
.cp-page-out-2 { animation: cpEject 3s ease-in 1.5s infinite; }
.cp-page-out span { position: absolute; left: 12px; height: 3px; background: var(--line); border-radius: 2px; }
.cp-page-out span:nth-child(1) { right: 12px; top: 12px; }
.cp-page-out span:nth-child(2) { right: 22px; top: 22px; }
.cp-page-out span:nth-child(3) { right: 16px; top: 32px; }
.cp-printer-body { position: relative; z-index: 2; background: linear-gradient(135deg, #243a63, var(--navy)); border-radius: 20px 20px 16px 16px; padding: 16px 16px 20px; box-shadow: 0 24px 44px rgba(18,35,63,.3); }
.cp-printer-slot { height: 9px; background: rgba(255,255,255,.14); border-radius: 6px; margin-bottom: 12px; }
.cp-printer-row { display: flex; align-items: center; justify-content: space-between; }
.cp-printer-leds { display: flex; gap: 6px; }
.cp-printer-leds span { width: 9px; height: 9px; border-radius: 50%; }
.cp-led-on { background: var(--green); box-shadow: 0 0 8px rgba(0,217,163,.9); animation: cpTap 1.8s ease-in-out infinite; }
.cp-led-off { background: rgba(255,255,255,.28); }
.cp-printer-brand { font-family: "Sora", sans-serif; font-weight: 700; font-size: clamp(8px, 2vw, 11px); color: rgba(255,255,255,.7); letter-spacing: .5px; }
.cp-printer-status { margin-top: 12px; height: clamp(26px, 6vw, 34px); background: rgba(0,0,0,.22); border-radius: 9px; display: flex; align-items: center; justify-content: center; gap: 7px; }
.cp-spinner { width: clamp(9px, 2.4vw, 13px); height: clamp(9px, 2.4vw, 13px); border: 2.5px solid rgba(255,255,255,.35); border-top-color: var(--green); border-radius: 50%; animation: cpSpin 1s linear infinite; }
.cp-printer-status-text { color: rgba(255,255,255,.75); font-size: clamp(8px, 2vw, 11px); font-weight: 700; }
.cp-printer-tray { height: 14px; background: var(--navy-deep); border-radius: 0 0 14px 14px; margin: 0 16px; box-shadow: 0 12px 20px rgba(18,35,63,.22); }

/* ---- generic sections ---- */
.cp-section { padding: clamp(40px, 6vw, 68px) 0 0; }
.cp-head { text-align: center; max-width: 640px; margin: 0 auto clamp(32px, 4vw, 46px); }
.cp-kicker { font-family: "Sora", sans-serif; font-weight: 700; font-size: 12.5px; letter-spacing: .6px; text-transform: uppercase; }
.cp-h2 { font-family: "Sora", sans-serif; font-weight: 800; font-size: clamp(27px, 4.4vw, 40px); letter-spacing: -1px; margin: 12px 0 0; }

/* ---- card grids ---- */
.cp-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
@media (min-width: 620px) { .cp-grid-4 { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 960px) { .cp-grid-4 { grid-template-columns: repeat(4, 1fr); } }
.cp-card { background: #fff; border-radius: 22px; padding: 26px 22px; box-shadow: 0 2px 12px rgba(143,155,179,.1); }
.cp-card-hover { transition: transform .28s cubic-bezier(.2,.7,.2,1), box-shadow .28s; }
.cp-card-hover:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(143,155,179,.18); }
.cp-step-badge { width: 48px; height: 48px; border-radius: 14px; font-family: "Sora", sans-serif; font-weight: 800; font-size: 20px; display: flex; align-items: center; justify-content: center; }
.cp-card-title { font-family: "Sora", sans-serif; font-weight: 700; font-size: 18px; margin: 18px 0 8px; }
.cp-card-text { color: var(--body); font-size: 14.5px; line-height: 1.6; margin: 0; }

/* ---- faq ---- */
.cp-faq-wrap { max-width: 840px; }
.cp-faq { border-bottom: 1px solid rgba(228,233,242,.9); }
.cp-faq summary {
	list-style: none; cursor: pointer; padding: 20px 4px;
	display: flex; justify-content: space-between; align-items: center; gap: 16px;
	font-family: "Sora", sans-serif; font-weight: 600; font-size: clamp(15.5px, 2vw, 18px); color: var(--ink);
}
.cp-faq summary::-webkit-details-marker { display: none; }
.cp-plus { flex: none; width: 30px; height: 30px; border-radius: 50%; background: #f0f2f6; display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--muted); transition: .25s; }
.cp-faq[open] .cp-plus { background: var(--coral); color: #fff; transform: rotate(45deg); }
.cp-ans { padding: 0 4px 20px; color: var(--body); font-size: 15px; line-height: 1.65; max-width: 760px; }

/* ---- final cta ---- */
.cp-final {
	position: relative; overflow: hidden; text-align: center;
	background: var(--green); border-radius: 30px;
	padding: clamp(40px, 6vw, 60px) clamp(24px, 4vw, 40px);
	box-shadow: 0 30px 60px rgba(0,217,163,.3);
}
.cp-final-blob { position: absolute; border-radius: 50%; }
.cp-final-blob-a { right: -40px; top: -60px; width: clamp(160px, 24vw, 240px); height: clamp(160px, 24vw, 240px); background: rgba(255,255,255,.14); }
.cp-final-blob-b { left: -50px; bottom: -70px; width: clamp(150px, 20vw, 200px); height: clamp(150px, 20vw, 200px); background: rgba(255,255,255,.1); }
.cp-final-title { position: relative; font-family: "Sora", sans-serif; font-weight: 800; font-size: clamp(27px, 4.6vw, 42px); letter-spacing: -1.1px; color: #053a2e; margin: 0 0 14px; }
.cp-final-sub { position: relative; font-size: clamp(15px, 2vw, 17.5px); color: rgba(5,58,46,.82); font-weight: 600; max-width: 520px; margin: 0 auto 28px; }
.cp-final .cp-btn { position: relative; }

/* ---- footer ---- */
.cp-footer { background: var(--navy); color: #fff; margin-top: clamp(48px, 7vw, 72px); padding: clamp(44px, 6vw, 60px) 0 32px; }
.cp-footer-grid { display: grid; grid-template-columns: 1fr; gap: 34px; padding-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,.1); }
@media (min-width: 640px) { .cp-footer-grid { grid-template-columns: 1.6fr 1fr 1fr; gap: 36px; } }
.cp-logo-footer span { color: #fff; }
.cp-footer-blurb { color: rgba(255,255,255,.6); font-size: 14.5px; line-height: 1.65; max-width: 320px; margin: 18px 0 0; }
.cp-footer-head { font-family: "Sora", sans-serif; font-weight: 700; font-size: 13px; color: rgba(255,255,255,.5); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 16px; }
.cp-footer-grid > div > a { display: block; color: rgba(255,255,255,.75); font-size: 14.5px; margin-bottom: 12px; cursor: pointer; transition: color .2s; }
.cp-footer-grid > div > a:hover { color: #fff; }
.cp-footer-bar { display: flex; flex-direction: column; align-items: center; gap: 12px; padding-top: 24px; font-size: 13px; color: rgba(255,255,255,.5); }
@media (min-width: 640px) { .cp-footer-bar { flex-direction: row; justify-content: space-between; } }
.cp-footer-bar a { color: rgba(255,255,255,.7); transition: color .2s; }
.cp-footer-bar a:hover { color: #fff; }
.cp-footer-legal { display: flex; gap: 22px; }

/* ---- animations ---- */
.cp-rise { animation: cpRise .7s cubic-bezier(.2,.7,.2,1) both; }
@keyframes cpRise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cpBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
@keyframes cpFloatUp {
	0% { transform: translateY(30px) rotate(var(--r, 0deg)); opacity: 0; }
	15% { opacity: .85; } 85% { opacity: .85; }
	100% { transform: translateY(-150px) rotate(var(--r, 0deg)); opacity: 0; }
}
@keyframes cpScan { 0%, 100% { top: 14%; } 50% { top: 78%; } }
@keyframes cpEject {
	0% { transform: translateY(-10px) scaleY(.15); opacity: 0; }
	14% { opacity: 1; }
	62% { transform: translateY(52px) scaleY(1); opacity: 1; }
	100% { transform: translateY(86px) scaleY(1); opacity: 0; }
}
@keyframes cpDash { to { stroke-dashoffset: -48; } }
@keyframes cpPulse {
	0%, 100% { box-shadow: 0 12px 30px rgba(255,79,0,.34); }
	50% { box-shadow: 0 16px 46px rgba(255,79,0,.54); }
}
@keyframes cpTap { 0%, 44%, 56%, 100% { transform: scale(1); } 48%, 52% { transform: scale(.86); } }
@keyframes cpSpin { to { transform: rotate(360deg); } }
@keyframes cpScrollHint {
	0%, 100% { transform: translateY(0) scale(1); opacity: .75; }
	50% { transform: translateY(7px) scale(1.12); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
	.cp-page *, .cp-page *::before, .cp-page *::after { animation: none !important; scroll-behavior: auto; }
	.cp-rise { opacity: 1 !important; transform: none !important; }
}
`;
