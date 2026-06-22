import { createContext, useContext, useEffect, useState } from 'react';
import { authApi, getToken, setToken, clearToken } from '../services/api';
import { authSocket } from '../services/realtime';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // { uid, phone }
  const [profile, setProfile] = useState(null); // users/{uid}
  const [loading, setLoading] = useState(true);

  // On load: if we have a stored JWT, fetch the current profile.
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (token) {
        try {
          const me = await authApi.me();
          setUser(me.user);
          setProfile(me.profile);
          authSocket(token);
        } catch {
          clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  // Called by LoginPage after a successful verify-otp.
  const login = (token, prof) => {
    setToken(token);
    setProfile(prof);
    setUser({ uid: prof?.id, phone: prof?.phone });
    authSocket(token);
  };

  const signOut = () => {
    clearToken();
    setUser(null);
    setProfile(null);
  };

  const hasRole = (...roles) =>
    !!profile && (roles.includes(profile.role) || roles.includes(profile.customRole));

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, signOut, hasRole, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
