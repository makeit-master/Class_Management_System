import type { ReactNode } from "react";
import { useAuth } from "./auth-context";
import { can, type AppPermission } from "./permissions";

type CanAccessProps = {
  permission: AppPermission;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function CanAccess({
  permission,
  children,
  fallback = null,
}: CanAccessProps) {
  const { user } = useAuth();

  if (!can(user, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
