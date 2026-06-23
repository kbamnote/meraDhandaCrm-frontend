import { createContext, useContext, useEffect, useState } from 'react';
import { authApi, tenantApi, getToken, setToken, clearToken } from '../services/api';
import { authSocket } from '../services/realtime';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // { uid, email }
  const [profile, setProfile] = useState(null); // users/{uid}
  const [tenant, setTenant] = useState(null);   // the user's company (plan/trial)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (token) {
        try {
          const me = await authApi.me();
          setUser(me.user);
          setProfile(me.profile);
          authSocket(token);
          try { const t = await tenantApi.get(); setTenant(t.tenant); } catch { /* ignore */ }
        } catch {
          clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  // Called by LoginPage / SignupPage after success.
  const login = (token, prof, tnt) => {
    setToken(token);
    setProfile(prof);
    setUser({ uid: prof?.id, email: prof?.email });
    setTenant(tnt || null);
    authSocket(token);
    if (!tnt) tenantApi.get().then((t) => setTenant(t.tenant)).catch(() => {});
  };

  const signOut = () => {
    clearToken();
    setUser(null);
    setProfile(null);
    setTenant(null);
  };

  const refreshTenant = () => tenantApi.get().then((t) => setTenant(t.tenant)).catch(() => {});

  const hasRole = (...roles) =>
    !!profile && (roles.includes(profile.role) || roles.includes(profile.customRole));

  const isPlatformAdmin = !!(profile && profile.platformAdmin);

  return (
    <AuthContext.Provider value={{
      user, profile, tenant, loading, login, signOut, hasRole, isPlatformAdmin,
      refreshTenant, setProfile, setTenant,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
