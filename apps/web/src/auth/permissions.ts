import type { AuthUser } from "./auth-api";

export type AppRole = AuthUser["role"];

export type AppPermission =
  | "dashboard:view"
  | "classes:view"
  | "students:view"
  | "teachers:manage"
  | "attendance:view"
  | "attendance:edit"
  | "grades:view"
  | "schedule:view"
  | "settings:manage";

const rolePermissions: Record<AppRole, readonly AppPermission[]> = {
  ADMIN: [
    "dashboard:view",
    "classes:view",
    "students:view",
    "teachers:manage",
    "attendance:view",
    "attendance:edit",
    "grades:view",
    "schedule:view",
    "settings:manage",
  ],

  TEACHER: [
    "dashboard:view",
    "classes:view",
    "students:view",
    "attendance:view",
    "attendance:edit",
    "grades:view",
    "schedule:view",
  ],
};

export function can(user: AuthUser | null, permission: AppPermission): boolean {
  if (!user) return false;

  return rolePermissions[user.role]?.includes(permission) ?? false;
}

export const pagePermissions: Record<string, AppPermission> = {
  Dashboard: "dashboard:view",
  Classes: "classes:view",
  Students: "students:view",
  Teachers: "teachers:manage",
  Attendance: "attendance:view",
  Grades: "grades:view",
  Schedule: "schedule:view",
  Settings: "settings:manage",
};

export function canAccessPage(user: AuthUser | null, page: string): boolean {
  const permission = pagePermissions[page];

  return permission !== undefined && can(user, permission);
}
