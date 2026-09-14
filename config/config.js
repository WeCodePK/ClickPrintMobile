import Constants from "expo-constants";
const config = {
	apiBaseUrl: Constants.expoConfig?.extra?.apiBaseUrl || "https://api.clickprint.pk/api",
};
export default config;
