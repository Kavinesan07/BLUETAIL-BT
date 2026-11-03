import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);
const STORAGE_KEY = "bluetail_user";

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (!stored) return null;
    const avatar =
      stored.avatar ||
      (stored.id ? localStorage.getItem(`bluetail_avatar_${stored.id}`) : null) ||
      (stored.email ? localStorage.getItem(`bluetail_avatar_${stored.email}`) : null);
    return avatar ? { ...stored, avatar } : stored;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  // Sync latest user role from backend in case user was logged in prior to role field addition
  useEffect(() => {
    if (user?.id) {
      authService
        .getUser(user.id)
        .then((res) => {
          if (res?.user && res.user.role !== user.role) {
            setUser((prev) => {
              if (!prev) return null;
              const merged = { ...prev, ...res.user, avatar: prev.avatar || res.user.avatar };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              return merged;
            });
          }
        })
        .catch(() => {
          // silently ignore network failure
        });
    }
  }, [user?.id]);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    const existingAvatar =
      (data.user?.id ? localStorage.getItem(`bluetail_avatar_${data.user.id}`) : null) ||
      (data.user?.email ? localStorage.getItem(`bluetail_avatar_${data.user.email}`) : null);
    const userWithAvatar = existingAvatar ? { ...data.user, avatar: existingAvatar } : data.user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userWithAvatar));
    setUser(userWithAvatar);
  }, []);

  const register = useCallback(
    (username, email, password) => authService.register(username, email, password),
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const updateAvatar = useCallback((avatarUrl) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, avatar: avatarUrl || null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (prev.id) {
        if (avatarUrl) localStorage.setItem(`bluetail_avatar_${prev.id}`, avatarUrl);
        else localStorage.removeItem(`bluetail_avatar_${prev.id}`);
      }
      if (prev.email) {
        if (avatarUrl) localStorage.setItem(`bluetail_avatar_${prev.email}`, avatarUrl);
        else localStorage.removeItem(`bluetail_avatar_${prev.email}`);
      }
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 1,
      login,
      register,
      logout,
      updateAvatar,
    }),
    [user, login, register, logout, updateAvatar]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
