import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth-context";
import AuthLayout from "../pages/AuthLayout";
import LoginPage from "../pages/LoginPage";
import RegistrationPage from "../pages/RegistrationPage";
import RegistrationStatusPage from "../pages/RegistrationStatusPage";
import PolicyPage from "../pages/PolicyPage";
export default function AuthGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <>{children}</>
          ) : (
            <Navigate
              to={
                location.hash.startsWith("#verify=")
                  ? "/registration-status" + location.hash
                  : "/login"
              }
              replace
            />
          )
        }
      />
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/" replace /> : <RegistrationPage />}
        />
        <Route
          path="/complete-profile"
          element={<RegistrationPage complete />}
        />
        <Route
          path="/registration-status"
          element={<RegistrationStatusPage />}
        />
        <Route
          path="/pending-approval"
          element={<RegistrationStatusPage pending />}
        />
        <Route path="/terms" element={<PolicyPage />} />
        <Route path="/privacy" element={<PolicyPage privacy />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to={user ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}
