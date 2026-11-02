import { createContext, useContext } from "react";

import type { AuthUser } from "./auth-api";

export type SessionNotice = "expired" | "unauthorized" | null;

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  sessionNotice: SessionNotice;
  isInitializing: boolean;
  clearSessionNotice: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
