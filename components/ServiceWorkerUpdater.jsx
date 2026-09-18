// Keeps the web app on the latest build automatically, without asking the user.
//
// A service worker can't check for updates by itself (the browser stops it
// when idle), so the page drives the checks: on launch, when the app comes back
// to the foreground, and when it reconnects, it calls registration.update().
// The browser re-fetches sw.js, whose bytes change on every build
// (scripts/build-web.js), installs the new worker, and that worker takes
// control right away (skipWaiting + clients.claim in public/sw.js).
//
// Whenever the controlling worker changes, we ask it for its build SHA. If it
// differs from the build this page was loaded with, the page is out of date:
// show the updating screen and reload. Page loads are network-first in sw.js,
// so the reload fetches the new HTML and bundle.
//
// Web production builds only. Native and dev (sw-dev.js) render nothing.

import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, StyleSheet, Text, View } from "react-native";
import appLogo from "../assets/icon.png";
import config from "../config/config";
import { colors } from "../constants/colors";

const ENABLED = Platform.OS === "web" && process.env.NODE_ENV === "production";

// Keep the updating screen up at least this long so it doesn't just flicker.
const MIN_OVERLAY_MS = 800;
const VERSION_TIMEOUT_MS = 3000;

// Chrome sometimes leaves a new worker stuck in "waiting" even though it called
// skipWaiting() during install (reproducible when the update lands while the
// page is still loading). Telling it to skip waiting again activates it, so
// retry until it's no longer waiting.
const NUDGE_INTERVAL_MS = 2000;
const NUDGE_MAX_ATTEMPTS = 15;

// The build we last reloaded for. If the page is still stale after reloading
// for that build (e.g. a flaky network served a cached page), don't reload
// again, so it can never get stuck in a reload loop.
const RELOADED_FOR_KEY = "sw-reloaded-for";

//----------------------------------- HELPERS -----------------------------------//

// Skips builds that can't be identified: no git info, or an sw.js that
// wasn't stamped because the build didn't go through scripts/build-web.js.
const isKnownSha = (sha) => typeof sha === "string" && sha !== "" && sha !== "unknown" && sha !== "__COMMIT_SHA__";

// Asks a service worker for its BUILD_SHA. Resolves null if it doesn't answer.
function getWorkerSha(worker) {
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		const timer = setTimeout(() => resolve(null), VERSION_TIMEOUT_MS);
		channel.port1.onmessage = (event) => {
			clearTimeout(timer);
			resolve(event.data?.sha ?? null);
		};
		worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
	});
}

// sessionStorage can throw (e.g. blocked storage); the guard is best-effort.
function getReloadedFor() {
	try {
		return window.sessionStorage.getItem(RELOADED_FOR_KEY);
	} catch {
		return null;
	}
}

function setReloadedFor(sha) {
	try {
		window.sessionStorage.setItem(RELOADED_FOR_KEY, sha);
	} catch {}
}

//----------------------------------- COMPONENTS -----------------------------------//

