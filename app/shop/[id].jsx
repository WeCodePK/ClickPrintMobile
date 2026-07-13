//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import SecureStore from "../../utils/storage";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../../config/config";
import { colors } from "../../constants/colors";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

const CAPABILITY_LABELS = {
	bw: "Black & White Printing",
	color: "Color Printing",
	a4: "A4 Paper Size",
	a3: "A3 Paper Size",
	legal: "Legal Paper Size",
	duplex: "Double-Sided Printing",
	staple: "Stapling",
	binding: "Binding",
};

//----------------------------------- COMPONENTS -----------------------------------//

const ShopDetails = () => {
	const router = useRouter();
	const params = useLocalSearchParams();
	const shopId = params.id || params.shopId;

	const [shop, setShop] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Coming from the Shops tab pushes this screen onto the root stack; going
	// "back" there can land the tabs navigator on its initial tab (Home)
	// instead of restoring Shops. Route back explicitly instead of trusting
	// router.back() when we know we arrived from that tab.
	const goBack = useCallback(() => {
		if (params.from === "shops") {
			router.replace("/(tabs)/shops");
		} else {
			router.back();
		}
	}, [params.from, router]);

	useFocusEffect(
		useCallback(() => {
			const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
				goBack();
				return true;
			});
			return () => subscription.remove();
		}, [goBack])
	);

	useEffect(() => {
		fetchShopDetails();
	}, [shopId]);

	const fetchShopDetails = async () => {
		try {
			setLoading(true);
			setError(null);
			const token = await SecureStore.getItemAsync("authToken");
			const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			console.log("Shop details:", data);			
			setShop(data.data.shop);
		} catch (err) {
			console.error("Error fetching shop details:", err);
			setError(err.message || "Failed to load shop details. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	

	//----------------------------------- RENDER -----------------------------------//

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
			<View style={styles.header}>
				<TouchableOpacity onPress={goBack} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Shop Details</Text>
				<View style={styles.placeholder} />
			</View>

			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={styles.loadingText}>Loading shop details...</Text>
				</View>
			) : error ? (
				<View style={styles.errorContainer}>
					<Feather name="alert-circle" size={48} color={colors.printRequest} />
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity style={styles.retryButton} onPress={fetchShopDetails}>
						<Text style={styles.retryButtonText}>Retry</Text>
					</TouchableOpacity>
				</View>
			) : (
				<>
					<ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
						{/* Shop Header Card */}
						<View style={styles.shopHeaderCard}>
							{shop.imageUrl ? (
								<Image source={{ uri: shop.imageUrl }} style={styles.shopImage} contentFit="cover" transition={200} />
							) : (
								<View style={styles.shopIconContainer}>
									<Feather name="shopping-bag" size={32} color={colors.printRequest} />
								</View>
							)}
							<Text style={styles.shopName}>{shop.name}</Text>
							<View style={styles.onlineStatusBadge}>
								<View style={[styles.statusDot, shop.isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
								<Text style={[styles.statusText, shop.isOnline ? styles.statusTextOnline : styles.statusTextOffline]}>
									{shop.isOnline ? "Online" : "Offline"}
								</Text>
							</View>
						</View>

						{/* Address Section */}
						<View style={styles.section}>
							<View style={styles.sectionHeader}>
								<Feather name="map-pin" size={18} color={colors.printRequest} />
								<Text style={styles.sectionTitle}>Address</Text>
							</View>
							<View style={styles.card}>
								<Text style={styles.addressText}>{shop.address}</Text>
							</View>
						</View>

						{/* Timings Section */}
						{shop.timings && shop.timings.length > 0 && (
							<View style={styles.section}>
								<View style={styles.sectionHeader}>
									<Feather name="clock" size={18} color={colors.printRequest} />
									<Text style={styles.sectionTitle}>Timings</Text>
								</View>
								<View style={styles.card}>
									{shop.timings.map((timing, index) => (
										<View key={index} style={[styles.capabilityRow, index < shop.timings.length - 1 && styles.capabilityRowBorder]}>
											<Text style={styles.addressText}>{timing}</Text>
										</View>
									))}
								</View>
							</View>
						)}

						{/* Capabilities Section */}
						<View style={styles.section}>
							<View style={styles.sectionHeader}>
								<Feather name="settings" size={18} color={colors.printRequest} />
								<Text style={styles.sectionTitle}>Capabilities</Text>
							</View>
							<View style={styles.card}>
								{!shop.capabilities || shop.capabilities.length === 0 ? (
									<Text style={styles.emptyText}>No capabilities listed</Text>
								) : (
									shop.capabilities.map((cap, index) => (
										<View key={index} style={[styles.capabilityRow, index < shop.capabilities.length - 1 && styles.capabilityRowBorder]}>
											<View style={styles.capabilityDot} />
											<Text style={styles.capabilityText}>{CAPABILITY_LABELS[cap] || cap}</Text>
										</View>
									))
								)}
							</View>
						</View>

						{/* Pricing Section */}
						<View style={styles.section}>
							<View style={styles.sectionHeader}>
								<Feather name="tag" size={18} color={colors.printRequest} />
								<Text style={styles.sectionTitle}>Pricing</Text>
							</View>
							{!shop.prices || shop.prices.length === 0 ? (
								<View style={styles.card}>
									<Text style={styles.emptyText}>No pricing information available</Text>
								</View>
							) : (
								shop.prices.map((price, index) => (
									<View key={price._id} style={[styles.priceCard, index < shop.prices.length - 1 && styles.priceCardSpacing]}>
										<Text style={styles.priceName}>{price.name}</Text>
										<View style={styles.priceRow}>
											<Text style={styles.priceLabel}>Rate</Text>
											<Text style={styles.priceValue}>Rs. {price.rate}</Text>
										</View>
									</View>
								))
							)}
						</View>
					</ScrollView>
				</>
			)}
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
	},
	errorText: {
		marginTop: 16,
		fontSize: 16,
		fontWeight: "600",
		color: colors.textPrimary,
		marginBottom: 20,
		textAlign: "center",
	},
	retryButton: {
		backgroundColor: colors.primary,
		paddingHorizontal: 32,
		paddingVertical: 12,
		borderRadius: 12,
	},
	retryButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: colors.cardBackground,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		padding: 20,
		paddingBottom: 120,
	},
	shopHeaderCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 20,
		padding: 24,
		alignItems: "center",
		marginBottom: 20,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	shopIconContainer: {
		width: 72,
		height: 72,
		borderRadius: 20,
		backgroundColor: "#FFE8E5",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 16,
	},
	shopImage: {
		width: 96,
		height: 96,
		borderRadius: 20,
		marginBottom: 16,
		backgroundColor: colors.background,
	},
	shopName: {
		fontSize: 22,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 10,
		textAlign: "center",
	},
	onlineStatusBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 5,
		borderRadius: 20,
		backgroundColor: colors.background,
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
		fontSize: 13,
		fontWeight: "600",
	},
	statusTextOnline: {
		color: colors.primary,
	},
	statusTextOffline: {
		color: colors.textSecondary,
	},
	section: {
		marginBottom: 20,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 12,
	},
	sectionTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	card: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	addressText: {
		fontSize: 15,
		color: colors.textPrimary,
		lineHeight: 22,
	},
	walletNumber: {
		fontSize: 20,
		fontWeight: "700",
		color: colors.textPrimary,
		letterSpacing: 1,
	},
	emptyText: {
		fontSize: 14,
		color: colors.textSecondary,
		textAlign: "center",
		paddingVertical: 8,
	},
	capabilityRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingVertical: 10,
	},
	capabilityRowBorder: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	capabilityDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: colors.printRequest,
	},
	capabilityText: {
		fontSize: 14,
		color: colors.textPrimary,
		flex: 1,
	},
	priceCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	priceCardSpacing: {
		marginBottom: 12,
	},
	priceName: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
		marginBottom: 10,
	},
	priceRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	priceLabel: {
		fontSize: 13,
		color: colors.textSecondary,
		fontWeight: "500",
	},
	priceValue: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.printRequest,
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
	continueButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},
});

export default ShopDetails;
