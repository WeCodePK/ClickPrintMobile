import Constants from "expo-constants";
const commitSha = Constants.expoConfig?.extra?.commitSha || "unknown";
const config = {
	apiBaseUrl: Constants.expoConfig?.extra?.apiBaseUrl || "https://api.clickprint.pk/api",
	commitSha,
	// Short SHA for display, keeping any "-dirty" suffix (e.g. "a1b2c3d-dirty").
	buildNumber: commitSha.replace(/^([0-9a-f]{7})[0-9a-f]+/i, "$1"),
};
export default config;
