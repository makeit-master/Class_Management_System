import { useState, type ReactNode } from "react";

import DashboardPage from "../../features/dashboard/DashboardPage";
import ClassesPage from "../../features/classes/ClassesPage";
import StudentsPage from "../../features/students/StudentsPage";
import TeachersPage from "../../features/teachers/TeachersPage";
import AttendancePage from "../../features/attendance/AttendancePage";
import SchedulePage from "../../features/schedule/SchedulePage";
import GradesPage from "../../features/grades/GradesPage";
import SettingsPage from "../../features/settings/SettingsPage";

import { canAccessPage } from "../../auth/permissions";
import { useAuth } from "../../auth/AuthContext";

import Sidebar from "./Sidebar";
import Header from "./Header";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [isDark, setIsDark] = useState(true);

  const { user, logout } = useAuth();

  const handleNavigate = (page: string) => {
    if (!canAccessPage(user, page)) {
      window.alert("You do not have permission to access this page.");
      return;
    }

    setActivePage(page);
  };

  const handleToggleTheme = () => {
    setIsDark((previous) => !previous);
  };

  const handleNotify = (message: string) => {
    window.alert(message);
  };

  const handleLogout = () => {
    logout();
  };

  const renderPage = () => {
    if (!canAccessPage(user, activePage)) {
      return (
        <section role="alert" className="dashboard-placeholder">
          <h2>Access denied</h2>
          <p>You do not have permission to view this page.</p>
        </section>
      );
    }

    switch (activePage) {
      case "Dashboard":
        return (
          <DashboardPage navigate={handleNavigate} notify={handleNotify} />
        );

      case "Classes":
        return <ClassesPage />;

      case "Students":
        return <StudentsPage />;

      case "Teachers":
        return <TeachersPage />;

      case "Attendance":
        return <AttendancePage />;

      case "Grades":
        return <GradesPage />;

      case "Schedule":
        return <SchedulePage />;

      case "Settings":
        return (
          <SettingsPage isDark={isDark} onToggleTheme={handleToggleTheme} />
        );

      default:
        return children;
    }
  };

  return (
    <div className={`app-container ${isDark ? "dark-theme" : "light-theme"}`}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
        user={user}
      />

      <div className="app-main">
        <Header
          pageTitle={activePage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          user={user}
        />

        <main className="main-content">{renderPage()}</main>
      </div>
    </div>
  );
}
