import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../constants/colors";
import { useShopQuery } from "../../hooks/queries";

// Status pill colours follow ClickPrintDesktop's `.db-status--*` tones.
const STATUS_CONFIG = {
	submitted: { label: "Submitted", color: colors.textSecondary, bg: "rgba(134, 150, 160, 0.15)" },
	queued: { label: "Queued", color: "#C28A00", bg: "rgba(245, 197, 24, 0.16)" },
	printing: { label: "Printing", color: colors.primary, bg: "rgba(0, 217, 163, 0.12)" },
};

// Jobs the customer can still cancel — the same rule as job-details' Cancel Job
// button. A job that's printing can't be swiped.
const CANCELLABLE_STATUSES = ["submitted", "queued", "pending", "processing"];

// TODO: placeholder until the backend sends a per-job estimate as `job.eta`.
const PLACEHOLDER_ETA = "5 - 10 mins";

// One ring pulse, and one up-and-down bob of the printer.
const PULSE_DURATION = 1600;
const BOB_DURATION = 900;

// The shimmer's band: each slice's opacity, softest at the edges.
const SHIMMER_SLICES = [0.2, 0.5, 0.8, 0.5, 0.2];
const SHIMMER_SLICE_WIDTH = 4;
const SHIMMER_WIDTH = SHIMMER_SLICES.length * SHIMMER_SLICE_WIDTH;

// The job's printer tile and time estimate, kept moving so the job reads as "in
// progress": a soft ring pulses outward from the tile while the printer bobs
// gently inside it, and a shimmer sweeps the estimate below in time with the ring.
const AnimatedPrinterIcon = ({ eta }) => {
	const pulse = useRef(new Animated.Value(0)).current;
	const bob = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		// The loop's own reset between iterations doesn't fire everywhere (the pulse
		// ran once and stuck), so snap back to 0 explicitly — invisible, since the
		// ring has faded out by then.
		const pulseLoop = Animated.loop(
			Animated.sequence([
				Animated.timing(pulse, { toValue: 1, duration: PULSE_DURATION, easing: Easing.out(Easing.quad), useNativeDriver: true }),
				Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
			])
		);
		const bobLoop = Animated.loop(
			Animated.sequence([
				Animated.timing(bob, { toValue: 1, duration: BOB_DURATION / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
				Animated.timing(bob, { toValue: 0, duration: BOB_DURATION / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
			])
		);
		pulseLoop.start();
		bobLoop.start();
		return () => {
			pulseLoop.stop();
			bobLoop.stop();
		};
	}, [pulse, bob]);

	const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
	const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
	const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
	// A shimmer sweeps across the estimate as each ring leaves the tile, then rests
	// off to the right until the next pulse.
	const [etaWidth, setEtaWidth] = useState(0);
	const shimmerX = pulse.interpolate({
		inputRange: [0, 0.6, 1],
		outputRange: [-SHIMMER_WIDTH, etaWidth, etaWidth],
	});

	return (
		<View style={styles.iconColumn}>
			<View style={styles.iconContainer}>
				<Animated.View style={[styles.iconRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
				<Animated.View style={{ transform: [{ translateY }] }}>
					<Feather name="printer" size={18} color={colors.primary} />
				</Animated.View>
			</View>
			<View style={styles.etaWrap} onLayout={(e) => setEtaWidth(e.nativeEvent.layout.width)}>
				<Text style={styles.etaText} numberOfLines={1}>
					{eta}
				</Text>
				{/* A soft band of card-coloured light, built from slices of rising then
				    falling opacity since there's no gradient library in the app. */}
				<Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerX }, { skewX: "-20deg" }] }]}>
					{SHIMMER_SLICES.map((opacity, i) => (
						<View key={i} style={[styles.shimmerSlice, { opacity }]} />
					))}
				</Animated.View>
			</View>
		</View>
	);
};

