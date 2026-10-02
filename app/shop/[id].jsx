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

	// Determine today's index (0=Mon … 6=Sun) for highlighting
	const today = new Date().getDay();
	const todayIndex = today === 0 ? 6 : today - 1; // JS: 0=Sun, we need 0=Mon

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

						{/* ───── Shop Profile Card ───── */}
						<View style={styles.profileCard}>
							<View style={styles.profileRow}>
								{shop.imageFile ? (
									<Image source={{ uri: `${API_BASE_URL}/files/${shop.imageFile}` }} style={styles.profileImage} contentFit="cover" transition={200} />
								) : (
									<View style={styles.profileIconWrap}>
										<Feather name="shopping-bag" size={28} color={colors.printRequest} />
									</View>
								)}
								<View style={styles.profileInfo}>
									<Text style={styles.profileName} numberOfLines={1}>{shop.name}</Text>
									<View style={styles.profileAddressRow}>
										<Feather name="map-pin" size={12} color={colors.textSecondary} />
										<Text style={styles.profileAddress} numberOfLines={2}>{shop.address}</Text>
									</View>
								</View>
							</View>
							<View style={styles.profileChips}>
								<View style={[styles.chip, shop.isOnline ? styles.chipOnline : styles.chipOffline]}>
									<View style={[styles.chipDot, shop.isOnline ? styles.chipDotOnline : styles.chipDotOffline]} />
									<Text style={[styles.chipText, shop.isOnline ? styles.chipTextOnline : styles.chipTextOffline]}>
										{shop.isOnline ? "Online" : "Offline"}
									</Text>
								</View>
								<View style={styles.chip}>
									<Feather name="layers" size={12} color={colors.textSecondary} />
									<Text style={styles.chipText}>{services.length} service{services.length !== 1 ? "s" : ""}</Text>
								</View>
								{Object.keys(serviceTree).length > 0 && (
									<View style={styles.chip}>
										<Feather name="file" size={12} color={colors.textSecondary} />
										<Text style={styles.chipText}>{Object.keys(serviceTree).sort().join(", ")}</Text>
									</View>
								)}
							</View>
						</View>

						{/* ───── Timings Card ───── */}
						{shop.timings && shop.timings.length > 0 && (
							<View style={styles.section}>
								<View style={styles.card}>
									<TouchableOpacity
										style={[styles.cardHeader, expandedTimings && styles.cardHeaderBorder]}
										onPress={() => setExpandedTimings(!expandedTimings)}
										activeOpacity={0.7}
									>
										<View style={styles.cardHeaderLeft}>
											<View style={styles.headerIconWrap}>
												<Feather name="clock" size={16} color={colors.printRequest} />
											</View>
											<Text style={styles.cardHeaderTitle}>Timings</Text>
										</View>
										<View style={styles.cardHeaderRight}>
											{!expandedTimings && (
												<Text style={styles.todayHint}>
													{shop.timings[todayIndex]?.toLowerCase() === "closed" ? "Closed today" : shop.timings[todayIndex] || ""}
												</Text>
											)}
											<Feather name={expandedTimings ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
										</View>
									</TouchableOpacity>
									{expandedTimings && (
										<View style={styles.cardBody}>
											{shop.timings.map((timing, index) => {
												const isClosed = timing.toLowerCase() === "closed";
												const isToday = index === todayIndex;
												return (
													<View key={index} style={[styles.timingRow, isToday && styles.timingRowToday, index < shop.timings.length - 1 && styles.timingRowBorder]}>
														<View style={styles.timingDayWrap}>
															{isToday && <View style={styles.todayDot} />}
															<Text style={[styles.timingDay, isToday && styles.timingDayToday]}>
																{DAYS_OF_WEEK[index] ?? `Day ${index + 1}`}
															</Text>
														</View>
														<Text style={[isClosed ? styles.timingValueClosed : styles.timingValue, isToday && styles.timingValueToday]}>
															{isClosed ? "Closed" : timing}
														</Text>
													</View>
												);
											})}
										</View>
									)}
								</View>
							</View>
						)}

						{/* ───── Services & Pricing Card ───── */}
						<View style={styles.section}>
							<View style={styles.card}>
								<View style={[styles.cardHeader, styles.cardHeaderBorder]}>
									<View style={styles.cardHeaderLeft}>
										<View style={[styles.headerIconWrap, { backgroundColor: "rgba(0, 217, 163, 0.1)" }]}>
											<Feather name="layers" size={16} color={colors.primary} />
										</View>
										<Text style={styles.cardHeaderTitle}>Services & Pricing</Text>
									</View>
								</View>
								<View style={styles.cardBody}>
									{services.length === 0 ? (
										<Text style={styles.emptyText}>No services available</Text>
									) : (
										<>
											{Object.keys(serviceTree).sort().map((size, sIdx, sArr) => (
												<View key={size} style={[styles.sizeBlock, sIdx < sArr.length - 1 && styles.sizeBlockBorder]}>
													<TouchableOpacity
														style={styles.sizeRow}
														onPress={() => toggleSize(size)}
														activeOpacity={0.7}
													>
														<View style={styles.sizeRowLeft}>
															<View style={styles.sizeIconWrap}>
																<Feather name="file-text" size={14} color={colors.printRequest} />
															</View>
															<Text style={styles.sizeLabel}>{size}</Text>
														</View>
														<Feather name={expandedSizes[size] ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
													</TouchableOpacity>

													{expandedSizes[size] && Object.keys(serviceTree[size]).map((color) => (
														<View key={color} style={styles.colorBlock}>
															<View style={styles.colorRow}>
																<View style={[styles.colorDot, color === "Color" ? styles.colorDotColor : styles.colorDotBW]} />
																<Text style={styles.colorLabel}>{color}</Text>
															</View>
															{serviceTree[size][color].map((service) => (
																<View key={service._id} style={styles.sidedRow}>
																	<View style={styles.sidedLeft}>
																		<Feather name={service.label === "Double Sided" ? "copy" : "file"} size={13} color={colors.textSecondary} />
																		<Text style={styles.sidedLabel}>{service.label}</Text>
																	</View>
																	<View style={styles.priceBadge}>
																		<Text style={styles.priceText}>Rs. {service.rate}</Text>
																	</View>
																</View>
															))}
														</View>
													))}
												</View>
											))}

											{serviceOthers.map((service) => (
												<View key={service._id} style={styles.sidedRow}>
													<Text style={styles.sidedLabel}>{service.name}</Text>
													<View style={styles.priceBadge}>
														<Text style={styles.priceText}>Rs. {service.rate}</Text>
													</View>
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
		paddingBottom: 40,
	},

	/* ── Profile Card ── */
	profileCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 20,
		padding: 20,
		marginBottom: 16,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 2,
	},
	profileRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 16,
	},
	profileImage: {
		width: 64,
		height: 64,
		borderRadius: 16,
		backgroundColor: colors.background,
	},
	profileIconWrap: {
		width: 64,
		height: 64,
		borderRadius: 16,
		backgroundColor: "rgba(255, 139, 123, 0.1)",
		justifyContent: "center",
		alignItems: "center",
	},
	profileInfo: {
		flex: 1,
		gap: 6,
	},
	profileName: {
		fontSize: 20,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	profileAddressRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 4,
		paddingTop: 2,
	},
	profileAddress: {
		fontSize: 13,
		color: colors.textSecondary,
		flex: 1,
		lineHeight: 18,
	},
	profileChips: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 16,
		paddingTop: 16,
		borderTopWidth: 1,
		borderTopColor: colors.borderLight,
	},
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 20,
		backgroundColor: colors.background,
	},
	chipOnline: {
		backgroundColor: "rgba(0, 217, 163, 0.08)",
	},
	chipOffline: {
		backgroundColor: colors.background,
	},
	chipDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
	chipDotOnline: {
		backgroundColor: colors.primary,
	},
	chipDotOffline: {
		backgroundColor: colors.textSecondary,
	},
	chipText: {
		fontSize: 12,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	chipTextOnline: {
		color: colors.primary,
	},
	chipTextOffline: {
		color: colors.textSecondary,
	},

	/* ── Shared Card ── */
	section: {
		marginBottom: 16,
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
		overflow: "hidden",
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	cardHeaderBorder: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	cardHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	cardHeaderRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	headerIconWrap: {
		width: 32,
		height: 32,
		borderRadius: 10,
		backgroundColor: "rgba(255, 139, 123, 0.1)",
		justifyContent: "center",
		alignItems: "center",
	},
	cardHeaderTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	cardBody: {
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	todayHint: {
		fontSize: 12,
		fontWeight: "500",
		color: colors.textSecondary,
	},

	/* ── Timings ── */
	timingRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 10,
		paddingHorizontal: 4,
		borderRadius: 8,
	},
	timingRowToday: {
		backgroundColor: "rgba(0, 217, 163, 0.06)",
		paddingHorizontal: 10,
		marginHorizontal: -6,
	},
	timingRowBorder: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	timingDayWrap: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	todayDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: colors.primary,
	},
	timingDay: {
		fontSize: 14,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	timingDayToday: {
		fontWeight: "700",
		color: colors.primary,
	},
	timingValue: {
		fontSize: 13,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	timingValueClosed: {
		fontSize: 13,
		fontWeight: "500",
		color: colors.textSecondary,
	},
	timingValueToday: {
		fontWeight: "700",
	},

	/* ── Services Tree ── */
	emptyText: {
		fontSize: 14,
		color: colors.textSecondary,
		textAlign: "center",
		paddingVertical: 16,
	},
	sizeBlock: {
		paddingBottom: 8,
	},
	sizeBlockBorder: {
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
		marginBottom: 8,
	},
	sizeRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 10,
	},
	sizeRowLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	sizeIconWrap: {
		width: 28,
		height: 28,
		borderRadius: 8,
		backgroundColor: "rgba(255, 139, 123, 0.08)",
		justifyContent: "center",
		alignItems: "center",
	},
	sizeLabel: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	colorBlock: {
		marginLeft: 14,
		paddingLeft: 14,
		borderLeftWidth: 2,
		borderLeftColor: colors.borderLight,
		marginBottom: 8,
	},
	colorRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingVertical: 6,
	},
	colorDot: {
		width: 10,
		height: 10,
		borderRadius: 3,
	},
	colorDotBW: {
		backgroundColor: colors.textSecondary,
	},
	colorDotColor: {
		backgroundColor: "#3B82F6",
	},
	colorLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	sidedRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 8,
		paddingLeft: 22,
	},
	sidedLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	sidedLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	priceBadge: {
		backgroundColor: "rgba(0, 217, 163, 0.08)",
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 8,
	},
	priceText: {
		fontSize: 13,
		fontWeight: "700",
		color: colors.primary,
	},
});

export default ShopDetails;

