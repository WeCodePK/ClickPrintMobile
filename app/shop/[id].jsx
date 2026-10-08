//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, BackHandler, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StaleDataNotice from "../../components/StaleDataNotice";
import ShopImage from "../../components/ShopImage";
import { colors } from "../../constants/colors";
import { useServicesQuery, useShopQuery } from "../../hooks/queries";
import { friendlyMessage } from "../../utils/errors";

//----------------------------------- CONSTANTS -----------------------------------//

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

	const [expandedSizes, setExpandedSizes] = useState({
		A4: true,
		A3: true,
		Legal: true,
	});
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

	// Sort inside the tree
	for (const size in serviceTree) {
		for (const color in serviceTree[size]) {
			serviceTree[size][color].sort((a, b) => {
				if (a.label === "Single Sided") return -1;
				if (b.label === "Single Sided") return 1;
				return a.label.localeCompare(b.label);
			});
		}
	}

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

	const summarizeTimings = (timings) => {
		if (!timings || timings.length === 0) return [];
		const summary = [];
		let currentGroup = { start: 0, end: 0, timing: timings[0] };

		for (let i = 1; i < timings.length; i++) {
			if (timings[i] === currentGroup.timing) {
				currentGroup.end = i;
			} else {
				summary.push(currentGroup);
				currentGroup = { start: i, end: i, timing: timings[i] };
			}
		}
		summary.push(currentGroup);

		return summary.map(group => {
			const startDay = DAYS_OF_WEEK[group.start] || `Day ${group.start + 1}`;
			const endDay = DAYS_OF_WEEK[group.end] || `Day ${group.end + 1}`;
			const label = group.start === group.end ? startDay : `${startDay} - ${endDay}`;
			return { label, timing: group.timing };
		});
	};
	const summarizedTimings = summarizeTimings(shop?.timings);

	const handleOpenLocation = () => {
		const url = shop?.googleMapsUrl || shop?.mapUrl;
		if (url) {
			Linking.openURL(url).catch(console.error);
		} else if (shop?.location?.coordinates) {
			const [lng, lat] = shop.location.coordinates;
			Linking.openURL(`geo:${lat},${lng}?q=${lat},${lng}(${shop.name})`).catch(console.error);
		}
	};

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

						{/* ───── Shop Cover Image ───── */}
						<View style={styles.coverImageContainer}>
							{shop.imageFile ? (
								<ShopImage imageFile={shop.imageFile} style={styles.coverImage} contentFit="cover" transition={200} />
							) : (
								<View style={[styles.coverImage, { backgroundColor: "rgba(255, 139, 123, 0.1)", justifyContent: "center", alignItems: "center" }]}>
									<Feather name="shopping-bag" size={48} color={colors.printRequest} />
								</View>
							)}
							<View style={styles.coverImageOverlay}>
								<Text style={styles.coverShopName} numberOfLines={1}>{shop.name}</Text>
								<View style={styles.coverShopAddressRow}>
									<Text style={styles.coverShopAddress} numberOfLines={2}>{shop.address}</Text>
									{shop.isOnline && <View style={styles.coverOnlineDot} />}
								</View>
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
									<View style={styles.cardBody}>
										{(expandedTimings ? shop.timings.map((t, i) => ({ label: DAYS_OF_WEEK[i], timing: t, isToday: i === todayIndex })) : summarizedTimings.map(t => ({...t, isToday: false}))).map((row, index, arr) => {
											const isClosed = row.timing.toLowerCase() === "closed";
											const isToday = row.isToday;
											return (
												<View key={index} style={[styles.timingRow, isToday && styles.timingRowToday, index < arr.length - 1 && styles.timingRowBorder]}>
													<View style={styles.timingDayWrap}>
														{isToday && <View style={styles.todayDot} />}
														<Text style={[styles.timingDay, isToday && styles.timingDayToday]}>
															{row.label}
														</Text>
													</View>
													<Text style={[isClosed ? styles.timingValueClosed : styles.timingValue, isToday && styles.timingValueToday]}>
														{isClosed ? "Closed" : row.timing}
													</Text>
												</View>
											);
										})}
									</View>
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
											{Object.keys(serviceTree)
												.sort((a, b) => {
													const order = { "A4": 1, "A3": 2 };
													const rankA = order[a] || 99;
													const rankB = order[b] || 99;
													if (rankA !== rankB) return rankA - rankB;
													return a.localeCompare(b);
												})
												.map((size, sIdx, sArr) => (
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

													{expandedSizes[size] && Object.keys(serviceTree[size])
														.sort((a, b) => {
															if (a === "Black & White") return -1;
															if (b === "Black & White") return 1;
															return a.localeCompare(b);
														})
														.map((color) => (
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

						{/* ───── More Details ───── */}
						<View style={styles.section}>
							<View style={styles.sectionHeader}>
								<Feather name="info" size={18} color={colors.textSecondary} />
								<Text style={styles.sectionTitle}>More Details</Text>
							</View>
							<View style={styles.card}>
								{/* Contact */}
								<View style={styles.moreDetailsRow}>
									<View style={styles.moreDetailsIconWrap}>
										<Feather name="phone" size={18} color={colors.textSecondary} />
									</View>
									<View style={styles.moreDetailsContent}>
										<Text style={styles.moreDetailsLabel}>Contact Number</Text>
										<Text style={styles.moreDetailsValue}>{shop.contactNumber || shop.phone || shop.phoneNumber || "Not available"}</Text>
									</View>
								</View>

								{/* Location */}
								<View style={[styles.moreDetailsRow, { borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
									<View style={styles.moreDetailsIconWrap}>
										<Feather name="map-pin" size={18} color={colors.textSecondary} />
									</View>
									<View style={[styles.moreDetailsContent, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
										<View>
											<Text style={styles.moreDetailsLabel}>Location</Text>
											{shop.location?.coordinates ? (
												<Text style={styles.moreDetailsValueMono}>
													{shop.location.coordinates[1]?.toFixed(4)}, {shop.location.coordinates[0]?.toFixed(4)}
												</Text>
											) : (
												<Text style={styles.moreDetailsValue}>Not available</Text>
											)}
										</View>
										<TouchableOpacity style={styles.openMapButton} onPress={handleOpenLocation} activeOpacity={0.7}>
											<Text style={styles.openMapText}>Open Map</Text>
											<Feather name="external-link" size={14} color={colors.primary} />
										</TouchableOpacity>
									</View>
								</View>

								{/* Wallet */}
								{shop.wallet && (
									<View style={[styles.moreDetailsRow, { borderTopWidth: 1, borderTopColor: colors.borderLight, alignItems: "flex-start" }]}>
										<View style={styles.moreDetailsIconWrap}>
											<Feather name="credit-card" size={18} color={colors.textSecondary} />
										</View>
										<View style={styles.moreDetailsContent}>
											<Text style={styles.moreDetailsLabel}>Wallet Details</Text>
											<Text style={styles.moreDetailsValue}>{shop.wallet.bank || "Bank Not Specified"}</Text>
											<Text style={styles.moreDetailsSubValue}>{shop.wallet.title || "Title Not Specified"}</Text>
											<Text style={[styles.moreDetailsValueMono, { marginTop: 4 }]}>{shop.wallet.number || "Number Not Specified"}</Text>
										</View>
									</View>
								)}
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

	/* ── Shop Cover Image ── */
	coverImageContainer: {
		height: 220,
		marginHorizontal: -20,
		marginTop: -20,
		marginBottom: 20,
		position: "relative",
	},
	coverImage: {
		width: "100%",
		height: "100%",
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	coverImageOverlay: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		padding: 16,
		paddingTop: 32,
		backgroundColor: "rgba(0,0,0,0.5)", // Simple overlay for readability
		alignItems: "flex-end",
	},
	coverShopName: {
		fontSize: 22,
		fontWeight: "700",
		color: "#FFFFFF",
		textAlign: "right",
	},
	coverShopAddressRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-end",
		marginTop: 4,
		gap: 8,
	},
	coverShopAddress: {
		fontSize: 14,
		color: "#E2E8F0",
		textAlign: "right",
		maxWidth: "90%",
	},
	coverOnlineDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: colors.primary,
	},

	/* ── Shared Card ── */
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

	/* ── More Details ── */
	moreDetailsRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 14,
		paddingHorizontal: 16,
		gap: 12,
	},
	moreDetailsIconWrap: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: colors.background,
		justifyContent: "center",
		alignItems: "center",
	},
	moreDetailsContent: {
		flex: 1,
	},
	moreDetailsLabel: {
		fontSize: 12,
		fontWeight: "600",
		color: colors.textSecondary,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 4,
	},
	moreDetailsValue: {
		fontSize: 15,
		fontWeight: "600",
		color: colors.textPrimary,
	},
	moreDetailsSubValue: {
		fontSize: 13,
		color: colors.textSecondary,
		marginTop: 2,
	},
	moreDetailsValueMono: {
		fontSize: 13,
		fontFamily: "monospace",
		color: colors.textSecondary,
		marginTop: 2,
	},
	openMapButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "rgba(0, 217, 163, 0.1)",
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
	},
	openMapText: {
		fontSize: 13,
		fontWeight: "600",
		color: colors.primary,
	},
});

export default ShopDetails;
