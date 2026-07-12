//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../constants/colors";

//----------------------------------- CONSTANTS -----------------------------------//

const QUICK_AMOUNTS = [100, 200, 300, 400, 500];

//----------------------------------- HELPERS -----------------------------------//

// Amount must be a positive integer, a multiple of 10, and at least 10.
const validateAmount = (value) => {
	if (!value) return "Please enter an amount.";
	if (!/^\d+$/.test(value)) return "Amount must be a whole number (no decimals).";
	const num = Number(value);
	if (num < 10) return "Minimum top up amount is Rs. 10.";
	if (num % 10 !== 0) return "Amount must be a multiple of 10.";
	return null;
};

//----------------------------------- COMPONENTS -----------------------------------//

const TopUpAmount = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();

	const [amount, setAmount] = useState("");
	const [error, setError] = useState(null);

	const handleChange = (text) => {
		// Keep digits only so decimals / letters can never be entered.
		const digits = text.replace(/[^0-9]/g, "");
		setAmount(digits);
		if (error) setError(null);
	};

	const handleQuickSelect = (value) => {
		setAmount(String(value));
		setError(null);
	};

	const handleContinue = () => {
		const validationError = validateAmount(amount);
		if (validationError) {
			setError(validationError);
			return;
		}
		router.push({
			pathname: "/shop-details",
			params: { mode: "topup", topupAmount: amount },
		});
	};

	const isValid = validateAmount(amount) === null;

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Top Up Amount</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
				<Text style={styles.label}>Enter the amount you want to add</Text>

					<View style={[styles.amountInputWrapper, error && styles.amountInputWrapperError]}>
						<Text style={styles.currency}>Rs.</Text>
						<TextInput
							style={styles.amountInput}
							value={amount}
							onChangeText={handleChange}
							placeholder="0"
							placeholderTextColor={colors.textSecondary}
							keyboardType="number-pad"
							maxLength={7}
						/>
					</View>

					{error ? (
						<View style={styles.errorRow}>
							<Feather name="alert-circle" size={16} color={colors.printRequest} />
							<Text style={styles.errorText}>{error}</Text>
						</View>
					) : (
						<Text style={styles.helperText}>Must be a whole number, a multiple of 10, minimum Rs. 10.</Text>
					)}

					<Text style={styles.quickLabel}>Quick select</Text>
					<View style={styles.quickRow}>
						{QUICK_AMOUNTS.map((value) => (
							<TouchableOpacity
								key={value}
								style={[styles.quickChip, amount === String(value) && styles.quickChipSelected]}
								onPress={() => handleQuickSelect(value)}
							>
								<Text style={[styles.quickChipText, amount === String(value) && styles.quickChipTextSelected]}>Rs. {value}</Text>
							</TouchableOpacity>
						))}
					</View>
				</ScrollView>

				<View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
					<TouchableOpacity
						style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}
						onPress={handleContinue}
						disabled={!isValid}
					>
						<Text style={[styles.continueButtonText, !isValid && styles.continueButtonTextDisabled]}>Continue</Text>
						<Feather name="arrow-right" size={20} color={isValid ? colors.cardBackground : colors.textSecondary} />
					</TouchableOpacity>
				</View>
		</SafeAreaView>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingVertical: 16,
		backgroundColor: colors.cardBackground,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	backButton: {
		width: 40,
		height: 40,
		justifyContent: "center",
		alignItems: "center",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	placeholder: {
		width: 40,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		padding: 20,
		paddingBottom: 120,
	},
	label: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
		marginBottom: 16,
	},
	amountInputWrapper: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: colors.borderLight,
		paddingHorizontal: 20,
		paddingVertical: 18,
		gap: 10,
	},
	amountInputWrapperError: {
		borderColor: colors.printRequest,
	},
	currency: {
		fontSize: 28,
		fontWeight: "700",
		color: colors.textSecondary,
	},
	amountInput: {
		flex: 1,
		minWidth: 0,
		fontSize: 36,
		fontWeight: "700",
		color: colors.textPrimary,
		padding: 0,
	},
	helperText: {
		fontSize: 13,
		color: colors.textSecondary,
		marginTop: 12,
		lineHeight: 18,
	},
	errorRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: 12,
	},
	errorText: {
		fontSize: 13,
		color: colors.printRequest,
		flex: 1,
		lineHeight: 18,
	},
	quickLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
		marginTop: 32,
		marginBottom: 12,
	},
	quickRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
	},
	quickChip: {
		paddingHorizontal: 18,
		paddingVertical: 10,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: colors.borderLight,
		backgroundColor: colors.cardBackground,
	},
	quickChipSelected: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	quickChipText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	quickChipTextSelected: {
		color: colors.cardBackground,
	},
	footer: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: colors.cardBackground,
		padding: 20,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
		shadowColor: colors.shadowMedium,
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 8,
	},
	continueButton: {
		backgroundColor: colors.primary,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 16,
		borderRadius: 12,
		gap: 8,
	},
	continueButtonDisabled: {
		backgroundColor: colors.borderLight,
	},
	continueButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},
	continueButtonTextDisabled: {
		color: colors.textSecondary,
	},
});

export default TopUpAmount;
