import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import appLogo from "../assets/icon.png";
import { colors } from "../constants/colors";



//----------------------------------- COMPONENTS -----------------------------------//

const AboutPage = () => {
	const router = useRouter();

	return (
		<SafeAreaView style={styles.container} edges={["top", "bottom"]}>
			<StatusBar barStyle="dark-content" backgroundColor={colors.background} />

			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.replace("/(tabs)/profile")} style={styles.backButton}>
					<Feather name="arrow-left" size={24} color={colors.textPrimary} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>About ClickPrint</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				
				<View style={styles.logoSection}>
					<View style={styles.logoCard}>
						<Image source={appLogo} style={styles.logo} resizeMode="contain" />
					</View>
					<Text style={styles.appName}>ClickPrint</Text>
					<Text style={styles.appVersion}>Version 1.0.0</Text>
				</View>

				<View style={styles.descriptionSection}>
					<Text style={styles.sectionTitle}>Our Purpose</Text>
					<Text style={styles.descriptionText}>
						ClickPrint is a complete mobile printing assistant designed to bridge the gap between you and local print shops. With ClickPrint, you can find nearby print shops, securely upload your documents, configure your exact print settings (copies, colors, layout format), and pay digitally using your in-app wallet balance. Avoid lines, manual file transfers, and layout mismatches—print everything in just a few clicks.
					</Text>
				</View>

				{/* Key Features */}
				<View style={styles.featuresSection}>
					<Text style={styles.sectionTitle}>Key Features</Text>

					
					<View style={styles.featureCard}>
						<View style={styles.featureIconContainer}>
							<Feather name="map-pin" size={20} color={colors.primary} />
						</View>
						<View style={styles.featureContent}>
							<Text style={styles.featureTitle}>Find Local Print Shops</Text>
							<Text style={styles.featureDescription}>
								Discover nearby print shops and select the most convenient one.
							</Text>
						</View>
					</View>

					
					<View style={styles.featureCard}>
						<View style={styles.featureIconContainer}>
							<Feather name="sliders" size={20} color={colors.primary} />
						</View>
						<View style={styles.featureContent}>
							<Text style={styles.featureTitle}>Custom Print Settings</Text>
							<Text style={styles.featureDescription}>
								Choose copy counts, page ranges, colors, and layout formats easily.
							</Text>
						</View>
					</View>

					
					<View style={styles.featureCard}>
						<View style={styles.featureIconContainer}>
							<Feather name="credit-card" size={20} color={colors.primary} />
						</View>
						<View style={styles.featureContent}>
							<Text style={styles.featureTitle}>Digital Wallet Payments</Text>
							<Text style={styles.featureDescription}>
								Pay securely using your prepaid wallet and monitor transactions.
							</Text>
						</View>
					</View>
				</View>

				
				<View style={styles.infoSection}>
					<View style={styles.infoCard}>
						
						<View style={styles.infoRowLast}>
							<Text style={styles.infoLabel}>Status</Text>
							<Text style={styles.infoValue}>Production Ready</Text>
						</View>
					</View>
				</View>

				<View style={styles.footer}>
					<Text style={styles.footerText}>Made by ClickPrint Team</Text>
				</View>
			</ScrollView>
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
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		height: 56,
		backgroundColor: colors.cardBackground,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	backButton: {
		padding: 8,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	placeholder: {
		width: 40,
	},
	scrollContent: {
		paddingBottom: 40,
		alignItems: "center",
	},
	logoSection: {
		alignItems: "center",
		marginTop: 32,
		marginBottom: 24,
	},
	logoCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 24,
		padding: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 10,
		elevation: 5,
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	logo: {
		width: 100,
		height: 100,
		borderRadius: 16,
	},
	appName: {
		fontSize: 24,
		fontWeight: "800",
		color: colors.textPrimary,
		marginTop: 16,
		letterSpacing: 0.5,
	},
	appVersion: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textSecondary,
		marginTop: 4,
	},
	descriptionSection: {
		paddingHorizontal: 24,
		marginBottom: 32,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 12,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	descriptionText: {
		fontSize: 15,
		lineHeight: 22,
		color: colors.textSecondary,
		textAlign: "justify",
	},
	featuresSection: {
		width: "100%",
		paddingHorizontal: 24,
		marginBottom: 32,
	},
	featureCard: {
		flexDirection: "row",
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: colors.borderLight,
		shadowColor: colors.shadowLight,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	featureIconContainer: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: colors.primary + "15",
		justifyContent: "center",
		alignItems: "center",
		marginRight: 16,
	},
	featureContent: {
		flex: 1,
	},
	featureTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: colors.textPrimary,
		marginBottom: 4,
	},
	featureDescription: {
		fontSize: 14,
		lineHeight: 18,
		color: colors.textSecondary,
	},
	infoSection: {
		width: "100%",
		paddingHorizontal: 24,
		marginBottom: 24,
	},
	infoCard: {
		backgroundColor: colors.cardBackground,
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: colors.borderLight,
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: colors.borderLight,
	},
	infoRowLast: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 12,
		borderBottomWidth: 0,
	},
	infoLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.textSecondary,
	},
	infoValue: {
		fontSize: 14,
		fontWeight: "700",
		color: colors.textPrimary,
	},
	footer: {
		marginTop: 16,
		marginBottom: 24,
	},
	footerText: {
		fontSize: 12,
		fontWeight: "500",
		color: colors.textSecondary,
	},
});

export default AboutPage;
