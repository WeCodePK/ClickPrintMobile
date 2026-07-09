import SecureStore from "../utils/storage";
import { createContext, useContext, useEffect, useState } from "react";
import config from "../config/config"

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState("checking"); 

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync("authToken");
        if (!token) {
          setAuthState("guest");
          return;
        }
        const res = await fetch(`${config.apiBaseUrl}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setAuthState("authed");
        } else {
          await SecureStore.deleteItemAsync("authToken");
          setAuthState("guest");
        }
      } catch {
        setAuthState("guest");
      }
    })();
  }, []);

  const signIn = async (token) => {
    await SecureStore.setItemAsync("authToken", token);
    setAuthState("authed"); 
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("name");
    setAuthState("guest"); 
  };

  return (
    <AuthContext.Provider value={{ authState, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);