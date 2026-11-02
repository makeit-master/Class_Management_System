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
  isInitializing: boolean;
  clearSessionNotice: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = "classflow_access_token";

// ============================================================
// HELPERS
// ============================================================

// Read JWT expiry for client-side UI checks.
// The backend remains responsible for verifying the JWT.
function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];

    if (!payload) return null;

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");

    const decoded = JSON.parse(atob(base64)) as {
      exp?: unknown;
    };

    if (typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp)) {
      return null;
    }

    return decoded.exp * 1000;
  } catch {
    return null;
  }
}

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function removeStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in some environments.
  }
}

// ============================================================
// AUTH PROVIDER
// ============================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const [token, setToken] = useState<string | null>(null);

  const [sessionNotice, setSessionNotice] = useState<SessionNotice>(null);

  const [isInitializing, setIsInitializing] = useState(true);

  // ==========================================================
  // END SESSION
  // ==========================================================

  const endSession = useCallback((reason: SessionNotice) => {
    removeStoredToken();

    setToken(null);
    setUser(null);
    setSessionNotice(reason);
  }, []);

  const logout = useCallback(() => {
    endSession(null);
  }, [endSession]);

  const clearSessionNotice = useCallback(() => {
    setSessionNotice(null);
  }, []);

  // ==========================================================
  // RESTORE SESSION AFTER PAGE REFRESH
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedToken = readStoredToken();

      // No previous session.
      if (!storedToken) {
        if (!cancelled) {
          setIsInitializing(false);
        }

        return;
      }

      // Reject expired tokens before contacting the API.
      const expiresAt = getTokenExpiry(storedToken);

      if (expiresAt === null || expiresAt <= Date.now()) {
        if (!cancelled) {
          endSession("expired");
          setIsInitializing(false);
        }

        return;
      }

      try {
        // Server validates the stored JWT.
        const currentUser = await meRequest(storedToken);

        if (currentUser.role !== "ADMIN" && currentUser.role !== "TEACHER") {
          throw new Error("Access denied");
        }

        if (cancelled) return;

        // Token may expire while the request is running.
        if (expiresAt <= Date.now()) {
          endSession("expired");
          return;
        }

        setToken(storedToken);
        setUser(currentUser);
        setSessionNotice(null);
      } catch {
        if (cancelled) return;

        // Invalid token or failed session validation.
        endSession("unauthorized");
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [endSession]);

  // ==========================================================
  // LOGIN
  // ==========================================================

  async function login(email: string, password: string): Promise<void> {
    const accessToken = await loginRequest(email.trim(), password);

    const currentUser = await meRequest(accessToken);

    if (currentUser.role !== "ADMIN" && currentUser.role !== "TEACHER") {
      throw new Error("Access denied");
    }

    const expiresAt = getTokenExpiry(accessToken);

    if (expiresAt === null || expiresAt <= Date.now()) {
      throw new Error("The session has already expired or is invalid.");
    }

    // Save token before updating React state.
    saveStoredToken(accessToken);

    setSessionNotice(null);
    setToken(accessToken);
    setUser(currentUser);
  }

  // ==========================================================
  // GLOBAL 401 HANDLER
  // ==========================================================

  useEffect(() => {
    if (!token) {
      setUnauthorizedHandler(null);
      return;
    }

    setUnauthorizedHandler((rejectedToken) => {
      // Ignore a 401 from an older token.
      if (rejectedToken === token) {
        endSession("unauthorized");
      }
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [token, endSession]);

  // ==========================================================
  // AUTO LOGOUT WHEN JWT EXPIRES
  // ==========================================================

  useEffect(() => {
    if (!token) return;

    const expiresAt = getTokenExpiry(token);

    if (expiresAt === null) {
      endSession("expired");
      return;
    }

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
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
    };
  }, [token, endSession]);

  // ==========================================================
  // WAIT FOR SESSION RESTORATION
  // ==========================================================

  if (isInitializing) {
    return (
      <div
        role="status"
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#15151a",
          color: "#f3f3f5",
          fontFamily: "inherit",
          fontSize: "14px",
        }}
      >
        Restoring your ClassFlow session...
      </div>
    );
  }

  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        sessionNotice,
        isInitializing,
        clearSessionNotice,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// AUTH HOOK
// ============================================================

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
