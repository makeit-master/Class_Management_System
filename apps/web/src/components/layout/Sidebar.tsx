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
import "./Sidebar.css";

type SidebarProps = {
  activePage: string;
  onNavigate: (page: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
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
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}
      aria-label="Main navigation"
    >
      <div className="sidebar-logo">
        <div className="logo-icon">
          <GraduationCap size={20} />
        </div>
        <span className="sidebar-label sidebar-brand">ClassFlow</span>
        <button
          type="button"
          className="sidebar-collapse"
          onClick={() => setCollapsed((v) => !v)}
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
      <div
        className="sidebar-profile"
        title={collapsed ? "Admin User · Administrator" : undefined}
      >
        <div className="profile-avatar">A</div>
        <div className="profile-info sidebar-label">
          <strong>Admin User</strong>
          <span>Administrator</span>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="Pages">
        {groups.map((group) => (
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
                className={`sidebar-item ${activePage === label ? "active" : ""}`}
                onClick={() => onNavigate(label)}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="sidebar-label">{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
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
        <button
          type="button"
          className={`sidebar-item ${activePage === "Settings" ? "active" : ""}`}
          onClick={() => onNavigate("Settings")}
          title={collapsed ? "Settings" : undefined}
          aria-label="Settings"
        >
          <Settings size={18} />
          <span className="sidebar-label">Settings</span>
        </button>
        <button
          type="button"
          className="sidebar-item logout"
          disabled
          title="Logout available after authentication is implemented"
          aria-label="Logout (not available yet)"
        >
          <LogOut size={18} />
          <span className="sidebar-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}
