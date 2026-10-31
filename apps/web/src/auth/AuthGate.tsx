import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import LoginPage from "../pages/LoginPage";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <LoginPage />;
}
