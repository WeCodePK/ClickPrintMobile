import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../context/auth";
import { colors } from "../constants/colors";
import WebInstallGate from "../components/WebInstallGate";
import AlertHost from "../components/CustomAlert";
import ServiceWorkerUpdater from "../components/ServiceWorkerUpdater";

SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync(colors.background);

// Routes reachable without a completed profile: "/" (login) and "/otp".
function isGuestOnlyRoute(segment) {
  return segment === undefined || segment === "otp";
}

function RootNavigation() {
  const { authState } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  // Tracks whether the splash screen has been hidden once. Unlike that,
  // the redirect below is NOT one-time: it re-enforces on every authState/
  // route change for the whole session, so a user who ends up on a route
  // that doesn't match their authState (e.g. backgrounding the app mid
  // onboarding, a deep link, a back gesture) is always bounced back, not
  // just on the first resolved route. Authed users with a completed profile
  // are never targeted by this, since redirectTarget only fires for the
  // three specific mismatches below — free in-app navigation is unaffected.
  const [initialRouteReady, setInitialRouteReady] = useState(false);

  const inGuestOnly = isGuestOnlyRoute(segments[0]);
  const inProfileSetup = segments[0] === "profile-setup";

  let redirectTarget = null;
  if (authState === "guest" && !inGuestOnly) redirectTarget = "/";
  else if (authState === "needs-profile" && !inProfileSetup) redirectTarget = "/profile-setup";
  else if (authState === "authed" && (inGuestOnly || inProfileSetup)) redirectTarget = "/(tabs)/home";

  useEffect(() => {
    if (authState === "checking") return;
    if (redirectTarget) {
      router.replace(redirectTarget);
      return;
    }
    if (!initialRouteReady) {
      setInitialRouteReady(true);
      SplashScreen.hideAsync();
    }
  }, [authState, redirectTarget, initialRouteReady, router]);

  // Keep the splash screen up until the route actually matches the resolved
  // authState, otherwise the wrong screen flashes for a frame while the
  // redirect above is still in flight.
  if (authState === "checking" || !initialRouteReady) return null;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <>
      <WebInstallGate>
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
        <AlertHost />
      </WebInstallGate>
      {/* Outside the gate so updates also apply on the install page, and
          mounted last so its updating screen sits above alerts. */}
      <ServiceWorkerUpdater />
    </>
  );
}