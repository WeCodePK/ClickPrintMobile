import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

// Returns how many pixels the on-screen keyboard covers at the bottom of the
// screen (plus a small gap), or 0 while it is closed. Pad a screen's bottom by
// this so content pinned to the bottom stays visible above the keyboard.
export const useKeyboardOffset = (extraOffset = 20) => {
	const [keyboardOffset, setKeyboardOffset] = useState(0);

	useEffect(() => {
		if (Platform.OS === "web") {
			// On web the keyboard shrinks the visual viewport rather than firing
			// keyboard events, so measure how much of the window it hides.
			const viewport = typeof window !== "undefined" ? window.visualViewport : null;
			if (!viewport) return;

			const handleViewportChange = () => {
				const offset = window.innerHeight - viewport.height - viewport.offsetTop;
				setKeyboardOffset(offset > 0 ? offset + extraOffset : 0);
			};

			viewport.addEventListener("resize", handleViewportChange);
			viewport.addEventListener("scroll", handleViewportChange);

			return () => {
				viewport.removeEventListener("resize", handleViewportChange);
				viewport.removeEventListener("scroll", handleViewportChange);
			};
		}

		const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

		const showSub = Keyboard.addListener(showEvent, (e) => {
			setKeyboardOffset(e.endCoordinates.height + extraOffset);
		});
		const hideSub = Keyboard.addListener(hideEvent, () => {
			setKeyboardOffset(0);
		});

		return () => {
			showSub.remove();
			hideSub.remove();
		};
	}, [extraOffset]);

	return keyboardOffset;
};
