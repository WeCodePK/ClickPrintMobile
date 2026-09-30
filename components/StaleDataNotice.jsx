//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../constants/colors";

//----------------------------------- HELPERS -----------------------------------//

// "just now", "5 min ago", "3 h ago", "2 days ago".
export const formatAge = (timestamp) => {
	if (!timestamp) return null;
	const minutes = Math.floor((Date.now() - timestamp) / 60000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} h ago`;
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
};

//----------------------------------- COMPONENT -----------------------------------//

// Inline notice for a screen whose latest refresh failed. With saved data it
// says how old that data is; without, it explains nothing could be loaded.
// Either way it offers a retry, and the screen keeps showing what it has.
const StaleDataNotice = ({ error, updatedAt, hasData, onRetry, retrying, style }) => {
	if (!error) return null;
	const age = formatAge(updatedAt);
	const message = hasData
		? `Couldn't refresh${age ? ` · updated ${age}` : ""}`
		: error;

	return (
		<View style={[styles.container, style]}>
			<Feather name="wifi-off" size={16} color={colors.dangerDark} />
			<Text style={styles.text}>{message}</Text>
			{onRetry && (
				<TouchableOpacity onPress={onRetry} style={styles.button} disabled={retrying} activeOpacity={0.7}>
					<Text style={styles.buttonText}>{retrying ? "Retrying…" : "Retry"}</Text>
				</TouchableOpacity>
			)}
		</View>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: colors.cardBackground,
		borderRadius: 12,
		padding: 12,
		marginBottom: 16,
	},
	text: {
		flex: 1,
		fontSize: 13,
		color: colors.textPrimary,
	},
	button: {
		backgroundColor: colors.primary,
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 8,
	},
	buttonText: {
		color: colors.cardBackground,
		fontWeight: "600",
		fontSize: 14,
	},
});

export default StaleDataNotice;
