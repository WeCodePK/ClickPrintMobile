//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "../utils/network";

//----------------------------------- CONSTANTS -----------------------------------//

// How long "Back online" stays up after reconnecting.
const BACK_ONLINE_MS = 2500;

// Sits just under a typical screen header, so it doesn't cover the back button
// or title. It never takes touches.
const HEADER_OFFSET = 60;

//----------------------------------- COMPONENT -----------------------------------//

// A small pill telling the user about the connection: offline (the app shows
// saved data), slow, or back online. Hidden while everything is fine.
const OfflineBanner = () => {
	const insets = useSafeAreaInsets();
	const { online, slow } = useNetworkStatus();
	const [backOnline, setBackOnline] = useState(false);
	const wasOnline = useRef(online);
	const opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (online && !wasOnline.current) {
			setBackOnline(true);
			const timer = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
			wasOnline.current = online;
			return () => clearTimeout(timer);
		}
		wasOnline.current = online;
	}, [online]);

	const mode = !online ? "offline" : backOnline ? "back" : slow ? "slow" : null;

	useEffect(() => {
		Animated.timing(opacity, { toValue: mode ? 1 : 0, duration: 200, useNativeDriver: true }).start();
	}, [mode, opacity]);

	// Keep the last message while fading out.
	const lastMode = useRef(mode);
	if (mode) lastMode.current = mode;
	const shown = mode || lastMode.current;
	if (!shown) return null;

	const content = {
		offline: { icon: "wifi-off", text: "Offline · showing saved data", style: styles.offline },
		slow: { icon: "clock", text: "Slow connection…", style: styles.slow },
		back: { icon: "wifi", text: "Back online", style: styles.back },
	}[shown];

	return (
		<View pointerEvents="none" style={[styles.wrapper, { top: insets.top + HEADER_OFFSET }]}>
			<Animated.View style={[styles.pill, content.style, { opacity }]}>
				<Feather name={content.icon} size={13} color="#FFFFFF" />
				<Text style={styles.text}>{content.text}</Text>
			</Animated.View>
		</View>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	wrapper: {
		position: "absolute",
		left: 0,
		right: 0,
		alignItems: "center",
		zIndex: 1000,
		elevation: 1000,
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
	},
	offline: {
		backgroundColor: "rgba(33, 33, 33, 0.9)",
	},
	slow: {
		backgroundColor: "rgba(230, 126, 34, 0.95)",
	},
	back: {
		backgroundColor: "rgba(46, 160, 67, 0.95)",
	},
	text: {
		color: "#FFFFFF",
		fontSize: 12,
		fontWeight: "600",
	},
});

export default OfflineBanner;
