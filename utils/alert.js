//----------------------------------- IMPORTS -----------------------------------//

import { Alert, Platform } from "react-native";

//----------------------------------- ALERT -----------------------------------//

// React Native's Alert.alert has no working button support on web: the dialog
// either doesn't render or shows no buttons, so button `onPress` callbacks never
// fire. This shim keeps the native Alert.alert on iOS/Android and falls back to
// the browser's window.alert / window.confirm on web, mapping the button array
// onto those callbacks. Signature matches Alert.alert so call sites just swap
// `Alert.alert(...)` for `showAlert(...)`.

const joinText = (title, message) => [title, message].filter(Boolean).join("\n\n");

export function showAlert(title, message, buttons) {
	if (Platform.OS !== "web") {
		Alert.alert(title, message, buttons);
		return;
	}

	const text = joinText(title, message);

	// No buttons, or a single acknowledgement button: notify then run its handler.
	if (!buttons || buttons.length === 0) {
		window.alert(text);
		return;
	}

	if (buttons.length === 1) {
		window.alert(text);
		buttons[0].onPress?.();
		return;
	}

	// Two or more buttons: treat as a confirm. The cancel-styled button (or the
	// first button) is the dismiss action; the last non-cancel button is confirm.
	const cancelBtn = buttons.find((b) => b.style === "cancel") ?? buttons[0];
	const confirmBtn = [...buttons].reverse().find((b) => b.style !== "cancel") ?? buttons[buttons.length - 1];

	if (window.confirm(text)) {
		confirmBtn?.onPress?.();
	} else {
		cancelBtn?.onPress?.();
	}
}

export default showAlert;
