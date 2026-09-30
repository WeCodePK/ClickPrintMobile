import SecureStore from "../utils/storage";
import { createContext, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import config from "../config/config"
import { clearQueryCache } from "../lib/queryClient";
import { resetUnauthorized, setUnauthorizedHandler } from "../utils/api";
import { clearAllUploads } from "../utils/uploadManager";

const AuthContext = createContext(null);

// How long the background session check waits before giving up; it runs
// again on the next reconnect / return to the foreground.
const VERIFY_TIMEOUT_MS = 15000;

// authState: "checking" | "guest" | "needs-profile" | "authed"
// "needs-profile" means the user has a valid token but hasn't set a name yet.
//
// The initial state comes from local storage alone, so the app opens instantly
// (and offline). The token is then verified in the background: only a 401
// (token rejected) or 404 (user deleted) ends the session. Network errors,
// timeouts and 5xx keep it, and the check runs again when the connection or
// the app comes back.
export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState("checking");

  useEffect(() => {
    let disposed = false;
    let verified = false;
    let verifying = false;

    const clearSession = async () => {
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("userId");
      await clearQueryCache().catch(() => {});
      clearAllUploads();
      if (!disposed) setAuthState("guest");
    };

    const verify = async () => {
      if (verified || verifying || disposed) return;
      verifying = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
      try {
        const token = await SecureStore.getItemAsync("authToken");
        const userId = await SecureStore.getItemAsync("userId");
        if (!token || !userId) return;
        const res = await fetch(`${config.apiBaseUrl}/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.status === 401 || res.status === 404) {
          verified = true;
          await clearSession();
          return;
        }
        // 5xx / proxy error pages: keep the session and try again later.
        if (!res.ok) return;
        const body = await res.json();
        verified = true;
        const name = body?.data?.user?.name;
        if (disposed) return;
        if (name) {
          await SecureStore.setItemAsync("name", name);
          setAuthState("authed");
        } else {
          setAuthState("needs-profile");
        }
      } catch {
        // Offline, timed out or unreadable response: keep the session.
      } finally {
        clearTimeout(timer);
        verifying = false;
      }
    };

    (async () => {
      try {
        const token = await SecureStore.getItemAsync("authToken");
        const userId = await SecureStore.getItemAsync("userId");
        if (!token || !userId) {
          // No userId means the session predates the /users/:userId routes —
          // it can't be used to fetch the profile, so re-authenticate.
          await SecureStore.deleteItemAsync("authToken");
          setAuthState("guest");
          return;
        }
        const name = await SecureStore.getItemAsync("name");
        setAuthState(name ? "authed" : "needs-profile");
        verify();
      } catch {
        setAuthState("guest");
      }
    })();

    // Retry the check when the connection or the app comes back.
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") verify();
    });
    const isWeb = Platform.OS === "web" && typeof window !== "undefined";
    if (isWeb) window.addEventListener("online", verify);

    return () => {
      disposed = true;
      appStateSub.remove();
      if (isWeb) window.removeEventListener("online", verify);
    };
  }, []);

  const signIn = async (token, user) => {
    resetUnauthorized();
    await SecureStore.setItemAsync("authToken", token);
    if (user?._id) {
      await SecureStore.setItemAsync("userId", String(user._id));
    }
    if (user?.name) {
      await SecureStore.setItemAsync("name", user.name);
      setAuthState("authed");
    } else {
      setAuthState("needs-profile");
    }
  };

  const completeProfile = async (name) => {
    await SecureStore.setItemAsync("name", name);
    setAuthState("authed");
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("userId");
    await SecureStore.deleteItemAsync("name");
    // Saved data and unfinished uploads belong to this user; don't show them
    // to the next one.
    await clearQueryCache().catch(() => {});
    clearAllUploads();
    setAuthState("guest");
  };

  // Any request rejected with a 401 (token expired or revoked) ends the
  // session; the root layout then routes to the login screen.
  useEffect(() => setUnauthorizedHandler(() => signOut()), []);

  return (
    <AuthContext.Provider value={{ authState, signIn, signOut, completeProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);