const ActiveJobCard = ({ job, onPress, onCancel, isLast = false }) => {
	const canCancel = !!onCancel && CANCELLABLE_STATUSES.includes(job.status?.toLowerCase());
	const statusConfig = STATUS_CONFIG[job.status?.toLowerCase()] || {
		label: job.status,
		color: colors.textSecondary,
		bg: colors.background,
	};

	// Shared cached lookup, so many cards for the same shop cost one request.
	const { data: shop } = useShopQuery(job.shopName ? null : job.shopId);
	const shopName = job.shopName || shop?.name || "Print Job";

	const fileLabel = `${job.fileCount} ${job.fileCount === 1 ? "file" : "files"}`;

	return (
		<View style={[styles.card, isLast && styles.cardLast]}>
			<TouchableOpacity
				style={styles.touchable}
				onPress={onPress}
				onLongPress={canCancel ? () => onCancel(job) : undefined}
				activeOpacity={0.7}
				delayLongPress={400}
			>
				<AnimatedPrinterIcon eta={job.eta ?? PLACEHOLDER_ETA} />

				<View style={styles.main}>
					{job.code ? (
						<Text style={styles.jobCode}>#{job.code}</Text>
					) : (
						<Text style={styles.jobCodeFallback}>Print Job</Text>
					)}
					<Text style={styles.who} numberOfLines={1}>
						{shopName}
						<Text style={styles.whoSecondary}> · {fileLabel}</Text>
					</Text>
				</View>

				<View style={styles.side}>
					<Text style={styles.price}>Rs. {job.cost ?? 0}</Text>
					<View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
						<Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
					</View>
				</View>
			</TouchableOpacity>
		</View>
	);
};

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.cardBackground,
		paddingVertical: 12,
		paddingLeft: 16,
		paddingRight: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	touchable: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
	},
	cardLast: {
		borderBottomWidth: 0,
	},
	main: {
		flex: 1,
		minWidth: 0,
		alignItems: "flex-start",
		gap: 5,
	},
	iconContainer: {
		width: 40,
		height: 40,
		borderRadius: 10,
		backgroundColor: colors.background,
		justifyContent: "center",
		alignItems: "center",
	},
	side: {
		alignItems: "center",
		gap: 6,
	},
	// `.job-code` badge from ClickPrintDesktop, sized up as the row's headline.
	jobCode: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 6,
		overflow: "hidden",
		backgroundColor: "rgba(0, 217, 163, 0.14)",
		color: colors.textPrimary,
		fontSize: 16,
		fontWeight: "700",
		letterSpacing: 0.6,
		fontVariant: ["tabular-nums"],
	},
	iconRing: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		borderRadius: 10,
		borderWidth: 2,
		borderColor: colors.primary,
	},
	// The printer tile with its time estimate tucked underneath.
	iconColumn: {
		alignItems: "center",
		gap: 5,
	},
	etaWrap: {
		overflow: "hidden",
	},
	shimmer: {
		position: "absolute",
		top: 0,
		bottom: 0,
		left: 0,
		flexDirection: "row",
	},
	shimmerSlice: {
		width: SHIMMER_SLICE_WIDTH,
		backgroundColor: colors.cardBackground,
	},
	etaText: {
		fontSize: 10,
		fontWeight: "600",
		color: colors.textSecondary,
		fontVariant: ["tabular-nums"],
	},
	jobCodeFallback: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	statusBadge: {
		paddingHorizontal: 7,
		paddingVertical: 2,
		borderRadius: 100,
	},
	statusText: {
		fontSize: 10,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 0.3,
	},
	who: {
		maxWidth: "100%",
		fontSize: 12.5,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	whoSecondary: {
		fontWeight: "500",
		color: colors.textSecondary,
	},
	price: {
		fontSize: 14,
		fontWeight: "700",
		color: colors.primary,
		fontVariant: ["tabular-nums"],
	},

});

export default ActiveJobCard;
