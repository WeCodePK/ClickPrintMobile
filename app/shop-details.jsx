//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import SecureStore from "../utils/storage";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { showAlert } from "../utils/alert";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- HELPERS -----------------------------------//

const calculateShopScore = (shop, settingsArray) => {
	if (!shop.capabilities || shop.capabilities.length === 0) return 0;

	let score = 0;
	const caps = shop.capabilities.map((c) => c.toLowerCase());

	for (const settings of settingsArray) {
		if (settings.color === "color" && caps.includes("color")) score += 3;
		if (settings.color === "bw" && caps.includes("bw")) score += 3;
		if (settings.pageType === "A4" && caps.includes("a4")) score += 2;
		if (settings.pageType === "A3" && caps.includes("a3")) score += 2;
		if (settings.sidedness !== "none" && caps.includes("duplex")) score += 2;
	}
	if (shop.isOnline) score += 5;

	return score;
};

//----------------------------------- COMPONENTS -----------------------------------//

const ShopDetails = () => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const params = useLocalSearchParams();

	const [shops, setShops] = useState([]);
	const [selectedShop, setSelectedShop] = useState(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [onlineOnly, setOnlineOnly] = useState(false);

	// Parse params from print-settings
	let parsedDocuments = [];
	let parsedSettings = [];
	const draftId = params.draftId;
	try {
		parsedDocuments = JSON.parse(params.documents || "[]");
		parsedSettings = JSON.parse(params.allSettings || "[]");
	} catch (e) {
		console.error("Failed to parse params:", e);
	}

	// Sort shops by match score then filter by search
	const sortedShops = [...shops].sort((a, b) => {
		const scoreA = calculateShopScore(a, parsedSettings);
		const scoreB = calculateShopScore(b, parsedSettings);
		return scoreB - scoreA;
	});

	const filteredShops = sortedShops
		.filter((shop) => shop.name.toLowerCase().includes(searchQuery.toLowerCase()))
		.filter((shop) => !onlineOnly || shop.isOnline);

	useEffect(() => {
		if (parsedDocuments.length === 0 || parsedSettings.length === 0) {
			showAlert("Error", "Missing required information. Please go back.");
			router.back();
			return;
		}
		fetchShops();
	}, [parsedDocuments.length, parsedSettings.length, router]);

	const fetchShops = async () => {
		try {
			setLoading(true);
			setError(null);
			const token = await SecureStore.getItemAsync("authToken");
			const response = await fetch(`${API_BASE_URL}/shops`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			setShops(data.data?.shops || []);
		} catch (err) {
			console.error("Error fetching shops:", err);
			setError(err.message || "Failed to load shops. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleShopSelect = (shop) => {
		setSelectedShop(shop._id);
	};

	const handleContinue = async () => {
		if (!selectedShop) {
			showAlert("No Shop Selected", "Please select a print shop to continue.");
			return;
		}

		try {
			setSubmitting(true);
			setError(null);
			const token = await SecureStore.getItemAsync("authToken");

			// Step 1: Update draft with selected shop
			const updateResponse = await fetch(`${API_BASE_URL}/drafts/${draftId}`, {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ shop: selectedShop }),
			});
			const updateData = await updateResponse.json();
			if (!updateResponse.ok) {
				throw new Error(updateData.message || "Failed to update shop.");
			}
			console.log("Draft updated with shop:", updateData);

			// Step 2: Check draft to calculate cost
			const checkResponse = await fetch(`${API_BASE_URL}/drafts/${draftId}/check`, {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
			const checkData = await checkResponse.json();
			if (!checkResponse.ok) {
				throw new Error(checkData.message || "Failed to calculate cost.");
			}
			console.log("Draft checked with cost:", checkData);

			// Navigate to draft-details with the full checked draft
			router.push({
				pathname: "/draft-details",
				params: { draft: JSON.stringify(checkData.data.draft) },
			});
		} catch (err) {
			console.error("Error processing draft:", err);
			setError(err.message);
			showAlert("Error", err.message || "Failed to process draft. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Select Print Shop</Text>
				<View style={styles.placeholder} />
			</View>

			<View style={styles.searchContainer}>
				<TextInput
					style={styles.searchInput}
					placeholder="🔎   Search shops..."
					placeholderTextColor={colors.textSecondary}
					value={searchQuery}
					onChangeText={setSearchQuery}
					returnKeyType="search"
					clearButtonMode="while-editing"
				/>
				<View style={styles.onlineToggle}>
					<Text style={styles.onlineToggleLabel}>Online Shops</Text>
					<Switch
						value={onlineOnly}
						onValueChange={setOnlineOnly}
						trackColor={{ false: colors.borderLight, true: colors.primary }}
						thumbColor={colors.cardBackground}
					/>
				</View>
			</View>

			{/* Priority info banner */}
			<View style={styles.priorityBanner}>
				<Feather name="zap" size={16} color={colors.primary} />
				<Text style={styles.priorityBannerText}>Shops are sorted by best match for your print settings</Text>
			</View>

			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={styles.loadingText}>Loading shops...</Text>
				</View>
			) : error && shops.length === 0 ? (
				<View style={styles.errorContainer}>
					<Feather name="alert-circle" size={48} color={colors.expense} />
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity style={styles.retryButton} onPress={fetchShops}>
						<Text style={styles.retryButtonText}>Retry</Text>
					</TouchableOpacity>
				</View>
			) : shops.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Feather name="inbox" size={48} color={colors.textSecondary} />
					<Text style={styles.emptyText}>No print shops available</Text>
					<TouchableOpacity style={styles.retryButton} onPress={fetchShops}>
						<Text style={styles.retryButtonText}>Refresh</Text>
					</TouchableOpacity>
				</View>
			) : (
				<>
					<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
						{filteredShops.length === 0 ? (
							<View style={styles.emptyContainer}>
								<Feather name={onlineOnly ? "wifi-off" : "search"} size={48} color={colors.textSecondary} />
								<Text style={styles.emptyText}>{onlineOnly ? "No shops online" : `No shops match "${searchQuery}"`}</Text>
							</View>
						) : (
							filteredShops.map((shop) => (
								<ShopCard
									key={shop._id}
									shop={shop}
									isSelected={selectedShop && selectedShop === shop._id}
									onSelect={() => handleShopSelect(shop)}
								/>
							))
						)}
					</ScrollView>

					<View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
						<TouchableOpacity
							style={[styles.continueButton, (!selectedShop || submitting) && styles.continueButtonDisabled]}
							onPress={handleContinue}
							disabled={!selectedShop || submitting}
						>
							{submitting ? (
								<ActivityIndicator color={colors.activityIndicator} />
							) : (
								<>
									<Text style={styles.continueButtonText}>Continue</Text>
									<Feather name="arrow-right" size={20} color={colors.cardBackground} />
								</>
							)}
						</TouchableOpacity>
					</View>
				</>
			)}
		</SafeAreaView>
	);
};

const ShopCard = ({ shop, isSelected, onSelect }) => {
	const router = useRouter();

	return (
		<TouchableOpacity style={[styles.shopCard, isSelected && styles.shopCardSelected]} onPress={onSelect} activeOpacity={0.7}>
			<View style={[styles.shopIcon, isSelected && styles.shopIconSelected]}>
				{shop.imageUrl ? (
					<Image source={{ uri: shop.imageUrl }} style={styles.shopImage} />
				) : (
					<Feather name="shopping-bag" size={24} color={isSelected ? colors.printRequest : colors.textSecondary} />
				)}
			</View>

			<View style={styles.shopInfo}>
				<View style={styles.shopNameRow}>
					<Text style={[styles.shopName, isSelected && styles.shopNameSelected]}>{shop.name}</Text>
				</View>
				<Text style={styles.shopAddress}>{shop.address}</Text>
				<View style={styles.shopMeta}>
					<View style={[styles.statusDot, shop.isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
					<Text style={[styles.statusText, shop.isOnline ? styles.statusTextOnline : styles.statusTextOffline]}>
						{shop.isOnline ? "Online" : "Offline"}
					</Text>
				</View>
			</View>
			{isSelected && (
				<View style={styles.selectionActions}>
					
					<TouchableOpacity 
						style={styles.detailsButton} 
						onPress={(e) => {
							e.stopPropagation();
							router.push(`/shop/${shop._id}`);
						}}
					>
						<Feather name="chevron-right" size={24} color={colors.textPrimary} />
					</TouchableOpacity>
				</View>
			)}
		</TouchableOpacity>
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
	searchContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: colors.cardBackground,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
		paddingHorizontal: 20,
		paddingVertical: 10,
	},
	onlineToggle: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	onlineToggleLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	searchInput: {
		width: "50%",
		fontSize: 15,
		color: colors.textPrimary,
		paddingVertical: 5,
		paddingHorizontal: 10,
		backgroundColor: colors.background,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	priorityBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 20,
		paddingVertical: 10,
		backgroundColor: "rgba(0, 217, 163, 0.08)",
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	priorityBannerText: {
		fontSize: 12,
		fontWeight: "600",
		color: colors.primary,
		flex: 1,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.cardBackground,
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: colors.textSecondary,
	},
	errorContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.cardBackground,
		padding: 20,
		marginTop: 8,
	},
	errorText: {
		marginTop: 16,
		fontSize: 18,
		fontWeight: "600",
		color: colors.textPrimary,
		marginBottom: 20,
	},
	retryButton: {
		backgroundColor: colors.primary,
		paddingHorizontal: 32,
		paddingVertical: 12,
		borderRadius: 12,
		marginTop: 8,
	},
	retryButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: colors.cardBackground,
	},
	scrollView: {
		flex: 1,
		backgroundColor: colors.cardBackground,
	},
	scrollContent: {
		padding: 20,
		paddingBottom: 120,
	},
	shopCard: {
		flexDirection: "row",
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		marginBottom: 16,
		borderWidth: 2,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	shopCardSelected: {
		borderColor: colors.printRequest,
		backgroundColor: colors.cardBackground,
	},
	shopIcon: {
		width: 56,
		height: 56,
		borderRadius: 12,
		backgroundColor: colors.background,
		justifyContent: "center",
		alignItems: "center",
		marginRight: 16,
		overflow: "hidden",
	},
	shopIconSelected: {
		backgroundColor: "#FFE8E5",
	},
	shopImage: {
		width: "100%",
		height: "100%",
		borderRadius: 12,
	},
	shopInfo: {
		flex: 1,
	},
	shopNameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 6,
		flexWrap: "wrap",
	},
	shopName: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	shopNameSelected: {
		color: colors.printRequest,
	},
	shopAddress: {
		fontSize: 14,
		fontWeight: "400",
		color: colors.textSecondary,
		marginBottom: 8,
		lineHeight: 20,
	},
	shopMeta: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	statusDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	statusDotOnline: {
		backgroundColor: colors.primary,
	},
	statusDotOffline: {
		backgroundColor: colors.textSecondary,
	},
	statusText: {
		fontSize: 12,
		fontWeight: "600",
	},
	statusTextOnline: {
		color: colors.primary,
	},
	statusTextOffline: {
		color: colors.textSecondary,
	},
	selectionIndicator: {
		justifyContent: "center",
	},
	selectionActions: {
		flexDirection: "row",
		alignItems: "center",
		marginLeft: 8,
	},
	detailsButton: {
		padding: 6,
		marginLeft: 12,
		backgroundColor: colors.background,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: colors.borderLight,
		justifyContent: "center",
		alignItems: "center",
	},
	footer: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: colors.cardBackground,
		padding: 20,
		paddingBottom: 28,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
		shadowColor: colors.shadowMedium,
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 1,
		shadowRadius: 12,
		elevation: 8,
	},
	continueButton: {
		backgroundColor: colors.printRequest,
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
	emptyContainer: {
		padding: 20,
		display: "flex",
		flexDirection: "column",
		gap: 10,
		justifyContent: "center",
		alignItems: "center",
	},
	emptyText: {
		fontSize: 16,
		color: colors.textSecondary,
		textAlign: "center",
	},
});

export default ShopDetails;
