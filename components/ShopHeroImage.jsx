//----------------------------------- IMPORTS -----------------------------------//

import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import ShopImage from "./ShopImage";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/colors";

//----------------------------------- HELPERS -----------------------------------//

const toMinutes = (hhmm) => {
	const [h, m] = hhmm.split(":").map(Number);
	return h * 60 + m;
};

// Parses a backend timing entry ("Closed" or "HH:MM-HH:MM") into minutes.
const parseRange = (timing) => {
	if (typeof timing !== "string") return null;
	const match = timing.trim().match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
	if (!match) return null; // "Closed" or anything unexpected
	return { start: toMinutes(match[1]), end: toMinutes(match[2]) };
};

// `timings` is 7 entries, Monday first (same order the screen displays).
// A range whose end is not after its start runs past midnight, so the
// previous day's range can still be open in the early hours of today.
// Returns null when there are no usable timings.
export const isShopOpen = (timings, now = new Date()) => {
	if (!Array.isArray(timings) || timings.length !== 7) return null;

	const todayIndex = (now.getDay() + 6) % 7; // JS: 0=Sun -> 0=Mon
	const yesterdayIndex = (todayIndex + 6) % 7;
	const minutes = now.getHours() * 60 + now.getMinutes();

	const today = parseRange(timings[todayIndex]);
	if (today) {
		const overnight = today.end <= today.start;
		if (overnight ? minutes >= today.start : minutes >= today.start && minutes < today.end) return true;
	}

	const yesterday = parseRange(timings[yesterdayIndex]);
	if (yesterday && yesterday.end <= yesterday.start && minutes < yesterday.end) return true;

	return false;
};

// Re-renders once a minute so the open/closed chip flips on time.
const useMinuteTick = () => {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 60 * 1000);
		return () => clearInterval(id);
	}, []);
	return now;
};

//----------------------------------- COMPONENTS -----------------------------------//

const Skeleton = () => {
	const opacity = useRef(new Animated.Value(0.5)).current;

	useEffect(() => {
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
				Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
			])
		);
		loop.start();
		return () => loop.stop();
	}, [opacity]);

	return <Animated.View style={[StyleSheet.absoluteFill, styles.skeleton, { opacity }]} />;
};

const Fallback = () => (
	<LinearGradient
		colors={["rgba(255, 139, 123, 0.18)", "rgba(0, 217, 163, 0.18)"]}
		start={{ x: 0, y: 0 }}
		end={{ x: 1, y: 1 }}
		style={[StyleSheet.absoluteFill, styles.fallback]}
	>
		<MaterialCommunityIcons name="storefront-outline" size={56} color={colors.printRequest} />
	</LinearGradient>
);

// The photo with its own load/error state. Keyed by the parent on the source,
// so a new source (or the auth header arriving) starts a fresh attempt.
const HeroPhoto = ({ source }) => {
	const [status, setStatus] = useState(source ? "loading" : "failed");

	return (
		<>
			{status === "failed" ? (
				<Fallback />
			) : (
				<>
					{status === "loading" && <Skeleton />}
					<ShopImage
						source={source}
						style={StyleSheet.absoluteFill}
						contentFit="cover"
						transition={200}
						onLoad={() => setStatus("loaded")}
						onError={() => setStatus("failed")}
					/>
				</>
			)}
		</>
	);
};

/**
 * Inset hero card for a shop: photo (with skeleton + fallback), a bottom
 * gradient carrying the name and address, an open/closed chip computed from
 * `timings`, and a back button.
 *
 * `imageSource` is an expo-image source (use `useFileSource`, since shop
 * images need the auth header). Pass `isOpen` to override the computed status.
 */
const ShopHeroImage = ({ imageSource, name, address, timings, isOpen, onBackPress, style }) => {
	const now = useMinuteTick();
	const open = typeof isOpen === "boolean" ? isOpen : isShopOpen(timings, now);
	const sourceKey = imageSource ? `${imageSource.uri}|${imageSource.headers?.Authorization || ""}` : "none";

	return (
		<View style={[styles.shadowWrap, style]}>
			<View style={styles.container}>
				<HeroPhoto key={sourceKey} source={imageSource} />

				<LinearGradient
					colors={["transparent", "rgba(0, 0, 0, 0.75)"]}
					style={styles.gradient}
					pointerEvents="none"
				/>

				{onBackPress && (
					<TouchableOpacity
						style={styles.backButton}
						onPress={onBackPress}
						activeOpacity={0.8}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="Go back"
					>
						<Feather name="arrow-left" size={22} color={colors.textPrimary} />
					</TouchableOpacity>
				)}

				{open !== null && (
					<View style={[styles.chip, open ? styles.chipOpen : styles.chipClosed]}>
						<Text style={styles.chipText}>{open ? "Open now" : "Closed"}</Text>
					</View>
				)}

				<View style={styles.textBlock} pointerEvents="none">
					<Text style={styles.name} numberOfLines={2}>
						{name}
					</Text>
					{!!address && (
						<View style={styles.addressRow}>
							<Feather name="map-pin" size={13} color="rgba(255, 255, 255, 0.85)" style={styles.addressIcon} />
							<Text style={styles.address} numberOfLines={2}>
								{address}
							</Text>
						</View>
					)}
				</View>
			</View>
		</View>
	);
};

//----------------------------------- STYLES -----------------------------------//

const RADIUS = 24;

const styles = StyleSheet.create({
	// Shadow sits on an outer view because the inner one clips (overflow hidden).
	shadowWrap: {
		marginHorizontal: 16,
		marginTop: 12,
		height: 210,
		borderRadius: RADIUS,
		backgroundColor: colors.cardBackground,
		shadowColor: colors.shadowMedium,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 4,
	},
	container: {
		flex: 1,
		borderRadius: RADIUS,
		overflow: "hidden",
		backgroundColor: colors.background,
	},
	skeleton: {
		backgroundColor: colors.borderLight,
	},
	fallback: {
		justifyContent: "center",
		alignItems: "center",
	},
	gradient: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: "60%",
	},
	backButton: {
		position: "absolute",
		top: 12,
		left: 12,
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(255, 255, 255, 0.85)",
		justifyContent: "center",
		alignItems: "center",
	},
	chip: {
		position: "absolute",
		top: 12,
		right: 12,
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	chipOpen: {
		backgroundColor: colors.primaryDark,
	},
	chipClosed: {
		backgroundColor: colors.danger,
	},
	chipText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	textBlock: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		padding: 16,
	},
	name: {
		fontSize: 24,
		fontWeight: "700",
		color: "#FFFFFF",
		textShadowColor: "rgba(0, 0, 0, 0.35)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 4,
	},
	addressRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginTop: 4,
		gap: 6,
	},
	addressIcon: {
		marginTop: 2,
	},
	address: {
		flex: 1,
		fontSize: 13,
		lineHeight: 18,
		color: "rgba(255, 255, 255, 0.85)",
		textShadowColor: "rgba(0, 0, 0, 0.35)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 3,
	},
});

export default ShopHeroImage;
