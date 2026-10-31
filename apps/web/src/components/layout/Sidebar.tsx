
import {
  LayoutDashboard,
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
} from "lucide-react";

type SidebarProps = {
  activePage: string;
  onNavigate: (page: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
};

const menuItems = [
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
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <GraduationCap size={20} />
        </div>
        <span>ClassFlow</span>
      </div>

      <div className="sidebar-profile">
        <div className="profile-avatar">A</div>
        <div className="profile-info">
          <strong>Admin User</strong>
          <span>Administrator</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((section) => (
          <div className="menu-section" key={section.title}>
            <p className="menu-section-title">{section.title}</p>

            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.label;

              return (
                <button
                  key={item.label}
                  className={`sidebar-item ${isActive ? "active" : ""}`}
                  onClick={() => onNavigate(item.label)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="sidebar-item" onClick={onToggleTheme}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
        </button>

        <button
          className={`sidebar-item ${
            activePage === "Settings" ? "active" : ""
          }`}
          onClick={() => onNavigate("Settings")}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>

        <button className="sidebar-item logout">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
