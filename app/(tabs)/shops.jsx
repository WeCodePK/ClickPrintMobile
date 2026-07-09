//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { showAlert } from "../../utils/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import ShopsMap from "../../components/ShopsMap";
import { colors } from "../../constants/colors";
import { useShops } from "../../hooks/useShops";
import { getInitialRegion, toLatLng } from "../../utils/shopLocation";

//----------------------------------- COMPONENTS -----------------------------------//

const ShopsPage = () => {
	const router = useRouter();
	const { shops, loading, error, reload } = useShops();
	const [selectedShopId, setSelectedShopId] = useState(null);

	// Only shops with usable coordinates can be placed on the map.
	const locatedShops = useMemo(
		() =>
			shops
				.map((shop) => ({ ...shop, latLng: toLatLng(shop.coordinates) }))
				.filter((shop) => shop.latLng !== null),
		[shops]
	);

	const initialRegion = useMemo(() => getInitialRegion(locatedShops), [locatedShops]);

	const selectedShop = useMemo(
		() => locatedShops.find((shop) => shop._id === selectedShopId) || null,
		[locatedShops, selectedShopId]
	);

	const goToShopDetails = (shopId) => {
		router.push(`/shop/${shopId}?from=shops`);
	};

	const openShopLocation = async (shop) => {
		const latLng = toLatLng(shop.coordinates);
		if (!latLng) {
			showAlert("Location unavailable", "This shop hasn't set its location yet.");
			return;
		}
		const url = `https://www.google.com/maps/search/?api=1&query=${latLng.latitude},${latLng.longitude}`;
		try {
			await Linking.openURL(url);
		} catch {
			showAlert("Unable to open maps", "Please try again.");
		}
	};

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			{loading ? (
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={styles.loadingText}>Loading shops...</Text>
				</View>
			) : error && shops.length === 0 ? (
				<View style={styles.centerContainer}>
					<Feather name="alert-circle" size={40} color={colors.printRequest} />
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity style={styles.retryButton} onPress={reload}>
						<Text style={styles.retryButtonText}>Retry</Text>
					</TouchableOpacity>
				</View>
			) : (
				<View style={styles.mapContainer}>
					<ShopsMap
						shops={locatedShops}
						selectedShopId={selectedShopId}
						initialRegion={initialRegion}
						onSelectShop={setSelectedShopId}
						onDeselect={() => setSelectedShopId(null)}
					/>

					{locatedShops.length === 0 && (
						<View style={styles.emptyBanner} pointerEvents="none">
							<Feather name="map-pin" size={18} color={colors.textSecondary} />
							<Text style={styles.emptyBannerText}>No shops with a location yet</Text>
						</View>
					)}

					{selectedShop && (
						<ShopCallout
							shop={selectedShop}
							onClose={() => setSelectedShopId(null)}
							onMoreDetails={() => goToShopDetails(selectedShop._id)}
							onDirections={() => openShopLocation(selectedShop)}
						/>
					)}
				</View>
			)}
		</SafeAreaView>
	);
};

