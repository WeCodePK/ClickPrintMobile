//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useCallback, useState } from "react";
import { ActivityIndicator, BackHandler, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StaleDataNotice from "../../components/StaleDataNotice";
import config from "../../config/config";
import { colors } from "../../constants/colors";
import { useServicesQuery, useShopQuery } from "../../hooks/queries";
import { friendlyMessage } from "../../utils/errors";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

	// Cached (and saved on the device), so a shop seen before opens offline.
	const shopQuery = useShopQuery(shopId);
	const servicesQuery = useServicesQuery(shopId);
	const shop = shopQuery.data ?? null;
	const services = servicesQuery.data ?? [];

	const [expandedSizes, setExpandedSizes] = useState({});
	const [expandedTimings, setExpandedTimings] = useState(false);

	const toggleSize = (size) => {
		setExpandedSizes((prev) => ({ ...prev, [size]: !prev[size] }));
	};

	const serviceTree = {};
	const serviceOthers = [];
	services.forEach((service) => {
		if (service.keys && service.keys.pageType) {
			const size = service.keys.pageType;
			const color = service.keys.color ? "Color" : "Black & White";
			const sided = service.keys.sidedness ? "Double Sided" : "Single Sided";

			if (!serviceTree[size]) serviceTree[size] = {};
			if (!serviceTree[size][color]) serviceTree[size][color] = [];
			serviceTree[size][color].push({ ...service, label: sided });
		} else {
			serviceOthers.push(service);
		}
	});
	const loading = shopQuery.isPending;
	const error = shopQuery.isError && !shop ? friendlyMessage(shopQuery.error) : null;
	const refreshFailed = (shopQuery.isError || servicesQuery.isError) && !!shop;
	const fetchShopDetails = () => {
		shopQuery.refetch();
		servicesQuery.refetch();
	};

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
						<StaleDataNotice
							error={refreshFailed ? friendlyMessage(shopQuery.error || servicesQuery.error) : null}
							updatedAt={shopQuery.dataUpdatedAt}
							hasData
							onRetry={fetchShopDetails}
							retrying={shopQuery.isFetching}
						/>
						{/* Shop Header Card */}
						<View style={styles.shopHeaderCard}>
							{shop.imageFile ? (
								<Image source={{ uri: `${API_BASE_URL}/files/${shop.imageFile}` }} style={styles.shopImage} contentFit="cover" transition={200} />
							) : (
								<View style={styles.shopIconContainer}>
									<Feather name="shopping-bag" size={32} color={colors.printRequest} />
								</View>
							)}
							<Text style={styles.shopName}>{shop.name}</Text>
							<Text style={styles.shopAddressHeader}>{shop.address}</Text>
							<View style={styles.onlineStatusBadge}>
								<View style={[styles.statusDot, shop.isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
								<Text style={[styles.statusText, shop.isOnline ? styles.statusTextOnline : styles.statusTextOffline]}>
									{shop.isOnline ? "Online" : "Offline"}
								</Text>
							</View>
						</View>

						{/* Timings Section */}
						{shop.timings && shop.timings.length > 0 && (
							<View style={styles.section}>
								<View style={styles.card}>
									<TouchableOpacity 
										style={styles.cardHeader}
										onPress={() => setExpandedTimings(!expandedTimings)}
										activeOpacity={0.7}
									>
										<View style={styles.cardHeaderLeft}>
											<Feather name="clock" size={18} color={colors.printRequest} />
											<Text style={styles.sectionTitle}>Timings</Text>
										</View>
										<Feather name={expandedTimings ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
									</TouchableOpacity>
									{expandedTimings && (
										<View style={styles.cardContent}>
											{shop.timings.map((timing, index) => {
												const isClosed = timing.toLowerCase() === "closed";
												return (
													<View key={index} style={[styles.capabilityRow, index < shop.timings.length - 1 && styles.capabilityRowBorder]}>
														<Text style={styles.dayLabel}>{DAYS_OF_WEEK[index] ?? `Day ${index + 1}`}</Text>
														<Text style={isClosed ? styles.timingClosed : styles.timingOpen}>{isClosed ? "Closed" : timing}</Text>
													</View>
												);
											})}
										</View>
									)}
								</View>
							</View>
						)}

						{/* Services & Pricing Section */}
						<View style={styles.section}>
							<View style={styles.card}>
								<View style={styles.cardHeader}>
									<View style={styles.cardHeaderLeft}>
										<Feather name="layers" size={18} color={colors.printRequest} />
										<Text style={styles.sectionTitle}>Services & Pricing</Text>
									</View>
								</View>
								<View style={[styles.cardContent, { paddingTop: 16 }]}>
									{services.length === 0 ? (
										<Text style={styles.emptyText}>No services available</Text>
									) : (
										<>
											{Object.keys(serviceTree).sort().map((size) => (
												<View key={size} style={styles.treeNodeSize}>
													<TouchableOpacity 
														style={styles.treeHeader} 
														onPress={() => toggleSize(size)}
														activeOpacity={0.7}
													>
														<View style={styles.treeHeaderLeft}>
															<Feather name="file" size={16} color={colors.textSecondary} />
															<Text style={styles.treeSizeLabel}>{size}</Text>
														</View>
														<Feather name={expandedSizes[size] ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
													</TouchableOpacity>

													{expandedSizes[size] && Object.keys(serviceTree[size]).map((color) => (
														<View key={color} style={styles.treeNodeColor}>
															<View style={styles.treeColorHeader}>
																<View style={[styles.colorIndicator, color === "Color" && styles.colorIndicatorGradient]} />
																<Text style={styles.treeColorLabel}>{color}</Text>
															</View>
															{serviceTree[size][color].map((service) => (
																<View key={service._id} style={styles.treeNodeSided}>
																	<View style={styles.treeSidedLeft}>
																		<Feather name={service.label === "Double Sided" ? "copy" : "square"} size={14} color={colors.textSecondary} />
																		<Text style={styles.treeSidedLabel}>{service.label}</Text>
																	</View>
																	<Text style={styles.treeSidedValue}>Rs. {service.rate}</Text>
																</View>
															))}
														</View>
													))}
												</View>
											))}

											{serviceOthers.map((service, index) => (
												<View key={service._id} style={[styles.capabilityRow, index < serviceOthers.length - 1 && styles.capabilityRowBorder]}>
													<Text style={styles.capabilityText}>{service.name}</Text>
													<Text style={styles.priceValue}>Rs. {service.rate}</Text>
												</View>
											))}
										</>
									)}
								</View>
							</View>
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
		marginBottom: 6,
		textAlign: "center",
	},
	shopAddressHeader: {
		fontSize: 14,
		color: colors.textSecondary,
		textAlign: "center",
		marginBottom: 16,
		paddingHorizontal: 20,
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
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	cardHeaderExpanded: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	cardHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	cardContent: {
		paddingHorizontal: 16,
		paddingVertical: 16,
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
		justifyContent: "space-between",
		gap: 12,
		paddingVertical: 12,
	},
	capabilityRowBorder: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	dayLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
		flex: 1,
	},
	timingOpen: {
		fontSize: 14,
		color: colors.textPrimary,
		fontWeight: "500",
	},
	timingClosed: {
		fontSize: 14,
		color: colors.textSecondary,
		fontWeight: "500",
	},
	capabilityText: {
		fontSize: 14,
		color: colors.textPrimary,
		flex: 1,
	},
	priceValue: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.printRequest,
	},
	treeNodeSize: {
		marginBottom: 16,
	},
	treeHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
		marginBottom: 8,
	},
	treeHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	treeSizeLabel: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	treeNodeColor: {
		marginLeft: 12,
		paddingLeft: 12,
		borderLeftWidth: 1,
		borderLeftColor: colors.borderLight,
		marginBottom: 12,
	},
	treeColorHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 8,
		marginTop: 4,
	},
	colorIndicator: {
		width: 12,
		height: 12,
		borderRadius: 4,
		backgroundColor: colors.textSecondary,
	},
	colorIndicatorGradient: {
		backgroundColor: "#3B82F6",
	},
	treeColorLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	treeNodeSided: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 8,
		paddingLeft: 24,
	},
	treeSidedLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	treeSidedLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	treeSidedValue: {
		fontSize: 14,
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
