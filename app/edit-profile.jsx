//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import config from "../config/config";
import { colors } from "../constants/colors";

//----------------------------------- COMPONENTS -----------------------------------//

const EditProfile = () => {
    const router = useRouter();
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadName = async () => {
            const storedName = await SecureStore.getItemAsync("name");
            setName(storedName || "");
        };
        loadName();
    }, []);

    const handleSave = async () => {
        if (!name.trim() || name.trim().length < 2) {
            Alert.alert("Invalid Name", "Name must be at least 2 characters.");
            return;
        }
        setSaving(true);
        try {
            const token = await SecureStore.getItemAsync("authToken");
            const response = await fetch(`${config.apiBaseUrl}/profile`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name: name.trim() }),
            });
            const data = await response.json();

            if (response.ok || data.success) {
                await SecureStore.setItemAsync("name", name.trim());
                router.replace("/(tabs)/profile");
            } else {
                Alert.alert("Error", data.message || "Failed to update name. Please try again.");
            }
        } catch (error) {
            Alert.alert("Connection Error", "Please check your internet connection.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.form}>
                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your name"
                        placeholderTextColor={colors.textSecondary}
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, (saving || name.trim().length < 2) && styles.saveButtonDisabled]}
                    disabled={saving || name.trim().length < 2}
                    onPress={handleSave}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
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
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 32,
        paddingBottom: 40,
    },
    form: {
        marginBottom: 32,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textSecondary,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        height: 48,
        backgroundColor: colors.cardBackground,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.borderLight,
        paddingHorizontal: 16,
        fontSize: 16,
        color: colors.textPrimary,
    },
    saveButton: {
        backgroundColor: colors.primary,
        height: 52,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        elevation: 4,
    },
    saveButtonDisabled: {
        backgroundColor: colors.navInactive || "#858b96",
        elevation: 0,
    },
    saveButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
});

export default EditProfile;