// Popup tooltip shown when a pin is tapped. Rendered as a bottom card overlay so the
// interaction is identical on web (Leaflet) and native (react-native-maps), avoiding
// the platform quirks of tappable buttons inside native map callouts.
const ShopCallout = ({ shop, onClose, onMoreDetails, onDirections }) => {
	return (
		<View style={styles.callout}>
			<TouchableOpacity style={styles.calloutClose} onPress={onClose} hitSlop={8}>
				<Feather name="x" size={18} color={colors.textSecondary} />
			</TouchableOpacity>

			<View style={styles.calloutTop}>
				{shop.imageUrl ? (
					<Image source={{ uri: shop.imageUrl }} style={styles.calloutImage} contentFit="cover" transition={200} />
				) : (
					<View style={styles.calloutIcon}>
						<Feather name="shopping-bag" size={22} color={colors.printRequest} />
					</View>
				)}

				<View style={styles.calloutInfo}>
					<Text style={styles.calloutName} numberOfLines={1}>
						{shop.name}
					</Text>
					<Text style={styles.calloutAddress} numberOfLines={2}>
						{shop.address}
					</Text>
					<View style={styles.calloutMetaRow}>
						<View style={[styles.statusDot, shop.isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
						<Text style={[styles.statusText, shop.isOnline ? styles.statusTextOnline : styles.statusTextOffline]}>
							{shop.isOnline ? "Online" : "Offline"}
						</Text>
						{shop.timings && shop.timings.length > 0 && (
							<>
								<Text style={styles.metaDivider}>•</Text>
								<Feather name="clock" size={12} color={colors.textSecondary} />
								<Text style={styles.calloutTiming} numberOfLines={1}>
									{shop.timings[0]}
								</Text>
							</>
						)}
					</View>
				</View>
			</View>

			<View style={styles.calloutActions}>
				<TouchableOpacity style={styles.directionsButton} onPress={onDirections} activeOpacity={0.8}>
					<Feather name="navigation" size={15} color={colors.printRequest} />
					<Text style={styles.directionsButtonText}>Directions</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.detailsButton} onPress={onMoreDetails} activeOpacity={0.8}>
					<Text style={styles.detailsButtonText}>More Details</Text>
					<Feather name="arrow-right" size={16} color={colors.cardBackground} />
				</TouchableOpacity>
			</View>
		</View>
	);
};

//----------------------------------- STYLES -----------------------------------//

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	mapContainer: {
		flex: 1,
		overflow: "hidden",
	},
	centerContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
		gap: 12,
	},
	loadingText: {
		fontSize: 15,
		color: colors.textSecondary,
	},
	errorText: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
		textAlign: "center",
	},
	retryButton: {
		backgroundColor: colors.primary,
		paddingHorizontal: 28,
		paddingVertical: 10,
		borderRadius: 10,
	},
	retryButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.cardBackground,
	},
	emptyBanner: {
		position: "absolute",
		top: 16,
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: colors.cardBackground,
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowMedium,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 3,
	},
	emptyBannerText: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	callout: {
		position: "absolute",
		left: 16,
		right: 16,
		bottom: 20,
		backgroundColor: colors.cardBackground,
		borderRadius: 18,
		padding: 16,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowMedium,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 1,
		shadowRadius: 16,
		elevation: 8,
	},
	calloutClose: {
		position: "absolute",
		top: 10,
		right: 10,
		width: 28,
		height: 28,
		borderRadius: 14,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: colors.background,
		zIndex: 1,
	},
	calloutTop: {
		flexDirection: "row",
		gap: 14,
		paddingRight: 24,
	},
	calloutImage: {
		width: 56,
		height: 56,
		borderRadius: 12,
		backgroundColor: colors.background,
	},
	calloutIcon: {
		width: 56,
		height: 56,
		borderRadius: 12,
		backgroundColor: "#FFE8E5",
		justifyContent: "center",
		alignItems: "center",
	},
	calloutInfo: {
		flex: 1,
		gap: 4,
	},
	calloutName: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	calloutAddress: {
		fontSize: 13,
		color: colors.textSecondary,
		lineHeight: 18,
	},
	calloutMetaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 2,
		flexWrap: "wrap",
	},
	metaDivider: {
		fontSize: 12,
		color: colors.textSecondary,
	},
	statusDot: {
		width: 7,
		height: 7,
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
	calloutTiming: {
		fontSize: 12,
		color: colors.textSecondary,
		flexShrink: 1,
	},
	calloutActions: {
		flexDirection: "row",
		gap: 10,
		marginTop: 16,
	},
	directionsButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		paddingVertical: 11,
		paddingHorizontal: 14,
		borderRadius: 12,
		borderWidth: 1.5,
		borderColor: colors.printRequest,
	},
	directionsButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.printRequest,
	},
	detailsButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		paddingVertical: 11,
		borderRadius: 12,
		backgroundColor: colors.printRequest,
	},
	detailsButtonText: {
		fontSize: 14,
		fontWeight: "700",
		color: colors.cardBackground,
	},
});

export default ShopsPage;
