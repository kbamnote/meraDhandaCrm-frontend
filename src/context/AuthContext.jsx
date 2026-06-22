import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);           // Firebase user
  const [profile, setProfile] = useState(null);     // /mpw/users/{uid}
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        try {
          // Make sure a profile exists, then fetch it.
          await authApi.bootstrap({}).catch(() => {});
          const me = await authApi.me();
          setProfile(me.profile);
        } catch (e) {
          console.warn('Profile load failed:', e.message);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signOut = () => fbSignOut(auth);

  const hasRole = (...roles) =>
    !!profile && (roles.includes(profile.role) || roles.includes(profile.customRole));

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, hasRole, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
