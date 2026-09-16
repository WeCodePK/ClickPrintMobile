//----------------------------------- IMPORTS -----------------------------------//

import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/colors";
import { registerAlertHandler } from "../utils/alert";

//----------------------------------- CUSTOM ALERT -----------------------------------//

// A single, app-wide custom alert popup that replaces React Native's Alert.alert
// and the browser's window.alert / window.confirm. `AlertHost` is mounted once at
// the root of the app; it registers an imperative handler that `showAlert` (in
// utils/alert.js) calls. Because the API is imperative, call sites keep using
// `showAlert(title, message, buttons)` unchanged — the look is what changes.

// Normalize whatever was passed for `buttons` into a consistent array. When no
// buttons are provided we show a single "OK" acknowledgement, matching the old
// Alert.alert behaviour.
function normalizeButtons(buttons) {
	if (!Array.isArray(buttons) || buttons.length === 0) {
		return [{ text: "OK", style: "default" }];
	}
	return buttons;
}

export default function AlertHost() {
	const [config, setConfig] = useState(null); // { title, message, buttons }
	const [visible, setVisible] = useState(false);

	// Animated backdrop + card entrance.
	const overlayOpacity = useRef(new Animated.Value(0)).current;
	const cardScale = useRef(new Animated.Value(0.92)).current;

	// When one alert dismisses while another is queued we swap content only after
	// the exit animation finishes; this ref holds the next config to show.
	const pendingRef = useRef(null);

	const runOpenAnimation = useCallback(() => {
		overlayOpacity.setValue(0);
		cardScale.setValue(0.92);
		Animated.parallel([
			Animated.timing(overlayOpacity, {
				toValue: 1,
				duration: 160,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			}),
			Animated.spring(cardScale, {
				toValue: 1,
				friction: 7,
				tension: 80,
				useNativeDriver: true,
			}),
		]).start();
	}, [overlayOpacity, cardScale]);

	// Register the imperative handler once. showAlert() elsewhere calls this.
	useEffect(() => {
		const unregister = registerAlertHandler((nextConfig) => {
			setConfig((current) => {
				if (current) {
					// An alert is already showing — queue the new one.
					pendingRef.current = nextConfig;
					return current;
				}
				return nextConfig;
			});
			setVisible((wasVisible) => {
				if (!wasVisible) return true;
				return wasVisible;
			});
		});
		return unregister;
	}, []);

	useEffect(() => {
		if (visible && config) runOpenAnimation();
	}, [visible, config, runOpenAnimation]);

	const close = useCallback(
		(onPress) => {
			Animated.parallel([
				Animated.timing(overlayOpacity, {
					toValue: 0,
					duration: 130,
					easing: Easing.in(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(cardScale, {
					toValue: 0.95,
					duration: 130,
					easing: Easing.in(Easing.quad),
					useNativeDriver: true,
				}),
			]).start(() => {
				// Fire the button callback after the popup is gone so any navigation
				// or follow-up alert it triggers doesn't fight the animation.
				onPress?.();

				const queued = pendingRef.current;
				pendingRef.current = null;
				if (queued) {
					setConfig(queued);
					// Keep the modal mounted and re-run the open animation.
					requestAnimationFrame(runOpenAnimation);
				} else {
					setVisible(false);
					setConfig(null);
				}
			});
		},
		[overlayOpacity, cardScale, runOpenAnimation]
	);

	if (!config) return null;

	const { title, message } = config;
	const buttons = normalizeButtons(config.buttons);
	// iOS-style layout: exactly two buttons sit side by side; otherwise stack.
	const isRow = buttons.length === 2;

	return (
		<Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
			<Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
				{/* Tapping the backdrop dismisses via the cancel button if there is one. */}
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={() => {
						const cancel = buttons.find((b) => b.style === "cancel");
						if (cancel) close(cancel.onPress);
					}}
				/>

				<Animated.View style={[styles.card, { transform: [{ scale: cardScale }] }]}>
					{!!title && <Text style={styles.title}>{title}</Text>}
					{!!message && <Text style={[styles.message, !title && styles.messageNoTitle]}>{message}</Text>}

					<View style={[styles.buttonRow, isRow ? styles.buttonRowHorizontal : styles.buttonRowVertical]}>
						{buttons.map((button, index) => {
							const isDestructive = button.style === "destructive";
							const isCancel = button.style === "cancel";
							return (
								<Pressable
									key={`${button.text}-${index}`}
									style={({ pressed }) => [
										styles.button,
										isRow ? styles.buttonHorizontal : styles.buttonVertical,
										isCancel ? styles.buttonCancel : styles.buttonPrimary,
										isDestructive && styles.buttonDestructive,
										pressed && styles.buttonPressed,
									]}
									onPress={() => close(button.onPress)}
								>
									<Text
										style={[
											styles.buttonText,
											isCancel ? styles.buttonTextCancel : styles.buttonTextPrimary,
											isDestructive && styles.buttonTextDestructive,
										]}
									>
										{button.text}
									</Text>
								</Pressable>
							);
						})}
					</View>
				</Animated.View>
			</Animated.View>
		</Modal>
	);
}

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(26, 31, 54, 0.45)",
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
	},
	card: {
		width: "100%",
		maxWidth: 380,
		backgroundColor: colors.cardBackground,
		borderRadius: 24,
		paddingTop: 26,
		paddingHorizontal: 24,
		paddingBottom: 20,
		shadowColor: colors.textPrimary,
		shadowOffset: { width: 0, height: 12 },
		shadowOpacity: 0.22,
		shadowRadius: 28,
		elevation: 12,
	},
	title: {
		fontSize: 19,
		fontWeight: "700",
		color: colors.textPrimary,
		textAlign: "center",
		marginBottom: 8,
	},
	message: {
		fontSize: 15,
		lineHeight: 22,
		color: colors.textSecondary,
		textAlign: "center",
		marginBottom: 22,
	},
	messageNoTitle: {
		fontSize: 16,
		color: colors.textPrimary,
		marginTop: 4,
	},
	buttonRow: {
		gap: 10,
	},
	buttonRowHorizontal: {
		flexDirection: "row",
	},
	buttonRowVertical: {
		flexDirection: "column",
	},
	button: {
		borderRadius: 14,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonHorizontal: {
		flex: 1,
	},
	buttonVertical: {
		width: "100%",
	},
	buttonPrimary: {
		backgroundColor: colors.printRequest,
	},
	buttonCancel: {
		backgroundColor: colors.background,
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	buttonDestructive: {
		backgroundColor: colors.danger,
	},
	buttonPressed: {
		opacity: 0.75,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "600",
	},
	buttonTextPrimary: {
		color: "#FFFFFF",
	},
	buttonTextCancel: {
		color: colors.textPrimary,
	},
	buttonTextDestructive: {
		color: "#FFFFFF",
	},
});
