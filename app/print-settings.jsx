//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import SecureStore from "../utils/storage";
import { useEffect, useState } from "react";
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { showAlert } from "../utils/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";
import DocumentSettingsForm from "./components/printSettings/DocumentSettingsForm";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

const PrintSettings = () => {
	const router = useRouter();
	const params = useLocalSearchParams();

	const { documents, draftId } = params;
	let parsedDocuments = [];
	try {
		parsedDocuments = JSON.parse(documents || "[]");
	} catch (e) {
		console.error("Failed to parse documents param:", e);
	}
	const numberOfDocuments = parsedDocuments.length || 1;

	const [currentDocIndex, setCurrentDocIndex] = useState(0);
	const [allSettings, setAllSettings] = useState(() =>
		Array.from({ length: numberOfDocuments }, () => ({
			color: "bw",
			pageType: "A4",
			orientation: "portrait",
			pagesPerSheet: 1,
			numberOfCopies: "1",
			pageSelection: "",
			sidedness: "none",
		})),
	);

	useEffect(() => {
		if (parsedDocuments.length === 0) {
			showAlert("Error", "Missing required document information.");
			router.back();
		}
	}, [router, parsedDocuments.length]);

	const handleSettingsChange = (field, value) => {
		setAllSettings((prev) => {
			const updated = [...prev];
			updated[currentDocIndex] = { ...updated[currentDocIndex], [field]: value };
			return updated;
		});
	};

	const handleMoveNext = () => {
		if (currentDocIndex < numberOfDocuments - 1) {
			setCurrentDocIndex(currentDocIndex + 1);
		}
	};

	const handleSubmitAll = () => {
		const firstSettings = allSettings[0];
		const uniformSettings = Array.from({ length: numberOfDocuments }, () => ({ ...firstSettings }));
		setAllSettings(uniformSettings);
		navigateToShopDetails(uniformSettings);
	};

	const handleCreateJob = () => {
		navigateToShopDetails(allSettings);
	};

	//--------------------------------------- NAVIGATE TO SHOP DETAILS --------------------------------------//

	const navigateToShopDetails = async (settingsArray) => {
		for (let i = 0; i < settingsArray.length; i++) {
			const s = settingsArray[i];
			if (!s.color || !s.pageType || !s.orientation || !s.sidedness || !s.numberOfCopies) {
				showAlert("Incomplete Settings", `Please complete all settings for document ${i + 1}.`);
				return;
			}
			const copies = parseInt(s.numberOfCopies);
			if (isNaN(copies) || copies < 1) {
				showAlert("Invalid Copies", `Number of copies for document ${i + 1} must be at least 1.`);
				return;
			}
		}

		// Update draft with file settings
		try {
			const token = await SecureStore.getItemAsync("authToken");
			const files = settingsArray.map((s, index) => ({
				file: parsedDocuments[index].fileId,
				settings: {
					color: s.color === "color",
					pageType: s.pageType,
					orientation: s.orientation,
					pagesPerSheet: s.pagesPerSheet,
					sidedness: s.sidedness,
					numberOfCopies: parseInt(s.numberOfCopies),
					pageSelection: s.pageSelection || "",
				},
			}));

			const response = await fetch(`${API_BASE_URL}/drafts/${draftId}`, {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ files }),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.message || "Failed to save settings.");
			}

			console.log("Draft updated with settings:", data);

			router.push({
				pathname: "/shop-details",
				params: {
					draftId,
					documents: JSON.stringify(parsedDocuments),
					allSettings: JSON.stringify(settingsArray),
				},
			});
		} catch (err) {
			console.error("Error updating draft with settings:", err);
			showAlert("Error", err.message || "Failed to save settings. Please try again.");
		}
	};

	//----------------------------------- RENDER -----------------------------------//

	const currentDoc = parsedDocuments[currentDocIndex] || { name: "Document" };

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => (currentDocIndex > 0 ? setCurrentDocIndex(currentDocIndex - 1) : router.back())} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>
					{numberOfDocuments > 1 ? `Print Settings (${currentDocIndex + 1}/${numberOfDocuments})` : "Print Settings"}
				</Text>
				<View style={styles.placeholder} />
			</View>

			<DocumentSettingsForm
				key={currentDocIndex}
				documentName={currentDoc.name}
				documentNumber={currentDocIndex + 1}
				totalDocuments={numberOfDocuments}
				settings={allSettings[currentDocIndex]}
				onSettingsChange={handleSettingsChange}
				onSubmitAll={handleSubmitAll}
				onMoveNext={handleMoveNext}
				onCreateJob={handleCreateJob}
				loading={false}
				error={null}
			/>
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
});

export default PrintSettings;
