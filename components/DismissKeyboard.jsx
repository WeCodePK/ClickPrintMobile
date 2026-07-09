import { Keyboard, Platform, TouchableWithoutFeedback } from "react-native";

// Wraps a screen so tapping outside an input dismisses the keyboard on native.
// On web, TouchableWithoutFeedback captures the click before it reaches the
// TextInput (preventing focus), and there is no on-screen keyboard to dismiss,
// so we render children directly there.
const DismissKeyboard = ({ children }) => {
	if (Platform.OS === "web") {
		return children;
	}
	return (
		<TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
			{children}
		</TouchableWithoutFeedback>
	);
};

export default DismissKeyboard;
