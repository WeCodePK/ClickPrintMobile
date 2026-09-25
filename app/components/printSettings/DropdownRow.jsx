import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../../constants/colors";

// Every dropdown is the same width (sized to fit "Flip on Short Edge"), so the
// column of controls lines up regardless of the selected value.
export const DROPDOWN_WIDTH = 200;

// A labelled setting row whose value is picked from a pop-up list.
// `options` is [{ label, value }]; onSelect only fires when the value changes.
// `disabled` greys the row out and stops the list from opening.
const DropdownRow = ({ label, options, selectedValue, onSelect, style, disabled = false }) => {
	const [open, setOpen] = useState(false);
	const selected = options.find((opt) => opt.value === selectedValue);

	return (
		<View style={[styles.settingRow, style, disabled && styles.disabled]}>
			<Text style={styles.settingLabel}>{label}</Text>
			<TouchableOpacity style={styles.dropdownButton} onPress={() => setOpen(true)} disabled={disabled}>
				<Text style={styles.dropdownButtonText} numberOfLines={1}>
					{selected ? selected.label : "Select"}
				</Text>
				<Feather name="chevron-down" size={18} color={colors.textPrimary} />
			</TouchableOpacity>

			<Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
				<TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
					<View style={styles.dropdownModal}>
						<Text style={styles.dropdownModalTitle}>{label}</Text>
						{options.map((opt) => {
							const active = opt.value === selectedValue;
							return (
								<TouchableOpacity
									key={String(opt.value)}
									style={[styles.dropdownOption, active && styles.dropdownOptionActive]}
									onPress={() => {
										setOpen(false);
										if (!active) onSelect(opt.value);
									}}
								>
									<Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>{opt.label}</Text>
									{active && <Feather name="check" size={18} color={colors.printRequest} />}
								</TouchableOpacity>
							);
						})}
					</View>
				</TouchableOpacity>
			</Modal>
		</View>
	);
};

export default DropdownRow;

const styles = StyleSheet.create({
	disabled: {
		opacity: 0.4,
	},
	settingRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	settingLabel: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
		flexShrink: 1,
	},
	dropdownButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: colors.borderLight,
		backgroundColor: colors.background,
		width: DROPDOWN_WIDTH,
		gap: 8,
	},
	dropdownButtonText: {
		flexShrink: 1,
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	dropdownModal: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		paddingVertical: 8,
		width: "75%",
		maxWidth: 300,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.15,
		shadowRadius: 24,
		elevation: 12,
	},
	dropdownModalTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
		paddingHorizontal: 20,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	dropdownOption: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 14,
		paddingHorizontal: 20,
	},
	dropdownOptionActive: {
		backgroundColor: "rgba(255, 139, 123, 0.08)",
	},
	dropdownOptionText: {
		fontSize: 15,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	dropdownOptionTextActive: {
		fontWeight: "700",
		color: colors.printRequest,
	},
});
