import SecureStore from "../utils/storage";
import { createContext, useContext, useEffect, useState } from "react";
import config from "../config/config"

const AuthContext = createContext(null);

// authState: "checking" | "guest" | "needs-profile" | "authed"
// "needs-profile" means the user has a valid token but hasn't set a name yet.
export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState("checking");

  useEffect(() => {
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
        const res = await fetch(`${config.apiBaseUrl}/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          await SecureStore.deleteItemAsync("authToken");
          await SecureStore.deleteItemAsync("userId");
          setAuthState("guest");
          return;
        }
        const body = await res.json();
        const name = body?.data?.user?.name;
        if (name) {
          await SecureStore.setItemAsync("name", name);
          setAuthState("authed");
        } else {
          setAuthState("needs-profile");
        }
      } catch {
        setAuthState("guest");
      }
    })();
  }, []);

  const signIn = async (token, user) => {
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
    setAuthState("guest");
  };

  return (
    <AuthContext.Provider value={{ authState, signIn, signOut, completeProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);