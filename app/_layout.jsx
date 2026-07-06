import * as SplashScreen from "expo-splash-screen";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "../context/auth";

SplashScreen.preventAutoHideAsync();

function RootNavigation() {
  const { authState } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const initialRedirectDone = useRef(false);

  useEffect(() => {
    if (authState === "checking") return;
    if (!initialRedirectDone.current) {
      initialRedirectDone.current = true;
      const inTabs = segments[0] === "(tabs)";
      if (authState === "guest" && inTabs) router.replace("/");
      if (authState === "authed" && !inTabs) router.replace("/(tabs)/home");
    }
    SplashScreen.hideAsync();
  }, [authState, segments]);

  if (authState === "checking") return null;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}