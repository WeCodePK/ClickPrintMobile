//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Alert, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const { shopId, documents } = params;
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
			sidedness: "double",
		})),
	);

	useEffect(() => {
		if (!shopId || parsedDocuments.length === 0) {
			Alert.alert("Error", "Missing required document information.");
			router.back();
		}
	}, [router, shopId, parsedDocuments.length]);

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
		Alert.alert("Submit All", "Apply these settings to all documents and create the print job?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Yes",
				onPress: () => createPrintJob(uniformSettings),
			},
		]);
	};

	const handleCreateJob = () => {
		Alert.alert("Submit", "Ready to proceed?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Yes",
				onPress: () => createPrintJob(allSettings),
			},
		]);
	};

	//--------------------------------------- PRINT JOB CREATION --------------------------------------//

	const createPrintJob = async (settingsArray) => {
		const token = await SecureStore.getItemAsync("authToken");

		for (let i = 0; i < settingsArray.length; i++) {
			const s = settingsArray[i];
			if (!s.color || !s.pageType || !s.orientation || !s.sidedness || !s.numberOfCopies) {
				Alert.alert("Incomplete Settings", `Please complete all settings for document ${i + 1}.`);
				return;
			}
			const copies = parseInt(s.numberOfCopies);
			if (isNaN(copies) || copies < 1) {
				Alert.alert("Invalid Copies", `Number of copies for document ${i + 1} must be at least 1.`);
				return;
			}
		}

		const filesArray = settingsArray.map((s, index) => [
			{
				fileId: parsedDocuments[index].fileId,
				settings: {
					color: s.color === "color",
					pageType: s.pageType,
					orientation: s.orientation,
					pagesPerSheet: s.pagesPerSheet,
					pageSelection: s.pageSelection || "all",
					sidedness: s.sidedness,
					numberOfCopies: parseInt(s.numberOfCopies),
				},
			},
		]);

		try {
			setLoading(true);
			setError(null);
			let index = 0;
			for (const files of filesArray) {
				const body = {
					forShop: shopId,
					files: files,
				};
				console.log("Submitting print job with the following data:", JSON.stringify(body, null, 2));

				const response = await fetch(`${API_BASE_URL}/drafts`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(body),
				});
				const data = await response.json();
				if (response.status === 201) {
					console.log("Job created successfully for: ", parsedDocuments[index].name, data);
					index++;
				} else {
					console.log("Error creating job:", data);
					console.log("ERROR: ", data.message);
					throw new Error(data.message);
				}
			}
		} catch (err) {
			console.error("Error submitting print settings:", err);
			setError(err.message);
			Alert.alert("Error", "Failed to create print job. Please try again.");
		} finally {
			setLoading(false);
			Alert.alert("Success", "Print job(s) created successfully!", [
				{
					text: "OK",
					onPress: () => router.push("/"),
				},
			]);
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
				loading={loading}
				error={error}
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
