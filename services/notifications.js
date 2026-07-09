import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import SecureStore from "../utils/storage";
import Constants from "expo-constants";
import config from "../config/config";

const API_BASE_URL = config.apiBaseUrl;

// SecureStore keys
const PERMISSION_LAST_ASKED_KEY = "notifPermissionLastAsked"; // timestamp (ms) of last system prompt
const NOTIF_ENABLED_KEY = "notifEnabled";                     // in-app on/off preference

// Re-ask for permission at most once every 15 days after a denial.
const REASK_INTERVAL_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function createAndroidNotificationChannel() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }
}

// ----------------------------------- PREFERENCES -----------------------------------//

// In-app notifications preference. Defaults to enabled (true) when never set,
// so a fresh install still prompts + registers on first authenticated launch.
export async function getNotificationsEnabledPref() {
    const value = await SecureStore.getItemAsync(NOTIF_ENABLED_KEY);
    return value === null ? true : value === "true";
}

export async function setNotificationsEnabledPref(enabled) {
    await SecureStore.setItemAsync(NOTIF_ENABLED_KEY, enabled ? "true" : "false");
}

// ----------------------------------- PERMISSIONS -----------------------------------//

export async function getNotificationPermissionStatus() {
    // { status: 'granted' | 'denied' | 'undetermined', canAskAgain: boolean }
    return await Notifications.getPermissionsAsync();
}

// Whether enough time has passed since we last showed the system prompt.
async function isPastReaskCooldown() {
    const last = await SecureStore.getItemAsync(PERMISSION_LAST_ASKED_KEY);
    if (!last) return true;
    return Date.now() - Number(last) >= REASK_INTERVAL_DAYS * DAY_MS;
}

/**
 * Ensures notification permission, returning the final status.
 *
 * Automatic path (forceAsk = false, e.g. app launch): only shows the system
 * prompt if the OS will actually display it (canAskAgain) AND we're outside the
 * 15-day cooldown since the last ask. Otherwise it stays quiet.
 *
 * Explicit path (forceAsk = true, e.g. user flips the toggle): always attempts
 * the prompt, ignoring the cooldown. If the OS won't show it (hard-denied), the
 * caller should route the user to system Settings.
 */
export async function ensureNotificationPermission({ forceAsk = false } = {}) {
    const { status: existingStatus, canAskAgain } = await Notifications.getPermissionsAsync();
    if (existingStatus === "granted") return existingStatus;

    // OS won't show the dialog anymore (hard-denied) — nothing to do here.
    if (!canAskAgain) return existingStatus;

    if (!forceAsk && !(await isPastReaskCooldown())) {
        // Within the 15-day quiet window; don't nag.
        return existingStatus;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    await SecureStore.setItemAsync(PERMISSION_LAST_ASKED_KEY, String(Date.now()));
    return status;
}

export async function registerForPushNotifications({ forceAsk = false } = {}) {
    const finalStatus = await ensureNotificationPermission({ forceAsk });

    if (finalStatus !== "granted") {
        console.log("Permission not granted to get push token for push notification!");
        return;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
        console.log("Project ID not found");
        return;
    }

    try {
        const pushTokenString = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log("Push token:", pushTokenString);
        return pushTokenString;
    } catch (e) {
        console.log(`Failed to get push token: ${e}`);
    }
}

export async function sendPushTokenToBackend(expoPushToken) {
    if (!expoPushToken) return;

    const authToken = await SecureStore.getItemAsync("authToken");
    if (!authToken) {
        console.log("No auth token found, skipping push token registration");
        return;
    }
    console.log("I am being hit...!");
    try {
        const response = await fetch(`${API_BASE_URL}/profile/pushTokens`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ expoPushToken }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Push token registered with backend:", data);
        return data;
    } catch (e) {
        console.log(`Failed to send push token to backend: ${e}`);
    }
}
