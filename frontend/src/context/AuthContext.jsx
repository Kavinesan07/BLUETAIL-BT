import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";
import { auth } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Synchronously seed user from the verified JWT token in sessionStorage (if valid)
  // No user JSON payload is stored in sessionStorage; user data is extracted from the JWT
  const [user, setUser] = useState(() => {
    const token = auth.getToken();
    if (!token) return null;
    const tokenUser = auth.getUser();
    if (!tokenUser) return null;
    const existingAvatar =
      (tokenUser.id ? localStorage.getItem(`bluetail_avatar_${tokenUser.id}`) : null) ||
      (tokenUser.email ? localStorage.getItem(`bluetail_avatar_${tokenUser.email}`) : null);
    return { ...tokenUser, avatar: existingAvatar || null };
  });

  const [loading, setLoading] = useState(() => {
    const token = auth.getToken();
    return !!token;
  });

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
          setUser(verifiedUser);
        } else {
          auth.removeToken();
          setUser(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        // If 401 Unauthorized (token invalid, expired, or user deleted), purge session
        if (err?.status === 401) {
          auth.removeToken();
          setUser(null);
        }
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
      setUser(userWithAvatar);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (username, email, password, otp) => {
      setLoading(true);
      try {
        const data = await authService.register(username, email, password, otp);
        // Do NOT automatically log in or set token:
        // New users must log in on the Login page for the first time
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
      isAdmin: !loading && !!user && (user.role === 1 || user.role === 2),
      isShopOwner: !loading && !!user && user.role === 1,
      isSuperAdmin: !loading && !!user && user.role === 2,
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
