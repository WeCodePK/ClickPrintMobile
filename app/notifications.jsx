//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../constants/colors";
import {
    ensureNotificationPermission,
    getNotificationPermissionStatus,
    getNotificationsEnabledPref,
    registerForPushNotifications,
    sendPushTokenToBackend,
    setNotificationsEnabledPref,
} from "../services/notifications";

const NotificationsSettings = () => {
    const router = useRouter();
    const navigation = useNavigation();

    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    // Effective "on" = OS permission granted AND the in-app preference is on.
    const load = async () => {
        try {
            const { status } = await getNotificationPermissionStatus();
            const pref = await getNotificationsEnabledPref();
            setEnabled(status === "granted" && pref);
        } catch (error) {
            console.error("Error loading notification settings:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    // Re-check when returning to the screen (e.g. user changed OS Settings).
    useEffect(() => {
        const unsubscribe = navigation.addListener("focus", load);
        return unsubscribe;
    }, [navigation]);

    const enableNotifications = async () => {
        // Explicit user action -> force the prompt, ignoring the 15-day cooldown.
        const status = await ensureNotificationPermission({ forceAsk: true });

        if (status === "granted") {
            await setNotificationsEnabledPref(true);
            setEnabled(true);

            const token = await registerForPushNotifications();
            if (token) await sendPushTokenToBackend(token);
            return;
        }

        // Permission not granted. If the OS won't show its dialog anymore, the
        // only way to enable is through system Settings.
        const { canAskAgain } = await getNotificationPermissionStatus();
        setEnabled(false);

        if (!canAskAgain) {
            Alert.alert(
                "Notifications Disabled",
                "Notifications are turned off for ClickPrint in your device settings. Please enable them from Settings.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open Settings", onPress: () => Linking.openSettings() },
                ]
            );
        }
    };

    const disableNotifications = async () => {
        await setNotificationsEnabledPref(false);
        setEnabled(false);
        // When the backend is wired up, unregister the push token here so the
        // server stops sending to this device.
    };

    const handleToggle = async (value) => {
        if (busy) return;
        setBusy(true);
        try {
            if (value) {
                await enableNotifications();
            } else {
                await disableNotifications();
            }
        } catch (error) {
            console.error("Error toggling notifications:", error);
            Alert.alert("Error", "Could not update your notification settings. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    //----------------------------------- STYLES -----------------------------------//

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.activityIndicator} />
                </View>
            ) : (
                <View style={styles.content}>
                    <View style={styles.card}>
                        <View style={styles.cardLeft}>
                            <Feather name="bell" size={20} color={colors.textPrimary} />
                            <View style={styles.cardTextWrap}>
                                <Text style={styles.cardTitle}>Push Notifications</Text>
                                <Text style={styles.cardSubtitle}>
                                    Get updates about your print jobs and account.
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={enabled}
                            onValueChange={handleToggle}
                            disabled={busy}
                            trackColor={{ false: colors.borderLight, true: colors.primary }}
                            thumbColor={colors.cardBackground}
                        />
                    </View>

                    <Text style={styles.helperText}>
                        You can also manage notification permissions anytime from your device settings.
                    </Text>
                </View>
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
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    card: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
    },
    cardLeft: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    cardTextWrap: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "500",
        color: colors.textPrimary,
    },
    cardSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    helperText: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 16,
        paddingHorizontal: 4,
        lineHeight: 18,
    },
});

export default NotificationsSettings;
