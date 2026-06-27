//----------------------------------- IMPORTS -----------------------------------//

import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import defaultAvatar from "../assets/profileAvatar.jpg";
import config from "../config/config";
import { colors } from "../constants/colors";

//----------------------------------- CONSTANTS -----------------------------------//

const API_BASE_URL = config.apiBaseUrl;

//----------------------------------- COMPONENTS -----------------------------------//

const EditProfile = () => {
    const router = useRouter();
    const params = useLocalSearchParams();

    // State fields
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [initialPhone, setInitialPhone] = useState("");
    const [avatarUri, setAvatarUri] = useState(null);
    const [initialAvatarUri, setInitialAvatarUri] = useState(null);

    // Status flags
    const [isPhoneVerified, setIsPhoneVerified] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [verifyingPhone, setVerifyingPhone] = useState(false);
    const [isImageModalVisible, setIsImageModalVisible] = useState(false);

    // Load user profile details
    useEffect(() => {
        const loadProfile = async () => {
            try {
                const token = await SecureStore.getItemAsync("authToken");
                const localName = await SecureStore.getItemAsync("name");
                const localAvatar = await SecureStore.getItemAsync("avatarUri");
                
                setName(localName || "");
                if (localAvatar) {
                    setAvatarUri(localAvatar);
                    setInitialAvatarUri(localAvatar);
                }

                // Fetch profile from api to get phone number and profile pic
                const response = await fetch(`${API_BASE_URL}/profile`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                const body = await response.json();

                if (body.success && body.data && body.data.profile) {
                    const profile = body.data.profile;
                    setName(profile.name || localName || "");

                    // Format phone number if database returned it
                    const dbPhone = profile.number || profile.phone || "";
                    setPhone(dbPhone);
                    setInitialPhone(dbPhone);

                    if (profile.avatar) {
                        setAvatarUri(profile.avatar);
                        setInitialAvatarUri(profile.avatar);
                        await SecureStore.setItemAsync("avatarUri", profile.avatar);
                    }
                }
            } catch (error) {
                console.error("Error loading profile:", error);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, []);

    // Handle returning parameters from OTP verification page
    useEffect(() => {
        if (params.phoneVerified === "true") {
            setIsPhoneVerified(true);
            if (params.phone) {
                setPhone(params.phone);
            }
            if (params.tempName) {
                setName(params.tempName);
            }
            if (params.tempAvatar) {
                setAvatarUri(params.tempAvatar === "null" ? null : params.tempAvatar);
            }
            Alert.alert("Success", "Phone number verified successfully!");
        }
    }, [params]);

    // Listen for phone input changes to invalidate verification status
    const handlePhoneChange = (text) => {
        setPhone(text);
        if (text.trim() === initialPhone.trim()) {
            setIsPhoneVerified(true);
        } else {
            setIsPhoneVerified(false);
        }
    };

    // Image Picker Option selection popup
    const handleImageEdit = () => {
        setIsImageModalVisible(true);
    };

    // Camera function
    const handleLaunchCamera = async () => {
        setIsImageModalVisible(false);
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissionResult.granted) {
            Alert.alert("Permission Required", "Camera access is needed to take a profile picture.");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            setAvatarUri(result.assets[0].uri);
        }
    };

    // Gallery function
    const handleLaunchGallery = async () => {
        setIsImageModalVisible(false);
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            Alert.alert("Permission Required", "Gallery access is needed to select a profile picture.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            setAvatarUri(result.assets[0].uri);
        }
    };

    // Send OTP for New Phone Number
    const handleVerifyPhone = async () => {
        const cleanedPhone = phone.trim();

        if (!cleanedPhone || cleanedPhone.length < 9) {
            Alert.alert("Invalid Phone", "Please enter a valid phone number.");
            return;
        }

        setVerifyingPhone(true);
        try {
            
            const response = await fetch(`${API_BASE_URL}/auth/otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ number: cleanedPhone }),
            });
            const data = await response.json();

            if (data.success) {
                
                router.replace({
                    pathname: "/otp",
                    params: {
                        phone: cleanedPhone,
                        fromEditProfile: "true",
                        tempName: name,
                        tempAvatar: avatarUri || "null",
                    },
                });
            } else {
                Alert.alert("Verification Error", data.message || "Failed to send verification code.");
            }
        } catch (error) {
            console.error("Error sending verification code:", error);
            Alert.alert("Network Error", "Unable to connect to the server. Please try again.");
        } finally {
            setVerifyingPhone(false);
        }
    };

    // Save Updated Details
    const handleSaveChanges = async () => {
        if (!name.trim()) {
            Alert.alert("Error", "Name cannot be empty.");
            return;
        }

        setSaving(true);
        try {
            const token = await SecureStore.getItemAsync("authToken");

            // Build the payload
            const payload = {
                name: name.trim(),
            };

            // Include updated phone number if changed & verified
            if (phone.trim() !== initialPhone.trim() && isPhoneVerified) {
                payload.number = phone.trim();
            }

            // Include avatar image uri (as base64 or uri string)
            if (avatarUri && avatarUri !== initialAvatarUri) {
                payload.avatar = avatarUri;
            }

            const response = await fetch(`${API_BASE_URL}/profile`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (response.ok || data.success) {
                // Save name and avatar in local secure storage
                await SecureStore.setItemAsync("name", name.trim());
                if (avatarUri) {
                    await SecureStore.setItemAsync("avatarUri", avatarUri);
                }
                Alert.alert("Success", "Profile updated successfully!", [
                    {
                        text: "OK",
                        onPress: () => router.replace("/(tabs)/profile"),
                    },
                ]);
            } else {
                Alert.alert("Error", data.message || "Failed to save profile modifications.");
            }
        } catch (error) {
            console.error("Save error:", error);
            Alert.alert("Connection Error", "Please check your internet connection.");
        } finally {
            setSaving(false);
        }
    };

    // Determine if Submit Edit is active
    const canSubmit = name.trim().length >= 2 && isPhoneVerified && !saving;

    if (loading) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Premium Custom Modal for Profile Image Options */}
            <Modal
                visible={isImageModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsImageModalVisible(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setIsImageModalVisible(false)}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Profile Picture</Text>
                            <TouchableOpacity 
                                onPress={() => setIsImageModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <Feather name="x" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalOptionsRow}>
                            <TouchableOpacity 
                                style={styles.modalOptionButton} 
                                onPress={handleLaunchCamera}
                            >
                                <View style={styles.iconCircle}>
                                    <Feather name="camera" size={28} color={colors.primary} />
                                </View>
                                <Text style={styles.modalOptionText}>Camera</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.modalOptionButton} 
                                onPress={handleLaunchGallery}
                            >
                                <View style={styles.iconCircle}>
                                    <Feather name="image" size={28} color={colors.primary} />
                                </View>
                                <Text style={styles.modalOptionText}>Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Top Profile Avatar in Circle with Edit Icon */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatarWrapper}>
                        <Image
                            source={avatarUri ? { uri: avatarUri } : defaultAvatar}
                            style={styles.avatarImage}
                        />
                        <TouchableOpacity style={styles.editIconWrapper} onPress={handleImageEdit}>
                            <Feather name="camera" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Input Fields */}
                <View style={styles.form}>
                    {/* Name Field */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your name"
                            placeholderTextColor={colors.textSecondary}
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    {/* Phone Number Field with Verify Button */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Phone Number</Text>
                        <View style={styles.phoneInputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginRight: 10 }]}
                                placeholder="3001234567"
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={handlePhoneChange}
                            />

                            {/* Show verify button only if number changed and not yet verified */}
                            {phone.trim() !== initialPhone.trim() && (
                                <TouchableOpacity
                                    style={[
                                        styles.verifyButton,
                                        isPhoneVerified && styles.verifiedButton,
                                        verifyingPhone && styles.disabledButton,
                                    ]}
                                    disabled={isPhoneVerified || verifyingPhone}
                                    onPress={handleVerifyPhone}
                                >
                                    {verifyingPhone ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.verifyButtonText}>
                                            {isPhoneVerified ? "Verified" : "Verify"}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                        {phone.trim() !== initialPhone.trim() && !isPhoneVerified && (
                            <Text style={styles.warningText}>
                                * You must verify your new phone number to save changes.
                            </Text>
                        )}
                    </View>
                </View>

                {/* Submit Edit Button */}
                <TouchableOpacity
                    style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                    disabled={!canSubmit}
                    onPress={handleSaveChanges}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Edit</Text>
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
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
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
        paddingBottom: 40,
    },
    avatarSection: {
        alignItems: "center",
        marginVertical: 32,
    },
    avatarWrapper: {
        position: "relative",
    },
    avatarImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: colors.primary,
        backgroundColor: colors.primaryLight,
    },
    editIconWrapper: {
        position: "absolute",
        bottom: 0,
        right: 4,
        backgroundColor: colors.primary,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: colors.cardBackground,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    form: {
        paddingHorizontal: 20,
        marginBottom: 32,
    },
    inputContainer: {
        marginBottom: 24,
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
    phoneInputRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    verifyButton: {
        height: 48,
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        minWidth: 90,
    },
    verifiedButton: {
        backgroundColor: "#4CAF50",
    },
    disabledButton: {
        opacity: 0.7,
    },
    verifyButtonText: {
        color: "#FFFFFF",
        fontWeight: "600",
        fontSize: 14,
    },
    warningText: {
        color: colors.printRequest || "#FF8B7B",
        fontSize: 12,
        marginTop: 6,
        fontWeight: "500",
    },
    submitButton: {
        backgroundColor: colors.primary,
        marginHorizontal: 20,
        height: 52,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: colors.shadowPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    submitButtonDisabled: {
        backgroundColor: colors.navInactive || "#858b96",
        shadowOpacity: 0,
        elevation: 0,
    },
    submitButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    modalContainer: {
        backgroundColor: colors.cardBackground,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: Platform.OS === "ios" ? 40 : 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.textPrimary,
    },
    closeButton: {
        padding: 4,
    },
    modalOptionsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        marginVertical: 12,
    },
    modalOptionButton: {
        alignItems: "center",
        justifyContent: "center",
        width: 100,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary + "15", // 15% opacity primary color
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.primary + "30",
    },
    modalOptionText: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textPrimary,
    },
});

export default EditProfile;
