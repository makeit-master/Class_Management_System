import { createContext, useContext, useState, type ReactNode } from "react";
import { loginRequest, meRequest, type AuthUser } from "./auth-api";

type AuthValue = {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};
const Context = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  async function login(email: string, password: string) {
    const nextToken = await loginRequest(email.trim(), password);
    const nextUser = await meRequest(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <Context.Provider value={{ user, token, login, logout }}>
      {children}
    </Context.Provider>
  );
}

export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
