"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getMe,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getAuthConfig,
  type User,
} from "@/lib/api";
import { AuthModal } from "@/components/auth/auth-modal";

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  googleAuthEnabled: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  openAuthModal: (tab?: "login" | "register") => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminFlag, setAdminFlag] = useState(false);
  const [loading, setLoading] = useState(true);
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");

  const refresh = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(data.user);
      setAdminFlag(data.isAdmin);
    } catch {
      setUser(null);
      setAdminFlag(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      getMe()
        .then((data) => { setUser(data.user); setAdminFlag(data.isAdmin); })
        .catch(() => setUser(null)),
      getAuthConfig()
        .then((c) => setGoogleAuthEnabled(c.googleAuthEnabled))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const u = await apiRegister(name, email, password);
      setUser(u);
      return u;
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const openAuthModal = useCallback((tab: "login" | "register" = "login") => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAdmin: adminFlag, loading, googleAuthEnabled, login, register, logout, refresh, openAuthModal }}
    >
      {children}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} defaultTab={authModalTab} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