export default function ServiceWorkerUpdater() {
	const [updating, setUpdating] = useState(false);

	useEffect(() => {
		if (!ENABLED || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

		const serviceWorker = navigator.serviceWorker;
		let disposed = false;
		let reloading = false;

		// Reload if the worker in control belongs to a different build than this
		// page. Only call this once that worker is known to be the latest one:
		// right after it takes control, or after an update check found nothing
		// newer. An older worker that's about to be replaced also has a
		// different SHA, but the page is already current in that case.
		const reloadIfStale = async () => {
			const controller = serviceWorker.controller;
			if (!controller || reloading) return;

			const workerSha = await getWorkerSha(controller);
			if (disposed || reloading) return;
			if (!isKnownSha(workerSha) || !isKnownSha(config.commitSha)) return;
			if (workerSha === config.commitSha) return;

			// Reloading offline would just bring back the cached old page.
			if (!navigator.onLine) return;
			if (getReloadedFor() === workerSha) {
				console.warn(`Page is still build ${config.commitSha} after reloading for ${workerSha}; not reloading again.`);
				return;
			}

			reloading = true;
			setReloadedFor(workerSha);
			setUpdating(true);
			setTimeout(() => window.location.reload(), MIN_OVERLAY_MS);
		};

		// Asks the browser to re-fetch sw.js. If it changed, the new worker
		// installs, takes control and fires controllerchange -> reloadIfStale.
		const checkForUpdate = async () => {
			try {
				const registration = await serviceWorker.getRegistration();
				await registration?.update();
				return registration;
			} catch (error) {
				console.warn("Service worker update check failed:", error);
				return undefined;
			}
		};

		// Launch: this page came fresh from the network, but the worker in
		// control may be older (an update is still on its way) or newer (it took
		// control before React mounted, so its controllerchange was missed).
		// Check first, and only compare once no newer worker is pending.
		const checkOnLaunch = async () => {
			const registration = await checkForUpdate();
			if (!registration || disposed) return;
			const updatePending =
				registration.installing ||
				registration.waiting ||
				(registration.active && registration.active !== serviceWorker.controller);
			if (!updatePending) reloadIfStale();
		};

		// Keeps telling a waiting worker to activate until it does (see
		// NUDGE_INTERVAL_MS). Once it activates, controllerchange -> reloadIfStale.
		let nudgeTimer = null;
		const nudgeWaitingWorker = (registration) => {
			if (nudgeTimer) return;
			let attempts = 0;
			const nudge = () => {
				nudgeTimer = null;
				const waiting = registration.waiting;
				if (disposed || !waiting || attempts++ >= NUDGE_MAX_ATTEMPTS) return;
				waiting.postMessage({ type: "SKIP_WAITING" });
				nudgeTimer = setTimeout(nudge, NUDGE_INTERVAL_MS);
			};
			nudgeTimer = setTimeout(nudge, NUDGE_INTERVAL_MS);
		};

		// Watch for new workers finishing install, however the update was found
		// (our checks or the browser's own check on navigation).
		let watchedRegistration = null;
		const handleUpdateFound = () => {
			const worker = watchedRegistration?.installing;
			worker?.addEventListener("statechange", () => {
				if (worker.state === "installed") nudgeWaitingWorker(watchedRegistration);
			});
		};
		serviceWorker.ready.then((registration) => {
			if (disposed) return;
			watchedRegistration = registration;
			registration.addEventListener("updatefound", handleUpdateFound);
			if (registration.waiting) nudgeWaitingWorker(registration);
		});

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") checkForUpdate();
		};

		serviceWorker.addEventListener("controllerchange", reloadIfStale);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("online", checkForUpdate);
		checkOnLaunch();

		return () => {
			disposed = true;
			clearTimeout(nudgeTimer);
			watchedRegistration?.removeEventListener("updatefound", handleUpdateFound);
			serviceWorker.removeEventListener("controllerchange", reloadIfStale);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("online", checkForUpdate);
		};
	}, []);

	if (!ENABLED) return null;

	return (
		<Modal visible={updating} animationType="fade" statusBarTranslucent>
			<View style={styles.container}>
				<Image source={appLogo} style={styles.logo} resizeMode="contain" />
				<Text style={styles.title}>Updating ClickPrint</Text>
				<Text style={styles.subtitle}>Getting the latest version…</Text>
				<ActivityIndicator size="large" color={colors.activityIndicator} style={styles.spinner} />
			</View>
		</Modal>
	);
}

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 32,
		backgroundColor: colors.background,
	},
	logo: {
		width: 88,
		height: 88,
		borderRadius: 20,
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
		color: colors.textPrimary,
		marginTop: 20,
	},
	subtitle: {
		fontSize: 14,
		fontWeight: "500",
		color: colors.textSecondary,
		marginTop: 6,
	},
	spinner: {
		marginTop: 24,
	},
});
