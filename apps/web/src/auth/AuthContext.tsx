import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { loginRequest, meRequest, type AuthUser } from "./auth-api";

import { setUnauthorizedHandler } from "../lib/api-client";

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Read expiry from JWT payload.
// This is only for scheduling frontend logout.
// The backend remains responsible for JWT verification.
function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

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

  function logout() {
    setToken(null);
    setUser(null);
  }

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

    setToken(accessToken);
    setUser(currentUser);
  }

  // Handle HTTP 401 from requests authenticated with
  // the current access token.
  useEffect(() => {
    if (!token) {
      setUnauthorizedHandler(null);
      return;
    }

    setUnauthorizedHandler((rejectedToken) => {
      if (rejectedToken === token) {
        logout();
      }
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [token]);

  // Automatically sign out when JWT expires.
  useEffect(() => {
    if (!token) return;

    const expiresAt = getTokenExpiry(token);

    if (expiresAt === null) {
      // No usable exp claim: backend 401 remains the fallback.
      return;
    }

    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
      logout();
      return;
    }

    // Browser timeouts are limited to signed 32-bit milliseconds.
    const timeout = window.setTimeout(
      logout,
      Math.min(remaining, 2_147_483_647),
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
