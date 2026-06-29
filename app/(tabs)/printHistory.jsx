//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";
import { useTransactions } from "../../hooks/useTransactions";
import TransactionList from "../components/TransactionList";

//----------------------------------- COMPONENTS -----------------------------------//

const PrintHistory = () => {
	const router = useRouter();
	const { transactions: backendTransactions, loading, error, refreshing, refresh } = useTransactions();

	const [filterModalVisible, setFilterModalVisible] = useState(false);
	const [sortModalVisible, setSortModalVisible] = useState(false);
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [selectedStatus, setSelectedStatus] = useState("all");
	const [sortBy, setSortBy] = useState("date");
	const [sortOrder, setSortOrder] = useState("desc");

	// Filter and Sort Logic
	const filteredAndSortedTransactions = useMemo(() => {
		let filtered = [...backendTransactions];

		// Filter by Date From
		if (dateFrom) {
			const fromDate = new Date(dateFrom);
			if (!isNaN(fromDate.getTime())) {
				filtered = filtered.filter((t) => new Date(t.timestamp || t.date) >= fromDate);
			}
		}

		// Filter by Date To
		if (dateTo) {
			const toDate = new Date(dateTo);
			if (!isNaN(toDate.getTime())) {
				filtered = filtered.filter((t) => new Date(t.timestamp || t.date) <= toDate);
			}
		}

		// Filter by Status
		if (selectedStatus && selectedStatus !== "all") {
			filtered = filtered.filter((t) => t.status?.toLowerCase() === selectedStatus.toLowerCase());
		}

		// Sorting Logic
		filtered.sort((a, b) => {
			let comparison = 0;

			switch (sortBy) {
				case "date":
					comparison = new Date(a.timestamp) - new Date(b.timestamp);
					break;
				case "status":
					comparison = (a.status || "").localeCompare(b.status || "");
					break;
				case "fileCount":
					comparison = a.fileCount - b.fileCount;
					break;
				case "cost":
					comparison = (a.cost || 0) - (b.cost || 0);
					break;
				default:
					comparison = 0;
			}

			return sortOrder === "asc" ? comparison : -comparison;
		});

		return filtered;
	}, [backendTransactions, dateFrom, dateTo, selectedStatus, sortBy, sortOrder]);

	const clearFilters = () => {
		setDateFrom("");
		setDateTo("");
		setSelectedStatus("all");
		setSortBy("date");
		setSortOrder("desc");
	};

	const activeFiltersCount = () => {
		let count = 0;
		if (dateFrom || dateTo) count++;
		if (selectedStatus && selectedStatus !== "all") count++;
		return count;
	};

	//----------------------------------- RENDER -----------------------------------//

	if (loading) {
		return (
			<SafeAreaView style={styles.container} edges={["top"]}>
				<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
				<View style={styles.header}>
					<Text style={styles.headerTitle}>Print History</Text>
				</View>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={styles.loadingText}>Loading transactions...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (error) {
		return (
			<SafeAreaView style={styles.container} edges={["top"]}>
				<StatusBar barStyle="dark-content" backgroundColor={colors.background} />
				<View style={styles.header}>
					<Text style={styles.headerTitle}>Print History</Text>
				</View>
				<View style={styles.errorContainer}>
					<Feather name="alert-circle" size={48} color={colors.expense} />
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity style={styles.retryButton} onPress={refresh}>
						<Text style={styles.retryButtonText}>Retry</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />

			<View style={styles.header}>
				<Text style={styles.headerTitle}>Print History</Text>
			</View>

			{/* Filter and Sort Bar */}
			<View style={styles.filterBar}>
				<TouchableOpacity style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
					<Feather name="filter" size={18} color={colors.textPrimary} />
					<Text style={styles.filterButtonText}>Filter</Text>
					{activeFiltersCount() > 0 && (
						<View style={styles.filterBadge}>
							<Text style={styles.filterBadgeText}>{activeFiltersCount()}</Text>
						</View>
					)}
				</TouchableOpacity>

				<TouchableOpacity style={styles.filterButton} onPress={() => setSortModalVisible(true)}>
					<Feather name="arrow-up-right" size={18} color={colors.textPrimary} />
					<Text style={styles.filterButtonText}>Sort</Text>
				</TouchableOpacity>

				{activeFiltersCount() > 0 && (
					<TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
						<Text style={styles.clearButtonText}>Clear</Text>
					</TouchableOpacity>
				)}
			</View>

			{/* Scrollable list showing all items at once */}
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={refresh}
						colors={[colors.primary]}
						tintColor={colors.primary}
					/>
				}
			>
				{filteredAndSortedTransactions.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Feather name="inbox" size={48} color={colors.textSecondary} />
						<Text style={styles.emptyText}>No transactions found</Text>
					</View>
				) : (
					<TransactionList
						transactions={filteredAndSortedTransactions}
						onTransactionPress={(t) =>
							router.push({ pathname: "/transaction-details", params: { transaction: JSON.stringify(t) } })
						}
					/>
				)}
			</ScrollView>

			{/* Filter Modal */}
			<Modal visible={filterModalVisible} animationType="slide" transparent={true} onRequestClose={() => setFilterModalVisible(false)}>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>Filter Transactions</Text>
							<TouchableOpacity onPress={() => setFilterModalVisible(false)}>
								<Feather name="x" size={24} color={colors.textPrimary} />
							</TouchableOpacity>
						</View>

						{/* Date Range Filter */}
						<View style={styles.filterSection}>
							<Text style={styles.filterLabel}>Date Range</Text>
							<View style={styles.dateInputs}>
								<View style={styles.dateInputWrapper}>
									<Text style={styles.dateInputLabel}>From</Text>
									<TextInput
										style={styles.dateInput}
										placeholder="YYYY-MM-DD"
										value={dateFrom}
										onChangeText={setDateFrom}
										placeholderTextColor={colors.textSecondary}
									/>
								</View>
								<View style={styles.dateInputWrapper}>
									<Text style={styles.dateInputLabel}>To</Text>
									<TextInput
										style={styles.dateInput}
										placeholder="YYYY-MM-DD"
										value={dateTo}
										onChangeText={setDateTo}
										placeholderTextColor={colors.textSecondary}
									/>
								</View>
							</View>
						</View>

						{/* Status Filter */}
						<View style={styles.filterSection}>
							<Text style={styles.filterLabel}>Status</Text>
							<View style={styles.statusOptions}>
								{["all", "completed", "submitted", "processing", "pending", "cancelled"].map((status) => (
									<TouchableOpacity
										key={status}
										style={[
											styles.statusBadgeOption,
											selectedStatus === status && styles.statusBadgeOptionSelected,
										]}
										onPress={() => setSelectedStatus(status)}
									>
										<Text
											style={[
												styles.statusBadgeOptionText,
												selectedStatus === status && styles.statusBadgeOptionTextSelected,
											]}
										>
											{status.charAt(0).toUpperCase() + status.slice(1)}
										</Text>
									</TouchableOpacity>
								))}
							</View>
						</View>

						{/* Apply Button */}
						<TouchableOpacity style={styles.applyButton} onPress={() => setFilterModalVisible(false)}>
							<Text style={styles.applyButtonText}>Apply Filters</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			{/* Sort Modal */}
			<Modal visible={sortModalVisible} animationType="slide" transparent={true} onRequestClose={() => setSortModalVisible(false)}>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>Sort By</Text>
							<TouchableOpacity onPress={() => setSortModalVisible(false)}>
								<Feather name="x" size={24} color={colors.textPrimary} />
							</TouchableOpacity>
						</View>

						{/* Sort Options */}
						<TouchableOpacity
							style={styles.sortOption}
							onPress={() => {
								if (sortBy === "date") {
									setSortOrder(sortOrder === "desc" ? "asc" : "desc");
								} else {
									setSortBy("date");
									setSortOrder("desc");
								}
							}}
						>
							<View style={styles.sortOptionLeft}>
								<Feather name="calendar" size={20} color={colors.textPrimary} />
								<Text style={styles.sortOptionText}>Date & Time</Text>
							</View>
							{sortBy === "date" && <Feather name={sortOrder === "desc" ? "arrow-down" : "arrow-up"} size={20} color={colors.primary} />}
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.sortOption}
							onPress={() => {
								if (sortBy === "status") {
									setSortOrder(sortOrder === "desc" ? "asc" : "desc");
								} else {
									setSortBy("status");
									setSortOrder("asc");
								}
							}}
						>
							<View style={styles.sortOptionLeft}>
								<Feather name="activity" size={20} color={colors.textPrimary} />
								<Text style={styles.sortOptionText}>Status</Text>
							</View>
							{sortBy === "status" && <Feather name={sortOrder === "desc" ? "arrow-down" : "arrow-up"} size={20} color={colors.primary} />}
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.sortOption}
							onPress={() => {
								if (sortBy === "fileCount") {
									setSortOrder(sortOrder === "desc" ? "asc" : "desc");
								} else {
									setSortBy("fileCount");
									setSortOrder("desc");
								}
							}}
						>
							<View style={styles.sortOptionLeft}>
								<Feather name="file" size={20} color={colors.textPrimary} />
								<Text style={styles.sortOptionText}>File Count</Text>
							</View>
							{sortBy === "fileCount" && (
								<Feather name={sortOrder === "desc" ? "arrow-down" : "arrow-up"} size={20} color={colors.primary} />
							)}
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.sortOption}
							onPress={() => {
								if (sortBy === "cost") {
									setSortOrder(sortOrder === "desc" ? "asc" : "desc");
								} else {
									setSortBy("cost");
									setSortOrder("desc");
								}
							}}
						>
							<View style={styles.sortOptionLeft}>
								<Feather name="dollar-sign" size={20} color={colors.textPrimary} />
								<Text style={styles.sortOptionText}>Cost</Text>
							</View>
							{sortBy === "cost" && (
								<Feather name={sortOrder === "desc" ? "arrow-down" : "arrow-up"} size={20} color={colors.primary} />
							)}
						</TouchableOpacity>

						{/* Apply Button */}
						<TouchableOpacity style={styles.applyButton} onPress={() => setSortModalVisible(false)}>
							<Text style={styles.applyButtonText}>Apply</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
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
		justifyContent: "center",
		paddingHorizontal: 20,
		paddingVertical: 16,
		backgroundColor: colors.cardBackground,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	filterBar: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 12,
		backgroundColor: colors.cardBackground,
		gap: 12,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	filterButton: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 8,
		backgroundColor: colors.background,
		borderRadius: 20,
		gap: 6,
	},
	filterButtonText: {
		fontSize: 14,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	filterBadge: {
		width: 18,
		height: 18,
		borderRadius: 9,
		backgroundColor: colors.primary,
		justifyContent: "center",
		alignItems: "center",
		marginLeft: 4,
	},
	filterBadgeText: {
		fontSize: 10,
		fontWeight: "700",
		color: colors.cardBackground,
	},
	clearButton: {
		marginLeft: "auto",
	},
	clearButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.expense,
	},
	scrollView: {
		flex: 1,
		backgroundColor: colors.cardBackground,
	},
	scrollContent: {
		padding: 20,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	modalContent: {
		backgroundColor: colors.cardBackground,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		padding: 24,
		maxHeight: "80%",
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 24,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	filterSection: {
		marginBottom: 24,
	},
	filterLabel: {
		fontSize: 16,
		fontWeight: "600",
		color: colors.textPrimary,
		marginBottom: 12,
	},
	dateInputs: {
		gap: 12,
	},
	dateInputWrapper: {
		gap: 8,
	},
	dateInputLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: colors.textSecondary,
	},
	dateInput: {
		borderWidth: 1,
		borderColor: colors.borderLight,
		borderRadius: 12,
		padding: 12,
		fontSize: 14,
		color: colors.textPrimary,
	},
	statusOptions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginBottom: 8,
	},
	statusBadgeOption: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: colors.borderLight,
		backgroundColor: colors.background,
	},
	statusBadgeOptionSelected: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	statusBadgeOptionText: {
		fontSize: 13,
		fontWeight: "500",
		color: colors.textSecondary,
	},
	statusBadgeOptionTextSelected: {
		color: colors.cardBackground,
		fontWeight: "600",
	},
	applyButton: {
		backgroundColor: colors.primary,
		paddingVertical: 16,
		borderRadius: 12,
		alignItems: "center",
		marginTop: 12,
	},
	applyButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.cardBackground,
	},
	sortOption: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	sortOptionLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	sortOptionText: {
		fontSize: 16,
		fontWeight: "500",
		color: colors.textPrimary,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		gap: 12,
	},
	loadingText: {
		fontSize: 14,
		color: colors.textSecondary,
	},
	errorContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
		gap: 16,
	},
	errorText: {
		fontSize: 16,
		color: colors.textSecondary,
		textAlign: "center",
	},
	retryButton: {
		backgroundColor: colors.primary,
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 12,
	},
	retryButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.cardBackground,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingVertical: 60,
		gap: 12,
	},
	emptyText: {
		fontSize: 16,
		color: colors.textSecondary,
	},
});

export default PrintHistory;
