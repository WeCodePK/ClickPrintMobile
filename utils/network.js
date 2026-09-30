//----------------------------------- IMPORTS -----------------------------------//

import NetInfo from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";
import config from "../config/config";

//----------------------------------- CONSTANTS -----------------------------------//

// The backend's health check lives at the API root, not under /api. It returns
// 200 while the server and its database are up.
const HEALTH_URL = `${config.apiBaseUrl.replace(/\/api\/?$/, "")}/health`;

// How long the "slow connection" hint stays up after a slow request.
const SLOW_HINT_MS = 30000;

//----------------------------------- STATE -----------------------------------//

// Connectivity as far as the app is concerned. `online` is false only when
// the device reports no network or the backend's health check fails, so an
// unknown state (e.g. right at launch) counts as online and requests go ahead.
let state = { online: true, slow: false };
const listeners = new Set();

const setState = (changes) => {
	const next = { ...state, ...changes };
	if (next.online === state.online && next.slow === state.slow) return;
	state = next;
	listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

NetInfo.configure({
	reachabilityUrl: HEALTH_URL,
	reachabilityTest: async (response) => response.status === 200,
	reachabilityShortTimeout: 5000,
	reachabilityLongTimeout: 60000,
	reachabilityRequestTimeout: 10000,
	useNativeReachability: false,
});

NetInfo.addEventListener((info) => {
	setState({ online: info.isConnected !== false && info.isInternetReachable !== false });
});

//----------------------------------- API -----------------------------------//

export const isOnline = () => state.online;

// Marks the connection as slow for a while (called by requests that take long).
let slowTimer = null;
export const reportSlow = () => {
	clearTimeout(slowTimer);
	setState({ slow: true });
	slowTimer = setTimeout(() => setState({ slow: false }), SLOW_HINT_MS);
};

// Calls `listener(online)` whenever connectivity changes. Returns an unsubscribe.
export const onOnlineChange = (listener) => {
	let last = state.online;
	return subscribe(() => {
		if (state.online !== last) {
			last = state.online;
			listener(state.online);
		}
	});
};

// Resolves true once back online, or false after `timeout` ms / on abort.
export const waitForOnline = ({ timeout = Infinity, signal } = {}) =>
	new Promise((resolve) => {
		if (state.online) return resolve(true);
		let timer = null;
		const done = (value) => {
			unsubscribe();
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			resolve(value);
		};
		const onAbort = () => done(false);
		const unsubscribe = onOnlineChange((online) => online && done(true));
		if (Number.isFinite(timeout)) timer = setTimeout(() => done(false), timeout);
		signal?.addEventListener("abort", onAbort);
	});

// Asks NetInfo to check again right away (e.g. after a request failed).
export const recheckConnection = () => NetInfo.refresh().catch(() => {});

// { online, slow } for components; re-renders on change.
export const useNetworkStatus = () => useSyncExternalStore(subscribe, () => state, () => state);
