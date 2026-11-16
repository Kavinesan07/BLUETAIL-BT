import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";
import { auth } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Always initialize user as null and loading as true on fresh mount
  // Never treat a stored object as proof of authentication before backend verification
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Validate JWT on mount through protected backend endpoint /users/me
  useEffect(() => {
    let isMounted = true;
    const token = auth.getToken();

    if (!token) {
      if (isMounted) {
        setUser(null);
        setLoading(false);
      }
      return;
    }

    authService
      .getMe()
      .then((res) => {
        if (!isMounted) return;
        if (res?.user) {
          const u = res.user;
          const existingAvatar =
            (u.id ? localStorage.getItem(`bluetail_avatar_${u.id}`) : null) ||
            (u.email ? localStorage.getItem(`bluetail_avatar_${u.email}`) : null);
          const verifiedUser = { ...u, avatar: existingAvatar || u.avatar || null };
          auth.setUser(verifiedUser);
          setUser(verifiedUser);
        } else {
          auth.removeToken();
          setUser(null);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // On 401 or any verification failure, purge session credentials completely
        auth.removeToken();
        setUser(null);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      if (data.access_token) {
        auth.setToken(data.access_token);
      }
      const existingAvatar =
        (data.user?.id ? localStorage.getItem(`bluetail_avatar_${data.user.id}`) : null) ||
        (data.user?.email ? localStorage.getItem(`bluetail_avatar_${data.user.email}`) : null);
      const userWithAvatar = existingAvatar ? { ...data.user, avatar: existingAvatar } : data.user;
      auth.setUser(userWithAvatar);
      setUser(userWithAvatar);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (username, email, password) => {
      setLoading(true);
      try {
        const data = await authService.register(username, email, password);
        if (data.access_token) {
          auth.setToken(data.access_token);
        }
        if (data.user) {
          auth.setUser(data.user);
          setUser(data.user);
        }
        return data;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    auth.removeToken();
    setUser(null);
    setLoading(false);
  }, []);

  const updateAvatar = useCallback((avatarUrl) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, avatar: avatarUrl || null };
      auth.setUser(updated);
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
      loading,
      isAuthenticated: !loading && !!user && auth.isAuthenticated(),
      isAdmin: !loading && !!user && user.role === 1,
      login,
      register,
      logout,
      updateAvatar,
    }),
    [user, loading, login, register, logout, updateAvatar]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
