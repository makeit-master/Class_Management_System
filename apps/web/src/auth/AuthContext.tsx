import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { loginRequest, meRequest, type AuthUser } from "./auth-api";
import { setUnauthorizedHandler } from "../lib/api-client";

export type SessionNotice = "expired" | "unauthorized" | null;

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  sessionNotice: SessionNotice;
  clearSessionNotice: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Client-side expiry is for UI only. Server must still verify every JWT.
function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(base64)) as { exp?: unknown };
    if (typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp)) {
      return null;
    }
    return decoded.exp * 1000;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<SessionNotice>(null);

  const endSession = useCallback((reason: SessionNotice) => {
    setToken(null);
    setUser(null);
    setSessionNotice(reason);
  }, []);

  const logout = useCallback(() => endSession(null), [endSession]);
  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  async function login(email: string, password: string) {
    const accessToken = await loginRequest(email.trim(), password);
    const currentUser = await meRequest(accessToken);

    if (currentUser.role !== "TEACHER" && currentUser.role !== "ADMIN") {
      throw new Error("Access denied");
    }

    const expiresAt = getTokenExpiry(accessToken);
    if (expiresAt !== null && expiresAt <= Date.now()) {
      throw new Error("The session has already expired.");
    }

    setSessionNotice(null);
    setToken(accessToken);
    setUser(currentUser);
  }

  // Only a 401 on the currently authenticated token ends that session.
  useEffect(() => {
    if (!token) {
      setUnauthorizedHandler(null);
      return;
    }

    setUnauthorizedHandler((rejectedToken) => {
      if (rejectedToken === token) endSession("unauthorized");
    });

    return () => setUnauthorizedHandler(null);
  }, [token, endSession]);

  // Sign out at the exp time. For very long tokens, re-check after each chunk.
  useEffect(() => {
    if (!token) return;

    const expiresAt = getTokenExpiry(token);
    if (expiresAt === null) return;

    let timeout: number | undefined;
    const checkExpiry = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        endSession("expired");
      } else {
        timeout = window.setTimeout(
          checkExpiry,
          Math.min(remaining, 2_147_483_647),
        );
      }
    };

    checkExpiry();
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [token, endSession]);

  return (
    <AuthContext.Provider
      value={{ user, token, sessionNotice, clearSessionNotice, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
