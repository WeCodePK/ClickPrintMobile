import { Feather } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { colors } from "../constants/colors";

// How far (after resistance) the user must pull before letting go triggers a refresh.
const PULL_THRESHOLD = 70;
// The furthest the indicator can be dragged down.
const MAX_PULL = 110;
// Where the indicator rests while a refresh is in progress.
const REFRESHING_OFFSET = 60;
// Finger movement is damped so the pull feels elastic.
const PULL_RESISTANCE = 0.5;
const INDICATOR_SIZE = 40;

// A ScrollView with pull-to-refresh on every platform. Native uses the built-in
// RefreshControl, but react-native-web renders RefreshControl as a no-op, so on
// web (the PWA) we detect the pull gesture from touch events ourselves and draw
// a spinner that slides down from the top, like Android's native one.
const PullToRefreshScrollView = ({ refreshing, onRefresh, children, ...props }) => {
	if (Platform.OS === "web") {
		return (
			<WebPullToRefreshScrollView refreshing={refreshing} onRefresh={onRefresh} {...props}>
				{children}
			</WebPullToRefreshScrollView>
		);
	}
	return (
		<ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />} {...props}>
			{children}
		</ScrollView>
	);
};

const WebPullToRefreshScrollView = ({ refreshing, onRefresh, children, style, ...props }) => {
	const scrollRef = useRef(null);
	const pull = useRef(new Animated.Value(0)).current;

	// The touch listeners are attached once, so they read the latest props through refs.
	const refreshingRef = useRef(refreshing);
	const onRefreshRef = useRef(onRefresh);
	refreshingRef.current = refreshing;
	onRefreshRef.current = onRefresh;

	const animatePull = (toValue) => {
		Animated.timing(pull, { toValue, duration: 200, useNativeDriver: false }).start();
	};

	// Hold the indicator in place while refreshing, then tuck it away once done.
	useEffect(() => {
		animatePull(refreshing ? REFRESHING_OFFSET : 0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [refreshing]);

	useEffect(() => {
		const host = scrollRef.current;
		const node = host?.getScrollableNode?.() ?? host;
		if (!node?.addEventListener) return;

		let startY = null;
		let pulling = false;
		let distance = 0;

		const onTouchStart = (e) => {
			// Only track a pull that starts while the list is scrolled to the very top.
			startY = node.scrollTop <= 0 && !refreshingRef.current ? e.touches[0].clientY : null;
			pulling = false;
			distance = 0;
		};

		const onTouchMove = (e) => {
			if (startY === null) return;
			const dy = e.touches[0].clientY - startY;
			if (!pulling) {
				// The first movement decides: dragging down at the top is a pull, anything else is a normal scroll.
				if (dy < 0 || node.scrollTop > 0) {
					startY = null;
					return;
				}
				if (dy === 0) return;
				pulling = true;
			}
			// Stop the browser from scrolling, bouncing, or reloading the page with its own pull-to-refresh.
			if (e.cancelable) e.preventDefault();
			distance = Math.max(0, Math.min(MAX_PULL, dy * PULL_RESISTANCE));
			pull.setValue(distance);
		};

		const onTouchEnd = () => {
			if (!pulling) {
				startY = null;
				return;
			}
			const shouldRefresh = distance >= PULL_THRESHOLD;
			startY = null;
			pulling = false;
			distance = 0;
			if (shouldRefresh) {
				animatePull(REFRESHING_OFFSET);
				onRefreshRef.current?.();
			} else {
				animatePull(0);
			}
		};

		node.addEventListener("touchstart", onTouchStart, { passive: true });
		node.addEventListener("touchmove", onTouchMove, { passive: false });
		node.addEventListener("touchend", onTouchEnd);
		node.addEventListener("touchcancel", onTouchEnd);
		return () => {
			node.removeEventListener("touchstart", onTouchStart);
			node.removeEventListener("touchmove", onTouchMove);
			node.removeEventListener("touchend", onTouchEnd);
			node.removeEventListener("touchcancel", onTouchEnd);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const translateY = pull.interpolate({
		inputRange: [0, MAX_PULL],
		outputRange: [-INDICATOR_SIZE, MAX_PULL - INDICATOR_SIZE],
		extrapolate: "clamp",
	});
	const opacity = pull.interpolate({ inputRange: [0, 30], outputRange: [0, 1], extrapolate: "clamp" });
	const rotate = pull.interpolate({ inputRange: [0, MAX_PULL], outputRange: ["0deg", "360deg"], extrapolate: "clamp" });

	return (
		<View style={[styles.wrapper, style]}>
			<ScrollView ref={scrollRef} style={styles.fill} {...props}>
				{children}
			</ScrollView>
			<Animated.View style={[styles.indicatorContainer, { opacity, transform: [{ translateY }] }]}>
				<View style={styles.indicator}>
					{refreshing ? (
						<ActivityIndicator size="small" color={colors.primary} />
					) : (
						<Animated.View style={{ transform: [{ rotate }] }}>
							<Feather name="refresh-cw" size={18} color={colors.primary} />
						</Animated.View>
					)}
				</View>
			</Animated.View>
		</View>
	);
};

const styles = StyleSheet.create({
	wrapper: {
		overflow: "hidden",
	},
	fill: {
		flex: 1,
	},
	indicatorContainer: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		alignItems: "center",
		pointerEvents: "none",
	},
	indicator: {
		width: INDICATOR_SIZE,
		height: INDICATOR_SIZE,
		borderRadius: INDICATOR_SIZE / 2,
		backgroundColor: colors.cardBackground,
		justifyContent: "center",
		alignItems: "center",
		shadowColor: colors.shadowMedium,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 4,
	},
});

export default PullToRefreshScrollView;
