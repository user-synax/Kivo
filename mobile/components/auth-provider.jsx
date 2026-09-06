import { createContext, useContext, useEffect, useState } from "react";
import { clearSession, restoreSession } from "../lib/auth";

const AuthContext = createContext({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await restoreSession();
      setUser(s.user || null);
      setLoading(false);
    })();
  }, []);

  async function signOut() {
    await clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
