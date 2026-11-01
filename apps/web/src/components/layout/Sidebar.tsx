import { useState } from "react";
import {
  CalendarDays,
  BookOpen,
  Users,
  GraduationCap,
  ClipboardCheck,
  ChartColumn,
  Settings,
  LogOut,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
} from "lucide-react";

import { canAccessPage } from "../../auth/permissions";
import type { AuthUser } from "../../auth/auth-api";

import "./Sidebar.css";

type SidebarProps = {
  activePage: string;
  onNavigate: (page: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  user: AuthUser | null;
};

const groups = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", icon: LayoutDashboard },
      { label: "Classes", icon: BookOpen },
      { label: "Students", icon: Users },
      { label: "Teachers", icon: GraduationCap },
    ],
  },
  {
    title: "ACADEMIC",
    items: [
      { label: "Attendance", icon: ClipboardCheck },
      { label: "Grades", icon: ChartColumn },
      { label: "Schedule", icon: CalendarDays },
    ],
  },
];

export default function Sidebar({
  activePage,
  onNavigate,
  isDark,
  onToggleTheme,
  onLogout,
  user,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Authenticated user information
  const userName = user?.fullName?.trim() || "Teacher";

  const userInitial = Array.from(userName)[0]?.toUpperCase() || "T";

  const userRole = user?.role === "ADMIN" ? "Administrator" : "Teacher";

  // Filter navigation according to RBAC permissions
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessPage(user, item.label)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <GraduationCap size={20} />
        </div>

        <span className="sidebar-label sidebar-brand">ClassFlow</span>

        <button
          type="button"
          className="sidebar-collapse"
          onClick={() => setCollapsed((previous) => !previous)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
        </button>
      </div>

      {/* User profile */}
      <div
        className="sidebar-profile"
        title={collapsed ? `${userName} · ${userRole}` : undefined}
      >
        <div className="profile-avatar">{userInitial}</div>

        <div className="profile-info sidebar-label">
          <strong>{userName}</strong>
          <span>{userRole}</span>
        </div>
      </div>

      {/* Role-based navigation */}
      <nav className="sidebar-nav" aria-label="Pages">
        {visibleGroups.map((group) => (
          <div className="menu-section" key={group.title}>
            <p className="menu-section-title">
              {collapsed ? "· · ·" : group.title}
            </p>

            {group.items.map(({ label, icon: Icon }) => (
              <button
                type="button"
                key={label}
                title={collapsed ? label : undefined}
                aria-label={label}
                aria-current={activePage === label ? "page" : undefined}
                className={`sidebar-item ${
                  activePage === label ? "active" : ""
                }`}
                onClick={() => onNavigate(label)}
              >
                <Icon size={18} aria-hidden="true" />

                <span className="sidebar-label">{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="sidebar-bottom">
        {/* Theme toggle */}
        <button
          type="button"
          className="sidebar-item"
          onClick={onToggleTheme}
          title={collapsed ? (isDark ? "Light Mode" : "Dark Mode") : undefined}
          aria-label={isDark ? "Light Mode" : "Dark Mode"}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}

          <span className="sidebar-label">
            {isDark ? "Light Mode" : "Dark Mode"}
          </span>
        </button>

        {/* Admin-only settings */}
        {canAccessPage(user, "Settings") && (
          <button
            type="button"
            className={`sidebar-item ${
              activePage === "Settings" ? "active" : ""
            }`}
            onClick={() => onNavigate("Settings")}
            title={collapsed ? "Settings" : undefined}
            aria-label="Settings"
          >
            <Settings size={18} />

            <span className="sidebar-label">Settings</span>
          </button>
        )}

        {/* Logout available to authenticated users */}
        <button
          type="button"
          className="sidebar-item logout"
          onClick={onLogout}
          title={collapsed ? "Logout" : undefined}
          aria-label="Logout"
        >
          <LogOut size={18} />

          <span className="sidebar-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}
