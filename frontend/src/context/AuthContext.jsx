import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loginRequest, meRequest } from "../api/auth";
import { clearToken, getToken, setToken, setUnauthorizedHandler } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { username }
  const [checking, setChecking] = useState(true);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // On startup: if a token is stored, ask the backend whether it is still valid
  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) {
      setChecking(false);
      return;
    }
    meRequest()
      .then((data) => setUser({ username: data.username }))
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, [logout]);

  const login = async (username, password) => {
    const data = await loginRequest(username, password);
    setToken(data.token);
    setUser({ username: data.username });
  };

  return <AuthContext.Provider value={{ user, checking, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
