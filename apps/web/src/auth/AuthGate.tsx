import type { ReactNode } from "react";
import { useAuth } from "./auth-context";
import LoginPage from "../pages/LoginPage";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <>{children}</> : <LoginPage />;
}
