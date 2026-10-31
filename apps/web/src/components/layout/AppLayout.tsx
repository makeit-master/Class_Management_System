import { useState, type ReactNode } from "react";
import DashboardPage from "../../features/dashboard/DashboardPage";
import ClassesPage from "../../features/classes/ClassesPage";
import StudentsPage from "../../features/students/StudentsPage";
import TeachersPage from "../../features/teachers/TeachersPage";
import AttendancePage from "../../features/attendance/AttendancePage";
import SchedulePage from "../../features/schedule/SchedulePage";
import GradesPage from "../../features/grades/GradesPage";
import SettingsPage from "../../features/settings/SettingsPage";
import Sidebar from "./Sidebar";
import Header from "./Header";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [isDark, setIsDark] = useState(true);

  const handleNavigate = (page: string) => {
    setActivePage(page);
  };

  const handleToggleTheme = () => {
    setIsDark((previous) => !previous);
  };

  const handleNotify = (message: string) => {
    window.alert(message);
  };

  return (
    <div className={`app-container ${isDark ? "dark-theme" : "light-theme"}`}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
      />

      <div className="app-main">
        <Header pageTitle={activePage} onNavigate={handleNavigate} />

        <main className="main-content">
          <main className="main-content">
            {activePage === "Dashboard" ? (
              <DashboardPage navigate={handleNavigate} notify={handleNotify} />
            ) : activePage === "Classes" ? (
              <ClassesPage />
            ) : activePage === "Students" ? (
              <StudentsPage />
            ) : activePage === "Teachers" ? (
              <TeachersPage />
            ) : activePage === "Attendance" ? (
              <AttendancePage />
            ) : activePage === "Grades" ? (
              <GradesPage />
            ) : activePage === "Schedule" ? (
              <SchedulePage />
            ) : activePage === "Settings" ? (
              <SettingsPage isDark={isDark} onToggleTheme={handleToggleTheme} />
            ) : (
              children
            )}
          </main>
        </main>
      </div>
    </div>
  );
}
